/**
 * js/services/linelist-service.js
 * Manages Linelist data state, smart mapping, and attribute derivation.
 * Rewrite: v3 with Robust Fallback Lookup (Composite + Simple)
 */
import { setState, getState } from "../state.js";
import { getConfig } from "../config/config-store.js";

const LOG_PREFIX = "[LinelistService]";

class LinelistService {
    constructor() {
        this.initialState = {
            filename: "",
            rawRows: [],
            headerRowIndex: 0,
            headers: [],

            // Generic mapping { "Linelist Col": "PCF Attr" }
            mapping: {},
            keys: {          // Columns used for joining
                serviceCol: "",
                sequenceCol: ""
            },

            // Smart Mapping: specific columns we care about for PCF injection
            smartMap: {
                LineRef: null, // The column containing the Line Number
                Pressure: null,
                Temperature: null,
                InsulationThickness: null,
                HydroTestPressure: null,
                PipingClass: null,
                DensityGas: null,
                DensityLiquid: null,
                DensityMixed: null,
                Phase: null
            },

            // Options
            smartOptions: {
                densityMixedPreference: "Liquid"
            }
        };

        // Runtime Cache for Indexes
        this._compositeMap = null;
        this._simpleMap = null;
        this._cacheVersion = -1;
    }

    init() {
        const currentState = getState("linelist");
        if (!currentState) {
            let saved = {};
            try {
                const raw = localStorage.getItem("pcf_linelist_config");
                if (raw) saved = JSON.parse(raw);
            } catch (e) { console.warn("Failed to load linelist config", e); }

            setState("linelist", {
                ...this.initialState,
                ...saved,
                mapping: saved.mapping || {},
                keys: saved.keys || { serviceCol: "", sequenceCol: "" },
                headers: saved.headers || [],
                smartMap: { ...this.initialState.smartMap, ...(saved.smartMap || {}) }
            });
        }
    }

    reset() {
        setState("linelist", { ...this.initialState });
        this._invalidateCache();
        localStorage.removeItem("pcf_linelist_config");
    }

    _invalidateCache() {
        this._compositeMap = null;
        this._simpleMap = null;
    }

    processRawData(filename, rawRows) {
        console.info(`${LOG_PREFIX} Processing file: ${filename} with ${rawRows.length} rows.`);
        const headerRowIndex = this.detectHeaderRow(rawRows);
        const headers = rawRows[headerRowIndex]?.map(String) || [];

        const currentState = getState("linelist") || {};
        setState("linelist", {
            ...currentState,
            filename,
            rawRows,
            headerRowIndex,
            headers
        });

        this._invalidateCache();

        // Trigger Auto-Map immediately after processing
        this.autoMapHeaders(headers);
        this._saveConfig();
    }

