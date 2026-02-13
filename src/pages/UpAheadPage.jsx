import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { useWatchlist } from '../hooks/useWatchlist';
import { downloadCalendarEvent } from '../utils/calendar';
import {
    fetchStaticUpAheadData,
    fetchLiveUpAheadData,
    mergeUpAheadData,
    loadFromCache,
    saveToCache
} from '../services/upAheadService';
import plannerStorage from '../utils/plannerStorage';
import { useSettings } from '../context/SettingsContext';
import './UpAhead.css';

function UpAheadPage() {
    const { settings } = useSettings();

    // Data state
    const [data, setData] = useState(null);

    // Loading state
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState(0); // 0: Init, 1: Local, 2: Static, 3: Live

    // View state
    const [view, setView] = useState('plan');

    // Blacklist state
    const [, setBlacklist] = useState(plannerStorage.getBlacklist ? plannerStorage.getBlacklist() : new Set());

    const { toggleWatchlist, isWatched } = useWatchlist();

    const loadData = useCallback(async (forceRefresh = false) => {
        // If force refresh, reset phases slightly or just ensure we do fetch live
        if (forceRefresh) {
            setIsRefreshing(true);
            setLoadingPhase(1); // Reset to indicate working
        } else {
             setLoading(true);
             setLoadingPhase(0);
        }

        // PHASE 1: Local Cache (Immediate)
        // Only load cache if we are starting fresh (not a manual refresh)
        if (!forceRefresh) {
            const cached = loadFromCache();
            if (cached) {
                setData(cached);
                setLoading(false); // Show content immediately
                setLoadingPhase(1);
            }
        }

        // PHASE 2: Static Data (Fast)
        // Always fetch static to get base events
        try {
            const staticData = await fetchStaticUpAheadData();
            if (staticData) {
                setData(prev => {
                    const merged = mergeUpAheadData(prev, staticData);
                    return merged;
                });
                if (!forceRefresh) setLoadingPhase(2);
                setLoading(false);
            }
        } catch (e) {
            console.warn("Static fetch failed", e);
        }

        // PHASE 3: Live Data (Background)
        // Use settings to fetch live
        setIsRefreshing(true);
        try {
            const upAheadSettings = settings.upAhead || {
                categories: { movies: true, events: true, festivals: true, alerts: true, sports: true, shopping: true, civic: true, weather_alerts: true, airlines: true },
                locations: ['Chennai']
            };

            const liveData = await fetchLiveUpAheadData(upAheadSettings);

            setData(prev => {
                const merged = mergeUpAheadData(prev, liveData);
                // Save complete dataset to cache
                saveToCache(merged);
                return merged;
            });
            setLoadingPhase(3);
        } catch (err) {
            console.error("Failed to load Live Up Ahead data", err);
        } finally {
            setIsRefreshing(false);
            setLoading(false);
        }
    }, [settings.upAhead]);

    // Initial Load
    useEffect(() => {
        loadData(false);
    }, [loadData]);

    // Handle Blacklist removal
    const handleRemoveFromPlan = (id) => {
        if (!id) return;
        if (plannerStorage.addToBlacklist) {
            plannerStorage.addToBlacklist(id);
            setBlacklist(plannerStorage.getBlacklist());
            // Re-merge/process logic is implied by state update usually,
            // but since we pre-calculate weekly_plan in service, we might need to soft-refresh.
            // For now, we rely on the next render or manual refresh to clean up completely,
            // but we can filter `data` locally for immediate UI feedback if needed.
            // Simplified: Force a re-merge of current data?
            // Actually, `mergeUpAheadData` calls `generateWeeklyPlan` which reads blacklist (if passed).
            // But we can't easily trigger just that.
            // Let's just reload data (cached/static will be fast).
            loadData(false);
        }
    };

    const handleAddToPlan = (item, dateStr) => {
        plannerStorage.addItem(dateStr, {
            id: item.id,
            title: item.title,
            category: item.tags?.[0] || 'event',
            link: item.link,
            description: item.description
        });
        alert("Added to Plan!");
    };

    // --- RENDER HELPERS ---
    const formatConciseDate = (dateStr) => {
        if (!dateStr) return 'Coming Soon';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        return `${dayName}, ${dayNum} ${month}`;
    };

    const CompactEventList = ({ items, colorClass, emptyMessage, isOffer = false }) => {
        if (!items || items.length === 0) return <div className="empty-state"><p>{emptyMessage}</p></div>;
        return (
            <div className="ua-wk-card" style={{border: 'none', background: 'transparent', padding: 0}}>
                <ul className="ua-wk-list">
                    {items.map((item, i) => {
                        const dateText = formatConciseDate(item.date || item.releaseDate);
                        return (
                            <li key={i} className="ua-wk-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', marginBottom: '8px'}}>
                                <a href={item.link} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none', color:'inherit', flex:1, overflow:'hidden', display:'flex', alignItems:'center', gap: '8px'}}>
                                    {isOffer && <span style={{fontSize:'1.2rem'}}>🏷️</span>}
                                    <span className="ua-wk-text" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize: '0.95rem', fontWeight: 500}}>{item.title}</span>
                                </a>
                                <span className={`ua-wk-date ${colorClass}`} style={{whiteSpace:'nowrap', flexShrink:0, fontSize: '0.8rem', fontWeight: 600}}>{dateText}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    if (loading && !data) {
        return (
            <div className="page-container">
                <Header title="Up Ahead" icon="🗓️" loadingPhase={loadingPhase} />
                <div className="loading">
                    <div className="loading__spinner"></div>
                    <p>Scanning horizon...</p>
                </div>
            </div>
        );
    }

    if (!data || !data.timeline || data.timeline.length === 0) {
         return (
            <div className="page-container">
                <Header title="Up Ahead" icon="🗓️" loadingPhase={loadingPhase} />
                <div className="empty-state">
                    <span style={{ fontSize: '3rem' }}>🔭</span>
                    <h3>Nothing on the radar</h3>
                    <p>No upcoming events found.</p>
                    <button onClick={() => loadData(true)} className="btn btn--primary" style={{ marginTop: '1rem' }}>Retry Scan</button>
                    <div style={{ marginTop: '0.75rem' }}><small>Try adding more locations or categories in <Link to="/settings" style={{ color: 'var(--accent-primary)' }}>Settings</Link>.</small></div>
                </div>
            </div>
        );
    }

    const weatherAlerts = data.sections?.weather_alerts || [];
    const generalAlerts = data.sections?.alerts || [];
    const civicAlerts = data.sections?.civic || [];
    const combinedAlerts = [...weatherAlerts, ...generalAlerts, ...civicAlerts];

    const highPriorityAlert = weatherAlerts[0] || generalAlerts[0] || null;
    const alertIcon = weatherAlerts.length > 0 ? '🌪️' : '⚠️';
    const alertTitle = weatherAlerts.length > 0 ? 'Weather Warning' : 'Worth Knowing';

    return (
        <div className="page-container up-ahead-page">
            <Header
                title="Up Ahead"
                icon="🗓️"
                loadingPhase={loadingPhase}
                rightElement={isRefreshing ? <div className="scanning-indicator" style={{fontSize:'0.7rem', color:'var(--accent-primary)'}}>Scanning...</div> : null}
            />

            <div style={{
                textAlign: 'center',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                padding: '6px',
                background: 'var(--bg-secondary)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
            }}>
                {isRefreshing ? (
                    <>
                        <div className="loading__spinner" style={{width:'12px', height:'12px', borderWidth:'2px'}}></div>
                        <span>Scanning horizon...</span>
                    </>
                ) : (
                    <>
                        <span>Live Feed • {settings.upAhead?.locations?.join(', ') || 'All Locations'}</span>
                        <button onClick={() => loadData(true)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem'}}>🔄</button>
                    </>
                )}
            </div>

            {highPriorityAlert && (
                <div className={`ua-alert-banner ${weatherAlerts.length > 0 ? 'weather-alert' : ''}`}>
                    <span className="ua-alert-icon">{alertIcon}</span>
                    <div className="ua-alert-content">
                        <h4>{alertTitle}</h4>
                        <p>{highPriorityAlert.text}</p>
                    </div>
                </div>
            )}

            <div className="ua-view-toggle scrollable-tabs">
                <button className={`ua-toggle-btn ${view === 'plan' ? 'active' : ''}`} onClick={() => setView('plan')}>Plan My Week</button>
                <button className={`ua-toggle-btn ${view === 'offers' ? 'active' : ''}`} onClick={() => setView('offers')}>Offers</button>
                <button className={`ua-toggle-btn ${view === 'movies' ? 'active' : ''}`} onClick={() => setView('movies')}>Releasing Soon</button>
                <button className={`ua-toggle-btn ${view === 'events' ? 'active' : ''}`} onClick={() => setView('events')}>Upcoming Events</button>
                <button className={`ua-toggle-btn ${view === 'alerts' ? 'active' : ''}`} onClick={() => setView('alerts')}>Alerts</button>
                <button className={`ua-toggle-btn ${view === 'festivals' ? 'active' : ''}`} onClick={() => setView('festivals')}>Festivals</button>
                <button className={`ua-toggle-btn ${view === 'feed' ? 'active' : ''}`} onClick={() => setView('feed')}>Timeline</button>
            </div>

            {view === 'plan' && (
                <div className="ua-weekly-plan">
                     {(data.weekly_plan && Array.isArray(data.weekly_plan)) ? data.weekly_plan.map((dayData, dIdx) => (
                         <div key={dIdx} className="ua-plan-day-row">
                             <div className="ua-plan-ribbon">
                                 <div style={{fontSize: '0.95rem', fontWeight: 800, whiteSpace: 'nowrap'}}>
                                     {dayData.day} <span style={{opacity: 0.8, fontWeight: 400}}>{dayData.date}</span>
                                 </div>
                             </div>
                             <div className="ua-plan-day-content">
                                 {dayData.items && dayData.items.length > 0 ? (
                                     dayData.items.map((item, idx) => (
                                         <div key={idx} className="ua-plan-event-item">
                                              <button className="ua-plan-delete-btn" onClick={(e) => { e.preventDefault(); handleRemoveFromPlan(item.id); }} aria-label="Remove event" style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.9rem', padding: '0 8px 0 0'}}>✕</button>
                                             <a href={item.link} target="_blank" rel="noopener noreferrer" style={{flex:1, display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', color:'inherit'}}>
                                                 <span className="ua-event-icon">{item.icon}</span>
                                                 <div style={{display:'flex', flexDirection:'column'}}>
                                                     <span className="ua-event-title">{item.title}</span>
                                                     {item.isOffer && <span className="ua-offer-badge">🛒 Ends Today</span>}
                                                 </div>
                                             </a>
                                             <div style={{display:'flex', gap:'8px'}}>
                                                 <button className="ua-plan-action-btn" onClick={(e) => { e.preventDefault(); downloadCalendarEvent(item.title, item.description || item.title); }} title="Add to Calendar" style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem'}}>📅</button>
                                             </div>
                                         </div>
                                     ))
                                 ) : <span className="ua-plan-empty" style={{padding: '10px', color: 'var(--text-muted)', fontSize: '0.9rem'}}>-</span>}
                             </div>
                         </div>
                     )) : <div style={{textAlign:'center', padding:'20px'}}>Data unavailable.</div>}
                </div>
            )}

            {view === 'movies' && <div className="ua-tab-view"><CompactEventList items={data.sections?.movies} colorClass="text-accent-info" emptyMessage="No upcoming movie releases found." /></div>}
            {view === 'offers' && <div className="ua-tab-view"><CompactEventList items={[...(data.sections?.shopping || []), ...(data.sections?.airlines || [])]} colorClass="text-accent-success" emptyMessage="No offers found." isOffer={true} /><div style={{textAlign:'center', marginTop:'10px', fontSize:'0.8rem', color:'var(--text-muted)'}}>Including Airline Offers</div></div>}
            {view === 'events' && <div className="ua-tab-view"><CompactEventList items={[...(data.sections?.events || []), ...(data.sections?.sports || [])]} colorClass="text-accent-primary" emptyMessage="No upcoming events found." /></div>}
            {view === 'alerts' && <div className="ua-tab-view"><CompactEventList items={combinedAlerts} colorClass="text-accent-error" emptyMessage="No alerts found." /></div>}
            {view === 'festivals' && <div className="ua-tab-view"><CompactEventList items={data.sections?.festivals} colorClass="text-accent-warning" emptyMessage="No festivals found." /></div>}

            {view === 'feed' && (
                <div className="ua-timeline">
                    {data.timeline.map((day) => (
                        <div key={day.date} className="ua-day-section">
                            <div className="ua-day-header">
                                <div className="ua-day-label">{day.dayLabel}</div>
                                <div className="ua-date-sub">{day.date}</div>
                            </div>
                            {day.items?.map(item => (
                                <div key={item.id} className="ua-media-card">
                                    <div className="ua-media-content">
                                        <div className="ua-media-header">
                                            <span className={`ua-badge type-${item.type}`}>{item.type.toUpperCase()}</span>
                                            <button className={`ua-watch-btn ${isWatched(item.id) ? 'active' : ''}`} onClick={() => toggleWatchlist(item.id)}>{isWatched(item.id) ? '★' : '☆'}</button>
                                        </div>
                                        <h3 className="ua-media-title">{item.title}</h3>
                                        <p className="ua-media-desc">{item.description ? (item.description.length > 100 ? item.description.substring(0, 100) + '...' : item.description) : ''}</p>
                                        <div className="ua-media-footer">
                                            {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="ua-source-link">Read Source ↗</a>}
                                            <button className="ua-cal-btn" onClick={() => handleAddToPlan(item, day.date)} title="Add to Plan My Week">📌 Plan</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default UpAheadPage;
