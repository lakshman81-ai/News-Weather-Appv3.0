/**
 * config-tab.js — CONFIG Tab UI
 * Phase 1: Output settings, pipeline reference, and alias overview.
 * Full config editor built in Phase 6.
 */

import { getConfig, saveConfig, resetConfig, exportConfig, importConfig } from "../config/config-store.js";
import { setState } from "../state.js";
import { gate } from "../services/gate-logger.js";

const LOG_PREFIX = "[ConfigTab]";

export function initConfigTab() {
  renderOutputSettings();
  renderTypeMapTable();
  renderAliasEditor();
  renderCAEditor();
  renderAnomalyRules();
  renderPipelineMode();
  renderCommon3DLogic();
  wireImportExport();
  wireResetBtn();
  wireAccordions();
  wireToggles();
  console.info(`${LOG_PREFIX} Config tab initialised.`);
}

function wireToggles() {
  // Message Square toggle
  const msBtn = document.getElementById("cfg-msgSquare");
  const msLbl = document.getElementById("cfg-msgSquare-lbl");
  if (msBtn) {
    const cfg = getConfig();
    const on = cfg.outputSettings.includeMessageSquare;
    msBtn.classList.toggle("on", on);
    if (msLbl) msLbl.textContent = on ? "Enabled" : "Disabled";
    msBtn.addEventListener("click", () => {
      const cfg = getConfig();
      const next = !msBtn.classList.contains("on");
      cfg.outputSettings.includeMessageSquare = next;
      msBtn.classList.toggle("on", next);
      if (msLbl) msLbl.textContent = next ? "Enabled" : "Disabled";
      saveConfig(cfg); setState("config", cfg);
    });
  }
  // Tolerance + Decimals
  ["cfg-tolerance", "cfg-decimals"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const path = id === "cfg-tolerance" ? "continuityTolerance" : "decimalPlaces";
    const cfg = getConfig();
    el.value = cfg.coordinateSettings[path];
    el.addEventListener("change", () => {
      const cfg = getConfig();
      cfg.coordinateSettings[path] = parseFloat(el.value);
      saveConfig(cfg); setState("config", cfg);
      console.info(`[ConfigTab] coordinateSettings.${path} = ${el.value}`);
    });
  });

  // ── Overlap Resolution settings ──────────────────────────────────────────────
  const orBtn = document.getElementById("cfg-overlapRes-enabled");
  const orLbl = document.getElementById("cfg-overlapRes-enabled-lbl");
  if (orBtn) {
    const cfg = getConfig();
    const on = cfg.coordinateSettings?.overlapResolution?.enabled !== false;
    orBtn.classList.toggle("on", on);
    if (orLbl) orLbl.textContent = on ? "Enabled" : "Disabled";
    orBtn.addEventListener("click", () => {
      const cfg = getConfig();
      const next = !orBtn.classList.contains("on");
      cfg.coordinateSettings.overlapResolution = cfg.coordinateSettings.overlapResolution ?? {};
      cfg.coordinateSettings.overlapResolution.enabled = next;
      orBtn.classList.toggle("on", next);
      if (orLbl) orLbl.textContent = next ? "Enabled" : "Disabled";
      saveConfig(cfg); setState("config", cfg);
      console.info(`[ConfigTab] overlapResolution.enabled = ${next}`);
    });
  }

  ["cfg-overlapRes-boreTolerance", "cfg-overlapRes-minPipeLength"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const field = id === "cfg-overlapRes-boreTolerance" ? "boreTolerance" : "minPipeLength";
    const cfg = getConfig();
    el.value = cfg.coordinateSettings?.overlapResolution?.[field] ??
      (field === "boreTolerance" ? 1.0 : 10.0);
    el.addEventListener("change", () => {
      const cfg = getConfig();
      cfg.coordinateSettings.overlapResolution = cfg.coordinateSettings.overlapResolution ?? {};
      cfg.coordinateSettings.overlapResolution[field] = parseFloat(el.value);
      saveConfig(cfg); setState("config", cfg);
      console.info(`[ConfigTab] overlapResolution.${field} = ${el.value}`);
    });
  });

  // Core Logic show/hide toggle (no config save — purely UI)
  const clBtn = document.getElementById("cfg-overlapRes-coreLogic");
  const clPanel = document.getElementById("cfg-overlapRes-coreLogic-panel");
  if (clBtn && clPanel) {
    clBtn.addEventListener("click", () => {
      const open = clPanel.style.display !== "none";
      clPanel.style.display = open ? "none" : "block";
      clBtn.textContent = open ? "Show" : "Hide";
      clBtn.setAttribute("aria-expanded", String(!open));
    });
  }

  // ── Input & Parse Settings ──────────────────────────────────────────────────

  // Streaming Parse toggle
  wireToggle("cfg-streamingParse", "cfg-streamingParse-lbl",
    () => getConfig().inputSettings?.streamingParse === true,
    (next) => { const c = getConfig(); c.inputSettings.streamingParse = next; saveConfig(c); setState("config", c); }
  );

  // Chunk Size
  const chunkEl = document.getElementById("cfg-streamingChunkSize");
  if (chunkEl) {
    chunkEl.value = getConfig().inputSettings?.streamingChunkSize ?? 500;
    chunkEl.addEventListener("change", () => {
      const c = getConfig();
      c.inputSettings.streamingChunkSize = parseInt(chunkEl.value, 10) || 500;
      saveConfig(c); setState("config", c);
    });
  }

  // Sanitization toggles
  const sanToggles = [
    { id: "cfg-san-trim", lbl: "cfg-san-trim-lbl", key: "trimWhitespace" },
    { id: "cfg-san-bom", lbl: "cfg-san-bom-lbl", key: "stripBOM" },
    { id: "cfg-san-unicode", lbl: "cfg-san-unicode-lbl", key: "normalizeUnicode" },
    { id: "cfg-san-collapse", lbl: "cfg-san-collapse-lbl", key: "collapseSpaces" },
    { id: "cfg-san-lowercase", lbl: "cfg-san-lowercase-lbl", key: "lowercaseHeaders" },
  ];

  for (const { id, lbl, key } of sanToggles) {
    wireToggle(id, lbl,
      () => getConfig().inputSettings?.sanitize?.[key] === true,
      (next) => {
        const c = getConfig();
        if (!c.inputSettings.sanitize) c.inputSettings.sanitize = {};
        c.inputSettings.sanitize[key] = next;
        saveConfig(c); setState("config", c);
      }
    );
  }
}

