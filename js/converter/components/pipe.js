/**
 * components/pipe.js — Write PIPE PCF block
 * Inputs: pts (PointDict), config
 * Output: string[] lines
 */
import { fmtPointToken } from '../../geometry/coord-engine.js';
import { buildCABlock } from '../ca-builder.js';
import { buildMsgSquare } from '../message-square.js';
import { warn } from '../../logger.js';

const INDENT = '    ';

export const writePipe = (group, config) => {
  const { pts, refno } = group;
  const rule = config.pcfRules['PIPE'];
  const ep1 = pts['1'];
  const ep2 = pts['2'];
  const dp = config.outputSettings?.decimalPlaces ?? 3;

  if (!ep1 || !ep2) {
    warn('pipe', 'writePipe', 'Missing EP1 or EP2 — cannot write PIPE block', {
      refno, hasEP1: !!ep1, hasEP2: !!ep2,
      hint: 'Check CSV Point column — BRAN needs Point=1 and Point=2 rows',
    });
    return [];
  }

  const lines = [
    ...buildMsgSquare(pts, 'PIPE', { ...config, refno }),
    'PIPE',
    `${INDENT}END-POINT  ${fmtPointToken(ep1, ep1.bore, dp, 4)}`,
    `${INDENT}END-POINT  ${fmtPointToken(ep2, ep2.bore, dp, 4)}`,
    ...buildCABlock(pts, 'PIPE', config),
  ];

  return lines;
};
