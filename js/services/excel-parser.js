import * as XLSX from 'xlsx';
import { gate } from "./gate-logger.js";

/**
 * Robust Excel Parser for Linelist, Weights, and LineDump.
 * Enhanced with smart header detection (Weighted Scoring + Longest Match).
 */
export class ExcelParser {

  /**
   * Reads an Excel file and returns JSON data with smart header detection.
   * @param {File} file - The uploaded file.
   * @param {Array} expectedKeywords - Keywords to score rows for header detection (e.g. ['Line', 'Service']).
   * @returns {Promise<{headers: string[], data: any[], detectedRow: number}>}
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
            keywords: expectedKeywords.slice(0, 5), // Log first 5 keywords
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
   * Uses weighted scoring: Exact Match (+10) > Partial Match (+1).
   * Prioritizes longest keyword matches to avoid false positives (e.g. "Pressure" in "Design Pressure").
   */
  static detectHeaderRow(rows, keywords) {
    if (!keywords || keywords.length === 0) return 0; // Default to first row

    let bestScore = -1;
    let bestRow = 0;

    // Sort keywords by length descending to prioritize specific matches
    // e.g. "Design Pressure" before "Pressure"
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);

    // Scan first 20 rows
    const limit = Math.min(rows.length, 20);

    for (let i = 0; i < limit; i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      let score = 0;

      // Check each cell in the row
      row.forEach(cell => {
        if (!cell) return;
        const cellStr = String(cell).trim();
        const cellLower = cellStr.toLowerCase();

        // Check against keywords
        for (const kw of sortedKeywords) {
            const kwLower = kw.toLowerCase();

            if (cellLower === kwLower) {
                score += 10; // Huge bonus for exact match
                break; // Stop checking other keywords for this cell
            } else if (cellLower.includes(kwLower)) {
                score += 1; // Minor bonus for partial match
                break; // Stop checking other keywords for this cell
            }
        }
      });

      // Density check: Ratio of non-empty cells
      const nonEmptyCount = row.filter(c => c !== null && c !== undefined && c !== '').length;
      const density = nonEmptyCount / row.length;
      const finalScore = score + (density * 0.5); // Density is tie-breaker

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
