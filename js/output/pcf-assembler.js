/**
 * pcf-assembler.js — Assemble complete PCF lines array
 * Iterates traversal order, dispatches each group to writer, joins with blank lines.
 * Orphans appended at end with comment.
 *
 * Exports:
 *   assemble(traversalResult, groups, config, pipelineRef) → string[]
 */

import { buildHeader } from '../converter/header-writer.js';
import { buildPts } from '../converter/point-builder.js';
import { dispatch } from '../converter/components/dispatcher.js';
import { info, warn } from '../logger.js';
import { gate } from '../services/gate-logger.js';

const MOD = 'pcf-assembler';



/**
 * Assemble complete PCF file lines.
 * @param {{ ordered: string[], orphans: string[] }} traversalResult
 * @param {Map<string, ComponentGroup>} groups
 * @param {object} config
 * @param {string} [pipelineRef]
 * @returns {string[]}
 */
export const assemble = (traversalResult, groups, config, pipelineRef) => {
  const { ordered, orphans } = traversalResult;
  const lines = [];

  // File header
  lines.push(...buildHeader(config, pipelineRef));
  lines.push('');

  let written = 0;
  let skipped = 0;

  // Main traversal order
  for (const refno of ordered) {
    const group = groups.get(refno);
    if (!group) {
      warn(MOD, 'assemble', `Refno in traversal not found in groups`, { refno });
      continue;
    }
    if (group.skip) { skipped++; continue; }

    // Ensure pts are built
    if (!group.pts || Object.keys(group.pts).length === 0) {
      group.pts = buildPts(group, config);
    }

    const blockLines = dispatch(group, config);
    if (blockLines.length > 0) {
      lines.push(...blockLines);
      lines.push(''); // blank line between components
      written++;
    } else {
      skipped++;
    }
  }

  // Orphans at end with annotation
  if (orphans.length > 0) {
    lines.push('MESSAGE-SQUARE');
    lines.push(`    *** ORPHAN COMPONENTS — no coordinate match found ***`);
    lines.push('');
    for (const refno of orphans) {
      const group = groups.get(refno);
      if (!group || group.skip) continue;
      if (!group.pts || Object.keys(group.pts).length === 0) {
        group.pts = buildPts(group, config);
      }
      const blockLines = dispatch(group, config);
      if (blockLines.length > 0) {
        lines.push(...blockLines);
        lines.push('');
        written++;
      }
    }
  }

  gate('PCFAssembler', 'assemble', 'Assembly Complete', {
    totalLines: lines.length, written, skipped, orphans: orphans.length
  });

  info(MOD, 'assemble', 'PCF assembly complete', {
    totalLines: lines.length, written, skipped, orphans: orphans.length,
  });

  return lines;
};
