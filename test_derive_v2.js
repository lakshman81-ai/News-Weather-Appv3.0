
function deriveLineNo(pipeStr, method = 'regex', segmentPos = 3) {
    if (!pipeStr) return '';
    const str = String(pipeStr).trim();

    if (method === 'segment') {
        const parts = str.split(/[-/"]/);
        if (parts.length >= segmentPos) {
            return parts[segmentPos - 1].trim().toUpperCase();
        }
        return '';
    }

    // Default: Regex (Primary logic for P0511260)
    const match = str.match(/[A-Z]\d{5,}/i);
    if (match) {
        return match[0].toUpperCase();
    } else {
        // Fallback split logic
        const parts = str.split(/[-/"]/);
        for (const part of parts) {
            const clean = part.trim();
            if (clean.length >= 6 && /[A-Z]/i.test(clean) && /\d/.test(clean)) {
                return clean.toUpperCase();
            }
        }
    }
    return '';
}

const testCases = [
    { input: 'FCSEE-16"-P0511260-11440A1-01', expected: 'P0511260', method: 'regex' },
    { input: 'FCSEE-8"-P0511261-11440A1-01', expected: 'P0511261', method: 'regex' },
    { input: 'ABCD-P12345-EFG', expected: 'P12345', method: 'regex' },
    { input: 'LINE-NUMBER-123456', expected: '123456', method: 'regex' }, // Fallback logic
    { input: 'L123456', expected: 'L123456', method: 'regex' },
    { input: 'PLAIN-123', expected: '', method: 'regex' },

    // Segment Logic Tests
    { input: 'FCSEE-16"-P0511260-11440A1-01', expected: 'P0511260', method: 'segment', pos: 3 },
    { input: 'A-B-C-D', expected: 'C', method: 'segment', pos: 3 },
    { input: 'A/B/C/D', expected: 'B', method: 'segment', pos: 2 }
];

console.log('--- Configurable Line No Derivation Tests ---');
testCases.forEach(tc => {
    const actual = deriveLineNo(tc.input, tc.method, tc.pos);
    const methodInfo = tc.method === 'segment' ? `[Segment:${tc.pos}]` : '[Regex]';
    const status = actual === tc.expected ? '✅ PASS' : '❌ FAIL';
    console.log(`${methodInfo.padEnd(12)} Input: ${tc.input.substring(0, 25).padEnd(25)} | Exp: ${tc.expected.padEnd(8)} | Act: ${actual.padEnd(8)} | ${status}`);
});