/** Helper: Wire a generic toggle button. */
function wireToggle(btnId, lblId, getState, onToggle) {
  const btn = document.getElementById(btnId);
  const lbl = document.getElementById(lblId);
  if (!btn) return;

  const on = getState();
  btn.classList.toggle("on", on);
  if (lbl) lbl.textContent = on ? "Enabled" : "Disabled";

  btn.addEventListener("click", () => {
    const next = !btn.classList.contains("on");
    btn.classList.toggle("on", next);
    if (lbl) lbl.textContent = next ? "Enabled" : "Disabled";
    onToggle(next);
    gate('ConfigTab', btnId, 'Setting Toggled', { value: next });
  });
}

function renderOutputSettings() {
  const config = getConfig();
  const os = config.outputSettings;
  const bind = (id, val) => {
    const el = document.getElementById(id);
    if (!el) { console.warn(`${LOG_PREFIX} Element not found: ${id}`); return; }
    el.value = val ?? "";
    el.addEventListener("change", () => {
      const field = id.replace("cfg-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      // map to outputSettings path
      const pathMap = {
        "pipelineRef": "outputSettings.pipelineReference",
        "projectId": "outputSettings.projectIdentifier",
        "area": "outputSettings.area",
        "lineEnding": "outputSettings.lineEnding",
      };
      const path = pathMap[field];
      if (path) {
        const parts = path.split(".");
        const cfg = getConfig();
        cfg[parts[0]][parts[1]] = el.value;
        saveConfig(cfg);
        setState("config", cfg);
        console.info(`${LOG_PREFIX} Config updated: ${path} = "${el.value}"`);
      }
    });
  };

  bind("cfg-pipelineRef", os.pipelineReference);
  bind("cfg-projectId", os.projectIdentifier);
  bind("cfg-area", os.area);
  bind("cfg-lineEnding", os.lineEnding);
}

function wireImportExport() {
  document.getElementById("btn-export-config")?.addEventListener("click", () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pcf-converter-config.json";
    a.click(); URL.revokeObjectURL(url);
    console.info(`${LOG_PREFIX} Config exported.`);
  });

  document.getElementById("btn-import-config")?.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const text = await file.text();
      const result = importConfig(text);
      if (result.ok) {
        setState("config", getConfig());
        renderOutputSettings();
        alert("Config imported successfully. Page will reload to apply all settings.");
        location.reload();
      } else {
        alert(`Import failed: ${result.error}`);
        console.error(`${LOG_PREFIX} Import failed: ${result.error}`);
      }
    };
    input.click();
  });
}

