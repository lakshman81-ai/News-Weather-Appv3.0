# Detailed Implementation Plan: Linelist & Weight Integration

## 1. Overview
This document outlines the architecture, UI design, and core logic for adding **Linelist Data Integration** and **Automated Weight Calculation** to the PCF Converter App. The goal is to enrich the generated PCF output with process data (e.g., Design Pressure) and physical component weights by linking external Excel datasheets.
PCF input gile: CSV file: export sys-1 [https://github.com/lakshman81-ai/PCF-converter-App/blob/675ff900d0cfc418a15b47d05eaaf029806345c1/Docs/export%20sys-1.csv] (Template, Headers unlikely to change)
Line list: https://github.com/lakshman81-ai/PCF-converter-App/blob/675ff900d0cfc418a15b47d05eaaf029806345c1/Docs/ImportedRawLineListLL.xlsx (Line list header column are not uniquie, even header need to bedeted via smart loging running mutiple row ex:1 to 10, then find the header title), column also cane shuffed.
Weight data base: https://github.com/lakshman81-ai/PCF-converter-App/blob/675ff900d0cfc418a15b47d05eaaf029806345c1/Docs/wtValveweights.xlsx(Template, Headers unlikely to change)
LineDump: csv or exlxs form file. sample "Reference of the element	Name	Type	Pipe specification	Position	PIPE
=67130482/1539	GASKET 3 of BRANCH /FCSEE-16"-P0511260-11440A1-01/B1	GASK		E 95724mm N 16586.4mm U 4360mm	FCSEE-16"-P0511260-11440A1-01
=67130482/1538	PCOMPONENT 1 of BRANCH /FCSEE-16"-P0511260-11440A1-01/B1	PCOM		E 95721mm N 16586.4mm U 4360mm	FCSEE-16"-P0511260-11440A1-01
=67130482/1541	GASKET 4 of BRANCH /FCSEE-16"-P0511260-11440A1-01/B1	GASK		E 95686mm N 16586.4mm U 4360mm	FCSEE-16"-P0511260-11440A1-01"
Line no. (derived): to be derived via smart logic ex: P0511260.
Create a  file in ..\pulic\... LineDump.csv or LineDump.xlsx
Add UI tab for "LineDump"
Club all 3 tabs in a single tab called "Master data" i.e, "Linelist Manager","Weight Config" and "Line Dump from E3D" (LineDump)

## 2. Feature 1: Linelist Import & Mapping
**Objective:** Import process parameters from an Excel "Linelist" and map them to PCF attributes based on Line Service and Sequence Number.

### 2.1 User Interface (UI) Design
**New Tab: "Linelist Manager"**

*   **Zone A: Data Upload & Preview**
    *   **Upload Area:** Drag-and-drop or Browse button for `.xlsx` files.
    *   **Data Grid:** Interactive spreadsheet view (using a library like `Handsontable` or `ag-Grid`) displaying the imported content.
    *   **Header Control:** A visual selector (e.g., "Use current row as Header") to manually override the detected header row.

*   **Zone B: Smart Header Detection Status**
    *   **Status Panel:** Displays "Detected Header at Row X".
    *   **Confidence Indicators:** Shows which standard columns (Service, Line Size, Pressure) were matched.

*   **Zone C: Attribute Mapping Configuration**
    *   **Mapping Table:** Two-column layout:
        *   **Left (Source):** Dropdown of columns found in the Linelist (e.g., "Des Press", "Temp").
        *   **Right (Target):** PCF Attribute Dropdown (e.g., `ATTRIBUTE1` (Pressure), `ATTRIBUTE2` (Temp), `PIPELINE-REFERENCE`).
    *   **Key Identification:** Selectors for "Service Column" and "Sequence No Column" to define the primary key for linking.

### 2.2 Core Logic & Methodology

#### A. Smart Header Detection Algorithm
Instead of assuming a fixed row, the parser will scan the first 20 rows of the Excel sheet:
1.  **Keyword Scoring:** Compare row values against a dictionary of common headers (`Line`, `Service`, `PID`, `Pressure`, `Temperature`, `Class`). [make this configurable in setting, try to group this with existing setting, in a smart way]
2.  **Density Check:** The row with the most non-empty string matches becomes the candidate header (any better logic?)
3.  **Fallback:** If ambiguous, default to Row 1 and prompt user to confirm.

#### B. Data Linking Strategy
To link the Linelist row to the PCF Component sequence:
*   **Composite Key:** Create a unique key `[Service]-[Sequence]` (e.g., `CS-1001`).
*   **CSV Data Prep:** Ensure the main CSV parser extracts `Service` and `Sequence` (often found in Line Number components) for line list. For mapping"Line no. (derived):" is to be used to link PCF/CSV component with line list.
*   **Lookup Map (for Process paramters): linelist data `[Service]-[Sequence]Vs PCF/CSV  [Line no. (derived) via LineDump ]  ** Map Coordinates from PCF/CSV with LineDump and select matching, close match upto 25mm allowed (configurable in setting)*

### 2.3 Change Management
*   **Profile Saving:** Save the column mapping config to `localStorage` or a config file so users don't need to re-map every upload.
*   **Version Check for line list (Not required for "Weight data base" and "LineDump" ) :** If a new file is uploaded with different columns, alert the user and highlight broken mappings. (Need robust logic highlight changes in red.
Comaprson module shall be seperate UI, where in user import new "line list" , needs smart decteion, mapping with old file and then comparing fields (i.e, header intrested to compare).

---

## 3. Feature 2: Weight Data Integration
**Objective:** Calculate and populate component weights based on size, piping class (rating), and component type/length.

### 3.1 User Interface (UI) Design
**New Tab: "Weight Config" (Locked/Admin View)**

*   **Reference Data View:** Read-only display of the loaded `wtValveweights.xlsx`.
*   **Configuration Panel:**
    *   **Rating Mapping:** Define how Class maps to Rating (e.g., "150LB" -> Class 150).
    *   **Valve Logic:** Toggle for "Smart Valve Detection" (Length-based).

### 3.2 Core Logic & Methodology

#### A. Smart Rating Detection
Extract Rating from the Piping Class (from Linelist):
*   **Logic:** Parse the first 1-2 characters of the Class string.
    *   `1...` -> 150#
    *   `3...` -> 300#
    *   `6...` -> 600#
    *   `9...` -> 900#
    *   `15..` -> 1500#
    *   `25..` -> 2500#

#### B. Valve Type & Weight Inference
Since the CSV might genericize valves, we distinguish them by **Length**:
1.  **Input:** Component `Size` (NB), `Rating` (derived), and `Length` (geometry dist).
2.  **Lookup:** Query the weight sheet for matching `Size` + `Rating`.
3.  **Fuzzy Match:** Compare the CSV component length against standard valve lengths (Gate, Globe, Check, Ball) defined in the weight sheet.
    *   `if abs(ComponentLen - GateLen) < Tolerance` -> Use Gate Weight. (defalt tolerane 6mm , configurable in setting)
    *   `else` -> Use average or specific fallback.

#### C. Population
*   Enrich the internal Component object with a `WEIGHT` attribute.
*   Writer outputs `WEIGHT <value>` in the PCF component block.

### 3.3 Error Logging
*   **Missing Key:** Log "Warning: No Linelist match for Line X".
*   **Missing Weight:** Log "Warning: No weight data for Valve Size Y Class Z".
*   **Defaulting:** Clearly state when 0 or default values are used.

3.5:
Mapping master
COMPONENT-ATTRIBUTE7: TBA (Corrosion Allowance)
COMPONENT-ATTRIBUTE9= FlUID DENSITY (Linelist) [Fluid den., Density]
Gas	Liquid	Mixed
kg/m³	kg/m³	kg/m³
if mutiple values are there based on Use Liquid/Mixed [option toggle in setting, default liquid] use liquid of mixed, when Phase="M"
otherwise for "G" use Gas, others use "Liquid"
Liquid is default fall back, but if Liquid is null or 0 show pupup to user.
COMPONENT-ATTRIBUTE10= HYDRO TEST PRESURE
COMPONENT-ATTRIBUTE6= 210 (default if COMPONENT-ATTRIBUTE5>0 or not null)
COMPONENT-ATTRIBUTE5= Insulation thikness (line list some time mentioned as Insulation Thickness,Inulation thk, Ins thk)
PIPELINE-REFERENCE-Line no. (derived), provide this attribute in pcf only when a "Line no. (derived)" change is detected unlike other persistant component attibutes logic in pcf.
COMPONENT-ATTRIBUTE3:TBA (Material)
COMPONENT-ATTRIBUTE1:Pressure Max (or..Max pressure, Max.Pr.,Pr. max, Design pressure, Design Pr.)
COMPONENT-ATTRIBUTE2= Temp. Max,[or Design temperature, Max temp*]
COMPONENT-ATTRIBUTE4:TBA (Wall thickness)
COMPONENT-ATTRIBUTE8= WEIGHT [obtained form section 3]
## 4. Best Practices & Future-Proofing
*   **Modular Parsers:** Create a standalone `ExcelReader` class that yields JSON. Decouple input format from processing logic. (Dependency: `xlsx` via SheetJS).
*   **Schema Validation:** Use a schema to validate that imported Excel rows have expected data types (e.g., Pressure is numeric).
*   **Performance:** Cache the Linelist lookup map. Do not re-parse Excel on every conversion run.
*   **Extensibility:** Design the Mapping Interface to accept *any* PCF attribute, allowing future users to map "Insulation Thickness" without code changes.

## 5. Implementation Roadmap
1.  **Phase 1:** Build `ExcelParserService` and Linelist UI Tab (Import + Grid + Header detection).
2.  **Phase 2:** Implement Mapping Logic UI and Config Store.
3.  **Phase 3:** Build Weight Logic (Class parsing + Valve length matching + Lookup).
4.  **Phase 4:** End-to-end testing with `ImportedRawLineListLL.xlsx` and `wtValveweights.xlsx` against `export sys-1.csv` and mock created(lineDump).
5. All "TBA" related attributes will have new Table called "Material Master" [add place holders for that]
