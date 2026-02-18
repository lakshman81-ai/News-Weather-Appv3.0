/**
 * syntax-validator.js — Phase 4: Post-generation PCF syntax validation
 * Scans generated PCF lines[] for rule violations.
 * Each rule reads from config.pcfRules.
 *
 * Exports:
 *   validateSyntax(pcfLines, config) → Issue[]
 */

import { warn } from '../logger.js';

const MOD = 'syntax-validator';

const _issue = (id, severity, refno, lineNo, message, detail, fixHint) => ({
  id, phase: 'SYNTAX', severity, refno: refno || null,
  rowIndex: lineNo ?? null, message, detail: detail || '',
  fixable: false, fix: null, fixHint: fixHint || '',
});

// Parse PCF lines into blocks for analysis
export const parseBlocks = (lines) => {
  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trimStart();

    // Block keyword = line that starts without leading spaces and is a PCF keyword
    const isKeyword = !/^\s/.test(line) && line.trim() !== '' && !line.startsWith('#');
    if (isKeyword) {
      if (current) blocks.push(current);
      current = { keyword: line.trim(), attributes: [], startLine: i };
    } else if (current) {
      current.attributes.push({ line: trimmed, lineNo: i });
    }
  }
  if (current) blocks.push(current);
  return blocks;
};

/**
 * Validate generated PCF lines for syntax compliance.
 * @param {string[]} pcfLines
 * @param {object}   config
 * @returns {Issue[]}
 */
export const validateSyntax = (pcfLines, config) => {
  if (!Array.isArray(pcfLines) || pcfLines.length === 0) return [];
  const pcfRules = config?.pcfRules ?? {};
  const issues = [];
  const blocks = parseBlocks(pcfLines);

  // Skip non-component keywords
  const HEADER_KEYWORDS = new Set(['ISOGEN-FILES', 'UNITS-BORE', 'UNITS-CO-ORDS',
    'UNITS-WEIGHT', 'UNITS-BOLT-DIA', 'UNITS-BOLT-LENGTH', 'PIPELINE-REFERENCE', 'MESSAGE-SQUARE']);

  for (const block of blocks) {
    const kw = block.keyword;
    if (HEADER_KEYWORDS.has(kw)) continue;
    const rule = pcfRules[kw];

    // Debug log to see if rules are missing
    if (!rule) {
      // console.log(`[SV] No rule for ${kw}`);
      continue;
    }

    const attrNames = block.attributes.map(a => a.line.split(/\s+/)[0]);

    // GENERIC FORMAT CHECK: Flag any attribute with "Undefined" value
    // This runs regardless of config rules to catch all placeholders
    for (const attr of block.attributes) {
      if (attr.line.includes('Undefined') || attr.line.includes('undefined')) {
        const parts = attr.line.split(/\s+/);
        const key = parts[0];
        const val = parts.slice(1).join(' ').trim();
        if (val === 'Undefined' || val === 'undefined') {
          issues.push(_issue('SV-001', 'WARNING', kw, attr.lineNo,
            `${kw}: ${key} is '${val}'`,
            `Line ${attr.lineNo + 1}`,
            `Remove placeholder value`));
        }
      }
    }

    // SV-001: Required CA slots present
    for (const slot of rule.caSlots ?? []) {
      const attrNum = slot.replace('CA', '');
      const attrKey = `COMPONENT-ATTRIBUTE${attrNum}`;

      const attrLine = block.attributes.find(a => a.line.startsWith(attrKey));

      if (!attrLine) {
        issues.push(_issue('SV-001', 'ERROR', kw, block.startLine,
          `${kw}: missing ${attrKey} (${slot})`,
          `Block at line ${block.startLine + 1}`,
          `Add ${attrKey} with value from config.caDefinitions.${slot}.default`));
      } else {
        // Check for placeholder/undefined values
        const val = attrLine.line.split(/\s+/).slice(1).join(' ').trim();
        // console.log(`[SV] Checking ${kw}.${attrKey} value: '${val}'`); // Debug Log

        if (val === 'Undefined' || val === 'undefined') {
          issues.push(_issue('SV-001', 'WARNING', kw, attrLine.lineNo,
            `${kw}: ${attrKey} value is 'Undefined'`,
            `Line ${attrLine.lineNo + 1}`,
            `Set default value for ${slot} in Config or fix input data`));
        }
      }
    }

    // SV-002: BEND has ANGLE and BEND-RADIUS
    if (kw === 'BEND') {
      if (!attrNames.includes('ANGLE')) {
        issues.push(_issue('SV-002', 'ERROR', kw, block.startLine,
          'BEND block missing ANGLE', '', 'Check bend angle computation'));
      }
      if (!attrNames.includes('BEND-RADIUS')) {
        issues.push(_issue('SV-002', 'WARNING', kw, block.startLine,
          'BEND block missing BEND-RADIUS', '', 'Set Radius column in CSV'));
      }
      const angleLine = block.attributes.find(a => a.line.startsWith('ANGLE'));
      if (angleLine) {
        const angleVal = parseFloat(angleLine.line.split(/\s+/)[1]);
        if (isNaN(angleVal) || angleVal <= 0 || angleVal >= 180) {
          issues.push(_issue('SV-002', 'WARNING', kw, angleLine.lineNo,
            `BEND ANGLE value suspicious: "${angleLine.line}"`,
            `Expected 0 < angle < 180`, 'Verify centre-point coordinates'));
        }
      }
    }

    // SV-003: SUPPORT has <SUPPORT_NAME>
    if (kw === 'SUPPORT') {
      if (!attrNames.includes('<SUPPORT_NAME>')) {
        issues.push(_issue('SV-003', 'WARNING', kw, block.startLine,
          'SUPPORT block missing <SUPPORT_NAME>',
          '', 'Fill Restraint Type column in CSV'));
      }
    }

    // SV-004: END-POINTs count
    const epCount = attrNames.filter(a => a === 'END-POINT').length;
    if (['PIPE', 'FLANGE', 'VALVE', 'REDUCER-CONCENTRIC', 'REDUCER-ECCENTRIC'].includes(kw)) {
      if (epCount !== 2) {
        issues.push(_issue('SV-004', 'ERROR', kw, block.startLine,
          `${kw}: expected 2 END-POINTs, found ${epCount}`,
          '', 'Check CSV Point columns for this component'));
      }
    }
    if (kw === 'OLET' && epCount > 0) {
      issues.push(_issue('SV-004', 'ERROR', kw, block.startLine,
        `OLET must not have END-POINT lines (found ${epCount})`,
        '', 'OLET uses CENTRE-POINT + BRANCH1-POINT only'));
    }
  }

  warn(MOD, 'validateSyntax', `Syntax validation: ${issues.length} issues`, {
    errors: issues.filter(x => x.severity === 'ERROR').length,
    warnings: issues.filter(x => x.severity === 'WARNING').length,
  });

  return issues;
};
