import { proxyManager } from './proxyManager.js';
import logStore from '../utils/logStore.js';
import { extractDate, expandDateKeys } from '../utils/dateExtractor.js';
import plannerStorage from '../utils/plannerStorage.js';
import { DEFAULT_SETTINGS } from '../utils/storage.js';

export const CACHE_KEY = 'upAhead_cache';

// ============================================================
// CACHE MANAGEMENT
// ============================================================

export function loadFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            // Optional: Check if cache is too old (e.g. > 8 hours)
            // But requirement says "show stale data if less than 8hrs", implying we show it anyway?
            // "Loading phase 1: Load ... with showing stale data if less than 8hrs."
            // If it's older than 8 hours, maybe we shouldn't show it?
            // Let's return it with a timestamp check.
            const age = Date.now() - (new Date(data.lastUpdated || 0).getTime());
            if (age > 8 * 60 * 60 * 1000) {
                 console.log('[UpAheadService] Cache is older than 8 hours.');
                 // We still return it, but maybe mark it?
                 // User said "show stale data if less than 8hrs".
                 // If > 8hrs, maybe return null?
                 // "some time I doubt even if its working since it shows blank page for very long time."
                 // Showing *something* is better than nothing.
            }
            return data;
        }
    } catch (e) {
        console.warn('Cache read error', e);
    }
    return null;
}

export function saveToCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Cache write error', e);
    }
}

// ============================================================
// SMART KEYWORD FILTERS FOR PLANNING
// ============================================================

// Word-boundary matching
const _wbCache = new Map();
function matchesWord(text, word) {
    let re = _wbCache.get(word);
    if (!re) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        re = new RegExp(`\\b${escaped}\\b`, 'i');
        _wbCache.set(word, re);
    }
    return re.test(text);
}

function hash(value) {
    let h = 0;
    if (!value) return "0";
    for (let i = 0; i < value.length; i++) {
        h = (h << 5) - h + value.charCodeAt(i);
        h |= 0;
    }
    return h.toString();
}

function generateCanonicalId(title, dateStr) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return hash(`${slug}-${dateStr}`);
}

function matchesKeyword(text, keyword) {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    if (keyword.includes(' ')) {
        return lowerText.includes(lowerKeyword);
    }
    return matchesWord(lowerText, lowerKeyword);
}

// Configuration for search queries based on categories
const CATEGORY_QUERIES = {
    movies: [
        'Tamil movie release this week',
        'new movie release OTT',
        'BookMyShow Chennai movies',
        'upcoming movies Kollywood',
        'movie tickets showtimes'
    ],
    events: [
        'Chennai events this week',
        'LiveChennai events',
        'concert tickets Chennai',
        'standup comedy show Chennai',
        'exhibition workshops Chennai',
        'things to do Chennai weekend',
        'Muscat events this week',
        'Muscat concerts exhibitions',
        'theatre shows Chennai this week',
        'art exhibition Chennai',
        'food festival Chennai',
        'cultural event Chennai',
        'music sabha Chennai',
        'Muscat Royal Opera House events'
    ],
    festivals: [
        'Maha Shivaratri 2025 date',
        'upcoming festivals Tamil Nadu 2025',
        'bank holidays India upcoming',
        'public holidays Tamil Nadu',
        'religious festivals this month India',
        'Oman festivals holidays'
    ],
    alerts: [
        'TANGEDCO power cut Chennai tomorrow',
        'TNEB power shutdown schedule',
        'Chennai traffic advisory today',
        'Chennai metro maintenance',
        'water supply disruption Chennai',
        'road closure Chennai'
    ],
    weather_alerts: [
        'IMD Chennai weather warning',
        'Tamil Nadu heavy rain alert',
        'cyclone warning Chennai',
        'heat wave advisory Tamil Nadu',
        'Oman weather warning Muscat'
    ],
    sports: [
        'IPL 2026 schedule matches',
        'cricket match Chennai CSK',
        'ISL football match schedule',
        'Pro Kabaddi schedule',
        'sports events Chennai this week'
    ],
    shopping: [
        'Chennai sale offers discount today',
        'exhibition sale Chennai',
        'Pongal sale Tamil Nadu',
        'Diwali offers Chennai',
        'end of season sale Chennai mall',
        'Muscat shopping festival offers'
    ],
    airlines: [
        'Oman Air flight offers',
        'Indigo Airlines offers',
        'Salam Air ticket offers',
        'Air India sale',
        'flight ticket offers India'
    ],
    civic: [
        'VIP visit Chennai road closure',
        'minister visit Tamil Nadu traffic',
        'protest bandh Chennai tomorrow',
        'Chennai corporation announcement',
        'Muscat road closure traffic'
    ]
};

