/**
 * input-tab.js — INPUT Tab UI
 * Handles: file upload, drag-drop, paste, parse button, header mapping table, data preview.
 * Happy path: file → parse → show stats + mapping + preview.
 */

import { getConfig } from "../config/config-store.js";
import { setState, getState } from "../state.js";
import { updateStatusBar } from "../app.js";
import { parseCSV, readFileAsText } from "../input/csv-parser.js";
import { readExcelAsCSV, isExcelFile } from "../input/excel-parser.js";
import { mapHeaders, applyHeaderMap } from "../input/header-mapper.js";
import { normaliseRows } from "../input/unit-transformer.js";

const LOG_PREFIX = "[InputTab]";

/** Cached DOM refs — grabbed once on init. */
let _dom = {};

export function initInputTab() {
  _dom = {
    dropZone: document.getElementById("drop-zone"),
    fileInput: document.getElementById("file-input"),
    pasteToggle: document.getElementById("btn-paste-toggle"),
    pasteArea: document.getElementById("paste-area"),
    pasteTxt: document.getElementById("paste-textarea"),
    parseBtn: document.getElementById("btn-parse"),
    clearBtn: document.getElementById("btn-clear"),
    statsWrap: document.getElementById("parse-stats"),
    headerMapWrap: document.getElementById("header-map-wrap"),
    headerMapTable: document.getElementById("header-map-table"),
    previewWrap: document.getElementById("preview-wrap"),
    previewTable: document.getElementById("preview-table"),
    filenameLabel: document.getElementById("filename-label"),
  };

  const missing = Object.entries(_dom).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.warn(`${LOG_PREFIX} Missing DOM elements: ${missing.join(", ")}`);
  }

  wireDropZone();
  wireFileInput();
  wirePasteToggle();
  wireParseBtn();
  wireClearBtn();

  // Load default headers from localStorage if available
  loadDefaultHeaders();

  console.info(`${LOG_PREFIX} Input tab initialised.`);
}

// ── File handling ─────────────────────────────────────────────────

function wireDropZone() {
  const dz = _dom.dropZone;
  if (!dz) return;
  dz.addEventListener("click", () => _dom.fileInput?.click());
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("drag-over"); handleFiles(e.dataTransfer.files); });
}

function wireFileInput() {
  _dom.fileInput?.addEventListener("change", e => handleFiles(e.target.files));
}

function wirePasteToggle() {
  _dom.pasteToggle?.addEventListener("click", () => {
    const show = !_dom.pasteArea?.classList.contains("visible");
    _dom.pasteArea?.classList.toggle("visible", show);
    if (_dom.pasteToggle) _dom.pasteToggle.textContent = show ? "✕ Close Paste" : "⌗ Paste CSV";
  });
}

function wireParseBtn() {
  _dom.parseBtn?.addEventListener("click", () => {
    const text = getState("rawText");
    if (!text) { showError("No data to parse. Upload a file or paste CSV first."); return; }
    runPipeline(text, getState("meta")?.filename || "pasted-data");
  });
}

function wireClearBtn() {
  _dom.clearBtn?.addEventListener("click", () => {
    setState("rawText", "");
    setState("rawRows", []);
    setState("headerMap", {});
    setState("canonicalRows", []);
    setState("normalizedRows", []);
    setState("meta", { filename: "", rowCount: 0, groupCount: 0, processedAt: null });
    clearUI();
    console.info(`${LOG_PREFIX} Cleared all input data.`);
  });
}

