import React from 'react';

const MarketStickyHeader = ({ indices, onRefresh, loading, lastUpdated }) => {
    // Priority Indices to show in header
    const priorityIndices = ['NIFTY 50', 'SENSEX', 'NIFTY BANK'];

    // Filter and map indices (fallback to first 3 if priority not found)
    const headerIndices = priorityIndices.map(name =>
        indices?.find(i => i.name.toUpperCase().includes(name))
    ).filter(Boolean);

    // If no priority indices found (e.g. API change), take first 3
    const displayIndices = headerIndices.length > 0 ? headerIndices : (indices?.slice(0, 3) || []);

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'var(--bg-primary)',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--border-default)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
            {/* Top Bar: Title + Actions */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--gradient-header)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📈</span>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            Indian Markets
                        </h2>
                        {lastUpdated && (
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>
                                Updated {formatTime(lastUpdated)}
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={onRefresh}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '4px',
                        color: 'var(--text-primary)',
                        opacity: loading ? 0.5 : 1,
                        transition: 'transform 0.3s'
                    }}
                    title="Refresh Markets"
                    className={loading ? 'spin' : ''}
                >
                    {loading ? '⟳' : '🔄'}
                </button>
            </div>

            {/* Indices Grid (Header) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${displayIndices.length}, 1fr)`,
                gap: '1px',
                background: 'var(--border-default)',
                marginTop: '0'
            }}>
                {displayIndices.map((index, idx) => {
                    const isUp = index.direction === 'up' || index.change > 0;
                    const color = isUp ? 'var(--accent-success)' : 'var(--accent-danger)';
                    const arrow = isUp ? '▲' : '▼';

                    return (
                        <div key={idx} style={{
                            background: 'var(--bg-secondary)',
                            padding: '10px 4px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                fontWeight: 600,
                                marginBottom: '2px',
                                textTransform: 'uppercase'
                            }}>
                                {index.name.replace('NIFTY', '').replace('SENSEX', 'SENSEX').trim() || index.name}
                            </div>
                            <div style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginBottom: '2px'
                            }}>
                                {index.value}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: color,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                            }}>
                                <span>{arrow}</span>
                                <span>{Math.abs(index.change).toFixed(2)}</span>
                                <span style={{ opacity: 0.8 }}>({Math.abs(index.changePercent).toFixed(2)}%)</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Simple spinner animation style */}
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default MarketStickyHeader;
