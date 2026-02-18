/**
 * components/flange.js — Write FLANGE PCF block
 * CA8 (weight) included. SKEY FLWN default.
 */
import { fmtPointToken } from '../../geometry/coord-engine.js';
import { buildCABlock } from '../ca-builder.js';
import { buildMsgSquare } from '../message-square.js';
import { warn } from '../../logger.js';

const INDENT = '    ';

export const writeFlange = (group, config) => {
  const { pts, refno } = group;
  const rule = config.pcfRules['FLANGE'];
  const ep1 = pts['1'];
  const ep2 = pts['2'];
  const dp = config.outputSettings?.decimalPlaces ?? 3;

  if (!ep1 || !ep2) {
    warn('flange', 'writeFlange', 'Missing EP1 or EP2', {
      refno, hasEP1: !!ep1, hasEP2: !!ep2,
    });
    return [];
  }

  return [
    ...buildMsgSquare(pts, 'FLANGE', { ...config, refno: group.refno }),
    'FLANGE',
    `${INDENT}END-POINT  ${fmtPointToken(ep1, ep1.bore, dp, 4)}`,
    `${INDENT}END-POINT  ${fmtPointToken(ep2, ep2.bore, dp, 4)}`,
    `${INDENT}${rule?.skeyStyle ?? '<SKEY>'} ${rule?.defaultSKEY ?? 'FLWN'}`,
    ...buildCABlock(pts, 'FLANGE', config),
  ];
};
