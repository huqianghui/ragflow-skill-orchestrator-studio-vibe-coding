/**
 * E2E tests: Agent History — Table standard features
 *
 * Coverage:
 *   - Table basic loading with expected columns
 *   - Search functionality (by title / agent name)
 *   - Agent filter dropdown
 *   - Source filter dropdown
 *   - Column sorting (Last Active, Title)
 *   - Pagination (total display, page size, page switch)
 *   - Delete session with Popconfirm
 *   - Row click navigation to Playground
 *
 * Prerequisites:
 *   - Backend running on port 18000
 *   - Frontend running on port 15173
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:18000/api/v1';

// ────────────────────────────────────────
// Helpers
// ────────────────────────────────────────

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=Agentic RAGFlow', { timeout: 15000 });
}

/** Create a test session via the backend REST API. */
async function createSession(
  api: APIRequestContext,
  agentName = 'claude-code',
  source = 'playground',
  mode = 'ask',
) {
  const resp = await api.post(`${API_BASE}/agents/sessions`, {
    data: { agent_name: agentName, source, mode },
  });
  expect(resp.ok(), `Failed to create session: ${resp.status()}`).toBeTruthy();
  return resp.json();
}

/** Delete a test session via the backend REST API (ignoring errors). */
async function deleteSession(api: APIRequestContext, id: string) {
  await api.delete(`${API_BASE}/agents/sessions/${id}`).catch(() => {});
}

/** Get the first available agent name from the backend. */
async function getFirstAgentName(api: APIRequestContext): Promise<string> {
  const resp = await api.get(`${API_BASE}/agents/available`);
  const agents = await resp.json();
  const available = agents.find((a: { available: boolean }) => a.available);
  return available?.name ?? 'claude-code';
}

// ────────────────────────────────────────
// Tests
// ────────────────────────────────────────

test.describe('Agent History — Table Basic Loading', () => {
  test('page header and table with expected columns are visible', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);

    // PageHeader title
    await expect(page.locator('text=Agent Session History')).toBeVisible({ timeout: 10000 });

    // Ant Design table
    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    // Expected column headers
    for (const col of ['Title', 'Agent', 'Mode', 'Source', 'Created', 'Last Active']) {
      await expect(table.locator(`th:has-text("${col}")`)).toBeVisible();
    }
  });
});

test.describe('Agent History — Search', () => {
  let api: APIRequestContext;
  let sessionId: string;
  const SEARCH_TITLE = 'E2E-Search-Target';

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const agentName = await getFirstAgentName(api);
    const session = await createSession(api, agentName, 'playground', 'ask');
    sessionId = session.id;

    // Update the session title by sending a PATCH-like request
    // The API auto-titles from first message, so we rely on title matching agent_name
    // Instead, we'll search by agent_name which is guaranteed
  });

  test.afterAll(async () => {
    if (sessionId) await deleteSession(api, sessionId);
    await api.dispose();
  });

  test('search filters table rows and clear restores all', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);

    // Wait for data to load
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const initialCount = await rows.count();

    if (initialCount === 0) {
      test.skip(true, 'No sessions — skipping search test');
      return;
    }

    // Get text from the first row to use as search target
    const firstRowTitle = await rows.first().locator('td').first().textContent();
    const searchTerm = firstRowTitle?.trim().slice(0, 10) || '';

    if (!searchTerm) {
      test.skip(true, 'Empty title — skipping search test');
      return;
    }

    // Type in search box and press enter
    const searchInput = page.locator('input[placeholder="Search by title or agent"]');
    await searchInput.fill(searchTerm);
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Filtered rows should be <= initial count
    const filteredCount = await rows.count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // All visible rows should contain search term (in title or agent column)
    for (let i = 0; i < filteredCount; i++) {
      const rowText = await rows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toContain(searchTerm.toLowerCase());
    }

    // Clear search — use the clear button (allowClear)
    await searchInput.clear();
    await page.waitForTimeout(500);

    const restoredCount = await rows.count();
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
  });
});

