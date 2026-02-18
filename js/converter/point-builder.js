/**
 * point-builder.js — Build PointDict from a ComponentGroup's rows
 * Extracts all geometry and design values per Point number.
 * Applies fallback defaults from config.caDefinitions.
 *
 * Exports:
 *   buildPts(group, config)   → PointDict
 *   getPrimary(pts)           → Point   (Point "1" or "0" or first)
 *   getBranch(pts)            → Point | null  (Point "3" or null)
 *   getEndpoints(pts, rule)   → {ep1, ep2, cp, bp}  geometry points
 */

import { warn } from '../logger.js';
import { parseCoord, parseBore } from '../geometry/coord-engine.js';

const MOD = 'point-builder';

/**
 * Coerce a value to float. Returns defaultVal if null/empty/NaN.
 * @param {*} val
 * @param {number} defaultVal
 * @returns {number}
 */
const _toFloat = (val, defaultVal = 0) => {
  if (val === null || val === undefined || val === '') return defaultVal;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? defaultVal : n;
};

/**
 * Get a design value from a row, applying CA default if missing/zero.
 * @param {*} rowValue
 * @param {object} caDef    - from config.caDefinitions[slot]
 * @returns {*}
 */
const _resolveCAValue = (rowValue, caDef) => {
  if (!caDef) return rowValue;
  if (rowValue === null || rowValue === undefined || rowValue === '' || rowValue === 0) {
    return caDef.default;
  }
  return rowValue;
};

/**
 * Build PointDict from a ComponentGroup.
 * @param {object} group    - ComponentGroup from grouper
 * @param {object} config   - full config
 * @returns {object}  pts   - { '0': {...}, '1': {...}, '2': {...}, '3': {...} }
 */
export const buildPts = (group, config) => {
  if (!group?.rows?.length) {
    warn(MOD, 'buildPts', `No rows in group: ${group?.refno}`, { refno: group?.refno });
    return {};
  }

  const caDefs = config?.caDefinitions ?? {};
  const pts = {};

  for (const row of group.rows) {
    const ptNum = String(row.Point ?? '').trim();
    if (!ptNum && ptNum !== '0') {
      warn(MOD, 'buildPts', `Row has no Point number`, {
        refno: group.refno, rowIndex: row._rowIndex,
      });
      continue;
    }

    if (pts[ptNum]) {
      warn(MOD, 'buildPts', `Duplicate Point "${ptNum}" in group — overwriting`, {
        refno: group.refno, ptNum, rowIndex: row._rowIndex,
      });
    }

    pts[ptNum] = {
      // Coordinates — already parsed by unit-transformer (numbers or null)
      E: _toFloat(row.East, 0),
      N: _toFloat(row.North, 0),
      U: _toFloat(row.Up, 0),
      // Bore — may have suffix if not caught by unit-transformer
      bore: row.Bore !== null ? _toFloat(row.Bore, 0) : parseBore(row._orig_Bore ?? ''),
      // Design values
      radius: _toFloat(row.Radius, 0),
      wall: _toFloat(row['Wall Thickness'], _toFloat(caDefs.CA4?.default, 9.53)),
      corr: _toFloat(row['Corrosion Allowance'], _toFloat(caDefs.CA7?.default, 3)),
      weight: _toFloat(row.Weight, _toFloat(caDefs.CA8?.default, 0)),
      insul: _toFloat(row['Insulation thickness'], _toFloat(caDefs.CA5?.default, 0)),
      pressure: _resolveCAValue(row.Pressure, caDefs.CA1),
      hydro: _resolveCAValue(row['Hydro test pressure'], caDefs.CA10),
      material: _resolveCAValue(row.Material, caDefs.CA3) || 'A106-B',
      // Support-specific
      restraintType: String(row['Restraint Type'] ?? '').trim(),
      nodeName: String(row.NodeName ?? '').trim(),
      compName: String(row.componentName ?? '').trim(),
      // Metadata
      rigid: String(row.Rigid ?? '').trim(),
      _rowIndex: row._rowIndex,
      raw: row, // Preserve full row for extension (Linelist mapping)
    };
  }

  return pts;
};

/**
 * Get the primary point for design value resolution.
 * Priority: "1" → "0" → first available.
 * @param {object} pts
 * @returns {object|null}
 */
export const getPrimary = (pts) =>
  pts['1'] ?? pts['0'] ?? Object.values(pts)[0] ?? null;

/**
 * Get branch point if present (Point "3").
 * @param {object} pts
 * @returns {object|null}
 */
export const getBranch = (pts) => pts['3'] ?? null;

/**
 * Extract named geometry points from pts based on pcfRule.pointMap.
 * Returns null for each missing point and logs a warning.
 * @param {object} pts
 * @param {object} pointMap  - e.g. { EP1:'1', EP2:'2', CP:'0', BP:'3' }
 * @param {string} refno     - for log context
 * @returns {{ ep1, ep2, cp, bp }}  any can be null
 */
export const getEndpoints = (pts, pointMap, refno) => {
  const result = { ep1: null, ep2: null, cp: null, bp: null };

  if (pointMap.EP1) {
    result.ep1 = pts[pointMap.EP1] ?? null;
    if (!result.ep1) warn(MOD, 'getEndpoints', `Missing EP1 (Point "${pointMap.EP1}")`, { refno });
  }
  if (pointMap.EP2) {
    result.ep2 = pts[pointMap.EP2] ?? null;
    if (!result.ep2) warn(MOD, 'getEndpoints', `Missing EP2 (Point "${pointMap.EP2}")`, { refno });
  }
  if (pointMap.CP) {
    result.cp = pts[pointMap.CP] ?? null;
    if (!result.cp) warn(MOD, 'getEndpoints', `Missing CP (Point "${pointMap.CP}")`, { refno });
  }
  if (pointMap.BP) {
    result.bp = pts[pointMap.BP] ?? null;
    if (!result.bp) warn(MOD, 'getEndpoints', `Missing BP (Point "${pointMap.BP}")`, { refno });
  }
  if (pointMap.COORDS) {
    result.ep1 = pts[pointMap.COORDS] ?? null;
    if (!result.ep1) warn(MOD, 'getEndpoints', `Missing COORDS (Point "${pointMap.COORDS}")`, { refno });
  }

  return result;
};
