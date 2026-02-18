/**
 * ca-builder.js — Build COMPONENT-ATTRIBUTE lines from config.caDefinitions
 * Driven entirely by config — no hardcoded slot names or values.
 *
 * Exports:
 *   buildCABlock(pts, pcfType, config)       → string[]
 *   buildCALine(slot, value, unit, indent)   → string
 */

import { gate } from "../services/gate-logger.js";
import { warn } from '../logger.js';
import { fmtValue } from '../geometry/coord-engine.js';

import { linelistService } from '../services/linelist-service.js';
import { dataManager } from '../services/data-manager.js';
import { materialService } from '../services/material-service.js';
import { getState } from '../state.js';

const MOD = 'ca-builder';
const INDENT = '    '; // 4 spaces per PCF spec

/**
 * Determine if a CA slot should be written for a given PCF component type.
 * @param {object} caDef     - config.caDefinitions[slot]
 * @param {string} pcfType   - e.g. 'PIPE', 'FLANGE', 'SUPPORT'
 * @returns {boolean}
 */
const _shouldWrite = (caDef, pcfType) => {
  if (!caDef?.writeOn) return false;
  if (caDef.writeOn === 'all-except-support') return pcfType !== 'SUPPORT';
  if (Array.isArray(caDef.writeOn)) return caDef.writeOn.includes(pcfType);
  if (caDef.writeOn === 'all') return true;
  if (caDef.writeOn === 'none') return false;
  return false;
};

/**
 * Resolve the value to write for a CA slot.
 * Handles: zeroValue override, null → default, numeric formatting.
 * @param {string}  slot    - e.g. 'CA1'
 * @param {object}  primary - primary point data from pts
 * @param {object}  caDef
 * @returns {string}  formatted value string (no unit)
 */
const _resolveValue = (slot, primary, caDef) => {
  // Get raw value from primary point data
  let raw = null;
  if (caDef.csvField && primary) {
    const fieldMap = {
      'Pressure': primary.pressure,
      'Material': primary.material,
      'Wall Thickness': primary.wall,
      'Corrosion Allowance': primary.corr,
      'Insulation thickness': primary.insul,
      'Weight': primary.weight,
      'Hydro test pressure': primary.hydro,
    };
    raw = fieldMap[caDef.csvField] ?? null;
  }

  // If no CSV data, return PLACEHOLDER instead of default
  // Popup will detect and replace with actual defaults in red
  const hasRawData = (raw !== null && raw !== undefined && raw !== '');
  if (!hasRawData) {
    // Return placeholder: 0 for numeric, Undefined for text
    return caDef.unit === null ? 'Undefined' : '0';
  }

  const value = raw;

  // Apply zeroValue override (e.g. 0 → "Undefined MM" for CA4)
  if (caDef.zeroValue !== null && caDef.zeroValue !== undefined) {
    const numVal = typeof value === 'number' ? value : parseFloat(value);
    if (!isNaN(numVal) && numVal === 0) return null; // signal to write zeroValue directly
  }

  // CA3 (Material) — no numeric formatting
  if (caDef.unit === null) return String(value ?? caDef.default ?? '');

  // Numeric with unit
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return String(caDef.default ?? value);
  return fmtValue(num);
};

/**
 * Format a single CA attribute line.
 * @param {string}      slot   - e.g. 'CA1'
 * @param {string}      value  - formatted value string
 * @param {string|null} unit   - e.g. 'KPA', 'MM', or null
 * @param {string}      [indent]
 * @returns {string}
 */
export const buildCALine = (slot, value, unit, indent = INDENT) => {
  const slotName = `COMPONENT-ATTRIBUTE${slot.replace('CA', '')}`;
  const valueStr = unit ? `${value} ${unit}` : value;
  return `${indent}${slotName}  ${valueStr}`;
};

/**
 * Build all CA attribute lines for a component block.
 * Uses config.pcfRules[pcfType].caSlots to determine which slots to write.
 * Uses config.caDefinitions for value, unit, default, zeroValue logic.
 * Also injects mapped attributes from LinelistService.
 *
 * @param {object} pts       - PointDict
 * @param {string} pcfType   - e.g. 'PIPE', 'BEND', 'FLANGE'
 * @param {object} config    - full config
 * @param {object} [branchPts] - branch point data for TEE branch CA override
 * @returns {string[]}
 */
