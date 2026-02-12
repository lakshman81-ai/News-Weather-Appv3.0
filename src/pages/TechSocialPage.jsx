import React, { useMemo, useState, useEffect } from 'react';
import Header from '../components/Header';
import NewsSection from '../components/NewsSection';
import SectionNavigator from '../components/SectionNavigator';
import { ImageCard } from '../components/ImageCard';
import { useNews } from '../context/NewsContext';
import { useSettings } from '../context/SettingsContext';

const CACHE_KEY = 'buzz_page_cache';

/**
 * Tech & Social Page
 * Social Trends Distribution:
 * - 30% World
 * - 30% India
 * - 20% Tamil Nadu
 * - 20% Muscat/Local
 */
function TechSocialPage() {
    const { newsData, refreshNews, loading: contextLoading, loadSection } = useNews();
    const { settings } = useSettings();
    const [activeEntTab, setActiveEntTab] = useState('tamil');

    // Local cache state for immediate loading
    const [cachedData, setCachedData] = useState(null);
    const [loadingPhase, setLoadingPhase] = useState(0); // 0: Init, 1: Local, 3: Live

    // Load Cache on Mount
    useEffect(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                // Check age (8 hours)
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < 8 * 60 * 60 * 1000) {
                     setCachedData(parsed);
                     setLoadingPhase(1);
                } else {
                     console.log('[Buzz] Cache expired, showing anyway until live loads');
                     setCachedData(parsed);
                     setLoadingPhase(1);
                }
            }
        } catch (e) {
            console.warn('Buzz Cache read error', e);
        }
    }, []);

    // Trigger lazy load for sections required by this page
    useEffect(() => {
        const requiredSections = ['entertainment', 'social', 'technology', 'local', 'world', 'india', 'chennai'];
        requiredSections.forEach(section => loadSection(section));
    }, [loadSection]);

    const filterOldNews = React.useCallback((newsArray) => {
        if (!newsArray) return [];
        const limitMs = (settings.freshnessLimitHours || 72) * 3600000;
        const now = Date.now();
        return newsArray.filter(item => (now - (item.publishedAt || 0)) < limitMs);
    }, [settings.freshnessLimitHours]);

    // Determine which data to use (Live > Cache)
    // We prefer Live if available, else Cache
    const hasLiveData = newsData.entertainment && newsData.entertainment.length > 0;

    useEffect(() => {
        if (hasLiveData) {
            setLoadingPhase(3);
        }
    }, [hasLiveData]);

    const displayData = hasLiveData ? newsData : (cachedData?.data || {});

    // ============================================
    // ENTERTAINMENT CONTENT FILTERING
    // ============================================
    const processedEntertainment = useMemo(() => {
        const raw = displayData.entertainment || [];

        const KEYWORDS = {
            tamil: [
                'vijay', 'ajith', 'rajini', 'kamal', 'dhanush', 'suriya', 'vikram', 'simbu',
                'siva karthikeyan', 'trisha', 'nayanthara', 'anirudh', 'ar rahman', 'kollywood',
                'thalapathy', 'thala', 'udhayanidhi', 'vetri maaran', 'lokesh', 'nelson',
                'jailer', 'leo', 'kanguva', 'indian 2', 'vettaiyan', 'goat', 'viduthalai',
                'karthi', 'sethupathi', 'tamil', 'chennai'
            ],
            hindi: [
                'shah rukh', 'srk', 'salman', 'aamir', 'ranbir', 'alia', 'deepika', 'ranveer',
                'kareena', 'akshay', 'bachchan', 'bollywood', 'hrithik', 'katrina', 'vicky kaushal',
                'karan johar', 'yrf', 'dharma', 'pathaan', 'jawan', 'tiger 3', 'animal', 'dunki',
                'war 2', 'singham', 'hindi', 'mumbai'
            ],
            hollywood: [
                'oscar', 'grammy', 'emmy', 'golden globe', 'marvel', 'dc', 'disney', 'warner bros',
                'universal', 'tom cruise', 'dicaprio', 'nolan', 'avengers', 'spider-man', 'batman',
                'superman', 'taylor swift', 'beyonce', 'kim kardashian', 'kanye', 'justin bieber',
                'selena gomez', 'zendaya', 'hollywood', 'bad bunny', 'rihanna', 'drake'
            ],
            ott: [
                'netflix', 'prime video', 'hotstar', 'sonyliv', 'zee5', 'aha', 'streaming',
                'web series', 'season', 'episode', 'ott'
            ]
        };

        return raw.map(item => {
            const text = (item.title + ' ' + (item.summary || '')).toLowerCase();

            // Content-based classification (Overrides source)
            if (KEYWORDS.tamil.some(k => text.includes(k))) return { ...item, region: 'tamil' };
            if (KEYWORDS.hindi.some(k => text.includes(k))) return { ...item, region: 'hindi' };
            if (KEYWORDS.hollywood.some(k => text.includes(k))) return { ...item, region: 'hollywood' };
            if (KEYWORDS.ott.some(k => text.includes(k))) return { ...item, region: 'ott' };

            // Fallback to existing region if no specific keyword found
            return item;
        });
    }, [displayData.entertainment]);

    // ============================================
    // SOCIAL TRENDS DISTRIBUTION LOGIC
    // ============================================

    const socialTrends = useMemo(() => {
        // Keywords for each region
        const REGION_KEYWORDS = {
            world: ['global', 'world', 'international', 'usa', 'europe', 'uk', 'china',
                'twitter', 'x.com', 'meta', 'tiktok', 'instagram', 'viral'],
            india: ['india', 'indian', 'bollywood', 'cricket', 'modi', 'delhi',
                'mumbai', 'bangalore', 'hyderabad', 'ipl', 'bcci'],
            tamilnadu: ['chennai', 'tamil', 'tamilnadu', 'kollywood', 'rajini',
                'kamal', 'vijay', 'trichy', 'coimbatore', 'madurai', 'tn'],
            muscat: ['muscat', 'oman', 'gulf', 'gcc', 'uae', 'dubai', 'arab',
                'middle east', 'expat', 'omani']
        };

        // Categorize social news by region
        const categorizeByRegion = (newsItem) => {
            const text = (newsItem.title + ' ' + (newsItem.summary || '')).toLowerCase();
            if (REGION_KEYWORDS.tamilnadu.some(kw => text.includes(kw))) return 'tamilnadu';
            if (REGION_KEYWORDS.muscat.some(kw => text.includes(kw))) return 'muscat';
            if (REGION_KEYWORDS.india.some(kw => text.includes(kw))) return 'india';
            return 'world';
        };

        // Get all social news
        const allSocial = filterOldNews(displayData.social || []);
        const worldNews = filterOldNews(displayData.world || []);
        const indiaNews = filterOldNews(displayData.india || []);
        const chennaiNews = filterOldNews(displayData.chennai || []);
        const localNews = filterOldNews(displayData.local || []); // Muscat/Oman

        // Categorize all news
        const regionBuckets = {
            world: [],
            india: [],
            tamilnadu: [],
            muscat: []
        };

        // Add social news to appropriate buckets
        allSocial.forEach(item => {
            const region = categorizeByRegion(item);
            regionBuckets[region].push({ ...item, source: 'social' });
        });

        // Add world news to world bucket (filter for social trends)
        worldNews
            .filter(item => item.title?.toLowerCase().includes('trend') ||
                item.title?.toLowerCase().includes('viral') ||
                item.title?.toLowerCase().includes('social'))
            .forEach(item => regionBuckets.world.push({ ...item, source: 'world' }));

        // Add India news to india bucket
        indiaNews
            .filter(item => item.title?.toLowerCase().includes('trend') ||
                item.title?.toLowerCase().includes('viral') ||
                item.title?.toLowerCase().includes('social'))
            .forEach(item => regionBuckets.india.push({ ...item, source: 'india' }));

        // Add Chennai news to TN bucket
        chennaiNews.forEach(item => {
            regionBuckets.tamilnadu.push({ ...item, source: 'chennai' });
        });

        // Add Local (Muscat) news to Muscat bucket
        localNews.forEach(item => {
            regionBuckets.muscat.push({ ...item, source: 'local' });
        });

        // Get target counts from settings (defaults if missing)
        const distribution = {
            world: settings.socialTrends?.worldCount ?? 8,
            india: settings.socialTrends?.indiaCount ?? 8,
            tamilnadu: settings.socialTrends?.tamilnaduCount ?? 5,
            muscat: settings.socialTrends?.muscatCount ?? 4
        };

        // Build final mixed array
        const result = [];

        // Add from each bucket according to counts
        Object.entries(distribution).forEach(([region, count]) => {
            const bucket = regionBuckets[region];
            // Sort bucket by date if possible
            bucket.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

            const toAdd = bucket.slice(0, count);
            toAdd.forEach(item => {
                result.push({
                    ...item,
                    region: region,
                    regionLabel: region === 'world' ? '🌍 World' :
                        region === 'india' ? '🇮🇳 India' :
                            region === 'tamilnadu' ? '🏛️ Tamil Nadu' :
                                '🏝️ Muscat'
                });
            });
        });

        // Sort by publishedAt (newest first)
        result.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

        return result;
    }, [displayData, settings.freshnessLimitHours, settings.socialTrends, filterOldNews]);

    // Save to Cache when Live Data updates
    useEffect(() => {
        if (hasLiveData) {
            try {
                const cachePayload = {
                    timestamp: Date.now(),
                    data: {
                        entertainment: newsData.entertainment,
                        social: newsData.social,
                        technology: newsData.technology,
                        world: newsData.world,
                        india: newsData.india,
                        chennai: newsData.chennai,
                        local: newsData.local
                    }
                };
                localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
            } catch (e) {
                console.warn('Buzz Cache write error', e);
            }
        }
    }, [hasLiveData, newsData]);

    const handleRefresh = () => {
        setLoadingPhase(3); // Show loading
        refreshNews(['technology', 'social', 'world', 'india', 'chennai', 'local']);
    };

    // Navigation Sections
    const navSections = [
        { id: 'entertainment', icon: '🎬', label: 'Entertainment' },
        { id: 'social-trends', icon: '👥', label: 'Social Trends' },
        { id: 'tech-news', icon: '🚀', label: 'Tech & Startups' },
        { id: 'ai-innovation', icon: '🤖', label: 'AI & Innovation' }
    ];

    // Back to Top Logic
    const [showBackToTop, setShowBackToTop] = useState(false);
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 400) {
                setShowBackToTop(true);
            } else {
                setShowBackToTop(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="page-container">
            <Header
                title="Buzz Hub"
                icon="🎭"
                onRefresh={handleRefresh}
                loadingPhase={loadingPhase || (contextLoading ? 3 : 0)}
            />
            <main className="main-content">

                {/* Entertainment Hub */}
                <section id="entertainment" className="news-section entertainment-hub">
                    <h2 className="news-section__title news-section__title--entertainment">
                        <span>🎬</span> Entertainment
                    </h2>

                    <div className="entertainment-tabs">
                        <button
                            className={`ent-tab ${activeEntTab === 'tamil' ? 'ent-tab--active' : ''}`}
                            onClick={() => setActiveEntTab('tamil')}
                        >
                            🎭 Tamil
                        </button>
                        <button
                            className={`ent-tab ${activeEntTab === 'hindi' ? 'ent-tab--active' : ''}`}
                            onClick={() => setActiveEntTab('hindi')}
                        >
                            🎪 Hindi
                        </button>
                        <button
                            className={`ent-tab ${activeEntTab === 'hollywood' ? 'ent-tab--active' : ''}`}
                            onClick={() => setActiveEntTab('hollywood')}
                        >
                            🎬 Hollywood
                        </button>
                        <button
                            className={`ent-tab ${activeEntTab === 'ott' ? 'ent-tab--active' : ''}`}
                            onClick={() => setActiveEntTab('ott')}
                        >
                            📺 OTT
                        </button>
                    </div>

                    <div className="entertainment-content">
                        <NewsSection
                            title={activeEntTab === 'tamil' ? 'Tamil Cinema' :
                                activeEntTab === 'hindi' ? 'Hindi Cinema' :
                                    activeEntTab === 'hollywood' ? 'Hollywood' : 'OTT & Streaming'}
                            icon={activeEntTab === 'tamil' ? '🎭' :
                                activeEntTab === 'hindi' ? '🎪' :
                                    activeEntTab === 'hollywood' ? '🎬' : '📺'}
                            news={filterOldNews(processedEntertainment.filter(item => item.region === activeEntTab))}
                            maxDisplay={
                                activeEntTab === 'tamil' ? (settings.entertainment?.tamilCount ?? 5) :
                                    activeEntTab === 'hindi' ? (settings.entertainment?.hindiCount ?? 5) :
                                        activeEntTab === 'hollywood' ? (settings.entertainment?.hollywoodCount ?? 3) :
                                            (settings.entertainment?.ottCount ?? 2)
                            }
                            hideTitle
                            showCritics={false}
                        />
                    </div>
                </section>

                {/* Social Trends with Distribution (Moved to Top) */}
                <section id="social-trends" className="news-section">
                    <h2 className="news-section__title news-section__title--social">
                        <span>👥</span> Social Trends
                    </h2>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '16px',
                        padding: '0 16px'
                    }}>
                        {socialTrends.map((item, idx) => (
                            <ImageCard
                                key={idx}
                                article={{
                                    ...item,
                                    time: item.time || 'Recently'
                                }}
                                href={item.link}
                                badge={item.regionLabel}
                                size="medium"
                            />
                        ))}

                        {socialTrends.length === 0 && (
                            <div className="empty-state" style={{gridColumn: '1/-1'}}>
                                <p>No social trends available</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Tech Section */}
                <NewsSection
                    id="tech-news"
                    title="Tech & Startups"
                    icon="🚀"
                    colorClass="news-section__title--world"
                    news={filterOldNews(displayData.technology)}
                    maxDisplay={settings.sections?.technology?.count || 5} // Dynamic
                    showCritics={false}
                />

                {/* AI & Innovation */}
                <NewsSection
                    id="ai-innovation"
                    title="AI & Innovation"
                    icon="🤖"
                    colorClass="news-section__title--entertainment"
                    news={filterOldNews(displayData.technology?.filter(
                        item => item.title?.toLowerCase().includes('ai') ||
                            item.title?.toLowerCase().includes('innovation') ||
                            item.title?.toLowerCase().includes('machine learning') ||
                            item.title?.toLowerCase().includes('chatgpt') ||
                            item.title?.toLowerCase().includes('gemini')
                    ))}
                    maxDisplay={6}
                    showCritics={false}
                />
            </main>

            {/* Floating Section Navigator */}
            <SectionNavigator sections={navSections} />

            {/* Back to Top Button */}
            <button
                onClick={scrollToTop}
                style={{
                    position: 'fixed',
                    bottom: '90px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(var(--bg-card), 0.6)',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    opacity: showBackToTop ? 1 : 0,
                    pointerEvents: showBackToTop ? 'auto' : 'none',
                    transition: 'all 0.3s ease',
                    zIndex: 900,
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                className="back-to-top"
            >
                ↑
            </button>
        </div>
    );
}

export default TechSocialPage;
