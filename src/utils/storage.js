// Local Storage utility for settings persistence

const STORAGE_KEYS = {
    SETTINGS: 'dailyEventAI_settings',
    LAST_REFRESH: 'dailyEventAI_lastRefresh',
    CACHED_DATA: 'dailyEventAI_cachedData',
    ARTICLE_VIEWS: 'dailyEventAI_articleViews'
};

const API_BASE = '/api';

// Default settings - REDESIGNED SCHEMA
export const DEFAULT_SETTINGS = {
    // ========================================
    // INTERFACE
    // ========================================
    uiMode: 'timeline',  // 'timeline' | 'classic' | 'newspaper'
    customSortTopStories: true, // NEW - Switch Top Stories to Latest Stories with filtering
    theme: 'dark',       // 'dark' | 'light'
    fontSize: 26,        // Default base font size (User requested +6 from 20)

    // ========================================
    // DATA FRESHNESS & FILTERING
    // ========================================
    freshnessLimitHours: 36, // Deprecated? User asked for "Hide stories older than X hours" default 60.
    hideOlderThanHours: 60,  // New strict cutoff
    weatherFreshnessLimit: 4,
    strictFreshness: true,
    filteringMode: 'source', // 'source' | 'keyword'
    rankingMode: 'smart',    // 'smart' | 'legacy'

    // ========================================
    // RANKING WEIGHTS (CUSTOM RANKING SYSTEM)
    // ========================================
    rankingWeights: {
        // Temporal / Context
        temporal: {
            weekendBoost: 2.0,
            entertainmentBoost: 2.5
        },
        geo: {
            cityMatch: 1.5,
            maxScore: 5.0
        },

        // Impact Factors (Exposed for Custom Ranking)
        freshness: {
            decayHours: 26,     // Linear decay over X hours
            maxBoost: 3.0       // Maximum score for 0-minute old news
        },
        impact: {
            boost: 1.0,         // Base impact multiplier
            highImpactBoost: 2.5 // Multiplier for major event keywords
        },
        visual: {
            videoBoost: 1.3,    // Multiplier for video content
            imageBoost: 1.15    // Multiplier for standard images
        },
        sentiment: {
            positiveBoost: 0.5, // Additive score for positive sentiment
            negativeBoost: 0.3  // Additive score for negative sentiment
        },
        keyword: {
            matchBoost: 2.0     // Additive score for keyword match
        },
        source: {
            tier1Boost: 0.25,   // Multiplier factor (0.25 = +25% max boost)
            tier2Boost: 0.15,   // Multiplier factor (0.15 = +15% max boost)
            tier3Boost: 0.0     // Multiplier factor (0.0 = +0% max boost)
        },

        // Penalties
        viewedPenalty: 0.4,     // Multiplier for seen stories (0.4x)

        // Trending Logic (NEW)
        trending: {
            threshold: 12.0,    // Score needed to be marked "Trending" (🔥)
        },

        // Audit Thresholds (System 3)
        audit: {
            consensusThreshold: 2,   // Min sources for Consensus (⚡)
            anomalySigma: 2.0        // StdDev multiplier for Anomaly (📊)
        },
    },

    // ========================================
    // BUZZ RANKING (Independent Strategy)
    // ========================================
    buzzRankingWeights: {
        visual: {
            videoBoost: 2.0,    // Higher visual priority for Buzz
            imageBoost: 1.5
        },
        freshness: {
            decayHours: 12,     // Faster decay (viral nature)
            maxBoost: 2.0
        },
        trending: {
            threshold: 10.0     // Lower threshold for "trending" status
        }
    },

    // ========================================
    // SECTION SPECIFIC RANKING (Buzz Tab)
    // ========================================
    buzz: {
        entertainment: {
            enabled: true,
            positiveKeywords: ["tamil", "kollywood", "hindi", "bollywood", "hollywood", "ott", "netflix", "prime video", "disney", "hotstar"],
            positiveMultiplier: 2.0,
            negativeKeywords: ["gossip", "rumour", "dating", "spotted"],
            negativeMultiplier: 2.0,
            filterThreshold: 0
        },
        technology: {
            enabled: true,
            positiveKeywords: ["startup", "ai", "artificial intelligence", "innovation", "funding", "launch", "generative ai", "llm"],
            positiveMultiplier: 2.0,
            negativeKeywords: ["rumour", "leak", "speculation"],
            negativeMultiplier: 2.0,
            filterThreshold: 0
        },
        sports: {
            enabled: true,
            positiveKeywords: ["cricket", "football", "ipl", "world cup", "india vs", "final", "highlights"],
            positiveMultiplier: 2.0,
            negativeKeywords: ["opinion", "blog"],
            negativeMultiplier: 2.0,
            filterThreshold: 0
        }
    },

    // ========================================
    // WEATHER CONFIGURATION
    // ========================================
    weather: {
        models: {
            ecmwf: true,   // European Centre (most accurate)
            gfs: true,     // NOAA GFS (good precipitation)
            icon: true     // DWD ICON (excellent coverage)
        },
        cities: ['chennai', 'trichy', 'muscat'],
        showHumidity: true,
        showWind: false,
    },

    // ========================================
    // NEWS SECTIONS
    // ========================================
    sections: {
        world: { enabled: true, count: 5 },
        india: { enabled: true, count: 5 },
        chennai: { enabled: true, count: 5 },
        trichy: { enabled: true, count: 5 },
        local: { enabled: true, count: 5 },
        social: { enabled: true, count: 25 }, // User requested default 25
        entertainment: { enabled: true, count: 5 },
        business: { enabled: true, count: 5 },
        technology: { enabled: true, count: 5 },
        sports: { enabled: true, count: 5 }
    },

    // ========================================
    // NEWS SOURCES
    // ========================================
    newsSources: {
        bbc: true,
        reuters: true,
        ndtv: true,
        theHindu: true,
        toi: true,
        financialExpress: true,
        dtNext: true,
        omanObserver: true,
        moneyControl: true,
        variety: true,
        hollywoodReporter: true,
        bollywoodHungama: true,
        filmCompanion: true,
        indiaToday: true,
        timesOfOman: true
    },

    // ========================================
    // SOURCE TIERS (User Editable)
    // ========================================
    sourceTiers: {
        tier1: ['BBC', 'Reuters', 'TechCrunch', 'The Verge', 'ESPN'],
        tier2: ['NDTV', 'The Hindu', 'Times of India', 'Moneycontrol', 'Indian Express'],
        tier3: ['Oman Observer', 'DT Next', 'Bollywood Hungama']
    },

    // ========================================
    // MARKET SETTINGS
    // ========================================
    market: {
        showIndices: true,
        showGainers: true,
        showLosers: true,
        showMutualFunds: true,
        showIPO: true,
        showSectorals: true,      // NEW - Phase 2
        showCommodities: true,    // NEW - Phase 2
        showCurrency: true,       // NEW - Phase 2
        showFIIDII: true,         // NEW - Phase 2
        cacheMinutes: 15,
    },

    // ========================================
    // ENTERTAINMENT DISTRIBUTION
    // ========================================
    entertainment: {
        tamilCount: 5,      // Tamil/Kollywood
        hindiCount: 5,      // Hindi/Bollywood
        hollywoodCount: 3,  // Hollywood
        ottCount: 2         // OTT/Streaming
    },

    // ========================================
    // SOCIAL TRENDS DISTRIBUTION
    // ========================================
    socialTrends: {
        worldCount: 8,
        indiaCount: 8,
        tamilnaduCount: 5,
        muscatCount: 4,
    },

    // ========================================
    // CUSTOM FEEDS
    // ========================================
    customFeeds: [],

    // Global Keyword Blocks (for main feed)
    feedBlockedKeywords: [],

    // ========================================
    // HIGH IMPACT KEYWORDS (Configurable)
    // ========================================
    highImpactKeywords: [
        'Budget', 'Election', 'Summit', 'Treaty', 'War',
        'Crash', 'Landfall', 'Verdict', 'Resigns', 'Assassination'
    ],

    // ========================================
    // UP AHEAD SETTINGS (NEW)
    // ========================================
    upAhead: {
        categories: {
            movies: true,
            events: true, // Includes entertainment (theatre, arts)
            festivals: true,
            alerts: true,
            sports: true,
            shopping: true,      // NEW
            civic: true,         // NEW
            weather_alerts: true, // NEW
            airlines: true       // NEW
        },

        // Per-Category Ranking Configuration (Multipliers & Thresholds)
        // Defaults: Pos 2.0, Neg 2.0, Threshold 0
        ranking: {
            movies: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
            events: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
            festivals: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
            sports: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
            shopping: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
            airlines: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
            alerts: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
            weather_alerts: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
            civic: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 }
        },

        locations: ["Chennai", "Muscat"],
        customLocation: "",

        // Granular Detection Signals
        signals: [
            "upcoming", "scheduled", "starting", "launches", "opens",
            "begins", "commences", "from today", "this weekend",
            "next week", "releasing", "premieres", "debuts",
            "kicks off", "set to", "slated for", "expected on",
            "effective from", "valid till", "last date", "deadline",
            "registrations open", "bookings open", "doors open",
            "book now", "tickets available", "grab your", "register",
            "rsvp", "sign up", "enroll", "apply before",
            "limited seats", "early bird", "pre-order",
            "advance booking", "buy tickets", "entry free",
            "venue", "stadium", "auditorium", "convention centre",
            "exhibition hall", "multiplex", "arena", "grounds",
            "schedule", "timetable", "lineup", "itinerary",
            "match day", "race day", "show timings", "showtimes",
            "time slot", "batch"
        ],

        keywords: {
            // Default keywords (editable by user)
            movies: [
                "release date", "releasing", "release", "in theatres", "in theaters", "first day",
                "advance booking", "fdfs", "premiere", "preview", "sneak peek",
                "special screening", "ott release", "streaming from", "now streaming",
                "available on", "direct to ott", "digital premiere", "tickets",
                "showtimes", "book now", "bookmyshow", "ticketnew", "paytm movies",
                "trailer launch", "teaser release", "motion poster"
            ],
            events: [
                "concert", "live music", "standup", "comedy show", "theatre", "theater",
                "drama", "stage play", "dance recital", "sabha", "kutcheri", "kutchery",
                "exhibition", "expo", "book fair", "trade fair", "flea market",
                "art gallery", "trade show", "workshop", "masterclass", "bootcamp",
                "seminar", "webinar", "hackathon", "meetup", "food festival", "pop-up",
                "tasting", "brunch", "food walk", "heritage walk", "night market",
                "entry fee", "passes available", "gate open", "limited slots", "registration"
            ],
            sports: [
                " vs ", " v/s ", "match", "fixture", "squad announced", "playing xi",
                "toss", "innings", "schedule", "points table", "qualifier", "semi final",
                "final", "playoffs", "stadium", "live on", "broadcast", "streaming",
                "start time", "kick off", "first ball"
            ],
            festivals: [
                "holiday", "bank holiday", "gazetted", "declared holiday",
                "government holiday", "pongal", "diwali", "deepavali", "navratri",
                "dussehra", "eid", "ramadan", "christmas", "onam", "vishu", "ugadi",
                "holi", "ganesh", "jayanti", "puja", "pooja", "thai pusam",
                "observed on", "falls on", "celebrated on", "auspicious", "muhurtham", "tithi"
            ],
            shopping: [
                "sale", "mega sale", "flash sale", "clearance", "end of season",
                "flat discount", "upto off", "cashback", "coupon", "promo code",
                "shopping festival", "exhibition sale", "trade fair", "grand opening",
                "limited period", "ends today", "last day", "offer valid",
                "while stocks last", "hurry"
            ],
            airlines: [
                "oman air", "goindigo", "salam air", "ticket offer", "flight deal",
                "air india", "vistara", "akasa air", "fare sale", "booking open"
            ],
            alerts: [
                "power cut", "power shutdown", "load shedding", "tangedco", "tneb",
                "scheduled maintenance", "water cut", "water supply", "disruption",
                "traffic advisory", "road closure", "diversion", "metro shutdown",
                "bus route change", "train cancelled", "flight delayed",
                "boil water advisory", "mosquito fogging", "tree trimming",
                "construction zone"
            ],
            weather_alerts: [
                "warning", "alert", "advisory", "watch", "red alert", "orange alert",
                "yellow alert", "heavy rain", "very heavy rain", "cyclone",
                "thunderstorm", "heat wave", "cold wave", "fog", "flooding",
                "high tide", "storm surge", "imd", "met department", "weather bulletin"
            ],
            civic: [
                "vip movement", "vip visit", "road block", "security arrangement",
                "route change", "bandh", "hartal", "strike", "protest march",
                "rasta roko", "rail roko", "corporation notice", "tender",
                "public hearing", "ward meeting", "grievance day"
            ],
            movies_negative: [
                "review", "reviewed", "reviews", "opinion", "editorial", "column",
                "interview", "gossip", "rumour", "rumor", "spotted", "dating",
                "controversy", "trolled", "slammed", "reacts", "reaction",
                "leaked", "wardrobe malfunction", "breakup", "case explained",
                "box office collection", "day 1 collection", "total collection",
                "worldwide gross", "opening weekend", "first week collection",
                "crosses crore", "nett collection",
                "promo shoot", "shooting begins", "wrapped up", "schedule wrap",
                "title reveal", "first look", "motion poster", "cast revealed",
                "plot leaked", "producer", "director", "music director",
                "remuneration", "salary", "budget", "rights sold", "satellite rights",
                "audio launch", "pre-release event", "success meet", "press meet",
                "renamed", "casts",
                "court", "petition", "arrested", "stealing", "sewage", "overflow",
                "warns against", "talks", "deal", "financial results", "board meeting",
                "did for free", "bank holiday alert", "check full list",
                "divorce", "decommission", "released crore", "schedules board meeting",
                "fog", "mist"
            ],
            // New Category Negatives (User Requested Split)
            events_negative: ["cancelled", "postponed", "webinar", "virtual only", "legacy", "tribute", "obituary"],
            sports_negative: ["rumour", "speculation", "opinion", "prediction", "predictions", "bracketology", "power rankings", "fantasy value"],
            festivals_negative: [],
            shopping_negative: ["expired", "sold out"],
            airlines_negative: ["accident", "crash", "emergency landing", "technical snag"],
            alerts_negative: ["rumour", "hoax", "fake news"],
            civic_negative: ["clinic", "surgery", "transplant", "arrested", "held"],

            negative: [
                "review", "reviewed", "reviews", "opinion", "editorial", "column",
                "op-ed", "analysis", "deep dive", "explainer", "explained",
                "interview", "memoir", "podcast", "recap", "retrospective", "lookback",
                "throwback", "gossip", "rumour", "rumor", "spotted", "dating",
                "divorce", "controversy", "trolled", "slammed", "reacts", "reaction",
                "claps back", "feud", "leaked", "wardrobe malfunction", "breakup",
                "arrested", "murder", "stabbed", "robbery", "scam", "fraud", "accused",
                "chargesheet", "sentenced", "bail", "fir filed", "kidnap", "suicide",
                "death toll", "fatal", "quarterly results", "earnings call", "dividend",
                "stock split", "ipo allotment", "listing gains", "shareholding pattern",
                "promoter stake", "mutual fund nav", "portfolio rebalancing", "alleges",
                "slams", "hits out", "war of words", "defamation", "no confidence",
                "horse trading", "exit poll", "poll prediction", "meme", "was held",
                "concluded", "wrapped up", "came to an end", "successfully completed",
                "inaugurated by", "flagged off", "took place", "was celebrated",
                "passes away", "passed away", "demise", "rip", "condolences",
                "last rites", "funeral", "pays tribute", "mourns", "obituary",
                "top 10", "top 5", "best of", "worst of", "reasons why", "things you",
                "ranked", "all you need to know", "everything we know",
                "box office collection", "day 1 collection", "total collection",
                "worldwide gross", "opening weekend", "first week collection",
                "crosses crore", "nett collection", "shocking", "you won't believe",
                "jaw dropping", "gone viral", "breaks the internet", "exclusive",
                // Financial Noise
                "board meeting", "financial results", "quarterly results", "dividend",
                "earnings call", "stock split", "bonus issue", "record date",
                "schedules board meeting", "to consider", "fund raising",
                // General Noise
                "petrol price", "price hike", "title reveal", "first look",
                "renamed", "locks release date", "casts", "producer", "court", "petition",
                "arrested", "stealing", "sewage", "warns", "talks", "deal",
                "did for free", "bank holiday alert", "check full list", "decommission",
                "fog", "mist", "opens office", "launches", "inaugurated", "reveals"
            ]
        }
    },

    // ========================================
    // MANUAL OVERRIDES (Phase 2 & 8)
    // ========================================
    sectionOverrides: {
        // Map of articleID -> sectionName
        // e.g. "hash123": "chennai"
    },

    // ========================================
    // NEWSPAPER MODE SETTINGS (Phase 7)
    // ========================================
    newspaper: {
        enableImages: true,        // Fetch images from RSS enclosures
        headlinesCount: 3,         // Stories in headlines zone
        leadsCount: 6,             // Stories in section leads
        briefsCount: 12,           // Stories in briefs section
    },

    // ========================================
    // SCORING & PERSONALIZATION (NEW)
    // ========================================
    enableNewScoring: true,      // Master switch for new 9-factor scoring
    enableProximityScoring: false, // Boost local news (default OFF)

    // Diversity Settings (Phase 6)
    maxTopicPercent: 40,         // Max % of front page for one topic
    maxGeoPercent: 30,           // Max % of front page for one geography

    // Topic Following (NEW)
    // Stores objects: { id, name, query, icon, created, lastFetched, options }
    followedTopics: [],

    // Reading History for Suggestions
    readingHistory: [], // List of { title, id, timestamp }

    // Topic suggestions based on reading history
    topicSuggestions: {
        enabled: true,
        basedOnReadingHistory: true
    },

    // ========================================
    // ADVANCED / PERFORMANCE
    // ========================================
    enableCache: true,         // NEW - Phase 6: Enable memory cache for faster loads
    crawlerMode: 'auto',
    debugLogs: false,

    lastUpdated: 0 // Initialize timestamp
};