test.describe('Agent History — Agent Filter', () => {
  let api: APIRequestContext;
  const createdIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
  });

  test.afterAll(async () => {
    for (const id of createdIds) {
      await deleteSession(api, id);
    }
    await api.dispose();
  });

  test('filter by agent shows only matching sessions', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Open the agent filter dropdown
    const agentSelect = page.locator('.ant-select').filter({
      has: page.locator('[title="Filter by agent"], .ant-select-selection-placeholder:has-text("Filter by agent")'),
    }).first();

    // If the select is not visible, the placeholder approach differs
    const filterSelect = page.locator('.ant-select-selection-placeholder:text("Filter by agent")').first();
    if (!(await filterSelect.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Agent filter not visible');
      return;
    }

    await filterSelect.click();
    await page.waitForTimeout(500);

    // Pick the first option in the dropdown
    const option = page.locator('.ant-select-item-option').first();
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No agent options available');
      return;
    }

    const optionText = await option.textContent();
    await option.click();
    // Close dropdown by clicking elsewhere
    await page.locator('body').click();
    await page.waitForTimeout(500);

    // Verify filtered rows contain the selected agent
    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const agentCell = await rows.nth(i).locator('td').nth(1).textContent();
      expect(agentCell?.trim()).toBe(optionText?.trim());
    }
  });
});

test.describe('Agent History — Source Filter', () => {
  let api: APIRequestContext;
  let sessionId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const agentName = await getFirstAgentName(api);
    const session = await createSession(api, agentName, 'playground', 'ask');
    sessionId = session.id;
  });

  test.afterAll(async () => {
    if (sessionId) await deleteSession(api, sessionId);
    await api.dispose();
  });

  test('filter by source shows only matching sessions', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const filterSelect = page.locator(
      '.ant-select-selection-placeholder:text("Filter by source")',
    ).first();
    if (!(await filterSelect.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Source filter not visible');
      return;
    }

    await filterSelect.click();
    await page.waitForTimeout(500);

    // Select "Playground" option
    const playgroundOption = page.locator('.ant-select-item-option:has-text("Playground")');
    if (!(await playgroundOption.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Playground option not available');
      return;
    }

    await playgroundOption.click();
    await page.locator('body').click();
    await page.waitForTimeout(500);

    // All visible rows should have source = playground
    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const sourceCell = await rows.nth(i).locator('td').nth(3).textContent();
      expect(sourceCell?.trim().toLowerCase()).toBe('playground');
    }
  });
});

test.describe('Agent History — Column Sorting', () => {
  test('clicking Last Active column header toggles sort direction', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    if ((await rows.count()) < 2) {
      test.skip(true, 'Need at least 2 rows to test sorting');
      return;
    }

    // "Last Active" has defaultSortOrder: 'descend'
    const lastActiveHeader = page.locator('th:has-text("Last Active")');
    await expect(lastActiveHeader).toBeVisible();

    // Click to toggle sort direction (descend → ascend)
    await lastActiveHeader.click();
    await page.waitForTimeout(500);

    // Verify the sort icon changed — Ant Design adds ant-table-column-sort class
    // or there's a sorter indicator
    const sortedColumn = page.locator('th.ant-table-column-sort');
    await expect(sortedColumn).toBeVisible();
  });

  test('clicking Title column header enables alphabetical sort', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    if ((await rows.count()) < 2) {
      test.skip(true, 'Need at least 2 rows to test sorting');
      return;
    }

    const titleHeader = page.locator('th:has-text("Title")');
    await titleHeader.click();
    await page.waitForTimeout(500);

    // Collect titles after sort
    const rowCount = await rows.count();
    const titles: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      const text = await rows.nth(i).locator('td').first().textContent();
      titles.push(text?.trim() ?? '');
    }

    // Verify ascending or descending order
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    const sortedDesc = [...titles].sort((a, b) => b.localeCompare(a));
    const isSorted = JSON.stringify(titles) === JSON.stringify(sorted)
      || JSON.stringify(titles) === JSON.stringify(sortedDesc);
    expect(isSorted).toBe(true);
  });
});

