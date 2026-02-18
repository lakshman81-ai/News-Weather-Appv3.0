/**
 * components/tee.js — Write TEE PCF block
 * Run: EP1(1) → CP(0) → EP2(2). Branch: BP(3).
 * Branch may have different bore, material, wall.
 */
import { fmtPointToken } from '../../geometry/coord-engine.js';
import { buildCABlock } from '../ca-builder.js';
import { buildMsgSquare } from '../message-square.js';
import { warn } from '../../logger.js';

const INDENT = '    ';

export const writeTee = (group, config) => {
  const { pts, refno } = group;
  const rule = config.pcfRules['TEE'];
  const ep1 = pts['1'];
  const ep2 = pts['2'];
  const cp = pts['0'];
  const bp = pts['3'];
  const dp = config.outputSettings?.decimalPlaces ?? 3;
  const tokens = rule?.centrePointTokens ?? 4;

  if (!ep1 || !ep2 || !cp) {
    warn('tee', 'writeTee', 'Missing run geometry for TEE', {
      refno, hasEP1: !!ep1, hasEP2: !!ep2, hasCP: !!cp,
      hint: 'TEE needs Point=1 (run start), Point=2 (run end), Point=0 (centre)',
    });
    return [];
  }
  if (!bp) {
    warn('tee', 'writeTee', 'Missing branch point (Point=3) for TEE', {
      refno, hint: 'TEE needs Point=3 for branch direction and bore',
    });
  }

  const branchBore = bp?.bore ?? ep1.bore;

  const lines = [
    ...buildMsgSquare(pts, 'TEE', { ...config, refno: group.refno }),
    'TEE',
    `${INDENT}END-POINT  ${fmtPointToken(ep1, ep1.bore, dp, 4)}`,
    `${INDENT}END-POINT  ${fmtPointToken(ep2, ep2.bore, dp, 4)}`,
    `${INDENT}CENTRE-POINT  ${fmtPointToken(cp, cp.bore ?? ep1.bore, dp, tokens)}`,
  ];

  if (bp) {
    lines.push(`${INDENT}BRANCH1-POINT  ${fmtPointToken(bp, branchBore, dp, 4)}`);
  }

  lines.push(`${INDENT}${rule?.skeyStyle ?? '<SKEY>'} ${rule?.defaultSKEY ?? 'TEBW'}`);
  lines.push(...buildCABlock(pts, 'TEE', config, bp ? { ...bp } : null));

  return lines;
};