/**
 * Get settings from localStorage
 * @returns {Object} Settings object
 */
export function getSettings() {
    // Determine dynamic default font size based on device
    let defaultFontSize = DEFAULT_SETTINGS.fontSize;
    if (typeof window !== 'undefined') {
        defaultFontSize = window.innerWidth >= 1024 ? 18 : 26;
    }

    const dynamicDefaults = {
        ...DEFAULT_SETTINGS,
        fontSize: defaultFontSize
    };

    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults to ensure all keys exist
            return deepMerge(dynamicDefaults, parsed);
        }
    } catch (error) {
        void error;
        console.error('Error reading settings:', error);
    }
    return { ...dynamicDefaults };
}

/**
 * Save settings to localStorage and optionally API
 * @param {Object} settings - Settings object to save
 */
export function saveSettings(settings) {
    try {
        const settingsToSave = { ...settings, lastUpdated: Date.now() };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settingsToSave));

        // Fire-and-forget API save
        saveSettingsToApi(settingsToSave);

        return true;
    } catch (error) {
        void error;
        console.error('Error saving settings:', error);
        return false;
    }
}

/**
 * Async save to API
 */
async function saveSettingsToApi(settings) {
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (!response.ok) {
            console.warn('Failed to save settings to API');
        }
    } catch (e) {
        console.warn('API save error:', e);
    }
}

