/**
 * components/bend.js — Write BEND PCF block
 * Computes angle from EP1, CP, EP2 vectors.
 * BEND-RADIUS from CSV Radius column.
 * FIX: Infers Centre Point for 90° elbows with diagonal (skew) travel.
 */
import { fmtPointToken, fmtValue } from '../../geometry/coord-engine.js';
import { computeAngle, formatAngle } from '../../geometry/angle-calc.js';
import { isSkew, inferCorner } from '../../geometry/direction-calc.js';
import { buildCABlock } from '../ca-builder.js';
import { buildBendMsgSquare } from '../message-square.js';
import { warn } from '../../logger.js';

const INDENT = '    ';

export const writeBend = (group, config) => {
  const { pts, refno } = group;
  const rule = config.pcfRules['BEND'];
  const ep1 = pts['1'];
  const ep2 = pts['2'];
  let cp = pts['0'];
  const dp = config.outputSettings?.decimalPlaces ?? 3;
  const tokens = rule?.centrePointTokens ?? 4;

  // FIX: If Centre Point is missing but EP1/EP2 exist with skew travel,
  // infer the corner point for a 90-degree elbow.
  if (!cp && ep1 && ep2 && isSkew(ep1, ep2)) {
    cp = inferCorner(ep1, ep2);
    // Carry over bore and design values from EP1 for formatting
    cp.bore = ep1.bore ?? 0;
    cp.radius = ep1.radius ?? 0;
    cp.wall = ep1.wall ?? 0;
    cp.material = ep1.material ?? '';
    warn('bend', 'writeBend', 'Centre Point (Point=0) missing — inferred from EP1/EP2 diagonal travel', {
      refno,
      inferredCP: `E=${cp.E.toFixed(1)} N=${cp.N.toFixed(1)} U=${cp.U.toFixed(1)}`,
      hint: 'Provide Point=0 in CSV for accurate centre placement',
    });
  }

  if (!ep1 || !ep2 || !cp) {
    warn('bend', 'writeBend', 'Missing geometry points for BEND', {
      refno, hasEP1: !!ep1, hasEP2: !!ep2, hasCP: !!cp,
      hint: 'ELBO needs Point=1, Point=2, Point=0 in CSV',
    });
    return [];
  }

  const angleDeg = computeAngle(ep1, cp, ep2);
  const angleStr = formatAngle(angleDeg, rule?.angleFormat ?? 'degrees');
  const primary = ep1;
  const radius = primary.radius ?? 0;

  if (radius <= 0) {
    warn('bend', 'writeBend', 'BEND-RADIUS is zero or missing', {
      refno, radius, hint: 'Set Radius column in CSV for bend components',
    });
  }

  const lines = [
    ...buildBendMsgSquare(pts, angleStr, { ...config, refno: group.refno }),
    'BEND',
    `${INDENT}END-POINT  ${fmtPointToken(ep1, ep1.bore, dp, 4)}`,
    `${INDENT}END-POINT  ${fmtPointToken(ep2, ep2.bore, dp, 4)}`,
    `${INDENT}CENTRE-POINT  ${fmtPointToken(cp, cp.bore, dp, tokens)}`,
    `${INDENT}${rule?.skeyStyle ?? '<SKEY>'} ${rule?.defaultSKEY ?? 'BEBW'}`,
    `${INDENT}ANGLE ${angleStr}`,
    `${INDENT}BEND-RADIUS ${fmtValue(radius, 1)}`,
    ...buildCABlock(pts, 'BEND', config),
  ];

  return lines;
};