/** Entry point for both file drop and file input. */
async function handleFiles(fileList) {
  if (!fileList?.length) return;
  const file = fileList[0];
  setLoading(true, `Reading ${file.name}…`);

  try {
    let text;
    if (isExcelFile(file)) {
      text = await readExcelAsCSV(file);
    } else {
      text = await readFileAsText(file);
    }

    // Normalise line endings (CR -> LF) to handle legacy Mac/Excel CSVs robustly
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Clear stale downstream state so mapping/output tabs refresh properly
    setState("rawText", text);
    setState("rawRows", []);
    setState("headerMap", {});
    setState("canonicalRows", []);
    setState("normalizedRows", []);
    setState("groups", new Map());
    setState("topology", null);
    setState("traversalOrder", []);
    setState("pcfLines", []);
    setState("validationReport", { input: [], continuity: [], anomaly: [], syntax: [] });
    setState("meta", { filename: file.name, rowCount: 0, groupCount: 0, processedAt: null });
    setFilenameLabel(file.name);
    _dom.dropZone?.classList.add("has-file");

    console.info(`${LOG_PREFIX} File loaded: "${file.name}". Text length: ${text.length}`);
    await runPipeline(text, file.name);
  } catch (err) {
    console.error(`${LOG_PREFIX} handleFiles error for "${file.name}". Reason: ${err.message}`, err);
    showError(`Could not read file: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

/** Full input pipeline: parse → map → normalise → preview. */
async function runPipeline(text, filename) {
  setLoading(true, "Parsing…");
  updateStatusBar("parsing", filename);

  try {
    const config = getConfig();

    // Step 1: Parse CSV/TSV
    const { headers, rows, delimiter, errors } = parseCSV(text, config.inputSettings);
    if (!rows.length) { showError("No data rows found. Check delimiter or file format."); return; }

    setState("rawRows", rows);

    // Step 2: Map headers to canonical names
    const { headerMap, unmapped } = mapHeaders(headers, config.headerAliases);
    setState("headerMap", headerMap);
    setState("unmappedHeaders", unmapped);

    // Step 3: Apply header map to rows
    const canonicalRows = applyHeaderMap(rows, headerMap);
    setState("canonicalRows", canonicalRows);

    // Step 4: Strip units, normalise numeric columns
    const normalizedRows = normaliseRows(canonicalRows, config.unitStripping);
    setState("normalizedRows", normalizedRows);

    // Step 5: Update meta
    setState("meta", { filename, rowCount: rows.length, groupCount: 0, processedAt: Date.now() });

    // Step 6: Render UI
    renderStats({ rows: rows.length, headers: headers.length, unmapped: unmapped.length, errors: errors.length, delimiter });
    renderHeaderMap(headers, headerMap, unmapped);
    renderPreview(normalizedRows, config.inputSettings.previewRowCount);

    updateStatusBar("done", `${rows.length} rows loaded`);
    console.info(`${LOG_PREFIX} Pipeline complete.`, { rows: rows.length, mapped: Object.keys(headerMap).length, unmapped: unmapped.length });

    if (errors.length) showWarning(`${errors.length} parse warning(s). Check data quality.`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Pipeline error. Reason: ${err.message}`, err);
    showError(`Parse error: ${err.message}`);
    updateStatusBar("error", err.message.slice(0, 60));
  } finally {
    setLoading(false);
  }
}

// ── Render helpers ────────────────────────────────────────────────

function renderStats({ rows, headers, unmapped, errors, delimiter }) {
  if (!_dom.statsWrap) return;
  const delimLabel = delimiter === "\t" ? "TAB" : delimiter;
  _dom.statsWrap.innerHTML = `
    <div class="stat-chips">
      <div class="stat-chip"><span class="num">${rows}</span><span class="lbl">Rows</span></div>
      <div class="stat-chip"><span class="num">${headers}</span><span class="lbl">Columns</span></div>
      <div class="stat-chip ${unmapped ? 'warn' : ''}">
        <span class="num" style="color:${unmapped ? 'var(--yellow-warn)' : 'var(--green-ok)'}">${headers - unmapped}</span>
        <span class="lbl">Mapped</span>
      </div>
      ${unmapped ? `<div class="stat-chip"><span class="num" style="color:var(--yellow-warn)">${unmapped}</span><span class="lbl">Unmapped</span></div>` : ""}
      ${errors ? `<div class="stat-chip"><span class="num" style="color:var(--red-err)">${errors}</span><span class="lbl">Parse Errors</span></div>` : ""}
      <div class="stat-chip"><span class="num" style="color:var(--text-muted)">${delimLabel}</span><span class="lbl">Delimiter</span></div>
    </div>`;
  _dom.statsWrap.style.display = "block";
}

