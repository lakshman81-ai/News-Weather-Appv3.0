/**
 * pcf-writer.js — Apply line endings and trigger browser download
 * Converts PCF lines array to CRLF-terminated string and creates Blob.
 *
 * Exports:
 *   toPCFString(lines, config)      → string  (CRLF or LF terminated)
 *   downloadPCF(lines, filename, config)
 */

import { info, error } from '../logger.js';

const MOD = 'pcf-writer';

/**
 * Join PCF lines with configured line ending.
 * @param {string[]} lines
 * @param {object}   config
 * @returns {string}
 */
export const toPCFString = (lines, config) => {
  const le = config?.outputSettings?.lineEnding === 'LF' ? '\n' : '\r\n';
  return lines.join(le) + le;
};

/**
 * Trigger browser file download for the PCF output.
 * @param {string[]} lines
 * @param {string}   filename   - e.g. "output.pcf"
 * @param {object}   config
 */
export const downloadPCF = (lines, filename, config) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    error(MOD, 'downloadPCF', 'No PCF lines to download', {
      hint: 'Run conversion before attempting download',
    });
    return;
  }

  const content = toPCFString(lines, config);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');

  a.href     = url;
  a.download = filename || 'output.pcf';
  a.style.display = 'none';
  document.body.appendChild(a);

  try {
    a.click();
    info(MOD, 'downloadPCF', 'Download triggered', {
      filename: a.download, sizeBytes: blob.size, lineCount: lines.length,
    });
  } catch (e) {
    error(MOD, 'downloadPCF', 'Download click failed', {
      errorMsg: e.message, filename,
    });
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 1000);
  }
};