export const buildCABlock = (pts, pcfType, config, branchPts = null) => {
  const rule = config?.pcfRules?.[pcfType];
  const primary = pts['1'] ?? pts['0'] ?? Object.values(pts)[0] ?? {};
  const lines = [];

  try {
    // 0. Smart Material Mapping (CA3, CA4, CA7) via Piping Class Master
    let smartAttrs = {};
    if (primary && primary.raw) {
      const pipeStr = primary.raw?.['PIPE'] || primary.raw?.['Pipe'] || '';
      if (pipeStr) {
        // Use updated MaterialService strategy support
        const pipingClass = materialService.extractPipingClass(pipeStr);
        if (pipingClass) {
          smartAttrs = materialService.resolveAttributes(pipingClass);
        }
      }
    }

    // 1. Linelist Attributes (SmartProcessMap & Custom Mapping)
    // Updated to use linelistService.getSmartAttributes
    if (primary && primary.raw) {
      const smartData = linelistService.getSmartAttributes({ raw: primary.raw });

      if (smartData.Found) {
        const injected = [];
        const addLine = (attr, val) => {
            if (val !== undefined && val !== null && val !== "") {
                lines.push(`${INDENT}${attr}  ${val}`);
                injected.push({ attr, val });
            }
        };

        // P1 -> CA1
        if (smartData.P1) addLine('COMPONENT-ATTRIBUTE1', smartData.P1);
        // T1 -> CA2
        if (smartData.T1) addLine('COMPONENT-ATTRIBUTE2', smartData.T1);
        // InsThk -> CA5
        if (smartData.InsThk) {
            addLine('COMPONENT-ATTRIBUTE5', smartData.InsThk);
            // Auto-inject Density 210 if InsThk > 0
            if (parseFloat(smartData.InsThk) > 0) {
                addLine('COMPONENT-ATTRIBUTE6', '210');
            }
        }
        // HP -> CA10
        if (smartData.HP) addLine('COMPONENT-ATTRIBUTE10', smartData.HP);
        // Density -> CA9
        if (smartData.Density) addLine('COMPONENT-ATTRIBUTE9', smartData.Density);

        // Row-based mappings (LineRef, PipingClass, Custom)
        const row = smartData.Row;
        const state = getState("linelist") || {};
        const sm = state.smartMap || {}; // Ensure using smartMap from new service structure

        if (sm.LineRef && row[sm.LineRef]) addLine('PIPELINE-REFERENCE', row[sm.LineRef]);
        if (sm.PipingClass && row[sm.PipingClass]) addLine('COMPONENT-ATTRIBUTE20', row[sm.PipingClass]);

        // Custom Mapping
        const customMapping = state.mapping || {};
        Object.entries(customMapping).forEach(([col, pcfAttr]) => {
            const val = row[col];
            if (val !== undefined && val !== "") {
                addLine(pcfAttr, val);
            }
        });

        // Inject RefNo internal trace
        if (primary.RefNo) {
            lines.push(`${INDENT}COMPONENT-ATTRIBUTE99  ${primary.RefNo}`);
        }

        if (injected.length > 0) {
          gate('CABuilder', 'buildCABlock', 'Linelist Attributes Injected', {
            pcfType,
            refno: primary.RefNo,
            injectedCount: injected.length
          });
        }
      }
    }

    // 2. Standard CA Slots (Configured)
    if (!rule || !rule.caSlots || rule.caSlots.length === 0) return lines;

    const caDefs = config.caDefinitions ?? {};
    const branchPrimary = branchPts ?? pts['3'] ?? null;

    for (const slot of rule.caSlots) {
      const caDef = caDefs[slot];
      if (!caDef) continue;
      if (!_shouldWrite(caDef, pcfType)) continue;

      let sourcePrimary = primary;
      if (branchPrimary && (slot === 'CA3' || slot === 'CA4')) {
        const branchMat = branchPrimary.material;
        const runMat = primary.material;
        if (slot === 'CA3' && branchMat && branchMat !== runMat) sourcePrimary = branchPrimary;
        if (slot === 'CA4' && branchPrimary.wall !== primary.wall) sourcePrimary = branchPrimary;
      }

      const resolvedValue = _resolveValue(slot, sourcePrimary, caDef);

      // Override with Smart Material Attributes
      let finalValue = resolvedValue;
      if (slot === 'CA3' && smartAttrs.materialCode) finalValue = smartAttrs.materialCode;
      if (slot === 'CA4' && smartAttrs.wallThickness) finalValue = String(smartAttrs.wallThickness);
      if (slot === 'CA7' && smartAttrs.corrosion) finalValue = String(smartAttrs.corrosion);

      if (finalValue === null && caDef.zeroValue) {
        lines.push(`${INDENT}COMPONENT-ATTRIBUTE${slot.replace('CA', '')}  ${caDef.zeroValue}`);
      } else if (finalValue !== null) {
        lines.push(buildCALine(slot, finalValue, caDef.unit));
      }
    }

  } catch (err) {
    warn(MOD, 'buildCABlock', `CA generation failed for ${pcfType}`, {
      error: err.message,
      refno: primary?.RefNo
    });
  }

  return lines;
};
