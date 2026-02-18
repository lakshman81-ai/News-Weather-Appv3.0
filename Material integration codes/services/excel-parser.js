import * as XLSX from 'xlsx';
import { gate } from "./gate-logger.js";

/**
 * Robust Excel Parser for Linelist, Weights, and LineDump.
 * Enhanced with smart header detection.
 *
 * NOTE: The original basic ExcelParserService is preserved in
 *       backup/2026-02-15_2047/excel-parser.js
 */
export class ExcelParser {

  /**
   * Reads an Excel file and returns JSON data with smart header detection.
   * @param {File} file - The uploaded file.
   * @param {Array} expectedKeywords - Keywords to score rows for header detection (e.g. ['Line', 'Service']).
   * @returns {Promise<{headers: string[], data: any[]}>}
   */
  static async parse(file, expectedKeywords = []) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

          // Smart Header Detection
          const headerRowIndex = this.detectHeaderRow(rawData, expectedKeywords);
          const headers = rawData[headerRowIndex].map((h, idx) => (h ? h.toString().trim() : `Column(${idx + 1})`));

          gate('ExcelParser', 'parse', 'Header Row Detected', {
            filename: file.name,
            detectedRow: headerRowIndex,
            headerCount: headers.length,
            keywords: expectedKeywords,
            sampleHeaders: headers.slice(0, 5)
          });

          // Slice data from row after header
          const dataRows = rawData.slice(headerRowIndex + 1);
          const jsonData = dataRows.map(row => {
            const obj = {};
            headers.forEach((h, i) => {
              obj[h] = row[i];
            });
            return obj;
          });

          resolve({ headers, data: jsonData, detectedRow: headerRowIndex });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  }

  /**
   * Scans first 20 rows to find the most likely header row.
   */
  static detectHeaderRow(rows, keywords) {
    if (!keywords || keywords.length === 0) return 0; // Default to first row

    let bestScore = -1;
    let bestRow = 0;

    // Scan first 20 rows
    const limit = Math.min(rows.length, 20);

    for (let i = 0; i < limit; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      let score = 0;
      const rowStr = row.join(' ').toLowerCase();

      keywords.forEach(kw => {
        if (rowStr.includes(kw.toLowerCase())) score += 1;
      });

      // Density check: Ratio of non-empty cells
      const density = row.filter(c => c).length / row.length;
      const finalScore = score + (density * 0.5); // Weight keyword match higher

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestRow = i;
      }
    }
    return bestRow;
  }
}

/**
 * Legacy-compatible wrapper — keeps the same API for any code
 * that still uses `excelParser.parseExcelFile(file)`.
 */
export class ExcelParserService {
  async parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          if (workbook.SheetNames.length === 0) {
            reject(new Error("Excel file contains no sheets."));
            return;
          }
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          resolve(jsonData);
        } catch (err) {
          reject(new Error("Failed to parse Excel file: " + err.message));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsArrayBuffer(file);
    });
  }
}

export const excelParser = new ExcelParserService();
