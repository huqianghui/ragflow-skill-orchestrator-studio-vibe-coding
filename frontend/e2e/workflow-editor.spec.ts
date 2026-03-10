import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:18000/api/v1';

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=Agentic RAGFlow', { timeout: 15000 });
}

async function createWorkflow(
  api: APIRequestContext,
  name: string,
  description?: string,
  extra?: Record<string, unknown>,
) {
  const resp = await api.post(`${API_BASE}/workflows`, {
    data: {
      name,
      description: description || null,
      data_source_ids: [],
      routes: [],
      default_route: null,
      ...extra,
    },
  });
  return resp.json();
}

async function deleteWorkflow(api: APIRequestContext, id: string) {
  await api.delete(`${API_BASE}/workflows/${id}`).catch(() => {});
}

async function createPipeline(api: APIRequestContext, name: string) {
  const resp = await api.post(`${API_BASE}/pipelines`, {
    data: { name, graph_data: { nodes: [], edges: [] } },
  });
  return resp.json();
}

async function deletePipeline(api: APIRequestContext, id: string) {
  await api.delete(`${API_BASE}/pipelines/${id}`).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  编辑器加载                                                          */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — loading', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Editor Load', 'Editor load test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should load the workflow editor page', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Workflow name should be visible in top bar
    await expect(page.locator('text=E2E Editor Load').first()).toBeVisible();
  });

  test('should show the React Flow canvas', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // React Flow canvas should be present
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
  });

  test('should show a status tag', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Status tag (draft by default)
    await expect(page.locator('.ant-tag:has-text("draft")')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  顶部栏                                                             */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — top bar', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E TopBar Test', 'TopBar test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should have Back button that navigates to workflows list', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Back button (ArrowLeftOutlined icon)
    const backBtn = page.locator('button .anticon-arrow-left').first();
    await expect(backBtn).toBeVisible();

    // Click back button
    await backBtn.click();
    await page.waitForURL(/\/workflows$/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/workflows$/);
  });

  test('should have Save button (initially disabled)', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeVisible();
    // Save should be disabled when no changes made
    await expect(saveBtn).toBeDisabled();
  });

  test('should have Agent button', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const agentBtn = page.locator('button:has-text("Agent")');
    await expect(agentBtn).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  右侧栏 — Add Node 面板                                              */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — sidebar Add Node panel', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Sidebar Test', 'Sidebar test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should show Add Node panel with 4 node types', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // "ADD NODES" header
    await expect(page.locator('text=ADD NODES')).toBeVisible();

    // 4 node type cards
    await expect(page.locator('text=DataSource').first()).toBeVisible();
    await expect(page.locator('text=Router').first()).toBeVisible();
    await expect(page.locator('text=Pipeline').first()).toBeVisible();
    await expect(page.locator('text=Target').first()).toBeVisible();
  });

  test('should show drag instruction text', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Drag to canvas or click + to add')).toBeVisible();
  });

  test('should collapse and expand sidebar', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Initially expanded — ADD NODES should be visible
    await expect(page.locator('text=ADD NODES')).toBeVisible();

    // The right sidebar toggle is inside the sidebar panel (which contains ADD NODES).
    // Use the parent of ADD NODES to scope the toggle (avoid matching AppLayout's toggle).
    // The sidebar has the collapse icon as a sibling above the content.
    // Target the last menu-fold icon on the page (AppLayout's is first, editor's is last).
    const collapseToggle = page.locator('[aria-label="menu-fold"]').last();
    await expect(collapseToggle).toBeVisible();
    await collapseToggle.click();
    await page.waitForTimeout(800);

    // ADD NODES should be hidden after collapse
    await expect(page.locator('text=ADD NODES')).not.toBeVisible();

    // Click expand toggle — the last menu-unfold icon
    const expandToggle = page.locator('[aria-label="menu-unfold"]').last();
    await expect(expandToggle).toBeVisible();
    await expandToggle.click();
    await page.waitForTimeout(800);

    // ADD NODES should reappear
    await expect(page.locator('text=ADD NODES')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  点击添加 Router 节点                                                */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — add Router node via click', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Add Router', 'Add router test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should create a Router node on canvas when clicking +', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Initially no nodes on canvas
    const initialNodes = await page.locator('.react-flow__node').count();
    expect(initialNodes).toBe(0);

    // Find the Router card's + button in sidebar
    // The card has "Router" text and a PlusOutlined button
    const routerCard = page.locator('.ant-card:has-text("Router")').first();
    await expect(routerCard).toBeVisible();
    const plusBtn = routerCard.locator('.anticon-plus');
    await plusBtn.click();
    await page.waitForTimeout(500);

    // A router node should now appear on the canvas
    const routerNodes = page.locator('.react-flow__node-router');
    await expect(routerNodes.first()).toBeVisible();
    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBe(1);

    // The node should contain "New Router" text
    await expect(page.locator('.react-flow__node:has-text("New Router")')).toBeVisible();

    // Save button should now be enabled (dirty state)
    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeEnabled();
  });

  test('should show Node Config panel when clicking the created node', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Add a Router node first
    const routerCard = page.locator('.ant-card:has-text("Router")').first();
    await routerCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);

    // Click the created router node on canvas
    const routerNode = page.locator('.react-flow__node-router').first();
    await routerNode.click();
    await page.waitForTimeout(500);

    // Sidebar should switch to config panel with Router tag
    await expect(page.locator('.ant-tag:has-text("Router")')).toBeVisible();

    // Should show Name input field
    const nameInput = page.locator('input[placeholder="Route name"]');
    await expect(nameInput).toBeVisible();

    // Should show Delete button
    await expect(page.locator('button:has-text("Delete")')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  资源选择器 Modal                                                    */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — resource picker modal', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Picker Test', 'Picker test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should open DataSource picker when clicking + on DataSource', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Click the + button on DataSource card
    const dsCard = page.locator('.ant-card:has-text("DataSource")').first();
    await dsCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);

    // Modal should appear with "Select DataSource" title
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Select DataSource')).toBeVisible();

    // Close modal
    await modal.locator('button.ant-modal-close').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.ant-modal-body')).not.toBeVisible();
  });

  test('should open Pipeline picker when clicking + on Pipeline', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const pipCard = page.locator('.ant-card:has-text("Pipeline")').first();
    await pipCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Select Pipeline')).toBeVisible();

    await modal.locator('button.ant-modal-close').click();
  });

  test('should open Target picker when clicking + on Target', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const tgtCard = page.locator('.ant-card:has-text("Target")').first();
    await tgtCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);

    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Select Target')).toBeVisible();

    await modal.locator('button.ant-modal-close').click();
  });
});