    detectHeaderRow(rows) {
        // Simple heuristic: Row with most "keywords"
        const KEYWORDS = ["LINE", "SERVICE", "PID", "PRESSURE", "TEMP", "CLASS", "PIPING", "SPEC", "UNIT"];
        const MAX_SCAN = Math.min(rows.length, 25);
        let bestIdx = 0;
        let bestScore = -1;

        for (let i = 0; i < MAX_SCAN; i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;
            let score = 0;
            row.forEach(cell => {
                if (cell && KEYWORDS.some(k => String(cell).toUpperCase().includes(k))) score++;
            });
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    getData() {
        const state = getState("linelist");
        if (!state || !state.rawRows.length) return [];
        const { rawRows, headerRowIndex, headers } = state;
        const dataRows = [];
        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;
            const rowObj = {};
            headers.forEach((h, colIdx) => {
                if (h) rowObj[h] = row[colIdx];
            });
            dataRows.push(rowObj);
        }
        return dataRows;
    }

    /**
     * Build Lookup Maps (Composite and Simple)
     * Lazy loading with caching.
     */
    _buildLookupMaps() {
        const state = getState("linelist");
        if (!state || !state.rawRows) return;

        // Check if cache is valid
        if (this._compositeMap && this._simpleMap) return;

        console.info(`${LOG_PREFIX} Building lookup indexes...`);
        const composite = new Map();
        const simple = new Map();

        const { keys, smartMap } = state;
        const data = this.getData();

        // Key Columns
        const serviceKey = keys.serviceCol;
        const seqKey = keys.sequenceCol;

        // Fallback Key: Use SmartMap "LineRef" if Sequence col not explicitly mapped
        const lineRefKey = smartMap.LineRef;

        data.forEach(row => {
            // 1. Composite Key: Service + Sequence
            if (serviceKey && seqKey) {
                const sVal = String(row[serviceKey] || "").trim();
                const qVal = String(row[seqKey] || "").trim();
                if (sVal && qVal) {
                    composite.set(`${sVal}-${qVal}`, row);
                }
            }

            // 2. Simple Key: Line No / Sequence / LineRef
            const lineVal = row[seqKey] || row[lineRefKey];
            if (lineVal) {
                const cleanLine = String(lineVal).trim();
                if (cleanLine && !simple.has(cleanLine)) {
                    simple.set(cleanLine, row);
                }
            }
        });

        this._compositeMap = composite;
        this._simpleMap = simple;
        console.info(`${LOG_PREFIX} Indexes built. Composite: ${composite.size}, Simple: ${simple.size}`);
    }

    /**
     * Derive Line Number from a Component Name
     */
    deriveLineNo(componentName) {
        if (!componentName) return null;

        const config = getConfig();
        const logic = config.smartData?.lineNoLogic || {};
        const strategy = logic.strategy || 'token';

        let derived = null;

        if (strategy === 'token') {
            const delim = logic.tokenDelimiter || '-';
            const idx = logic.tokenIndex ?? 2;
            const parts = componentName.split(delim);
            if (parts.length > idx) derived = parts[idx];
        } else if (strategy === 'regex') {
            const pattern = logic.regexPattern;
            if (pattern) {
                try {
                    const re = new RegExp(pattern);
                    const match = componentName.match(re);
                    const group = logic.regexGroup || 1;
                    if (match && match[group]) derived = match[group];
                } catch (e) {
                    console.warn(`${LOG_PREFIX} Invalid Regex`, e);
                }
            }
        }

        return derived ? derived.trim() : null;
    }

    autoMapHeaders(headers) {
        if (!headers) headers = getState("linelist").headers;
        if (!headers || !headers.length) return;

        const config = getConfig();
        const keywords = config.smartData?.smartProcessKeywords || {};
        const currentMap = getState("linelist").smartMap;
        const newMap = { ...currentMap };

        const findHeader = (tags) => {
            if (!tags) return null;
            for (const tag of tags) {
                const exact = headers.find(h => h.toUpperCase() === tag.toUpperCase());
                if (exact) return exact;
            }
            for (const tag of tags) {
                const fuzzy = headers.find(h => h.toUpperCase().includes(tag.toUpperCase()));
                if (fuzzy) return fuzzy;
            }
            return null;
        };

        if (!newMap.Pressure) newMap.Pressure = findHeader(keywords.Pressure);
        if (!newMap.Temperature) newMap.Temperature = findHeader(keywords.Temperature);
        if (!newMap.InsulationThickness) newMap.InsulationThickness = findHeader(keywords.InsulationThickness);
        if (!newMap.HydroTestPressure) newMap.HydroTestPressure = findHeader(keywords.HydroTestPressure);

        if (!newMap.DensityGas) newMap.DensityGas = findHeader(keywords.DensityGas);
        if (!newMap.DensityLiquid) newMap.DensityLiquid = findHeader(keywords.DensityLiquid);
        if (!newMap.DensityMixed) newMap.DensityMixed = findHeader(keywords.DensityMixed);
        if (!newMap.Phase) newMap.Phase = findHeader(keywords.Phase);

        const lineKeywords = ["Line No", "Line Number", "ISO", "Line Ref", "Line", "Pipeline Ref"];
        if (!newMap.LineRef) newMap.LineRef = findHeader(lineKeywords);

        setState("linelist", {
            ...getState("linelist"),
            smartMap: newMap
        });

        // Also try to auto-map Keys if empty
        const currentKeys = getState("linelist").keys || {};
        if (!currentKeys.serviceCol) {
            const sCol = findHeader(["Service", "System"]);
            if (sCol) this.updateKeys({ ...currentKeys, serviceCol: sCol });
        }
        if (!currentKeys.sequenceCol && newMap.LineRef) {
             this.updateKeys({ ...currentKeys, sequenceCol: newMap.LineRef });
        }
    }

    updateKeys(keys) {
        const s = getState("linelist");
        setState("linelist", { ...s, keys });
        this._invalidateCache(); // Keys changed, rebuild index
        this._saveConfig();
    }

    /**
     * Find matching Linelist row with Robust Fallback.
     * @param {Object} primary Input object
     * @param {Object} primary.raw Raw input data
     * @returns {Object|null} Matched row object or null
     */
    findMatchedRow(primary) {
        if (!primary || !primary.raw) return null;

        this._buildLookupMaps();

        const pRaw = primary.raw;
        // Normalize Inputs - check standard CSV fields for Line No info
        // Often 'RefNo' or 'componentName' or specific columns like 'LineNo'
        const sVal = String(pRaw['Service'] || pRaw['SERVICE'] || pRaw['service'] || "").trim();

        // Try to get LineNo from the derived logic or raw fields
        // Usually the caller (ca-builder) might pass the Derived Line No directly?
        // No, typically we pass the component data and let the service derive or lookup.
        // Wait, ca-builder calls this. But ca-builder has access to the full component.
        // Let's assume primary.raw has what we need.

        // BETTER STRATEGY: Use deriveLineNo on the component name first!
        // But `primary.raw` is the CSV row.
        // In PCF input, we have `componentName` or `RefNo`.

        const compName = pRaw['componentName'] || pRaw['RefNo'] || "";
        const derivedLine = this.deriveLineNo(compName);

        // Also check explicit columns if they exist in the input CSV (unlikely for PCF, but possible)
        const lVal = derivedLine || String(pRaw['LineNo'] || pRaw['LINENO'] || "").trim();

        let match = null;

        // 1. Try Composite Key
        if (sVal && lVal && this._compositeMap) {
            const key = `${sVal}-${lVal}`;
            match = this._compositeMap.get(key);
        }

        // 2. Fallback: Simple Key
        if (!match && lVal && this._simpleMap) {
            match = this._simpleMap.get(lVal);
        }

        return match || null;
    }

    /**
     * Retrieve Smart Attributes.
     * @param {string|Object} query LineNo string OR Query object { raw: ... }
     */
    getSmartAttributes(query) {
        const result = {
            P1: null, T1: null, InsThk: null, HP: null,
            Density: null, Phase: null, Found: false,
            Row: null
        };

        let row = null;

        if (typeof query === 'string') {
            this._buildLookupMaps();
            row = this._simpleMap ? this._simpleMap.get(query.trim()) : null;
        } else if (typeof query === 'object') {
            row = this.findMatchedRow(query);
        }

        if (!row) return result;

        result.Found = true;
        result.Row = row;

        const map = getState("linelist").smartMap;

        // Extract Basic Attributes
        if (map.Pressure) result.P1 = row[map.Pressure];
        if (map.Temperature) result.T1 = row[map.Temperature];
        if (map.InsulationThickness) result.InsThk = row[map.InsulationThickness];
        if (map.HydroTestPressure) result.HP = row[map.HydroTestPressure];

        // Density / Phase Logic
        const config = getConfig();
        const densityLogic = config.smartData?.densityLogic || {};

        let phase = map.Phase ? row[map.Phase] : null;
        result.Phase = phase;

        let dGas = map.DensityGas ? row[map.DensityGas] : null;
        let dLiq = map.DensityLiquid ? row[map.DensityLiquid] : null;
        let dMix = map.DensityMixed ? row[map.DensityMixed] : null;

        let selectedDensity = null;
        const phaseStr = String(phase || "").toUpperCase();

        if (phaseStr.startsWith("G")) {
            selectedDensity = dGas;
        } else if (phaseStr.startsWith("M")) {
            const pref = densityLogic.mixedPreference || "Liquid";
            selectedDensity = (pref === "Mixed") ? (dMix || dLiq) : (dLiq || dMix);
        } else {
            selectedDensity = dLiq;
        }

        if (selectedDensity == null || selectedDensity === "") {
             if (phaseStr.startsWith("G")) selectedDensity = densityLogic.defaultGas;
             else selectedDensity = densityLogic.defaultLiquid;
        }

        result.Density = selectedDensity;

        return result;
    }

    updateSmartMapping(key, value) {
        const s = getState("linelist");
        const smartMapping = { ...s.smartMap, [key]: value };
        setState("linelist", { ...s, smartMap: smartMapping });
        this._invalidateCache();
        this._saveConfig();
    }

    updateSmartOptions(key, value) {
        const s = getState("linelist");
        const smartOptions = { ...s.smartOptions, [key]: value };
        setState("linelist", { ...s, smartOptions });
        this._saveConfig();
    }

    _saveConfig() {
        const state = getState("linelist");
        localStorage.setItem("pcf_linelist_config", JSON.stringify({
            smartMap: state.smartMap,
            keys: state.keys,
            smartOptions: state.smartOptions,
            headers: state.headers
        }));
    }
}

export const linelistService = new LinelistService();