/**
 * Fetch settings from API
 */
export async function fetchSettingsFromApi() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn('API fetch error:', e);
        return null;
    }
}

/**
 * Update specific setting
 * @param {string} path - Dot-notation path to setting (e.g., 'sections.world.count')
 * @param {any} value - Value to set
 */
export function updateSetting(path, value) {
    const settings = getSettings();
    const keys = path.split('.');
    let obj = settings;

    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
    return saveSettings(settings);
}

/**
 * Reset settings to defaults
 */
export function resetSettings() {
    return saveSettings(DEFAULT_SETTINGS);
}

/**
 * Get last refresh timestamp for a section
 * @param {string} section - Section name
 * @returns {Date|null} Last refresh date or null
 */
export function getLastRefresh(section) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LAST_REFRESH);
        if (stored) {
            const timestamps = JSON.parse(stored);
            if (timestamps[section]) {
                return new Date(timestamps[section]);
            }
        }
    } catch (error) {
        void error;
        console.error('Error reading last refresh:', error);
    }
    return null;
}

/**
 * Set last refresh timestamp for a section
 * @param {string} section - Section name
 */
export function setLastRefresh(section) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LAST_REFRESH);
        const timestamps = stored ? JSON.parse(stored) : {};
        timestamps[section] = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.LAST_REFRESH, JSON.stringify(timestamps));
    } catch (error) {
        void error;
        console.error('Error setting last refresh:', error);
    }
}

