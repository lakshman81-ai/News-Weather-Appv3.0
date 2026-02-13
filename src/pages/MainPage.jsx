import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import Header from '../components/Header';
import NewsSection from '../components/NewsSection';
import SectionNavigator from '../components/SectionNavigator';
import BreakingNews from '../components/BreakingNews';
import TimelineHeader from '../components/TimelineHeader';
import QuickWeather from '../components/QuickWeather';
import { NewspaperLayout } from '../components/NewspaperLayout';
import { getTopline } from '../utils/timeSegment';
import { generateTopline, fetchOnThisDay } from '../utils/toplineGenerator';
import { getTimeSinceRefresh, getViewCount, isArticleRead } from '../utils/storage';
import { useWeather } from '../context/WeatherContext';
import { useNews } from '../context/NewsContext';
import { useSettings } from '../context/SettingsContext';
import { useSegment } from '../context/SegmentContext';
import { requestNotificationPermission } from '../utils/notifications';
import { useMediaQuery } from '../hooks/useMediaQuery';
import LazySection from '../components/LazySection';
import SidebarNews from '../components/SidebarNews';

const MainPage = () => {
    const { settings } = useSettings();
    const { currentSegment } = useSegment();
    const [notifPermission, setNotifPermission] = useState(Notification.permission);
    const [toplineContent, setToplineContent] = useState(null);
    const [onThisDay, setOnThisDay] = useState(null);

    // Responsive Detection
    const { isWebView, isDesktop } = useMediaQuery();

    // Use Contexts
    const { weatherData, loading: weatherLoading, refreshWeather } = useWeather();
    const { newsData, loading, errors, breakingNews, refreshNews, loadSection, loadedSections } = useNews();

    const { sections, uiMode = 'timeline' } = settings;
    const [latestStories, setLatestStories] = useState([]);

    // --- LOGIC: Filter Latest Stories ---
    useEffect(() => {
        if (!newsData.frontPage) {
            setLatestStories([]);
            return;
        }

        if (settings.customSortTopStories) {
            // Latest Stories Mode: Filter out seen/read items
            // Rule: "Not shown to user more than 3 times (2) User did not click and read that"
            let filtered = newsData.frontPage.filter(item => {
                if (isArticleRead(item.id)) return false;
                // Reduced view count limit from 10 to 3
                if (getViewCount(item.id) > 3) return false;
                return true;
            });

            // Sort by Impact Score (Descending)
            filtered.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

            // Fallback: If filtered list is too small (< 10), fill with top items from original list
            const MIN_DISPLAY = 10;
            if (filtered.length < MIN_DISPLAY) {
                const existingIds = new Set(filtered.map(i => i.id));
                const remaining = newsData.frontPage.filter(i => !existingIds.has(i.id));
                remaining.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

                const needed = MIN_DISPLAY - filtered.length;
                filtered = [...filtered, ...remaining.slice(0, needed)];
            }

            setLatestStories(filtered);
        } else {
            // Standard Mode: Show all
            setLatestStories(newsData.frontPage);
        }
    }, [newsData.frontPage, settings.customSortTopStories]);

    // --- LOGIC: Sync Segment with Data Refresh & UI ---
    useEffect(() => {
        refreshWeather();
        refreshNews();
    }, [currentSegment.id, refreshNews, refreshWeather]);

    // Fetch On This Day
    useEffect(() => {
        fetchOnThisDay().then(event => {
            if (event) setOnThisDay(event);
        });
    }, []);

    // Generate Topline when data is ready
    useEffect(() => {
        // Update topline if we have data, even if still refreshing (loading=true)
        // This ensures the "On This Day" or other content appears immediately on load/reload
        const hasNews = newsData && Object.keys(newsData).length > 0;
        const hasWeather = weatherData && Object.keys(weatherData).length > 0;

        if (hasNews || hasWeather || onThisDay) {
            setToplineContent(generateTopline(newsData, weatherData, onThisDay));
        }
    }, [loading, weatherLoading, newsData, weatherData, onThisDay]);

    const handleRequestPermission = async () => {
        const granted = await requestNotificationPermission();
        setNotifPermission(granted ? 'granted' : 'denied');
    };

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

    // Pull-to-Refresh Logic
    useEffect(() => {
        let startY = 0;
        let isPulling = false;

        const handleTouchStart = (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        };

        const handleTouchMove = (e) => {
            if (!isPulling) return;
            const currentY = e.touches[0].clientY;
            if (currentY - startY > 150) {
                // Visual cue
            }
        };

        const handleTouchEnd = (e) => {
            if (!isPulling) return;
            const endY = e.changedTouches[0].clientY;
            if (endY - startY > 150 && window.scrollY === 0) {
                refreshNews();
                refreshWeather();
            }
            isPulling = false;
        };

        if (!isDesktop) {
            document.addEventListener('touchstart', handleTouchStart);
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [refreshNews, refreshWeather, isDesktop]);

    // Determine loading state
    const isLoading = (weatherLoading && !weatherData) || (loading && Object.keys(newsData).length === 0);
    const loadingPhase = isLoading ? 1 : 3;

    const isTimelineMode = uiMode === 'timeline';
    const isNewspaperMode = uiMode === 'newspaper';
    const isUrgentMode = currentSegment.id === 'urgent_only';

    // Navigation Sections
    const navSections = [
        { id: 'world-news', icon: '🌍', label: 'World' },
        sections.india?.enabled && { id: 'india-news', icon: '🇮🇳', label: 'India' },
        sections.chennai?.enabled && { id: 'chennai-news', icon: '🏛️', label: 'Tamil Nadu' },
        sections.local?.enabled && { id: 'local-news', icon: '📍', label: 'Muscat' }
    ].filter(Boolean);

    const headerActions = (
        <div className="header__actions">
            <Link to="/refresh" className="header__action-btn">🔄</Link>
            <Link to="/settings" className="header__action-btn">⚙️</Link>
        </div>
    );

    return (
        <div className={`page-container mode-${uiMode} ${isWebView ? 'page-container--desktop' : ''}`}>

            {isTimelineMode ? (
                <TimelineHeader
                    title={currentSegment.id === 'market_brief' ? '' : currentSegment.label}
                    icon={currentSegment.icon}
                    actions={headerActions}
                    loadingPhase={loadingPhase}
                />
            ) : (
                <Header
                    title={currentSegment.label}
                    icon={currentSegment.icon}
                    actions={headerActions}
                    loadingPhase={loadingPhase}
                />
            )}

            <main className={`main-content ${isWebView ? 'main-content--desktop' : ''}`}>

                {/* Desktop Sidebar */}
                {isWebView && (
                    <div className="desktop-sidebar">
                        <QuickWeather />
                        {/* Ensure Tamil Nadu is prioritized or visible if active */}
                        <SidebarNews
                            news={
                                newsData.world && newsData.world.length > 0 ? newsData.world :
                                (newsData.chennai && newsData.chennai.length > 0 ? newsData.chennai : newsData.frontPage)
                            }
                            title="Global Headlines"
                        />
                    </div>
                )}

                <div className="content-wrapper">

                    {isLoading && (
                        <div className="loading" style={{padding: '40px'}}>
                            <div className="loading__spinner"></div>
                            <span>Loading Updates...</span>
                        </div>
                    )}

                    {!isTimelineMode && (
                        <>
                            <div className="topline">
                                <div className="topline__label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{toplineContent?.icon || '📰'}</span>
                                    <span>{toplineContent?.type || 'TOPLINE'}</span>
                                </div>
                                <div className="topline__text">
                                    {toplineContent?.text || getTopline(currentSegment)}
                                </div>
                            </div>
                            <BreakingNews items={breakingNews} />
                        </>
                    )}

                    {!isWebView && (
                        <QuickWeather />
                    )}

                    {isNewspaperMode ? (
                        <NewspaperLayout
                            newsData={newsData}
                            breakingNews={breakingNews}
                            settings={settings.newspaper}
                        />
                    ) : (
                        <div className="news-sections news-sections--grid">

                            {(!isUrgentMode || breakingNews.length === 0) && (
                                <>
                                    {latestStories.length > 0 ? (
                                        <NewsSection
                                            id="top-stories"
                                            title="Top Stories"
                                            icon="⭐"
                                            colorClass="news-section__title--world"
                                            news={latestStories}
                                            maxDisplay={10}
                                        />
                                    ) : (
                                        settings.customSortTopStories && newsData.frontPage?.length > 0 && (
                                            <div className="empty-state" style={{padding: '20px', marginBottom: '20px', background: 'var(--bg-card)', borderRadius: '12px'}}>
                                                <div style={{fontSize: '2rem', marginBottom:'10px'}}>✅</div>
                                                <p style={{color: 'var(--text-muted)'}}>You're all caught up with top stories!</p>
                                                <button
                                                    onClick={() => refreshNews()}
                                                    className="btn btn--secondary"
                                                    style={{marginTop:'10px', fontSize:'0.8rem', padding:'6px 12px'}}
                                                >
                                                    Check for new updates
                                                </button>
                                            </div>
                                        )
                                    )}

                                    <NewsSection
                                        id="world-news"
                                        title="Global Updates"
                                        icon="🌍"
                                        colorClass="news-section__title--world"
                                        news={newsData.world}
                                        maxDisplay={sections.world?.count || 5}
                                    />

                                    {sections.india?.enabled && (
                                        <NewsSection
                                            id="india-news"
                                            title={isTimelineMode ? "India" : "India News"}
                                            icon="🇮🇳"
                                            colorClass="news-section__title--india"
                                            news={newsData.india}
                                            maxDisplay={sections.india.count || 5}
                                            error={errors.india}
                                        />
                                    )}

                                    {/* Tamil Nadu Feed (Chennai) */}
                                    {sections.chennai?.enabled && (
                                        <NewsSection
                                            id="chennai-news"
                                            title="Tamil Nadu"
                                            icon="🏛️"
                                            colorClass="news-section__title--chennai"
                                            news={newsData.chennai}
                                            maxDisplay={sections.chennai.count || 5}
                                            error={errors.chennai}
                                        />
                                    )}

                                    {sections.trichy?.enabled && (
                                        <NewsSection
                                            id="trichy-news"
                                            title="Trichy"
                                            icon="🏛️"
                                            colorClass="news-section__title--trichy"
                                            news={newsData.trichy}
                                            maxDisplay={sections.trichy.count || 5}
                                            error={errors.trichy}
                                        />
                                    )}

                                    {sections.local?.enabled && (
                                        <LazySection
                                            id="local-news"
                                            onVisible={() => loadSection('local')}
                                            isLoaded={loadedSections.includes('local')}
                                        >
                                            <NewsSection
                                                id="local-news"
                                                title="Local — Muscat"
                                                icon="📍"
                                                colorClass="news-section__title--local"
                                                news={newsData.local}
                                                maxDisplay={sections.local.count || 5}
                                                error={errors.local}
                                            />
                                        </LazySection>
                                    )}
                                </>
                            )}

                            {isUrgentMode && breakingNews.length === 0 && (
                                <div style={{padding: '20px', textAlign: 'center', color: 'var(--text-muted)'}}>
                                    <h3>Urgent Alerts Mode</h3>
                                    <p>Monitoring for critical updates...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {settings.debugLogs && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            marginTop: 'var(--spacing-md)', padding: '8px 12px',
                            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                            fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap'
                        }}>
                            <span title="Segment">{currentSegment.icon} {currentSegment.label}</span>
                            <span title="Notifications">{notifPermission === 'granted' ? '🔔' : '🔕'}</span>
                            <span title="UI Mode">📱 {uiMode}</span>
                            <span title="Strict Mode">{settings.strictFreshness ? '🛡️' : '🔓'}</span>
                            <Link to="/settings" onClick={() => {}} style={{ marginLeft: 'auto', color: 'var(--accent-primary)', fontSize: '0.7rem' }}>
                                Debug →
                            </Link>
                        </div>
                    )}
                </div>
            </main>

            <SectionNavigator sections={navSections} />

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

export default MainPage;
