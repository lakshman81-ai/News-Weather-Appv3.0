import { ExcelParser } from '../services/excel-parser.js';
import { dataManager } from '../services/data-manager.js';
import { gate } from '../services/gate-logger.js';
import { materialService } from '../services/material-service.js';
import { linelistService } from '../services/linelist-service.js';
import { getState, setState } from '../state.js';
import { getConfig } from '../config/config-store.js';

/**
 * Main UI Controller for the Integration Module (Master Data Tab).
 * Manages five sub-tabs: Linelist Manager, Weight Config, Piping Class Master, PCF Material Map, Line Dump from E3D
 */
export class MasterDataController {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('[MasterDataController] Container not found:', containerId);
            return;
        }
        this.renderTabs();
        this.bindEvents();

        // Initial load of smart map UI if headers exist in storage
        const state = getState("linelist");
        if (state && state.headers && state.headers.length > 0) {
            this.renderSmartMapUI(state.headers);
            this.populateSourceSelect(state.headers);
            document.getElementById('linelist-mapping-section').style.display = '';
            document.getElementById('linelist-attr-section').style.display = '';
        }
    }

    renderTabs() {
        this.container.innerHTML = `
      <div class="flex gap-1 items-center mb-1">
        <h2 style="font-family:var(--font-code);font-size:0.9rem;color:var(--amber)">MASTER DATA</h2>
      </div>

      <div class="integ-tabs">
        <button class="tab-btn active" data-tab="linelist">Linelist Manager</button>
        <button class="tab-btn" data-tab="weights">Weight Config</button>
        <button class="tab-btn" data-tab="pipingclass">Piping Class Master</button>
        <button class="tab-btn" data-tab="matmap">PCF Material Map</button>
        <button class="tab-btn" data-tab="dump">Line Dump from E3D</button>
      </div>

      <div class="integ-content">
        <!-- ═══ Linelist Manager Sub-Tab ═══ -->
        <div id="linelist" class="tab-pane active">
          <div class="upload-section" id="linelist-drop">
            <svg style="width:36px;height:36px;margin-bottom:0.5rem;color:var(--text-muted)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 2.75 2.75 0 0 1 3.072 2.955A2.75 2.75 0 0 1 18 19.5H6.75Z" />
            </svg>
            <div style="font-size:0.9rem;font-weight:500;color:var(--text-primary)">Drop Linelist Excel file here</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem">or click to browse · <span style="color:var(--amber);font-family:var(--font-code)">.xlsx .xls</span></div>
            <input type="file" id="linelist-upload" accept=".xlsx,.xls" style="display:none" />
          </div>
          <div id="linelist-status-bar" style="display:none" class="flex gap-1 items-center mb-1">
            <span class="text-xs text-code" id="linelist-status"></span>
          </div>

          <div style="display:flex; gap: 2rem; flex-wrap: wrap;">
              <!-- Left: Key Mapping -->
              <div class="mapping-config" style="flex:1;display:none;min-width:300px" id="linelist-mapping-section">
                <h4>Key Columns (Primary Key)</h4>
                <p class="text-muted text-xs" style="margin-bottom:0.75rem">Required for robust "Service + Sequence" matching.</p>
                <div id="linelist-mapping-ui"></div>
                <div id="linelist-key-warning" style="display:none;margin-top:0.5rem" class="issue-item WARNING">
                    <span class="issue-sev WARNING">WARN</span>
                    <span class="issue-msg">Primary keys not fully mapped. Fallback lookup may be unreliable.</span>
                </div>
              </div>

              <!-- Right: Attribute Mapping (SmartProcessMap) -->
              <div class="mapping-config" style="flex:1;display:none;min-width:300px" id="linelist-attr-section">
                <h4>Attribute Injection (SmartProcessMap)</h4>
                <p class="text-muted text-xs" style="margin-bottom:0.75rem">Map Line List columns to specific PCF attributes.</p>

                <div id="smart-map-ui">
                    <!-- Injected by renderSmartMapUI -->
                </div>

                <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--steel)">
                    <h5 style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.5rem">Custom Attribute Mapping</h5>
                    <div id="linelist-attr-ui">
                        <div class="map-row" style="max-width:100%">
                            <select id="new-attr-source" style="background:var(--bg-0);border:1px solid var(--steel);color:var(--text-primary);padding:0.3rem;border-radius:var(--radius-sm)"><option value="">(Select Column)</option></select>
                            <span style="color:var(--text-muted);margin:0 0.3rem">→</span>
                            <input type="text" id="new-attr-target" placeholder="ATTRIBUTE_X" class="config-input" style="width:120px;">
                            <button class="btn btn-sm btn-primary" id="btn-add-attr">+ Add</button>
                        </div>
                        <div id="attr-list" style="margin-top:10px; max-height:150px; overflow-y:auto;"></div>
                    </div>
                </div>
              </div>
          </div>

          <div id="linelist-preview" style="display:none"></div>

          <!-- Diagnostic Log Panel -->
          <div class="panel" style="max-height:250px;margin-top:0.5rem;display:none" id="linelist-log-panel">
            <div class="panel-header">
              <span class="panel-title">Linelist Diagnostic Log</span>
              <button class="btn btn-secondary btn-sm" id="btn-clear-linelist-log">Clear</button>
            </div>
            <div class="panel-body" style="padding:0.5rem;overflow-y:auto;max-height:200px">
              <div id="linelist-diagnostic-log" style="font-family:var(--font-code);font-size:0.72rem;white-space:pre-wrap">
                <span style="color:var(--text-muted)">Upload a linelist file to see detailed processing logs...</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ Weight Config Sub-Tab ═══ -->
        <div id="weights" class="tab-pane">
          <div class="upload-section" id="weights-drop">
            <svg style="width:36px;height:36px;margin-bottom:0.5rem;color:var(--text-muted)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 2.75 2.75 0 0 1 3.072 2.955A2.75 2.75 0 0 1 18 19.5H6.75Z" />
            </svg>
            <div style="font-size:0.9rem;font-weight:500;color:var(--text-primary)">Drop Weight Database Excel file here</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem">or click to browse · <span style="color:var(--amber);font-family:var(--font-code)">.xlsx .xls</span></div>
            <input type="file" id="weights-upload" accept=".xlsx,.xls" style="display:none" />
          </div>
          <div id="weights-status-bar" style="display:none" class="flex gap-1 items-center mb-1">
            <span class="text-xs text-code" id="weights-status"></span>
          </div>
          <div class="mapping-config" style="display:none" id="weights-mapping-section">
            <h4>Header Mapping</h4>
            <div id="weights-mapping-ui"></div>
          </div>
          <div id="weights-preview" style="display:none"></div>
        </div>

        <!-- ═══ Piping Class Master Sub-Tab ═══ -->
        <div id="pipingclass" class="tab-pane">
          <div class="upload-section" id="piping-drop">
            <svg style="width:36px;height:36px;margin-bottom:0.5rem;color:var(--text-muted)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 2.75 2.75 0 0 1 3.072 2.955A2.75 2.75 0 0 1 18 19.5H6.75Z" />
            </svg>
            <div style="font-size:0.9rem;font-weight:500;color:var(--text-primary)">Drop Piping Class Master Excel file here</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem">or click to browse · <span style="color:var(--amber);font-family:var(--font-code)">.xlsx .xls</span></div>
            <input type="file" id="piping-upload" accept=".xlsx,.xls" style="display:none" />
          </div>
          <div id="pipingclass-status-bar" style="display:none" class="flex gap-1 items-center mb-1">
            <span class="text-xs text-code" id="pipingclass-status"></span>
          </div>
          <div class="mapping-config" style="display:none" id="pipingclass-mapping-section">
            <h4>Header Mapping</h4>
            <div id="pipingclass-mapping-ui"></div>
          </div>
          <div id="pipingclass-preview" style="display:none"></div>
        </div>

        <!-- ═══ PCF Material Map Sub-Tab ═══ -->
        <div id="matmap" class="tab-pane">
          <div class="upload-section" id="matmap-drop">
            <svg style="width:36px;height:36px;margin-bottom:0.5rem;color:var(--text-muted)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 2.75 2.75 0 0 1 3.072 2.955A2.75 2.75 0 0 1 18 19.5H6.75Z" />
            </svg>
            <div style="font-size:0.9rem;font-weight:500;color:var(--text-primary)">Drop PCF Material Map file here</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem">or click to browse · <span style="color:var(--amber);font-family:var(--font-code)">.txt .csv</span></div>
            <input type="file" id="matmap-upload" accept=".txt,.csv" style="display:none" />
          </div>
          <div id="matmap-status-bar" style="display:none" class="flex gap-1 items-center mb-1">
            <span class="text-xs text-code" id="matmap-status"></span>
          </div>
          <div id="matmap-preview" style="display:none"></div>
        </div>

        <!-- ═══ Line Dump from E3D Sub-Tab ═══ -->
        <div id="dump" class="tab-pane">
          <div class="upload-section" id="dump-drop">
            <svg style="width:36px;height:36px;margin-bottom:0.5rem;color:var(--text-muted)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 2.75 2.75 0 0 1 3.072 2.955A2.75 2.75 0 0 1 18 19.5H6.75Z" />
            </svg>
            <div style="font-size:0.9rem;font-weight:500;color:var(--text-primary)">Drop LineDump Excel/CSV file here</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem">or click to browse · <span style="color:var(--amber);font-family:var(--font-code)">.xlsx .xls .csv</span></div>
            <input type="file" id="dump-upload" accept=".xlsx,.xls,.csv" style="display:none" />
          </div>
          <div id="dump-status-bar" style="display:none" class="flex gap-1 items-center mb-1">
            <span class="text-xs text-code" id="dump-status"></span>
          </div>

          <!-- Configuration for Line No. Derivation -->
          <div id="dump-derive-config" style="display:none; margin-bottom: 1rem;" class="mapping-config">
            <h4 style="margin-bottom:0.5rem">Line No. Derivation</h4>
            <div style="display:flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
              <div class="map-row" style="margin-bottom:0; flex: 1; min-width: 250px;">
                <label style="width:70px">Method:</label>
                <select id="dump-derive-method" style="background:var(--bg-0);border:1px solid var(--steel);color:var(--text-primary);padding:0.3rem;border-radius:var(--radius-sm);flex:1">
                  <option value="regex">Regex: /[A-Z]\d{5,}/</option>
                  <option value="segment">Segment Position (split by -)</option>
                </select>
              </div>
              <div id="dump-segment-config" style="display:none; align-items:center; gap:0.5rem">
                <label style="font-size:0.75rem">Segment #:</label>
                <input type="number" id="dump-segment-pos" value="3" min="1" max="10" class="config-input" style="width:60px; height: 30px;">
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-re-derive">↻ Re-derive</button>
            </div>
          </div>

          <div id="dump-stats" style="display:none" class="stat-chips"></div>
          <div id="dump-preview" style="display:none"></div>
        </div>
      </div>
    `;
    }

    bindEvents() {
        // ── Sub-Tab Switching ──
        this.container.querySelectorAll('.integ-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // ── Upload Drop Zones (click-to-browse) ──
        const wireDropZone = (dropId, inputId) => {
            const drop = document.getElementById(dropId);
            const input = document.getElementById(inputId);
            if (!drop || !input) return;
            drop.addEventListener('click', () => input.click());
            drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.borderColor = 'var(--amber)'; });
            drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
            drop.addEventListener('drop', (e) => {
                e.preventDefault();
                drop.style.borderColor = '';
                if (e.dataTransfer.files.length) {
                    input.files = e.dataTransfer.files;
                    input.dispatchEvent(new Event('change'));
                }
            });
        };

        wireDropZone('linelist-drop', 'linelist-upload');
        wireDropZone('weights-drop', 'weights-upload');
        wireDropZone('piping-drop', 'piping-upload');
        wireDropZone('matmap-drop', 'matmap-upload');
        wireDropZone('dump-drop', 'dump-upload');

        // ── File Change Handlers ──
        document.getElementById('linelist-upload').addEventListener('change', (e) => this.handleUpload(e.target.files[0], 'linelist'));
        document.getElementById('weights-upload').addEventListener('change', (e) => this.handleUpload(e.target.files[0], 'weights'));
        document.getElementById('piping-upload').addEventListener('change', (e) => this.handleUpload(e.target.files[0], 'pipingclass'));
        document.getElementById('matmap-upload').addEventListener('change', (e) => this.handleMatMapUpload(e.target.files[0]));
        document.getElementById('dump-upload').addEventListener('change', (e) => this.handleDumpUpload(e.target.files[0]));

        // Event Listeners
        const addAttrBtn = document.getElementById('btn-add-attr');
        if (addAttrBtn) addAttrBtn.addEventListener('click', () => this.addAttributeMapping());

        const clearLogBtn = document.getElementById('btn-clear-linelist-log');
        if (clearLogBtn) clearLogBtn.addEventListener('click', () => this.clearLinelistLog());

        this.linelistLogs = [];

        // Subscribe to linelist state changes for auto-logging
    }

    switchTab(tabId) {
        this.container.querySelectorAll('.integ-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        this.container.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        this.container.querySelector(`.integ-tabs [data-tab="${tabId}"]`)?.classList.add('active');
        this.container.querySelector(`#${tabId}`)?.classList.add('active');
    }

    // ═══════════════════════════════════════════
    //  Linelist, Weights & Piping Class Upload Handler
    // ═══════════════════════════════════════════
    async handleUpload(file, type) {
        if (!file) return;

        // Get comprehensive keywords from config for Linelist
        let keywords = [];
        if (type === 'linelist') {
            const config = getConfig(); // Need to import getConfig in this module if not already
            const smartKeywords = config.smartData?.smartProcessKeywords || {};
            // Flatten all arrays into one list
            keywords = Object.values(smartKeywords).flat();
            // Add primary key keywords
            keywords.push('Service', 'System', 'Line', 'Sequence', 'Seq', 'Line No');
        } else {
            const keywordMap = {
                weights: ['Size', 'Weight', 'Class', 'Schedule', 'Rating'],
                pipingclass: ['Class', 'Material', 'Wall', 'Corrosion']
            };
            keywords = keywordMap[type] || [];
        }

        const statusBar = document.getElementById(`${type}-status-bar`);
        const statusEl = document.getElementById(`${type}-status`);
        statusBar.style.display = '';
        statusEl.textContent = '⏳ Parsing…';

        // Map drop zone IDs (piping uses 'piping-drop' instead of 'pipingclass-drop')
        const dropZoneMap = { linelist: 'linelist-drop', weights: 'weights-drop', pipingclass: 'piping-drop' };

        try {
            this.logToLinelist('info', `📂 Parsing file: ${file.name}`);
            const result = await ExcelParser.parse(file, keywords);
            this.logToLinelist('success', `✓ Detected ${result.data.length} rows, header at row ${result.detectedRow + 1}`);

            if (type === 'linelist') {
                this.logToLinelist('info', '🔄 Processing linelist data...');

                // IMPORTANT: ExcelParser returns {headers, data, detectedRow}
                // Directly use parsed headers instead of rawRows
                const state = getState("linelist") || {};
                setState("linelist", {
                    ...state,
                    filename: file.name,
                    headers: result.headers,
                    rawRows: [], // Not needed since headers are already parsed
                    headerRowIndex: result.detectedRow
                });
                linelistService._saveConfig();

                this.logToLinelist('info', `📋 Detected ${result.headers?.length || 0} columns`);

                this.renderSmartMapUI(result.headers);
                this.populateSourceSelect(result.headers);
                document.getElementById('linelist-mapping-section').style.display = '';
                document.getElementById('linelist-attr-section').style.display = '';
                document.getElementById('linelist-log-panel').style.display = '';

                this.logToLinelist('success', '✓ SmartProcessMap auto-fill complete (check dropdowns)');
            } else if (type === 'pipingclass') {
                dataManager.setPipingClassMaster(result.data);
                document.getElementById('pipingclass-mapping-section').style.display = '';
            } else {
                dataManager.setWeights(result.data);
                document.getElementById('weights-mapping-section').style.display = '';
            }

            statusEl.textContent = `✓ Loaded ${result.data.length} rows from "${file.name}" (header row ${result.detectedRow + 1})`;
            statusEl.style.color = 'var(--green-ok)';
            this.logToLinelist('success', `✓ Upload complete: ${result.data.length} rows loaded`);

            // Render Mapping UI for all types (including Linelist for Key Columns)
            this.renderMappingUI(type, result.headers);
            this.renderPreview(type, result.data, result.headers);

            // Update drop zone to show success
            const dropZone = document.getElementById(dropZoneMap[type]);
            if (dropZone) {
                dropZone.style.borderColor = 'var(--green-ok)';
                dropZone.style.borderStyle = 'solid';
            }

        } catch (err) {
            console.error(err);
            statusEl.textContent = `✕ Error: ${err.message}`;
            statusEl.style.color = 'var(--red-err)';
        }
    }

    // ═══════════════════════════════════════════
    //  PCF Material Map Upload Handler (TXT/CSV)
    // ═══════════════════════════════════════════
    async handleMatMapUpload(file) {
        if (!file) return;

        const statusBar = document.getElementById('matmap-status-bar');
        const statusEl = document.getElementById('matmap-status');
        statusBar.style.display = '';
        statusEl.textContent = '⏳ Parsing Material Map…';

        try {
            const text = await file.text();
            const result = materialService.parseMaterialMap(text);
            dataManager.setMaterialMap(result);

            statusEl.textContent = `✓ Loaded ${result.length} material entries from "${file.name}"`;
            statusEl.style.color = 'var(--green-ok)';

            // Render preview table from parsed map
            const headers = ['code', 'desc'];
            this.renderPreview('matmap', result, headers);

            // Update drop zone to show success
            const dropZone = document.getElementById('matmap-drop');
            dropZone.style.borderColor = 'var(--green-ok)';
            dropZone.style.borderStyle = 'solid';

        } catch (err) {
            console.error(err);
            statusEl.textContent = `✕ Error: ${err.message}`;
            statusEl.style.color = 'var(--red-err)';
        }
    }

    // ═══════════════════════════════════════════
    //  LineDump Upload Handler (with Line No. Derivation)
    // ═══════════════════════════════════════════
    async handleDumpUpload(file) {
        if (!file) return;

        const statusBar = document.getElementById('dump-status-bar');
        const statusEl = document.getElementById('dump-status');
        statusBar.style.display = '';
        statusEl.textContent = '⏳ Parsing LineDump…';

        try {
            // LineDump headers are fixed/known
            const keywords = ['Reference', 'Name', 'Type', 'Pipe', 'Position', 'PIPE'];
            const result = await ExcelParser.parse(file, keywords);

            // Derive Line No. from PIPE column using smart logic
            const pipeCol = this._findColumn(result.headers, ['PIPE']);
            const enrichedData = result.data.map(row => {
                const pipeValue = pipeCol ? (row[pipeCol] || '') : '';
                row['Line No. (Derived)'] = this.deriveLineNo(pipeValue);
                return row;
            });

            dataManager.setLineDump(enrichedData);

            // Show stats
            const uniqueLines = new Set(enrichedData.map(r => r['Line No. (Derived)']).filter(Boolean));
            const typeCount = {};
            enrichedData.forEach(r => {
                const t = r[this._findColumn(result.headers, ['Type'])] || 'UNKNOWN';
                typeCount[t] = (typeCount[t] || 0) + 1;
            });

            statusEl.textContent = `✓ Loaded ${enrichedData.length} elements from "${file.name}"`;
            statusEl.style.color = 'var(--green-ok)';

            // Render stats chips
            const statsEl = document.getElementById('dump-stats');
            statsEl.style.display = '';
            statsEl.innerHTML = `
        <div class="stat-chip"><span class="num">${enrichedData.length}</span><span class="lbl">Elements</span></div>
        <div class="stat-chip"><span class="num">${uniqueLines.size}</span><span class="lbl">Unique Lines</span></div>
        <div class="stat-chip"><span class="num">${Object.keys(typeCount).length}</span><span class="lbl">Component Types</span></div>
      `;

            // Render preview including derived column
            const displayHeaders = [...result.headers];
            if (!displayHeaders.includes('Line No. (Derived)')) {
                displayHeaders.push('Line No. (Derived)');
            }
            this.renderDumpPreview(enrichedData, displayHeaders);
            this.renderDumpConfig();

            // Update drop zone
            const dropZone = document.getElementById('dump-drop');
            dropZone.style.borderColor = 'var(--green-ok)';
            dropZone.style.borderStyle = 'solid';

        } catch (err) {
            console.error(err);
            statusEl.textContent = `✕ Error: ${err.message}`;
            statusEl.style.color = 'var(--red-err)';
        }
    }

    /**
     * Smart Line Number Derivation from PIPE column.
     *
     * Input examples (E3D format):
     *   FCSEE-16"-P0511260-11440A1-01
     *   FCSEE-16"-P0511260-11440A1-01/B1
     *   /FCSEE-16"-P0511260-11440A1-01/B2
     *
     * The split by delimiters [-/"] produces empty strings from adjacent
     * delimiters. These must be FILTERED before indexing by segment position.
     *
     * Also handles various quote characters: ", ", \", etc.
     */
    deriveLineNo(pipeStr) {
        if (!pipeStr) return '';
        const str = String(pipeStr).trim();

        // Read from localStorage (persisted config)
        const config = JSON.parse(localStorage.getItem('lineDumpConfig') || '{}');
        const method = config.method || 'segment';
        const segmentPos = parseInt(config.segmentPos || '3');

        if (method === 'segment') {
            // Normalize various quote characters to standard quote
            const normalized = str.replace(/[\u201C\u201D\u2033\u02BA\u2036\u2018\u2019]/g, '"');

            // Split by ALL common delimiters: dash, slash, quotes, backslash
            const rawParts = normalized.split(/[-/\\"]+/);

            // Filter empty strings (critical for formats like: FCSEE-16"-P0511260...)
            const parts = rawParts.filter(p => p.trim() !== '');

            console.log(`[DeriveLineNo] Segment method: input="${str}" → parts=${JSON.stringify(parts)} → pos ${segmentPos}`);

            if (parts.length >= segmentPos) {
                const result = parts[segmentPos - 1].trim().toUpperCase();
                console.log(`[DeriveLineNo] Result: "${result}"`);
                return result;
            }
            console.warn(`[DeriveLineNo] Not enough segments: ${parts.length} < ${segmentPos}`);
            return '';
        }

        if (method === 'full') {
            return str.toUpperCase();
        }

        // Default: Regex — extract first pattern like P0511260 (letter + 5+ digits)
        const match = str.match(/[A-Z]\d{5,}/i);
        if (match) {
            return match[0].toUpperCase();
        }

        // Fallback: find segment with mixed alpha+numeric, length >= 6
        const normalized = str.replace(/[\u201C\u201D\u2033\u02BA]/g, '"');
        const parts = normalized.split(/[-/\\"]+/).filter(p => p.trim() !== '');
        for (const part of parts) {
            const clean = part.trim();
            if (clean.length >= 6 && /[A-Z]/i.test(clean) && /\d/.test(clean)) {
                return clean.toUpperCase();
            }
        }
        return '';
    }

    renderDumpConfig() {
        const configPanel = document.getElementById('dump-derive-config');
        if (!configPanel) return;

        configPanel.style.display = 'block';

        const methodSelect = document.getElementById('dump-derive-method');
        const segmentConfig = document.getElementById('dump-segment-config');
        const segmentInput = document.getElementById('dump-segment-pos');
        const reDeriveBtn = document.getElementById('btn-re-derive');

        // Load saved config from localStorage
        const savedConfig = JSON.parse(localStorage.getItem('lineDumpConfig') || '{}');
        if (methodSelect && savedConfig.method) {
            methodSelect.value = savedConfig.method;
            if (segmentConfig) {
                segmentConfig.style.display = savedConfig.method === 'segment' ? 'flex' : 'none';
            }
        }
        if (segmentInput && savedConfig.segmentPos) {
            segmentInput.value = savedConfig.segmentPos;
        }

        // Save config to localStorage on change
        if (methodSelect && !methodSelect.dataset.listener) {
            methodSelect.addEventListener('change', (e) => {
                const config = { method: e.target.value, segmentPos: segmentInput?.value || '3' };
                localStorage.setItem('lineDumpConfig', JSON.stringify(config));
                if (segmentConfig) {
                    segmentConfig.style.display = e.target.value === 'segment' ? 'flex' : 'none';
                }
                // Auto re-derive on method change
                if (reDeriveBtn) reDeriveBtn.click();
            });
            methodSelect.dataset.listener = 'true';
        }

        if (segmentInput && !segmentInput.dataset.listener) {
            segmentInput.addEventListener('change', (e) => {
                const config = { method: methodSelect?.value || 'segment', segmentPos: e.target.value };
                localStorage.setItem('lineDumpConfig', JSON.stringify(config));
                // Auto re-derive on segment change
                if (reDeriveBtn) reDeriveBtn.click();
            });
            segmentInput.dataset.listener = 'true';
        }

        if (reDeriveBtn && !reDeriveBtn.dataset.listener) {
            reDeriveBtn.addEventListener('click', () => {
                const data = dataManager.lineDump;
                if (!data || data.length === 0) return;

                // Re-derive based on current config
                const enriched = data.map(row => {
                    const pipeVal = row['PIPE'] || row['Pipe'] || '';
                    row['Line No. (Derived)'] = this.deriveLineNo(pipeVal);
                    return row;
                });

                dataManager.setLineDump(enriched);

                // Ensure headers include the derived column
                const headers = Object.keys(enriched[0] || {});
                if (!headers.includes('Line No. (Derived)') && enriched.length > 0) {
                    headers.push('Line No. (Derived)');
                }

                this.renderDumpPreview(enriched, headers);
                this.logToLinelist('success', `✓ Re-derived ${enriched.length} line numbers`);
            });
            reDeriveBtn.dataset.listener = 'true';
        }
    }

    /**
     * Find the actual header name that matches one of the candidate names.
     */
    _findColumn(headers, candidates) {
        for (const c of candidates) {
            const found = headers.find(h => h.toLowerCase().includes(c.toLowerCase()));
            if (found) return found;
        }
        return null;
    }

    // ═══════════════════════════════════════════
    //  Attribute Mapping (SmartProcessMap)
    // ═══════════════════════════════════════════
    renderSmartMapUI(headers) {
        const container = document.getElementById('smart-map-ui');
        container.innerHTML = '';

        const state = getState('linelist') || {};
        const mapping = state.smartMapping || {};
        const options = state.smartOptions || {};

        // Define Rows with IMPROVED ALIASES (more specific patterns first)
        const rows = [
            { key: 'P1', label: 'ATTRIBUTE1 (P1)', aliases: ['Design Pr', 'Op. Pr', 'Oper. Pr', 'Max. Pr', 'Design Pressure', 'Operating Pressure'] },
            { key: 'T1', label: 'ATTRIBUTE2 (T1)', aliases: ['Design Temp', 'Max Temp', 'Op. Temp', 'Oper. Temp', 'Operating Temp'] },
            { key: 'InsThk', label: 'ATTRIBUTE5 (Ins thk)', aliases: ['Insulation', 'Ins Thk', 'Ins. Thk', 'Insul'] },
            // Density Group
            { key: 'DensityGas', label: 'ATTRIBUTE9 (Density - Gas)', aliases: ['Gas', 'Density Gas', 'Fluid Den'] },
            { key: 'DensityLiq', label: 'ATTRIBUTE9 (Density - Liquid)', aliases: ['Liquid', 'Density Liq', 'Fluid Den'] },
            { key: 'DensityMixed', label: 'ATTRIBUTE9 (Density - Mixed)', aliases: ['Mixed', 'Density Mix'] },
            { key: 'Phase', label: 'Phase Column (for Density)', aliases: ['Phase'] },
            // Other
            { key: 'HP', label: 'COMP-ATTR10 (HP)', aliases: ['Hydro', 'Test Pr', 'Hydrostatic', 'Hydro Pr'] },
            { key: 'LineRef', label: 'PIPELINE-REF (Line No.)', aliases: ['Derived', 'Line No', 'Line Number'] },
            { key: 'PipingClass', label: 'PIPING-CLASS (Class)', aliases: ['Construction Class', 'Piping Class', 'Spec', 'Class'] }
        ];

        // 1. Render Table Rows
        rows.forEach(row => {
            const div = document.createElement('div');
            div.className = 'map-row';
            div.style.marginBottom = '0.5rem';

            const label = document.createElement('label');
            label.textContent = row.label;
            label.style.width = '180px';
            label.style.fontSize = '0.75rem';

            const select = document.createElement('select');
            select.style.cssText = 'background:var(--bg-0);border:1px solid var(--steel);color:var(--text-primary);padding:0.3rem;border-radius:var(--radius-sm);flex:1';

            // Empty Option
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '(Select Column)';
            select.appendChild(emptyOpt);

            // Populate Headers
            headers.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h;
                opt.textContent = h;

                // Auto-select if matches saved mapping OR fuzzy match alias
                const saved = mapping[row.key];
                if (saved === h) {
                    opt.selected = true;
                } else if (!saved) {
                    // Try auto-match
                    const lowerH = h.toLowerCase();
                    if (row.aliases.some(alias => lowerH.includes(alias.toLowerCase()))) {
                        opt.selected = true;
                    }
                }
                select.appendChild(opt);
            });

            // Save on Change
            select.addEventListener('change', (e) => {
                linelistService.updateSmartMapping(row.key, e.target.value);
            });

            // Auto-persist if alias-matched value was selected
            if (select.value && select.value !== '' && !mapping[row.key]) {
                console.log(`[SmartMap] Auto-persisting fuzzy match: ${row.key} => ${select.value}`);
                this.logToLinelist('info', `  → Auto-filled ${row.key}: "${select.value}"`);
                linelistService.updateSmartMapping(row.key, select.value);
            }

            div.appendChild(label);
            div.appendChild(select);
            container.appendChild(div);
        });

        // 2. Render Density Option Toggle
        const toggleDiv = document.createElement('div');
        toggleDiv.style.marginTop = '0.5rem';
        toggleDiv.style.fontSize = '0.75rem';
        toggleDiv.style.color = 'var(--text-muted)';

        const isMixed = options.densityMixedPreference === 'Mixed';
        toggleDiv.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.5rem">
                <span>Use Liquid/Mixed:</span>
                <button class="toggle ${isMixed ? 'on' : ''}" id="toggle-density-pref" role="switch"></button>
                <span id="density-pref-lbl">${isMixed ? 'Mixed' : 'Liquid'} (Default)</span>
            </div>
            <div style="font-size:0.7rem;margin-top:2px;font-style:italic">If Phase="M", use this preference. Fallback is Liquid.</div>
        `;
        container.appendChild(toggleDiv);

        // Wire Toggle
        const btn = toggleDiv.querySelector('#toggle-density-pref');
        const lbl = toggleDiv.querySelector('#density-pref-lbl');
        btn.addEventListener('click', () => {
            const nextState = !btn.classList.contains('on'); // if on, next is off (Liquid)
            btn.classList.toggle('on', nextState);
            const val = nextState ? 'Mixed' : 'Liquid';
            lbl.textContent = nextState ? 'Mixed' : 'Liquid (Default)';
            linelistService.updateSmartOptions('densityMixedPreference', val);
        });
    }

    populateSourceSelect(headers) {
        const sel = document.getElementById('new-attr-source');
        sel.innerHTML = '<option value="">(Select Column)</option>';
        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            sel.appendChild(opt);
        });
    }

    addAttributeMapping() {
        const source = document.getElementById('new-attr-source').value;
        const target = document.getElementById('new-attr-target').value.trim();

        if (source && target) {
            dataManager.setAttributeMapping(source, target);
            this.renderAttributeList();
            document.getElementById('new-attr-target').value = '';
        }
    }

    renderAttributeList() {
        const container = document.getElementById('attr-list');
        container.innerHTML = '';

        const map = dataManager.attributeMap;
        Object.keys(map).forEach(source => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-1 mb-1';
            div.style.fontSize = '0.78rem';
            div.innerHTML = `
        <span style="color:var(--text-muted);font-family:var(--font-code)">${source}</span>
        <span style="color:var(--text-muted);margin:0 0.3rem">→</span>
        <span style="color:var(--text-code);font-family:var(--font-code)">${map[source]}</span>
        <button class="btn btn-danger btn-sm" style="padding:0 6px;font-size:0.65rem;margin-left:auto">✕</button>
      `;

            div.querySelector('button').addEventListener('click', () => {
                dataManager.removeAttributeMapping(source);
                this.renderAttributeList();
            });

            container.appendChild(div);
        });
    }

    // ═══════════════════════════════════════════
    //  Mapping UI (Linelist + Weights key columns)
    // ═══════════════════════════════════════════
    renderMappingUI(type, headers) {
        const config = dataManager.headerMap[type];
        if (!config) return;
        const uiContainer = document.getElementById(`${type}-mapping-ui`);
        uiContainer.innerHTML = '';

        let autoMatchFound = false;

        Object.keys(config).forEach(key => {
            const div = document.createElement('div');
            div.className = 'map-row';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '0.5rem';

            const label = document.createElement('label');
            label.textContent = key;

            // Status indicator
            const statusSpan = document.createElement('span');
            statusSpan.style.fontSize = '0.9rem';
            statusSpan.style.marginLeft = 'auto';
            statusSpan.style.opacity = '0';
            statusSpan.className = `status-${type}-${key}`;

            const select = document.createElement('select');
            select.style.cssText = 'background:var(--bg-0);border:1px solid var(--steel);color:var(--text-primary);padding:0.3rem;border-radius:var(--radius-sm);flex:1';

            // Add empty option
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '(Select)';
            select.appendChild(emptyOpt);

            let matchedValue = null;
            headers.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h;
                opt.textContent = h;
                // Auto-select if header name matches the config default
                if (h.toLowerCase().includes(config[key].toLowerCase()) ||
                    config[key].toLowerCase().includes(h.toLowerCase())) {
                    opt.selected = true;
                    matchedValue = h;
                    autoMatchFound = true;
                }
                select.appendChild(opt);
            });

            // Auto-persist matched value
            if (matchedValue && type !== 'linelist') {
                dataManager.updateHeaderMap(type, { [key]: matchedValue });
                statusSpan.textContent = '✓';
                statusSpan.style.color = 'var(--green-ok)';
                statusSpan.style.opacity = '1';
            } else if (matchedValue) {
                statusSpan.textContent = '✓';
                statusSpan.style.color = 'var(--green-ok)';
                statusSpan.style.opacity = '1';
            } else {
                statusSpan.textContent = '⚠';
                statusSpan.style.color = 'var(--amber)';
                statusSpan.style.opacity = '0.5';
            }

            select.addEventListener('change', (e) => {
                dataManager.updateHeaderMap(type, { [key]: e.target.value });

                // Update status
                if (e.target.value) {
                    statusSpan.textContent = '✓';
                    statusSpan.style.color = 'var(--green-ok)';
                    statusSpan.style.opacity = '1';
                } else {
                    statusSpan.textContent = '⚠';
                    statusSpan.style.color = 'var(--amber)';
                    statusSpan.style.opacity = '0.5';
                }

                // Sync Linelist keys if type is linelist
                if (type === 'linelist') {
                    const currentMap = dataManager.headerMap.linelist || {};
                    linelistService.updateKeys({
                        sequenceCol: currentMap.lineNo,
                        serviceCol: currentMap.service
                    });
                }
            });

            div.appendChild(label);
            div.appendChild(select);
            div.appendChild(statusSpan);
            uiContainer.appendChild(div);
        });

        if (autoMatchFound && type !== 'linelist') {
            this.logToLinelist('success', `✓ Auto-matched ${type} header mappings`);
        }
    }

    // ═══════════════════════════════════════════
    //  Data Preview Tables
    // ═══════════════════════════════════════════
    renderPreview(type, data, headers) {
        const container = document.getElementById(`${type}-preview`);
        if (!data || data.length === 0) return;
        container.style.display = '';

        // Show all columns, rely on horizontal scroll
        const displayHeaders = headers;
        container.innerHTML = '';
        container.appendChild(this._buildPreviewTable(data, displayHeaders, 15));
    }

    renderDumpPreview(data, headers) {
        const container = document.getElementById('dump-preview');
        if (!data || data.length === 0) return;
        container.style.display = '';

        // Show key columns + derived Line No.
        const priorityCols = ['Reference of the element', 'Name', 'Type', 'Position', 'PIPE', 'Line No. (Derived)'];
        const displayHeaders = priorityCols.filter(c => headers.includes(c) || c === 'Line No. (Derived)');

        container.innerHTML = '';
        container.appendChild(this._buildPreviewTable(data, displayHeaders, 20));
    }

    _buildPreviewTable(data, displayHeaders, maxRows = 15) {
        const wrap = document.createElement('div');
        wrap.className = 'data-table-wrap';
        wrap.style.maxHeight = '400px';
        wrap.style.overflowY = 'auto';
        // Note: overflow-x: auto is handled by CSS class .data-table-wrap

        const table = document.createElement('table');
        table.className = 'data-table';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        displayHeaders.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            // Highlight the derived column
            if (h === 'Line No. (Derived)') {
                th.style.color = 'var(--amber)';
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        data.slice(0, maxRows).forEach(row => {
            const tr = document.createElement('tr');
            displayHeaders.forEach(h => {
                const td = document.createElement('td');
                const val = row[h];
                td.textContent = val !== undefined && val !== null ? String(val) : '';
                // Highlight derived line number
                if (h === 'Line No. (Derived)' && val) {
                    td.style.color = 'var(--green-ok)';
                    td.style.fontWeight = '600';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        if (data.length > maxRows) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = displayHeaders.length;
            td.style.cssText = 'text-align:center;color:var(--text-muted);font-style:italic;padding:0.5rem';
            td.textContent = `… and ${data.length - maxRows} more rows`;
            tr.appendChild(td);
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        wrap.appendChild(table);
        return wrap;
    }

    // ══════════════════════════════════════
    //  Diagnostic Logging for Linelist
    // ══════════════════════════════════════
    logToLinelist(level, message) {
        const logDiv = document.getElementById('linelist-diagnostic-log');
        if (!logDiv) return;

        const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
        const colors = {
            info: 'var(--text-muted)',
            success: 'var(--green-ok)',
            error: 'var(--red-err)',
            warn: 'var(--amber)'
        };
        const color = colors[level] || 'var(--text-primary)';

        this.linelistLogs = this.linelistLogs || [];
        this.linelistLogs.push({ timestamp, level, message, color });

        // Render all logs
        logDiv.innerHTML = this.linelistLogs.map(log =>
            `<div style="margin-bottom:2px;"><span style="color:var(--steel)">[${log.timestamp}]</span> <span style="color:${log.color}">${log.message}</span></div>`
        ).join('');

        // Auto-scroll to bottom
        const panel = logDiv.parentElement;
        if (panel) panel.scrollTop = panel.scrollHeight;
    }

    clearLinelistLog() {
        this.linelistLogs = [];
        const logDiv = document.getElementById('linelist-diagnostic-log');
        if (logDiv) {
            logDiv.innerHTML = '<span style="color:var(--text-muted)">Log cleared. Upload a linelist file to see detailed processing logs...</span>';
        }
    }
}
