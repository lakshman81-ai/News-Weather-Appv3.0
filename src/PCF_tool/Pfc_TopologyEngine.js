export const calculateDistance = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const areCoordinatesEqual = (p1, p2, tolerance = 0.1) => {
    return calculateDistance(p1, p2) < tolerance;
};

// Main Sequencer Function
export const processTopology = (parsedData) => {
    const components = [];
    const warnings = [];

    // 1. Identify Start Node
    // Default: Origin (0,0,0) if not specified, or First Row's previous point?
    // Based on sample: Row 1 is at 100. Previous is implicitly 0.
    let currentHead = { x: 0, y: 0, z: 0 };

    // Check if any row explicitly defines START
    const startRow = parsedData.find(d => d.rigidStatus === 'START');
    if (startRow) {
        // If specific start coordinates are meant to be the *beginning* of the pipeline,
        // we might need a distinct start point.
        // But here, 'Rigid: START' is on Row 1 (at 100).
        // This implies the segment ending at 100 is the start?
        // Or the point 100 IS the start?
        // PCF output shows PIPE from 0 to 100. So 0 is the start.
        // Let's assume (0,0,0) unless overridden.
    }

    // 2. Queue for Branch Processing (Backtracking)
    // Structure: { startPoint: {x,y,z}, parentIndex: number, pathName: string }
    const branchQueue = [];

    // We will process the parsedData array.
    // Since we need to "arrive at sequence", we can't just iterate.
    // We need to find the "Next Logical Component".

    const unvisited = parsedData.map((d, i) => ({ ...d, originalIndex: i }));
    let sequenceCounter = 1;

    // Helper to find nearest unvisited node from currentHead
    const findNext = (point, availableNodes) => {
        let best = null;
        let minD = Infinity;

        for (let i = 0; i < availableNodes.length; i++) {
            const node = availableNodes[i];
            const dist = calculateDistance(point, node);

            // Heuristic: Prefer "Forward" progression (matches previous vector?)
            // For now, simple proximity.
            // Tolerance: 0 means connected directly.

            if (dist < minD) {
                minD = dist;
                best = i;
            }
        }
        return { index: best, distance: minD };
    };

    while (unvisited.length > 0) {
        // Find next component from currentHead
        const { index, distance } = findNext(currentHead, unvisited);

        if (index === -1) break; // Should not happen

        const nextNode = unvisited[index];
        const dist = distance;

        // Logic:
        // If dist > 0: This component (or implicit pipe) connects currentHead to nextNode.
        // If dist == 0: This component is AT currentHead (e.g. Branch Start?).

        // Handle Continuity / Gap
        // If Distance is large and no component is defined to bridge it?
        // In PCF, "PIPE" fills the gap.
        // If the CSV row is "BRAN" (Branch/Pipe), it IS the pipe.
        // If the CSV row is "VALV", it has a length.
        // If Valv length (e.g. 500) == Distance (500), then Valv connects them.
        // If Valv length (500) < Distance (1000), then Gap(500) is Pipe, then Valv(500).

        // Check for Explicit Branching (TEE)
        if (nextNode.type === 'TEE') {
            // Tee is a special case. It defines a branch point.
            // We process it, then we might have two paths.
            // Path 1: Continue Main Line.
            // Path 2: Branch Line.
            // We push Path 2 to branchQueue.
            // How to know which is which?
            // Usually, "Bore" change indicates branch.
            // Or explicit "Branch" column? (CSV has 'PPoint' 'Point'?)

            // For this implementation, we treat TEE as a node.
            // We continue from TEE to nearest neighbor.
            // If multiple neighbors are close, we pick one and queue others?
            // "Continuity... finish header then move to one branch".
        }

        // Construct Component Object
        const component = {
            ...nextNode,
            sequence: sequenceCounter++,
            start: { ...currentHead },
            end: { x: nextNode.x, y: nextNode.y, z: nextNode.z },
            length: dist
        };

        components.push(component);

        // Update Head
        currentHead = component.end;

        // Remove from unvisited
        unvisited.splice(index, 1);

        // Detect if we hit a dead end (End of line)
        // If next nearest point is very far (discontinuity), we might be at end of branch.
        // Check if we need to jump back to a previous branch point?
        // This requires "Branch Queue" logic which needs explicit branch identification.
        // For the "Format CSV file.csv" sample, it's linear-ish with one Tee.
        // Let's implement a simple distance check jump.

        // If next nearest is > Threshold (e.g. 5000mm), and we have unvisited nodes,
        // search for unvisited nodes near ANY previous node (Backtracking).
        // This simulates "Finish header then move to branch".

        if (unvisited.length > 0) {
            const nextCheck = findNext(currentHead, unvisited);
            if (nextCheck.distance > 2000) { // Threshold for "Gap/Jump"
                // Try to find a better starting point from previous components (Branch points)
                let bestBacktrack = null;
                let minBacktrackDist = Infinity;
                let bestRestartNode = null;

                // Scan all processed components' END points as potential branch starts
                for (const comp of components) {
                    const check = findNext(comp.end, unvisited);
                    if (check.distance < minBacktrackDist) {
                        minBacktrackDist = check.distance;
                        bestBacktrack = check.index;
                        bestRestartNode = comp.end;
                    }
                }

                if (bestBacktrack !== null && minBacktrackDist < 2000) {
                    // Found a branch point!
                    // Reset currentHead to that branch point
                    currentHead = bestRestartNode;
                    // Proceed loop (will pick up the branch leg next iteration)
                    warnings.push(`Detected branch/jump. Restarting from sequence ${components.find(c => c.end === bestRestartNode)?.sequence}`);
                }
            }
        }
    }

    return { components, warnings };
};
