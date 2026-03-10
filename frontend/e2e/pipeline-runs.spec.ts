import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:18000/api/v1';

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=Agentic RAGFlow', { timeout: 15000 });
}

async function createPipeline(api: APIRequestContext, name: string) {
  const resp = await api.post(`${API_BASE}/pipelines`, {
    data: { name, graph_data: { nodes: [], edges: [] } },
  });
  return resp.json();
}

async function createRun(
  api: APIRequestContext,
  pipelineId: string,
  status?: string,
) {
  const resp = await api.post(`${API_BASE}/runs`, {
    data: { pipeline_id: pipelineId },
  });
  return resp.json();
}

async function deletePipeline(api: APIRequestContext, id: string) {
  await api.delete(`${API_BASE}/pipelines/${id}`).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Pipeline Runs 页面加载                                              */
/* ------------------------------------------------------------------ */
test.describe('PipelineRuns page — loading', () => {
  test('should load the Pipeline Runs page with expected elements', async ({ page }) => {
    await page.goto('/pipeline-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Page title should be visible
    await expect(page.locator('text=Pipeline Runs').first()).toBeVisible();

    // Table should be present
    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    // Expected columns
    const expectedColumns = ['Pipeline', 'Source', 'Status', 'Files', 'Started'];
    for (const col of expectedColumns) {
      await expect(table.locator(`th:has-text("${col}")`)).toBeVisible();
    }
  });

  test('should show source filter dropdown', async ({ page }) => {
    await page.goto('/pipeline-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Source filter select should be present with "All Sources" default
    await expect(page.locator('text=All Sources').first()).toBeVisible();
  });

  test('should show status filter', async ({ page }) => {
    await page.goto('/pipeline-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Status multi-select should be visible
    await expect(
      page.locator('[class*="ant-select"] >> text=Filter by status').first(),
    ).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  Pipeline Runs 表格数据                                              */
/* ------------------------------------------------------------------ */
test.describe('PipelineRuns page — with data', () => {
  let api: APIRequestContext;
  let pipelineId: string;
  let runId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p = await createPipeline(api, 'E2E Run Test Pipeline');
    pipelineId = p.id;
    const r = await createRun(api, pipelineId);
    runId = r.id;
  });

  test.afterAll(async () => {
    // Runs are cascade-cleaned or we just leave them
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should display at least one run row', async ({ page }) => {
    await page.goto('/pipeline-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should show pipeline name in run row', async ({ page }) => {
    await page.goto('/pipeline-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    await expect(
      page.locator('.ant-table-row:has-text("E2E Run Test Pipeline")'),
    ).toBeVisible();
  });

  test('should show source tag as Standalone', async ({ page }) => {
    await page.goto('/pipeline-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // The run we created is standalone
    const row = page.locator('.ant-table-row:has-text("E2E Run Test Pipeline")');
    await expect(row.locator('text=Standalone')).toBeVisible();
  });

  test('should open detail modal on row click', async ({ page }) => {
    await page.goto('/pipeline-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const row = page.locator('.ant-table-row:has-text("E2E Run Test Pipeline")');
    await row.click();
    await page.waitForTimeout(500);

    // Modal should appear
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Pipeline Run Detail')).toBeVisible();
    await expect(modal.locator('text=E2E Run Test Pipeline')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  Pipeline Runs 搜索过滤                                              */
/* ------------------------------------------------------------------ */
test.describe('PipelineRuns page — search', () => {
  let api: APIRequestContext;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p = await createPipeline(api, 'UniqueSearchRunPipeline');
    pipelineId = p.id;
    await createRun(api, pipelineId);
  });

  test.afterAll(async () => {
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should filter runs by search text', async ({ page }) => {
    await page.goto('/pipeline-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[placeholder="Search by pipeline name"]');
    await searchInput.fill('UniqueSearchRunPipeline');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('uniquesearchrunpipeline');
    }
  });
});
