# Integration Map Audit Report

**Date:** 2026-02-17
**Auditor:** Deep Architect Agent
**Subject:** PCF Converter Integration Module (Linelist, Material, PCF Table)

---

## 1. Executive Summary

The PCF Converter's Integration Module, designed to enrich PCF output with process data (Linelist) and physical attributes (Weights), suffers from **disconnection between its components**. While robust logic exists in the service layer (`linelist-service.js`, `mapping-engine.js`), the UI layer (`pcf-table-controller.js`) often bypasses it in favor of simpler, fragile lookups.

**Critical Findings:**
1.  **Data Fetching Failure:** The "PCF in Table Form" tab fails to fetch process data because it ignores the composite "Service + Sequence" key logic defined in the services, relying instead on a single "Line Reference" column that may not exist or match.
2.  **Header Detection Weakness:** The Excel parser uses a simple keyword count that is susceptible to false positives and does not prioritize specific, longer phrases (e.g., "Design Pressure" vs. "Pressure"), leading to incorrect or missing dropdown options.
3.  **Mapping Fragility:** The reliance on `Line No. (Derived)` via geometric matching is a single point of failure. When geometric matching fails (e.g., due to tolerance), there is no fallback to the robust "Service + Sequence" matching available in the `LinelistService`.

---

## 2. Detailed Findings

### 2.1. Process Data Not Fetched in PCF Table
**Observation:** Clicking "Refresh" in the PCF Table tab fails to populate columns like `P1`, `T1`, `Density`, etc., even when a Linelist is loaded.

**Technical Root Cause:**
*   **File:** `js/ui/pcf-table-controller.js`
*   **Method:** `render()`
*   **The Flaw:** The controller manually builds a `linelistMap` using *only* the `smartMapping.LineRef` column (Line No.).
    ```javascript
    // Current Logic (Fragile)
    const lineNo = row[smartMapping.LineRef] || row['Line No. (Derived)'];
    if (lineNo) linelistMap.set(String(lineNo).trim(), row);
    ```
*   **The Disconnect:** It completely ignores `linelistService.getLookupMap()` which correctly handles the **Service + Sequence** composite key. If the Linelist splits these into two columns (common in E3D/PDMS exports), `smartMapping.LineRef` is likely undefined or partial, causing the map keys to be missing or incorrect.
*   **Result:** The lookup `linelistMap.get(pipelineRef)` returns `undefined`.

### 2.2. Header Detection & Dropdown Issues
**Observation:** When a Linelist is loaded, headers are often misidentified, and dropdowns in the mapping section are empty or incorrect.

**Technical Root Cause:**
*   **File:** `js/services/excel-parser.js`
*   **Method:** `detectHeaderRow`
*   **The Flaw:** The logic counts *any* occurrence of a keyword in the row string.
    *   *Issue:* `rowStr.includes(kw)` matches "Pressure" inside "Design Pressure", causing ambiguity.
    *   *Issue:* It does not prioritize "Exact Match" > "Longest Match" > "Shortest Match".
*   **Effect:** A data row containing "Pressure" might be scored higher than the actual header row if the header uses abbreviations like "Des. Pr." which aren't in the default keyword list.

### 2.3. Fragile "Line No. (Derived)" Logic
**Observation:** Attribute mapping relies heavily on the `Line No. (Derived)` column, which is populated by matching PCF coordinates to a "Line Dump" file.

**Technical Root Cause:**
*   **File:** `js/ui/pcf-table-controller.js`
*   **Method:** `matchLineDump`
*   **The Flaw:** This is a **Geometric-Only** dependency. If the "Line Dump" is missing, or if the coordinate tolerance (default 25mm) is too tight for the specific export, `derivedLineNo` is empty.
*   **The Failure Chain:**
    1.  Geometric match fails → `derivedLineNo` is null.
    2.  Table Controller falls back to `pipelineRef` (from PCF).
    3.  `pipelineRef` lookup fails (see 2.1 - Single Key Issue).
    4.  Result: No attributes mapped.

