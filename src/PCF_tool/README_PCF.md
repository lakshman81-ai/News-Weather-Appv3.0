# PCF Converter Tool - Technical Explanation

## Issue: Missing Pipe Points & Orphan Components
The previous version of the tool failed to generate PCF output for certain sections of the pipeline, resulting in "Orphan Components" and missing pipe segments. Specifically, large gaps between Supports (ANCI) and other components were not being bridged by pipe elements.

## Root Cause Analysis
1.  **Implicit Connectivity:** The input CSV (`30-B7410250.csv`) defines key components (Flanges, Tees, Elbows, Supports) but often omits the straight pipe segments connecting them.
2.  **Orphan Logic:** The tool treated components as isolated nodes. When the distance between two components (e.g., two Supports 50m apart) exceeded a threshold, the tool failed to generate a connecting pipe, leaving the components disconnected ("Orphaned").
3.  **Missing Loop Geometry:** The expected output contains detailed expansion loops (U-Bends) between certain supports. These loops are **not present** in the CSV data. The CSV only provides the start and end points of the loop (the anchors). This is a data limitation.

## Solution Implemented
1.  **Implicit Pipe Generation:** The tool now automatically generates `PIPE` elements to bridge gaps between consecutive components in the CSV sequence.
2.  **Cut Length Logic:** For long pipe runs (e.g., the 50m run between Row 18 and Row 19), the tool splits the pipe into standard segments (max length 13.1m / 43ft), matching the segmentation seen in the expected output.
3.  **Branch Handling:** The `BRAN` component type is now correctly identified as a logical break/start point, preventing the generation of invalid pipes connecting disjoint branches.
4.  **Coordinate Transformation:** Corrected the mapping to `North (X), -East (Y), Up (Z)` to match the expected PCF coordinate system.

## Result
The tool now produces a fully connected PCF file with no orphan components. Long straight runs are correctly segmented. Note: The expansion loops are represented as straight pipes due to missing geometry in the source CSV.
