**PCF CONVERTER --- BROWSER APPLICATION**

Software Architecture & Implementation Plan

Version 1.0 \| February 2026 \| Browser-Deployable \| GitHub Pages
Compatible

> PURPOSE: This document is the complete architecture and phased
> implementation guide for Claude Code. Every module, interface, data
> structure, algorithm, config key, and UI component is defined here. No
> assumptions. No drift.

#  1. Problem Definition & Goals

**1.1 Core Problem**

Piping design software exports pipeline component data as a CSV/Excel
file. CAESAR II stress analysis requires PCF (Piping Component File)
input. Manual conversion is error-prone, time-consuming, and
non-repeatable. The converter must be:

> \(1\) Browser-hosted, no installation, GitHub Pages deployable ---
> static files only, no server
>
> \(2\) Fully configurable --- nothing hardcoded. Every mapping, rule,
> threshold lives in config
>
> \(3\) Robust on coordinates --- detect broken continuity, traverse
> branches in correct order
>
> \(4\) Validating --- catch syntax errors, data anomalies, process
> parameter discontinuities
>
> \(5\) Self-documenting --- every generated line and every issue has a
> reason users can act on

**1.2 Non-Goals (out of scope v1)**

• 3D rendering • Direct CAESAR II API integration • Multi-user
collaboration • Server-side processing

**1.3 Technology Stack Decision**

  ----------------------------------------------------------------------------
  **Decision**   **Choice**     **Rationale**
  -------------- -------------- ----------------------------------------------
  Framework      Vanilla JS (ES No build step. GitHub Pages serves modules
                 modules)       natively over HTTPS. No npm, no webpack.

  CSS            Tailwind CDN + Pre-built utility classes. Single CDN script
                 custom CSS     tag.

  File parsing   PapaParse CDN  Best-in-class CSV/TSV parser. Handles edge
                                cases, quoted fields, encoding.

  Excel support  SheetJS CDN    Reads .xlsx directly in browser. Converts to
                                CSV internally.

  Icons          Lucide CDN     SVG icon library. Lightweight.

  State          Module-level   Simple, predictable. No Redux/Vuex overhead
                 singleton      for this use case.

  Output         Blob + anchor  CRLF-formatted PCF text as Blob download. No
  download       download       backend needed.
  ----------------------------------------------------------------------------

#  2. Complete Feature Inventory

**2.1 Input Module**

  ------------------------------------------------------------------------
  **Feature**     **Description**                        **Config?**
  --------------- -------------------------------------- -----------------
  CSV Upload      .csv and .xlsx file upload via         ---
                  drag-drop or button

  Paste Input     Paste TSV/CSV directly into text area. ---
                  Auto-detect delimiter

  Header Row      Auto-detect if first row is header or  Yes:
  Detection       data                                   headerRowIndex

  Column Name     Map custom headers like \"Pr.\" →      Yes:
  Aliases         \"Pressure\"                           headerAliases{}

  Delimiter       Auto-detect comma, tab, semicolon,     Yes: delimiter
  Detection       pipe

  Encoding        UTF-8 default. Handle BOM.             ---

  Preview Table   Show first 20 rows with mapped headers ---
                  before processing
  ------------------------------------------------------------------------

**2.2 Configuration Module (Config Tab)**

  -----------------------------------------------------------------------
  **Config Section**  **What User Can Edit**
  ------------------- ---------------------------------------------------
  Column Header       Add/remove/edit aliases for every canonical column
  Aliases             name. Export/Import as JSON.

  Unit Stripping      Define suffixes to strip from each column type (mm,
  Rules               MM, KPA, etc.)

  Component Type Map  CSV Type code → PCF keyword. Add new types. Mark
                      types as SKIP.

  CA Attribute        Per CA slot: which CSV column, which unit, default
  Definitions         value, which component types to write on, special
                      handling (zero=Undefined).

  PCF Syntax Rules    Per PCF component: keyword, point structure, SKEY
                      variant (SKEY/Skey/\<SKEY\>), angle format (degrees
                      vs 100ths), centre-point tokens (3 vs 4), required
                      attributes.

  Default Values      All defaults (CA1 pressure, CA2 temp, etc.)
                      editable.

  Anomaly Detection   Enable/disable each rule. Set thresholds. Set
  Rules               severity (ERROR/WARNING/INFO).

  Coordinate Settings Continuity tolerance (mm). Axis mapping (E/N/U).
                      Coordinate transform (translate, scale).

  Output Settings     Pipeline reference, Project ID, Area, line ending
                      (CRLF/LF), encoding.

  Weight Lookup Table In-browser editable table: component tag → weight
                      (KG).

  Process Data Master In-browser editable table: line number → Pressure,
  Table               Temperature, etc.

  Truncation Options  Suffixes to strip. Auto-detect toggle.

  Message-Square      Edit the free-text template per component type.
  Templates
  -----------------------------------------------------------------------

**2.3 Coordinate Engine**

  -----------------------------------------------------------------------
  **Feature**     **Description**
  --------------- -------------------------------------------------------
  Coordinate      Strip mm/MM suffix. Handle scientific notation. Return
  Parsing         float.

  Bore Parsing    Strip mm, NB, DN suffixes. Map to float.

  Coordinate      Optional translation (offset) and scale factor before
  Transform       output.

  Continuity      Configurable epsilon (default 0.1mm) for endpoint
  Tolerance       matching.

  Bend Angle      Vector dot product. Returns degrees. Optional
  Computation     100ths-of-degree output.

  Direction       Detect dominant axis of travel between two points for
  Detection       MESSAGE-SQUARE.

  Length          3D Euclidean distance for MESSAGE-SQUARE length
  Computation     annotation.

  Number          Strip trailing zeros. Always one decimal. Configurable
  Formatting      decimal places.
  -----------------------------------------------------------------------

**2.4 Grouper & Branch Traversal**

  -----------------------------------------------------------------------
  **Feature**     **Description**
  --------------- -------------------------------------------------------
  Component       Group all CSV rows by RefNo. Preserve CSV insertion
  Grouping        order.

  Point Dict      Per group, build pt\[0\]/pt\[1\]/pt\[2\]/pt\[3\] dicts
  Building        with all geometry and design values.

  Topology Graph  Build adjacency graph: components are nodes, shared
                  coordinates (within tolerance) are edges.

  START Node      Find nodes with Rigid=START, or first BRAN of a run, or
  Detection       isolated nodes.

  DFS Branch      Depth-first traversal from START. When TEE found:
  Traversal       continue main run, queue branch. Output order: main
                  run, then each branch depth-first.

  Orphan          Components with no graph connections. Flag as
  Detection       continuity WARNING.

  Sequence        UI button to re-sequence components by coordinate
  Builder / Sort  proximity (nearest-neighbour from START). Useful when
                  CSV rows are out of order.
  -----------------------------------------------------------------------

#  3. Module Architecture

**3.1 File Structure**

