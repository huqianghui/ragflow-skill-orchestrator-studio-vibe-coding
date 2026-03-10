import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:18000/api/v1';

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=Agentic RAGFlow', { timeout: 15000 });
}

async function createWorkflow(
  api: APIRequestContext,
  name: string,
  description?: string,
) {
  const resp = await api.post(`${API_BASE}/workflows`, {
    data: {
      name,
      description: description || null,
      data_source_ids: [],
      routes: [],
      default_route: null,
    },
  });
  return resp.json();
}

async function deleteWorkflow(api: APIRequestContext, id: string) {
  await api.delete(`${API_BASE}/workflows/${id}`).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Workflows 列表页                                                    */
/* ------------------------------------------------------------------ */
test.describe('Workflows page — table loading', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Test Workflow', 'Created by E2E');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should display the Workflows page with expected columns', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Workflows').first()).toBeVisible();

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    const expectedColumns = ['Name', 'Status', 'Data Sources', 'Routes', 'Description', 'Created At', 'Actions'];
    for (const col of expectedColumns) {
      await expect(table.locator(`th:has-text("${col}")`)).toBeVisible();
    }
  });

  test('should show at least one workflow row', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should show total workflows count', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    await expect(page.locator('text=/Total \\d+ workflows/')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  搜索过滤                                                           */
/* ------------------------------------------------------------------ */
test.describe('Workflows page — search', () => {
  let api: APIRequestContext;
  const createdIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf1 = await createWorkflow(api, 'SearchAlpha Workflow', 'first');
    const wf2 = await createWorkflow(api, 'SearchBeta Pipeline', 'second');
    createdIds.push(wf1.id, wf2.id);
  });

  test.afterAll(async () => {
    for (const id of createdIds) await deleteWorkflow(api, id);
    await api.dispose();
  });

  test('should filter workflows by search text', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const initialCount = await page.locator('.ant-table-row').count();
    test.skip(initialCount === 0, 'No workflows to search');

    const searchInput = page.locator('input[placeholder="Search by name or description"]');
    await searchInput.fill('SearchAlpha');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('.ant-table-row').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThanOrEqual(1);

    // Verify all visible rows contain the search term
    const rows = page.locator('.ant-table-row');
    for (let i = 0; i < filteredCount; i++) {
      const text = await rows.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('searchalpha');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  创建 Workflow Modal (简化版：仅 Name + Description)                  */
/* ------------------------------------------------------------------ */
test.describe('Workflows page — create modal', () => {
  let api: APIRequestContext;
  let createdId: string | null = null;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
  });

  test.afterAll(async () => {
    if (createdId) await deleteWorkflow(api, createdId);
    await api.dispose();
  });

  test('should open and close the create workflow modal', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Click "New Workflow" button
    await page.locator('button:has-text("New Workflow")').click();
    await page.waitForTimeout(500);

    // Modal should be visible
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=New Workflow')).toBeVisible();

    // Simplified form: only Name and Description
    await expect(modal.locator('label:has-text("Name")')).toBeVisible();
    await expect(modal.locator('label:has-text("Description")')).toBeVisible();

    // Close modal
    await modal.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ant-modal-body')).not.toBeVisible();
  });

  test('should create a workflow and navigate to editor', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Open create modal
    await page.locator('button:has-text("New Workflow")').click();
    await page.waitForTimeout(500);

    const modal = page.locator('.ant-modal');

    // Fill in form
    await modal.locator('#name').fill('E2E Created Workflow');
    await modal.locator('#description').fill('Created from E2E test');

    // Submit
    await modal.locator('button:has-text("Create")').click();

    // Should navigate to the flow editor
    await page.waitForURL(/\/workflows\/.*\/edit/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/workflows\/[\w-]+\/edit/);

    // Extract workflow ID from URL for cleanup
    const urlMatch = page.url().match(/\/workflows\/([\w-]+)\/edit/);
    if (urlMatch) createdId = urlMatch[1];

    // Editor should load with the workflow name
    await waitForAppReady(page);
    await page.waitForTimeout(2000);
    await expect(page.locator('text=E2E Created Workflow').first()).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  编辑导航 (点击名称/Edit 按钮 → 跳转到编辑器)                          */
/* ------------------------------------------------------------------ */
test.describe('Workflows page — edit navigation', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Edit Target', 'To be edited');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should navigate to editor when clicking workflow name', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Click the workflow name link
    const nameLink = page.locator('.ant-table-row a:has-text("E2E Edit Target")');
    await expect(nameLink).toBeVisible();
    await nameLink.click();

    // Should navigate to the flow editor
    await page.waitForURL(/\/workflows\/.*\/edit/, { timeout: 10000 });
    expect(page.url()).toContain(`/workflows/${workflowId}/edit`);

    // Editor should show the workflow name
    await waitForAppReady(page);
    await page.waitForTimeout(2000);
    await expect(page.locator('text=E2E Edit Target').first()).toBeVisible();
  });

  test('should navigate to editor when clicking Edit button', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Find the row and click "Edit" button
    const row = page.locator('.ant-table-row:has-text("E2E Edit Target")');
    await expect(row).toBeVisible();
    await row.locator('button:has-text("Edit")').click();

    // Should navigate to the flow editor
    await page.waitForURL(/\/workflows\/.*\/edit/, { timeout: 10000 });
    expect(page.url()).toContain(`/workflows/${workflowId}/edit`);
  });
});

