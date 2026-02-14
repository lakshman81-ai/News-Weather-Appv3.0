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

    // Initialize state
    // We will iterate through parsedData in order (index 0, 1, 2...)
    // This strictly respects the "Retain sequence as per CSV top to bottom" requirement.

    // Default Start Point is (0,0,0) unless overridden by logic
    let currentHead = { x: 0, y: 0, z: 0 };

    // Map of visited coordinates to detect branch points
    // Key: "x,y,z" string, Value: Component/Node info
    const visitedPoints = new Map();

    // Check for explicit start in first row
    if (parsedData.length > 0 && parsedData[0].rigidStatus === 'START') {
        // If the first component is marked START, does it mean it *starts* at a specific coordinate?
        // Typically PCF defines components by End Points.
        // If Row 1 is a Pipe at 100,0,0... it goes from 0 to 100.
        // We stick with (0,0,0) as implicit start unless user provides a "StartPoint" row.
    }

    let sequenceCounter = 1;

    for (let i = 0; i < parsedData.length; i++) {
        const item = parsedData[i];

        // Calculate connectivity from currentHead
        const dist = calculateDistance(currentHead, item);

        let startPoint = { ...currentHead };
        let endPoint = { x: item.x, y: item.y, z: item.z };
        let connectionType = 'CONTINUOUS';

        // Continuity & Branch Logic
        if (dist > 0.1) {
            // There is a distance between CurrentHead and This Item's Coord.

            // Case A: This item *IS* the connecting piece (e.g. Pipe, or Valve with length)
            // If the item has a physical length that matches 'dist', it bridges the gap.
            // Note: We don't have explicit 'length' column usually, we deduce it from coordinates.
            // So we assume the component *goes* from currentHead to item.x,y,z.

            // Case B: Discontinuity / Jump (Branch Start)
            // If this item is far away, and might be starting a new branch from an *existing* point.
            // Check if item.x,y,z is close to any *previously visited* point?
            // No, usually a branch starts FROM a known point TO a new point.
            // So we check if `currentHead` is the wrong start point.

            // Heuristic: If distance is large (e.g. > 10 meters?) and there's a better start point?
            // Or maybe the user *wants* implicit pipes.
            // However, "Retain sequence" implies we process Row N.
            // If Row N is a Branch starting from Row M (where M < N),
            // then `currentHead` (which is at Row N-1) is wrong.
            // We should search if `startPoint` should be snapped to a previous node.

            // But wait, the component defines its END point (East, North, Up).
            // It does NOT define its Start Point explicitly.
            // So we must infer the Start Point.

            // Check if we need to jump back to a previous node to make a logical connection?
            // Only if the distance from currentHead is "unreasonably" large compared to distance from another node?
            // Or if explicit logic (like TEE previously) suggested a branch.

            // Let's look for a better start point if distance is > 2000mm (heuristic threshold)
            if (dist > 2000) {
                let bestNode = null;
                let minNodeDist = Infinity;

                // Search all previously visited endpoints
                visitedPoints.forEach((info, key) => {
                    const d = calculateDistance({x:info.x, y:info.y, z:info.z}, endPoint);
                    // This checks if the *End Point* is close to a previous node.
                    // That would mean we are looping back? Unlikely.

                    // We want to know if the *Start* of this component is a previous node.
                    // But we don't know the Start! We only know the End (item.x,y,z).
                    // If this component is a PIPE, it has length.

                    // Maybe we check if the component is physically close to a previous point?
                    // If `dist` is huge, maybe this is a disjoint pipeline?
                    // Or maybe we should just snap `currentHead` to the nearest previous node *before* drawing this component?

                    // Let's check distance from *all previous nodes* to *this component's End Point*.
                    // If we find a node that is "closer" than currentHead, maybe we branched?
                    // But length is variable.

                    // Actually, usually a Branch starts AT a previous node.
                    // So we look for a previous node that makes this component "reasonable".
                    // But "reasonable" is subjective without defined lengths.

                    // Let's assume strict Top-Down unless there's a specific "Branch" marker in data?
                    // The prompt said "Identify Pipe header, branch, subbranch".
                    // If we stick to CSV order, we might draw a long pipe from the end of the header to the start of the branch.

                    // Strategy:
                    // If dist > 2000, check if we can snap `currentHead` to a known previous point
                    // such that the new component is valid.
                    // But we don't know the intended length.

                    // Simplified: Just detect Jumps.
                    // If dist > 0, we treat it as a segment.
                    // If it's a huge jump, we log a warning but keep it (Implicit Pipe).
                    // Users can clean up CSV if they want gaps closed.
                });

                // Logic update for TEE branches (commonly requested):
                // If a previous component was a TEE, and we are now jumping,
                // check if we are near the TEE's coordinate?
                // The TEE center/branch point is the likely start.

                // Let's find the *nearest* previous point to this component's End Point?
                // No, that implies zero length.

                // Let's just stick to "CurrentHead -> Item".
                // If the user wants to jump, they might provide a gap.
            }
        } else {
            // Distance ~ 0. Items are at the same location.
            // e.g. Flange at end of Pipe.
            // Start = End = Item.Coord.
            // Length = 0.
        }

        const component = {
            ...item,
            sequence: sequenceCounter++,
            start: startPoint,
            end: endPoint,
            length: dist
        };

        components.push(component);

        // Update state
        currentHead = endPoint;
        visitedPoints.set(`${endPoint.x},${endPoint.y},${endPoint.z}`, endPoint);
    }

    return { components, warnings };
};