const STATIC_FEEDS = {
    movies: [
        "https://www.hindustantimes.com/feeds/rss/entertainment/tamil-cinema/rssfeed.xml",
        "https://www.hindustantimes.com/feeds/rss/entertainment/bollywood/rssfeed.xml"
    ],
    sports: [
        "https://www.espn.com/espn/rss/news"
    ],
    festivals: [
        "https://www.timeanddate.com/holidays/india/feed"
    ],
    events: [
        "https://www.thehindu.com/news/cities/chennai/feeder/default.rss"
    ]
};

export async function fetchStaticUpAheadData() {
    try {
        const baseUrl = import.meta.env.BASE_URL;
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        const url = `${cleanBase}data/up_ahead.json`;

        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[UpAheadService] Static fetch failed: ${response.status}`);
            return null;
        }
        const data = await response.json();
        if (data.error) {
             console.warn(`[UpAheadService] Static data has error: ${data.error}`);
             return null;
        }
        return data;
    } catch (e) {
        console.error(`[UpAheadService] Static fetch exception:`, e);
        return null;
    }
}

export function mergeUpAheadData(baseData, newData) {
    if (!baseData) return newData;
    if (!newData) return baseData;

    const merged = { ...baseData };

    // 1. Merge Timeline
    const timelineMap = new Map();
    if (baseData.timeline) {
        baseData.timeline.forEach(day => {
             timelineMap.set(day.date, { ...day, items: [...(day.items || [])] });
        });
    }

    if (newData.timeline) {
        newData.timeline.forEach(day => {
            if (!timelineMap.has(day.date)) {
                timelineMap.set(day.date, day);
            } else {
                const existingDay = timelineMap.get(day.date);
                const existingIds = new Set(existingDay.items.map(i => i.id));
                day.items.forEach(item => {
                    if (!existingIds.has(item.id)) {
                        existingDay.items.push(item);
                        existingIds.add(item.id);
                    }
                });
            }
        });
    }
    merged.timeline = Array.from(timelineMap.values()).sort((a,b) => a.date.localeCompare(b.date));

    // 2. Merge Sections
    if (newData.sections) {
        if (!merged.sections) merged.sections = {};
        Object.keys(newData.sections).forEach(key => {
            const existing = merged.sections[key] || [];
            const newItems = newData.sections[key] || [];
            const existingTitles = new Set(existing.map(i => i.title));
            const combined = [...existing];

            newItems.forEach(item => {
                if (!existingTitles.has(item.title)) {
                    combined.push(item);
                    existingTitles.add(item.title);
                }
            });
            merged.sections[key] = combined;
        });
    }

    // 3. Regenerate Weekly Plan based on merged timeline
    // Note: We use settings blacklist if handled externally, or regenerate in UI
    merged.weekly_plan = generateWeeklyPlan(merged.timeline, new Set()); // Blacklist handled in UI or reload
    merged.lastUpdated = newData.lastUpdated || baseData.lastUpdated;

    return merged;
}


export async function fetchLiveUpAheadData(settings) {
    const _t0 = Date.now();
    console.log('[UpAheadService] Fetching LIVE data with settings:', settings);

    const categories = settings?.categories || { movies: true, events: true, festivals: true, alerts: true, sports: true };
    const locations = settings?.locations && settings.locations.length > 0 ? settings.locations : ['Chennai', 'India'];

    // Extract keywords map for categorization
    const keywordsMap = settings?.keywords || DEFAULT_SETTINGS.upAhead.keywords;

    let allItems = [];
    const urlsToFetch = [];

    const addSearchUrl = (query) => {
        const encoded = encodeURIComponent(query);
        urlsToFetch.push({
            url: `https://news.google.com/rss/search?q=${encoded}+when:7d&hl=en-IN&gl=IN&ceid=IN:en`,
            type: 'search',
            originalQuery: query
        });
    };

    for (const [cat, isEnabled] of Object.entries(categories)) {
        if (!isEnabled) continue;

        if (STATIC_FEEDS[cat]) {
            STATIC_FEEDS[cat].forEach(url => {
                urlsToFetch.push({ url, type: 'static', category: cat });
            });
        }

        const queries = CATEGORY_QUERIES[cat] || [];
        queries.forEach(baseQuery => {
            if (cat === 'events' || cat === 'alerts' || cat === 'movies') {
                locations.forEach(loc => {
                    if (loc.toLowerCase() === 'india' && (cat === 'alerts' || cat === 'events')) {
                        return;
                    }
                    addSearchUrl(`${baseQuery} ${loc}`);
                });
            } else if (cat === 'shopping' || cat === 'airlines') {
                 locations.forEach(loc => {
                     addSearchUrl(`${baseQuery} ${loc}`);
                 });
            } else {
                 addSearchUrl(`${baseQuery}`);
            }
        });
    }

    const uniqueUrls = [...new Map(urlsToFetch.map(item => [item.url, item])).values()];
    console.log(`[UpAheadService] Prepared ${uniqueUrls.length} feeds to fetch.`);

    // Start Live RSS Fetches
    const fetchPromises = uniqueUrls.map(async (feedConfig) => {
        try {
            const { items } = await proxyManager.fetchViaProxy(feedConfig.url);
            return items.map(item => normalizeUpAheadItem(item, feedConfig, keywordsMap));
        } catch (error) {
            console.warn(`[UpAheadService] Failed to fetch ${feedConfig.url}:`, error.message);
            return [];
        }
    });

    const results = await Promise.allSettled(fetchPromises);

    for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
            allItems.push(...results[i].value);
        } else {
            console.warn('[UpAheadService] A feed failed to load:', results[i].reason);
        }
    }

    // Process RSS Data
    const rssData = processUpAheadData(allItems, settings);

    try {
        for (const item of allItems) {
            if (item.extractedDate) {
                const dateResult = extractDate(
                    `${item.title} ${item.description || ''}`,
                    item.pubDate
                );
                if (dateResult) {
                    const keys = expandDateKeys(dateResult);
                    if (keys.length > 0) {
                        plannerStorage.merge(keys, [{ id: item.id, title: item.title, category: item.category, link: item.link }]);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[UpAhead] Planner storage write failed', e);
    }

    const _dur = Date.now() - _t0;
    const timelineCount = rssData?.timeline?.reduce((s, d) => s + (d.items?.length || 0), 0) || 0;
    logStore.success('upAhead', `LIVE: ${timelineCount} items from ${uniqueUrls.length} feeds`, { durationMs: _dur });

    return rssData;
}

function stripHtml(html) {
    if (!html) return "";
    let text = html.toString();
    const entities = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' };
    text = text.replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || match);
    text = text.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, "");
    text = text.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, "");
    text = text.replace(/<\/?[^>]+(>|$)/g, "");
    return text.trim();
}

