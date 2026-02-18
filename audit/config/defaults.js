/**
 * defaults.js — DEFAULT_CONFIG
 * ALL application rules, mappings, thresholds, and PCF syntax live here.
 * Nothing in the app is hardcoded. Every value here has a corresponding
 * editor in the Config Tab.
 * Schema version: used to detect stale localStorage configs.
 */

export const SCHEMA_VERSION = "1.0.0";

export const DEFAULT_CONFIG = {
  _version: SCHEMA_VERSION,

  // 1. HEADER ALIASES: canonical name → accepted CSV header variants (case-insensitive)
  headerAliases: {
    Sequence: ["sequence", "seq", "no.", "no", "#", "row", "s.no"],
    NodeNo: ["nodeno", "node no", "node_no", "node number", "nd no"],
    NodeName: ["nodename", "node name", "node_name", "support name", "node tag"],
    componentName: ["componentname", "component name", "comp name", "tag", "valve tag", "comp tag", "name"],
    Type: ["type", "comp type", "component type", "comp_type", "category"],
    RefNo: ["refno", "ref no", "ref_no", "reference", "ref", "component ref", "comp ref"],
    Point: ["point", "pt", "point no", "pt no", "point_no"],
    PPoint: ["ppoint", "prev point", "parent point"],
    Bore: ["bore", "nb", "dn", "nominal bore", "size", "bore (mm)", "nb (mm)"],
    "O/D": ["o/d", "od", "outside diameter", "outer diameter", "o.d."],
    "Wall Thickness": ["wall thickness", "wt", "wall", "wall thk", "thickness", "wt (mm)", "wall (mm)", "thk"],
    "Corrosion Allowance": ["corrosion allowance", "ca", "corr", "corrosion", "ca (mm)", "c.a.", "ca_mm"],
    Radius: ["radius", "bend radius", "r", "elbow radius", "bend r"],
    SIF: ["sif", "stress intensification", "stress factor"],
    Weight: ["weight", "wt (kg)", "mass", "component weight", "weight (kg)"],
    Material: ["material", "mat", "material code", "material spec", "material grade", "spec"],
    Rigid: ["rigid", "fixed", "anchor", "boundary"],
    East: ["east", "x", "e", "x-coord", "easting", "x (mm)", "east (mm)"],
    North: ["north", "y", "n", "y-coord", "northing", "y (mm)", "north (mm)"],
    Up: ["up", "z", "u", "elevation", "z-coord", "el", "up (mm)", "z (mm)", "elev"],
    Status: ["status", "stat", "flag"],
    Pressure: ["pressure", "pr.", "pr", "design pressure", "p1", "press", "design pr.", "op. pressure"],
    "Restraint Type": ["restraint type", "support type", "rest. type", "vg", "support code", "rest type"],
    "Restraint Stiffness": ["restraint stiffness", "stiffness", "spring k"],
    "Restraint Friction": ["restraint friction", "friction"],
    "Restraint Gap": ["restraint gap", "gap"],
    "Insulation thickness": ["insulation thickness", "insulation", "insul", "insul thickness", "insul thk", "it", "insulation (mm)"],
    "Hydro test pressure": ["hydro test pressure", "hydro", "hydro test", "test pressure", "hp", "hydro pressure"],
  },

  // 2. UNIT STRIPPING RULES
  unitStripping: {
    Bore: { suffixes: ["mm", "nb", "dn"], type: "number" },
    "O/D": { suffixes: ["mm"], type: "number" },
    "Wall Thickness": { suffixes: ["mm"], type: "number" },
    "Corrosion Allowance": { suffixes: ["mm"], type: "number" },
    Radius: { suffixes: ["mm"], type: "number" },
    Weight: { suffixes: ["kg", "kgs"], type: "number" },
    East: { suffixes: ["mm"], type: "number" },
    North: { suffixes: ["mm"], type: "number" },
    Up: { suffixes: ["mm"], type: "number" },
    Pressure: { suffixes: ["kpa", "bar", "psi"], type: "number" },
    "Insulation thickness": { suffixes: ["mm"], type: "number" },
    "Hydro test pressure": { suffixes: ["kpa", "bar"], type: "number" },
  },

  // 2b. PRESSURE RATING MAP: Keyword → Rating value
  pressureRatingMap: {
    "10000": 10000,
    "15000": 15000,
    "20000": 20000,
    "2500": 2500,
    "1500": 1500,
    "5000": 5000,
    "900": 900,
    "600": 600,
    "300": 300,
    "200*": 20000,
    "150*": 15000,
    "100*": 10000,
    "150": 150,
  },

  // 3. COMPONENT TYPE MAP: CSV Type → PCF keyword
  componentTypeMap: {
    BRAN: "PIPE", ELBO: "BEND", TEE: "TEE", FLAN: "FLANGE",
    VALV: "VALVE", OLET: "OLET", ANCI: "SUPPORT",
    REDC: "REDUCER-CONCENTRIC", REDE: "REDUCER-ECCENTRIC", REDU: "REDUCER-ECCENTRIC",
    GASK: "SKIP", PCOM: "SKIP",
    FBLI: "FLANGE",
    BEND: "BEND",
    BLIND: "FLANGE",
  },

  // 4. PCF SYNTAX RULES per component keyword
  pcfRules: {
    PIPE: {
      keyword: "PIPE", points: { EP1: "1", EP2: "2" },
      coordinateKeyword: "END-POINT", requiresSKEY: false,
      skeyStyle: "<SKEY>", defaultSKEY: null, centrePointTokens: 4,
      angleFormat: "degrees", caSlots: ["CA1", "CA2", "CA3", "CA4", "CA5", "CA7", "CA10"], extraFields: [],
    },
    BEND: {
      keyword: "BEND", points: { EP1: "1", EP2: "2", CP: "0" },
      coordinateKeyword: "END-POINT", requiresSKEY: true,
      skeyStyle: "<SKEY>", defaultSKEY: "BEBW", centrePointTokens: 4,
      angleFormat: "degrees", caSlots: ["CA1", "CA2", "CA3", "CA4", "CA5", "CA7", "CA10"], extraFields: ["ANGLE", "BEND-RADIUS"],
    },
    TEE: {
      keyword: "TEE", points: { EP1: "1", EP2: "2", CP: "0", BP: "3" },
      coordinateKeyword: "END-POINT", requiresSKEY: true,
      skeyStyle: "<SKEY>", defaultSKEY: "TEBW", centrePointTokens: 4,
      angleFormat: "degrees", caSlots: ["CA1", "CA2", "CA3", "CA4", "CA5", "CA7", "CA10"], extraFields: [],
    },
    FLANGE: {
      keyword: "FLANGE", points: { EP1: "1", EP2: "2" },
      coordinateKeyword: "END-POINT", requiresSKEY: true,
      skeyStyle: "<SKEY>", defaultSKEY: "FLWN", centrePointTokens: 4,
      angleFormat: "degrees", caSlots: ["CA1", "CA2", "CA3", "CA4", "CA5", "CA7", "CA8", "CA10"], extraFields: [],
    },
    VALVE: {
      keyword: "VALVE", points: { EP1: "1", EP2: "2" },
      coordinateKeyword: "END-POINT", requiresSKEY: true,
      skeyStyle: "<SKEY>", defaultSKEY: "VBFL", centrePointTokens: 4,
      angleFormat: "degrees", caSlots: ["CA1", "CA2", "CA3", "CA4", "CA5", "CA7", "CA8", "CA10"],
      itemDescSource: "componentName", extraFields: [],
    },
    OLET: {
      keyword: "OLET", points: { CP: "0", BP: "3" },
      coordinateKeyword: null, requiresSKEY: true,
      skeyStyle: "<SKEY>", defaultSKEY: "CEBW", centrePointTokens: 4,
      angleFormat: "degrees", caSlots: ["CA1", "CA2", "CA3", "CA4", "CA5", "CA7", "CA10"], extraFields: [],
    },
    "REDUCER-CONCENTRIC": {
      keyword: "REDUCER-CONCENTRIC", points: { EP1: "1", EP2: "2" },
      coordinateKeyword: "END-POINT", requiresSKEY: true,
      skeyStyle: "Skey", defaultSKEY: "RCBW", centrePointTokens: 4,
      angleFormat: "degrees", caSlots: ["CA1", "CA2", "CA3", "CA4", "CA5", "CA7", "CA10"], extraFields: [],
    },
    "REDUCER-ECCENTRIC": {
      keyword: "REDUCER-ECCENTRIC", points: { EP1: "1", EP2: "2" },
      coordinateKeyword: "END-POINT", requiresSKEY: true,
      skeyStyle: "Skey", defaultSKEY: "REBW", flatDirection: "DOWN", centrePointTokens: 4,
      angleFormat: "degrees", caSlots: ["CA1", "CA2", "CA3", "CA4", "CA5", "CA7", "CA10"], extraFields: ["FLAT-DIRECTION"],
    },
    SUPPORT: {
      keyword: "SUPPORT", points: { COORDS: "0" },
      coordinateKeyword: "CO-ORDS", requiresSKEY: false,
      skeyStyle: "<SKEY>", defaultSKEY: null, centrePointTokens: 4,
      angleFormat: "degrees", caSlots: [],
      supportNameField: "Restraint Type", supportGUIDField: "NodeName",
      extraFields: ["<SUPPORT_NAME>", "<SUPPORT_GUID>"],
    },
  },

  // 5. CA ATTRIBUTE DEFINITIONS
  caDefinitions: {
    CA1: { label: "Design Pressure", csvField: "Pressure", unit: "KPA", default: 700, writeOn: "all-except-support", zeroValue: null },
    CA2: { label: "Design Temp.", csvField: null, unit: "C", default: 120, writeOn: "all-except-support", zeroValue: null },
    CA3: { label: "Material", csvField: "Material", unit: null, default: "A106-B", writeOn: "all-except-support", zeroValue: null },
    CA4: { label: "Wall Thickness", csvField: "Wall Thickness", unit: "MM", default: 9.53, writeOn: "all-except-support", zeroValue: "Undefined MM" },
    CA5: { label: "Insulation Thk", csvField: "Insulation thickness", unit: "MM", default: 0, writeOn: "all-except-support", zeroValue: null },
    CA7: { label: "Corrosion Allow.", csvField: "Corrosion Allowance", unit: "MM", default: 3, writeOn: "all-except-support", zeroValue: "0 MM" },
    CA8: { label: "Component Weight", csvField: "Weight", unit: "KG", default: 100, writeOn: ["FLANGE", "VALVE"], zeroValue: null },
    CA10: { label: "Hydro Test Press.", csvField: "Hydro test pressure", unit: "KPA", default: 1500, writeOn: "all-except-support", zeroValue: null },
  },

  // 6. MESSAGE-SQUARE TEMPLATES
  msgTemplates: {
    PIPE: "PIPE, {material}, LENGTH={length}MM, {direction}",
    BEND: "BEND, {angle}DEG, RADIUS={radius}, {material}, {direction}",
    TEE: "TEE, {bore}X{branchBore}, {material}, {direction}",
    FLANGE: "FLANGE, {material}, LENGTH={length}MM, {direction}",
    VALVE: "VALV, {componentName}, {material}, LENGTH={length}MM, {direction}",
    OLET: "OLET, {bore}X{branchBore}, {material}",
    "REDUCER-CONCENTRIC": "REDUCER-CONCENTRIC, {bore}X{branchBore}, {material}",
    "REDUCER-ECCENTRIC": "REDUCER-ECCENTRIC, {bore}X{branchBore}, {material}, FLAT={flatDirection}",
    SUPPORT: "SUPPORT, {restraintType}, {nodeName}",
  },

  // 7. ANOMALY DETECTION RULES
  anomalyRules: {
    pressureChangeWithinHeader: { enabled: true, threshold: 0.05, severity: "WARNING", description: "Pressure changed >{threshold}% within same pipeline header" },
    temperatureChangeWithinHeader: { enabled: true, threshold: 5, severity: "INFO", description: "Temperature changed >{threshold}°C within same pipeline header" },
    wallVsBoreRatioAbnormal: { enabled: true, minRatio: 0.01, maxRatio: 0.25, severity: "INFO", description: "Wall/bore ratio outside normal range" },
    boreSizeChangeNoReducer: { enabled: true, severity: "WARNING", description: "Bore changes at non-TEE/REDUCER component" },
    branchBoreExceedsRun: { enabled: true, severity: "WARNING", description: "Branch bore exceeds run bore at TEE" },
    lineNoChangeNoProcessChange: { enabled: true, severity: "INFO", description: "RefNo prefix changed but design parameters unchanged" },
    zeroRadiusOnBend: { enabled: true, severity: "WARNING", description: "BEND has radius=0 — BEND-RADIUS will be missing" },
    insulationGapWithinHeader: { enabled: true, severity: "INFO", description: "Insulation thickness drops from non-zero to zero mid-header" },
  },

  // 8. COORDINATE SETTINGS
  coordinateSettings: {
    pipelineMode: "repair",
    multiPass: true,
    maxSegmentLength: 13100,
    continuityTolerance: 6.0,
    decimalPlaces: 4,
    axisMap: { E: "East", N: "North", U: "Up" },
    transform: { enabled: false, offsetE: 0, offsetN: 0, offsetU: 0, scaleE: 1, scaleN: 1, scaleU: 1 },
    overlapResolution: {
      enabled: true,
      boreTolerance: 1.0,
      minPipeLength: 10.0,
      gapFillEnabled: true,
    },
    common3DLogic: {
      enabled: true,
      maxPipeRun: 100000,
      skew3PlaneLimit: 2000,
      skew2PlaneLimit: 15000,
      minPipeSize: 0,
      minComponentSize: 3,
      maxOverlap: 1000,
      maxDiagonalGap: 6000,
    },
  },

  // 9. OUTPUT SETTINGS
  outputSettings: {
    pipelineReference: "PIPELINE-REF",
    projectIdentifier: "P1",
    area: "A1",
    lineEnding: "CRLF",
    fileEncoding: "UTF-8",
    includeMessageSquare: true,
    isogenFile: "ISOGEN.FLS",
    units: { bore: "MM", coords: "MM", weight: "KGS", boltDia: "MM", boltLength: "MM" },
  },

  // 10. INPUT SETTINGS
  inputSettings: {
    headerRowIndex: 0,
    autoDetectDelimiter: true,
    fallbackDelimiter: ",",
    previewRowCount: 30,
    streamingParse: false,
    streamingChunkSize: 500,
    sanitize: {
      trimWhitespace: true,
      stripBOM: true,
      normalizeUnicode: true,
      collapseSpaces: true,
      lowercaseHeaders: false,
    },
  },

  // 11. SMART DATA LOGIC (Linelist & Material Integration)
  smartData: {
    lineNoLogic: {
      strategy: "token", // 'token' | 'regex' | 'column_lookup'
      tokenDelimiter: "-",
      tokenIndex: 2,
      regexPattern: "([A-Z0-9]+-[0-9]+-[0-9]+[A-Z0-9]*)",
      regexGroup: 1,
      lookupColumn: "LineNo_Derived"
    },
    pipingClassLogic: {
      strategy: "token",
      tokenDelimiter: "-",
      tokenIndex: 3,
      regexPattern: "([0-9]+[A-Z]+[0-9]*)",
      regexGroup: 1
    },
    smartProcessKeywords: {
      Pressure: ["Design Pressure", "P1", "Press", "Design Pr.", "Op. Pressure", "Pressure"],
      Temperature: ["Design Temp", "T1", "Temp", "Design Temperature", "Temperature", "Temp."],
      InsulationThickness: ["Insulation Thickness", "Insul Thk", "Ins Thk", "Insulation"],
      HydroTestPressure: ["Hydro Test Pressure", "HP", "Hydro Pressure"],
      DensityGas: ["Gas Density", "Density Gas", "Gas"],
      DensityLiquid: ["Liquid Density", "Density Liquid", "Liquid", "Liq"],
      DensityMixed: ["Mixed Density", "Density Mixed", "Mixed"],
      Phase: ["Phase", "Fluid Phase", "State"]
    },
    densityLogic: {
      mixedPreference: "Liquid", // 'Liquid' | 'Mixed'
      defaultLiquid: 1000,
      defaultGas: 1.2
    }
  },
};
