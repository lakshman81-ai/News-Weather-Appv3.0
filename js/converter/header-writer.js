/**
 * header-writer.js — Write PCF file header section
 * Fixed ISOGEN-FILES + UNITS block, then pipeline reference and optional project fields.
 */

import { info } from '../logger.js';

const MOD = 'header-writer';

/**
 * Build PCF header lines.
 * @param {object} config
 * @param {string} [pipelineRefOverride]
 * @returns {string[]}
 */
export const buildHeader = (config, pipelineRefOverride) => {
  const s = config?.outputSettings ?? {};
  const ref = pipelineRefOverride || s.pipelineReference || 'UNKNOWN';
  const proj = s.projectIdentifier || '';
  const area = s.area || '';

  info(MOD, 'buildHeader', 'Building PCF header', { pipelineRef: ref });

  const lines = [
    'ISOGEN-FILES ISOGEN.FLS',
    'UNITS-BORE MM',
    'UNITS-CO-ORDS MM',
    'UNITS-WEIGHT KGS',
    'UNITS-BOLT-DIA MM',
    'UNITS-BOLT-LENGTH MM',
    `PIPELINE-REFERENCE ${ref}`,
  ];
  if (proj) lines.push(`    PROJECT-IDENTIFIER ${proj}`);
  if (area) lines.push(`    AREA ${area}`);
  return lines;
};
