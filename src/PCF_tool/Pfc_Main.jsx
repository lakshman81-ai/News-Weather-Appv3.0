import React, { useState, useEffect } from 'react';
import { usePfcConfig } from './Pfc_ConfigContext';
import { parseCSV } from './Pfc_CsvParser';
import { processTopology } from './Pfc_TopologyEngine';
import { generatePCF } from './Pfc_PcfGenerator';
import Pfc_ConfigPanel from './Pfc_ConfigPanel';
import Pfc_Uploader from './Pfc_Uploader';
import Pfc_Preview from './Pfc_Preview';

const Pfc_Main = () => {
    const { config } = usePfcConfig();
    const [csvFile, setCsvFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [sequencedComponents, setSequencedComponents] = useState([]);
    const [pcfOutput, setPcfOutput] = useState('');
    const [warnings, setWarnings] = useState([]);
    const [activeTab, setActiveTab] = useState('upload'); // upload, config, preview

    // Processing Pipeline
    useEffect(() => {
        if (csvFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const { data, missingKeys } = parseCSV(text, config);

                if (missingKeys && missingKeys.length > 0) {
                    setWarnings(prev => [...prev, `Missing columns: ${missingKeys.join(', ')}`]);
                }

                setParsedData(data);

                // Topology Logic
                const { components, topoWarnings } = processTopology(data);
                if (topoWarnings) setWarnings(prev => [...prev, ...topoWarnings]);

                setSequencedComponents(components);

                // PCF Generation
                const pcf = generatePCF(components, config);
                setPcfOutput(pcf);
            };
            reader.readAsText(csvFile);
        }
    }, [csvFile, config]);

    return (
        <div className="pfc-container">
            <header className="pfc-header">
                <h1>PCF Converter Tool</h1>
                <nav>
                    <button onClick={() => setActiveTab('upload')} className={activeTab === 'upload' ? 'active' : ''}>Upload</button>
                    <button onClick={() => setActiveTab('config')} className={activeTab === 'config' ? 'active' : ''}>Configuration</button>
                    <button onClick={() => setActiveTab('preview')} className={activeTab === 'preview' ? 'active' : ''} disabled={!pcfOutput}>Result</button>
                </nav>
            </header>

            <main className="pfc-content">
                {activeTab === 'upload' && (
                    <Pfc_Uploader onFileSelect={setCsvFile} />
                )}

                {activeTab === 'config' && (
                    <Pfc_ConfigPanel />
                )}

                {activeTab === 'preview' && (
                    <Pfc_Preview output={pcfOutput} warnings={warnings} components={sequencedComponents} />
                )}
            </main>

            <style>{`
                .pfc-container { font-family: sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
                .pfc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
                .pfc-header nav button { margin-left: 10px; padding: 8px 16px; cursor: pointer; background: #eee; border: 1px solid #ccc; border-radius: 4px; }
                .pfc-header nav button.active { background: #007bff; color: white; border-color: #007bff; }
                .pfc-content { background: #f9f9f9; padding: 20px; border-radius: 8px; min-height: 400px; }
            `}</style>
        </div>
    );
};

export default Pfc_Main;