### 2.4. Unused "Service" + "Seq" in Master Linelist
**Observation:** The user noted "Service" and "Seq" columns in the Master Linelist settings but questioned their purpose.

**Finding:**
*   **Purpose:** These are intended to form the **Primary Key** for the Linelist (`Service-Sequence`).
*   **Status:** They are defined in `defaults.js` and `linelist-service.js` but are **effectively unused** by the PCF Table Controller, which performs its own simplified lookup. This renders the configuration of these columns useless for the end-user in the current build.

---

## 3. Improvement Plan

### 3.1. Fix PCF Table Data Fetching (High Priority)
**Action:** Refactor `PcfTableController.render` to use the robust `mappingEngine` or `linelistService` instead of building its own map.

**Implementation Steps:**
1.  **Deprecate Local Map:** Remove the manual `linelistMap` construction in `PcfTableController`.
2.  **Use Integration Service:**
    ```javascript
    // In PcfTableController.js
    import { linelistService } from '../services/linelist-service.js';

    // ... inside loop ...
    // Create a composite key object from PCF component data
    const lookupQuery = {
        LineNo: derivedLineNo || pipelineRef, // Try derived first, then PCF ref
        Service: comp.attributes['SERVICE'] || '', // If available in PCF
        Sequence: '' // Sequence usually part of LineNo
    };

    // Use the service which handles the composite key logic (Service + Seq)
    const linelistRow = linelistService.findMatchedRow({ raw: lookupQuery });
    ```
3.  **Ensure Fallback:** If `findMatchedRow` fails with the composite key, allow a fallback to strict `Line Number` matching if available.

### 3.2. Robust Header Detection (Medium Priority)
**Action:** Upgrade `ExcelParser` to use a weighted, specific matching algorithm.

**Implementation Steps:**
1.  **Exact Match Bonus:** Give huge score (e.g., +10) for exact cell matches against keywords.
2.  **Longest Match First:** When scanning keywords, sort them by length (descending). If "Design Pressure" matches, stop checking for "Pressure".
3.  **Configurable Keywords:** Ensure the `ExcelParser` receives the *full* list of aliases from `defaults.js` (`smartProcessKeywords`), not just a hardcoded subset.

### 3.3. Strengthen Line No. Logic
**Action:** Decouple dependency on "Line Dump" geometry.

**Implementation Steps:**
1.  **Primary Strategy:** Use **Service + Sequence** extraction from the PCF Component Name or Attributes (using the new `smartData` regex/token logic).
2.  **Secondary Strategy:** Use "Line Dump" (Geometric Match).
3.  **Tertiary Strategy:** Use `PIPELINE-REFERENCE` attribute.

### 3.4. Clarify & Activate "Service" + "Seq"
**Action:** Make these fields functional.

**Implementation Steps:**
1.  **UI Feedback:** In the Linelist Manager, explicitly label these as "Primary Key Columns".
2.  **Validation:** Show a warning if these are not mapped.
3.  **Utilization:** Ensure `linelistService.getLookupMap()` constructs keys as `[Service]-[Sequence]` (normalized) and that the PCF Table Controller constructs the query key similarly when looking up data.

---

## 4. Summary of Code Changes Required

| File | Action | Description |
| :--- | :--- | :--- |
| `js/ui/pcf-table-controller.js` | **Refactor** | Replace manual `linelistMap` with `linelistService.findMatchedRow()`. Add logic to construct lookup query from PCF attributes. |
| `js/services/linelist-service.js` | **Enhance** | Update `findMatchedRow` to handle inputs that might only have `LineNo` (derived) or `Service`. |
| `js/services/excel-parser.js` | **Update** | Implement "Exact Match" and "Longest Keyword" logic in `detectHeaderRow`. |
| `js/ui/master-data-controller.js` | **Update** | Pass comprehensive `smartProcessKeywords` to `ExcelParser` during upload. |

---
**End of Audit**