export function normalizeUpAheadItem(item, config, keywordsMap = null) {
    const title = stripHtml(item.title || '');
    const rawDescription = item.description || '';
    const description = stripHtml(rawDescription);
    const fullText = `${title} ${description}`;

    let pubDate = item.pubDate ? new Date(item.pubDate) : null;
    if (pubDate && isNaN(pubDate.getTime())) {
        pubDate = null;
    }

    // Determine Category using keywordsMap if available
    let category = config.category;
    if (!category || config.type === 'search') {
        category = detectCategory(fullText, keywordsMap);
    }

    // 5-layer date extraction
    let extractedDate = null;
    const newDateResult = extractDate(fullText, pubDate);
    if (newDateResult?.start) {
        // Special logic for Shopping: Prefer End Date (Last Day) if available
        if (category === 'shopping' && newDateResult.end) {
            extractedDate = newDateResult.end;
        } else {
            extractedDate = newDateResult.start;
        }
    } else {
        extractedDate = extractFutureDate(fullText, pubDate);
    }

    let subItems = [];
    let isRoundup = false;
    if (/ott|releases|week/i.test(title) && /\d+ new/i.test(title)) {
        isRoundup = true;
    }

    if (isRoundup && category === 'movies') {
        subItems = parseRoundupContent(rawDescription, pubDate);
    }

    const dateStr = extractedDate ? extractedDate.toISOString().slice(0,10) : (pubDate ? pubDate.toISOString().slice(0,10) : 'nodate');
    const canonicalId = generateCanonicalId(title, dateStr);

    return {
        id: item.guid || item.link || title,
        canonicalId: canonicalId,
        title: title,
        link: item.link,
        description: description,
        pubDate: pubDate,
        extractedDate: extractedDate,
        category: category,
        rawSource: config.originalQuery || 'feed',
        isRoundup: isRoundup,
        subItems: subItems
    };
}

