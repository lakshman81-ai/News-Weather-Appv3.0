/**
 * grouper.js — Group normalizedRows by RefNo into ComponentGroup map
 * Preserves insertion order (Map in JS 3.7+ is ordered).
 * Resolves PCF keyword from config.componentTypeMap.
 * Marks SKIP types.
 *
 * Exports:
 *   groupByRefNo(normalizedRows, config) → Map<refno, ComponentGroup>
 *   getPipelineRef(normalizedRows)       → string
 *
 * ComponentGroup shape:
 *   { refno, csvType, pcfType, rows[], skip, firstRowIndex }
 */

import { gate } from "../services/gate-logger.js";
import { info, warn } from "../logger.js";

const MOD = "grouper";



/**
 * Extract pipeline reference from RefNo column.
 * RefNo format: "=67130482/1664" → pipeline ref is "67130482"
 * Or plain string "67130482" → returned as-is.
 * @param {object[]} rows
 * @returns {string}
 */
export const getPipelineRef = (rows) => {
  for (const row of rows) {
    const ref = String(row.RefNo ?? '').trim();
    if (!ref) continue;
    // Strip leading "=" (Excel formula artifacts)
    const clean = ref.startsWith('=') ? ref.slice(1) : ref;
    // Take the part before "/" if present
    const slash = clean.indexOf('/');
    if (slash > 0) return clean.slice(0, slash);
    return clean;
  }
  return '';
};

/**
 * Resolve a CSV type code to a PCF keyword using config.componentTypeMap.
 * Returns 'UNKNOWN' if not found, logs a warning.
 * @param {string} csvType
 * @param {object} componentTypeMap
 * @returns {string}
 */
const _resolvePcfType = (csvType, componentTypeMap) => {
  if (!csvType) return 'SKIP';
  const upper = csvType.toUpperCase().trim();
  const mapped = componentTypeMap[upper];
  if (!mapped) {
    warn(MOD, '_resolvePcfType', `Unknown CSV component type: "${csvType}"`, {
      csvType, availableTypes: Object.keys(componentTypeMap),
      hint: 'Add this type to config.componentTypeMap',
    });
    return 'UNKNOWN';
  }
  return mapped;
};

/**
 * Group all normalized rows by RefNo.
 * Each unique RefNo = one physical component (BRAN rows with the same RefNo
 * are the two endpoints of one pipe segment: Point=1 is EP1, Point=2 is EP2).
 * @param {object[]} normalizedRows
 * @param {object}   config
 * @returns {Map<string, ComponentGroup>}
 */
export const groupByRefNo = (normalizedRows, config) => {
  if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
    warn(MOD, 'groupByRefNo', 'No rows to group');
    return new Map();
  }

  const typeMap = config?.componentTypeMap ?? {};
  const groups = new Map();

  for (let i = 0; i < normalizedRows.length; i++) {
    const row = normalizedRows[i];
    const refno = String(row.RefNo ?? '').trim();

    if (!refno) {
      warn(MOD, 'groupByRefNo', `Row ${i} has empty RefNo — skipping`, {
        rowIndex: i, type: row.Type, partial: { East: row.East, North: row.North },
      });
      continue;
    }

    if (!groups.has(refno)) {
      const csvType = String(row.Type ?? '').trim().toUpperCase();
      const pcfType = _resolvePcfType(csvType, typeMap);
      groups.set(refno, {
        refno,
        csvType,
        pcfType,
        rows: [],
        skip: pcfType === 'SKIP' || pcfType === 'UNKNOWN',
        firstRowIndex: i,
      });
    }

    groups.get(refno).rows.push({ ...row, _rowIndex: i });
  }

  // Log summary
  const total = groups.size;
  const skipped = [...groups.values()].filter(g => g.skip).length;
  const byType = {};
  for (const g of groups.values()) {
    byType[g.pcfType] = (byType[g.pcfType] ?? 0) + 1;
  }

  info(MOD, 'groupByRefNo', 'Grouping complete', {
    totalGroups: total, skipped, active: total - skipped, byPCFType: byType,
  });

  return groups;
};
