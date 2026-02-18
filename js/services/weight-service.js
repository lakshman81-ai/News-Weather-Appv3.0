/**
 * js/services/weight-service.js
 * Manages Weight reference data and calculation logic.
 */
import { setState, getState } from "../state.js";
import { excelParser } from "./excel-parser.js";
import { detectRating } from "./rating-detector.js";

const LOG_PREFIX = "[WeightService]";

class WeightService {
    constructor() {
        this.initialState = {
            refData: [], // Array of rows from wtValveweights.xlsx
            config: {
                smartValveDetection: true
            }
        };
    }

    init() {
        const currentState = getState("weight");
        if (!currentState) {
            // Load config from localStorage
            let savedConfig = { smartValveDetection: true };
            try {
                const raw = localStorage.getItem("pcf_weight_config");
                if (raw) savedConfig = JSON.parse(raw);
            } catch (e) {
                console.warn("Failed to load weight config", e);
            }

            setState("weight", {
                ...this.initialState,
                config: savedConfig
            });
        }
    }

    /**
     * Load reference data from a file.
     * @param {File} file
     */
    async loadReferenceData(file) {
        console.info(`${LOG_PREFIX} Loading reference data from ${file.name}`);
        const data = await excelParser.parseExcelFile(file);

        const s = getState("weight");
        setState("weight", { ...s, refData: data });

        console.info(`${LOG_PREFIX} Loaded ${data.length} rows of reference data.`);
    }

    toggleSmartValve(enabled) {
        const s = getState("weight");
        const newConfig = { ...s.config, smartValveDetection: enabled };
        setState("weight", { ...s, config: newConfig });

        localStorage.setItem("pcf_weight_config", JSON.stringify(newConfig));
    }

    /**
     * Smart Rating Detection — delegated to shared rating-detector.js
     * Uses configurable pressureRatingMap from defaults.js.
     * @param {string} pipingClass e.g. "150LB", "300#", "A1-150"
     * @returns {number|null} Rating (150, 300, 600...) or null
     */
    detectRating(pipingClass) {
        return detectRating(pipingClass);
    }

    /**
     * Calculate Weight for a component.
     * Uses wtValveweights.xlsx structure:
     * Col 0: Type Code (G, C, B, SB)
     * Col 2: Size DN
     * Col 3: Weight (kg)
     * Col 6: Length (mm)
     * Col 8: Rating
     *
     * @param {Object} component PCF Component Object
     * @param {Object} linelistData Optional Linelist data for this component
     * @returns {number|null} Weight in KG
     */
    calculateWeight(component, linelistData) {
        const s = getState("weight");
        if (!s.refData || s.refData.length === 0) return null;

        // 1. Determine Rating
        // Try component attribute first (if available), then Linelist
        // The LinelistService maps data to PCF attributes.
        // So we should check if any mapped attribute looks like numeric rating or class.
        let rating = this.detectRating(component.attributes?.["RATING"]);
        if (!rating && linelistData) {
            // Check specific columns if they exist in the mapped data?
            // The linelist data passed here is the MAPPED object { ATTRIBUTE1: val, ... }
            // OR the raw object? It should be the combined object if we want to use mapped attributes.
            // BUT, we might also want to peek at raw columns if not mapped.
            // For now, assume linelistData is a raw or semi-processed object.
            // Let's assume it's the raw row object for flexibility, or we check for common keys.
            rating = this.detectRating(
                linelistData["RATING"] ||
                linelistData["CLASS"] ||
                linelistData["PIPING SYSTEM"] || // Often contains class
                Object.values(linelistData).find(v => typeof v === 'string' && (v.includes("150") || v.includes("300")))
            );
        }
        if (!rating) rating = 150; // Default fallback

        // 2. Determine Size (DN)
        // Component size is usually in MM (Bore)
        // Needs to handle cases where bore might be string or number
        // Ensure we have a valid numeric bore
        let sizeDN = component.bore1 || component.bore;
        if (!sizeDN && component.eps && component.eps.length > 0) {
            sizeDN = component.eps[0].bore;
        }
        if (!sizeDN) return null;

        // Round to nearest standard DN if needed?
        sizeDN = parseFloat(sizeDN);

        // 3. Determine Type & Length (for valves)
        const pcfType = component.type; // e.g. VALVE

        if (pcfType === "VALVE") {
            // Identify type by length if Smart Valve Detection is on
            if (s.config.smartValveDetection) {
                // Calculate length from endpoints
                // We need 3D distance between EP1 and EP2
                if (component.eps && component.eps.length >= 2) {
                    const p1 = component.eps[0];
                    const p2 = component.eps[1];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dz = p1.z - p2.z;
                    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    // Find best match in DB for this Size + Rating + Length
                    const weight = this._findValveWeight(sizeDN, rating, len);
                    if (weight !== null) return weight;
                }
            }
        }

        return null;
    }

    _findValveWeight(dn, rating, length) {
        const s = getState("weight");
        const TOLERANCE = 5.0; // mm allow some slack

        // Filter by Size and Rating
        // Row structure: [Type, SizeInch, SizeDN, Weight, ?, ?, Length, ?, Rating, ...]
        // Col 2: Size DN
        // Col 8: Rating
        // Col 6: Length
        // Col 3: Weight

        let bestMatch = null;
        let minDiff = Infinity;

        for (const row of s.refData) {
            // Skip header or empty rows
            if (!row || row.length < 9) continue;

            const rDN = parseFloat(row[2]);
            const rRating = parseFloat(row[8]);

            if (rDN === dn && rRating === rating) {
                const rLen = parseFloat(row[6]);
                const diff = Math.abs(rLen - length);

                if (diff < minDiff) {
                    minDiff = diff;
                    bestMatch = row;
                }
            }
        }

        if (bestMatch && minDiff <= TOLERANCE) {
            return parseFloat(bestMatch[3]); // Return Weight
        }

        return null;
    }
}

export const weightService = new WeightService();
