/**
 * DiagnosticLogger — Utility for logging detailed mapping diagnostics
 * Tracks header detection, SmartProcessMap mapping, RigidType/Material matching,
 * and generates summary statistics.
 */

export class DiagnosticLogger {
    constructor() {
        this.logs = [];
        this.stats = {
            totalComponents: 0,
            linelistMatches: 0,
            rigidTypeMatches: 0,
            materialMatches: 0,
            materialLevel1: 0,
            materialLevel2: 0,
            materialLevel3: 0,
            warnings: 0,
            errors: 0
        };
        this.currentComponent = null;
    }

    reset() {
        this.logs = [];
        this.stats = {
            totalComponents: 0,
            linelistMatches: 0,
            rigidTypeMatches: 0,
            materialMatches: 0,
            materialLevel1: 0,
            materialLevel2: 0,
            materialLevel3: 0,
            warnings: 0,
            errors: 0
        };
        this.currentComponent = null;
    }

    startComponent(index, type) {
        this.stats.totalComponents++;
        this.currentComponent = { index, type };
        this.logs.push(`\n[Component #${index + 1}: ${type}]`);
    }

    success(message) {
        this.logs.push(`  ✅ ${message}`);
    }

    error(message) {
        this.logs.push(`  ❌ ${message}`);
        this.stats.errors++;
    }

    warn(message) {
        this.logs.push(`  ⚠️ ${message}`);
        this.stats.warnings++;
    }

    info(message) {
        this.logs.push(`  ℹ️ ${message}`);
    }

    assumption(message) {
        this.logs.push(`  🔶 ${message}`);
    }

    // Specific logging methods
    logDNExtraction(dn) {
        this.success(`DN extracted: ${dn} from comp.bore`);
    }

    logLinelistMatch(lineNo, service) {
        this.success(`Linelist match: Line No "${lineNo}" (Service: "${service}")`);
        this.stats.linelistMatches++;
    }

    logLinelistNoMatch(lineNo) {
        this.error(`No linelist match for Line No: "${lineNo || 'N/A'}"`);
    }

    logSmartMapSuccess(attr, column, value) {
        this.success(`${attr} mapped from "${column}" → ${value}`);
    }

    logSmartMapFail(attr, column) {
        this.error(`${attr} mapping failed: column "${column}" not found or not configured`);
    }

    logSmartMapFuzzy(attr, column, value) {
        this.warn(`${attr} mapped from "${column}" → ${value} (fuzzy match: possible whitespace)`);
    }

    logSmartMapDefault(attr, value) {
        this.assumption(`${attr} using default/fallback value: ${value}`);
    }

    logInsDenDefault(insThk) {
        if (insThk > 0) {
            this.assumption(`ATTRIBUTE6 (InsDen): InsThk=${insThk} > 0 → Applying default 210`);
        } else {
            this.info(`ATTRIBUTE6 (InsDen): InsThk=${insThk} = 0 → Blank`);
        }
    }

    logDensityResolution(phase, preference, value) {
        if (value) {
            this.success(`Density: Phase="${phase}" → Using ${preference} density: ${value}`);
        } else {
            this.assumption(`Density: Phase not found or invalid, using default fallback`);
        }
    }

    logRigidTypeMatch(dn, len, tolerance, diff, typeDesc, weight) {
        this.success(`RigidType match: DN=${dn}, Len=${len.toFixed(1)}mm (±${tolerance}mm, diff=${diff.toFixed(1)}mm) → "${typeDesc}", Weight: ${weight}kg`);
        this.stats.rigidTypeMatches++;
    }

    logRigidTypeNoMatch(dn, len) {
        this.error(`No RigidType match for DN=${dn}, Len=${len.toFixed(1)}mm`);
    }

    logMaterialMatch(dn, pipingClass, level, material, wall) {
        const levelNames = { 1: 'Exact', 2: 'Trim 1 char + *', 3: 'Trim 2 chars + *' };
        const levelName = levelNames[level] || `Level ${level}`;

        if (level === 1) {
            this.success(`Material match: DN=${dn}, Class="${pipingClass}" (Level 1: ${levelName}) → Material: "${material}", Wall: ${wall}`);
            this.stats.materialLevel1++;
        } else {
            this.warn(`Material match: DN=${dn}, Class="${pipingClass}" (Level ${level}: ${levelName}) → Material: "${material}", Wall: ${wall}`);
            if (level === 2) this.stats.materialLevel2++;
            if (level === 3) this.stats.materialLevel3++;
        }
        this.stats.materialMatches++;
    }

    logMaterialNoMatch(dn, pipingClass) {
        this.error(`No Material match for DN=${dn}, Class="${pipingClass}" (tried all 3 levels)`);
    }

    logHeaderDetection(type, headers, missing = []) {
        if (missing.length === 0) {
            this.success(`${type} headers detected: ${headers.slice(0, 3).join(', ')}${headers.length > 3 ? '...' : ''}`);
        } else {
            this.warn(`${type} missing headers: ${missing.join(', ')}`);
        }
    }

    // Generate summary
    getSummary() {
        const lines = [];
        lines.push('\n═══════════════════════════════════════');
        lines.push('MAPPING SUMMARY');
        lines.push('═══════════════════════════════════════');
        lines.push(`Total Components: ${this.stats.totalComponents}`);
        lines.push(`Linelist Matches: ${this.stats.linelistMatches} (${this._percent(this.stats.linelistMatches, this.stats.totalComponents)})`);
        lines.push(`RigidType Matches: ${this.stats.rigidTypeMatches} (${this._percent(this.stats.rigidTypeMatches, this.stats.totalComponents)})`);
        lines.push(`Material Matches: ${this.stats.materialMatches} (${this._percent(this.stats.materialMatches, this.stats.totalComponents)})`);
        if (this.stats.materialMatches > 0) {
            lines.push(`  - Level 1 (Exact): ${this.stats.materialLevel1}`);
            lines.push(`  - Level 2 (Trim 1): ${this.stats.materialLevel2}`);
            lines.push(`  - Level 3 (Trim 2): ${this.stats.materialLevel3}`);
        }
        lines.push(`Warnings: ${this.stats.warnings}`);
        lines.push(`Errors: ${this.stats.errors}`);
        lines.push('═══════════════════════════════════════');
        return lines.join('\n');
    }

    _percent(count, total) {
        return total > 0 ? `${Math.round((count / total) * 100)}%` : '0%';
    }

    // Get HTML formatted output
    getHTML() {
        const logText = this.logs.join('\n');
        const summary = this.getSummary();

        // Color coding
        let html = (logText + '\n' + summary)
            .replace(/✅/g, '<span style="color:var(--green-ok)">✅</span>')
            .replace(/❌/g, '<span style="color:var(--red-err)">❌</span>')
            .replace(/⚠️/g, '<span style="color:var(--yellow-warn)">⚠️</span>')
            .replace(/🔶/g, '<span style="color:var(--amber)">🔶</span>')
            .replace(/ℹ️/g, '<span style="color:var(--blue)">ℹ️</span>');

        return html;
    }
}
