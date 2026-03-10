import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:18000/api/v1';

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=Agentic RAGFlow', { timeout: 15000 });
}

async function createPipeline(
  api: APIRequestContext,
  name: string,
  description?: string,
) {
  const resp = await api.post(`${API_BASE}/pipelines`, {
    data: {
      name,
      description: description || null,
      graph_data: { nodes: [], edges: [] },
    },
  });
  return resp.json();
}

async function deletePipeline(api: APIRequestContext, id: string) {
  await api.delete(`${API_BASE}/pipelines/${id}`).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Pipelines 列表页加载                                                */
/* ------------------------------------------------------------------ */
test.describe('Pipelines page — table loading', () => {
  let api: APIRequestContext;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p = await createPipeline(api, 'E2E Test Pipeline', 'Created by E2E');
    pipelineId = p.id;
  });

  test.afterAll(async () => {
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should display the Pipelines page with expected columns', async ({ page }) => {
    await page.goto('/pipelines');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Pipelines').first()).toBeVisible();

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    const expectedColumns = ['Name', 'Status', 'Nodes', 'Description', 'Created'];
    for (const col of expectedColumns) {
      await expect(table.locator(`th:has-text("${col}")`)).toBeVisible();
    }
  });

  test('should show at least one pipeline row', async ({ page }) => {
    await page.goto('/pipelines');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  创建 Pipeline Modal                                                */
/* ------------------------------------------------------------------ */
test.describe('Pipelines page — create', () => {
  let api: APIRequestContext;
  let createdId: string | null = null;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
  });

  test.afterAll(async () => {
    if (createdId) await deletePipeline(api, createdId);
    await api.dispose();
  });

  test('should create a new pipeline via modal', async ({ page }) => {
    await page.goto('/pipelines');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Click "New Pipeline" button
    await page.locator('button:has-text("New Pipeline")').click();
    await page.waitForTimeout(500);

    // Modal should be visible
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();

    // Fill name
    await modal.locator('#name').fill('E2E Created Pipeline');

    // Submit
    await modal.locator('button:has-text("Create")').click();
    await page.waitForTimeout(2000);

    // Should navigate to editor
    await page.waitForURL(/\/pipelines\//, { timeout: 5000 });

    // Cleanup: find the created pipeline's ID via API
    const resp = await api.get(`${API_BASE}/pipelines?page=1&page_size=100`);
    const data = await resp.json();
    const found = data.items.find(
      (p: { name: string; id: string }) => p.name === 'E2E Created Pipeline',
    );
    if (found) createdId = found.id;
  });
});

/* ------------------------------------------------------------------ */
/*  删除 Pipeline                                                      */
/* ------------------------------------------------------------------ */
test.describe('Pipelines page — delete', () => {
  let api: APIRequestContext;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p = await createPipeline(api, 'E2E Delete Me Pipeline', 'Will be deleted');
    pipelineId = p.id;
  });

  test.afterAll(async () => {
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should delete a pipeline with popconfirm', async ({ page }) => {
    await page.goto('/pipelines');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const row = page.locator('.ant-table-row:has-text("E2E Delete Me Pipeline")');
    await expect(row).toBeVisible();

    // Click delete icon
    await row.locator('.anticon-delete').click();

    // Popconfirm should appear
    const popconfirm = page.locator('.ant-popconfirm');
    await expect(popconfirm).toBeVisible();
    await expect(popconfirm.locator('text=Delete this pipeline?')).toBeVisible();

    // Confirm delete
    await popconfirm.locator('button').filter({ hasText: /Yes/i }).click();
    await page.waitForTimeout(2000);

    // Row should disappear
    await expect(
      page.locator('.ant-table-row:has-text("E2E Delete Me Pipeline")'),
    ).not.toBeVisible();

    // Mark as cleaned up
    pipelineId = '';
  });
});

/* ------------------------------------------------------------------ */
/*  搜索过滤                                                           */
/* ------------------------------------------------------------------ */
test.describe('Pipelines page — search', () => {
  let api: APIRequestContext;
  const createdIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p1 = await createPipeline(api, 'SearchUniqueAlpha Pipeline', 'first');
    const p2 = await createPipeline(api, 'SearchUniqueBeta Pipeline', 'second');
    createdIds.push(p1.id, p2.id);
  });

  test.afterAll(async () => {
    for (const id of createdIds) await deletePipeline(api, id);
    await api.dispose();
  });

  test('should filter pipelines by search text', async ({ page }) => {
    await page.goto('/pipelines');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[placeholder="Search by name or description"]');
    await searchInput.fill('SearchUniqueAlpha');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('searchuniquealpha');
    }
  });
});
