/**
 * E2E tests: Editor layout — header never disappears & Agent toggle works
 *
 * These tests verify the CRITICAL rule:
 *   The "Agentic RAGFlow Studio" header bar and left sidebar are FIXED shared
 *   elements that must NEVER move or disappear regardless of content area actions.
 *
 * Coverage:
 *   - SkillEditor: Agent toggle preserves header
 *   - PipelineEditor: Agent toggle preserves header
 *   - BuiltinSkillEditor: Agent toggle preserves header
 *   - Mutually exclusive panel mode: Config ↔ Agent panel switching
 *
 * Prerequisites:
 *   - Backend running on port 18000
 *   - Frontend running on port 15173 (or let playwright.config webServer start it)
 *   - At least one skill, pipeline, and builtin skill exist in the system
 */

import { test, expect, type Page } from '@playwright/test';

// ────────────────────────────────────────
// Helpers
// ────────────────────────────────────────

/** Wait for the app to fully load by checking the sidebar brand text */
async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=Agentic RAGFlow', { timeout: 15000 });
}

/** Assert the header bar is visible and within the viewport */
async function assertHeaderVisible(page: Page, context: string) {
  const header = page.locator('.ant-layout-header').first();
  await expect(header, `Header should be visible: ${context}`).toBeVisible();

  const box = await header.boundingBox();
  expect(box, `Header bounding box should exist: ${context}`).not.toBeNull();
  // Header top should be within viewport (not pushed off-screen)
  expect(box!.y, `Header y should be >= 0: ${context}`).toBeGreaterThanOrEqual(0);
  expect(box!.y, `Header y should be < 100px: ${context}`).toBeLessThan(100);
}

/** Assert the left sidebar is visible */
async function assertSidebarVisible(page: Page, context: string) {
  const sidebar = page.locator('.ant-layout-sider').first();
  await expect(sidebar, `Sidebar should be visible: ${context}`).toBeVisible();
}

/** Click the Agent toggle button in the page header */
async function clickAgentToggle(page: Page) {
  // The Agent button in PageHeader — look for button containing "Agent" text
  const agentBtn = page.locator('button').filter({ hasText: /Agent/i }).first();
  await expect(agentBtn).toBeVisible({ timeout: 5000 });
  await agentBtn.click();
  // Allow render to settle
  await page.waitForTimeout(500);
}

/** Check if Agent panel (Collapse with "Agent Assistant" label) is visible */
async function isAgentPanelVisible(page: Page): Promise<boolean> {
  const agentPanel = page.locator('text=Agent Assistant');
  return agentPanel.isVisible();
}

// ────────────────────────────────────────
// Test: SkillEditor
// ────────────────────────────────────────

test.describe('SkillEditor — Layout Integrity', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to skill library first, then pick the first editable skill
    await page.goto('/skills');
    await waitForAppReady(page);
    // Click the first "Edit" link in the skill table
    const editLink = page.locator('a').filter({ hasText: /Edit/i }).first();
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click();
      await page.waitForURL(/\/skills\/\d+/, { timeout: 10000 });
    } else {
      test.skip(true, 'No editable skill found — skipping SkillEditor tests');
    }
  });

  test('header stays visible through Agent toggle cycle', async ({ page }) => {
    await assertHeaderVisible(page, 'before Agent click');
    await assertSidebarVisible(page, 'before Agent click');

    // Toggle Agent ON
    await clickAgentToggle(page);
    await assertHeaderVisible(page, 'after Agent toggle ON');
    await assertSidebarVisible(page, 'after Agent toggle ON');
    expect(await isAgentPanelVisible(page)).toBe(true);

    // Toggle Agent OFF
    await clickAgentToggle(page);
    await assertHeaderVisible(page, 'after Agent toggle OFF');
    await assertSidebarVisible(page, 'after Agent toggle OFF');
  });

  test('mutually exclusive panels — Config hidden when Agent shown', async ({ page }) => {
    // Config panels should be visible initially
    const connectionPanel = page.locator('text=Connection Mappings');
    await expect(connectionPanel).toBeVisible();

    // Toggle Agent ON — Config should disappear
    await clickAgentToggle(page);
    await expect(connectionPanel).not.toBeVisible();
    expect(await isAgentPanelVisible(page)).toBe(true);

    // Toggle Agent OFF — Config should reappear
    await clickAgentToggle(page);
    await expect(connectionPanel).toBeVisible();
  });
});

