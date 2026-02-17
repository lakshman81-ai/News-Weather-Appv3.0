import fs from 'fs';
import { Pfc_TopologyEngine } from '../src/PCF_tool/Pfc_TopologyEngine.js';
import { Pfc_PcfGenerator } from '../src/PCF_tool/Pfc_PcfGenerator.js';

const csvPath = process.argv[2] || 'input.csv';
const outputPath = process.argv[3] || 'output.pcf';

try {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const engine = new Pfc_TopologyEngine(csvContent);
  const groups = engine.parse();

  console.log(`Parsed ${groups.length} groups.`);

  const generator = new Pfc_PcfGenerator(groups);
  const pcfContent = generator.generate();

  fs.writeFileSync(outputPath, pcfContent);
  console.log(`Generated PCF at ${outputPath}`);

} catch (err) {
  console.error('Error:', err);
}
