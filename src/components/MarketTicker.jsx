import React, { useEffect, useRef, useMemo } from 'react';
import { useMarket } from '../context/MarketContext';
import './MarketTicker.css';

const MarketTicker = ({ loadingPhase }) => {
    const { marketData, loading, lastFetch } = useMarket();
    const scrollRef = useRef(null);
    const isPaused = useRef(false);

    // Filter and prepare market items
    const markets = useMemo(() => {
        if (!marketData) return [];

        const { indices = [], commodities = [] } = marketData;
        const allItems = [...indices, ...commodities];

        // Specific items to display in order (Removed Currencies as requested)
        // Including variations like "NSE 50" or "50" to catch them and rename
        const allowedNames = ['NIFTY 50', 'NSE 50', '50', 'SENSEX', 'BSE SENSEX', 'Gold', 'Silver'];

        return allowedNames
            .map(name => allItems.find(item => item.name === name))
            .filter(Boolean);
    }, [marketData]);

    // Auto-scroll logic (Same as before)
    useEffect(() => {
        let animationFrameId;
        let lastTimestamp = 0;
        const speed = 40; // pixels per second
        let accumulator = 0;

        const scroll = (timestamp) => {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const deltaTime = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            if (scrollRef.current && !isPaused.current) {
                const move = (speed * deltaTime) / 1000;
                accumulator += move;

                if (accumulator >= 1) {
                    const pixelsToMove = Math.floor(accumulator);
                    accumulator -= pixelsToMove;

                    const { scrollLeft, scrollWidth } = scrollRef.current;

                    // Reset if passed halfway point (infinite loop illusion)
                    if (scrollLeft >= scrollWidth / 2) {
                         scrollRef.current.scrollLeft = 0;
                    } else {
                         scrollRef.current.scrollLeft += pixelsToMove;
                    }
                }
            } else {
                lastTimestamp = timestamp;
            }
            animationFrameId = requestAnimationFrame(scroll);
        };

        const timeoutId = setTimeout(() => {
            animationFrameId = requestAnimationFrame(scroll);
        }, 1000);

        return () => {
            cancelAnimationFrame(animationFrameId);
            clearTimeout(timeoutId);
        };
    }, [markets]);

    const isItemStale = (item) => {
        if (!item.timestamp) return true;
        const now = Date.now();
        const diff = now - item.timestamp;

        // Commodities: 60 mins, Others: 15 mins
        const isCommodity = ['Gold', 'Silver', 'Crude Oil'].includes(item.name);
        const threshold = isCommodity ? 60 * 60 * 1000 : 15 * 60 * 1000;

        return diff > threshold;
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getDisplayName = (name) => {
        if (name === 'NSE 50' || name === '50') return 'NIFTY 50';
        if (name === 'BSE SENSEX') return 'SENSEX';
        return name;
    };

    // Progress Visualization based on loadingPhase
    const getPhaseStyle = () => {
        // Phase 1 (Local): Light Green
        // Phase 2 (Static): Medium Green
        // Phase 3 (Live): Dark Green (or complete)
        // We use a bottom border or background tint to show progress unobtrusively
        if (!loadingPhase) return {};

        let color = 'transparent';
        if (loadingPhase === 1) color = 'rgba(144, 238, 144, 0.2)'; // Light Green
        else if (loadingPhase === 2) color = 'rgba(60, 179, 113, 0.2)'; // Medium Sea Green
        else if (loadingPhase === 3) color = 'rgba(34, 139, 34, 0.2)'; // Forest Green (Done)

        return {
            background: `linear-gradient(to bottom, transparent, ${color})`,
            transition: 'background 0.5s ease'
        };
    };

    if ((loading && markets.length === 0) || markets.length === 0) return null;

    return (
        <div className="market-ticker-container" style={getPhaseStyle()}>
            <div className="ticker-label">📈</div>

            <div
                className="ticker-track-wrapper"
                ref={scrollRef}
                onMouseEnter={() => isPaused.current = true}
                onMouseLeave={() => isPaused.current = false}
                onTouchStart={() => isPaused.current = true}
                onTouchEnd={() => isPaused.current = false}
            >
                <div className="ticker-track">
                    {/* Double the list for infinite scroll effect */}
                    {[...markets, ...markets].map((item, index) => {
                        const stale = isItemStale(item);
                        return (
                            <div key={`${item.name}-${index}`} className={`ticker-item ${stale ? 'stale-data' : ''}`}>
                                <span className="ticker-name">{getDisplayName(item.name)}</span>
                                <span className="ticker-price">
                                    {/* Handle unit display for commodities */}
                                    {item.name === 'Gold' || item.name === 'Silver' ? item.value :
                                     (typeof item.value === 'number' ? item.value.toFixed(2) : item.value)}
                                    {item.unit ? <span style={{fontSize: '0.7em', marginLeft: '2px'}}>{item.unit}</span> : ''}
                                </span>
                                <span className={`ticker-change ${parseFloat(item.change) >= 0 ? 'positive' : 'negative'}`}>
                                    {parseFloat(item.change) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(item.changePercent)).toFixed(2)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Static Last Updated Label */}
            {lastFetch && (
                <div className="ticker-updated">
                    <span style={{marginRight: '4px'}}>🕒</span> {formatTime(lastFetch)}
                </div>
            )}
        </div>
    );
};

export default MarketTicker;