> pcf-converter/
>
> ├── index.html ← Single page entry. All \<script type=\"module\"\>
> imports
>
> ├── css/
>
> │ └── app.css ← App-specific styles (Tailwind CDN handles utilities)
>
> ├── js/
>
> │ ├── app.js ← Main entry. State init. Tab router. Event bus.
>
> │ ├── state.js ← AppState singleton. get/set/subscribe.
>
> │ │
>
> │ ├── config/
>
> │ │ ├── defaults.js ← DEFAULT_CONFIG object (all rules, mappings,
> thresholds)
>
> │ │ ├── config-store.js ← Load/save config to localStorage. Merge with
> defaults.
>
> │ │ └── config-ui.js ← Config tab UI. Dynamic form generation from
> config schema.
>
> │ │
>
> │ ├── input/
>
> │ │ ├── csv-parser.js ← PapaParse wrapper. Upload + paste. Delimiter
> detect.
>
> │ │ ├── excel-parser.js ← SheetJS wrapper. .xlsx → raw rows.
>
> │ │ ├── header-mapper.js ← Map raw headers → canonical names using
> config.headerAliases
>
> │ │ └── unit-transformer.js ← Strip suffixes. Apply conversions per
> column type.
>
> │ │
>
> │ ├── validation/
>
> │ │ ├── input-validator.js ← Phase 1: Data quality checks (missing
> coords, types)
>
> │ │ ├── continuity-checker.js ← Phase 2: Coordinate continuity &
> segment integrity
>
> │ │ ├── anomaly-detector.js ← Phase 3: Process parameter consistency
> checks
>
> │ │ └── syntax-validator.js ← Phase 4: PCF syntax correctness after
> generation
>
> │ │
>
> │ ├── geometry/
>
> │ │ ├── coord-engine.js ← parse_coord, fmt, transform, distance
>
> │ │ ├── angle-calc.js ← compute_angle (degrees / 100ths)
>
> │ │ ├── direction-calc.js ← direction_text, dominant_axis
>
> │ │ └── sequence-builder.js ← Nearest-neighbour sort from START
>
> │ │
>
> │ ├── graph/
>
> │ │ ├── topology-builder.js ← Build adjacency graph from endpoint
> proximity
>
> │ │ └── branch-traverser.js ← DFS traversal. Branch queue. Orphan
> detection.
>
> │ │
>
> │ ├── converter/
>
> │ │ ├── grouper.js ← group_by_refno → OrderedMap\[refno →
> ComponentGroup\]
>
> │ │ ├── point-builder.js ← Build pts{} dict per group. Resolve branch
> point.
>
> │ │ ├── ca-builder.js ← Build CA attribute lines from
> config.caDefinitions
>
> │ │ ├── message-square.js ← Build MESSAGE-SQUARE text from
> config.msgTemplates
>
> │ │ ├── header-writer.js ← Write PCF file header section
>
> │ │ └── components/
>
> │ │ ├── pipe.js
>
> │ │ ├── bend.js
>
> │ │ ├── tee.js
>
> │ │ ├── flange.js
>
> │ │ ├── valve.js
>
> │ │ ├── olet.js
>
> │ │ ├── reducer.js ← Handles REDUCER-CONCENTRIC + REDUCER-ECCENTRIC
>
> │ │ ├── support.js
>
> │ │ └── dispatcher.js ← Map PCFKeyword → writer function
>
> │ │
>
> │ ├── lookup/
>
> │ │ ├── weight-table.js ← In-memory weight lookup. Editable UI.
>
> │ │ └── process-table.js ← Line number → {Pressure, Temperature, \...}
> lookup.
>
> │ │
>
> │ ├── output/
>
> │ │ ├── pcf-assembler.js ← Assemble all PCF lines from traversal order
>
> │ │ ├── pcf-writer.js ← Apply CRLF. Create Blob. Trigger download.
>
> │ │ └── log-reporter.js ← Aggregate all issues into structured log.
>
> │ │
>
> │ └── ui/
>
> │ ├── tab-manager.js ← Tab switching. Show/hide panels.
>
> │ ├── input-tab.js ← Upload/paste UI, preview table
>
> │ ├── mapping-tab.js ← Column mapping preview & override
>
> │ ├── validate-tab.js ← Validation report UI with fix suggestions
>
> │ ├── preview-tab.js ← PCF preview with syntax highlighting
>
> │ ├── output-tab.js ← Download button, log viewer
>
> │ └── config-tab.js ← Full config editor UI
>
> │
>
> └── README.md

**3.2 State Object (state.js)**

> // AppState --- single source of truth for all runtime data
>
> const AppState = {
>
> config: null, // Loaded ConfigStore (merged defaults + user)
>
> rawRows: \[\], // Direct from CSV/Excel parser
>
> mappedHeaders: {}, // { rawHeader: canonicalName }
>
> canonicalRows: \[\], // After header mapping
>
> normalizedRows: \[\], // After unit stripping
>
> groups: {}, // OrderedMap\[refno → ComponentGroup\]
>
> topology: null, // AdjacencyGraph
>
> traversalOrder: \[\], // Ordered ComponentGroup refs after DFS
>
> pcfLines: \[\], // Generated PCF lines array
>
> validationReport: { // Structured issues from all validators
>
> input: \[\], // InputValidator results
>
> continuity:\[\], // ContinuityChecker results
>
> anomaly: \[\], // AnomalyDetector results
>
> syntax: \[\], // SyntaxValidator results
>
> },
>
> logs: \[\], // Combined sorted log entries
>
> meta: {
>
> filename: \'\',
>
> pipelineRef: \'\',
>
> processedAt: null,
>
> },
>
> };

#  4. Configuration Schema (defaults.js)

**This is the authoritative schema for DEFAULT_CONFIG. Every key here
has a corresponding UI control in the Config Tab. Nothing in the
application reads any value other than from this object (or its
user-overridden version in ConfigStore).**

**4.1 Header Aliases**

