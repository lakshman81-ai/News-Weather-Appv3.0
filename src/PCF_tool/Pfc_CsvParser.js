export const cleanUnit = (value, unit = 'mm') => {
    if (!value) return null;
    if (typeof value === 'number') return value;
    const str = value.toString().toLowerCase();
    const num = parseFloat(str.replace(unit.toLowerCase(), '').trim());
    return isNaN(num) ? null : num;
};

export const parseCSV = (csvText, config) => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return { error: 'Empty or invalid CSV file' };

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    // Create a reverse mapping for faster lookup (Internal Key -> CSV Header Index)
    const headerMap = {};
    for (const [csvKey, internalKey] of Object.entries(config.headerMap)) {
        const index = headers.findIndex(h => h.toLowerCase() === csvKey.toLowerCase());
        if (index !== -1) {
            headerMap[internalKey] = index;
        }
    }

    // Validate essential columns
    const essentialKeys = ['type', 'coordN', 'coordE', 'coordU']; // Minimum required for geometry
    const missingKeys = essentialKeys.filter(key => headerMap[key] === undefined);

    // Note: If coordinates are missing, maybe they use Point/PPoint? But let's assume coordinates for now based on prompt.
    // If 'coordN' is missing, maybe it's called 'North' (which should be in config).
    // Let's proceed even if some are missing, but warn.

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.trim());
        if (row.length < headers.length) continue; // Skip malformed rows

        const item = {
            id: i, // Row Index
            originalRow: i + 1,
            type: row[headerMap.type] || 'UNKNOWN',
            bore: cleanUnit(row[headerMap.bore]),
            od: parseFloat(row[headerMap.od]) || 0,
            wallThickness: parseFloat(row[headerMap.wallThickness]) || 0,
            material: row[headerMap.material] || config.options.defaultMaterial,
            weight: parseFloat(row[headerMap.weight]) || 0,
            pressure: row[headerMap.pressure],

            // Coordinates (Default to 0 if missing/NaN)
            x: parseFloat(row[headerMap.coordE]) || 0, // East
            y: parseFloat(row[headerMap.coordN]) || 0, // North
            z: parseFloat(row[headerMap.coordU]) || 0, // Up

            // Connection logic (Start/End points)
            rigidStatus: row[headerMap.rigidStatus] || '',

            // Raw data for pass-through
            raw: row
        };

        // Normalize Type using config map
        const mappedType = config.typeMap[item.type] || item.type;
        item.pcfType = mappedType;

        data.push(item);
    }

    return { data, headers, missingKeys };
};
