/**
 * table-log.js — Render parsed PCF components as an HTML data table
 * Ported from 3Dmodelgeneratorforpcf_TableLog.jsx (React) to vanilla JS.
 *
 * Exports:
 *   renderTable(containerEl, components) — renders table into container
 */

// ── Helpers ────────────────────────────────────────────────────────

const fmt = (p) => p ? `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}` : '';

const calcVec = (start, end) => {
    if (!start || !end) return { axis: '', len: '' };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(1);

    const axisNames = [];
    if (Math.abs(dx) > 0.1) axisNames.push(dx > 0 ? 'EAST' : 'WEST');
    if (Math.abs(dy) > 0.1) axisNames.push(dy > 0 ? 'NORTH' : 'SOUTH');
    if (Math.abs(dz) > 0.1) axisNames.push(dz > 0 ? 'UP' : 'DOWN');

    return { axis: axisNames.join(' '), len };
};

// ── Main render function ───────────────────────────────────────────

/**
 * Render a data table of parsed PCF components into a container.
 * @param {HTMLElement} containerEl
 * @param {object[]}   components — from stitcher output
 */
export const renderTable = (containerEl, components) => {
    if (!containerEl) return;

    const rows = components.map(comp => {
        const { type, points, centrePoint, branch1Point } = comp;
        const start = (points && points[0]) ? points[0] : (centrePoint || { x: 0, y: 0, z: 0 });

        let axis1 = '', axis2 = '', axis3 = '';
        let len1 = '', len2 = '', len3 = '';

        if (type === 'PIPE' || type === 'FLANGE' || type === 'VALVE') {
            if (points && points.length > 1) {
                const v = calcVec(points[0], points[1]);
                axis1 = v.axis; len1 = v.len;
            }
        } else if (type === 'ELBOW' || type === 'BEND') {
            if (points && points.length > 1 && centrePoint) {
                const v1 = calcVec(points[0], centrePoint);
                const v2 = calcVec(centrePoint, points[1]);
                axis1 = v1.axis; len1 = v1.len;
                axis2 = v2.axis; len2 = v2.len;
            } else if (points && points.length > 1) {
                const v = calcVec(points[0], points[1]);
                axis1 = v.axis; len1 = v.len;
            }
        } else if (type === 'TEE') {
            if (points && points.length > 1 && centrePoint) {
                const v1 = calcVec(points[0], centrePoint);
                const v2 = calcVec(centrePoint, points[1]);
                axis1 = v1.axis; len1 = v1.len;
                axis2 = v2.axis; len2 = v2.len;
                if (branch1Point) {
                    const v3 = calcVec(centrePoint, branch1Point);
                    axis3 = v3.axis; len3 = v3.len;
                }
            }
        }

        return `<tr>
      <td>${type}</td>
      <td class="num">${fmt(start)}</td>
      <td>${axis1}</td>
      <td>${axis2}</td>
      <td>${axis3}</td>
      <td class="num">${len1}</td>
      <td class="num">${len2}</td>
      <td class="num">${len3}</td>
    </tr>`;
    });

    containerEl.innerHTML = `
    <div class="data-table-wrap" style="max-height:100%;overflow:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Start Coords</th>
            <th>Axis 1</th>
            <th>Axis 2</th>
            <th>Axis 3</th>
            <th>Len 1</th>
            <th>Len 2</th>
            <th>Len 3</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.join('') : '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">No components to display</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
};
