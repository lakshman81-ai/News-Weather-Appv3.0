/**
 * mapping-tab.js — MAPPING Tab UI
 * Subscribes to normalizedRows state. Groups rows by RefNo, renders component table.
 * Hides the "Load CSV first" placeholder once data is available.
 * Convert button runs topology → traversal → PCF assembly → stores pcfLines in state.
 */

import { getConfig } from "../config/config-store.js";
import { getState, setState, subscribe } from "../state.js";
import { setTabEnabled, switchTab } from "./tab-manager.js";
import { groupByRefNo, getPipelineRef } from "../converter/grouper.js";
import { processGeometry } from "../geometry/pipeline.js";
import { runSequencer } from "../graph/sequencer.js";
import { assemble } from "../output/pcf-assembler.js";

const LOG_PREFIX = "[MappingTab]";

let _dom = {};

export function initMappingTab() {
  _dom = {
    empty: document.getElementById("mapping-empty"),
    tableWrap: document.getElementById("mapping-table-wrap"),
    tbody: document.querySelector("#mapping-table tbody"),
    refreshBtn: document.getElementById("btn-refresh-mapping"),
    regroupBtn: document.getElementById("btn-regroup"),
    convertBtn: document.getElementById("btn-convert"),
  };

  const missing = Object.entries(_dom).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.warn(`${LOG_PREFIX} Missing DOM elements: ${missing.join(", ")}`);
  }

  // Refresh button — re-pull revised data based on changed mapping or imported data
  _dom.refreshBtn?.addEventListener("click", () => {
    const rows = getState("normalizedRows");
    if (!rows?.length) {
      console.warn(`${LOG_PREFIX} Refresh: No normalized rows in state.`);
      return;
    }
    console.info(`${LOG_PREFIX} Refresh triggered. Re-running grouping with ${rows.length} rows.`);
    runGrouping(rows);
  });

  // Re-group on button click
  _dom.regroupBtn?.addEventListener("click", () => {
    const rows = getState("normalizedRows");
    if (!rows?.length) return;
    runGrouping(rows);
  });

  // Convert button — runs full topology → traversal → assembly pipeline
  _dom.convertBtn?.addEventListener("click", runConvert);
  if (_dom.convertBtn) {
    _dom.convertBtn.disabled = true;
    _dom.convertBtn.title = "Group data first by loading a CSV";
  }

  // React to normalizedRows changes (set by input-tab after parse)
  subscribe("normalizedRows", rows => {
    if (rows?.length) {
      runGrouping(rows);
    } else {
      showEmpty();
    }
  });

  // If rows already exist on init (e.g. hot-reload), render immediately
  const existing = getState("normalizedRows");
  if (existing?.length) {
    runGrouping(existing);
  }

  console.info(`${LOG_PREFIX} Mapping tab initialised.`);
}

// ── Core logic ────────────────────────────────────────────────────

function runGrouping(rows) {
  const config = getConfig();
  let groups = groupByRefNo(rows, config);

  // Run Geometry Pipeline
  const { groups: processed, anomalies } = processGeometry(groups, config);
  groups = processed;

  // Merge any anomalies into the validation report
  if (anomalies.length) {
    const report = getState("validationReport") ?? {};
    report.anomaly = [...(report.anomaly ?? []), ...anomalies];
    setState("validationReport", report);
  }

  setState("groups", groups);
  renderMappingTable(groups);
  console.info(`${LOG_PREFIX} Grouped ${groups.size} components (after geometry processing).`);
}

async function runConvert() {
  const groups = getState("groups");
  if (!groups?.size) {
    console.warn(`${LOG_PREFIX} Convert: no groups in state.`);
    return;
  }

  setConvertLoading(true);
  try {
    const config = getConfig();
    const normalizedRows = getState("normalizedRows");

    // 1 & 2. Sequencing
    const seqResult = runSequencer(groups, config);
    setState("topology", seqResult.topology);
    setState("traversalOrder", seqResult.ordered);

    // 3. Assemble PCF lines
    const pipelineRef = getPipelineRef(normalizedRows ?? []);
    const pcfLines = assemble({ ordered: seqResult.ordered }, groups, config, pipelineRef);
    setState("pcfLines", pcfLines);

    console.info(`${LOG_PREFIX} Conversion complete. ${pcfLines.length} lines generated.`);

    // Navigate to PCF in Table Form tab
    switchTab('table-view');

    // Enable downstream tabs that require conversion data
    setTabEnabled('validate', true);
    setTabEnabled('preview', true);
    setTabEnabled('sequence', true);

    showConvertSuccess(traversalResult.ordered.length, traversalResult.orphans.length);
  } catch (err) {
    console.error(`${LOG_PREFIX} Convert error: ${err.message}`, err);
    showConvertError(err.message);
  } finally {
    setConvertLoading(false);
  }
}

// ── Render ────────────────────────────────────────────────────────

function renderMappingTable(groups) {
  if (!_dom.tbody) return;

  if (!groups.size) {
    showEmpty();
    return;
  }

  const rows = [];
  for (const [refno, g] of groups) {
    const statusBadge = g.skip
      ? `<span class="hdr-badge unmapped">${g.pcfType === "UNKNOWN" ? "UNKNOWN" : "SKIP"}</span>`
      : `<span class="hdr-badge mapped">MAPPED</span>`;

    const pcfLabel = g.skip
      ? `<span class="text-muted">${escHtml(g.pcfType)}</span>`
      : `<code style="color:var(--green-ok)">${escHtml(g.pcfType)}</code>`;

    rows.push(`<tr>
      <td><code>${escHtml(refno)}</code></td>
      <td><code>${escHtml(g.csvType)}</code></td>
      <td>${pcfLabel}</td>
      <td style="text-align:center">${g.rows.length}</td>
      <td>${statusBadge}</td>
    </tr>`);
  }

  _dom.tbody.innerHTML = rows.join("");
  showTable();

  // Enable convert button now that groups are ready
  if (_dom.convertBtn) {
    _dom.convertBtn.disabled = false;
    _dom.convertBtn.title = "";
  }
}

function setConvertLoading(on) {
  if (!_dom.convertBtn) return;
  _dom.convertBtn.disabled = on;
  _dom.convertBtn.textContent = on ? "⏳ Converting…" : "▶ Convert →";
}

function showConvertSuccess(componentCount, orphanCount) {
  const msg = document.getElementById("mapping-convert-msg");
  if (!msg) return;
  const orphanNote = orphanCount ? ` (${orphanCount} orphan${orphanCount > 1 ? "s" : ""})` : "";
  msg.textContent = `✓ ${componentCount} component${componentCount !== 1 ? "s" : ""} converted${orphanNote}. PCF ready — go to OUTPUT tab.`;
  msg.className = "issue-item INFO mt-1";
  msg.style.display = "flex";
}

function showConvertError(msg) {
  const el = document.getElementById("mapping-convert-msg");
  if (!el) return;
  el.textContent = `✗ Conversion failed: ${msg}`;
  el.className = "issue-item ERROR mt-1";
  el.style.display = "flex";
}

function showEmpty() {
  if (_dom.empty) _dom.empty.style.display = "";
  if (_dom.tableWrap) _dom.tableWrap.style.display = "none";
  if (_dom.convertBtn) _dom.convertBtn.disabled = true;
  const msg = document.getElementById("mapping-convert-msg");
  if (msg) msg.style.display = "none";
}

function showTable() {
  if (_dom.empty) _dom.empty.style.display = "none";
  if (_dom.tableWrap) _dom.tableWrap.style.display = "";
}

// ── Utility ───────────────────────────────────────────────────────

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
