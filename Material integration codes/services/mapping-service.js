import { dataManager } from "./data-manager.js";

const MOD = "MappingService";

export class MappingService {

    /**
     * Resolve Rigid Type and Weight based on NB and Length.
     * Logic:
     * 1. Match NB (Weight Master 'size' vs Input 'nb')
     * 2. Match Length (Weight Master 'length' vs Input 'length') with tolerance +-6mm
     * Returns { rigidType: "TYPE DESC", weight: "Weight (kg)" }
     */
    resolveRigidType(nb, length, tolerance = 6.0) {
        const weights = dataManager.getWeights(); // Access raw weight data
        const map = dataManager.headerMap.weights;

        // Ensure we have necessary columns mapped
        if (!map.size || !map.length) return { rigidType: "", weight: "" };

        // 1. Filter by NB
        const candidates = weights.filter(row => {
            const rowNB = parseFloat(row[map.size]);
            return Math.abs(rowNB - nb) < 0.1; // Simple float compare
        });

        // 2. Filter by Length with best match tracking
        let bestMatch = null;
        let minDiff = Infinity;

        for (const row of candidates) {
            const rowLen = parseFloat(row[map.length]);
            if (isNaN(rowLen)) continue;
            const diff = Math.abs(rowLen - length);
            if (diff <= tolerance && diff < minDiff) {
                minDiff = diff;
                bestMatch = row;
            }
        }

        if (bestMatch) {
            return {
                rigidType: bestMatch[map.description] || "",
                weight: bestMatch[map.weight] || "",
                _diff: minDiff  // for diagnostic logging
            };
        }

        return { rigidType: "", weight: "" };
    }

    /**
     * Resolve Material and Wall based on NB and Piping Class.
     * Logic:
     * 1. Match NB
     * 2. Match Class (Exact)
     * 3. Fallback: Trim last char of Class + '*'
     * 4. Fallback: Trim last 2 chars + '**' (Prompt said "replace it with star*")
     * Returns { material: "Material_Name", wall: "Wall thickness" }
     */
    resolveMaterial(nb, pipingClass) {
        const pclassData = dataManager.getPipingClassMaster();
        const map = dataManager.headerMap.pipingclass;

        if (!map.size || !map.class) return { material: "", wall: "" };

        // 1. Filter by NB
        const candidates = pclassData.filter(row => {
            const rowNB = parseFloat(row[map.size]);
            return Math.abs(rowNB - nb) < 0.1;
        });

        if (candidates.length === 0) return { material: "", wall: "" };

        // Helper to match class
        const tryMatch = (targetClass) => {
            return candidates.find(row => {
                const rowClass = String(row[map.class] || "").trim();
                return rowClass === targetClass;
            });
        };

        const cleanClass = String(pipingClass || "").trim();

        // 2. Exact Match (Level 1)
        let match = tryMatch(cleanClass);
        let level = 0;

        if (match) {
            level = 1;
        }
        // 3. Level 2: Trim 1 char + '*'
        else if (!match && cleanClass.length > 1) {
            const pattern = cleanClass.slice(0, -1) + '*';
            match = tryMatch(pattern);
            if (match) level = 2;
        }
        // 4. Level 3: Trim 2 chars + '*'
        else if (!match && cleanClass.length > 2) {
            const pattern = cleanClass.slice(0, -2) + '*';
            match = tryMatch(pattern);
            if (match) level = 3;
        }

        if (match) {
            return {
                material: match[map.material] || "",
                wall: match[map.wall] || "",
                _level: level  // for diagnostic logging (1=exact, 2=trim1, 3=trim2)
            };
        }

        return { material: "", wall: "" };
    }
}

export const mappingService = new MappingService();