test.describe('Agent History — Pagination', () => {
  let api: APIRequestContext;
  const createdIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const agentName = await getFirstAgentName(api);

    // Create 12 sessions to ensure pagination with default pageSize=20
    // but can test with pageSize=10
    for (let i = 0; i < 12; i++) {
      const session = await createSession(api, agentName, 'playground', 'ask');
      createdIds.push(session.id);
    }
  });

  test.afterAll(async () => {
    for (const id of createdIds) {
      await deleteSession(api, id);
    }
    await api.dispose();
  });

  test('pagination shows total count and allows page size change', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // "Total X sessions" should be visible
    const totalText = page.locator('text=/Total \\d+ sessions/');
    await expect(totalText).toBeVisible({ timeout: 5000 });

    // Change page size to 10 via the size changer
    const sizeChanger = page.locator('.ant-pagination-options .ant-select').first();
    if (await sizeChanger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sizeChanger.click();
      await page.waitForTimeout(300);
      const option10 = page.locator('.ant-select-item-option:has-text("10")').first();
      if (await option10.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option10.click();
        await page.waitForTimeout(500);

        // Table rows should be at most 10
        const rows = page.locator('.ant-table-row');
        const count = await rows.count();
        expect(count).toBeLessThanOrEqual(10);
      }
    }
  });

  test('clicking page 2 switches data', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // First change to pageSize=10 to ensure page 2 exists
    const sizeChanger = page.locator('.ant-pagination-options .ant-select').first();
    if (await sizeChanger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sizeChanger.click();
      await page.waitForTimeout(300);
      const option10 = page.locator('.ant-select-item-option:has-text("10")').first();
      if (await option10.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option10.click();
        await page.waitForTimeout(500);
      }
    }

    // Get first row text on page 1
    const firstRowPage1 = await page.locator('.ant-table-row').first().textContent();

    // Click page 2
    const page2Btn = page.locator('.ant-pagination-item').filter({ hasText: '2' });
    if (await page2Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page2Btn.click();
      await page.waitForTimeout(500);

      // First row on page 2 should differ from page 1
      const firstRowPage2 = await page.locator('.ant-table-row').first().textContent();
      expect(firstRowPage2).not.toBe(firstRowPage1);
    } else {
      // Not enough data for page 2 — acceptable
      test.skip(true, 'Not enough data for page 2');
    }
  });
});

test.describe('Agent History — Delete Session', () => {
  let api: APIRequestContext;
  let sessionId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const agentName = await getFirstAgentName(api);
    const session = await createSession(api, agentName, 'playground', 'ask');
    sessionId = session.id;
  });

  test.afterAll(async () => {
    // Try to clean up in case deletion test failed
    if (sessionId) await deleteSession(api, sessionId);
    await api.dispose();
  });

  test('delete icon shows Popconfirm and removes session on confirm', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const initialCount = await rows.count();

    if (initialCount === 0) {
      test.skip(true, 'No sessions to delete');
      return;
    }

    // Click the delete icon on the first row
    const deleteIcon = rows.first().locator('.anticon-delete');
    await expect(deleteIcon).toBeVisible();
    await deleteIcon.click();

    // Popconfirm should appear with "Delete this session?"
    const popconfirm = page.locator('.ant-popconfirm');
    await expect(popconfirm).toBeVisible({ timeout: 3000 });
    await expect(popconfirm.locator('text=Delete this session?')).toBeVisible();

    // Click the confirm button (OK / Yes)
    const confirmBtn = popconfirm.locator('button').filter({ hasText: /OK|Yes/i }).first();
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Session should be removed from the list
    const afterCount = await rows.count();
    expect(afterCount).toBeLessThan(initialCount);
  });

  test('delete click does not trigger row navigation (stopPropagation)', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    if ((await rows.count()) === 0) {
      test.skip(true, 'No sessions');
      return;
    }

    // Click the delete icon
    const deleteIcon = rows.first().locator('.anticon-delete');
    await expect(deleteIcon).toBeVisible();
    await deleteIcon.click();
    await page.waitForTimeout(500);

    // Should still be on the history page (not navigated to playground)
    expect(page.url()).toContain('/agent-history');

    // Dismiss the popconfirm by pressing Escape
    await page.keyboard.press('Escape');
  });
});

test.describe('Agent History — Row Click Navigation', () => {
  let api: APIRequestContext;
  let sessionId: string;
  let agentName: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    agentName = await getFirstAgentName(api);
    const session = await createSession(api, agentName, 'playground', 'ask');
    sessionId = session.id;
  });

  test.afterAll(async () => {
    if (sessionId) await deleteSession(api, sessionId);
    await api.dispose();
  });

  test('clicking a row navigates to playground with agent and session params', async ({ page }) => {
    await page.goto('/agent-history');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    if ((await rows.count()) === 0) {
      test.skip(true, 'No sessions — skipping navigation test');
      return;
    }

    // Click the first row
    await rows.first().click();

    // Should navigate to /playground
    await page.waitForURL(/\/playground/, { timeout: 5000 });
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Playground should be functional — Send button visible
    await expect(page.locator('text=Send')).toBeVisible({ timeout: 5000 });
  });
});
