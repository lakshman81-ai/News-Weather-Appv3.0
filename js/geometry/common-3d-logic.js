/**
 * common-3d-logic.js — Geometric validation rules for PCF connections.
 * Encapsulates user-defined ground rules for cleanup and modularization.
 */

const MOD = 'common-3d-logic';

export const Common3DLogic = {
    // Default Fallbacks
    DEFAULTS: {
        MAX_OVERLAP: 1000,
        CONTINUITY_TOL: 6.0,
        MAX_CONTINUITY_TOL: 25.0,
        MIN_PIPE_SIZE: 50,
        MIN_COMPONENT_SIZE: 3,
        MAX_PIPE_RUN: 30000,
        SKEW_3PLANE_LIMIT: 2000,
        SKEW_2PLANE_LIMIT: 15000,
    },

    /**
     * Skew in XZ (Horizontal) is seldom valid.
     */
    isXZSkew: (v) => Math.abs(v.N) < 1e-9 && Math.abs(v.E) > 1e-9 && Math.abs(v.U) > 1e-9,

    /**
     * Validate a potential connection between two points.
     * @param {object} p1 - {E, N, U}
     * @param {object} p2 - {E, N, U}
     * @param {number} bore - Pipe Bore (mm)
     * @param {object} config - Application Config object (optional)
     * @returns {object} { valid: boolean, reason: string, warn: boolean }
     */
    validateConnection: (p1, p2, bore, config) => {
        const settings = config?.coordinateSettings?.common3DLogic ?? Common3DLogic.DEFAULTS;
        const maxRun = settings.maxPipeRun ?? Common3DLogic.DEFAULTS.MAX_PIPE_RUN;
        const skew3Lim = settings.skew3PlaneLimit ?? Common3DLogic.DEFAULTS.SKEW_3PLANE_LIMIT;
        const skew2Lim = settings.skew2PlaneLimit ?? Common3DLogic.DEFAULTS.SKEW_2PLANE_LIMIT;

        const dx = p2.E - p1.E;
        const dy = p2.N - p1.N;
        const dz = p2.U - p1.U;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const vec = len > 1e-9 ? { E: dx/len, N: dy/len, U: dz/len } : { E:0, N:0, U:0 };

        // 9a. Max Run Check
        if (len > maxRun) {
            return { valid: false, reason: `Length ${len.toFixed(0)}mm > Max ${maxRun}mm` };
        }

        // Skew Checks
        const isSkewX = Math.abs(vec.E) > 1e-9 && Math.abs(vec.E) < 1.0;
        const isSkewY = Math.abs(vec.N) > 1e-9 && Math.abs(vec.N) < 1.0;
        const isSkewZ = Math.abs(vec.U) > 1e-9 && Math.abs(vec.U) < 1.0;
        const skewCount = (isSkewX ? 1 : 0) + (isSkewY ? 1 : 0) + (isSkewZ ? 1 : 0);

        // 2. XZ Skew Check (Horizontal skew, N is 0)
        if (Math.abs(vec.N) < 1e-9 && isSkewX && isSkewZ) {
             return { valid: false, reason: 'XZ Skew detected (seldom valid)', warn: true };
        }

        // 9b. 3-Plane Skew
        if (skewCount === 3) {
            if (len > skew3Lim) {
                return { valid: false, reason: `3-Plane Skew > ${skew3Lim}mm`, warn: true };
            }
        }

        // 9c. 2-Plane Skew
        if (skewCount === 2) {
            if (len > skew2Lim) {
                return { valid: false, reason: `2-Plane Skew > ${skew2Lim}mm` };
            }
        }

        return { valid: true };
    },

    /**
     * Check for rollback (U-turn).
     * @param {object} currentVec - Normalized vector of current pipe segment
     * @param {object} prevVec - Normalized vector of previous segment
     * @returns {boolean} true if rollback detected
     */
    isRollback: (currentVec, prevVec) => {
        if (!prevVec) return false;
        // Dot product close to -1 means opposite direction
        const dot = currentVec.E * prevVec.E + currentVec.N * prevVec.N + currentVec.U * prevVec.U;
        return dot < -0.99;
    }
};
