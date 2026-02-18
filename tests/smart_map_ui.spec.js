import { test, expect } from '@playwright/test';

test('Smart Map UI Render Verification', async ({ page }) => {
  // Go to app
  await page.goto('http://localhost:5173/');

  // Click Master Data tab
  await page.locator('#tab-master-data').click();

  // In Master Data, ensure "Linelist Manager" sub-tab is active (default).
  await expect(page.locator('#linelist')).toBeVisible();

  // Upload file
  const fileInput = page.locator('#linelist-upload');
  // Use a real file from the repo. ImportedRawLineListLL.xlsx is a good candidate.
  await fileInput.setInputFiles('Docs/ImportedRawLineListLL.xlsx');

  // Wait for processing (status text changes from "Parsing..." to "Loaded...")
  // The status element is #linelist-status inside #linelist-status-bar
  const statusEl = page.locator('#linelist-status');
  await expect(statusEl).toBeVisible();
  await expect(statusEl).toContainText('Loaded', { timeout: 15000 });

  // Verify Key Mapping Section appears
  await expect(page.locator('#linelist-mapping-section')).toBeVisible();

  // Verify Key Mapping dropdowns exist
  // We expect "Line Number" and "Service" keys from default config
  await expect(page.locator('#linelist-mapping-ui')).toContainText('lineNo');
  await expect(page.locator('#linelist-mapping-ui')).toContainText('service');

  // Verify Smart Process Map Section appears
  await expect(page.locator('#linelist-attr-section')).toBeVisible();

  // Verify specific elements inside Smart Map
  await expect(page.getByText('ATTRIBUTE1 (P1)')).toBeVisible();
  await expect(page.getByText('ATTRIBUTE9 (Density - Mixed)')).toBeVisible();

  // Verify Toggle
  await expect(page.locator('#toggle-density-pref')).toBeVisible();
  await expect(page.getByText('Use Liquid/Mixed:')).toBeVisible();

  // Verify default state (Liquid)
  await expect(page.locator('#density-pref-lbl')).toContainText('Liquid');

  // Click toggle
  await page.locator('#toggle-density-pref').click();
  await expect(page.locator('#density-pref-lbl')).toContainText('Mixed');
});