function wireResetBtn() {
  document.getElementById("btn-reset-config")?.addEventListener("click", () => {
    if (!confirm("Reset all settings to defaults? This cannot be undone.")) return;
    resetConfig();
    setState("config", getConfig());
    renderOutputSettings();
    console.info(`${LOG_PREFIX} Config reset to defaults.`);
    alert("Settings reset to defaults.");
  });
}

function wireAccordions() {
  document.querySelectorAll(".config-section-header").forEach(header => {
    header.addEventListener("click", () => {
      const section = header.closest(".config-section");
      section?.classList.toggle("open");
    });
  });
}

function renderPipelineMode() {
  // Try to find a place to inject.
  // We want it near "Overlap Resolution" or "Continuity Tolerance".
  const anchor = document.getElementById("cfg-overlapRes-enabled")?.closest(".config-section");
  if (!anchor) return;

  // Check if we already injected it
  if (document.getElementById("pipeline-mode-container")) return;

  const container = document.createElement("div");
  container.id = "pipeline-mode-container";
  container.className = "config-section open"; // Default open for visibility
  container.innerHTML = `
    <div class="config-section-header">Geometry Pipeline Mode</div>
    <div class="config-section-body" style="padding:1rem;">
      <div style="margin-bottom:1rem;">
        <label style="display:block;margin-bottom:0.5rem;color:var(--text-secondary)">Processing Mode</label>
        <select id="cfg-pipeline-mode" class="config-select" style="width:100%">
          <option value="strict">Strict (High fidelity, no guessing)</option>
          <option value="repair">Repair (Gap filling, smart recovery)</option>
          <option value="sequential">Sequential (Robust for ordered data)</option>
        </select>
        <div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-muted)" id="cfg-pipeline-desc"></div>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;">
         <button id="cfg-multipass-toggle" class="toggle"></button>
         <label>Enable Multi-Pass Refinement</label>
      </div>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;">
         Multi-pass runs a strict pass first, then a second pass with relaxed tolerances to fill gaps.
      </p>
    </div>
  `;

  // Insert BEFORE the Overlap Resolution section
  anchor.parentNode.insertBefore(container, anchor);

  // Wire logic
  const modeSel = container.querySelector("#cfg-pipeline-mode");
  const mpBtn = container.querySelector("#cfg-multipass-toggle");
  const desc = container.querySelector("#cfg-pipeline-desc");

  const updateUI = () => {
    const cfg = getConfig();
    const mode = cfg.coordinateSettings?.pipelineMode ?? 'repair';
    const mp = cfg.coordinateSettings?.multiPass ?? true;

    modeSel.value = mode;
    mpBtn.classList.toggle("on", mp);

    if (mode === 'strict') {
       desc.textContent = "Strict mode trusts the CSV coordinates implicitly. No gap filling or smart rollback.";
       mpBtn.disabled = true;
       container.querySelector("#cfg-multipass-toggle").parentElement.style.opacity = "0.5";
    } else if (mode === 'sequential') {
       desc.textContent = "Sequential mode trusts the input sort order. Bridges sequential gaps and snaps coordinates.";
       mpBtn.disabled = true;
       container.querySelector("#cfg-multipass-toggle").parentElement.style.opacity = "0.5";
    } else {
       desc.textContent = "Repair mode attempts to fix gaps and connectivity issues using heuristic rules.";
       mpBtn.disabled = false;
       container.querySelector("#cfg-multipass-toggle").parentElement.style.opacity = "1";
    }
  };

  modeSel.addEventListener("change", () => {
     const cfg = getConfig();
     cfg.coordinateSettings = cfg.coordinateSettings || {};
     cfg.coordinateSettings.pipelineMode = modeSel.value;
     saveConfig(cfg); setState("config", cfg);
     updateUI();
  });

  mpBtn.addEventListener("click", () => {
     const cfg = getConfig();
     const next = !mpBtn.classList.contains("on");
     cfg.coordinateSettings = cfg.coordinateSettings || {};
     cfg.coordinateSettings.multiPass = next;
     saveConfig(cfg); setState("config", cfg);
     updateUI();
  });

  // Accordion toggle
  container.querySelector(".config-section-header").addEventListener("click", () => {
    container.classList.toggle("open");
  });

  updateUI();
}

