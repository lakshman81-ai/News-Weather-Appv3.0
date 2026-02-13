import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import logStore from '../utils/logStore';

const DebugTab = () => {
    const { settings } = useSettings();
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        try {
            if (logStore && typeof logStore.getLogs === 'function') {
                setLogs(logStore.getLogs());
            } else {
                setLogs([]);
            }
        } catch (e) {
            console.error("Failed to load logs", e);
            setError(e.message);
        }
    }, []);

    const safeRender = (msg) => {
        if (typeof msg === 'object') {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return '[Circular Object]';
            }
        }
        return String(msg);
    };

    if (error) {
        return <div className="error-state">Debug Error: {error}</div>;
    }

    return (
        <div className="settings-tab-content">
            <div className="section-title"><span>🐛</span> Debug Info</div>

            <div className="settings-card">
                <div style={{fontSize:'0.8rem', marginBottom:'10px'}}>
                    <strong>App Version:</strong> {settings?.appVersion || 'Unknown'}
                </div>
                <div style={{fontSize:'0.8rem', marginBottom:'10px'}}>
                    <strong>User Agent:</strong> {navigator.userAgent}
                </div>
                <div style={{fontSize:'0.8rem', marginBottom:'10px'}}>
                    <strong>Screen:</strong> {window.innerWidth}x{window.innerHeight}
                </div>
            </div>

            <div className="section-title"><span>📜</span> Recent Logs</div>
            <div className="settings-card" style={{maxHeight:'300px', overflowY:'auto', background:'black', color:'#0f0', fontFamily:'monospace', fontSize:'0.7rem', padding:'10px'}}>
                {logs.length === 0 ? (
                    <div>No logs available.</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} style={{marginBottom:'4px', borderBottom:'1px solid #333', whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>
                            <span style={{color:'#888'}}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                            <span style={{color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'orange' : '#0f0'}}>{log.level.toUpperCase()}:</span>{' '}
                            {safeRender(log.message)}
                            {log.details && (
                                <div style={{marginLeft:'15px', color:'#aaa', fontSize:'0.65rem'}}>
                                    {safeRender(log.details)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="settings-card">
                <button
                    className="btn btn--danger"
                    onClick={() => {
                        if(window.confirm('Clear all data?')) {
                            localStorage.clear();
                            window.location.reload();
                        }
                    }}
                    style={{width:'100%'}}
                >
                    Clear All Local Storage & Reload
                </button>
            </div>
        </div>
    );
};

export default DebugTab;
