// PCF Generator

const formatCoord = (val) => {
    // Format to 1 decimal place, padded?
    // Sample: -00100.0
    // Let's just use .1f for now.
    return val.toFixed(1);
};

const formatPoint = (p) => {
    // PCF format: X Y Z Bore?
    // Sample: -00100.0 00000.0 00000.0 400.0
    // We need Bore from the component.
    return `${formatCoord(p.x)} ${formatCoord(p.y)} ${formatCoord(p.z)}`;
};

const getMaterial = (comp, config) => comp.material || config.options.defaultMaterial || 'A106-B';

export const generatePCF = (components, config) => {
    let output = "";

    // Header
    output += `ISOGEN-FILES ISOGEN.FLS\n`;
    output += `UNITS-BORE ${config.units.bore}\n`;
    output += `UNITS-CO-ORDS ${config.units.coords}\n`;
    output += `UNITS-WEIGHT ${config.units.weight}\n`;
    output += `PIPELINE-REFERENCE NEWLINE NO.\n\n`;

    components.forEach(comp => {
        // Prepare Metadata
        const length = comp.length;
        const mat = getMaterial(comp, config);

        output += `MESSAGE-SQUARE\n`;
        output += `    ${comp.pcfType}, ${mat}, LENGTH=${length}${config.units.coords}, NORTH\n`;
        output += `${comp.pcfType}\n`;

        // Endpoints
        // Note: PCF expects Endpoints.
        // Logic: Start Point -> End Point.
        // Sample CSV North -> PCF X (inverted).
        // We assume the parser/topology engine handled coordinate transformation?
        // Let's assume parsed x,y,z are ready to write.

        const bore = comp.bore || 0;

        output += `    END-POINT  ${formatPoint(comp.start)} ${bore}\n`;
        output += `    END-POINT  ${formatPoint(comp.end)} ${bore}\n`;

        // Special Component Handling
        if (comp.pcfType === 'TEE') {
            // Need Centre and Branch Points
            // Estimate Centre as Midpoint? Or End?
            // CSV Row 5 TEE at 1700 (End). Start 1300. Length 400.
            // PCF Centre -1500. Midpoint.
            const cx = (comp.start.x + comp.end.x) / 2;
            const cy = (comp.start.y + comp.end.y) / 2;
            const cz = (comp.start.z + comp.end.z) / 2;
            output += `    CENTRE-POINT  ${formatCoord(cx)} ${formatCoord(cy)} ${formatCoord(cz)} ${bore}\n`;

            // Branch Point
            // If CSV had 'Up' column, we use it for Z branch?
            // Row 5 has Up=500? No, Row 5 Up is 500 in CSV (for BRAN?).
            // Let's assume the component has a 'branchVector' or similar from parser?
            // Parser mapped 'coordU' (Up) to 'z'.
            // If Row 5 TEE has Z=500?
            // The Topology Engine treats Z as part of the node coordinate.
            // If the TEE node is (1700, 0, 500), then End is at Z=500.
            // But main run is usually straight.
            // We need to know the *Branch* direction.
            // Default to Up (Z+) for now if TEE.
            output += `    BRANCH1-POINT  ${formatCoord(cx)} ${formatCoord(cy)} ${formatCoord(cz + (comp.od || 100))} ${bore}\n`;
            output += `    <SKEY> TEBW\n`;
        }

        if (comp.pcfType === 'BEND' || comp.pcfType === 'ELBOW') {
             // Centre Point (Intersection of tangents)
             // Simplified: End Point is fine for BEND?
             // PCF sample has CENTRE-POINT for BEND.
             output += `    CENTRE-POINT  ${formatPoint(comp.end)} ${bore}\n`; // Approximation
             output += `    <SKEY> BEBW\n`;
             output += `    ANGLE 90\n`;
             output += `    BEND-RADIUS ${comp.radius || (comp.od * 1.5)}\n`;
        }

        // Attributes
        if (comp.pressure) output += `    COMPONENT-ATTRIBUTE1  ${comp.pressure} KPA\n`;
        // if (comp.temperature) output += `    COMPONENT-ATTRIBUTE2  ${comp.temperature} C\n`;
        output += `    COMPONENT-ATTRIBUTE3  ${mat}\n`;
        if (comp.wallThickness) output += `    COMPONENT-ATTRIBUTE4  ${comp.wallThickness} MM\n`;

        // CA8: Weight (Specific for Flange/Valve)
        if ((comp.pcfType === 'FLANGE' || comp.pcfType === 'VALVE') && comp.weight) {
            output += `    COMPONENT-ATTRIBUTE8  ${comp.weight} KG\n`;
        }

        output += `    COMPONENT-ATTRIBUTE10  1500 KPA\n`; // Hydro test default?

        output += `\n`;
    });

    return output;
};