/** Render Common 3D Logic settings */
function renderCommon3DLogic() {
  const config = getConfig();
  const c3d = config.coordinateSettings?.common3DLogic;
  if (!c3d) return;

  // Ensure container exists
  let container = document.getElementById("common-3d-logic-editor");
  if (!container) {
    // Try to find a good injection point (after Pipeline Mode or Overlap Resolution)
    const anchor = document.getElementById("pipeline-mode-container") || document.getElementById("cfg-overlapRes-enabled")?.closest(".config-section");

    if (anchor) {
      const section = document.createElement("div");
      section.className = "config-section"; // Removed 'open' by default to reduce clutter, or keep if preferred
      section.innerHTML = `
        <div class="config-section-header">Common 3D Cleanup Rules</div>
        <div class="config-section-body" id="common-3d-logic-editor" style="padding:1rem;"></div>
      `;
      anchor.parentNode.insertBefore(section, anchor.nextSibling);

      // Wire accordion
      section.querySelector(".config-section-header").addEventListener("click", () => section.classList.toggle("open"));

      container = section.querySelector("#common-3d-logic-editor");
    }
  }

  if (!container) {
      console.warn(`${LOG_PREFIX} Could not render Common 3D Rules - container missing.`);
      return;
  }

  // Render Master Toggle + Fields
  const html = `
    <div style="margin-bottom:1rem;display:flex;align-items:center;gap:1rem;">
        <button id="cfg-c3d-enabled" class="toggle ${c3d.enabled ? 'on' : ''}"></button>
        <label id="cfg-c3d-enabled-lbl">${c3d.enabled ? 'Enabled' : 'Disabled'}</label>
        <span style="font-size:0.8rem;color:var(--text-secondary)">Global switch for geometry cleanup rules</span>
    </div>
    <div id="cfg-c3d-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;opacity:${c3d.enabled?1:0.5};pointer-events:${c3d.enabled?'all':'none'}">
        <div>
            <label>Max Pipe Run (mm)</label>
            <input class="config-input" type="number" id="cfg-c3d-maxRun" value="${c3d.maxPipeRun ?? 30000}">
        </div>
        <div>
            <label>Max Overlap (mm)</label>
            <input class="config-input" type="number" id="cfg-c3d-maxOverlap" value="${c3d.maxOverlap ?? 1000}">
        </div>
        <div>
            <label>Min Pipe Size (mm)</label>
            <input class="config-input" type="number" id="cfg-c3d-minSize" value="${c3d.minPipeSize ?? 0}">
        </div>
        <div>
            <label>Min Component Size (mm)</label>
            <input class="config-input" type="number" id="cfg-c3d-minComp" value="${c3d.minComponentSize ?? 3}">
        </div>
        <div>
            <label>3-Plane Skew Limit (mm)</label>
            <input class="config-input" type="number" id="cfg-c3d-skew3" value="${c3d.skew3PlaneLimit ?? 2000}">
        </div>
        <div>
            <label>2-Plane Skew Limit (mm)</label>
            <input class="config-input" type="number" id="cfg-c3d-skew2" value="${c3d.skew2PlaneLimit ?? 15000}">
        </div>
        <div>
            <label>Max Diagonal Gap (mm)</label>
            <input class="config-input" type="number" id="cfg-c3d-maxDiagonal" value="${c3d.maxDiagonalGap ?? 6000}">
        </div>
    </div>
  `;
  container.innerHTML = html;

  // Wire Toggle
  const btn = document.getElementById("cfg-c3d-enabled");
  const lbl = document.getElementById("cfg-c3d-enabled-lbl");
  const fields = document.getElementById("cfg-c3d-fields");

  btn.addEventListener("click", () => {
    const cfg = getConfig();
    const next = !btn.classList.contains("on");
    cfg.coordinateSettings.common3DLogic.enabled = next;

    btn.classList.toggle("on", next);
    lbl.textContent = next ? "Enabled" : "Disabled";
    fields.style.opacity = next ? "1" : "0.5";
    fields.style.pointerEvents = next ? "all" : "none";

    saveConfig(cfg); setState("config", cfg);
    console.info(`${LOG_PREFIX} Common3DLogic enabled = ${next}`);
  });

  // Wire Fields
  const bind = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener("change", () => {
        const cfg = getConfig();
        cfg.coordinateSettings.common3DLogic[key] = parseFloat(el.value);
        saveConfig(cfg); setState("config", cfg);
        console.info(`${LOG_PREFIX} Common3DLogic.${key} = ${el.value}`);
    });
  };

  bind("cfg-c3d-maxRun", "maxPipeRun");
  bind("cfg-c3d-maxOverlap", "maxOverlap");
  bind("cfg-c3d-minSize", "minPipeSize");
  bind("cfg-c3d-minComp", "minComponentSize");
  bind("cfg-c3d-skew3", "skew3PlaneLimit");
  bind("cfg-c3d-skew2", "skew2PlaneLimit");
  bind("cfg-c3d-maxDiagonal", "maxDiagonalGap");
}

