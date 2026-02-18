import { dataManager } from './data-manager.js';
import { DEFAULT_CONFIG } from "../config/defaults.js";

/**
 * Material Service
 * Robust, configurable logic for Piping Class Extraction and Multi-Step Material Mapping.
 */
export class MaterialService {

    /**
     * Extracts Piping Class from Component Name using configurable strategy.
     * @param {string} compName
     * @returns {string|null}
     */
    extractPipingClass(compName) {
        if (!compName) return null;

        const logic = DEFAULT_CONFIG.lineDerivation?.pipingClass || {};

        // 1. Token Strategy
        if (logic.strategy === "token") {
            const delim = logic.delimiter || "-";
            const parts = compName.split(delim);
            const idx = logic.index !== undefined ? logic.index : 3;
            return parts[idx] ? parts[idx].trim() : null;
        }

        // 2. Regex Strategy
        if (logic.strategy === "regex" && logic.regex) {
            try {
                const re = new RegExp(logic.regex);
                const match = compName.match(re);
                if (match && match[1]) return match[1].trim();
            } catch (e) {
                console.warn("[MaterialService] Invalid Regex", e);
            }
        }

        return null;
    }

    /**
     * Parse material map text file (Code Description)
     */
    parseMaterialMap(text) {
        if (!text) return [];
        return text.split('\n')
            .map(l => {
                const p = l.trim().split(/\s+/);
                return p.length >= 2 ? { code: p[0], desc: p.slice(1).join(' ') } : null;
            })
            .filter(Boolean);
    }

    /**
     * Resolves material attributes via 3-step strict lookup.
     * 1. Class -> Master Row
     * 2. Row -> Material Name
     * 3. Material Name -> Code (via Map)
     * @param {string} pipingClass
     * @returns {Object} { materialCode, wallThickness, corrosion, materialName }
     */
    resolveAttributes(pipingClass) {
        const result = { materialCode: null, wallThickness: null, corrosion: null, materialName: null };
        if (!pipingClass) return result;

        // Get Data
        const master = dataManager.getPipingClassMaster(); // Array of row objects
        const matMap = dataManager.getMaterialMap(); // Array of {code, desc}

        if (!master || master.length === 0) return result;

        // Step 1: Lookup Piping Class in Master
        // We use dataManager's headerMap to know which column is "Piping Class"
        const classHeader = dataManager.headerMap?.pipingclass?.class || "Piping Class";

        // Exact match first
        let row = master.find(r => String(r[classHeader]).trim() === pipingClass);

        // Fallback: StartsWith (e.g. Class "11440A1" matches row "11440A1-01"?)
        // Or vice versa: Input "11440A1-01" matches row "11440A1"
        if (!row) {
            row = master.find(r => {
                const val = String(r[classHeader]).trim();
                return val.startsWith(pipingClass) || pipingClass.startsWith(val);
            });
        }

        if (!row) return result; // No class found

        // Step 2: Extract Attributes
        const wallHeader = dataManager.headerMap?.pipingclass?.wall || "Wall thickness";
        const corrHeader = dataManager.headerMap?.pipingclass?.corrosion || "Corrosion";
        const matHeader  = dataManager.headerMap?.pipingclass?.material || "Material_Name";

        result.wallThickness = row[wallHeader];
        result.corrosion = row[corrHeader];
        result.materialName = row[matHeader];

        // Step 3: Resolve Material Code from Name
        if (result.materialName && matMap.length > 0) {
            const searchName = result.materialName.toUpperCase().replace(/[\s-]/g, ''); // Normalize

            // Find best match in map
            // Heuristic: Map description should be contained in Master Name or vice versa
            const match = matMap.find(m => {
                const mapDesc = m.desc.toUpperCase().replace(/[\s-]/g, '');
                return searchName.includes(mapDesc) || mapDesc.includes(searchName);
            });

            if (match) {
                result.materialCode = match.code;
            }
        }

        return result;
    }
}

export const materialService = new MaterialService();
