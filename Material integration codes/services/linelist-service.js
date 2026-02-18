/**
 * js/services/linelist-service.js
 * Manages Linelist data state, auto-mapping, and smart attribute lookup.
 * Robust implementation with configurable derivation strategies.
 */
import { setState, getState } from "../state.js";
import { DEFAULT_CONFIG } from "../config/defaults.js";

const LOG_PREFIX = "[LinelistService]";

class LinelistService {
    constructor() {
        this.initialState = {
            filename: "",
            rawRows: [],
            headerRowIndex: 0,
            headers: [],
            mapping: {}, // "Linelist Col" -> "PCF Attr"
            keys: { serviceCol: "", sequenceCol: "" },
            // Smart Mapping Config: Which Linelist column maps to which concept
            smartMapping: {
                P1: "", T1: "", InsThk: "", HP: "",
                LineRef: "", PipingClass: "",
                DensityGas: "", DensityLiq: "", DensityMixed: "", Phase: ""
            },
            smartOptions: {
                densityMixedPreference: "Liquid" // "Liquid", "Gas", or "Max"
            }
        };
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
                mapping: saved.mapping || {},
                keys: saved.keys || { serviceCol: "", sequenceCol: "" },
                headers: saved.headers || [],
                smartMapping: { ...this.initialState.smartMapping, ...(saved.smartMapping || {}) },
                smartOptions: { ...this.initialState.smartOptions, ...(saved.smartOptions || {}) }
            });
        }
    }

    reset() {
        setState("linelist", { ...this.initialState });
        localStorage.removeItem("pcf_linelist_config");
    }

    /**
     * Process raw Excel data: Detect header, Auto-map smart columns.
     */
    processRawData(filename, rawRows) {
        console.info(`${LOG_PREFIX} Processing file: ${filename} (${rawRows.length} rows)`);
        const headerRowIndex = this.detectHeaderRow(rawRows);
        const headers = rawRows[headerRowIndex]?.map(String) || [];

        // Auto-detect smart mapping
        const smartMapping = this.autoMapHeaders(headers);

        const currentState = getState("linelist") || {};
        setState("linelist", {
            ...currentState,
            filename,
            rawRows,
            headerRowIndex,
            headers,
            smartMapping: { ...currentState.smartMapping, ...smartMapping } // Merge with existing or overwrite
        });

        this._saveConfig();
        console.info(`${LOG_PREFIX} Header detected at row ${headerRowIndex}. Smart Mapping updated.`);
    }

    detectHeaderRow(rows) {
        const MAX_SCAN = Math.min(rows.length, 25);
        // Keywords that strongly suggest a header row
        const KEYWORDS = [
            "LINE", "SERVICE", "PID", "PRESSURE", "TEMP",
            "CLASS", "PIPING", "SPEC", "UNIT", "AREA", "DENSITY"
        ];

        let bestIndex = 0;
        let maxScore = -1;

        for (let i = 0; i < MAX_SCAN; i++) {
            const row = rows[i];
            if (!Array.isArray(row) || row.length === 0) continue;

            let score = 0;
            let nonEmpty = 0;
            row.forEach(cell => {
                if (cell) {
                    nonEmpty++;
                    const s = String(cell).toUpperCase();
                    if (KEYWORDS.some(k => s.includes(k))) score += 3;
                }
            });
            // Prefer rows with more non-empty columns
            score += nonEmpty * 0.5;

            if (score > maxScore) {
                maxScore = score;
                bestIndex = i;
            }
        }
        return bestIndex;
    }

    /**
     * Auto-map headers to smart keys based on DEFAULT_CONFIG keywords
     */
    autoMapHeaders(headers) {
        const map = {};
        const smartKw = DEFAULT_CONFIG.smartKeywords || {};

        // Helper: Find best matching header for a list of keywords
        const findMatch = (keywords) => {
            if (!keywords) return "";
            for (const kw of keywords) {
                // Exact match (case insensitive)
                const exact = headers.find(h => h.toUpperCase() === kw.toUpperCase());
                if (exact) return exact;
                // Partial match
                const partial = headers.find(h => h.toUpperCase().includes(kw.toUpperCase()));
                if (partial) return partial;
            }
            return "";
        };

        // Iterate all smart keys (P1, T1, LineRef, etc.)
        for (const [key, keywords] of Object.entries(smartKw)) {
            map[key] = findMatch(keywords);
        }
        return map;
    }

    /**
     * Derive Line No from a Component Name string based on config.
     * @param {string} compName - e.g. "FCSEE-16"-P0511260-11440A1-01"
     * @param {object} customConfig - Optional override for derivation logic
     * @returns {string} - e.g. "P0511260"
     */
    deriveLineNo(compName, customConfig = null) {
        if (!compName) return "";
        const logic = customConfig || DEFAULT_CONFIG.lineDerivation?.lineNo || {};

        // 1. Token Strategy
        if (logic.strategy === "token") {
            const delim = logic.delimiter || "-";
            const parts = compName.split(delim);
            const idx = logic.index !== undefined ? logic.index : 2;
            if (parts[idx]) return parts[idx].trim();
        }
        // 2. Regex Strategy
        else if (logic.strategy === "regex" && logic.regex) {
            try {
                const re = new RegExp(logic.regex);
                const match = compName.match(re);
                if (match && match[1]) return match[1].trim();
            } catch (e) {
                console.warn(`${LOG_PREFIX} Invalid Regex: ${logic.regex}`, e);
            }
        }

        return "";
    }

    /**
     * Get lookup map for fast retrieval.
     * Key is derived Line Number.
     */
    getLookupMap() {
        if (this._cachedMap) return this._cachedMap;

        const state = getState("linelist");
        const { rawRows, headerRowIndex, headers, smartMapping } = state;
        const lineCol = smartMapping.LineRef; // The Linelist column holding Line No

        if (!lineCol) return new Map();

        const lineColIdx = headers.indexOf(lineCol);
        if (lineColIdx === -1) return new Map();

        const map = new Map();
        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row) continue;

            const lineVal = String(row[lineColIdx] || "").trim();
            if (lineVal) {
                // Map lineNo -> Row Object
                const rowObj = {};
                headers.forEach((h, idx) => { if(h) rowObj[h] = row[idx]; });
                map.set(lineVal, rowObj);
            }
        }
        this._cachedMap = map;
        return map;
    }

    invalidateCache() {
        this._cachedMap = null;
    }

    /**
     * Retrieve all smart attributes for a given component.
     * 1. Derives Line No from component name.
     * 2. Looks up row in Linelist.
     * 3. Maps attributes (P1, T1, Density) based on smartMapping.
     * @param {string} compName - "FCSEE-16"-P0511260..."
     * @returns {object} { P1, T1, InsThk, HP, Density, Phase, LineNo }
     */
    getSmartAttributes(compName) {
        const defaults = { P1: null, T1: null, InsThk: null, HP: null, Density: null, Phase: "Unknown", LineNo: null };
        if (!compName) return defaults;

        // 1. Derive Line No
        const lineNo = this.deriveLineNo(compName);
        if (!lineNo) return defaults;

        // 2. Lookup Row
        const map = this.getLookupMap();
        const row = map.get(lineNo);
        if (!row) return { ...defaults, LineNo: lineNo };

        const sm = getState("linelist").smartMapping;
        const opts = getState("linelist").smartOptions;

        // 3. Extract Values
        const result = {
            LineNo: lineNo,
            P1: row[sm.P1],
            T1: row[sm.T1],
            InsThk: row[sm.InsThk],
            HP: row[sm.HP],
            Phase: row[sm.Phase] || "Unknown",
            Density: null
        };

        // 4. Resolve Density Logic
        const rhoGas = parseFloat(row[sm.DensityGas] || 0);
        const rhoLiq = parseFloat(row[sm.DensityLiq] || 0);
        const rhoMix = parseFloat(row[sm.DensityMixed] || 0);
        const phase = String(result.Phase).toUpperCase();

        if (phase.includes("GAS") || phase.includes("VAP")) {
            result.Density = rhoGas;
        } else if (phase.includes("LIQ")) {
            result.Density = rhoLiq;
        } else if (phase.includes("MIX") || phase.includes("2")) {
            // Mixed logic
            if (opts.densityMixedPreference === "Gas") result.Density = rhoGas;
            else if (opts.densityMixedPreference === "Max") result.Density = Math.max(rhoLiq, rhoGas);
            else result.Density = rhoLiq; // Default to Liquid for safety (higher weight)
        } else {
            // Fallback if Phase unknown: Use Liquid if available, else Gas
            result.Density = rhoLiq || rhoGas;
        }

        return result;
    }

    _saveConfig() {
        const state = getState("linelist");
        this.invalidateCache();
        localStorage.setItem("pcf_linelist_config", JSON.stringify({
            mapping: state.mapping,
            keys: state.keys,
            headers: state.headers,
            smartMapping: state.smartMapping,
            smartOptions: state.smartOptions
        }));
    }

    // UI Helpers for updating state
    updateSmartMapping(key, val) {
        const s = getState("linelist");
        const sm = { ...s.smartMapping, [key]: val };
        setState("linelist", { ...s, smartMapping: sm });
        this._saveConfig();
    }
}

export const linelistService = new LinelistService();