/**
 * Get time since last refresh as human-readable string
 * @param {string} section - Section name (optional, for specific section)
 * @returns {string} Human-readable time string
 */
export function getTimeSinceRefresh(section = null) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LAST_REFRESH);
        if (!stored) return 'Never';

        const timestamps = JSON.parse(stored);
        let lastTime = null;

        if (section && timestamps[section]) {
            lastTime = new Date(timestamps[section]);
        } else {
            // Get most recent refresh across all sections
            const times = Object.values(timestamps).map(t => new Date(t).getTime());
            if (times.length > 0) {
                lastTime = new Date(Math.max(...times));
            }
        }

        if (!lastTime) return 'Never';

        const now = new Date();
        const diffMs = now - lastTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return lastTime.toLocaleDateString();
    } catch (error) {
        void error;
        return 'Unknown';
    }
}

/**
 * Cache data for a section
 * @param {string} section - Section name
 * @param {any} data - Data to cache
 */
export function cacheData(section, data) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CACHED_DATA);
        const cache = stored ? JSON.parse(stored) : {};
        cache[section] = {
            data,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.CACHED_DATA, JSON.stringify(cache));
    } catch (error) {
        void error;
        console.error('Error caching data:', error);
    }
}

/**
 * Get cached data for a section
 * @param {string} section - Section name
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 30 minutes)
 * @returns {any|null} Cached data or null if expired/missing
 */
