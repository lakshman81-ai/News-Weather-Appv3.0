/**
 * direction-calc.js — Dominant axis and direction detection
 * Used for MESSAGE-SQUARE annotation text.
 * Pure functions, no side effects.
 *
 * Exports:
 *   dominantDirection(p1, p2)   → 'NORTH'|'SOUTH'|'EAST'|'WEST'|'UP'|'DOWN'
 *   directionText(p1, p2)       → string e.g. "NORTH" or "NORTH AND UP"
 *   componentLength(p1, p2)     → number (mm)
 */

// ── DIRECTION MAP ─────────────────────────────────────────────────────────
// Maps axis + sign to direction name
const AXIS_DIRECTION = {
  E_pos: 'EAST', E_neg: 'WEST',
  N_pos: 'NORTH', N_neg: 'SOUTH',
  U_pos: 'UP', U_neg: 'DOWN',
};

/**
 * Compute delta vector between two points.
 * @param {{E:number,N:number,U:number}} p1
 * @param {{E:number,N:number,U:number}} p2
 * @returns {{dE:number, dN:number, dU:number}}
 */
const _delta = (p1, p2) => ({
  dE: p2.E - p1.E,
  dN: p2.N - p1.N,
  dU: p2.U - p1.U,
});

/**
 * Return the single dominant direction of travel from p1 to p2.
 * Dominant = axis with largest absolute delta.
 * @param {{E:number,N:number,U:number}} p1
 * @param {{E:number,N:number,U:number}} p2
 * @returns {string}
 */
export const dominantDirection = (p1, p2) => {
  const { dE, dN, dU } = _delta(p1, p2);
  const axes = [
    { key: 'E', val: dE },
    { key: 'N', val: dN },
    { key: 'U', val: dU },
  ];
  const dominant = axes.reduce((max, a) => Math.abs(a.val) > Math.abs(max.val) ? a : max, axes[0]);
  const sign = dominant.val >= 0 ? 'pos' : 'neg';
  return AXIS_DIRECTION[`${dominant.key}_${sign}`] ?? 'UNKNOWN';
};

/**
 * Return direction text for MESSAGE-SQUARE.
 * If two axes have similar magnitudes (within 20%), show both.
 * @param {{E:number,N:number,U:number}} p1
 * @param {{E:number,N:number,U:number}} p2
 * @returns {string}  e.g. "NORTH" or "NORTH AND UP"
 */
export const directionText = (p1, p2) => {
  const { dE, dN, dU } = _delta(p1, p2);
  const axes = [
    { key: 'E', val: dE },
    { key: 'N', val: dN },
    { key: 'U', val: dU },
  ].sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

  const primary = axes[0];
  const secondary = axes[1];

  const primaryName = AXIS_DIRECTION[`${primary.key}_${primary.val >= 0 ? 'pos' : 'neg'}`];

  // Show secondary if it's at least 30% of the primary magnitude
  if (Math.abs(primary.val) > 0 &&
    Math.abs(secondary.val) / Math.abs(primary.val) >= 0.30) {
    const secondaryName = AXIS_DIRECTION[`${secondary.key}_${secondary.val >= 0 ? 'pos' : 'neg'}`];
    return `${primaryName} AND ${secondaryName}`;
  }

  return primaryName ?? 'UNKNOWN';
};

/**
 * 3D Euclidean distance (component physical length).
 * @param {{E:number,N:number,U:number}} p1
 * @param {{E:number,N:number,U:number}} p2
 * @returns {number}  mm
 */
export const componentLength = (p1, p2) => {
  const { dE, dN, dU } = _delta(p1, p2);
  return Math.sqrt(dE * dE + dN * dN + dU * dU);
};

/**
 * Detect if travel from p1 to p2 is "skew" — significant movement on 2+ axes.
 * Used to identify 90-degree elbows that are missing a CENTRE-POINT.
 * @param {{E:number,N:number,U:number}} p1
 * @param {{E:number,N:number,U:number}} p2
 * @param {number} [threshold=6]  mm — minimum displacement to count as movement
 * @returns {boolean}
 */
export const isSkew = (p1, p2, threshold = 6) => {
  const { dE, dN, dU } = _delta(p1, p2);
  let axes = 0;
  if (Math.abs(dE) > threshold) axes++;
  if (Math.abs(dN) > threshold) axes++;
  if (Math.abs(dU) > threshold) axes++;
  return axes >= 2;
};

/**
 * Infer the corner (centre) point for a 90-degree elbow with skew travel.
 * Heuristic: travel along the primary axis first, then turn.
 * For a 2D turn in the EN plane: corner = (p2.E, p1.N, p1.U).
 * For a 2D turn in the EU plane: corner = (p2.E, p1.N, p1.U).
 * General: the axis with largest delta uses the destination value; others keep the source value.
 * @param {{E:number,N:number,U:number}} p1
 * @param {{E:number,N:number,U:number}} p2
 * @param {number} [threshold=6]  mm
 * @returns {{E:number,N:number,U:number}}  inferred corner point
 */
export const inferCorner = (p1, p2, threshold = 6) => {
  const { dE, dN, dU } = _delta(p1, p2);
  const axes = [
    { key: 'E', abs: Math.abs(dE) },
    { key: 'N', abs: Math.abs(dN) },
    { key: 'U', abs: Math.abs(dU) },
  ].filter(a => a.abs > threshold)
    .sort((a, b) => b.abs - a.abs);

  // Corner takes the destination value for the primary (largest) axis,
  // and keeps the source value for the other axes.
  const corner = { E: p1.E, N: p1.N, U: p1.U };
  if (axes.length >= 1) {
    corner[axes[0].key] = p2[axes[0].key];
  }
  return corner;
};