> headerAliases: {
>
> // Canonical name : \[ list of acceptable CSV header strings
> (case-insensitive) \]
>
> \"Sequence\": \[\"seq\", \"no.\", \"no\", \"#\", \"row\"\],
>
> \"NodeNo\": \[\"node\", \"nodeno\", \"node no\", \"node_no\"\],
>
> \"NodeName\": \[\"nodename\", \"node name\", \"node_name\", \"support
> name\"\],
>
> \"componentName\": \[\"component\", \"comp name\", \"tag\", \"valve
> tag\"\],
>
> \"Type\": \[\"type\", \"comp type\", \"component type\"\],
>
> \"RefNo\": \[\"refno\", \"ref no\", \"ref\", \"component ref\"\],
>
> \"Point\": \[\"point\", \"pt\", \"point no\"\],
>
> \"Bore\": \[\"bore\", \"nb\", \"dn\", \"nominal bore\", \"size\"\],
>
> \"Wall Thickness\": \[\"wt\", \"wall\", \"wall thickness\", \"wall
> thk\", \"thickness\"\],
>
> \"Corrosion Allowance\": \[\"ca\", \"corr\", \"corrosion\", \"ca
> (mm)\", \"c.a.\"\],
>
> \"Radius\": \[\"radius\", \"bend radius\", \"r\"\],
>
> \"Weight\": \[\"weight\", \"wt (kg)\", \"mass\"\],
>
> \"Material\": \[\"material\", \"mat\", \"material code\", \"material
> spec\"\],
>
> \"East\": \[\"east\", \"x\", \"e\", \"x-coord\", \"easting\"\],
>
> \"North\": \[\"north\", \"y\", \"n\", \"y-coord\", \"northing\"\],
>
> \"Up\": \[\"up\", \"z\", \"u\", \"elevation\", \"z-coord\", \"el\"\],
>
> \"Pressure\": \[\"pressure\", \"pr.\", \"pr\", \"design pressure\",
> \"p1\", \"press\"\],
>
> \"Restraint Type\": \[\"restraint type\", \"support type\", \"rest.
> type\", \"vg\"\],
>
> \"Insulation thickness\": \[\"insulation\", \"insul\", \"insul
> thickness\", \"it\"\],
>
> \"Hydro test pressure\": \[\"hydro\", \"hydro test\", \"test
> pressure\", \"hp\"\],
>
> // \... user can add more via Config Tab
>
> }

**4.2 Component Type Map**

> componentTypeMap: {
>
> // CSV Type code → PCF keyword (or \"SKIP\")
>
> \"BRAN\": \"PIPE\",
>
> \"ELBO\": \"BEND\",
>
> \"TEE\": \"TEE\",
>
> \"FLAN\": \"FLANGE\",
>
> \"VALV\": \"VALVE\",
>
> \"OLET\": \"OLET\",
>
> \"ANCI\": \"SUPPORT\",
>
> \"REDU\": \"REDUCER\", // user must specify CONCENTRIC or ECCENTRIC in
> sub-type
>
> \"REDC\": \"REDUCER-CONCENTRIC\",
>
> \"REDE\": \"REDUCER-ECCENTRIC\",
>
> \"GASK\": \"SKIP\",
>
> \"PCOM\": \"SKIP\",
>
> // user-extensible: add any custom type
>
> }

**4.3 PCF Syntax Rules (per component)**

