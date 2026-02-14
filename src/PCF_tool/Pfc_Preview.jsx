import React from 'react';

const Pfc_Preview = ({ output, warnings, components }) => {

    const handleDownload = () => {
        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pcf_output_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="pfc-preview">
            <div className="pfc-preview-header">
                <h3>PCF Output Preview</h3>
                <button onClick={handleDownload} className="pfc-download-btn">Download PCF</button>
            </div>

            {warnings && warnings.length > 0 && (
                <div className="pfc-warnings">
                    <h4>Validation Warnings</h4>
                    <ul>
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            )}

            <textarea
                readOnly
                value={output}
                className="pfc-output-area"
            />

            <div className="pfc-components-list">
                <h4>Processed Components ({components.length})</h4>
                <div className="pfc-components-scroll">
                    {components.map((comp, i) => (
                        <div key={i} className="pfc-comp-row">
                            <span>#{i+1} {comp.pcfType}</span>
                            <span>{comp.length ? `L=${comp.length.toFixed(1)}` : ''}</span>
                            <span>@{comp.x}, {comp.y}, {comp.z}</span>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                .pfc-preview { display: flex; flex-direction: column; gap: 20px; height: 100%; }
                .pfc-preview-header { display: flex; justify-content: space-between; align-items: center; }
                .pfc-download-btn { background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
                .pfc-download-btn:hover { background: #218838; }
                .pfc-warnings { background: #fff3cd; color: #856404; padding: 15px; border: 1px solid #ffeeba; border-radius: 4px; }
                .pfc-output-area { width: 100%; height: 300px; font-family: monospace; font-size: 14px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; white-space: pre; }
                .pfc-components-list { background: #f8f9fa; padding: 15px; border-radius: 4px; }
                .pfc-components-scroll { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
                .pfc-comp-row { display: flex; gap: 10px; font-size: 0.9em; padding: 4px; border-bottom: 1px solid #eee; }
                .pfc-comp-row:last-child { border-bottom: none; }
            `}</style>
        </div>
    );
};

export default Pfc_Preview;
