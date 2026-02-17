# PCF Tool Audit & Improvement Report

## 1. Investigation Findings

### External Reference App Analysis (`temp_reference`)
- The reference app implements distinct pipeline modes:
    - **Strict:** Disables gap filling. Result: Missing pipe segments between supports/components.
    - **Repair (Singlepass):** Enables gap filling with base tolerance. Result: "Poorer detection" (possibly due to tolerance issues or incorrect snapping).
    - **MultiPass:** Runs a second pass with **5x tolerance**. Result: "All support nodes try to connect to start/end points". This aggressive tolerance causes topology violations (spider-webbing).

### Data Analysis
- **`export sys-1.csv`:** Contains sequential components (FLAN -> ANCI -> TEE). Implicit pipes are required to bridge gaps.
- **`30-B7410250.csv`:** Contains large gaps (>50m) between Supports and Elbows. Requires automatic segmentation to match expected output. Also uses `\r` (CR) line endings, which caused parsing failures in some environments.

### Issues in "Core Engine"
1.  **Parsing Fragility:** Failed to handle `\r` line endings (Mac/Legacy format).
2.  **Topology Gaps:** Strict mode failed to connect components listed sequentially but separated spatially.
3.  **Aggressive connectivity (Multipass):** High tolerance caused invalid connections between topologically distant nodes.
4.  **Missing Segmentation:** Long runs were either missing or emitted as single huge pipes (invalid for fabrication).

## 2. Improvements Implemented (`src/PCF_tool`)

### A. Robust "Repair" Logic (Implicit Pipe Generation)
Instead of separate modes, I implemented a single **Robust Mode** that:
1.  **Sequentially** processes the CSV groups.
2.  **Detects Gaps** between the *End* of the previous component and *Start* of the current component.
3.  **Generates Implicit Pipes** to bridge these gaps if they exceed tolerance. This solves the "missing segment" issue without the risk of non-sequential "spider-webbing".

### B. Intelligent Tolerance & Snapping
- **Tolerance:** Set to **+/- 6.0mm** (User requested).
- **Snapping:** If a gap is within tolerance (`0.1mm < gap <= 6.0mm`), the start point of the current component is **snapped** to the end point of the previous component. This ensures perfect mathematical connectivity (`0.0000` gap) required by ISOGEN, eliminating "Orphaned restraints" errors.
- **Gap Filling:** If gap > 6.0mm, an implicit PIPE is generated.

### C. Automatic Segmentation
- **Logic:** Any pipe (explicit or implicit) longer than **13,100mm** is automatically split into segments.
- **Result:** Matches the expected output for `30-B7410250`, breaking the 50m run into ~13.1m pieces.

### D. Parsing Robustness
- **CSV Parser:** Updated to handle `\r`, `\n`, and `\r\n` line endings correctly.
- **Quote Handling:** Robustly handles escaped quotes in CSV fields.

## 3. Technical Architecture & Code Structure

The tool is modularized into two primary classes within `src/PCF_tool/`, separating data parsing from geometry generation.

### `Pfc_TopologyEngine.js` (Parser & Grouper)
**Role:** Ingests raw CSV text, cleans it, parses it into records, transforms coordinates, and groups them by `RefNo` (Component ID).

**Key Functionality:**
1.  **Robust Parsing (`parseCSV`)**:
    ```javascript
    // Splits by any line ending sequence to handle cross-platform files
    const lines = content.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    // Handles quoted fields containing commas
    // ... custom tokenizer logic ...
    ```
2.  **Coordinate Transformation**:
    Maps CSV coordinates (`East`, `North`, `Up`) to PCF Standard (`North`, `-East`, `Up`):
    ```javascript
    const pcf_x = y_csv;      // North
    const pcf_y = -1 * x_csv; // -East
    const pcf_z = z_csv;      // Up
    ```
3.  **Grouping**:
    Aggregates individual point rows into logical "Component Groups" (e.g., a TEE with 4 connection points) based on `RefNo` change.

### `Pfc_PcfGenerator.js` (Geometry Engine)
**Role:** Iterates through component groups, establishes connectivity, handles tolerances, and emits PCF-formatted strings.

**Key Functionality:**
1.  **State Tracking**:
    Maintains `lastEndpoint` and `lastBore` to track the "tail" of the pipeline as it processes sequential groups.

2.  **Implicit Connectivity (`processGroup`)**:
    Calculates the 3D distance between the current component's Start Point and the previous component's End Point.
    *   **Case 1: Jump (`BRAN`):** If component is a Branch/Start marker, `lastEndpoint` is reset. No connection.
    *   **Case 2: Snap (< 6mm):** If gap is ≤ 6.0mm, the current start point is **moved** (snapped) to `lastEndpoint`.
        *   *Reasoning:* Fixes floating point drift and ensures `0.00mm` gap for ISOGEN connectivity.
    *   **Case 3: Implicit Pipe (> 6mm):** If gap > 6.0mm, `generatePipe()` is called to bridge the gap.
        *   *Reasoning:* The CSV defines nodes; the pipe between them is implied by physics.

3.  **Segmentation (`generatePipe`)**:
    Splits long implied pipes into standard cut lengths (max `13,100mm`).
    ```javascript
    if (dist > this.maxPipeLength) {
        const segments = Math.ceil(dist / this.maxPipeLength);
        // Vector math to calculate intermediate points
        // Emits multiple PIPE components
    }
    ```
    *   *Reasoning:* Matches expected fabrication output (pipes cannot be infinite length) and fixes visual issues in `30-B7410250`.

4.  **Component Generation**:
    Maps CSV `Type` (e.g., `ANCI`, `FLAN`, `ELBO`) to PCF keywords (`SUPPORT`, `PIPE-FIXED`, `BEND`).
    *   *Improvement:* `ANCI` (Support) logic ensures it emits a coordinate but updates the `lastEndpoint` correctly so the line continues *through* the support.

## 4. Verification
- **`Sys-1`:** Verified correct connectivity: `FLAN -> PIPE -> ANCI -> PIPE -> TEE`. No missing segments.
- **`30-B7410250`:** Verified correct segmentation of the 50m run. Verified CSV parsing.

## 5. Conclusion
The updated "Core Engine" in `src/PCF_tool` now surpasses the reference app by providing robust, sequential connectivity with intelligent snapping and segmentation, avoiding the pitfalls of "Strict" (missing pipes) and "Multipass" (invalid connections).