> pcfRules: {
>
> \"PIPE\": {
>
> keyword: \"PIPE\",
>
> points: { EP1:\"1\", EP2:\"2\" }, // Point numbers in CSV
>
> requiresSKEY: false,
>
> skeyStyle: \"\<SKEY\>\", // Options: \"SKEY\", \"Skey\", \"\<SKEY\>\"
>
> defaultSKEY: null,
>
> centrePointTokens: 4, // 3 or 4 (4=include bore)
>
> angleFormat: \"degrees\", // \"degrees\" or \"hundredths\"
>
> caSlots: \[\"CA1\",\"CA2\",\"CA3\",\"CA4\",\"CA5\",\"CA7\",\"CA10\"\],
>
> },
>
> \"BEND\": {
>
> keyword: \"BEND\",
>
> points: { EP1:\"1\", EP2:\"2\", CP:\"0\" },
>
> requiresSKEY: true, skeyStyle: \"\<SKEY\>\", defaultSKEY: \"BEBW\",
>
> centrePointTokens: 4, // ← CAESAR II validated: 4 tokens
>
> angleFormat: \"degrees\",
>
> caSlots: \[\"CA1\",\"CA2\",\"CA3\",\"CA4\",\"CA5\",\"CA7\",\"CA10\"\],
>
> },
>
> \"TEE\": {
>
> keyword: \"TEE\",
>
> points: { EP1:\"1\", EP2:\"2\", CP:\"0\", BP:\"3\" },
>
> requiresSKEY: true, skeyStyle: \"\<SKEY\>\", defaultSKEY: \"TEBW\",
>
> centrePointTokens: 4,
>
> caSlots: \[\"CA1\",\"CA2\",\"CA3\",\"CA4\",\"CA5\",\"CA7\",\"CA10\"\],
>
> },
>
> \"FLANGE\": {
>
> keyword: \"FLANGE\",
>
> points: { EP1:\"1\", EP2:\"2\" },
>
> requiresSKEY: true, skeyStyle: \"\<SKEY\>\", defaultSKEY: \"FLWN\",
>
> caSlots:
> \[\"CA1\",\"CA2\",\"CA3\",\"CA4\",\"CA5\",\"CA7\",\"CA8\",\"CA10\"\],
>
> },
>
> \"VALVE\": {
>
> keyword: \"VALVE\",
>
> points: { EP1:\"1\", EP2:\"2\" },
>
> requiresSKEY: true, skeyStyle: \"\<SKEY\>\", defaultSKEY: \"VBFL\",
>
> caSlots:
> \[\"CA1\",\"CA2\",\"CA3\",\"CA4\",\"CA5\",\"CA7\",\"CA8\",\"CA10\"\],
>
> itemDescSource: \"componentName\", // Use componentName column for
> ITEM-DESCRIPTION
>
> },
>
> \"OLET\": {
>
> keyword: \"OLET\",
>
> points: { CP:\"0\", BP:\"3\" }, // NO END-POINTs
>
> requiresSKEY: true, skeyStyle: \"\<SKEY\>\", defaultSKEY: \"CEBW\",
>
> caSlots: \[\"CA1\",\"CA2\",\"CA3\",\"CA4\",\"CA5\",\"CA7\",\"CA10\"\],
>
> },
>
> \"REDUCER-CONCENTRIC\": {
>
> keyword: \"REDUCER-CONCENTRIC\",
>
> points: { EP1:\"1\", EP2:\"2\" }, // Bore changes EP1→EP2
>
> requiresSKEY: true, skeyStyle: \"Skey\", defaultSKEY: \"RCBW\",
>
> caSlots: \[\"CA1\",\"CA2\",\"CA3\",\"CA4\",\"CA5\",\"CA7\",\"CA10\"\],
>
> },
>
> \"REDUCER-ECCENTRIC\": {
>
> keyword: \"REDUCER-ECCENTRIC\",
>
> points: { EP1:\"1\", EP2:\"2\" },
>
> requiresSKEY: true, skeyStyle: \"Skey\", defaultSKEY: \"REBW\",
>
> flatDirection: \"DOWN\", // DOWN/UP/blank
>
> caSlots: \[\"CA1\",\"CA2\",\"CA3\",\"CA4\",\"CA5\",\"CA7\",\"CA10\"\],
>
> },
>
> \"SUPPORT\": {
>
> keyword: \"SUPPORT\",
>
> points: { COORDS:\"0\" },
>
> requiresSKEY: false,
>
> caSlots: \[\], // ← NO CA on SUPPORT
>
> supportNameField: \"Restraint Type\", // CSV column → \<SUPPORT_NAME\>
>
> supportGUIDField: \"NodeName\", // CSV column → \<SUPPORT_GUID\> UCI:
>
> },
>
> }

**4.4 CA Attribute Definitions**

> caDefinitions: {
>
> \"CA1\": { csvField:\"Pressure\", unit:\"KPA\", default:700,
> writeOn:\"all-except-support\", zeroValue:null },
>
> \"CA2\": { csvField:null, unit:\"C\", default:120,
> writeOn:\"all-except-support\", zeroValue:null },
>
> \"CA3\": { csvField:\"Material\", unit:null,
> default:\"A106-B\",writeOn:\"all-except-support\", zeroValue:null },
>
> \"CA4\": { csvField:\"Wall Thickness\", unit:\"MM\", default:9.53,
> writeOn:\"all-except-support\", zeroValue:\"Undefined MM\" },
>
> \"CA5\": { csvField:\"Insulation thickness\",unit:\"MM\", default:0,
> writeOn:\"all-except-support\", zeroValue:null },
>
> \"CA7\": { csvField:\"Corrosion Allowance\", unit:\"MM\", default:3,
> writeOn:\"all-except-support\", zeroValue:\"0 MM\" },
>
> \"CA8\": { csvField:\"Weight\", unit:\"KG\", default:100,
> writeOn:\[\"FLANGE\",\"VALVE\"\], zeroValue:null },
>
> \"CA10\": { csvField:\"Hydro test pressure\", unit:\"KPA\",
> default:1500, writeOn:\"all-except-support\", zeroValue:null },
>
> }

**4.5 Anomaly Detection Rules**

> anomalyRules: {
>
> wallThicknessChangeOnSameSize: {
>
> enabled: true,
>
> description: \"Wall thickness changed without corresponding bore size
> change\",
>
> severity: \"WARNING\",
>
> },
>
> pressureChangeWithinHeader: {
>
> enabled: true,
>
> threshold: 0.05, // 5% relative change triggers warning
>
> description: \"Pressure changed within same pipeline header\",
>
> severity: \"WARNING\",
>
> },
>
> temperatureChangeWithinHeader: {
>
> enabled: true,
>
> threshold: 5, // absolute °C
>
> description: \"Temperature changed within same pipeline header\",
>
> severity: \"INFO\",
>
> },
>
> boreSizeChangeBranchExpected: {
>
> enabled: true,
>
> description: \"Bore changed at non-TEE/REDUCER component ---
> unexpected\",
>
> severity: \"WARNING\",
>
> },
>
> lineNoChangeProcessExpected: {
>
> enabled: true,
>
> description: \"Line number changed --- expect pressure/temperature
> change\",
>
> severity: \"INFO\",
>
> },
>
> wallVsBoreRatioAbnormal: {
>
> enabled: true,
>
> minRatio: 0.01, maxRatio: 0.20, // wall/bore ratio outside this → flag
>
> description: \"Wall thickness/bore ratio outside normal range\",
>
> severity: \"INFO\",
>
> },
>
> branchBoreExceedsRun: {
>
> enabled: true,
>
> description: \"Branch bore exceeds run bore at TEE --- normally
> unexpected\",
>
> severity: \"WARNING\",
>
> },
>
> }

#  5. Critical Algorithms

##  5.1 Coordinate Continuity & Branch Traversal

**This is the most complex and critical algorithm. The CSV rows may be
listed in any order. The PCF output must follow a connected routing
order (main header → branches).**

**Step 1 --- Group by RefNo**

> // All rows sharing a RefNo belong to one component
>
> function groupByRefNo(canonicalRows) {
>
> const groups = new Map(); // preserves insertion order
>
> for (const row of canonicalRows) {
>
> const key = row.RefNo;
>
> if (!groups.has(key)) groups.set(key, { type:row.Type, rows:\[\] });
>
> groups.get(key).rows.push(row);
>
> }
>
> return groups;
>
> }

**Step 2 --- Build Point Dictionary**

> // For each group, extract geometry by Point number
>
> function buildPts(group) {
>
> const pts = {};
>
> for (const row of group.rows) {
>
> const pt = String(row.Point).trim();
>
> pts\[pt\] = {
>
> E: parseCoord(row.East), N: parseCoord(row.North), U:
> parseCoord(row.Up),
>
> bore: parseBore(row.Bore), radius: parseCoord(row.Radius),
>
> wall: toFloat(row\[\"Wall Thickness\"\]), corr:
> toFloat(row\[\"Corrosion Allowance\"\]),
>
> weight: toFloat(row.Weight), material: row.Material\|\|\"A106-B\",
>
> pressure: toFloat(row.Pressure)\|\|700, hydro: toFloat(row\[\"Hydro
> test pressure\"\])\|\|1500,
>
> insul: toFloat(row\[\"Insulation thickness\"\]), restraintType:
> row\[\"Restraint Type\"\]\|\|\"\",
>
> nodeName: row.NodeName\|\|\"\", compName: row.componentName\|\|\"\",
>
> };
>
> }
>
> return pts;
>
> }

**Step 3 --- Build Topology Graph**

> // Connect components by shared endpoint coordinates
>
> function buildTopology(groups, tolerance) {
>
> const nodes = new Map(); // refno → { group, pts, outCoords }
>
> // Collect all \"output\" endpoint coordinates per component
>
> for (const \[refno, group\] of groups) {
>
> if (SKIP_TYPES.has(group.type)) continue;
>
> const pts = buildPts(group);
>
> const coords = getEndpointCoords(group.type, pts); // returns \[p1,
> p2\]
>
> nodes.set(refno, { group, pts, coords });
>
> }
>
> // Build adjacency: A.endpoint ≈ B.endpoint within tolerance
>
> const adj = new Map(); // refno → \[connected refno, \...\]
>
> for (const \[r1, n1\] of nodes) {
>
> adj.set(r1, \[\]);
>
> for (const \[r2, n2\] of nodes) {
>
> if (r1===r2) continue;
>
> for (const c1 of n1.coords) {
>
> for (const c2 of n2.coords) {
>
> if (distance3D(c1, c2) \<= tolerance) {
>
> adj.get(r1).push(r2);
>
> break;
>
> }
>
> }
>
> }
>
> }
>
> }
>
> return { nodes, adj };
>
> }

**Step 4 --- DFS Branch Traversal**

> // Traverse from START, handle branches correctly
>
> function traverseGraph(topology, startNodes, groups) {
>
> const ordered = \[\];
>
> const visited = new Set();
>
> // Queue: \[refno, depth, isMainRun\]
>
> const queue = startNodes.map(r =\> ({ refno:r, depth:0 }));
>
> while (queue.length \> 0) {
>
> const { refno } = queue.shift();
>
> if (visited.has(refno)) continue;
>
> visited.add(refno);
>
> ordered.push(refno);
>
> const neighbours = topology.adj.get(refno)\|\|\[\];
>
> const group = groups.get(refno);
>
> if (group.type === \"TEE\") {
>
> // Main run: EP1 → CP → EP2 (continuation along run axis)
>
> // Branch: BP → branch end (queue after current run finishes)
>
> const \[mainNext, branchNext\] = classifyTeeNeighbours(refno,
> topology);
>
> if (mainNext && !visited.has(mainNext)) queue.unshift({
> refno:mainNext, depth:1 });
>
> if (branchNext && !visited.has(branchNext)) queue.push({
> refno:branchNext, depth:2 });
>
> } else {
>
> for (const n of neighbours) {
>
> if (!visited.has(n)) queue.unshift({ refno:n, depth:1 });
>
> }
>
> }
>
> }
>
> // Report orphans: nodes never visited
>
> const orphans = \[\...groups.keys()\].filter(r =\> !visited.has(r) &&
> !SKIP_TYPES.has(groups.get(r).type));
>
> return { ordered, orphans };
>
> }
>
> TEE branch classification: compare branch-point (Point=3) coordinate
> against all neighbours. Neighbour whose connecting endpoint is closest
> to the branch point = branch run. Other connected neighbour = main run
> continuation.

##  5.2 Validation Pipeline

**InputValidator --- Phase 1: Data Quality**

  -----------------------------------------------------------------------
  **Check**           **Logic**                           **Result**
  ------------------- ----------------------------------- ---------------
  Missing Type        row.Type is null/empty/not in       ERROR --- row
                      componentTypeMap                    skipped

  Missing coordinates row.East or North or Up is null on  ERROR ---
                      non-SKIP type                       component
                                                          skipped

  Missing Bore        row.Bore is null or zero            WARNING ---
                                                          default bore
                                                          applied

  Invalid RefNo       row.RefNo is null or empty          ERROR ---
                                                          cannot group,
                                                          row skipped

  Duplicate           Same RefNo and Point number appears WARNING ---
  RefNo+Point         more than once                      last value wins

  Non-numeric         Coordinate after suffix stripping   ERROR
  coordinate          is not parseable as float

  Negative bore       Bore value \< 0                     ERROR
  -----------------------------------------------------------------------

**ContinuityChecker --- Phase 2**

  -----------------------------------------------------------------------
  **Check**           **Logic**                           **Result**
  ------------------- ----------------------------------- ---------------
  Segment gap         EP2 of component A does not match   WARNING: gap at
                      EP1 of component B within tolerance coord (E,N,U),
                                                          distance Xmm

  Orphan component    Component has no matching endpoint  WARNING:
                      to any other component              isolated
                                                          component

  Duplicate endpoint  Two different components share same INFO: may be
                      endpoint                            correct at
                                                          tee/flange pair

  Zero-length segment EP1 == EP2 within tolerance         WARNING:
                                                          zero-length
                                                          {Type} at
                                                          (E,N,U)

  Branch disconnect   TEE branch point has no connected   WARNING:
                      component in that direction         unconnected TEE
                                                          branch
  -----------------------------------------------------------------------

**AnomalyDetector --- Phase 3**

  -----------------------------------------------------------------------
  **Check**           **Logic**                           **Result**
  ------------------- ----------------------------------- ---------------
  Pressure anomaly    \|CA1_new - CA1_prev\| / CA1_prev   WARNING
                      \> threshold within same header

  Wall/bore ratio     wall / bore \< 0.01 or \> 0.20      INFO

  Branch bore \> run  TEE branch bore \> TEE run bore     WARNING

  Size change no      Bore changes at non-TEE/REDUCER     WARNING
  reducer             component

  Line change no      RefNo prefix changes but CA1/CA2    INFO: expected
  process change      unchanged                           change not
                                                          detected

  Insulation gap      CA5 changes from non-zero to zero   INFO
                      mid-header
  -----------------------------------------------------------------------

**SyntaxValidator --- Phase 4 (Post-generation)**

  ------------------------------------------------------------------------
  **Rule   **Check**                           **Fix Suggestion**
  ID**
  -------- ----------------------------------- ---------------------------
  SV-001   Every non-SUPPORT block has         Add missing CA line with
           CA1,CA2,CA3,CA4,CA5,CA7,CA10        default value

  SV-002   BEND has ANGLE \> 0 and BEND-RADIUS Check radius column in CSV
           \> 0

  SV-003   TEE has exactly 4 point lines       Check CSV rows for missing
           (EP1,EP2,CP,BP)                     Point=0 or Point=3

  SV-004   OLET has CENTRE-POINT +             Remap OLET point structure
           BRANCH1-POINT (no END-POINTs)       in config

  SV-005   SUPPORT has \<SUPPORT_NAME\> and    Check Restraint Type and
           \<SUPPORT_GUID\>                    NodeName columns

  SV-006   REDUCER has two END-POINTs with     Bore must differ EP1 vs EP2
           different bores                     for reducer

  SV-007   REDUCER-ECCENTRIC has               Check config flatDirection
           FLAT-DIRECTION                      setting

  SV-008   No component block has empty        Check componentTypeMap in
           keyword (unknown type)              config
  ------------------------------------------------------------------------

#  6. User Interface --- Tab Specifications

**6.1 Tab Bar**

Fixed top nav bar. Seven tabs: INPUT → MAPPING → VALIDATE → SEQUENCE →
PREVIEW → OUTPUT → CONFIG

**6.2 INPUT Tab**

  -----------------------------------------------------------------------
  **Element**     **Detail**
  --------------- -------------------------------------------------------
  Drag-drop zone  Large zone. Accept .csv, .xlsx, .txt. Shows filename on
                  drop.

  Paste button    Toggle text area. Detect CSV vs TSV from clipboard.

  Parse button    Runs CSV parser + header mapper. Shows mapped header
                  table.

  Header mapping  Two columns: \"Detected Header\" → \"Canonical Name\"
  table           (dropdown to remap). Flagged in red if unmapped.

  Data preview    First 20 rows as read-only table. Highlights suspicious
                  cells (empty, non-numeric coords).

  Row count badge Total rows, skipped rows (GASK/PCOM), unique RefNos.
  -----------------------------------------------------------------------

**6.3 MAPPING Tab**

Shows the component grouping result. Each group with RefNo, Type, mapped
PCF keyword, point count, and coordinate range. Allows user to override
type for individual components. \"Re-group\" button.

**6.4 VALIDATE Tab**

Three-panel layout:

> Left: Issue list filtered by severity (ERROR/WARNING/INFO). Click any
> issue to highlight relevant component.
>
> Centre: Context --- the CSV rows involved in the issue.
>
> Right: Fix suggestion with Apply button where auto-fix is possible.

**6.5 SEQUENCE Tab**

\"Sort by Coordinate\" button: runs nearest-neighbour algorithm from the
detected START node. Shows before/after sequence order. User can drag to
reorder manually. \"Apply\" commits the order.

**6.6 PREVIEW Tab**

Read-only PCF preview with syntax highlighting. Component blocks
colour-coded by type. Click any block to see source CSV rows. \"Validate
Syntax\" button triggers SyntaxValidator. \"Copy to Clipboard\" button.

**6.7 OUTPUT Tab**

\"Generate PCF\" button (disabled until no ERROR severity issues).
\"Download .pcf\" button (CRLF formatted). Log panel: expandable
sections for INPUT / CONTINUITY / ANOMALY / SYNTAX results.

**6.8 CONFIG Tab (most important)**

  ------------------------------------------------------------------------
  **Config          **UI Widget**        **Notes**
  Section**
  ----------------- -------------------- ---------------------------------
  Column Header     Editable key-value   Case-insensitive match
  Aliases           list. Add/remove
                    rows. Import/Export
                    JSON.

  Component Type    Two-column table:    Live preview updates
  Map               CSV code → PCF
                    keyword. Dropdown
                    for keyword. Toggle
                    SKIP.

  CA Attribute      Accordion. Each CA:  Fully editable
  Definitions       field, unit,
                    default, writeOn
                    list, zeroValue.

  PCF Syntax Rules  Accordion per        Advanced users
                    component. SKEY
                    style, angle format,
                    centre tokens.

  Anomaly Rules     Toggle + threshold   On/Off per rule
                    inputs per rule.
                    Severity dropdown.

  Coordinate        Tolerance input.     Number inputs
  Settings          Axis remapping (E↔N
                    swap etc). Transform
                    X/Y/Z offsets.

  Output Settings   Pipeline reference.  Text inputs
                    Project ID. Area.
                    Line ending radio.
                    Decimal places.

  Weight Lookup     Editable data grid:  In-memory table
  Table             Component tag →
                    Weight (KG). Import
                    CSV.

  Process Data      Editable data grid:  Override CA per line
  Table             Line no →
                    Pressure/Temp/etc.
                    Import CSV.

  Message-Square    Text input per       Live preview
  Templates         component type.
                    Template variables
                    listed.

  Save/Load Config  Export full config   Persists to localStorage
                    as JSON. Import
                    JSON. Reset to
                    defaults.
  ------------------------------------------------------------------------

#  7. Component Writer Detail Reference

**All Component Types --- PCF Syntax**

+-------------+-----------+------------------+------------------+-----+
| **PCF       | **CSV     | **Key Points**   | **Unique         | **  |
| Keyword**   | Types**   |                  | Fields**         | CA8 |
|             |           |                  |                  | ?** |
+=============+===========+==================+==================+=====+
| PIPE        | BRAN      | EP1(1) EP2(2)    | ---              | No  |
+-------------+-----------+------------------+------------------+-----+
| BEND        | ELBO      | EP1(1) EP2(2)    | ANGLE,           | No  |
|             |           | CP(0)            | BEND-RADIUS      |     |
|             |           |                  |                  |     |
|             |           | CP = 4 tokens (E |                  |     |
|             |           | N U Bore)        |                  |     |
|             |           |                  |                  |     |
|             |           | ANGLE computed   |                  |     |
|             |           | from vectors     |                  |     |
|             |           |                  |                  |     |
|             |           | BEND-RADIUS from |                  |     |
|             |           | CSV Radius       |                  |     |
+-------------+-----------+------------------+------------------+-----+
| TEE         | TEE       | EP1(1) EP2(2)    | BRANCH1-POINT    | No  |
|             |           | CP(0) BP(3)      |                  |     |
|             |           |                  |                  |     |
|             |           | All 4 tokens     |                  |     |
|             |           |                  |                  |     |
|             |           | Branch material  |                  |     |
|             |           | may differ       |                  |     |
+-------------+-----------+------------------+------------------+-----+
| FLANGE      | FLAN      | EP1(1) EP2(2)    | ---              | Yes |
+-------------+-----------+------------------+------------------+-----+
| VALVE       | VALV      | EP1(1) EP2(2)    | ---              | Yes |
|             |           |                  |                  |     |
|             |           | ITEM-DESC from   |                  |     |
|             |           | componentName    |                  |     |
+-------------+-----------+------------------+------------------+-----+
| OLET        | OLET      | CP(0) BP(3) ---  | No END-POINT     | No  |
|             |           | NO END-POINTs    | lines            |     |
|             |           |                  |                  |     |
|             |           | CP = main pipe   |                  |     |
|             |           | CL               |                  |     |
|             |           |                  |                  |     |
|             |           | BP = branch end  |                  |     |
+-------------+-----------+------------------+------------------+-----+
| REDUCER     | REDC/REDU | EP1(1) EP2(2)    | Skey RCBW        | No  |
| -CONCENTRIC |           |                  |                  |     |
|             |           | Bore MUST differ |                  |     |
+-------------+-----------+------------------+------------------+-----+
| REDUCE      | REDE      | EP1(1) EP2(2)    | Skey REBW        | No  |
| R-ECCENTRIC |           |                  |                  |     |
|             |           | FLAT-DIRECTION   | FLAT-DIRECTION   |     |
|             |           | DOWN/UP          |                  |     |
+-------------+-----------+------------------+------------------+-----+
| SUPPORT     | ANCI      | CO-ORDS(0) = 4   | \<SUPPORT_NAME\> | No  |
|             |           | tokens           |                  |     |
|             |           |                  | \<SUPPORT_GUID\> |     |
|             |           | NO CA attributes |                  |     |
|             |           | at all           |                  |     |
|             |           |                  |                  |     |
|             |           | \<SUPPORT_NAME\> |                  |     |
|             |           | = Restraint Type |                  |     |
|             |           |                  |                  |     |
|             |           | \<SUPPORT_GUID\> |                  |     |
|             |           | = UCI:{NodeName} |                  |     |
+-------------+-----------+------------------+------------------+-----+

> BEND ANGLE: If config.angleFormat = \"hundredths\" → multiply degrees
> × 100 and output as integer (e.g., 90° → 9000). If \"degrees\" →
> output decimal (e.g., 90.5729). Default: \"degrees\" for CAESAR II
> validated format.
>
> REDUCER detection: If both rows for same RefNo have SAME bore → not a
> reducer (flag as data error). If bores differ → REDUCER. Eccentric or
> concentric determined by CSV Type code or config default.

#  8. Phased Implementation Plan

**Each phase produces a working, testable increment. No phase depends on
code from a later phase being complete.**

**PHASE 1 --- Foundation + Input**

Deliverable: App loads. User can upload/paste CSV. Preview table
renders. Config loads from defaults.

  -------------------------------------------------------------------------
  **Task**              **Module**    **Key interfaces**
  --------------------- ------------- -------------------------------------
  index.html skeleton   HTML          Tab bar, 7 panels, CDN scripts
                                      (PapaParse, SheetJS, Tailwind,
                                      Lucide)

  state.js              State         AppState object, get/set, simple
                                      subscribe pattern

  defaults.js           Config        Complete DEFAULT_CONFIG with all
                                      sections described in Section 4

  config-store.js       Config        load() merges defaults +
                                      localStorage. save(). reset().
                                      export/import JSON.

  csv-parser.js         Input         PapaParse wrap. Auto-detect
                                      delimiter. Returns raw row objects.

  excel-parser.js       Input         SheetJS wrap. .xlsx sheet 0 → rows
                                      array. Same interface as CSV parser.

  header-mapper.js      Input         mapHeaders(rawHeaders,
                                      config.headerAliases) → { rawHeader:
                                      canonical }

  unit-transformer.js   Input         stripSuffix(val,
                                      config.unitStripping) → float or
                                      string per column type

  input-tab.js          UI            Drag-drop zone, paste area, parse
                                      button, header mapping table, data
                                      preview
  -------------------------------------------------------------------------

**PHASE 2 --- Coordinate Engine + Grouper**

Deliverable: CSV rows grouped by RefNo. Point dicts built. Coordinates
parsed and formatted. Angles computed.

  ------------------------------------------------------------------------------------------------
  **Task**              **Module**   **Key interfaces**
  --------------------- ------------ -------------------------------------------------------------
  coord-engine.js       Geometry     parseCoord(val) → float. parseBore(val) → float. fmt(v,d) →
                                     string. applyTransform(pt, config).

  angle-calc.js         Geometry     computeAngle(p1, cp, p2) → degrees. toHundredths(deg) → int.

  direction-calc.js     Geometry     directionText(p1,p2) →
                                     \"NORTH\"\|\"SOUTH\"\|\"EAST\"\|\"WEST\"\|\"UP\"\|\"DOWN\".
                                     dominantAxes(p1,p2) → \[dir1, dir2\].

  sequence-builder.js   Geometry     nearestNeighbourSort(groups, startRefno, tolerance) → ordered
                                     refno\[\].

  grouper.js            Converter    groupByRefNo(rows) → Map\[refno → {type, rows}\]. Filters
                                     SKIP types.

  point-builder.js      Converter    buildPts(group, config) → pts{0..3}. Resolves design values,
                                     applies defaults.

  mapping-tab.js        UI           Show grouped components. Type override dropdowns. Re-group
                                     button.
  ------------------------------------------------------------------------------------------------

**PHASE 3 --- Component Converters + PCF Output**

Deliverable: Full PCF file generated from grouped data. Download works.
Preview tab shows result.

  ------------------------------------------------------------------------
  **Task**                   **Module**   **Key interfaces**
  -------------------------- ------------ --------------------------------
  ca-builder.js              Converter    buildCABlock(pts, pcfType,
                                          config) → string\[\]. Reads
                                          config.caDefinitions.

  message-square.js          Converter    buildMsgSquare(pts, pcfType,
                                          config) → string\[\]. Template
                                          interpolation.

  header-writer.js           Converter    buildHeader(config, meta) →
                                          string\[\]. Pipeline ref, units,
                                          project id.

  components/pipe.js         Converter    writePipe(pts, config) →
                                          string\[\].

  components/bend.js         Converter    writeBend(pts, config) →
                                          string\[\]. Angle from
                                          angle-calc.js.

  components/tee.js          Converter    writeTee(pts, config) →
                                          string\[\]. Uses branch row for
                                          CA3/CA4 if different.

  components/flange.js       Converter    writeFlange(pts, config) →
                                          string\[\].

  components/valve.js        Converter    writeValve(pts, config) →
                                          string\[\].

  components/olet.js         Converter    writeOlet(pts, config) →
                                          string\[\].

  components/reducer.js      Converter    writeReducer(pts, config) →
                                          string\[\]. Handles both
                                          CONCENTRIC and ECCENTRIC.

  components/support.js      Converter    writeSupport(pts, config) →
                                          string\[\]. No CA.
                                          \<SUPPORT_NAME\>.
                                          \<SUPPORT_GUID\>.

  components/dispatcher.js   Converter    dispatch(pcfType, pts, config) →
                                          string\[\]. Map keyword →
                                          writer.

  pcf-assembler.js           Output       assemble(traversalOrder, groups,
                                          config) → all PCF lines\[\].

  pcf-writer.js              Output       writePCF(lines, config) → Blob
                                          (CRLF). triggerDownload(blob,
                                          filename).

  preview-tab.js             UI           Syntax-highlighted PCF. Colour
                                          per component type. Source row
                                          click-through.
  ------------------------------------------------------------------------

**PHASE 4 --- Topology + Branch Traversal**

Deliverable: Correct component ordering regardless of CSV row order.
Branch detection. Orphan reporting.

  -----------------------------------------------------------------------------------
  **Task**              **Module**   **Key interfaces**
  --------------------- ------------ ------------------------------------------------
  topology-builder.js   Graph        buildTopology(groups,
                                     config.coordinateSettings.continuityTolerance) →
                                     {nodes, adj}

  branch-traverser.js   Graph        traverse(topology, startNodes, groups) →
                                     {ordered\[\], orphans\[\]}.

  START detection       Graph        detectStartNodes(groups, topology) → refno\[\].
                                     Rigid=START first, then topological start.

  TEE branch classifier Graph        classifyTeeNeighbours(refno, topology, pts) →
                                     {mainNext, branchNext}.

  sequence-tab.js       UI           Sort button, drag-reorder list, apply button.
  -----------------------------------------------------------------------------------

**PHASE 5 --- Validation Suite**

Deliverable: Full validation report. Fix suggestions.
Validate-before-download enforcement.

  ---------------------------------------------------------------------------
  **Task**                **Module**    **Key interfaces**
  ----------------------- ------------- -------------------------------------
  input-validator.js      Validation    validateInput(normalizedRows, config)
                                        → Issue\[\]. Data quality checks.

  continuity-checker.js   Validation    checkContinuity(topology) →
                                        Issue\[\]. Gaps, orphans,
                                        zero-length.

  anomaly-detector.js     Validation    detectAnomalies(groups,
                                        traversalOrder, config) → Issue\[\].
                                        Process param checks.

  syntax-validator.js     Validation    validateSyntax(pcfLines, config) →
                                        Issue\[\]. Post-generation PCF rules.

  log-reporter.js         Output        aggregateLogs(allIssues) →
                                        LogReport{}. Sorted by severity then
                                        location.

  validate-tab.js         UI            Three-panel: issue list, context, fix
                                        suggestion. Severity filter. Auto-fix
                                        apply.

  output-tab.js           UI            Generate PCF button (gated on no
                                        ERRORs). Download button. Log panel.
  ---------------------------------------------------------------------------

**PHASE 6 --- Config Tab + Lookup Tables**

Deliverable: All config sections editable in browser. Weight and process
tables. Save/load config.

  -----------------------------------------------------------------------
  **Task**            **Module**    **Key interfaces**
  ------------------- ------------- -------------------------------------
  config-ui.js        Config        Dynamic form generation from config
                                    schema. Accordion sections. Live
                                    update AppState.

  Header alias editor Config UI     Key-value grid. Add/remove rows.
                                    Import/export JSON.

  Component type map  Config UI     Two-column table. Dropdown for PCF
  editor                            keyword. SKIP toggle.

  CA definition       Config UI     Accordion per CA slot. All fields
  editor                            editable.

  PCF syntax rules    Config UI     Accordion per component. SKEY style
  editor                            select. Angle format radio.

  Anomaly rules       Config UI     Toggle + threshold per rule. Severity
  editor                            select.

  Weight lookup table Lookup + UI   In-browser editable data grid. Import
                                    CSV. query(tag) → weight.

  Process data table  Lookup + UI   In-browser editable data grid.
                                    query(lineNo) → {P, T, \...}.

  Save/Load config    Config        Export JSON. Import JSON. Reset to
                                    defaults. All persisted to
                                    localStorage.
  -----------------------------------------------------------------------

**PHASE 7 --- GitHub Deployment + Polish**

Deliverable: Single-repo static site. README. All error paths handled
gracefully.

  -----------------------------------------------------------------------
  **Task**        **Module**      **Notes**
  --------------- --------------- ---------------------------------------
  README.md       Docs            Usage, config guide, supported
                                  component types, known limitations.

  Error           All modules     Every module wraps operations in
  boundaries                      try/catch. Errors logged to
                                  AppState.logs, never crash.

  Loading states  UI              Spinner on file parse, convert,
                                  validate. Disable buttons during
                                  processing.

  Responsive      CSS             Mobile-readable. Config tab scrollable.
  layout                          Tables with horizontal scroll.

  GitHub Pages    Repo            gh-pages branch or /docs folder. No
  config                          build step --- pure ES module imports.

  Performance     All             Use Web Workers for heavy operations
                                  (topology build, large CSV parse).

  Keyboard        UI              Ctrl+O open file, Ctrl+S download PCF,
  shortcuts                       Ctrl+V focus paste area.
  -----------------------------------------------------------------------

#  9. Interface Contracts

**Every module must implement exactly these interfaces. No module should
import from another without these being honoured.**

**9.1 Issue Object (all validators emit this)**

> interface Issue {
>
> id: string; // e.g. \"V-001\", \"SV-003\"
>
> phase: \"INPUT\" \| \"CONTINUITY\" \| \"ANOMALY\" \| \"SYNTAX\";
>
> severity: \"ERROR\" \| \"WARNING\" \| \"INFO\";
>
> refno?: string; // which component (if known)
>
> rowIndex?: number; // CSV row number
>
> message: string; // human-readable description
>
> detail?: string; // technical detail (coordinate values, etc.)
>
> fixable: boolean; // can be auto-fixed
>
> fix?: () =\> void;// auto-fix function (if fixable)
>
> fixHint: string; // what the fix does / user action
>
> }

**9.2 ComponentGroup Object**

> interface ComponentGroup {
>
> refno: string; // the RefNo key
>
> type: string; // CSV Type (BRAN, ELBO, etc.)
>
> pcfType: string; // mapped PCF keyword (PIPE, BEND, etc.)
>
> rows: Row\[\]; // all canonical rows for this component
>
> pts: PointDict; // pts\[0..3\] built from rows
>
> skip: boolean; // true if type is SKIP
>
> }

**9.3 PointDict Object**

> interface PointDict {
>
> \[ptNum: string\]: { // \"0\", \"1\", \"2\", \"3\"
>
> E: number; N: number; U: number; bore: number;
>
> radius: number; wall: number; corr: number; weight: number;
>
> material: string; pressure: number; hydro: number; insul: number;
>
> restraintType: string; nodeName: string; compName: string;
>
> }
>
> }

**9.4 Config Accessor Pattern**

> // Modules do NOT import defaults.js directly.
>
> // They access config through ConfigStore:
>
> import { getConfig } from \"../config/config-store.js\";
>
> const config = getConfig(); // always returns merged (defaults + user
> overrides)
>
> const aliases = config.headerAliases;

#  10. Edge Cases Register

  ------------------------------------------------------------------------------------
  **\#**   **Scenario**         **Detection**                **Handling**
  -------- -------------------- ---------------------------- -------------------------
  EC-01    BRAN with only 1 row pts\[\"2\"\] missing         Flag continuity warning.
           (Point=1 but no                                   Try to infer Point=2 from
           Point=2)                                          next connected component.
                                                             If not found, skip.

  EC-02    Coordinates with     parseFloat handles this      Accept. Pass through
           scientific notation                               fmt() normally.
           e.g. 1.2e+05

  EC-03    Negative coordinates parseFloat negative          Valid. Write as-is:
           (e.g. North = -2650)                              -2650.0

  EC-04    RefNo formula        Starts with \"=\"            Use full string as group
           \"=67130482/1664\"                                key. Extract pipeline ref
           as string                                         as chars before \"/\".

  EC-05    Wall Thickness = 0   wall == 0.0                  Write \"Undefined MM\"
           and spec-driven                                   for CA4. Config flag:
                                                             zeroValue.

  EC-06    Material = \"0\" or  After alias mapping          Apply default \"A106-B\".
           empty                                             Log INFO.

  EC-07    Two BRAN rows same   pts\[1\].bore ≠              Flag anomaly: bore change
           RefNo different      pts\[2\].bore                on PIPE --- may need
           bores                                             REDUCER.

  EC-08    TEE branch has       pts\[\"3\"\].material ≠      Use branch material for
           different material   pts\[\"1\"\].material        CA3 in that component.
                                                             Annotate in
                                                             MESSAGE-SQUARE.

  EC-09    OLET Point structure pts\[\"0\"\] missing but     Use
           --- Point=1 and      pts\[\"1\"\] present         config.oletPointMapping
           Point=2 present (not                              override. Emit WARNING.
           0/3)

  EC-10    Pressure/Temp in     processTable.query(lineNo)   Process table value
           process data table   exists                       OVERRIDES CSV value. Log
           contradicts CSV row                               INFO.

  EC-11    ELBO Radius=0 in CSV radius == 0                  Do not write BEND-RADIUS
                                                             0. Log WARNING:
                                                             BEND-RADIUS must be
                                                             specified.

  EC-12    Very large pipeline  Performance                  Batch topology build in
           --- 500+ components                               Web Worker. Show progress
                                                             bar.

  EC-13    CSV has extra        Column not mapped            Silently ignore. Log
           columns not in                                    INFO: unmapped column
           headerAliases                                     {name}.

  EC-14    Multiple GASK rows   GASK type = SKIP             Skip all GASK. Flanges
           between two FLAN                                  connect directly by
           rows                                              coordinates.
  ------------------------------------------------------------------------------------
