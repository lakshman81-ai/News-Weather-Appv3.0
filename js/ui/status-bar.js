
import { getConfig } from "../config/config-store.js";
import { subscribe } from "../state.js";

/**
 * status-bar.js
 * Renders the global pipeline status bar.
 * Shows: Processing Mode (Strict/Repair/Multi), Tolerance used, and Active Rules (short form).
 * Injects into the existing footer (#status-bar).
 */

const LOG_PREFIX = "[StatusBar]";
const STATS_CONTAINER_ID = "pipeline-stats-container";

export function initStatusBar() {
  // 1. Locate the existing footer
  const footer = document.getElementById("status-bar");
  if (!footer) {
      console.warn(`${LOG_PREFIX} Footer #status-bar not found.`);
      return;
  }

  // 2. Check if we already injected our container
  let container = document.getElementById(STATS_CONTAINER_ID);
  if (!container) {
      container = document.createElement("div");
      container.id = STATS_CONTAINER_ID;
      // Styling: Flex to hold items, margin to separate from default status items
      container.style.cssText = "display:flex; gap:1.5rem; align-items:center; margin-left: 2rem; flex: 1; overflow: hidden;";

      // Insert before the last child (which is usually the version info, pushed right via margin-left:auto)
      // If footer structure is strictly [item, item, item, version], we want to be before version.
      if (footer.lastElementChild) {
          footer.insertBefore(container, footer.lastElementChild);
      } else {
          footer.appendChild(container);
      }
  }

  // Subscribe to config changes to update the bar
  subscribe("config", () => renderStatusBar());

  // Initial render
  renderStatusBar();
  console.info(`${LOG_PREFIX} Initialised.`);
}

function renderStatusBar() {
  const container = document.getElementById(STATS_CONTAINER_ID);
  if (!container) return;

  const cfg = getConfig();
  const cs = cfg.coordinateSettings || {};
  const c3d = cs.common3DLogic || {};

  const mode = cs.pipelineMode || 'repair';
  const multi = cs.multiPass !== false;

  // Mode Label
  let modeLabel = "Unknown";
  let modeColor = "var(--text-muted)";
  let tolLabel = "";

  // Styling helpers
  const labelStyle = (color) => `font-weight:700; color:${color}; white-space:nowrap;`;
  const sepStyle = `border-left:1px solid var(--steel); padding-left:1rem; white-space:nowrap;`;
  const infoStyle = `color:var(--text-secondary);`;

  if (mode === 'strict') {
      modeLabel = "STRICT MODE";
      modeColor = "var(--amber)";
      tolLabel = `Tol: ±${cs.continuityTolerance ?? 0.5}mm`;
  } else if (mode === 'repair') {
      if (multi) {
          modeLabel = "REPAIR MODE (MULTI-PASS)";
          modeColor = "var(--green-ok)";
          tolLabel = `Pass 1: ±${cs.continuityTolerance ?? 0.5}mm | Pass 2: ±${(cs.continuityTolerance ?? 0.5) * 5}mm`;
      } else {
          modeLabel = "REPAIR MODE (SINGLE PASS)";
          modeColor = "var(--blue-focus)";
          tolLabel = `Tol: ±${cs.continuityTolerance ?? 0.5}mm`;
      }
  } else if (mode === 'sequential') {
      modeLabel = "SEQUENTIAL MODE";
      modeColor = "#c084fc"; // purple-ish
      tolLabel = `Tol: ±${cs.continuityTolerance ?? 0.5}mm`;
  }

  // Active Rules (Short Form)
  const rules = [];
  if (c3d.enabled) {
      if (c3d.maxPipeRun) rules.push(`MaxRun<${(c3d.maxPipeRun/1000).toFixed(0)}m`);
      if (c3d.skew3PlaneLimit) rules.push(`Skew3<${(c3d.skew3PlaneLimit/1000).toFixed(1)}m`);
      if (c3d.maxOverlap) rules.push(`MaxOver<${c3d.maxOverlap}mm`);
  } else {
      rules.push("Rules: OFF");
  }

  const ruleStr = rules.join(" • ");

  container.innerHTML = `
    <div style="${labelStyle(modeColor)}">${modeLabel}</div>
    <div style="${sepStyle} ${infoStyle}">${tolLabel}</div>
    <div style="${sepStyle} ${infoStyle} flex:1; text-align:right; overflow:hidden; text-overflow:ellipsis;" title="${ruleStr}">
       ${ruleStr}
    </div>
  `;
}
