import { test, expect } from '@playwright/test';
import path from 'path';

test('Audit functionality', async ({ page }) => {
  // Check for console errors
  page.on('console', msg => {
      console.log(`CONSOLE [${msg.type()}]: "${msg.text()}"`);
  });

  // 1. Load App
  await page.goto('http://localhost:5173');
  await expect(page).toHaveTitle(/PCF Converter/);
  console.log('App loaded');

  // 2. Upload CSV
  const fileInput = page.locator('#file-input');
  await fileInput.setInputFiles('Docs/Format CSV file.csv');
  console.log('File uploaded');

  // Wait for parsing
  await expect(page.locator('#preview-wrap')).toBeVisible();
  console.log('Preview visible');

  // 3. Go to Mapping Tab
  await page.click('#tab-mapping');
  await expect(page.locator('#panel-mapping')).toBeVisible();
  console.log('Mapping tab visible');

  // 4. Convert
  await page.click('#btn-convert');
  await expect(page.locator('#mapping-convert-msg')).toContainText('PCF ready');
  console.log('Conversion complete');

  // 5. Go to Validate Tab
  await page.click('#tab-validate');
  await expect(page.locator('#panel-validate')).toBeVisible();

  // 6. Run Validation
  const runBtn = page.locator('#btn-run-validation');
  await expect(runBtn).toBeVisible();
  await runBtn.click();
  console.log('Validation run');

  // Wait for results: Either issue list becomes visible, OR empty message changes to success
  const issueList = page.locator('#issue-list');
  const successMsg = page.locator('#validate-empty').filter({ hasText: 'No issues found' });

  // Use a race condition check - wait for one of them to be visible
  // Note: issueList is initially hidden. successMsg is initially not matching (text differs).
  await expect(issueList.or(successMsg)).toBeVisible();

  if (await issueList.isVisible()) {
      const issues = await issueList.locator('.issue-item').count();
      console.log(`Found ${issues} issues`);
  } else {
      console.log('No issues found - Validation Passed');
  }

  // Capture screenshot of Validation Tab
  await page.screenshot({ path: 'audit_validation.png', fullPage: true });

  // 7. Check Config Toggles
  await page.click('#tab-config');

  // Open Coordinate Settings section
  const coordHeader = page.locator('.config-section-header').filter({ hasText: 'Coordinate Settings' });
  await coordHeader.click();

  const toggle = page.locator('#cfg-msgSquare');

  // Initial state check
  await expect(page.locator('#cfg-msgSquare-lbl')).toContainText('Enabled');

  await toggle.click();
  await expect(page.locator('#cfg-msgSquare-lbl')).toHaveText('Disabled');

  await toggle.click();
  await expect(page.locator('#cfg-msgSquare-lbl')).toHaveText('Enabled');
  console.log('Config toggles working');

  // 8. Go to Output Tab
  await page.click('#tab-output');
  await page.click('#btn-generate');
  await expect(page.locator('#btn-download-pcf')).toBeEnabled();
  console.log('Output generated');

  // Capture screenshot of Output Tab
  await page.screenshot({ path: 'audit_output.png', fullPage: true });
});
