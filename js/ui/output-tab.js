/**
 * output-tab.js — OUTPUT tab UI
 * Wires Generate PCF and Download buttons.
 * Generate runs the full topology → traversal → assembly pipeline from state.
 * Download triggers a browser file download of the assembled PCF.
 */

import { getConfig } from '../config/config-store.js';
import { getState, setState, subscribe } from '../state.js';
import { groupByRefNo, getPipelineRef } from '../converter/grouper.js';
import { processGeometry } from '../geometry/pipeline.js';
import { runSequencer } from '../graph/sequencer.js';
import { assemble } from '../output/pcf-assembler.js';
import { downloadPCF } from '../output/pcf-writer.js';
import { validateSyntax, parseBlocks } from '../validation/syntax-validator.js';
import { validateInput } from '../validation/input-validator.js';
import { checkContinuity } from '../validation/continuity-checker.js';
import { detectAnomalies } from '../validation/anomaly-detector.js';
import { validatePCFContinuity } from '../validation/pcf-continuity-validator.js';

const LOG_PREFIX = '[OutputTab]';

let _dom = {};

export function initOutputTab() {
  _dom = {
    generateBtn: document.getElementById('btn-generate'),
    downloadBtn: document.getElementById('btn-download-pcf'),
    downloadFilteredBtn: document.getElementById('btn-download-pcf-filtered'),
    downloadLog: document.getElementById('btn-download-log'),
    statusSpan: document.getElementById('validation-summary'),
    errorDiv: document.getElementById('output-error'),
    logEl: document.getElementById('log-output'),
    pcfPreview: document.getElementById('pcf-preview-output'),
    copyBtn: document.getElementById('btn-copy-preview'),
  };

  if (!_dom.copyBtn) {
      // Inject copy button if missing from HTML
      const container = _dom.pcfPreview?.parentElement;
      if (container) {
          const btn = document.createElement('button');
          btn.id = 'btn-copy-preview';
          btn.className = 'btn-icon';
          btn.innerHTML = '📋'; // Simple copy icon
          btn.title = 'Copy PCF content';
          btn.style.cssText = 'position:absolute; top:0.5rem; right:0.5rem; background:var(--bg-panel); border:1px solid var(--steel); border-radius:4px; cursor:pointer; padding:0.25rem;';

          // Ensure container is relative
          if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
          container.appendChild(btn);
          _dom.copyBtn = btn;
      }
  }

  const missing = Object.entries(_dom).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) console.warn(`${LOG_PREFIX} Missing DOM: ${missing.join(', ')}`);

  _dom.generateBtn?.addEventListener('click', _runGenerate);
  _dom.copyBtn?.addEventListener('click', _copyPreview);
  _dom.downloadBtn?.addEventListener('click', _runDownload);
  _dom.downloadFilteredBtn?.addEventListener('click', _runDownloadFiltered);
  _dom.downloadLog?.addEventListener('click', _downloadLog);

  // Enable/disable download button reactively when pcfLines changes
  subscribe('pcfLines', lines => {
    if (_dom.downloadBtn) _dom.downloadBtn.disabled = !lines?.length;
    if (_dom.downloadFilteredBtn) _dom.downloadFilteredBtn.disabled = !lines?.length;
    _renderPreview();
  });

  // Reflect any pcfLines already in state (e.g. generated from MAPPING tab)
  const existing = getState('pcfLines');
  if (existing?.length) {
    if (_dom.downloadBtn) _dom.downloadBtn.disabled = false;
    if (_dom.downloadFilteredBtn) _dom.downloadFilteredBtn.disabled = false;
    _showStatus(`✓ PCF ready (${existing.length} lines) — click Download to save.`, 'ok');
    _renderLog();
    _renderPreview();
  }

  console.info(`${LOG_PREFIX} Output tab initialised.`);
}

// ── Generate pipeline ─────────────────────────────────────────────

