/**
 * pcf-stitcher.js — Stitch component endpoints together and log gaps/warnings
 * Ported from 3Dmodelgeneratorforpcf_Stitcher.js (React) to vanilla JS.
 *
 * Exports:
 *   Stitcher class
 */

export class Stitcher {
    constructor(tolerance = 6.0) {
        this.tolerance = tolerance;
        this.logs = [];
    }

    /** @private */
    _log(msg, type = 'INFO') {
        this.logs.push({
            timestamp: new Date().toLocaleTimeString(),
            type,
            message: msg,
        });
    }

    /**
     * Process parsed components: snap nearby endpoints and log gaps.
     * @param {object[]} rawComponents — from parsePcf()
     * @returns {{ components: object[], logs: object[] }}
     */
    process(rawComponents) {
        this.logs = [];
        this._log(`Starting stitch for ${rawComponents.length} components. Tolerance: ${this.tolerance}mm`);

        // Deep clone to avoid mutating originals
        const comps = JSON.parse(JSON.stringify(rawComponents));

        // Distance squared helper
        const distSq = (p1, p2) =>
            (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2;

        // Pass 1: Build connection lists
        comps.forEach((c, idx) => {
            c._idx = idx;
            c.connections = [];

            if (c.points) {
                c.points.forEach((p, i) => c.connections.push({ ...p, type: 'END', index: i }));
            }
            if (c.centrePoint) c.connections.push({ ...c.centrePoint, type: 'CENTRE' });
            if (c.branch1Point) c.connections.push({ ...c.branch1Point, type: 'BRANCH' });
            if (c.coOrds) c.connections.push({ ...c.coOrds, type: 'CO-ORDS' });
        });

        // Pass 2: Connectivity — snap nearby endpoints
        const unmatchedPoints = [];
        const tolSq = this.tolerance ** 2;

        comps.forEach(c1 => {
            c1.connections.forEach(p1 => {
                let matchFound = false;

                for (const c2 of comps) {
                    if (c1.id === c2.id) continue;

                    for (const p2 of c2.connections) {
                        const d2 = distSq(p1, p2);
                        if (d2 < 0.001) {
                            matchFound = true;
                            break;
                        } else if (d2 <= tolSq) {
                            matchFound = true;
                            this._log(
                                `Gap bridged: ${Math.sqrt(d2).toFixed(2)}mm between ${c1.type}#${c1._idx} and ${c2.type}#${c2._idx}`,
                                'WARN'
                            );
                            // Snap p1 to p2 for cleaner rendering
                            p1.x = p2.x;
                            p1.y = p2.y;
                            p1.z = p2.z;
                            break;
                        }
                    }
                    if (matchFound) break;
                }

                if (!matchFound) {
                    unmatchedPoints.push({ component: c1, point: p1 });
                }
            });
        });

        this._log(`Found ${unmatchedPoints.length} terminal points (open ends).`);
        this._log(`Stitch complete. ${comps.length} components processed.`, 'SUCCESS');

        return {
            components: comps,
            logs: this.logs,
        };
    }
}
