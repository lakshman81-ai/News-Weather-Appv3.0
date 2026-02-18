/**
 * components/olet.js — Write OLET PCF block
 * NO END-POINTs. CENTRE-POINT (main pipe CL) + BRANCH1-POINT (branch end).
 * Points: CP=0 (centre on main), BP=3 (branch end).
 */
import { fmtPointToken } from '../../geometry/coord-engine.js';
import { buildCABlock } from '../ca-builder.js';
import { buildMsgSquare } from '../message-square.js';
import { warn } from '../../logger.js';

const INDENT = '    ';

export const writeOlet = (group, config) => {
  const { pts, refno } = group;
  const rule = config.pcfRules['OLET'];
  const cp = pts['0'];
  const bp = pts['3'];
  const dp = config.outputSettings?.decimalPlaces ?? 3;

  if (!cp) {
    warn('olet', 'writeOlet', 'Missing CENTRE-POINT (Point=0) for OLET', {
      refno, hint: 'OLET needs Point=0 on the main pipe centreline',
    });
    return [];
  }
  if (!bp) {
    warn('olet', 'writeOlet', 'Missing BRANCH1-POINT (Point=3) for OLET', {
      refno, hint: 'OLET needs Point=3 at the branch outlet end',
    });
    return [];
  }

  return [
    ...buildMsgSquare(pts, 'OLET', { ...config, refno: group.refno }),
    'OLET',
    `${INDENT}CENTRE-POINT  ${fmtPointToken(cp, cp.bore, dp, 4)}`,
    `${INDENT}BRANCH1-POINT  ${fmtPointToken(bp, bp.bore, dp, 4)}`,
    `${INDENT}${rule?.skeyStyle ?? '<SKEY>'} ${rule?.defaultSKEY ?? 'CEBW'}`,
    ...buildCABlock(pts, 'OLET', config),
  ];
};
