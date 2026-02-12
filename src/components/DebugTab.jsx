import React from 'react';
import { useSettings } from '../context/SettingsContext';
import logStore from '../utils/logStore';

const DebugTab = () => {
    const { settings } = useSettings();
    const logs = logStore.getLogs ? logStore.getLogs() : [];

    return (
        <div className="settings-tab-content">
            <div className="section-title"><span>🐛</span> Debug Info</div>

            <div className="settings-card">
                <div style={{fontSize:'0.8rem', marginBottom:'10px'}}>
                    <strong>App Version:</strong> {settings.appVersion || 'Unknown'}
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
                        <div key={i} style={{marginBottom:'4px', borderBottom:'1px solid #333'}}>
                            <span style={{color:'#888'}}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                            <span style={{color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'orange' : '#0f0'}}>{log.level.toUpperCase()}:</span>{' '}
                            {log.message}
                        </div>
                    ))
                )}
            </div>

            <div className="settings-card">
                <button
                    className="btn btn--danger"
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    style={{width:'100%'}}
                >
                    Clear All Local Storage & Reload
                </button>
            </div>
        </div>
    );
};

export default DebugTab;