function parseRoundupContent(html, contextDate) {
    const items = [];
    const lines = html.split(/<br\s*\/?>|\n|<\/li>|<\/p>|•/i);
    const ottPlatforms = ['netflix', 'prime', 'prime video', 'hotstar', 'sony liv', 'zee5', 'jiocinema', 'aha', 'sunnxt', 'hulu', 'disney'];
    const platformRegex = new RegExp(`\\b(${ottPlatforms.sort((a,b) => b.length - a.length).join('|')})\\b`, 'i');

    lines.forEach(line => {
        const cleanLine = stripHtml(line).trim();
        if (cleanLine.length < 5) return;
        const hasPlatform = platformRegex.test(cleanLine);
        const date = extractFutureDate(cleanLine, contextDate);
        if (hasPlatform || date) {
            let title = cleanLine
                .replace(/^\d+\.\s*/, '')
                .replace(/^[-\u2013\u2014]\s*/, '')
                .replace(/\(.*\)/g, '')
                .trim();
            if (title.length < 3) return;
            const platformMatch = cleanLine.match(platformRegex);
            const platform = platformMatch ? platformMatch[0] : 'OTT';
            items.push({
                title: title,
                date: date,
                originalText: cleanLine,
                platform: platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase()
            });
        }
    });
    return items;
}

/**
 * Detect category based on keywords map from settings.
 */
export function detectCategory(text, keywordsMap = null) {
    const t = text.toLowerCase();

    // Use passed keywords map or fallback to Default
    const k = keywordsMap || DEFAULT_SETTINGS.upAhead.keywords;

    // Helper to check against array
    const hasAny = (arr) => arr && arr.some(kw => matchesKeyword(t, kw));

    // 1. Strict Exclusion
    // Note: We don't have a "general_negative" in default, so relying on hardcoded for safety unless settings override
    if (t.includes('arrest') || t.includes('held for') || t.includes('police') || t.includes('seized') || t.includes('murder') || t.includes('crime') || t.includes('jail') || t.includes('court') || t.includes('bail')) return 'general';
    if (t.includes('clinic') && t.includes('unregistered')) return 'general';

    // 2. Category Detection (Priority Order)
    if (hasAny(k.weather_alerts)) return 'weather_alerts';
    if (hasAny(k.alerts)) return 'alerts';

    if (hasAny(k.movies)) {
        // Strict Movie Filter
        const negs = k.movies_negative || [];
        if (negs.some(nw => matchesKeyword(t, nw))) return 'general';
        return 'movies';
    }

    if (hasAny(k.sports)) {
        const negs = k.sports_negative || [];
        if (negs.some(nw => matchesKeyword(t, nw))) return 'general';
        return 'sports';
    }

    if (hasAny(k.airlines)) return 'airlines';
    if (hasAny(k.shopping)) return 'shopping';

    if (hasAny(k.festivals)) return 'festivals';

    if (hasAny(k.civic)) return 'civic';
    if (hasAny(k.events)) return 'events';

    return 'general';
}

