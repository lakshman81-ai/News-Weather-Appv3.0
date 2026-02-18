/**
 * sequencer.js — Traversal Strategy Factory
 * Decides whether to use Topological Sort (DFS) or Linear Scan
 * based on the active pipeline mode.
 */

import { buildTopology } from './topology-builder.js';
import { detectStartNodes, traverse } from './branch-traverser.js';
import { info } from '../logger.js';

const MOD = 'sequencer';

/**
 * Run the appropriate sequencing strategy.
 * @param {Map<string, ComponentGroup>} groups
 * @param {object} config
 * @returns {{ ordered: string[], orphans: string[], topology: object|null }}
 */
export const runSequencer = (groups, config) => {
  const mode = config?.coordinateSettings?.pipelineMode ?? 'repair';

  if (mode === 'sequential') {
    info(MOD, 'runSequencer', 'Using LINEAR traversal (Sequential Mode).');

    // Just return keys in insertion order.
    // Filter out skipped items? Usually skipped items are not in final PCF,
    // but traverse() result usually includes everything visited.
    // assemble() filters by !skip.

    const ordered = [...groups.keys()];

    return {
      ordered,
      orphans: [], // In linear mode, nothing is "orphaned" because we force visit everything
      topology: null // No graph built
    };
  }

  // Default: Graph Mode (Strict / Repair)
  info(MOD, 'runSequencer', 'Using GRAPH traversal (Topology Mode).');

  const topology = buildTopology(groups, config);
  const startNodes = detectStartNodes(groups);
  const result = traverse(topology, startNodes, groups);

  return {
    ordered: result.ordered,
    orphans: result.orphans,
    topology
  };
};