/** Render the component type map table from config. */
export function renderTypeMapTable() {
  const config = getConfig();
  const tbody = document.getElementById("type-map-body");
  if (!tbody) return;

  const PCF_KEYWORDS = ["PIPE", "BEND", "TEE", "FLANGE", "VALVE", "OLET", "SUPPORT",
    "REDUCER-CONCENTRIC", "REDUCER-ECCENTRIC", "SKIP"];

  tbody.innerHTML = Object.entries(config.componentTypeMap).map(([csv, pcf]) => `
    <tr data-csv="${csv}">
      <td><input class="alias-input" value="${csv}" style="width:90px" data-field="csv"></td>
      <td><select class="config-select" data-field="pcf" style="width:180px">
        ${PCF_KEYWORDS.map(k => `<option value="${k}" ${k === pcf ? 'selected' : ''}>${k}</option>`).join("")}
      </select></td>
      <td><button class="btn btn-danger btn-sm" data-action="del-type">✕</button></td>
    </tr>`).join("");

  // Wire changes
  tbody.querySelectorAll("input[data-field='csv'], select[data-field='pcf']").forEach(el => {
    el.addEventListener("change", () => saveTypeMap());
  });
  tbody.querySelectorAll("[data-action='del-type']").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.closest("tr").remove();
      saveTypeMap();
    });
  });

  document.getElementById("btn-add-type")?.addEventListener("click", () => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input class="alias-input" value="NEW" style="width:90px" data-field="csv"></td>
      <td><select class="config-select" data-field="pcf" style="width:180px">
        ${PCF_KEYWORDS.map(k => `<option>${k}</option>`).join("")}
      </select></td>
      <td><button class="btn btn-danger btn-sm" data-action="del-type">✕</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector("input").focus();
    tr.querySelectorAll("input,select").forEach(el => el.addEventListener("change", saveTypeMap));
    tr.querySelector("[data-action='del-type']").addEventListener("click", () => { tr.remove(); saveTypeMap(); });
  });
}

function saveTypeMap() {
  const cfg = getConfig();
  const rows = document.querySelectorAll("#type-map-body tr");
  cfg.componentTypeMap = {};
  rows.forEach(tr => {
    const csv = tr.querySelector("input[data-field='csv']")?.value?.trim().toUpperCase();
    const pcf = tr.querySelector("select[data-field='pcf']")?.value;
    if (csv && pcf) cfg.componentTypeMap[csv] = pcf;
  });
  saveConfig(cfg);
  setState("config", cfg);
  console.info(`[ConfigTab] componentTypeMap saved.`, cfg.componentTypeMap);
}

