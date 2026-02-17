export class Pfc_TopologyEngine {
  constructor(csvContent) {
    this.csvContent = csvContent;
    this.records = [];
    this.groups = [];
  }

  parse() {
    this.records = this.parseCSV(this.csvContent);
    this.groupRecords();
    return this.groups;
  }

  parseCSV(content) {
    const lines = content.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Simple split by comma, but handle quotes if necessary?
      // The sample file has quotes? "ZGPS..."
      // Yes. Row 1: 10,"ZGPS...","ZGPS...",BRAN...
      // So I need a proper CSV splitter.

      const row = [];
      let currentVal = '';
      let insideQuote = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          row.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      row.push(currentVal.trim());

      // Map to object
      const record = {};
      headers.forEach((h, idx) => {
        // Remove quotes from values if present
        let val = row[idx] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        record[h] = val;
      });
      data.push(record);
    }
    return data;
  }

  groupRecords() {
    let currentGroup = null;

    this.records.forEach((record, index) => {
      const refNo = record['RefNo'];
      const type = record['Type'];

      const parseCoord = (val) => {
        if (!val) return 0;
        return parseFloat(val.replace('mm', '').trim());
      };

      const x_csv = parseCoord(record['East']);
      const y_csv = parseCoord(record['North']);
      const z_csv = parseCoord(record['Up']);

      // PCF Mapping: X=North, Y=-East, Z=Up
      const pcf_x = y_csv;
      const pcf_y = -1 * x_csv;
      const pcf_z = z_csv;

      const node = {
        ...record,
        coords: { x: pcf_x, y: pcf_y, z: pcf_z },
        csv_coords: { x: x_csv, y: y_csv, z: z_csv },
        pointIdx: parseInt(record['Point'] || '0', 10),
        pPointIdx: parseInt(record['PPoint'] || '0', 10),
        bore: parseFloat((record['Bore'] || '0').replace('mm',''))
      };

      if (!currentGroup || currentGroup.refNo !== refNo) {
        if (currentGroup) this.groups.push(currentGroup);
        currentGroup = {
          refNo: refNo,
          type: type,
          rows: []
        };
      }
      currentGroup.rows.push(node);
    });
    if (currentGroup) this.groups.push(currentGroup);
  }
}
