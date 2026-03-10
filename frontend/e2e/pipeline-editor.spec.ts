import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:18000/api/v1';

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=Agentic RAGFlow', { timeout: 15000 });
}

async function createPipeline(
  api: APIRequestContext,
  name: string,
  graphData?: object,
) {
  const resp = await api.post(`${API_BASE}/pipelines`, {
    data: {
      name,
      graph_data: graphData || { nodes: [], edges: [] },
    },
  });
  return resp.json();
}

async function deletePipeline(api: APIRequestContext, id: string) {
  await api.delete(`${API_BASE}/pipelines/${id}`).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  编辑器加载                                                          */
/* ------------------------------------------------------------------ */
test.describe('PipelineEditor — loading', () => {
  let api: APIRequestContext;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p = await createPipeline(api, 'E2E Editor Test');
    pipelineId = p.id;
  });

  test.afterAll(async () => {
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should load the pipeline editor page', async ({ page }) => {
    await page.goto(`/pipelines/${pipelineId}`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Editor should be visible (ReactFlow canvas or similar)
    // Check for the pipeline name or editor elements
    await expect(page.locator('text=E2E Editor Test').first()).toBeVisible();
  });

  test('should show Edit and Debug mode tabs', async ({ page }) => {
    await page.goto(`/pipelines/${pipelineId}`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Look for Edit/Debug mode selectors
    await expect(page.locator('text=Edit').first()).toBeVisible();
    await expect(page.locator('text=Debug').first()).toBeVisible();
  });

  test('should show Document node in empty pipeline', async ({ page }) => {
    await page.goto(`/pipelines/${pipelineId}`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Document node should always be present
    await expect(page.locator('text=Document').first()).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  添加 Skill 节点                                                     */
/* ------------------------------------------------------------------ */
test.describe('PipelineEditor — add skill node', () => {
  let api: APIRequestContext;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p = await createPipeline(api, 'E2E Add Node Test');
    pipelineId = p.id;
  });

  test.afterAll(async () => {
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should show Add Skill panel in sidebar', async ({ page }) => {
    await page.goto(`/pipelines/${pipelineId}`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // The sidebar should have "Add Skill" tab
    const addSkillTab = page.locator('text=Add Skill').first();
    await expect(addSkillTab).toBeVisible();

    // Click to ensure it shows skill list
    await addSkillTab.click();
    await page.waitForTimeout(500);

    // Should show some skill categories or skill names
    // Check for "builtin" or "custom" labels, or specific skill names
    const sidebar = page.locator('[class*="sidebar"], [class*="panel"]').first();
    const sidebarText = await sidebar.textContent();
    // At minimum, the panel should contain some text
    expect(sidebarText?.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  保存 Pipeline                                                      */
/* ------------------------------------------------------------------ */
test.describe('PipelineEditor — save', () => {
  let api: APIRequestContext;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p = await createPipeline(api, 'E2E Save Test');
    pipelineId = p.id;
  });

  test.afterAll(async () => {
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should have a Save button', async ({ page }) => {
    await page.goto(`/pipelines/${pipelineId}`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  Pipeline with pre-existing nodes                                   */
/* ------------------------------------------------------------------ */
test.describe('PipelineEditor — with nodes', () => {
  let api: APIRequestContext;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const p = await createPipeline(api, 'E2E Nodes Test', {
      nodes: [
        {
          id: 'n1',
          skill_name: 'DocumentCracker',
          label: 'Doc Crack',
          position: 0,
          context: '/document',
          inputs: [
            { name: 'file_content', source: '/document/file_content' },
            { name: 'file_name', source: '/document/file_name' },
          ],
          outputs: [{ name: 'content', targetName: 'content' }],
          config_overrides: {},
        },
      ],
      edges: [],
    });
    pipelineId = p.id;
  });

  test.afterAll(async () => {
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should display the skill node in the editor', async ({ page }) => {
    await page.goto(`/pipelines/${pipelineId}`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Should see the "Doc Crack" node label
    await expect(page.locator('text=Doc Crack').first()).toBeVisible();
  });
});
