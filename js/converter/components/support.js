/**
 * components/support.js — Write SUPPORT PCF block
 * CO-ORDS only (4 tokens). NO CA attributes.
 * <SUPPORT_NAME> from Restraint Type column.
 * <SUPPORT_GUID> from NodeName column with UCI: prefix.
 */
import { fmtPointToken } from '../../geometry/coord-engine.js';
import { buildMsgSquare } from '../message-square.js';
import { warn } from '../../logger.js';

const INDENT = '    ';

export const writeSupport = (group, config) => {
  const { pts, refno } = group;
  const rule = config.pcfRules['SUPPORT'];
  const coords = pts['0'];
  const primary = pts['0'] ?? Object.values(pts)[0] ?? {};
  const dp = config.outputSettings?.decimalPlaces ?? 3;

  if (!coords) {
    warn('support', 'writeSupport', 'Missing COORDS point (Point=0) for SUPPORT', {
      refno, hint: 'ANCI component needs Point=0 row in CSV',
    });
    return [];
  }

  const supportName = primary.restraintType || '';
  const nodeName = primary.nodeName || '';

  if (!supportName) {
    warn('support', 'writeSupport', 'SUPPORT has no restraint type', {
      refno, hint: 'Fill "Restraint Type" column in CSV for ANCI components',
    });
  }
  if (!nodeName) {
    warn('support', 'writeSupport', 'SUPPORT has no NodeName for GUID', {
      refno, hint: 'Fill "NodeName" column in CSV for ANCI components',
    });
  }

  const lines = [
    ...buildMsgSquare(pts, 'SUPPORT', { ...config, refno: group.refno }),
    'SUPPORT',
    `${INDENT}CO-ORDS  ${fmtPointToken(coords, coords.bore, dp, 4)}`,
  ];

  // Mapping rules per user request:
  // <SUPPORT_NAME> -> Restraint Type (Default: CA150)
  // <SUPPORT_TAG>  -> Restraint Type (No Default)
  // <SUPPORT_GUID> -> NodeName (No Default, prefix UCI:)

  const nameVal = supportName || 'CA150';

  lines.push(`${INDENT}<SUPPORT_NAME> ${nameVal}`);
  if (supportName) lines.push(`${INDENT}<SUPPORT_TAG> ${supportName}`);
  if (nodeName) lines.push(`${INDENT}<SUPPORT_GUID> UCI:${nodeName}`);

  // NO CA attributes on SUPPORT — confirmed from validated PCF

  return lines;
};
