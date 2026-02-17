import React, { useState } from 'react';
import { Pfc_TopologyEngine } from './Pfc_TopologyEngine';
import { Pfc_PcfGenerator } from './Pfc_PcfGenerator';

export default function Pfc_App() {
  const [csvFile, setCsvFile] = useState(null);
  const [pcfContent, setPcfContent] = useState('');
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleConvert = async () => {
    if (!csvFile) return;
    setError(null);
    setPcfContent('');

    try {
      const text = await csvFile.text();
      const engine = new Pfc_TopologyEngine(text);
      const groups = engine.parse();

      const generator = new Pfc_PcfGenerator(groups);
      const generatedPcf = generator.generate();

      setPcfContent(generatedPcf);
    } catch (err) {
      console.error(err);
      setError('Conversion failed: ' + err.message);
    }
  };

  const handleDownload = () => {
    if (!pcfContent) return;
    const blob = new Blob([pcfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFile.name.replace('.csv', '.pcf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">PCF Converter Tool</h1>

      <div className="mb-4 p-4 bg-white rounded shadow">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="mb-2 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />

        <button
          onClick={handleConvert}
          disabled={!csvFile}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Convert to PCF
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {pcfContent && (
        <div className="bg-white p-4 rounded shadow">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Generated PCF</h2>
            <button
              onClick={handleDownload}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
            >
              Download .pcf
            </button>
          </div>
          <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-auto max-h-96 text-xs font-mono">
            {pcfContent}
          </pre>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-600">
        <h3 className="font-bold">Logic Explanation:</h3>
        <ul className="list-disc pl-5">
          <li>Supports (ANCI) are treated as nodes.</li>
          <li>Implicit pipes are generated to connect disjoint components.</li>
          <li>Long pipes (e.g. > 13.1m) are segmented automatically.</li>
          <li>Coordinate system is transformed to match standard PCF output (North=X, -East=Y, Up=Z).</li>
        </ul>
      </div>
    </div>
  );
}
