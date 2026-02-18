import { parsePcf } from '../viewer/pcf-parser.js';
import { getState, setState, subscribe } from '../state.js';
import { mappingService } from '../services/mapping-service.js';
import { linelistService } from '../services/linelist-service.js';
import { dataManager } from '../services/data-manager.js';
import { DiagnosticLogger } from '../utils/diagnostic-logger.js';
import { getConfig } from '../config/config-store.js';

/**
 * PcfTableController — Enhanced "PCF in Table Form" tab
 *
 * Displays PCF components in an EDITABLE 21-column table combining:
 * - 3D Viewer columns (Component, Coords, Axis/Len 1-3)
 * - DN (bore)
 * - Line No. (Derived) — from coordinate matching with Line Dump (±tolerance)
 * - SmartProcessMap attributes from Linelist (P1, T1, InsThk, InsDen, Density, HP, PipingClass)
 * - RigidTypeMapping from Weight Master (Rigid Type, Weight)
 * - MaterialMapping from Piping Class Master (Material, Wall)
 *
 * Features:
 * - Editable cells (contenteditable)
 * - Excel-like copy/paste support
 * - PCF regeneration from edited table data
 * - Comprehensive diagnostic logging
 */

export class PcfTableController {
    constructor() {
        this.container = document.getElementById('pcf-table-container');
        this.refreshBtn = document.getElementById('btn-refresh-table');
        this.exportBtn = document.getElementById('btn-export-table');
        this.regenerateBtn = document.getElementById('btn-regenerate-pcf');
        this.exportPhase1Btn = document.getElementById('btn-export-phase1');
        this.nextBtn = document.getElementById('btn-next-phase2');
        this.toleranceInput = document.getElementById('pcf-table-tolerance');
        this.logContainer = document.getElementById('mapping-diagnostic-log');
        this.clearLogBtn = document.getElementById('btn-clear-mapping-log');

        this.logger = new DiagnosticLogger();
        this.tableData = []; // Editable data store
        this.headers = [];
        this.parsedComponents = []; // Parsed PCF components for regeneration

        if (this.refreshBtn) this.refreshBtn.addEventListener('click', () => this.render());
        if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.exportCSV());
        if (this.regenerateBtn) this.regenerateBtn.addEventListener('click', () => this._showDefaultsPopup());
        if (this.exportPhase1Btn) this.exportPhase1Btn.addEventListener('click', () => this.exportPhase1PCF());
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this._handleNextPhase2());
        if (this.clearLogBtn) this.clearLogBtn.addEventListener('click', () => this.clearLog());

        // Disable Next button by default - enable after Regenerate is clicked
        if (this.nextBtn) {
            this.nextBtn.disabled = true;
            this.nextBtn.style.opacity = '0.5';
            this.nextBtn.style.cursor = 'not-allowed';
        }

        // Auto-render on state update
        subscribe('pcfLines', () => this.render());

        // Initial render if data exists
        const lines = getState('pcfLines');
        if (lines && lines.length > 0) this.render();
    }

    clearLog() {
        this.logger.reset();
        if (this.logContainer) {
            this.logContainer.innerHTML = '<span style="color:var(--text-muted)">Click Refresh to see detailed mapping diagnostics...</span>';
        }
    }

    render() {
        // Skip re-render if regeneration is in progress (prevents wiping edits)
        if (this._regenerating) return;

        console.log('[PcfTableController] Starting render with diagnostic logging...');
        this.logger.reset();

        const pcfLines = getState('pcfLines');
        if (!pcfLines || pcfLines.length === 0) {
            this.container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">No data available. Convert components first.</div>';
            return;
        }

        // Parse PCF
        const rawText = pcfLines.join('\n');
        const components = parsePcf(rawText);
        this.parsedComponents = components; // Store for regeneration

        if (components.length === 0) {
            this.container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted)">No components found in PCF.</div>';
            return;
        }

        // Get configuration
        const tolerance = parseFloat(this.toleranceInput?.value || '6');
        const linelistState = getState('linelist') || {};
        const smartMapping = linelistState.smartMapping || {};
        const smartOptions = linelistState.smartOptions || {};
        const linelistData = linelistService.getData();

        // Build Line Dump coordinate lookup for Line No. (Derived)
        const lineDumpData = dataManager.getLineDump() || [];
        const dumpCoordTolerance = parseFloat(this.toleranceInput?.value || '25');

        // Headers — 22 columns
        this.headers = [
            'Component', 'Start Coords', 'DN (Bore)', 'Line No. (Derived)',
            'Axis 1', 'Len 1', 'Axis 2', 'Len 2', 'Axis 3', 'Len 3',
            'P1 (ATTR1)', 'T1 (ATTR2)', 'Ins Thk (ATTR5)', 'Ins Den (ATTR6)',
            'Density (ATTR9)', 'HP (ATTR10)', 'Piping Class',
            'Rigid Type', 'Weight (ATTR8)', 'Material (ATTR3)', 'Wall Thk (ATTR4)',
            'Support Name'
        ];

        // Build table
        const table = document.createElement('table');
        table.className = 'data-table editable-table';
        table.id = 'pcf-editable-table';

        // Headers
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        this.headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            if (h === 'Line No. (Derived)') {
                th.style.color = 'var(--amber)';
                th.style.fontWeight = '700';
            }
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        this.tableData = []; // Reset editable store

        // Process each component
        components.forEach((comp, idx) => {
            // Skip non-actionable structure components (like MESSAGE-SQUARE)
            // But push null to tableData to keep indices aligned for regeneration
            if (comp.type === 'MESSAGE-SQUARE') {
                this.tableData.push(null);
                return;
            }

            this.logger.startComponent(idx, comp.type);

            const tr = document.createElement('tr');

            // ── Column 1: Component Type ────
            const type = comp.type;

            // ── Column 2: Start Coords (Fix A: SUPPORT uses CO-ORDS not END-POINT) ────
            const startPoint = (comp.points && comp.points[0]) ? comp.points[0] : (comp.coOrds || comp.centrePoint || { x: 0, y: 0, z: 0 });
            const coords = `${startPoint.x.toFixed(1)}, ${startPoint.y.toFixed(1)}, ${startPoint.z.toFixed(1)}`;

            // ── Column 3: DN (Bore) ────
            const dn = comp.bore || 0;
            this.logger.logDNExtraction(dn);

            // ── Column 4: Line No. (Derived) via coordinate matching with Line Dump ────
            const derivedLineNo = this.matchLineDump(startPoint, lineDumpData, dumpCoordTolerance);

            // ── Columns 5-10: Axis & Length ────
            const { axis1, len1, axis2, len2, axis3, len3 } = this.calcAxisAndLength(comp);

            // ── CRITICAL: Do NOT read COMPONENT-ATTRIBUTEs from Phase 1 PCF ────
            // We only use Phase 1 PCF for geometry (coords, bore, type)
            // Attributes should come ONLY from linelist or be empty (for popup to fill with defaults)
            const pcfAttrs = comp.attributes || {};

            // Only read non-attribute data from PCF (geometry, rigid type, etc.)
            const rigidType = pcfAttrs['RIGID-TYPE'] || '';
            const pipelineRef = pcfAttrs['PIPELINE-REFERENCE'] || pcfAttrs['COMPONENT-ATTRIBUTE99'] || '';

            // Robust Linelist Lookup
            // Strategy: 1. Derived Line No (Geometric) -> 2. PCF Pipeline Ref
            //           + Service (if available) -> Composite Key Fallback
            const lookupQuery = {
                LineNo: derivedLineNo || pipelineRef,
                Service: pcfAttrs['SERVICE'] || ''
            };

            const linelistRow = linelistService.findMatchedRow({ raw: lookupQuery });

            let p1 = '', t1 = '', insThk = '', insDen = '';
            let density = '', hp = '', pipingClass = '';
            let material = '', wall = '';

            // ONLY read from linelist, NOT from Phase 1 PCF
            if (linelistRow) {
                // Log success (using mapped service column or generic 'Found')
                this.logger.logLinelistMatch(lookupQuery.LineNo, "Found via " + (lookupQuery.Service ? "Composite" : "Simple"));

                p1 = this.getSmartMappedValue(linelistRow, smartMapping.P1, 'P1');
                t1 = this.getSmartMappedValue(linelistRow, smartMapping.T1, 'T1');
                insThk = this.getSmartMappedValue(linelistRow, smartMapping.InsThk, 'InsThk');
                hp = this.getSmartMappedValue(linelistRow, smartMapping.HP, 'HP');
                pipingClass = this.getSmartMappedValue(linelistRow, smartMapping.PipingClass, 'Piping Class');
                density = this.resolveDensity(linelistRow, smartMapping, smartOptions);

                // InsDen default (210 if InsThk > 0)
                if (!insDen) {
                    const insThkNum = parseFloat(insThk) || 0;
                    insDen = insThkNum > 0 ? '210' : '';
                }
            } else {
                this.logger.logLinelistNoMatch(lookupQuery.LineNo);
            }

            // Fix C: InsDen default 210 even without linelist (when InsThk > 0)
            if (!insDen && insThk) {
                const insThkNum = parseFloat(insThk) || 0;
                if (insThkNum > 0) insDen = '210';
            }

            // ── RigidTypeMapping ────
            const rigidResult = mappingService.resolveRigidType(dn, len1 || 0, tolerance);
            const rigidTypeResolved = rigidType || rigidResult.rigidType || '';
            const weight = rigidResult.weight || '';

            if (rigidTypeResolved && weight) {
                const diff = rigidResult._diff || 0;
                this.logger.logRigidTypeMatch(dn, len1 || 0, tolerance, diff, rigidTypeResolved, weight);
            } else {
                this.logger.logRigidTypeNoMatch(dn, len1 || 0);
            }

            // ── MaterialMapping ────
            const materialResult = mappingService.resolveMaterial(dn, pipingClass);
            material = materialResult.material || '';
            wall = materialResult.wall || '';

            if (material && wall) {
                const level = materialResult._level || 1;
                this.logger.logMaterialMatch(dn, pipingClass, level, material, wall);
            } else {
                this.logger.logMaterialNoMatch(dn, pipingClass);
            }

            // ── Fix B: Support Name column (default CA150 for SUPPORT types) ────
            const supportName = (type === 'SUPPORT')
                ? (pcfAttrs['<SUPPORT_NAME>'] || pcfAttrs['SUPPORT-NAME'] || 'CA150')
                : '';

            // ── Build Row Data (22 columns) ────
            const rowData = [
                type, coords, dn, derivedLineNo,
                axis1, len1?.toFixed(1) || '', axis2, len2?.toFixed(1) || '', axis3, len3?.toFixed(1) || '',
                p1, t1, insThk, insDen, density, hp, pipingClass,
                rigidTypeResolved, weight, material, wall,
                supportName
            ];

            // Store for editing
            this.tableData.push([...rowData]);

            // Create editable cells
            rowData.forEach((val, colIdx) => {
                const td = document.createElement('td');
                td.textContent = val;
                td.contentEditable = 'true';
                td.dataset.row = idx;
                td.dataset.col = colIdx;
                td.spellcheck = false;

                // Highlight derived column
                if (colIdx === 3 && val) {
                    td.style.color = 'var(--green-ok)';
                    td.style.fontWeight = '600';
                } else if (colIdx === 3 && !val) {
                    td.style.color = 'var(--red-err)';
                    td.style.fontStyle = 'italic';
                }

                // Track edits
                td.addEventListener('blur', (e) => {
                    const r = parseInt(e.target.dataset.row);
                    const c = parseInt(e.target.dataset.col);
                    const newVal = e.target.textContent.trim();
                    if (this.tableData[r]) {
                        this.tableData[r][c] = newVal;
                        // Visual feedback for edited cells
                        if (newVal !== String(rowData[c])) {
                            e.target.style.borderBottom = '2px solid var(--amber)';
                        }
                    }
                });

                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        this.container.innerHTML = '';
        this.container.appendChild(table);

        // Add paste handler for Excel-like paste support
        this.setupPasteHandler(table);

        // Add editable table CSS
        this.injectEditableStyles();

        // Auto-fill empty Weight values for FLANGE/VALVE immediately after render
        this._fillDefaultWeights();

        // Update diagnostic log
        this.updateLog();

        console.log('[PcfTableController] Render complete. Table is editable.');
    }

    /**
     * Match PCF component coordinates with Line Dump positions to derive Line No.
     * Uses ± tolerance for coordinate matching.
     */
    matchLineDump(point, lineDumpData, tolerance) {
        if (!point || !lineDumpData || lineDumpData.length === 0) return '';

        const px = point.x || 0;
        const py = point.y || 0;
        const pz = point.z || 0;

        let bestMatch = null;
        let bestDist = Infinity;

        for (const row of lineDumpData) {
            // Parse POSITION column: "E 95724mm N 16586.4mm U 4360mm"
            const posStr = row['POSITION'] || row['Position'] || '';
            const coords = this.parseDumpPosition(posStr);
            if (!coords) continue;

            // Calculate Euclidean distance
            const dx = px - coords.x;
            const dy = py - coords.y;
            const dz = pz - coords.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < tolerance && dist < bestDist) {
                bestDist = dist;
                bestMatch = row;
            }
        }

        if (bestMatch) {
            return bestMatch['Line No. (Derived)'] || bestMatch['LINE NO. (DERIVED)'] || '';
        }
        return '';
    }

    /**
     * Parse E3D position string like "E 95724mm N 16586.4mm U 4360mm"
     * Returns {x, y, z} in mm
     */
    parseDumpPosition(posStr) {
        if (!posStr) return null;
        const match = posStr.match(/[EWNS]?\s*([-\d.]+)\s*mm\s*[EWNS]?\s*([-\d.]+)\s*mm\s*[UDZ]?\s*([-\d.]+)\s*mm/i);
        if (match) {
            return {
                x: parseFloat(match[1]),
                y: parseFloat(match[2]),
                z: parseFloat(match[3])
            };
        }
        return null;
    }

    /**
     * Setup Excel-like paste handler for the editable table.
     * Supports pasting tab-separated values from Excel/clipboard.
     */
    setupPasteHandler(table) {
        table.addEventListener('paste', (e) => {
            e.preventDefault();
            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedText = clipboardData.getData('text');

            if (!pastedText) return;

            // Parse tab-separated values
            const rows = pastedText.split('\n').map(r => r.split('\t'));
            const startCell = e.target.closest('td');
            if (!startCell) return;

            const startRow = parseInt(startCell.dataset.row);
            const startCol = parseInt(startCell.dataset.col);

            // Apply pasted data to cells
            rows.forEach((rowValues, rOffset) => {
                const targetRow = startRow + rOffset;
                if (targetRow >= this.tableData.length) return;

                rowValues.forEach((val, cOffset) => {
                    const targetCol = startCol + cOffset;
                    if (targetCol >= this.headers.length) return;

                    const cleanVal = val.trim();
                    this.tableData[targetRow][targetCol] = cleanVal;

                    // Update DOM
                    const td = table.querySelector(`td[data-row="${targetRow}"][data-col="${targetCol}"]`);
                    if (td) {
                        td.textContent = cleanVal;
                        td.style.borderBottom = '2px solid var(--amber)';
                    }
                });
            });

            console.log(`[PcfTableController] Pasted ${rows.length} rows × ${rows[0]?.length || 0} cols starting at [${startRow}, ${startCol}]`);
        });
    }

    /**
     * Export Phase 1 PCF (original uploaded PCF) for comparison.
     * This is the PCF before any table edits or regeneration.
     */
    exportPhase1PCF() {
        const phase1Lines = getState('pcfLines') || [];

        if (phase1Lines.length === 0) {
            alert('No Phase 1 PCF available. Please upload a PCF file first.');
            return;
        }

        const pcfText = phase1Lines.join('\n');
        const blob = new Blob([pcfText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'phase1_original.pcf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log(`[PcfTableController] Exported Phase 1 PCF: ${phase1Lines.length} lines.`);
    }

    /**
     * Inject CSS for editable table styling
     */
    injectEditableStyles() {
        if (document.getElementById('editable-table-styles')) return;
        const style = document.createElement('style');
        style.id = 'editable-table-styles';
        style.textContent = `
            .editable-table td {
                cursor: text;
                outline: none;
                transition: background-color 0.15s ease;
                min-width: 50px;
                white-space: nowrap;
            }
            .editable-table td:focus {
                background-color: rgba(59, 130, 246, 0.15) !important;
                outline: 2px solid var(--amber);
                outline-offset: -1px;
            }
            .editable-table td:hover {
                background-color: rgba(255, 255, 255, 0.03);
            }
            .editable-table td[data-col="3"] {
                font-family: var(--font-code);
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Handle "Next" button click - auto-generate Phase 2 PCF and switch to Output tab.
     * This generates the final PCF from the edited table data and shows it in the preview.
     */
    _handleNextPhase2() {
        console.log('[PcfTableController] Next button clicked!');

        if (!this.tableData || this.tableData.length === 0) {
            alert('No table data available. Please refresh the table first.');
            return;
        }

        console.log('[PcfTableController] Generating Phase 2 PCF from table...');

        // Generate Phase 2 PCF from table data
        this.regeneratePCF();

        // Switch to Output tab to show preview
        const outputTab = document.getElementById('tab-output');
        if (outputTab) {
            outputTab.click();
            console.log('[PcfTableController] Switched to Output tab.');
        } else {
            console.warn('[PcfTableController] Output tab button not found!');
        }
    }

    /**
     * Re-render table DOM from this.tableData (without re-parsing PCF).
     * Used after applying popup defaults to refresh the visible table.
     */
    _renderTableDOM() {
        if (!this.tableData || !this.container) return;

        const tbody = this.container.querySelector('tbody');
        if (!tbody) {
            console.warn('[PcfTableController] tbody not found, cannot re-render.');
            return;
        }

        // Clear existing rows
        tbody.innerHTML = '';

        // Rebuild rows from this.tableData
        this.tableData.forEach((rowData, idx) => {
            if (!rowData) return; // Skip null rows (e.g. MESSAGE-SQUARE)

            const tr = document.createElement('tr');

            rowData.forEach((val, colIdx) => {
                const td = document.createElement('td');
                td.textContent = val;
                td.contentEditable = 'true';
                td.dataset.row = idx;
                td.dataset.col = colIdx;
                td.spellcheck = false;

                // Highlight derived column
                if (colIdx === 3 && val) {
                    td.style.color = 'var(--green-ok)';
                    td.style.fontWeight = '600';
                } else if (colIdx === 3 && !val) {
                    td.style.color = 'var(--red-err)';
                    td.style.fontStyle = 'italic';
                }

                // Track edits
                td.addEventListener('blur', (e) => {
                    const r = parseInt(e.target.dataset.row);
                    const c = parseInt(e.target.dataset.col);
                    const newVal = e.target.textContent.trim();
                    if (this.tableData[r]) {
                        this.tableData[r][c] = newVal;
                        if (newVal !== String(rowData[c])) {
                            e.target.style.borderBottom = '2px solid var(--amber)';
                        }
                    }
                });

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        console.log('[PcfTableController] Table DOM re-rendered from tableData.');
    }

    /**
     * Show popup dialog with grouped defaults for user review/edit before regeneration.
     * Groups by Line No (Derived), falls back to DN if all blank.
     * Pre-fills with live table data, defaults in RED for missing values.
     */
    _showDefaultsPopup() {
        if (!this.tableData || this.tableData.length === 0) {
            alert('No table data available. Please refresh the table first.');
            return;
        }

        // Check if at least one attribute column has blank data
        const hIdx = {};
        this.headers.forEach((h, i) => hIdx[h] = i);
        const attrCols = ['P1 (ATTR1)', 'T1 (ATTR2)', 'Ins Thk (ATTR5)', 'Ins Den (ATTR6)',
            'Density (ATTR9)', 'HP (ATTR10)', 'Material (ATTR3)', 'Wall Thk (ATTR4)'];

        const hasBlankAttr = this.tableData.some(row =>
            row && // Skip null rows
            attrCols.some(col => {
                const val = row[hIdx[col]] || '';
                return val === '' || val === '0' || val === 'Undefined';
            })
        );

        if (!hasBlankAttr) {
            console.log('[PcfTableController] All attributes filled, skipping popup.');
            alert('All attribute columns are already filled. No defaults needed.');
            return;
        }

        console.log('[PcfTableController] Building defaults popup...');
        console.log('[PcfTableController] Table data rows:', this.tableData.length);

        const { groups, groupBy } = this._groupTableData();
        console.log('[PcfTableController] Groups created:', groups.size, 'Grouped by:', groupBy);

        if (groups.size === 0) {
            alert('No data to group. Table may be empty.');
            return;
        }

        const config = getConfig();
        const caDefs = config.caDefinitions || {};

        // Build popup table
        const popup = document.getElementById('defaults-popup');
        const wrapper = document.getElementById('defaults-table-wrapper');

        if (!popup || !wrapper) {
            console.error('[PcfTableController] Popup elements not found!', { popup, wrapper });
            alert('Popup elements not found in DOM. Check index.html.');
            return;
        }

        console.log('[PcfTableController] Popup elements found, building table...');

        const table = document.createElement('table');
        table.className = 'data-table';
        table.id = 'defaults-editable-table';

        // Headers
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        const popupHeaders = ['Line No.', 'DN', 'P1 (ATTR1)', 'T1 (ATTR2)', 'Ins Thk (ATTR5)',
            'Ins Den (ATTR6)', 'Density (ATTR9)', 'HP (ATTR10)',
            'Material (ATTR3)', 'Wall Thk (ATTR4)'];

        popupHeaders.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const popupData = []; // Store for later applying

        // Build rows (one per group)
        groups.forEach((rowObjs, groupKey) => {
            const firstRow = rowObjs[0].row;
            const lineNo = firstRow[hIdx['Line No. (Derived)']] || '';
            const dn = firstRow[hIdx['DN (Bore)']] || '';

            // Get attribute values from first row
            const p1 = firstRow[hIdx['P1 (ATTR1)']] || '';
            const t1 = firstRow[hIdx['T1 (ATTR2)']] || '';
            const insThk = firstRow[hIdx['Ins Thk (ATTR5)']] || '';
            const insDen = firstRow[hIdx['Ins Den (ATTR6)']] || '';
            const density = firstRow[hIdx['Density (ATTR9)']] || '';
            const hp = firstRow[hIdx['HP (ATTR10)']] || '';
            const material = firstRow[hIdx['Material (ATTR3)']] || '';
            const wall = firstRow[hIdx['Wall Thk (ATTR4)']] || '';

            // Fill missing with defaults, mark as "isDefault"
            // NOTE: Ins Den and Density are loaded blank for user to fill
            const fillDefault = (val, slot) => {
                if (val !== '' && val !== '0' && val !== 'Undefined') {
                    return { val, isDefault: false };
                }
                const def = caDefs[slot];
                if (!def) return { val, isDefault: false };

                const defaultVal = def.unit ? `${def.default} ${def.unit}` : String(def.default);
                return { val: defaultVal, isDefault: true };
            };

            const rowData = [
                { val: lineNo, isDefault: false },
                { val: dn, isDefault: false },
                fillDefault(p1, 'CA1'),
                fillDefault(t1, 'CA2'),
                fillDefault(insThk, 'CA5'),
                { val: insDen || '', isDefault: false }, // Load blank for user to fill
                { val: density || '', isDefault: false }, // Load blank for user to fill
                fillDefault(hp, 'CA10'),
                fillDefault(material, 'CA3'),
                fillDefault(wall, 'CA4'),
            ];

            popupData.push({ groupKey, rowData, mainRowIndices: rowObjs.map(o => o.rowIdx) });

            // Create TR
            const tr = document.createElement('tr');
            rowData.forEach((cell, colIdx) => {
                const td = document.createElement('td');
                td.textContent = cell.val;
                td.contentEditable = String(colIdx > 1); // Line No, DN not editable
                td.spellcheck = false;
                td.dataset.col = colIdx;
                if (cell.isDefault) {
                    td.style.color = 'red';
                    td.style.fontWeight = '600';
                    td.dataset.isDefault = 'true';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        wrapper.innerHTML = '';
        wrapper.appendChild(table);

        // Store popup data for applying
        this._popupData = popupData;

        // Show modal
        popup.style.display = 'flex';

        // Wire buttons (one-time setup)
        if (!this._popupWired) {
            document.getElementById('defaults-cancel').addEventListener('click', () => {
                popup.style.display = 'none';
            });
            document.getElementById('defaults-close-x').addEventListener('click', () => {
                popup.style.display = 'none';
            });
            document.getElementById('defaults-apply').addEventListener('click', () => {
                this._applyDefaultsToTable();
            });
            this._popupWired = true;
        }
    }

    /**
     * Group table data by Line No (Derived), fallback to DN if all blank.
     */
    _groupTableData() {
        const hIdx = {};
        this.headers.forEach((h, i) => hIdx[h] = i);

        const lineNoIdx = hIdx['Line No. (Derived)'];
        const dnIdx = hIdx['DN (Bore)'];

        // Check if all Line No values are blank
        const allLineNoBlank = this.tableData.every(row => !row || !row[lineNoIdx]);
        const groupKeyIdx = allLineNoBlank ? dnIdx : lineNoIdx;

        const groups = new Map();
        this.tableData.forEach((row, rowIdx) => {
            if (!row) return; // Skip null rows
            const key = String(row[groupKeyIdx] || 'BLANK');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ row, rowIdx });
        });

        return { groups, groupBy: allLineNoBlank ? 'DN' : 'LineNo', hIdx };
    }

    /**
     * Apply edited values from popup to main table, then regenerate PCF.
     */
    _applyDefaultsToTable() {
        const popup = document.getElementById('defaults-popup');
        const table = document.getElementById('defaults-editable-table');
        if (!table) {
            console.warn('[PcfTableController] Popup table not found.');
            return;
        }

        const hIdx = {};
        this.headers.forEach((h, i) => hIdx[h] = i);

        const attrColMap = {
            2: 'P1 (ATTR1)',
            3: 'T1 (ATTR2)',
            4: 'Ins Thk (ATTR5)',
            5: 'Ins Den (ATTR6)',
            6: 'Density (ATTR9)',
            7: 'HP (ATTR10)',
            8: 'Material (ATTR3)',
            9: 'Wall Thk (ATTR4)',
        };

        // Get configurable Ins Den default from textbox
        const insDenDefaultInput = document.getElementById('ins-den-default');
        const insDenDefault = insDenDefaultInput ? parseFloat(insDenDefaultInput.value) || 210 : 210;

        // Read edited values from popup table
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((tr, popupRowIdx) => {
            const popupDataRow = this._popupData[popupRowIdx];
            if (!popupDataRow) return;

            const cells = tr.querySelectorAll('td');
            const editedValues = {};

            // Read all values from popup
            cells.forEach(td => {
                const col = parseInt(td.dataset.col);
                if (col <= 1) return; // Skip Line No, DN
                const colName = attrColMap[col];
                if (colName) {
                    editedValues[colName] = td.textContent.trim();
                }
            });

            // Apply to all rows in this group - ONLY fill blank cells
            popupDataRow.mainRowIndices.forEach(mainRowIdx => {
                // Get InsThk value to determine Ins Den logic
                const insThkColIdx = hIdx['Ins Thk (ATTR5)'];
                const insThkVal = this.tableData[mainRowIdx]?.[insThkColIdx] || '';
                const insThkNum = parseFloat(insThkVal) || 0;

                Object.entries(editedValues).forEach(([colName, val]) => {
                    const mainColIdx = hIdx[colName];
                    if (mainColIdx !== undefined && this.tableData[mainRowIdx]) {
                        const existingVal = this.tableData[mainRowIdx][mainColIdx];

                        // Special handling for Ins Den (ATTR6)
                        if (colName === 'Ins Den (ATTR6)') {
                            // If InsThk > 0, use user-entered value, otherwise use default
                            if (existingVal === '' || existingVal === '0' || existingVal === 'Undefined') {
                                if (insThkNum > 0) {
                                    // Use user value if provided, else default
                                    const valToUse = val || String(insDenDefault);
                                    // ensure KG/M3 suffix if numeric
                                    this.tableData[mainRowIdx][mainColIdx] = (valToUse.match(/^\d+(\.\d+)?$/)) ? `${valToUse} KG/M3` : valToUse;
                                } else {
                                    // InsThk is 0, use default with suffix
                                    this.tableData[mainRowIdx][mainColIdx] = `${insDenDefault} KG/M3`;
                                }
                            }
                        }
                        // Density (ATTR9) - always use user value
                        else if (colName === 'Density (ATTR9)') {
                            if (existingVal === '' || existingVal === '0' || existingVal === 'Undefined') {
                                this.tableData[mainRowIdx][mainColIdx] = val;
                            }
                        }
                        // Other attributes - standard logic
                        else {
                            // Only fill if current value is blank/placeholder
                            if (existingVal === '' || existingVal === '0' || existingVal === 'Undefined') {
                                this.tableData[mainRowIdx][mainColIdx] = val;
                            }
                        }
                    }
                });
            });
        });

        // Hide popup
        popup.style.display = 'none';

        console.log('[PcfTableController] Defaults applied to table. Re-rendering...');

        // Auto-fill Weight=0 for FLANGE and VALVE with empty Weight column
        this._fillDefaultWeights();

        // Re-render the table to show updated values
        this._renderTableDOM();

        console.log('[PcfTableController] Table re-rendered. Regenerating PCF...');

        // Trigger actual PCF regeneration
        this.regeneratePCF();

        // Enable Next button after regeneration
        this._enableNextButton();
    }

    /**
     * Fill empty Weight (CA8) values with 0 for FLANGE and VALVE components.
     * This prevents validation errors for missing COMPONENT-ATTRIBUTE8.
     */
    _fillDefaultWeights() {
        if (!this.tableData || this.tableData.length === 0) return;

        const hIdx = {};
        this.headers.forEach((h, i) => hIdx[h] = i);

        const typeIdx = hIdx['Component'];  // Fixed: was 'Type', should be 'Component'
        const weightIdx = hIdx['Weight (ATTR8)'];

        if (typeIdx === undefined || weightIdx === undefined) {
            console.warn('[PcfTableController] Component or Weight column not found.', { typeIdx, weightIdx, headers: this.headers });
            return;
        }

        let filledCount = 0;

        this.tableData.forEach((row, idx) => {
            if (!row) return; // Skip null rows (e.g. MESSAGE-SQUARE)

            const type = row[typeIdx] || '';
            const weight = row[weightIdx] || '';

            // Check if type is FLANGE or VALVE and weight is empty
            if ((type === 'FLANGE' || type === 'VALVE') && (weight === '' || weight === null)) {
                this.tableData[idx][weightIdx] = '0.0 KG';
                filledCount++;
            }
        });

        if (filledCount > 0) {
            console.log(`[PcfTableController] Auto-filled ${filledCount} empty Weight values with 0 for FLANGE/VALVE.`);
        }
    }

    /**
     * Enable the Next button after PCF has been regenerated.
     */
    _enableNextButton() {
        if (this.nextBtn) {
            this.nextBtn.disabled = false;
            this.nextBtn.style.opacity = '1';
            this.nextBtn.style.cursor = 'pointer';
            console.log('[PcfTableController] Next button enabled.');
        }
    }

    /**
     * REGENERATE PCF from edited table data.
     *
     * This is the reverse engineering flow:
     * Edited table → Build PCF component blocks → setState('pcfLines')
     * → triggers 3D Viewer, Output, Validation tabs
     *
     * Strategy: Use rawLines from parser to preserve original structure.
     * Only REPLACE/INJECT specific COMPONENT-ATTRIBUTE lines with edited values.
     */
    regeneratePCF() {
        if (!this.tableData || this.tableData.length === 0) {
            console.warn('[PcfTableController] No table data to regenerate from.');
            return;
        }

        console.log('[PcfTableController] Regenerating PCF from edited table data...');

        // Get original PCF lines as base
        const originalLines = getState('pcfLines') || [];
        const originalText = originalLines.join('\n');
        const components = parsePcf(originalText);

        if (components.length === 0) {
            console.warn('[PcfTableController] No original components to regenerate from.');
            return;
        }

        // Header → index map
        const hIdx = {};
        this.headers.forEach((h, i) => hIdx[h] = i);

        // Map of table column → PCF attribute key
        const TABLE_TO_PCF = {
            'P1 (ATTR1)': 'COMPONENT-ATTRIBUTE1',
            'T1 (ATTR2)': 'COMPONENT-ATTRIBUTE2',
            'Material (ATTR3)': 'COMPONENT-ATTRIBUTE3',
            'Wall Thk (ATTR4)': 'COMPONENT-ATTRIBUTE4',
            'Ins Thk (ATTR5)': 'COMPONENT-ATTRIBUTE5',
            'Ins Den (ATTR6)': 'COMPONENT-ATTRIBUTE6',
            'Weight (ATTR8)': 'COMPONENT-ATTRIBUTE8',
            'Density (ATTR9)': 'COMPONENT-ATTRIBUTE9',
            'HP (ATTR10)': 'COMPONENT-ATTRIBUTE10',
            'Piping Class': 'PIPING-CLASS',
            'Support Name': '<SUPPORT_NAME>',
        };

        // Build new PCF lines
        const newLines = [];

        // 1. Write header lines (everything before first component)
        for (const line of originalLines) {
            const trimmed = line.trim();
            if (components.some(c => c.type === trimmed)) {
                break; // Stop at first component type
            }
            newLines.push(line);
        }

        // 2. Rebuild each component using rawLines + edited attributes
        components.forEach((comp, idx) => {
            const editedRow = this.tableData[idx];
            if (!editedRow) {
                // No edits — write original
                newLines.push(comp.type);
                if (comp.rawLines) comp.rawLines.forEach(l => newLines.push(`    ${l}`));
                return;
            }

            // Component type line
            newLines.push(comp.type);

            // Build set of PCF attribute keys that are edited in the table
            const editedAttrs = {};
            Object.entries(TABLE_TO_PCF).forEach(([tableCol, pcfKey]) => {
                const colIdx = hIdx[tableCol];
                if (colIdx !== undefined) {
                    editedAttrs[pcfKey] = String(editedRow[colIdx] ?? '');
                }
            });

            // Track which edited attributes have been written (to avoid duplicates)
            const writtenKeys = new Set();

            // Write original raw lines, replacing attribute values where edited
            if (comp.rawLines) {
                comp.rawLines.forEach(rawLine => {
                    const trimmedLine = rawLine.trim();
                    const parts = trimmedLine.split(/\s+/);
                    const lineKey = parts[0];

                    if (editedAttrs.hasOwnProperty(lineKey)) {
                        // This attribute was edited — write the edited value
                        const editedVal = editedAttrs[lineKey];
                        if (editedVal !== '') {
                            newLines.push(`    ${lineKey} ${editedVal}`);
                        }
                        // else: edited to empty = remove attribute
                        writtenKeys.add(lineKey);
                    } else {
                        // Not edited — preserve original line
                        newLines.push(`    ${trimmedLine}`);
                    }
                });
            }

            // Inject any edited attributes that didn't exist in the original
            Object.entries(editedAttrs).forEach(([pcfKey, val]) => {
                if (!writtenKeys.has(pcfKey) && val !== '') {
                    newLines.push(`    ${pcfKey} ${val}`);
                }
            });
        });

        // Temporarily unsub to prevent re-render cycle, then update state
        this._regenerating = true;
        setState('pcfLines', newLines);
        this._regenerating = false;

        console.log(`[PcfTableController] Regenerated PCF: ${newLines.length} lines from ${components.length} components.`);

        // Update log
        if (this.logContainer) {
            const msg = `<div style="color:var(--green-ok);font-weight:600">⟳ PCF Regenerated from table: ${newLines.length} lines, ${components.length} components</div>`;
            this.logContainer.innerHTML = msg + this.logContainer.innerHTML;
        }

        // Enable Next button after successful regeneration
        this._enableNextButton();
    }

    /**
     * Calculate axis direction and length between points
     */
    calcAxisAndLength(comp) {
        const calcVec = (start, end) => {
            if (!start || !end) return { axis: '', len: 0 };
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dz = end.z - start.z;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const axisNames = [];
            if (Math.abs(dx) > 0.1) axisNames.push(dx > 0 ? 'EAST' : 'WEST');
            if (Math.abs(dy) > 0.1) axisNames.push(dy > 0 ? 'NORTH' : 'SOUTH');
            if (Math.abs(dz) > 0.1) axisNames.push(dz > 0 ? 'UP' : 'DOWN');

            return { axis: axisNames.join(' '), len };
        };

        const { type, points, centrePoint, branch1Point } = comp;
        let axis1 = '', axis2 = '', axis3 = '';
        let len1 = 0, len2 = 0, len3 = 0;

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

        return { axis1, len1, axis2, len2, axis3, len3 };
    }

    /**
     * Get value from linelist row using SmartMapping column name
     */
    getSmartMappedValue(linelistRow, columnName, attrName) {
        if (!columnName) {
            this.logger.logSmartMapFail(attrName, 'Not configured');
            return '';
        }
        const value = linelistRow[columnName];
        if (value !== undefined && value !== null && value !== '') {
            this.logger.logSmartMapSuccess(attrName, columnName, value);
            return String(value);
        } else {
            this.logger.logSmartMapFail(attrName, columnName);
            return '';
        }
    }

    /**
     * Resolve density using Phase logic
     */
    resolveDensity(linelistRow, smartMapping, smartOptions) {
        const phase = linelistRow[smartMapping.Phase] || '';
        const densityGas = linelistRow[smartMapping.DensityGas] || '';
        const densityLiq = linelistRow[smartMapping.DensityLiq] || '';
        const densityMixed = linelistRow[smartMapping.DensityMixed] || '';
        const preference = smartOptions.densityMixedPreference || 'Liquid';

        let result = '';
        if (phase.toUpperCase() === 'G') {
            result = densityGas;
            this.logger.logDensityResolution('G (Gas)', 'Gas', result);
        } else if (phase.toUpperCase() === 'L') {
            result = densityLiq;
            this.logger.logDensityResolution('L (Liquid)', 'Liquid', result);
        } else if (phase.toUpperCase() === 'M') {
            result = preference === 'Mixed' ? densityMixed : densityLiq;
            this.logger.logDensityResolution('M (Mixed)', preference, result);
        } else {
            result = densityLiq || densityGas || densityMixed || '';
            this.logger.logDensityResolution('N/A', 'Fallback (Liquid/Gas/Mixed)', result);
        }

        return result;
    }

    /**
     * Update diagnostic log display
     */
    updateLog() {
        if (!this.logContainer) return;
        const html = this.logger.getHTML();
        this.logContainer.innerHTML = html;
    }

    /**
     * Export table as CSV
     */
    exportCSV() {
        if (!this.tableData || this.tableData.length === 0) return;

        let csv = [];
        // Headers
        csv.push(this.headers.map(h => `"${h}"`).join(','));
        // Data (from editable store, not DOM)
        this.tableData.forEach(row => {
            if (!row) return;
            csv.push(row.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','));
        });

        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'pcf_table_export.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        console.log('[PcfTableController] CSV exported from editable data.');
    }
}
