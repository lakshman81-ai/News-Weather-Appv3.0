
/**
 * benchmark.js — Performance Benchmark
 * Run with: node js/tests/benchmark.js
 */

import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

// ── Mock Browser Globals ──
if (typeof global !== 'undefined') {
    global.localStorage = { getItem: () => null, setItem: () => { }, clear: () => { } };
    global.window = global;
    global.performance = { now: () => Date.now() };
    global.document = {
        getElementById: () => null,
        createElement: () => ({ style: {}, classList: { add: () => { }, remove: () => { }, toggle: () => { } } })
    };
}

import { MappingEngine } from '../services/mapping-engine.js';
import { DataManager } from '../services/data-manager.js';

console.log('--- Performance Benchmark ---');

async function runBenchmark() {
    const dm = new DataManager();
    const engine = new MappingEngine(dm);

    // 1. Load Linelist (ImportedRawLineListLL.xlsx)
    console.log('\n1. Loading Linelist (50KB)...');
    let start = performance.now();
    const linelistBuf = readFileSync('Docs/ImportedRawLineListLL.xlsx');
    const llWorkbook = XLSX.read(linelistBuf, { type: 'buffer' });
    const llSheet = llWorkbook.Sheets[llWorkbook.SheetNames[0]];
    const linelistData = XLSX.utils.sheet_to_json(llSheet);
    let end = performance.now();
    console.log(`   Load Time: ${(end - start).toFixed(2)}ms`);
    console.log(`   Rows: ${linelistData.length}`);

    dm.setLinelist(linelistData);

    // 2. Load Weights (wtValveweights.xlsx)
    console.log('\n2. Loading Weights (88KB)...');
    start = performance.now();
    const weightsBuf = readFileSync('Docs/wtValveweights.xlsx');
    const wtWorkbook = XLSX.read(weightsBuf, { type: 'buffer' });
    const wtSheet = wtWorkbook.Sheets[wtWorkbook.SheetNames[0]];
    const weightsData = XLSX.utils.sheet_to_json(wtSheet);
    end = performance.now();
    console.log(`   Load Time: ${(end - start).toFixed(2)}ms`);
    console.log(`   Rows: ${weightsData.length}`);

    dm.setWeights(weightsData);

    // Adjust header map for the specific files found in Docs
    dm.headerMap.weights.size = 'NS';      // 'NS' found in wtValveweights
    dm.headerMap.weights.schedule = 'Rating'; // Use 'Rating' instead of 'Schedule' for valves
    dm.headerMap.weights.weight = 'RF/RTJ KG'; // Guessing weight column based on log sample 'RF/RTJ KG'

    // 3. Measure Indexing Time (Memoization)
    console.log('\n3. Building Indexes (First Access)...');
    start = performance.now();
    // Force index build by accessing private methods or simulating lookup
    // accessing _buildLineIndex directly for benchmark purity if permitted,
    // or just calling findMatchedRow

    // Simulate lookup to trigger lazy build
    // Uses findMatchingLine (not findMatchedRow)
    engine.findMatchingLine({ linelistRef: null, raw: { [dm.headerMap.linelist.lineNo]: 'dummy' } });
    engine.findMatchingWeight({ weightRef: null, raw: { 'NS': '4', 'Rating': '150' } });

    end = performance.now();
    console.log(`   Index Build Time: ${(end - start).toFixed(2)}ms`);

    // 4. Measure Lookup Throughput
    console.log('\n4. Simulating 10,000 Lookups...');
    start = performance.now();
    for (let i = 0; i < 10000; i++) {
        // Random lookup
        const row = linelistData[i % linelistData.length];
        // assuming 'Line' column exists
        const lineKey = Object.keys(row)[0];
        const val = row[lineKey];
        // Ensure index is built by calling mapComponents once before loop, or ensure findMatchingLine handles it?
        // Actually, MappingEngine.mapComponents builds the index.
        // We should simulate mapComponents for the benchmark to be accurate.
        // Or manually trigger build.
        if (!engine._lineIndex) engine.mapComponents([]); // trigger index build

        // MappingEngine expects 'pipelineReference' to be set
        engine.findMatchingLine({ pipelineReference: val });
    }
    end = performance.now();
    console.log(`   10k Lookups Time: ${(end - start).toFixed(2)}ms`);
    console.log(`   Throughput: ${(10000 / ((end - start) / 1000)).toFixed(0)} ops/sec`);

    // 5. Memory Usage
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`\nMemory Usage: ${used.toFixed(2)} MB`);
}

runBenchmark().catch(console.error);