export function getCachedData(section, maxAgeMs = 30 * 60 * 1000) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CACHED_DATA);
        if (!stored) return null;

        const cache = JSON.parse(stored);
        if (!cache[section]) return null;

        const age = new Date() - new Date(cache[section].timestamp);
        if (age > maxAgeMs) return null;

        return cache[section].data;
    } catch (error) {
        void error;
        console.error('Error reading cache:', error);
        return null;
    }
}

/**
 * Clear all cached data
 */
export function clearCache() {
    try {
        localStorage.removeItem(STORAGE_KEYS.CACHED_DATA);
        localStorage.removeItem(STORAGE_KEYS.LAST_REFRESH);
    } catch (error) {
        void error;
        console.error('Error clearing cache:', error);
    }
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        const val = source[key];
        // Skip null/undefined from stored settings — keep the default
        if (val === null || val === undefined) continue;

        if (typeof val === 'object' && !Array.isArray(val)) {
            result[key] = deepMerge(target[key] || {}, val);
        } else {
            result[key] = val;
        }
    }

    return result;
}

// ========================================
// TOPIC FOLLOWING HELPERS
// ========================================

export function addFollowedTopic(topic) {
    const settings = getSettings();
    settings.followedTopics = settings.followedTopics || [];
    settings.followedTopics.push({
        ...topic,
        id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        created: new Date().toISOString(),
        lastFetched: null
    });
    saveSettings(settings);
}