export function extractFutureDate(text, pubDate) {
    // Legacy fallback wrapper around dateExtractor
    const result = extractDate(text, pubDate);
    return result?.start || null;
}

export function processUpAheadData(rawItems, settings) {
    const today = new Date();
    today.setHours(0,0,0,0);

    const timelineMap = new Map();
    const sections = {
        movies: [],
        festivals: [],
        alerts: [],
        events: [],
        sports: [],
        shopping: [],
        civic: [],
        weather_alerts: [],
        airlines: []
    };

    const seenIds = new Set();
    const maxAgeHours = settings?.hideOlderThanHours || 336;
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    const CATEGORY_MAX_AGE_HOURS = {
        weather_alerts: 6,
        alerts: 12,
        festivals: 336
    };

    const userKeywords = settings?.keywords || settings?.upAhead?.keywords || DEFAULT_SETTINGS.upAhead.keywords;

    const getNegativesForCategory = (cat) => {
        let globalNegs = (userKeywords.negative && userKeywords.negative.length > 0)
            ? userKeywords.negative
            : DEFAULT_SETTINGS.upAhead.keywords.negative;

        const catKey = `${cat}_negative`;
        const catNegs = (userKeywords[catKey] && userKeywords[catKey].length > 0)
            ? userKeywords[catKey]
            : (DEFAULT_SETTINGS.upAhead.keywords[catKey] || []);

        return [...new Set([...globalNegs, ...catNegs])];
    };

    const signalWords = (settings?.signals || DEFAULT_SETTINGS.upAhead.signals);

    const mergedPositives = {};
    // Ensure all section keys exist in keywords map to avoid errors
    const sectionKeys = ['movies', 'events', 'festivals', 'alerts', 'sports', 'shopping', 'civic', 'weather_alerts', 'airlines'];
    sectionKeys.forEach(cat => {
        mergedPositives[cat] = (userKeywords[cat] && userKeywords[cat].length > 0)
            ? userKeywords[cat]
            : DEFAULT_SETTINGS.upAhead.keywords[cat] || [];
    });

    const userLocations = (settings?.locations || settings?.upAhead?.locations || ['Chennai', 'Muscat', 'Trichy']).map(l => l.toLowerCase());

    rawItems.forEach(item => {
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);

        if (!item.pubDate || isNaN(item.pubDate.getTime())) {
            return;
        }

        const ageMs = Date.now() - item.pubDate.getTime();
        let effectiveMaxAgeMs = maxAgeMs;
        if (CATEGORY_MAX_AGE_HOURS[item.category]) {
            const catLimitMs = CATEGORY_MAX_AGE_HOURS[item.category] * 60 * 60 * 1000;
            effectiveMaxAgeMs = Math.min(maxAgeMs, catLimitMs);
        }

        const isPlannerCategory = ['movies', 'events', 'sports', 'shopping', 'civic', 'festivals', 'airlines'].includes(item.category);
        const hasFutureDate = item.extractedDate && item.extractedDate >= today;

        if (!isPlannerCategory && !hasFutureDate && ageMs > effectiveMaxAgeMs) {
            return;
        }

        const fullText = (item.title + " " + item.description).toLowerCase();

        // Skip stale content based on text regex (e.g. "2 years ago")
        const staleRegex = /(?:•|-|published)\s*(\d+)\s*(mo|month|months|w|week|weeks|y|year|years)\s*(?:ago)?/i;
        const staleMatch = fullText.match(staleRegex);
        if (staleMatch) {
            const qty = parseInt(staleMatch[1]);
            const unit = staleMatch[2].toLowerCase();
            if (unit.startsWith('mo') || unit.startsWith('y')) return;
            if (unit.startsWith('w') && qty >= 1) return;
        }

        const isRoundup = /ott|releases|week|weekend/i.test(fullText) && /\d+ new/i.test(fullText);

        // Ranking
        let score = 0;
        const rankingConfig = settings?.ranking?.[item.category] || settings?.upAhead?.ranking?.[item.category] || {};
        const posMulti = rankingConfig.positiveMultiplier || 1.0;
        const negMulti = rankingConfig.negativeMultiplier || 1.0;
        const filterThreshold = rankingConfig.filterThreshold || 0;

        const positives = mergedPositives[item.category] || [];
        const negatives = getNegativesForCategory(item.category);

        const posCount = positives.reduce((c, w) => matchesKeyword(fullText, w.toLowerCase()) ? c + 1 : c, 0);
        const negCount = negatives.reduce((c, w) => matchesKeyword(fullText, w.toLowerCase()) ? c + 1 : c, 0);

        score = (posCount * posMulti) - (negCount * negMulti);
        const signalCount = signalWords.reduce((c, signal) => fullText.includes(signal) ? c + 1 : c, 0);
        score += (signalCount * 0.5);

        const isStrictCategory = ['movies', 'events', 'shopping', 'airlines', 'sports', 'festivals'].includes(item.category);
        if (isStrictCategory && score < filterThreshold) {
            return;
        }

        if (!isRoundup && negCount > 0 && score <= 0) {
             return;
        }

        if (isPlannerCategory && !item.extractedDate && !item.isRoundup) {
             if (posCount === 0 && signalCount === 0) {
                 return;
             }
        }

        if (item.category === 'alerts' || item.category === 'civic') {
            const hasLocation = userLocations.some(loc => fullText.includes(loc));
            if (!hasLocation) {
                return;
            }
        }

        item._forwardScore = score;

        if (item.category && sections[item.category]) {
            if ((item.category === 'movies' || item.category === 'events' || item.category === 'festivals') && !item.extractedDate && !item.isRoundup) {
                return;
            }

            if (isPlannerCategory && !item.extractedDate && !item.isRoundup) {
                if (score <= 0) return;
            }

            if (item.category === 'festivals' && item.extractedDate) {
                const diffTime = item.extractedDate.getTime() - today.getTime();
                const diffDays = diffTime / (1000 * 3600 * 24);
                if (diffDays < -3) return;
            } else if (isPlannerCategory && item.extractedDate) {
                 if (item.extractedDate < today) return;
            }

            let fallbackDate = null;
            if (!item.extractedDate && ['shopping', 'alerts', 'weather_alerts', 'civic'].includes(item.category)) {
                 fallbackDate = item.pubDate ? item.pubDate.toDateString() : null;
            }

            const displayItem = {
                title: item.title,
                link: item.link,
                releaseDate: item.extractedDate ? item.extractedDate.toDateString() : fallbackDate,
                date: item.extractedDate ? item.extractedDate.toDateString() : fallbackDate,
                text: item.title,
                severity: 'medium',
                language: 'Unknown',
                isRoundup: item.isRoundup,
                subItemsCount: item.subItems ? item.subItems.length : 0
            };
            sections[item.category].push(displayItem);
        }

        let targetDate = item.extractedDate;
        if (!targetDate && (item.category === 'alerts' || item.category === 'weather_alerts')) {
             const limit = item.category === 'weather_alerts' ? 12 : 24;
             if (item.pubDate && (Date.now() - item.pubDate.getTime() < limit * 60 * 60 * 1000)) {
                 targetDate = today;
             } else {
                 return;
             }
        }
        if (!targetDate && item.isRoundup) {
            targetDate = today;
        }

        if (!targetDate && score > 0 && isPlannerCategory) {
            if (['shopping', 'airlines', 'alerts', 'weather_alerts', 'civic'].includes(item.category)) {
                if (item.pubDate && (Date.now() - item.pubDate.getTime() < 48 * 60 * 60 * 1000)) {
                    targetDate = today;
                }
            }
        }

        if (targetDate && targetDate >= today) {
            const dateKey = targetDate.toISOString().split('T')[0];
            if (!timelineMap.has(dateKey)) {
                timelineMap.set(dateKey, {
                    date: dateKey,
                    dayLabel: getDayLabel(targetDate),
                    items: []
                });
            }
            const timelineItem = {
                id: item.id,
                type: getItemType(item.category),
                title: item.title,
                subtitle: item.isRoundup ? `${item.subItems?.length || 'Multiple'} ITEMS` : item.category.toUpperCase(),
                description: item.description,
                tags: [item.category],
                link: item.link,
                isRoundup: item.isRoundup,
                subItems: item.subItems,
                _forwardScore: item._forwardScore || 0
            };
            timelineMap.get(dateKey).items.push(timelineItem);
        }
    });

    const sortedTimeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    sortedTimeline.forEach(day => {
        day.items.sort((a, b) => (b._forwardScore || 0) - (a._forwardScore || 0));
        day.items.forEach(item => delete item._forwardScore);
    });

    Object.keys(sections).forEach(k => {
        sections[k].sort((a, b) => {
            if (a.date && b.date) {
                return new Date(a.date) - new Date(b.date);
            }
            return 0;
        });
        sections[k] = sections[k].slice(0, 10);
    });

    // Pass blacklist (empty here, handled by UI generally, but we generate base plan)
    const blacklist = plannerStorage.getBlacklist ? plannerStorage.getBlacklist() : new Set();
    const weekly_plan = generateWeeklyPlan(sortedTimeline, blacklist);

    return {
        timeline: sortedTimeline,
        sections: sections,
        weekly_plan: weekly_plan,
        lastUpdated: new Date().toISOString()
    };
}

