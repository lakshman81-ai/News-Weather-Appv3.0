import { test, expect } from '@playwright/test';

test('PCF Table View Logic', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // 1. Upload LineList
  await page.locator('#tab-master-data').click();
  await page.locator('#linelist-upload').setInputFiles('Docs/ImportedRawLineListLL.xlsx');
  await expect(page.locator('#linelist-status')).toContainText('Loaded', { timeout: 10000 });

  // 2. Upload CSV Input
  await page.locator('#tab-input').click();
  await page.locator('#file-input').setInputFiles('Docs/Format CSV file.csv');
  await expect(page.locator('#preview-table')).toBeVisible();

  // 3. Go to Mapping and Convert
  await page.locator('#tab-mapping').click();
  const convertBtn = page.locator('#btn-convert');
  await expect(convertBtn).toBeEnabled();
  await convertBtn.click();
  await expect(page.locator('#mapping-convert-msg')).toContainText('PCF ready');

  // 4. Check if "PCF Table" tab button appeared
  const tableTabBtn = page.locator('#tab-table-view');
  await expect(tableTabBtn).toBeVisible();

  // 5. Go to PCF Table
  await tableTabBtn.click();

  // 6. Verify Table Content
  // Should have headers including new columns
  await expect(page.locator('#pcf-table-container th').getByText('Piping Class')).toBeVisible();
  await expect(page.locator('#pcf-table-container th').getByText('Rigid Type')).toBeVisible();
  await expect(page.locator('#pcf-table-container th').getByText('Weight (KG)')).toBeVisible();

  // 7. Verify Row Data
  // Just check if any data row exists
  await expect(page.locator('#pcf-table-container tbody tr').first()).toBeVisible();
});