export function removeFollowedTopic(topicId) {
    const settings = getSettings();
    settings.followedTopics = settings.followedTopics.filter(t => t.id !== topicId);
    saveSettings(settings);
}

export function updateTopicLastFetched(topicId) {
    const settings = getSettings();
    const topic = settings.followedTopics.find(t => t.id === topicId);
    if (topic) {
        topic.lastFetched = new Date().toISOString();
        saveSettings(settings);
    }
}

// ========================================
// VIEW COUNTING & TRACKING
// ========================================

/**
 * Increment view count for a list of article IDs
 * Used for "Latest Stories" filtering (hide after 3 views)
 */
export function incrementViewCount(articleIds) {
    if (!articleIds || articleIds.length === 0) return;
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.ARTICLE_VIEWS);
        const views = stored ? JSON.parse(stored) : {};

        articleIds.forEach(id => {
            views[id] = (views[id] || 0) + 1;
        });

        // Simple cleanup: If object gets too big (>1000 items), clear half?
        // For now, let's just save it. Browser storage limits are generous enough for this text data.
        localStorage.setItem(STORAGE_KEYS.ARTICLE_VIEWS, JSON.stringify(views));
    } catch (e) {
        console.error("[Storage] Error incrementing views", e);
    }
}

/**
 * Get view count for a specific article
 */