function getDayLabel(date) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const d = new Date(date);
    d.setHours(0,0,0,0);
    if (d.getTime() === today.getTime()) return "Today";
    if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function getItemType(category) {
    const map = {
        movies: 'movie',
        events: 'event',
        festivals: 'festival',
        alerts: 'alert',
        sports: 'sport',
        shopping: 'shopping',
        civic: 'civic',
        weather_alerts: 'weather_alert',
        airlines: 'airline'
    };
    return map[category] || 'event';
}

function generateWeeklyPlan(timeline, blacklist = new Set()) {
    const plan = [];
    const today = new Date();

    const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    // Generate 7 days
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
        const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
        const dayNum = d.getDate();
        const dateLabel = `${getOrdinal(dayNum)} ${monthShort}`;

        const timelineDay = timeline.find(t => t.date === dateStr);
        let items = [];

        if (timelineDay && timelineDay.items.length > 0) {
            // Logic:
            // 1. Exclude Festivals (separate view usually)
            // 2. Exclude Blacklisted items
            // 3. Include Shopping/Airlines (Offers) - Assuming date logic (Last Day) handled in extraction

            const filteredItems = timelineDay.items.filter(item => {
                if (item.type === 'festival') return false;
                if (blacklist.has(item.id)) return false;
                return true;
            });

            items = filteredItems.slice(0, 10).map(item => ({
                id: item.id,
                title: item.title,
                type: item.type,
                icon: getCategoryIcon(item.type),
                link: item.link,
                description: item.description,
                isOffer: item.type === 'shopping' || item.type === 'airline'
            }));
        }

        plan.push({
            day: dayName,
            date: dateLabel,
            items: items
        });
    }

    return plan;
}

function getCategoryIcon(type) {
    const icons = {
        movie: '🎬',
        event: '🎭',
        festival: '🎊',
        alert: '⚠️',
        sport: '⚽',
        shopping: '🛒',
        civic: '🏛️',
        entertainment: '🎶',
        weather_alert: '🌪️',
        airline: '✈️',
        general: '📅'
    };
    return icons[type] || '📅';
}
