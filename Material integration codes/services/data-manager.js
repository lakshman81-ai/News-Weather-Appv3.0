import { gate } from "./gate-logger.js";
import { log } from "../logger.js";

const MOD = 'DataManager';

/**
 * Central Data Store for the Integration Module.
 * Manages State for Linelist, Weights, Piping Class, Material Map, and PCF Data.
 * Includes schema validation on all setters.
 */
export class DataManager {
    constructor() {
        this.linelistData = [];
        this.weightData = [];
        this.pipingClassMaster = [];
        this.materialMap = [];  // Array of {code, desc}
        this.pcfData = [];
        this.lineDumpData = [];

        // Default Header mappings (user configurable)
        this.headerMap = {
            linelist: {
                lineNo: 'Line Number',
                service: 'Service',
            },
            weights: {
                size: 'Size (Inch)',
                length: 'Length (RF-F/F)',
                description: 'Type Description',
                weight: 'Weight (kg)'
            },
            pipingclass: {
                size: 'Size',
                class: 'Piping Class',
                material: 'Material_Name',
                wall: 'Wall thickness',
                corrosion: 'Corrosion'
            }
        };

        // Dynamic Attribute Mappings
        this.attributeMap = {};

        // Change listeners (for index invalidation)
        this._onChangeCallbacks = [];
    }

    // ── Schema Validation ────────────────────────────────────────────

    /**
     * Validate rows against expected schema.
     * @param {Array} data - Array of row objects
     * @param {string[]} requiredKeys - Keys that must exist on each row
     * @param {string} source - Label for logging
     * @returns {{ valid: Array, rejected: number, warnings: string[] }}
     */
    _validateSchema(data, requiredKeys, source) {
        if (!Array.isArray(data)) {
            log('ERROR', MOD, '_validateSchema', `${source}: Expected array, got ${typeof data}`);
            return { valid: [], rejected: 0, warnings: [`${source}: Input is not an array`] };
        }

        const valid = [];
        const warnings = [];
        let rejected = 0;

        // Check if headers exist at all (first row)
        if (data.length > 0) {
            const firstRowKeys = Object.keys(data[0]);
            const missingHeaders = requiredKeys.filter(k =>
                !firstRowKeys.some(h => h.trim().toLowerCase() === k.trim().toLowerCase())
            );
            if (missingHeaders.length > 0) {
                warnings.push(`${source}: Missing expected columns: ${missingHeaders.join(', ')}`);
                log('WARN', MOD, '_validateSchema', `${source}: Missing columns`, { missingHeaders });
            }

            // Check for near-matches (whitespace issues)
            for (const required of requiredKeys) {
                const exactMatch = firstRowKeys.find(h => h === required);
                const fuzzyMatch = firstRowKeys.find(h => h.trim() === required && h !== required);
                if (!exactMatch && fuzzyMatch) {
                    warnings.push(`${source}: Column "${fuzzyMatch}" has extra whitespace (expected "${required}")`);
                    log('WARN', MOD, '_validateSchema', `${source}: Whitespace mismatch`, {
                        expected: required, actual: fuzzyMatch
                    });
                }
            }
        }

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (row == null || typeof row !== 'object') {
                rejected++;
                continue;
            }
            // Row must have at least 1 non-empty value
            const values = Object.values(row);
            const hasContent = values.some(v => v != null && String(v).trim() !== '');
            if (!hasContent) {
                rejected++;
                continue;
            }
            valid.push(row);
        }

