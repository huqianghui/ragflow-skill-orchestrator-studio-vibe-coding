import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:18000/api/v1';

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=Agentic RAGFlow', { timeout: 15000 });
}

async function createWorkflow(
  api: APIRequestContext,
  name: string,
) {
  const resp = await api.post(`${API_BASE}/workflows`, {
    data: {
      name,
      description: 'E2E test workflow',
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

async function triggerWorkflowRun(api: APIRequestContext, workflowId: string) {
  const resp = await api.post(`${API_BASE}/workflows/${workflowId}/run`);
  return resp.json();
}

/* ------------------------------------------------------------------ */
/*  WorkflowRunHistory 表格加载                                         */
/* ------------------------------------------------------------------ */
test.describe('WorkflowRunHistory page — table loading', () => {
  let api: APIRequestContext;
  let workflowId: string;
  let runId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E RunHistory Workflow');
    workflowId = wf.id;
    // Trigger a run so we have data (will complete immediately — no data sources)
    const run = await triggerWorkflowRun(api, workflowId);
    runId = run.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should display the Workflow Run History page with expected columns', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Workflow Run History').first()).toBeVisible();

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    const expectedColumns = ['ID', 'Workflow', 'Status', 'Files', 'Failed', 'Started', 'Finished'];
    for (const col of expectedColumns) {
      await expect(table.locator(`th:has-text("${col}")`)).toBeVisible();
    }
  });

  test('should show at least one run row', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should show total runs count', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    await expect(page.locator('text=/Total \\d+ runs/')).toBeVisible();
  });

  test('should show run ID in table', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // The run ID should be visible as a link
    await expect(page.locator(`.ant-table-row a`).first()).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  Workflow 过滤下拉                                                   */
/* ------------------------------------------------------------------ */
test.describe('WorkflowRunHistory page — workflow filter', () => {
  let api: APIRequestContext;
  let workflowId1: string;
  let workflowId2: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf1 = await createWorkflow(api, 'E2E FilterWF Alpha');
    const wf2 = await createWorkflow(api, 'E2E FilterWF Beta');
    workflowId1 = wf1.id;
    workflowId2 = wf2.id;
    // Trigger runs for both workflows
    await triggerWorkflowRun(api, workflowId1);
    await triggerWorkflowRun(api, workflowId2);
  });

  test.afterAll(async () => {
    if (workflowId1) await deleteWorkflow(api, workflowId1);
    if (workflowId2) await deleteWorkflow(api, workflowId2);
    await api.dispose();
  });

  test('should filter runs by workflow using dropdown', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const initialCount = await page.locator('.ant-table-row').count();
    test.skip(initialCount < 2, 'Not enough runs to test filter');

    // Click the workflow filter dropdown — the combobox input intercepts pointer events
    // so we must click the combobox itself, not the placeholder text
    await page.locator('.ant-select:has-text("Filter by workflow") input[role="combobox"]').click();
    await page.waitForTimeout(500);

    // Select the first option from the dropdown
    const firstOption = page.locator('.ant-select-item-option').first();
    const selectedText = await firstOption.textContent();
    await firstOption.click();
    await page.waitForTimeout(1000);

    // After filtering, all visible Workflow columns should match the selected workflow
    const rows = page.locator('.ant-table-row');
    const filteredCount = await rows.count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    if (filteredCount > 0 && selectedText) {
      for (let i = 0; i < filteredCount; i++) {
        const workflowCell = await rows.nth(i).locator('td').nth(1).textContent();
        expect(workflowCell).toContain(selectedText);
      }
    }
  });

  test('should load with workflow_id query param pre-selected', async ({ page }) => {
    await page.goto(`/workflow-runs?workflow_id=${workflowId1}`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // When the workflow_id param is set, the filter select should show the workflow
    // name instead of the placeholder. Use .ant-select-content-has-value scoped
    // with a title attribute to target only the workflow filter (not page size).
    const selectContent = page.locator(
      '.ant-select-content[title="E2E FilterWF Alpha"]',
    );
    await expect(selectContent).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  搜索                                                               */
/* ------------------------------------------------------------------ */
test.describe('WorkflowRunHistory page — search', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E SearchableWF');
    workflowId = wf.id;
    await triggerWorkflowRun(api, workflowId);
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should filter runs by search text', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const initialCount = await page.locator('.ant-table-row').count();
    test.skip(initialCount === 0, 'No runs to search');

    const searchInput = page.locator(
      'input[placeholder="Search by ID or workflow name"]',
    );
    await searchInput.fill('SearchableWF');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('.ant-table-row').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  详情 Modal                                                         */
/* ------------------------------------------------------------------ */
test.describe('WorkflowRunHistory page — detail modal', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E DetailModal WF');
    workflowId = wf.id;
    await triggerWorkflowRun(api, workflowId);
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should open detail modal when clicking run ID', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    test.skip(count === 0, 'No runs to view detail');

    // Click the ID link in the first row
    await rows.first().locator('a').first().click();
    await page.waitForTimeout(1000);

    // Detail modal should appear
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Workflow Run Detail')).toBeVisible();

    // Should contain Descriptions with expected labels
    const descriptions = modal.locator('.ant-descriptions');
    await expect(descriptions).toBeVisible();
    await expect(descriptions.locator('text=ID')).toBeVisible();
    await expect(descriptions.locator('text=Status')).toBeVisible();
    await expect(descriptions.locator('text=Total Files')).toBeVisible();
    await expect(descriptions.locator('text=Processed')).toBeVisible();

    // Close modal
    await modal.locator('button.ant-modal-close').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ant-modal-body')).not.toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  列排序                                                             */
/* ------------------------------------------------------------------ */
test.describe('WorkflowRunHistory page — column sorting', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E SortWF');
    workflowId = wf.id;
    // Create multiple runs for sorting
    await triggerWorkflowRun(api, workflowId);
    await triggerWorkflowRun(api, workflowId);
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should sort by Status column', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    test.skip(count < 2, 'Not enough runs to test sorting');

    // Click Status column header
    await page.locator('th:has-text("Status")').click();
    await page.waitForTimeout(500);

    // Verify sort indicator appears
    const sortedTh = page.locator('th.ant-table-column-sort');
    await expect(sortedTh).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  分页                                                               */
/* ------------------------------------------------------------------ */
test.describe('WorkflowRunHistory page — pagination', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E PaginationWF');
    workflowId = wf.id;
    // Create 12 runs for pagination testing
    for (let i = 0; i < 12; i++) {
      await triggerWorkflowRun(api, workflowId);
    }
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should show page size selector and change page size', async ({ page }) => {
    await page.goto('/workflow-runs');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    test.skip(count < 11, 'Not enough runs to test pagination');

    // Change page size to 10
    const pageSizeSelect = page.locator('.ant-pagination-options .ant-select');
    await pageSizeSelect.click();
    await page.waitForTimeout(300);
    await page.locator('.ant-select-item-option[title="10 / page"]').click();
    await page.waitForTimeout(1000);

    const rowsAfter = await page.locator('.ant-table-row').count();
    expect(rowsAfter).toBeLessThanOrEqual(10);
  });
});