export function getViewCount(articleId) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.ARTICLE_VIEWS);
        const views = stored ? JSON.parse(stored) : {};
        return views[articleId] || 0;
    } catch {
        return 0;
    }
}

/**
 * Check if article is read
 */
export function isArticleRead(articleId) {
    const settings = getSettings();
    return settings.readingHistory?.some(h => h.id === articleId) || false;
}

// ========================================
// READING HISTORY & SUGGESTIONS
// ========================================

export function addReadArticle(article) {
    if (!article || !article.title) return;

    const settings = getSettings();
    const history = settings.readingHistory || [];

    // Avoid duplicates
    if (history.some(h => h.id === article.id)) return;

    // Add new entry
    history.unshift({
        id: article.id,
        title: article.title,
        description: article.description || '',
        timestamp: Date.now()
    });

    // Limit history size (e.g., 50 items)
    if (history.length > 50) {
        history.length = 50;
    }

    settings.readingHistory = history;
    saveSettings(settings);
}

/**
 * Basic keyword extraction for topic suggestions
 */
export function getSuggestedTopics() {
    const settings = getSettings();
    const history = settings.readingHistory || [];

    if (history.length === 0) return [];

    const text = history.map(h => `${h.title} ${h.description}`).join(' ').toLowerCase();

    // Simple stopwords removal
    const stopWords = ['the', 'and', 'in', 'of', 'to', 'a', 'is', 'for', 'on', 'with', 'at', 'from', 'by', 'an', 'be', 'as', 'it', 'has', 'that', 'are', 'was', 'will', 'says', 'said', 'after', 'over', 'new', 'more', 'about', 'can', 'top', 'best', 'india', 'news', 'update', 'latest', 'today', 'live'];

    const words = text.match(/\b[a-z]{4,}\b/g) || [];
    const counts = {};

    words.forEach(w => {
        if (!stopWords.includes(w)) {
            counts[w] = (counts[w] || 0) + 1;
        }
    });

    // Sort by frequency
    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word, count]) => ({
            word: word.charAt(0).toUpperCase() + word.slice(1),
            count
        }));

    return sorted;
}
