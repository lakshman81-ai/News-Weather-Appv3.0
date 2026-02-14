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

            <div className="pfc-split-view">
                <div className="pfc-pane">
                    <h4>Processed Sequence ({components.length})</h4>
                    <div className="pfc-components-scroll">
                        {components.map((comp, i) => (
                            <div key={i} className="pfc-comp-row">
                                <span className="pfc-idx">#{i+1}</span>
                                <span className="pfc-type">{comp.pcfType}</span>
                                <span className="pfc-detail">
                                    {comp.length ? `L=${comp.length.toFixed(1)}` : ''}
                                    @{comp.x}, {comp.y}, {comp.z}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pfc-pane">
                    <h4>PCF Output</h4>
                    <textarea
                        readOnly
                        value={output}
                        className="pfc-output-area"
                    />
                </div>
            </div>

            <style>{`
                .pfc-preview { display: flex; flex-direction: column; gap: 20px; height: 100%; }
                .pfc-preview-header { display: flex; justify-content: space-between; align-items: center; }
                .pfc-download-btn { background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
                .pfc-download-btn:hover { background: #218838; }
                .pfc-warnings { background: #fff3cd; color: #856404; padding: 15px; border: 1px solid #ffeeba; border-radius: 4px; }

                .pfc-split-view { display: flex; gap: 20px; flex: 1; min-height: 400px; }
                .pfc-pane { flex: 1; display: flex; flex-direction: column; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
                .pfc-pane h4 { margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }

                .pfc-output-area { width: 100%; flex: 1; font-family: monospace; font-size: 13px; padding: 10px; border: 1px solid #eee; background: #f8f9fa; resize: none; white-space: pre; }

                .pfc-components-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0; }
                .pfc-comp-row { display: flex; gap: 10px; font-size: 0.85em; padding: 6px; border-bottom: 1px solid #eee; align-items: center; }
                .pfc-comp-row:nth-child(even) { background: #f9f9f9; }
                .pfc-idx { font-weight: bold; color: #888; width: 30px; }
                .pfc-type { font-weight: bold; color: #007bff; width: 60px; }
                .pfc-detail { color: #555; }
            `}</style>
        </div>
    );
};

export default Pfc_Preview;