/** Render alias editor: one row per canonical column, comma-list of aliases. */
export function renderAliasEditor() {
  const config = getConfig();
  const wrap = document.getElementById("alias-editor");
  if (!wrap) return;

  wrap.innerHTML = `<table class="alias-table" style="width:100%">
    <thead><tr><th style="width:200px">Canonical Name</th><th>Aliases (comma-separated, case-insensitive)</th></tr></thead>
    <tbody>${Object.entries(config.headerAliases).map(([canon, aliases]) => `
      <tr>
        <td><code style="color:var(--amber)">${canon}</code></td>
        <td><input class="alias-input" data-canon="${canon}" value="${aliases.join(", ")}" style="width:100%"></td>
      </tr>`).join("")}
    </tbody></table>`;

  wrap.querySelectorAll("input.alias-input").forEach(el => {
    el.addEventListener("change", () => {
      const cfg = getConfig();
      const aliases = el.value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      cfg.headerAliases[el.dataset.canon] = aliases;
      saveConfig(cfg); setState("config", cfg);
      console.info(`[ConfigTab] Header alias updated: ${el.dataset.canon}`);
    });
  });
}

/** Render CA definitions editor. */
export function renderCAEditor() {
  const config = getConfig();
  const wrap = document.getElementById("ca-editor");
  if (!wrap) return;

  wrap.innerHTML = `<table class="data-table" style="width:100%">
    <thead><tr><th>CA Slot</th><th>Label</th><th>CSV Field</th><th>Unit</th><th>Default</th><th>Write On</th></tr></thead>
    <tbody>${Object.entries(config.caDefinitions).map(([slot, def]) => `
      <tr>
        <td><code style="color:var(--amber)">${slot}</code></td>
        <td>${def.label}</td>
        <td><code style="color:var(--text-code)">${def.csvField || '—'}</code></td>
        <td><code>${def.unit || '(none)'}</code></td>
        <td><input class="alias-input" data-ca="${slot}" data-field="default" value="${def.default}" style="width:80px"></td>
        <td style="font-size:0.72rem;color:var(--text-muted)">${Array.isArray(def.writeOn) ? def.writeOn.join(", ") : def.writeOn}</td>
      </tr>`).join("")}
    </tbody></table>`;

  wrap.querySelectorAll("input[data-ca]").forEach(el => {
    el.addEventListener("change", () => {
      const cfg = getConfig();
      const slot = el.dataset.ca;
      if (cfg.caDefinitions[slot]) {
        cfg.caDefinitions[slot].default = el.value;
        saveConfig(cfg); setState("config", cfg);
        console.info(`[ConfigTab] CA default updated: ${slot} = ${el.value}`);
      }
    });
  });
}

/** Render anomaly rules with toggle + threshold. */
export function renderAnomalyRules() {
  const config = getConfig();
  const wrap = document.getElementById("anomaly-rules-editor");
  if (!wrap) return;

  wrap.innerHTML = Object.entries(config.anomalyRules).map(([id, rule]) => `
    <div style="display:grid;grid-template-columns:auto 1fr auto auto;gap:0.75rem;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--steel)">
      <button class="toggle ${rule.enabled ? 'on' : ''}" data-rule="${id}" role="switch" aria-checked="${rule.enabled}"></button>
      <span style="font-size:0.8rem;color:var(--text-secondary)">${rule.description}</span>
      ${rule.threshold !== undefined ? `<input class="config-input" data-rule="${id}" data-field="threshold" value="${rule.threshold}" style="width:70px" type="number" step="0.01">` : '<span></span>'}
      <select class="config-select" data-rule="${id}" data-field="severity" style="width:100px">
        ${['ERROR', 'WARNING', 'INFO'].map(s => `<option ${s === rule.severity ? 'selected' : ''}>${s}</option>`).join("")}
      </select>
    </div>`).join("");

  wrap.querySelectorAll(".toggle[data-rule]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cfg = getConfig();
      const on = !btn.classList.contains("on");
      cfg.anomalyRules[btn.dataset.rule].enabled = on;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-checked", on);
      saveConfig(cfg); setState("config", cfg);
    });
  });

  wrap.querySelectorAll("input[data-rule][data-field='threshold']").forEach(el => {
    el.addEventListener("change", () => {
      const cfg = getConfig();
      cfg.anomalyRules[el.dataset.rule].threshold = parseFloat(el.value);
      saveConfig(cfg); setState("config", cfg);
    });
  });

  wrap.querySelectorAll("select[data-rule][data-field='severity']").forEach(el => {
    el.addEventListener("change", () => {
      const cfg = getConfig();
      cfg.anomalyRules[el.dataset.rule].severity = el.value;
      saveConfig(cfg); setState("config", cfg);
    });
  });
}
