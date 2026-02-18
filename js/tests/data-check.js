
// ── Mock Browser Globals for Node.js ──
if (typeof global !== 'undefined') {
    global.localStorage = { getItem: () => null, setItem: () => { }, clear: () => { } };
    global.window = global;
    global.performance = { now: () => Date.now() };
    global.document = {
        getElementById: () => null,
        createElement: () => ({ style: {}, classList: { add: () => { }, remove: () => { }, toggle: () => { } } })
    };
}

import { MappingEngine } from '../services/mapping-engine.js';
import { detectRating } from '../services/rating-detector.js';

console.log('═══════════════════════════════════════════');
console.log('  DATA INTEGRITY VERIFICATION');
console.log('═══════════════════════════════════════════');

// ── 1. Range Handling Tests ──────────────────────────────────────
console.log('\n1. RANGE HANDLING (normalizeNumeric):');
const rangeTests = [
    { input: "50", expected: "50", desc: "Simple number" },
    { input: "50.00", expected: "50", desc: "Trailing zeros" },
    { input: "50-60", expected: "60", desc: "Positive range → max" },
    { input: "10-20", expected: "20", desc: "Small positive range → max" },
    { input: "-60--50", expected: "-60", desc: "All-negative range → min (most extreme)" },
    { input: "-10-5", expected: "5", desc: "Mixed range (neg to pos) → max" },
    { input: "150#", expected: "150", desc: "Number with suffix" },
    { input: "150# RF", expected: "150", desc: "Number with text suffix" },
    { input: "XS", expected: "XS", desc: "Non-numeric string" },
    { input: "Sch 40", expected: "Sch 40", desc: "Schedule string" },
];

let passed = 0, failed = 0;
rangeTests.forEach(({ input, expected, desc }) => {
    const result = MappingEngine.normalizeNumeric(input);
    const ok = result === expected;
    if (ok) passed++; else failed++;
    console.log(`  ${ok ? '✓' : '✗'} [${desc}] "${input}" → "${result}" ${ok ? '' : `(expected "${expected}")`}`);
});

// ── 2. Pressure Rating Tests ─────────────────────────────────────
console.log('\n2. PRESSURE RATING (detectRating):');
const ratingTests = [
    { input: "150LB", expected: 150, desc: "150LB" },
    { input: "300#", expected: 300, desc: "300#" },
    { input: "A1-150", expected: 150, desc: "Class with 150" },
    { input: "1500LB", expected: 1500, desc: "1500LB (should NOT return 150)" },
    { input: "2500", expected: 2500, desc: "2500 (should NOT return 150)" },
    { input: "100*", expected: 10000, desc: "100* → 10000 (API)" },
    { input: "150*", expected: 15000, desc: "150* → 15000 (API)" },
    { input: "200*", expected: 20000, desc: "200* → 20000 (API)" },
    { input: "600", expected: 600, desc: "600" },
    { input: "900", expected: 900, desc: "900" },
    { input: "5000", expected: 5000, desc: "5000 (API)" },
    { input: "UNKNOWN", expected: null, desc: "Unknown → null" },
];

ratingTests.forEach(({ input, expected, desc }) => {
    const result = detectRating(input);
    const ok = result === expected;
    if (ok) passed++; else failed++;
    console.log(`  ${ok ? '✓' : '✗'} [${desc}] "${input}" → ${result} ${ok ? '' : `(expected ${expected})`}`);
});

// ── Summary ──────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
