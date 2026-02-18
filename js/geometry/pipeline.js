/**
 * pipeline.js — Geometry Processing Pipeline
 * Orchestrates the point building, overlap resolution, and multi-pass refinement logic.
 *
 * Implements "Mode A vs Mode B" and "Two-Pass" strategies as requested.
 */

import { buildPts }        from '../converter/point-builder.js';
import { resolveOverlaps } from './overlap-resolver.js';
import { snapSequential }  from './snapper.js';
import { segmentizePipes } from './segmentizer.js';
import { info, warn }      from '../logger.js';

const MOD = 'pipeline';

/**
 * Process component groups to generate final geometry.
 * Handles point building, overlap resolution, and optional multi-pass gap filling.
 *
 * @param {Map<string, ComponentGroup>} groups  - Raw component groups
 * @param {object} config                       - Full app configuration
 * @returns {{ groups: Map, anomalies: object[] }}
 */
export const processGeometry = (groups, config) => {
  const settings = config?.coordinateSettings ?? {};
  const pipelineMode = settings.pipelineMode ?? 'repair'; // 'strict' | 'repair' | 'sequential'
  const multiPass = settings.multiPass ?? true;

  info(MOD, 'processGeometry', `Starting geometry pipeline in "${pipelineMode}" mode (MultiPass: ${multiPass})`);

  // 1. Build Points
  let builtCount = 0;
  for (const [, g] of groups) {
    if (!g.pts) {
      g.pts = buildPts(g, config);
      builtCount++;
    }
  }
  info(MOD, 'processGeometry', `Built points for ${builtCount} groups`);

  let finalGroups = groups;
  let finalAnomalies = [];

  // ── BRANCH: SEQUENTIAL MODE ──────────────────────────────────────────────
  if (pipelineMode === 'sequential') {
      info(MOD, 'processGeometry', 'Executing Sequential Robust Mode...');

      // 1. Run Overlap Resolution (Pass 1) to split engulfing pipes
      // Even in sequential mode, we want to split a pipe if it physically engulfs a fitting listed inside it.
      // But we DISABLE gap filling here, because `snapSequential` will handle gaps.
      const seqConfig = JSON.parse(JSON.stringify(config));
      seqConfig.coordinateSettings.overlapResolution.gapFillEnabled = false;

      const res1 = resolveOverlaps(groups, seqConfig);
      finalGroups = res1.groups;
      finalAnomalies = res1.anomalies;

      // 2. Run Snapping & Gap Filling (Sequential)
      const tol = settings.continuityTolerance ?? 6.0;
      finalGroups = snapSequential(finalGroups, tol);

      // 3. Run Segmentation
      const maxSeg = settings.maxSegmentLength ?? 13100;
      finalGroups = segmentizePipes(finalGroups, maxSeg);

  } else {
      // ── BRANCH: GRAPH MODE (Strict / Repair) ──────────────────────────────

      // 2. Prepare Configuration for Pass 1
      const pass1Config = JSON.parse(JSON.stringify(config));

      if (pipelineMode === 'strict') {
        pass1Config.coordinateSettings.overlapResolution = {
          ...pass1Config.coordinateSettings.overlapResolution,
          gapFillEnabled: false,
        };
      } else {
        pass1Config.coordinateSettings.overlapResolution = {
          ...pass1Config.coordinateSettings.overlapResolution,
          gapFillEnabled: true,
        };
      }

      // 3. Execute Pass 1
      info(MOD, 'processGeometry', 'Executing Pass 1 (Base Resolution)...');
      const result1 = resolveOverlaps(groups, pass1Config);
      finalGroups = result1.groups;
      finalAnomalies = result1.anomalies;

      // 4. Execute Pass 2 (Optional - Repair Only)
      if (pipelineMode === 'repair' && multiPass) {
        info(MOD, 'processGeometry', 'Executing Pass 2 (Looser Tolerance / Aggressive Fill)...');

        const pass2Config = JSON.parse(JSON.stringify(config));
        const baseTol = settings.continuityTolerance ?? 0.5;

        pass2Config.coordinateSettings.continuityTolerance = baseTol * 5.0;
        pass2Config.coordinateSettings.overlapResolution = {
            ...pass2Config.coordinateSettings.overlapResolution,
            gapFillEnabled: true,
            minPipeLength: 1.0,
            ignoreSupports: true,
        };

        const result2 = resolveOverlaps(finalGroups, pass2Config);
        finalGroups = result2.groups;
        finalAnomalies = [...finalAnomalies, ...result2.anomalies];
      }
  }

  // Deduplicate anomalies
  const uniqueAnomalies = [];
  const seenIds = new Set();
  for (const a of finalAnomalies) {
    if (!seenIds.has(a.id)) {
      seenIds.add(a.id);
      uniqueAnomalies.push(a);
    }
  }

  return { groups: finalGroups, anomalies: uniqueAnomalies };
};