/* ------------------------------------------------------------------ */
/*  选择资源并添加节点                                                    */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — select resource from picker', () => {
  let api: APIRequestContext;
  let workflowId: string;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Select Resource', 'Select resource test');
    workflowId = wf.id;
    const pip = await createPipeline(api, 'E2E PickerPipeline');
    pipelineId = pip.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should add Pipeline node after selecting from picker', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Click + on Pipeline card
    const pipCard = page.locator('.ant-card:has-text("Pipeline")').first();
    await pipCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);

    // Modal should show the pipeline
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();

    // Click on the pipeline card in the picker
    const pickerItem = modal.locator('.ant-card:has-text("E2E PickerPipeline")');
    await expect(pickerItem).toBeVisible();
    await pickerItem.click();
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('.ant-modal-body')).not.toBeVisible();

    // A pipeline node should appear on the canvas
    const pipelineNodes = page.locator('.react-flow__node-pipeline');
    await expect(pipelineNodes.first()).toBeVisible();
    await expect(page.locator('.react-flow__node:has-text("E2E PickerPipeline")')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  节点删除                                                            */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — delete node', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Delete Node', 'Delete node test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should delete a node via config panel Delete button', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Add a Router node
    const routerCard = page.locator('.ant-card:has-text("Router")').first();
    await routerCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);

    // Verify node exists
    const nodesBefore = await page.locator('.react-flow__node').count();
    expect(nodesBefore).toBe(1);

    // Click the node to select it
    await page.locator('.react-flow__node-router').first().click();
    await page.waitForTimeout(500);

    // Click Delete button in config panel
    await page.locator('button:has-text("Delete")').click();
    await page.waitForTimeout(500);

    // Node should be removed
    const nodesAfter = await page.locator('.react-flow__node').count();
    expect(nodesAfter).toBe(0);

    // Sidebar should switch back to Add Node panel
    await expect(page.locator('text=ADD NODES')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  Router 节点配置                                                     */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — Router config panel', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Router Config', 'Router config test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should edit Router name and show Default Route checkbox', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Add a Router node
    const routerCard = page.locator('.ant-card:has-text("Router")').first();
    await routerCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);

    // Click the node to select it
    await page.locator('.react-flow__node-router').first().click();
    await page.waitForTimeout(500);

    // Should show config panel with Name input
    const nameInput = page.locator('input[placeholder="Route name"]');
    await expect(nameInput).toBeVisible();

    // Change the name
    await nameInput.clear();
    await nameInput.fill('PDF Documents');
    await page.waitForTimeout(300);

    // The node on canvas should update
    await expect(page.locator('.react-flow__node:has-text("PDF Documents")')).toBeVisible();

    // Should show Default Route checkbox
    await expect(page.locator('text=Default Route (catch-all)')).toBeVisible();

    // Should show Priority and File Extensions fields (non-default)
    await expect(page.locator('text=Priority')).toBeVisible();
    await expect(page.locator('text=File Extensions')).toBeVisible();
    await expect(page.locator('text=MIME Types')).toBeVisible();
    await expect(page.locator('text=Path Pattern')).toBeVisible();
  });

  test('should hide filter fields when Default Route is checked', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Add and select a Router node
    const routerCard = page.locator('.ant-card:has-text("Router")').first();
    await routerCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);
    await page.locator('.react-flow__node-router').first().click();
    await page.waitForTimeout(500);

    // Verify filter fields are visible
    await expect(page.locator('text=File Extensions')).toBeVisible();

    // Check the Default Route checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    await checkbox.check();
    await page.waitForTimeout(300);

    // Filter fields should be hidden
    await expect(page.locator('text=File Extensions')).not.toBeVisible();
    await expect(page.locator('text=Priority')).not.toBeVisible();

    // Node should show "Default" tag
    await expect(page.locator('.react-flow__node .ant-tag:has-text("Default")')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  保存与持久化                                                        */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — save and persist', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Save Persist', 'Save persist test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should save workflow and persist nodes after reload', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Add a Router node
    const routerCard = page.locator('.ant-card:has-text("Router")').first();
    await routerCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);

    // Rename the router
    await page.locator('.react-flow__node-router').first().click();
    await page.waitForTimeout(500);
    const nameInput = page.locator('input[placeholder="Route name"]');
    await nameInput.clear();
    await nameInput.fill('SavedRouter');
    await page.waitForTimeout(300);

    // Save button should be enabled
    const saveBtn = page.locator('button:has-text("Save")');
    await expect(saveBtn).toBeEnabled();

    // Click Save
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // Should see success message
    await expect(page.locator('text=Workflow saved')).toBeVisible();

    // Save button should be disabled again
    await expect(saveBtn).toBeDisabled();

    // Reload the page
    await page.reload();
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // The router node should still be there
    await expect(page.locator('.react-flow__node:has-text("SavedRouter")')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  Agent 面板切换                                                      */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — Agent panel', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Agent Panel', 'Agent panel test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should toggle Agent panel when clicking Agent button', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Initially, Add Node panel is shown
    await expect(page.locator('text=ADD NODES')).toBeVisible();

    // Click Agent button
    const agentBtn = page.locator('button:has-text("Agent")');
    await agentBtn.click();
    await page.waitForTimeout(500);

    // Agent Assistant panel should appear
    await expect(page.locator('text=Agent Assistant')).toBeVisible();

    // Add Node panel should be hidden
    await expect(page.locator('text=ADD NODES')).not.toBeVisible();

    // Click Agent button again to toggle off
    await agentBtn.click();
    await page.waitForTimeout(500);

    // Add Node panel should reappear
    await expect(page.locator('text=ADD NODES')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  React Flow 控件                                                    */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — React Flow controls', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E RF Controls', 'RF controls test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should show React Flow controls and minimap', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Controls panel (zoom in/out/fit)
    const controls = page.locator('.react-flow__controls');
    await expect(controls).toBeVisible();

    // MiniMap
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  反推兼容：routes → graph (无 graph_data 的旧 Workflow)               */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — backward compatibility (routesToGraph)', () => {
  let api: APIRequestContext;
  let workflowId: string;
  let pipelineId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();

    // Create a pipeline for the route
    const pip = await createPipeline(api, 'E2E BackCompat Pipeline');
    pipelineId = pip.id;

    // Create a workflow with routes but NO graph_data
    const wf = await createWorkflow(api, 'E2E BackCompat Workflow', 'Backward compat', {
      data_source_ids: [],
      routes: [
        {
          name: 'PDF Route',
          priority: 1,
          file_filter: { extensions: ['pdf', 'docx'] },
          pipeline_id: pipelineId,
          target_ids: [],
        },
      ],
      default_route: {
        name: 'Default Catch All',
        pipeline_id: pipelineId,
        target_ids: [],
      },
    });
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    if (pipelineId) await deletePipeline(api, pipelineId);
    await api.dispose();
  });

  test('should generate graph from routes and display nodes', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(3000);

    // The editor should have generated nodes from routes:
    // 1 route + 1 default route = 2 router nodes
    // 1 pipeline (shared) = 1 pipeline node
    const routerNodes = page.locator('.react-flow__node-router');
    const routerCount = await routerNodes.count();
    expect(routerCount).toBeGreaterThanOrEqual(1);

    // Should see the "PDF Route" router name
    await expect(page.locator('.react-flow__node:has-text("PDF Route")').first()).toBeVisible();

    // Should see the "Default" tag on the default router
    await expect(page.locator('.react-flow__node .ant-tag:has-text("Default")').first()).toBeVisible();

    // Should see the pipeline node
    const pipelineNodes = page.locator('.react-flow__node-pipeline');
    const pipCount = await pipelineNodes.count();
    expect(pipCount).toBeGreaterThanOrEqual(1);

    // Pipeline node should show the pipeline name
    await expect(
      page.locator('.react-flow__node:has-text("E2E BackCompat Pipeline")').first(),
    ).toBeVisible();
  });

  test('should show connections between nodes', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(3000);

    // React Flow edges (connections) should exist
    const edges = page.locator('.react-flow__edge');
    const edgeCount = await edges.count();
    expect(edgeCount).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Canvas 点击空白恢复 Add Node 面板                                     */
/* ------------------------------------------------------------------ */
test.describe('WorkflowEditor — pane click resets sidebar', () => {
  let api: APIRequestContext;
  let workflowId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    const wf = await createWorkflow(api, 'E2E Pane Click', 'Pane click test');
    workflowId = wf.id;
  });

  test.afterAll(async () => {
    if (workflowId) await deleteWorkflow(api, workflowId);
    await api.dispose();
  });

  test('should return to Add Node panel when clicking canvas background', async ({ page }) => {
    await page.goto(`/workflows/${workflowId}/edit`);
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Add and select a Router node to show config panel
    const routerCard = page.locator('.ant-card:has-text("Router")').first();
    await routerCard.locator('.anticon-plus').click();
    await page.waitForTimeout(500);
    await page.locator('.react-flow__node-router').first().click();
    await page.waitForTimeout(500);

    // Config panel should be visible
    await expect(page.locator('button:has-text("Delete")')).toBeVisible();
    await expect(page.locator('text=ADD NODES')).not.toBeVisible();

    // Click on the canvas background (React Flow pane)
    const pane = page.locator('.react-flow__pane');
    await pane.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(500);

    // Should return to Add Node panel
    await expect(page.locator('text=ADD NODES')).toBeVisible();
  });
});