// ────────────────────────────────────────
// Test: PipelineEditor
// ────────────────────────────────────────

test.describe('PipelineEditor — Layout Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pipelines');
    await waitForAppReady(page);
    // Click the first "Edit" or pipeline name link
    const editLink = page.locator('a').filter({ hasText: /Edit/i }).first();
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click();
      await page.waitForURL(/\/pipelines\/\d+/, { timeout: 10000 });
    } else {
      test.skip(true, 'No editable pipeline found — skipping PipelineEditor tests');
    }
  });

  test('header stays visible through Agent toggle cycle', async ({ page }) => {
    await assertHeaderVisible(page, 'before Agent click');
    await assertSidebarVisible(page, 'before Agent click');

    // Toggle Agent ON
    await clickAgentToggle(page);
    await assertHeaderVisible(page, 'after Agent toggle ON');
    await assertSidebarVisible(page, 'after Agent toggle ON');
    expect(await isAgentPanelVisible(page)).toBe(true);

    // Toggle Agent OFF
    await clickAgentToggle(page);
    await assertHeaderVisible(page, 'after Agent toggle OFF');
    await assertSidebarVisible(page, 'after Agent toggle OFF');
  });

  test('Agent panel height does not push header off-screen', async ({ page }) => {
    await clickAgentToggle(page);

    // Header must still be at the top
    const header = page.locator('.ant-layout-header').first();
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(5); // Should be at very top

    // Agent panel should be fully contained within viewport
    const agentContainer = page.locator('.ant-collapse-content-box').first();
    if (await agentContainer.isVisible()) {
      const agentBox = await agentContainer.boundingBox();
      if (agentBox) {
        expect(agentBox.y + agentBox.height).toBeLessThanOrEqual(900 + 10); // viewport height + tolerance
      }
    }
  });
});

// ────────────────────────────────────────
// Test: BuiltinSkillEditor
// ────────────────────────────────────────

test.describe('BuiltinSkillEditor — Layout Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/skills');
    await waitForAppReady(page);
    // Builtin skills typically show a "Configure" button instead of "Edit"
    const configLink = page.locator('a').filter({ hasText: /Configure/i }).first();
    if (await configLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await configLink.click();
      await page.waitForURL(/\/skills\/builtin\//, { timeout: 10000 });
    } else {
      test.skip(true, 'No configurable builtin skill found — skipping BuiltinSkillEditor tests');
    }
  });

  test('header stays visible through Agent toggle cycle', async ({ page }) => {
    await assertHeaderVisible(page, 'before Agent click');
    await assertSidebarVisible(page, 'before Agent click');

    // Toggle Agent ON
    await clickAgentToggle(page);
    await assertHeaderVisible(page, 'after Agent toggle ON');
    await assertSidebarVisible(page, 'after Agent toggle ON');
    expect(await isAgentPanelVisible(page)).toBe(true);

    // Toggle Agent OFF
    await clickAgentToggle(page);
    await assertHeaderVisible(page, 'after Agent toggle OFF');
    await assertSidebarVisible(page, 'after Agent toggle OFF');
  });
});

// ────────────────────────────────────────
// Test: Cross-page consistency
// ────────────────────────────────────────

test.describe('Cross-page — Layout height consistency', () => {
  test('all editor pages use correct container height (no overflow)', async ({ page }) => {
    // Visit each editor type and verify no vertical scrollbar on the main layout
    for (const path of ['/skills', '/pipelines']) {
      await page.goto(path);
      await waitForAppReady(page);

      // The main Layout should not have a vertical scrollbar
      const layoutContent = page.locator('.ant-layout-content').first();
      const hasOverflow = await layoutContent.evaluate((el) => {
        return el.scrollHeight > el.clientHeight;
      });
      // Content area should not overflow (which would push header off-screen on scroll)
      expect(hasOverflow, `${path} should not have content overflow`).toBe(false);
    }
  });
});
