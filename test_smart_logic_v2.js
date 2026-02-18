
// Mock localStorage before imports
if (typeof localStorage === 'undefined') {
    global.localStorage = {
        store: {},
        getItem: function(key) { return this.store[key] || null; },
        setItem: function(key, value) { this.store[key] = value.toString(); },
        removeItem: function(key) { delete this.store[key]; },
        clear: function() { this.store = {}; }
    };
}

import { linelistService } from './js/services/linelist-service.js';
import { materialService } from './js/services/material-service.js';
import { setState, getState } from './js/state.js';
import { dataManager } from './js/services/data-manager.js';
import { getConfig } from './js/config/config-store.js';

console.log("=== Running Smart Logic V2 Tests ===");

// --- Test 1: Derive Line Number (Token Strategy) ---
console.log("\n[Test 1] Derive Line Number (Token Strategy)");
const componentName = 'FCSEE-16"-P0511260-11440A1-01';

// Setup Config
const config = getConfig();
config.smartData = {
    lineNoLogic: { strategy: 'token', tokenDelimiter: '-', tokenIndex: 2 }
};

const derived1 = linelistService.deriveLineNo(componentName);
console.log(`Input: ${componentName}`);
console.log(`Derived (Token index 2): ${derived1}`);

if (derived1 === 'P0511260') console.log("PASS");
else console.error("FAIL: Expected P0511260");

// --- Test 2: Derive Line Number (Regex Strategy) ---
console.log("\n[Test 2] Derive Line Number (Regex Strategy)");
config.smartData.lineNoLogic = {
    strategy: 'regex',
    regexPattern: "([A-Z][0-9]+)", // Simple regex for P0511260
    regexGroup: 1
};

const derived2 = linelistService.deriveLineNo(componentName);
console.log(`Derived (Regex P...): ${derived2}`);

if (derived2 === 'P0511260') console.log("PASS");
else console.error("FAIL: Expected P0511260");


// --- Test 3: Auto-Map Headers ---
console.log("\n[Test 3] Auto-Map Headers");

// Mock Linelist State
const headers = ["Line Ref", "Design Pressure", "Temp", "Liquid Density", "Phase"];
setState("linelist", {
    headers: headers,
    rawRows: [], // Not needed for mapping
    smartMap: {} // Reset map
});

// Setup Keywords in Config
config.smartData.smartProcessKeywords = {
    Pressure: ["Design Pressure"],
    Temperature: ["Temp"],
    DensityLiquid: ["Liquid Density"],
    Phase: ["Phase"]
};

linelistService.autoMapHeaders(headers);
const map = getState("linelist").smartMap;

console.log("Mapped Headers:", map);

if (map.Pressure === "Design Pressure" && map.Temperature === "Temp" && map.LineRef === "Line Ref") {
    console.log("PASS");
} else {
    console.error("FAIL: Incorrect mapping");
}


// --- Test 4: Get Smart Attributes (Density Logic) ---
console.log("\n[Test 4] Get Smart Attributes (Density Logic)");

// Mock Data
const mockRows = [
    ["Header1", "Header2", "Header3", "Header4", "Header5"], // Header row (index 0)
    ["P0511260", "1500", "120", "950", "Liquid"] // Data row
];
setState("linelist", {
    ...getState("linelist"),
    rawRows: mockRows,
    headerRowIndex: 0
});

// Setup LineRef to point to col 0
config.smartData.densityLogic = { mixedPreference: "Liquid", defaultLiquid: 1000 };
// Re-run auto map to ensure state is fresh (using our previous manual mock)
// We need to make sure getData() returns correct object
// getData uses headers from state.
// Let's assume getData works correctly based on headers.

const attrs = linelistService.getSmartAttributes("P0511260");
console.log("Attributes:", attrs);

if (attrs.P1 === "1500" && attrs.T1 === "120" && attrs.Density === "950" && attrs.Phase === "Liquid") {
    console.log("PASS");
} else {
    console.error("FAIL: Attributes mismatch");
}


// --- Test 5: Material Integration ---
console.log("\n[Test 5] Material Service (Extraction & Resolution)");

// Mock Data Manager
dataManager.headerMap = {
    pipingclass: { class: "Class", wall: "Wall", corrosion: "Corr", material: "MatName" }
};
dataManager.pipingClassMaster = [
    { "Class": "11440A1", "Wall": "9.53", "Corr": "3.0", "MatName": "ASTM A-106 B" }
];
dataManager.materialMap = [
    { code: "106", desc: "A106-B" }
];

// Configure Extraction
config.smartData.pipingClassLogic = { strategy: 'token', tokenIndex: 3 };

const pipeClass = materialService.extractPipingClass(componentName);
console.log(`Extracted Class: ${pipeClass}`);

if (pipeClass === "11440A1") console.log("PASS: Extraction");
else console.error("FAIL: Extraction");

const matRes = materialService.resolveAttributes(pipeClass);
console.log("Resolved Material:", matRes);

if (matRes.materialCode === "106" && matRes.wallThickness === "9.53") {
    console.log("PASS: Resolution");
} else {
    console.error("FAIL: Resolution mismatch");
}

console.log("\n=== Tests Complete ===");
