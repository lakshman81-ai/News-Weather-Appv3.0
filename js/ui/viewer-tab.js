/**
 * viewer-tab.js — ⑦ 3D VIEWER tab UI wiring
 * Connects the PCF parser → stitcher → 3D viewer pipeline.
 * Also supports toggling between 3D view and data table.
 *
 * Exports:
 *   initViewerTab()
 */

import { parsePcf } from '../viewer/pcf-parser.js';
import { Stitcher } from '../viewer/pcf-stitcher.js';
import { PcfViewer3D } from '../viewer/viewer-3d.js';
import { renderTable } from '../viewer/table-log.js';
import { getState } from '../state.js';

const LOG_PREFIX = '[ViewerTab]';

let _dom = {};
let _viewer3d = null;
let _processedData = { components: [], logs: [] };
let _viewMode = '3D'; // '3D' or 'TABLE'

export function initViewerTab() {
    _dom = {
        input: document.getElementById('viewer-pcf-input'),
        loadBtn: document.getElementById('btn-viewer-load'),
        openBtn: document.getElementById('btn-viewer-open'),
        fileInput: document.getElementById('viewer-file-input'),
        generateBtn: document.getElementById('btn-viewer-generate'),
        toleranceEl: document.getElementById('viewer-tolerance'),
        canvasWrap: document.getElementById('viewer-canvas-wrap'),
        tableWrap: document.getElementById('viewer-table-wrap'),
        logEl: document.getElementById('viewer-log'),
        statusEl: document.getElementById('viewer-status'),
        btn3D: document.getElementById('btn-viewer-3d'),
        btnTable: document.getElementById('btn-viewer-table'),
    };

    const missing = Object.entries(_dom).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
        console.warn(`${LOG_PREFIX} Missing DOM elements: ${missing.join(', ')}`);
    }

    // Load PCF from state (generated output)
    _dom.loadBtn?.addEventListener('click', _loadFromState);

    // Open PCF file from disk
    _dom.openBtn?.addEventListener('click', () => _dom.fileInput?.click());
    _dom.fileInput?.addEventListener('change', _handleFileOpen);

    // Generate 3D
    _dom.generateBtn?.addEventListener('click', _runGenerate);

    // View mode toggle
    _dom.btn3D?.addEventListener('click', () => _switchView('3D'));
    _dom.btnTable?.addEventListener('click', () => _switchView('TABLE'));

    // Set default view
    _switchView('3D');

    console.info(`${LOG_PREFIX} Viewer tab initialised.`);
}

/** Load PCF text from state (output of Generate PCF) */
function _loadFromState() {
    const pcfLines = getState('pcfLines');
    if (!pcfLines?.length) {
        _showStatus('No PCF generated yet. Generate in the OUTPUT tab first.', 'warn');
        return;
    }
    if (_dom.input) {
        _dom.input.value = pcfLines.join('\n');
    }
    _showStatus(`Loaded ${pcfLines.length} lines from generated PCF.`, 'ok');
}

/** Open a .pcf/.txt file from disk and load into textarea */
async function _handleFileOpen(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        if (_dom.input) _dom.input.value = text;
        _showStatus(`Loaded file: ${file.name} (${text.split('\n').length} lines)`, 'ok');
    } catch (err) {
        _showStatus(`Error reading file: ${err.message}`, 'error');
    }
    // Reset so same file can be re-selected
    if (_dom.fileInput) _dom.fileInput.value = '';
}

/** Main generate pipeline */
function _runGenerate() {
    const rawText = _dom.input?.value?.trim() || '';
    if (!rawText) {
        _showStatus('Paste PCF content or Load from output first.', 'warn');
        return;
    }

    const tolerance = parseFloat(_dom.toleranceEl?.value || '6');

    try {
        // 1. Parse
        const rawComponents = parsePcf(rawText);
        if (rawComponents.length === 0) {
            _showStatus('No components found in PCF text.', 'warn');
            return;
        }

        // 2. Stitch
        const stitcher = new Stitcher(tolerance);
        _processedData = stitcher.process(rawComponents);

        // 3. Render logs
        _renderLogs(_processedData.logs);

        // 4. Render current view
        if (_viewMode === '3D') {
            _render3D();
        } else {
            _renderTableView();
        }

        _showStatus(`✓ ${_processedData.components.length} components rendered.`, 'ok');
        console.info(`${LOG_PREFIX} Generate complete. ${_processedData.components.length} components.`);
    } catch (err) {
        console.error(`${LOG_PREFIX} Generate error:`, err);
        _showStatus(`Error: ${err.message}`, 'error');
    }
}

/** Switch between 3D and TABLE views */
function _switchView(mode) {
    _viewMode = mode;

    // Toggle active buttons
    _dom.btn3D?.classList.toggle('active', mode === '3D');
    _dom.btnTable?.classList.toggle('active', mode === 'TABLE');

    // Toggle containers
    if (_dom.canvasWrap) _dom.canvasWrap.style.display = mode === '3D' ? 'block' : 'none';
    if (_dom.tableWrap) _dom.tableWrap.style.display = mode === 'TABLE' ? 'block' : 'none';

    // Re-render if we have data
    if (_processedData.components.length > 0) {
        if (mode === '3D') {
            _render3D();
        } else {
            _renderTableView();
        }
    }
}

/** Render 3D view */
function _render3D() {
    if (!_dom.canvasWrap) return;

    // Lazy-init viewer
    if (!_viewer3d) {
        _viewer3d = new PcfViewer3D(_dom.canvasWrap);
    }
    _viewer3d.render(_processedData.components);
}

/** Render table view */
function _renderTableView() {
    if (!_dom.tableWrap) return;
    renderTable(_dom.tableWrap, _processedData.components);
}

/** Render log entries */
function _renderLogs(logs) {
    if (!_dom.logEl) return;
    if (!logs || logs.length === 0) {
        _dom.logEl.innerHTML = '<span style="color:var(--text-muted)">No log entries.</span>';
        return;
    }
    _dom.logEl.innerHTML = logs.map(log => {
        const color = log.type === 'WARN' ? 'var(--yellow-warn)' :
            log.type === 'SUCCESS' ? 'var(--green-ok)' :
                'var(--text-secondary)';
        return `<div style="margin-bottom:3px;color:${color}">
      <span style="color:var(--text-muted)">[${log.timestamp}]</span> ${_escHtml(log.message)}
    </div>`;
    }).join('');
}

/** Status bar within the viewer */
function _showStatus(msg, type) {
    if (!_dom.statusEl) return;
    const colors = { ok: 'var(--green-ok)', error: 'var(--red-err)', warn: 'var(--yellow-warn)' };
    _dom.statusEl.textContent = msg;
    _dom.statusEl.style.color = colors[type] || 'var(--text-muted)';
}

/** Escape HTML */
function _escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}
