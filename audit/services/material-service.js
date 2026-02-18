import { dataManager } from './data-manager.js';
import { getConfig } from "../config/config-store.js";

/**
 * Material Service (v2)
 * Encapsulates logic for Piping Class Extraction and Strict Attribute Resolution.
 * Supports Configurable Extraction Strategies (Token/Regex).
 */
export class MaterialService {

    /**
     * Extracts Piping Class from the Component Name using configured strategy.
     * Default: Token-based (4th token split by '-').
     * @param {string} componentName e.g. "FCSEE-16\"-P0511260-11440A1-01"
     * @returns {string|null} e.g. "11440A1"
     */
    extractPipingClass(componentName) {
        if (!componentName) return null;

        const config = getConfig();
        const logic = config.smartData?.pipingClassLogic || {};
        const strategy = logic.strategy || 'token';

        let extracted = null;

        if (strategy === 'token') {
            const delim = logic.tokenDelimiter || '-';
            const idx = logic.tokenIndex ?? 3; // Default 3 (4th part)
            const parts = componentName.split(delim);
            if (parts.length > idx) extracted = parts[idx];
        } else if (strategy === 'regex') {
            const pattern = logic.regexPattern;
            if (pattern) {
                try {
                    const re = new RegExp(pattern);
                    const match = componentName.match(re);
                    const group = logic.regexGroup || 1;
                    if (match && match[group]) extracted = match[group];
                } catch (e) {
                    console.warn("Invalid Piping Class Regex", e);
                }
            }
        }

        return extracted ? extracted.trim() : null;
    }

    /**
     * Parses the PCF Material Map text file.
     * Format: Code Description (space/tab separated)
     * e.g. "106 A106-B"
     * @param {string} text
     * @returns {Array} [{code: "106", desc: "A106-B"}]
     */
    parseMaterialMap(text) {
        const lines = text.split('\n');
        return lines.map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 2) return null;
            return {
                code: parts[0],
                desc: parts.slice(1).join(' ')
            };
        }).filter(x => x);
    }

    /**
     * Strict 3-Step Lookup: Piping Class -> Material Name -> Material Code
     * 1. Find Entry in Piping Class Master (Exact -> StartsWith)
     * 2. Get Material Name (e.g. "ASTM A-106 B")
     * 3. Fuzzy Match against Material Map -> Material Code (e.g. "106")
     * @param {string} pipingClass Extracted class e.g. "11440A1"
     * @returns {Object} { materialCode, wallThickness, corrosion }
     */
    resolveAttributes(pipingClass) {
        const result = {
            materialCode: null, // CA3
            wallThickness: null, // CA4
            corrosion: null     // CA7
        };

        if (!pipingClass) return result;

        const master = dataManager.getPipingClassMaster();
        const matMap = dataManager.getMaterialMap();

        if (!master || master.length === 0) return result;

        // 1. Find Entry in Piping Class Master
        // Use configured column name or default 'Piping Class'
        // Access via dataManager.headerMap which might be initialized from Excel import
        const classCol = dataManager.headerMap?.pipingclass?.class || 'Piping Class';

        // Strict: Exact Match First
        let match = master.find(row => String(row[classCol]).trim() === pipingClass);

        // Fallback: StartsWith (common due to suffixes like "-01")
        if (!match) {
            match = master.find(row => {
                const val = String(row[classCol]).trim();
                return pipingClass.startsWith(val) || val.startsWith(pipingClass);
            });
        }

        if (match) {
            // 2. Extract Details from Master Row
            const wallCol = dataManager.headerMap?.pipingclass?.wall || 'Wall thickness';
            const corrCol = dataManager.headerMap?.pipingclass?.corrosion || 'Corrosion';
            const matNameCol = dataManager.headerMap?.pipingclass?.material || 'Material_Name';

            result.wallThickness = match[wallCol];
            result.corrosion = match[corrCol];

            const materialName = match[matNameCol]; // e.g. "ASTM A-106 B"

            // 3. Smart Match with Material Map -> Code
            if (materialName && matMap.length > 0) {
                // Normalize: remove spaces, dashes, case-insensitive
                const normMatName = materialName.replace(/[\s-]/g, '').toUpperCase();

                // Find best match in map
                const bestMat = matMap.find(m => {
                    const normDesc = m.desc.replace(/[\s-]/g, '').toUpperCase();
                    // Check if Material Name contains Description or vice-versa
                    return normMatName.includes(normDesc) || normDesc.includes(normMatName);
                });

                if (bestMat) {
                    result.materialCode = bestMat.code;
                }
            }
        }

        return result;
    }
}

export const materialService = new MaterialService();
