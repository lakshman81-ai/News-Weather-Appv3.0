/**
 * snapper.js — Sequential Snapping & Gap Filling
 * Implements "Robust Sequential" logic:
 * 1. Iterates components in input order.
 * 2. Snaps Start Point to Previous End Point if gap < Tolerance.
 * 3. Fills Gap with PIPE if gap > Tolerance.
 */

import { distance3D } from './coord-engine.js';
import { info, warn } from '../logger.js';

const MOD = 'snapper';

/**
 * Run sequential snapping and gap filling.
 * @param {Map<string, ComponentGroup>} groups
 * @param {number} tolerance (mm)
 * @returns {Map<string, ComponentGroup>}
 */
export const snapSequential = (groups, tolerance) => {
  const result = new Map();
  const list = [...groups.values()]; // Assumes insertion order = input order
  if (list.length === 0) return groups;

  let prevEnd = null;
  let gapCount = 0;
  let snapCount = 0;

  for (const group of list) {
    if (group.skip) {
      result.set(group.refno, group);
      continue;
    }

    const p1 = group.pts?.['1']; // Start
    const p2 = group.pts?.['2']; // End

    // Determine Entry/Exit
    // For sequential logic, we assume Point 1 is Entry, Point 2 is Exit.
    // (If not, we might need logic to flip, but simple CSVs usually follow 1->2 flow).

    if (!p1) {
        // Support or singleton? Just add it.
        // Update prevEnd? If it's on the line, maybe.
        // For ANCI/SUPPORT, they usually sit *on* the pipe, not break it.
        // If we treat them as breaking, we get the "spider web" if we bridge to them.
        // "Robust Sequential" usually ignores Supports for connectivity chain.
        if (group.pcfType !== 'SUPPORT' && group.pcfType !== 'ANCI') {
             // Reset chain if we hit a weird component without P1
             prevEnd = null;
        }
        result.set(group.refno, group);
        continue;
    }

    if (prevEnd) {
      const d = distance3D(prevEnd, p1);

      if (d > 0.001) { // If not already perfect
        if (d <= tolerance) {
          // Snap!
          // Modify p1 to match prevEnd
          group.pts['1'] = { ...p1, E: prevEnd.E, N: prevEnd.N, U: prevEnd.U };
          snapCount++;
        } else {
          // Gap Fill!
          // Insert implicit pipe
          const gapRef = `_gap_${gapCount++}`;
          const gapPipe = {
            refno: gapRef,
            pcfType: 'PIPE',
            csvType: 'PIPE',
            skip: false,
            pts: {
              '1': { ...prevEnd, bore: p1.bore }, // Inherit bore from next component
              '2': { ...p1, bore: p1.bore }
            }
          };
          result.set(gapRef, gapPipe);
          info(MOD, 'snapSequential', `Filled gap ${d.toFixed(1)}mm with ${gapRef}`);
        }
      }
    }

    // Update PrevEnd
    // If component is a PIPE/FITTING, the flow continues from P2.
    // If component is SUPPORT, flow continues from P1 (it's a point on line).
    // Actually, supports in CSVs usually have P1/P2 if they are "length" supports, or P0 if point.
    // If P2 exists, use it.
    if (p2) {
        prevEnd = group.pts['2'];
    } else {
        // Point component (Blind? Cap? Support?)
        // If it's a Cap/Blind, flow stops.
        // If it's a Support, flow *should* have continued through the pipe it's on.
        // But in sequential list, the Support often appears *after* the Pipe or *between* Pipes.
        // If between, and it has no length, we should probably keep prevEnd as is (the end of the previous pipe).
        if (group.pcfType !== 'SUPPORT' && group.pcfType !== 'ANCI') {
            prevEnd = null; // Break chain
        }
    }

    result.set(group.refno, group);
  }

  info(MOD, 'snapSequential', `Snapped ${snapCount} joints. Filled ${gapCount} gaps.`);
  return result;
};
