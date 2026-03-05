import { test, expect } from 'playwright/test';

const BASE_URL = 'http://localhost:15173';
const API_URL = 'http://localhost:18000/api/v1';

test.describe('Skill Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/skills`);
    // Wait for table to load
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 10000 });
  });

  // Task 7.1: Test sorting functionality
  test('should sort skills by Name column', async ({ page }) => {
    // Get initial names
    const getNames = async () => {
      return page.locator('.ant-table-tbody tr td:first-child').allTextContents();
    };

    const initialNames = await getNames();
    expect(initialNames.length).toBeGreaterThan(0);

    // Click Name header to sort ascending
    await page.locator('th:has-text("Name")').click();
    await page.waitForTimeout(500);
    const ascNames = await getNames();
    const sortedAsc = [...ascNames].sort((a, b) => a.localeCompare(b));
    expect(ascNames).toEqual(sortedAsc);

    // Click again for descending
    await page.locator('th:has-text("Name")').click();
    await page.waitForTimeout(500);
    const descNames = await getNames();
    const sortedDesc = [...descNames].sort((a, b) => b.localeCompare(a));
    expect(descNames).toEqual(sortedDesc);
  });

  test('should sort skills by Type column', async ({ page }) => {
    await page.locator('th:has-text("Type")').click();
    await page.waitForTimeout(500);

    const types = await page.locator('.ant-table-tbody tr td:nth-child(2) .ant-tag').allTextContents();
    expect(types.length).toBeGreaterThan(0);
    const sorted = [...types].sort((a, b) => a.localeCompare(b));
    expect(types).toEqual(sorted);
  });

  test('should sort skills by Created At column', async ({ page }) => {
    await page.locator('th:has-text("Created At")').click();
    await page.waitForTimeout(500);

    const dates = await page.locator('.ant-table-tbody tr td:nth-child(4)').allTextContents();
    expect(dates.length).toBeGreaterThan(0);
    // Verify dates are in ascending order
    const timestamps = dates.map((d) => new Date(d).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  // Task 7.2: Test create skill flow
  test('should create a new skill successfully', async ({ page }) => {
    const skillName = `Test Skill ${Date.now()}`;

    // Click "New Skill" button
    await page.click('button:has-text("New Skill")');
    await page.waitForSelector('.ant-modal', { state: 'visible' });

    // Fill form
    await page.fill('input#name', skillName);
    await page.fill('textarea#description', 'A test skill created by Playwright');

    // Select type
    await page.click('#skill_type');
    await page.click('.ant-select-item-option[title="Web API"]');

    // Fill config schema
    await page.fill('textarea#config_schema', '{"type": "object"}');

    // Submit
    await page.click('.ant-modal .ant-btn-primary:has-text("Create")');

    // Wait for modal to close and success message
    await page.waitForSelector('.ant-modal', { state: 'hidden', timeout: 5000 });
    await expect(page.locator('.ant-message-success')).toBeVisible({ timeout: 5000 });

    // Verify the skill appears in the table
    await expect(page.locator(`.ant-table-tbody`)).toContainText(skillName);

    // Cleanup: delete the created skill
    const row = page.locator(`.ant-table-tbody tr:has-text("${skillName}")`);
    await row.locator('button:has-text("Delete")').click();
    await page.click('.ant-popconfirm .ant-btn-primary');
    await page.waitForTimeout(1000);
  });

  test('should reject invalid JSON in config_schema', async ({ page }) => {
    await page.click('button:has-text("New Skill")');
    await page.waitForSelector('.ant-modal', { state: 'visible' });

    await page.fill('input#name', 'Invalid JSON Skill');
    await page.click('#skill_type');
    await page.click('.ant-select-item-option[title="Web API"]');
    await page.fill('textarea#config_schema', '{invalid json}');

    // Try to submit
    await page.click('.ant-modal .ant-btn-primary:has-text("Create")');

    // Should show validation error
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('Invalid JSON');

    // Close modal
    await page.click('.ant-modal .ant-btn-default');
  });

  // Test default pagination
  test('should default to 10 items per page', async ({ page }) => {
    const rows = await page.locator('.ant-table-tbody tr.ant-table-row').count();
    expect(rows).toBeLessThanOrEqual(10);
    await expect(page.locator('.ant-pagination')).toContainText('10 / page');
  });

  // Test Name column click behavior
  test('should open Detail Modal when clicking built-in skill name', async ({ page }) => {
    const nameLink = page.locator('.ant-table-tbody tr.ant-table-row:first-child td:first-child a');
    await expect(nameLink).toBeVisible();
    await nameLink.click();
    await expect(page.locator('.ant-modal:has-text("Skill Details")')).toBeVisible({ timeout: 3000 });
  });

  // Task 7.3: Test delete built-in skill flow
  test('should delete a built-in skill with warning confirmation', async ({ page }) => {
    // Find a built-in skill row
    const builtinRow = page.locator('.ant-table-tbody tr:has(.ant-tag:has-text("builtin"))').first();
    await expect(builtinRow).toBeVisible();

    const skillName = await builtinRow.locator('td:first-child').textContent();

    // Click Delete on the built-in skill
    await builtinRow.locator('button:has-text("Delete")').click();

    // Verify the popconfirm has the built-in warning message
    const popconfirm = page.locator('.ant-popconfirm');
    await expect(popconfirm).toBeVisible();
    await expect(popconfirm).toContainText('built-in skill');
    await expect(popconfirm).toContainText('re-created on next application restart');

    // Confirm deletion
    await popconfirm.locator('.ant-btn-primary').click();

    // Wait for success message
    await expect(page.locator('.ant-message-success')).toBeVisible({ timeout: 5000 });

    // Verify the skill is removed from the table (or at least the success message appeared)
    await page.waitForTimeout(1000);

    // Note: the skill will reappear after restart since it's built-in
    console.log(`Deleted built-in skill: ${skillName}`);
  });

  test('should show different confirmation message for custom vs built-in skills', async ({ page }) => {
    // Check built-in skill delete message
    const builtinRow = page.locator('.ant-table-tbody tr:has(.ant-tag:has-text("builtin"))').first();
    await builtinRow.locator('button:has-text("Delete")').click();
    const builtinPopconfirm = page.locator('.ant-popconfirm');
    await expect(builtinPopconfirm).toContainText('built-in skill');
    // Cancel
    await builtinPopconfirm.locator('.ant-btn-default').click();
    await page.waitForTimeout(500);

    // Check custom skill delete message (if any exist)
    const customRow = page.locator('.ant-table-tbody tr:has(.ant-tag:has-text("web_api"))').first();
    const customExists = await customRow.isVisible().catch(() => false);

    if (customExists) {
      await customRow.locator('button:has-text("Delete")').click();
      const customPopconfirm = page.locator('.ant-popconfirm');
      await expect(customPopconfirm).toContainText('Are you sure');
      await customPopconfirm.locator('.ant-btn-default').click();
    }
  });
});