/* ------------------------------------------------------------------ */
/*  删除 Workflow                                                      */
/* ------------------------------------------------------------------ */
test.describe('Workflows page — delete', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Delete Me', 'Will be deleted');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    // Cleanup in case test failed
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should delete a workflow with popconfirm', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const initialCount = await page.locator('.ant-table-row').count();
    test.skip(initialCount === 0, 'No workflows to delete');

    // Find the row with "E2E Delete Me" and click delete icon
    const row = page.locator('.ant-table-row:has-text("E2E Delete Me")');
    await expect(row).toBeVisible();
    await row.locator('.anticon-delete').click();

    // Popconfirm should appear
    const popconfirm = page.locator('.ant-popconfirm');
    await expect(popconfirm).toBeVisible();
    await expect(popconfirm.locator('text=Delete this workflow?')).toBeVisible();

    // Confirm delete
    await popconfirm.locator('button').filter({ hasText: /Yes/i }).click();
    await page.waitForTimeout(2000);

    // Row count should decrease
    const newCount = await page.locator('.ant-table-row').count();
    expect(newCount).toBeLessThan(initialCount);

    // Mark as cleaned up
    workflowId = '';
  });
});

/* ------------------------------------------------------------------ */
/*  Runs 按钮导航                                                      */
/* ------------------------------------------------------------------ */
test.describe('Workflows page — Runs navigation', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Runs Nav', 'Test runs nav');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should navigate to workflow runs page when clicking Runs button', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Find the row and click "Runs" button
    const row = page.locator('.ant-table-row:has-text("E2E Runs Nav")');
    await expect(row).toBeVisible();
    await row.locator('button:has-text("Runs")').click();

    // Should navigate to workflow-runs page with workflow_id query param
    await page.waitForURL(/\/workflow-runs/, { timeout: 5000 });
    expect(page.url()).toContain(`workflow_id=${workflowId}`);
  });
});

/* ------------------------------------------------------------------ */
/*  列排序                                                             */
/* ------------------------------------------------------------------ */
test.describe('Workflows page — column sorting', () => {
  let api: APIRequestContext;
  const createdIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf1 = await createWorkflow(api, 'Alpha Workflow', 'first');
    const wf2 = await createWorkflow(api, 'Zeta Workflow', 'last');
    createdIds.push(wf1.id, wf2.id);
  });

  test.afterAll(async () => {
    for (const id of createdIds) await deleteWorkflow(api, id);
    await api.dispose();
  });

  test('should sort by Name column', async ({ page }) => {
    await page.goto('/workflows');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    test.skip(count < 2, 'Not enough workflows to test sorting');

    // Click Name column header to sort
    await page.locator('th:has-text("Name")').click();
    await page.waitForTimeout(500);

    // Verify sort indicator appears
    const sortedTh = page.locator('th.ant-table-column-sort');
    await expect(sortedTh).toBeVisible();
  });
});