async function _runGenerate() {
  const normalizedRows = getState('normalizedRows');
  if (!normalizedRows?.length) {
    _showError('Load and parse a CSV file in the INPUT tab first.');
    return;
  }
  _hideError();
  _setGenerateLoading(true);

  try {
    const config = getConfig();

    // 1. Group rows (re-use existing groups if already in state, otherwise build fresh)
    let groups = getState('groups');
    if (!groups?.size) {
      groups = groupByRefNo(normalizedRows, config);

      // Run Geometry Pipeline (Build Pts -> Overlap Resolution -> Gap Fill -> Validation)
      const { groups: processed, anomalies } = processGeometry(groups, config);
      groups = processed;

      // Merge any anomalies into the validation report
      if (anomalies.length) {
        const report = getState('validationReport') ?? {};
        report.anomaly = [...(report.anomaly ?? []), ...anomalies];
        setState('validationReport', report);
      }
      setState('groups', groups);
    }

    // 2 & 3. Sequencing (Graph vs Linear)
    const seqResult = runSequencer(groups, config);
    setState('topology', seqResult.topology);
    setState('traversalOrder', seqResult.ordered);

    // 4. Assemble PCF lines
    const pipelineRef = getPipelineRef(normalizedRows);
    const pcfLines = assemble({ ordered: seqResult.ordered }, groups, config, pipelineRef);
    setState('pcfLines', pcfLines);

    // 5. Final Output Validation (Coordinate Continuity)
    const pcfIssues = validatePCFContinuity(pcfLines, config);
    if (pcfIssues.length > 0) {
      const report = getState('validationReport') ?? {};
      report.pcfContinuity = pcfIssues;
      setState('validationReport', report);
    }

    const n = traversalResult.ordered.length;
    const o = traversalResult.orphans.length;
    const orphanNote = o ? ` (${o} orphan${o > 1 ? 's' : ''})` : '';
    _showStatus(`✓ ${n} component${n !== 1 ? 's' : ''} converted${orphanNote}. Click Download to save.`, 'ok');
    _renderLog();
    _renderPreview();

    console.info(`${LOG_PREFIX} Generate complete. ${pcfLines.length} lines generated.`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Generate error: ${err.message}`, err);
    _showError(`Generation failed: ${err.message}`);
    _showStatus('✗ Generation failed — see error above.', 'error');
  } finally {
    _setGenerateLoading(false);
  }
}

// ── Download PCF ──────────────────────────────────────────────────

function _runDownload() {
  const pcfLines = getState('pcfLines');
  if (!pcfLines?.length) {
    _showError('Generate the PCF first before downloading.');
    return;
  }
  const config = getConfig();
  const meta = getState('meta');
  const baseName = (meta?.filename || 'output').replace(/\.[^.]+$/, '');
  downloadPCF(pcfLines, `${baseName}.pcf`, config);
  console.info(`${LOG_PREFIX} Download triggered: ${baseName}.pcf`);
}

// ── Download Log ──────────────────────────────────────────────────

function _downloadLog() {
  const text = _dom.logEl?.textContent || '(no log entries)';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'conversion-log.txt'; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
  console.info(`${LOG_PREFIX} Log download triggered.`);
}

// ── Log rendering ─────────────────────────────────────────────────

function _renderLog() {
  if (!_dom.logEl) return;
  const report = getState('validationReport');

  const issues = report
    ? [
      ...(report.input || []).map(i => ({ ...i, _label: 'INPUT' })),
      ...(report.continuity || []).map(i => ({ ...i, _label: 'CONTINUITY' })),
      ...(report.anomaly || []).map(i => ({ ...i, _label: 'ANOMALY' })),
      ...(report.syntax || []).map(i => ({ ...i, _label: 'SYNTAX' })),
      ...(report.pcfContinuity || []).map(i => ({ ...i, _label: 'PCF-CONTINUITY' })),
    ]
    : [];

  if (issues.length === 0) {
    _dom.logEl.textContent = '— no validation issues —';
    return;
  }

  _dom.logEl.textContent = issues
    .map(i => `[${i.severity}] [${i._label}] ${i.id}: ${i.message}${i.detail ? ' | ' + i.detail : ''}`)
    .join('\n');
}

// ── Preview rendering ─────────────────────────────────────────────

function _renderPreview() {
  if (!_dom.pcfPreview) return;
  const pcfLines = getState('pcfLines');

  if (!pcfLines?.length) {
    _dom.pcfPreview.innerHTML = '<span style="color:var(--text-muted)">Generate PCF to see preview...</span>';
    if (_dom.copyBtn) _dom.copyBtn.style.display = 'none';
    return;
  }

  _dom.pcfPreview.textContent = pcfLines.join('\n');
  if (_dom.copyBtn) _dom.copyBtn.style.display = 'block';
}

async function _copyPreview() {
    const lines = getState('pcfLines');
    if (!lines?.length) return;
    try {
        await navigator.clipboard.writeText(lines.join('\n'));
        if (_dom.copyBtn) {
            const original = _dom.copyBtn.innerHTML;
            _dom.copyBtn.innerHTML = '✅';
            setTimeout(() => _dom.copyBtn.innerHTML = original, 1500);
        }
    } catch (err) {
        console.error('Copy failed', err);
        alert('Failed to copy to clipboard');
    }
}

// ── UI helpers ────────────────────────────────────────────────────

function _setGenerateLoading(on) {
  if (!_dom.generateBtn) return;
  _dom.generateBtn.disabled = on;
  _dom.generateBtn.textContent = on ? '⏳ Generating…' : '⚙ Generate PCF';
}

function _showStatus(msg, type) {
  if (!_dom.statusSpan) return;
  const colors = { ok: 'var(--green-ok)', error: 'var(--red-err)', warn: 'var(--yellow-warn)' };
  _dom.statusSpan.textContent = msg;
  _dom.statusSpan.style.color = colors[type] || 'var(--text-muted)';
}

function _showError(msg) {
  if (!_dom.errorDiv) return;
  _dom.errorDiv.textContent = msg;
  _dom.errorDiv.style.display = 'block';
}

function _runDownloadFiltered() {
  const lines = getState('pcfLines');
  if (!lines?.length) return;

  const config = getConfig();

  // 0. Ensure we have a full validation report (Run validation if needed)
  // We can't rely on getState('validationReport') because the user might not have visited the Validate tab.
  const rows = getState('normalizedRows');
  const groups = getState('groups');
  const topology = getState('topology');
  const traversalOrder = getState('traversalOrder');

  const fullReport = { input: [], continuity: [], anomaly: [], syntax: [] };

  if (rows?.length) {
    fullReport.input = validateInput(rows, config);
  }
  if (groups && topology) {
    fullReport.continuity = checkContinuity(topology, groups, config);
  }
  if (groups && traversalOrder) {
    fullReport.anomaly = detectAnomalies(groups, traversalOrder, config);
  }
  // Syntax validation is run below or we can run it here
  fullReport.syntax = validateSyntax(lines, config);

  // Update global state so Validate tab is fresh if they visit it later
  setState('validationReport', fullReport);

  // 1. Collect bad RefNos from logical validation
  const badRefNos = new Set();
  const collectBadRefs = (issueList) => {
    if (!issueList) return;
    issueList.forEach(issue => {
      // Relaxed filter: Only remove ERRORs, keep WARNINGs
      if (issue.severity === 'ERROR' && issue.refno) {
        badRefNos.add(String(issue.refno));
      }
    });
  };
  collectBadRefs(fullReport.input);
  collectBadRefs(fullReport.continuity);
  collectBadRefs(fullReport.anomaly);

  const badLineNos = new Set();
  fullReport.syntax.forEach(issue => {
    // Relaxed filter: Only remove ERRORs, keep WARNINGs
    if (issue.severity === 'ERROR') {
      if (issue.rowIndex !== null) badLineNos.add(issue.rowIndex);
    }
  });

  if (badRefNos.size === 0 && badLineNos.size === 0) {
    const totalIssues = (fullReport.input?.length || 0) + (fullReport.continuity?.length || 0) + (fullReport.anomaly?.length || 0) + (fullReport.syntax?.length || 0);

    let msg = '';
    if (totalIssues > 0) {
      msg = `Found ${totalIssues} warnings, but no critical errors (ERRORS).\n\nThe filtered file would be identical to the full file (warnings are preserved).`;
    } else {
      msg = 'No warnings or errors found (logic or syntax).';
    }

    if (!confirm(`${msg}\n\nDo you want to download the full file anyway?`)) return;
    downloadPCF(lines, 'Phase2_filtered.pcf', config);
    return;
  }

  // 3. Identify blocks to remove
  const blocks = parseBlocks(lines);
  const badBlockIndices = new Set();

  // Helper: check if block has bad line
  const hasBadLine = (b) => {
    const start = b.startLine;
    const end = b.attributes.length > 0 ? b.attributes[b.attributes.length - 1].lineNo : start;
    for (let i = start; i <= end; i++) {
      if (badLineNos.has(i)) return true;
    }
    return false;
  };

  // Iterate blocks to find bad ones
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    // Check Syntax Lines
    if (hasBadLine(b)) {
      badBlockIndices.add(i);
    }

    // Check RefNo in MESSAGE-SQUARE
    if (b.keyword === 'MESSAGE-SQUARE') {
      // Look for RefNo in attributes
      let foundRef = null;
      for (const attr of b.attributes) {
        const match = attr.line.match(/RefNo:\s*(\S+)/);
        if (match) {
          foundRef = match[1];
          break;
        }
      }

      if (foundRef && badRefNos.has(foundRef)) {
        badBlockIndices.add(i);     // Remove Message Square
        if (i + 1 < blocks.length) {
          badBlockIndices.add(i + 1); // Remove following Component
        }
      }
    }
  }

  // 4. Cleanup: Ensure pairs are removed
  // If a component is removed (e.g. via syntax error), remove its preceding MESSAGE-SQUARE
  for (let i = 1; i < blocks.length; i++) {
    // If component is bad, check predecessor
    if (badBlockIndices.has(i)) {
      const prev = blocks[i - 1];
      if (prev.keyword === 'MESSAGE-SQUARE') {
        badBlockIndices.add(i - 1);
      }
    }
  }
  // If MESSAGE-SQUARE is bad, remove successor (already done in step 3, but safe to repeat or check edge cases)

  // 5. Build filtered lines
  const filteredLines = [];

  // We need to know which lines belong to bad blocks
  const badLineRanges = [];
  // Sort indices
  const sortedBadIndices = Array.from(badBlockIndices).sort((a, b) => a - b);

  sortedBadIndices.forEach(idx => {
    const b = blocks[idx];
    const start = b.startLine;
    const end = b.attributes.length > 0 ? b.attributes[b.attributes.length - 1].lineNo : start;
    badLineRanges.push({ start, end });
  });

  const isBadLine = (lineNo) => {
    return badLineRanges.some(r => lineNo >= r.start && lineNo <= r.end);
  };

  for (let i = 0; i < lines.length; i++) {
    if (!isBadLine(i)) {
      filteredLines.push(lines[i]);
    }
  }

  // Remove consecutive blank lines (optional visual cleanup)
  const cleaned = [];
  filteredLines.forEach((l, idx) => {
    if (l.trim() === '' && (cleaned.length === 0 || cleaned[cleaned.length - 1].trim() === '')) return;
    cleaned.push(l);
  });

  const removingCount = badBlockIndices.size;
  console.info(`[OutputTab] Filtered download: removed ${removingCount} blocks (RefNos: ${badRefNos.size}, Lines: ${badLineNos.size}).`);

  if (filteredLines.length === 0 || cleaned.length === 0) {
    alert('Filtering removed everything!');
    return;
  }

  // Download
  const meta = getState('meta');
  const baseName = (meta?.filename || 'output').replace(/\.[^.]+$/, '');
  const outName = `${baseName}_filtered.pcf`;

  const blob = new Blob([cleaned.join('\n')], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.hidden = true;
  a.href = url;
  a.download = outName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 1000);
}

function _hideError() {
  if (_dom.errorDiv) _dom.errorDiv.style.display = 'none';
}
