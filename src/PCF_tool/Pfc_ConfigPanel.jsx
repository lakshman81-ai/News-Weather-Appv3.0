import React, { useState } from 'react';
import { usePfcConfig } from './Pfc_ConfigContext';

const Pfc_ConfigPanel = () => {
    const { config, updateHeaderMap, updateTypeMap, resetConfig } = usePfcConfig();
    const [activeTab, setActiveTab] = useState('headers');

    const handleHeaderChange = (key, val) => {
        updateHeaderMap(key, val);
    };

    const handleTypeChange = (key, val) => {
        updateTypeMap(key, val);
    };

    return (
        <div className="pfc-config-panel">
            <div className="pfc-tabs">
                <button onClick={() => setActiveTab('headers')} className={activeTab === 'headers' ? 'active' : ''}>Headers</button>
                <button onClick={() => setActiveTab('types')} className={activeTab === 'types' ? 'active' : ''}>Component Types</button>
                <button onClick={resetConfig} className="pfc-btn-danger">Reset Defaults</button>
            </div>

            {activeTab === 'headers' && (
                <div className="pfc-config-section">
                    <h3>CSV Header Mapping</h3>
                    {Object.entries(config.headerMap).map(([key, value]) => (
                        <div key={key} className="pfc-input-group">
                            <label>{key}</label>
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => handleHeaderChange(key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'types' && (
                <div className="pfc-config-section">
                    <h3>Component Type Mapping</h3>
                    {Object.entries(config.typeMap).map(([key, value]) => (
                        <div key={key} className="pfc-input-group">
                            <label>{key}</label>
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => handleTypeChange(key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .pfc-config-panel { padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .pfc-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                .pfc-tabs button { padding: 8px 16px; border: none; background: #f0f0f0; cursor: pointer; border-radius: 4px; }
                .pfc-tabs button.active { background: #007bff; color: white; }
                .pfc-btn-danger { background: #dc3545 !important; color: white !important; margin-left: auto; }
                .pfc-config-section h3 { margin-bottom: 15px; border-bottom: 2px solid #007bff; padding-bottom: 5px; display: inline-block; }
                .pfc-input-group { display: flex; align-items: center; margin-bottom: 10px; }
                .pfc-input-group label { width: 150px; font-weight: bold; color: #555; }
                .pfc-input-group input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            `}</style>
        </div>
    );
};

export default Pfc_ConfigPanel;
