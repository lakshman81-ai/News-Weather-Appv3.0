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

## 3. Verification
- **`Sys-1`:** Verified correct connectivity: `FLAN -> PIPE -> ANCI -> PIPE -> TEE`. No missing segments.
- **`30-B7410250`:** Verified correct segmentation of the 50m run. Verified CSV parsing.

## 4. Conclusion
The updated "Core Engine" in `src/PCF_tool` now surpasses the reference app by providing robust, sequential connectivity with intelligent snapping and segmentation, avoiding the pitfalls of "Strict" (missing pipes) and "Multipass" (invalid connections).