function renderHeaderMap(allHeaders, headerMap, unmapped) {
  if (!_dom.headerMapTable) return;

  // Clear previous data first when new CSV loads
  if (allHeaders.length === 0) {
    _dom.headerMapTable.querySelector("tbody").innerHTML = `
      <tr><td colspan="3" class="text-center text-muted">No CSV loaded</td></tr>`;
    _dom.headerMapWrap.style.display = "none";
    return;
  }

  const revMap = {};  // canonical → raw
  for (const [raw, canon] of Object.entries(headerMap)) revMap[canon] = raw;

  const rows = allHeaders.map(raw => {
    const canon = headerMap[raw];
    const status = canon ? "mapped" : "unmapped";
    const badge = canon
      ? `<span class="hdr-badge mapped">Mapped</span>`
      : `<span class="hdr-badge unmapped" style="color:var(--red-err)">Not Mapped</span>`;
    return `<tr class="hdr-map-row ${status}">
      <td><code>${escHtml(raw)}</code></td>
      <td>${canon ? `<code style="color:var(--green-ok)">${escHtml(canon)}</code>` : '<span class="text-muted">—</span>'}</td>
      <td>${badge}</td>
    </tr>`;
  }).join("");

  _dom.headerMapTable.querySelector("tbody").innerHTML = rows;
  _dom.headerMapWrap.style.display = "block";

  // Save header map to localStorage
  try {
    localStorage.setItem('pcf_header_map', JSON.stringify({ allHeaders, headerMap, unmapped }));
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to save header map to localStorage:`, err);
  }
}

function renderPreview(rows, limit) {
  if (!_dom.previewTable || !rows.length) return;
  const preview = rows.slice(0, limit);
  const cols = Object.keys(preview[0] || {});
  const head = `<tr>${cols.map(c => `<th>${escHtml(c)}</th>`).join("")}</tr>`;
  const body = preview.map(row =>
    `<tr>${cols.map(c => {
      const v = row[c] ?? "";
      const cls = isCoord(c) ? " class='num'" : "";
      return `<td${cls}>${escHtml(String(v).slice(0, 40))}</td>`;
    }).join("")}</tr>`
  ).join("");

  _dom.previewTable.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  _dom.previewWrap.style.display = "block";

  // Save current headers to localStorage for next page load
  try {
    localStorage.setItem('pcf_table_headers', JSON.stringify(cols));
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to save headers to localStorage:`, err);
  }
}

// ── Load defaults from localStorage ──────────────────────────────

function loadDefaultHeaders() {
  try {
    const savedHeaders = localStorage.getItem('pcf_table_headers');
    const savedHeaderMap = localStorage.getItem('pcf_header_map');

    // Load preview table headers
    if (savedHeaders) {
      const cols = JSON.parse(savedHeaders);
      if (cols && cols.length && _dom.previewTable) {
        const head = `<tr>${cols.map(c => `<th>${escHtml(c)}</th>`).join("")}</tr>`;
        _dom.previewTable.innerHTML = `<thead>${head}</thead><tbody></tbody>`;
        if (_dom.previewWrap) _dom.previewWrap.style.display = "block";
        console.info(`${LOG_PREFIX} Loaded ${cols.length} default headers from localStorage.`);
      }
    }

    // Load header map table
    if (savedHeaderMap) {
      const { allHeaders, headerMap, unmapped } = JSON.parse(savedHeaderMap);
      if (allHeaders && allHeaders.length) {
        renderHeaderMap(allHeaders, headerMap || {}, unmapped || []);
        console.info(`${LOG_PREFIX} Loaded header map from localStorage.`);
      }
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to load default headers from localStorage:`, err);
  }
}

// ── Utility ───────────────────────────────────────────────────────

function setFilenameLabel(name) {
  if (_dom.filenameLabel) _dom.filenameLabel.textContent = name;
}

function clearUI() {
  if (_dom.statsWrap) _dom.statsWrap.style.display = "none";
  if (_dom.headerMapWrap) _dom.headerMapWrap.style.display = "none";
  if (_dom.previewWrap) _dom.previewWrap.style.display = "none";
  if (_dom.dropZone) _dom.dropZone.classList.remove("has-file");
  if (_dom.filenameLabel) _dom.filenameLabel.textContent = "";
}

function setLoading(on, msg = "") {
  const overlay = document.getElementById("loading-overlay");
  const txt = document.getElementById("loading-text");
  if (overlay) overlay.classList.toggle("active", on);
  if (txt && msg) txt.textContent = msg;
}

function showError(msg) {
  console.error(`${LOG_PREFIX} ${msg}`);
  const el = document.getElementById("input-error");
  if (el) { el.textContent = msg; el.className = "issue-item ERROR mt-1"; el.style.display = "flex"; }
}

function showWarning(msg) {
  console.warn(`${LOG_PREFIX} ${msg}`);
  const el = document.getElementById("input-error");
  if (el) { el.textContent = msg; el.className = "issue-item WARNING mt-1"; el.style.display = "flex"; }
}

const COORD_COLS = new Set(["East", "North", "Up", "Bore", "Wall Thickness", "Corrosion Allowance", "Radius", "Pressure", "Weight", "Insulation thickness", "Hydro test pressure"]);
function isCoord(col) { return COORD_COLS.has(col); }
function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