        return { valid, rejected, warnings };
    }

    // ── Setters (with validation) ────────────────────────────────────

    setLinelist(data) {
        const requiredKeys = [this.headerMap.linelist.lineNo];
        const { valid, rejected, warnings } = this._validateSchema(data, requiredKeys, 'Linelist');

        this.linelistData = valid;
        this._notifyChange('linelist');

        gate(MOD, 'setLinelist', 'Linelist data loaded', {
            inputRows: data?.length ?? 0,
            validRows: valid.length,
            rejectedRows: rejected,
            warnings: warnings.length > 0 ? warnings : undefined,
            sampleHeaders: valid.length > 0 ? Object.keys(valid[0]) : []
        });
    }

    setWeights(data) {
        const requiredKeys = [this.headerMap.weights.size];
        const { valid, rejected, warnings } = this._validateSchema(data, requiredKeys, 'Weights');

        this.weightData = valid;
        this._notifyChange('weights');

        gate(MOD, 'setWeights', 'Weight data loaded', {
            inputRows: data?.length ?? 0,
            validRows: valid.length,
            rejectedRows: rejected,
            warnings: warnings.length > 0 ? warnings : undefined,
            sampleHeaders: valid.length > 0 ? Object.keys(valid[0]) : []
        });
    }

    setPipingClassMaster(data) {
        const requiredKeys = [this.headerMap.pipingclass.class];
        const { valid, rejected, warnings } = this._validateSchema(data, requiredKeys, 'PipingClassMaster');

        this.pipingClassMaster = valid;
        this._notifyChange('pipingclass');

        gate(MOD, 'setPipingClassMaster', 'Piping Class Master loaded', {
            inputRows: data?.length ?? 0,
            validRows: valid.length,
            rejectedRows: rejected,
            warnings: warnings.length > 0 ? warnings : undefined,
            sampleHeaders: valid.length > 0 ? Object.keys(valid[0]) : []
        });
    }

    setMaterialMap(data) {
        this.materialMap = Array.isArray(data) ? data : [];
        this._notifyChange('materialmap');

        gate(MOD, 'setMaterialMap', 'Material Map loaded', {
            entries: this.materialMap.length
        });
    }

    setPCF(data) {
        this.pcfData = data;
        this._notifyChange('pcf');
    }

    setLineDump(data) {
        const { valid, rejected } = this._validateSchema(
            data, [], 'LineDump'
        );
        this.lineDumpData = valid;
        this._notifyChange('linedump');

        const uniqueLines = new Set(this.lineDumpData.map(r => r['Line No. (Derived)']).filter(Boolean));
        gate(MOD, 'setLineDump', 'LineDump data loaded', {
            inputRows: data?.length ?? 0,
            validRows: valid.length,
            rejectedRows: rejected,
            derivedLineNosCount: uniqueLines.size
        });
    }

    // ── Getters ──────────────────────────────────────────────────────

    getLinelist() { return this.linelistData; }
    getWeights() { return this.weightData; }
    getPipingClassMaster() { return this.pipingClassMaster; }
    getMaterialMap() { return this.materialMap; }
    getPCF() { return this.pcfData; }
    getLineDump() { return this.lineDumpData; }

    // ── Header Map ───────────────────────────────────────────────────

    updateHeaderMap(type, newMap) {
        if (this.headerMap[type]) {
            this.headerMap[type] = { ...this.headerMap[type], ...newMap };
            this._notifyChange(type);
        }
    }

    // ── Attribute Mappings ───────────────────────────────────────────

    setAttributeMapping(sourceCol, targetAttr) {
        this.attributeMap[sourceCol] = targetAttr;
    }

    removeAttributeMapping(sourceCol) {
        delete this.attributeMap[sourceCol];
    }

    // ── Change Notification ──────────────────────────────────────────

    /**
     * Register a callback for data changes.
     * Used by MappingEngine to invalidate indexes.
     */
    onChange(callback) {
        this._onChangeCallbacks.push(callback);
    }

    _notifyChange(dataType) {
        for (const cb of this._onChangeCallbacks) {
            try { cb(dataType); } catch (_) { /* swallow */ }
        }
    }

    // ── Reset ────────────────────────────────────────────────────────

    reset() {
        this.linelistData = [];
        this.weightData = [];
        this.pipingClassMaster = [];
        this.materialMap = [];
        this.pcfData = [];
        this.lineDumpData = [];
        this.attributeMap = {};
        this._notifyChange('reset');
    }
}

export const dataManager = new DataManager();
