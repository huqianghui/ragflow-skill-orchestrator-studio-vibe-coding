import { chromium } from 'playwright';

const BASE_URL = process.argv[2] || 'http://localhost:15173';

async function debugSkillsPage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture ALL console messages
  page.on('console', (msg) => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Capture page errors (uncaught exceptions)
  page.on('pageerror', (err) => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  // Capture ALL network requests and responses
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      console.log(`[REQ] ${req.method()} ${req.url()}`);
      console.log(`  Headers: ${JSON.stringify(req.headers())}`);
    }
  });

  page.on('response', async (resp) => {
    if (resp.url().includes('/api/')) {
      let body = '';
      try { body = await resp.text(); } catch { body = '<unable to read>'; }
      console.log(`[RESP] ${resp.status()} ${resp.statusText()} ${resp.url()}`);
      console.log(`  Headers: ${JSON.stringify(resp.headers())}`);
      console.log(`  Body: ${body.substring(0, 500)}`);
    }
  });

  page.on('requestfailed', (req) => {
    console.log(`[REQ FAILED] ${req.method()} ${req.url()}`);
    console.log(`  Error: ${req.failure()?.errorText}`);
  });

  try {
    console.log(`\n=== Testing: ${BASE_URL}/skills ===\n`);
    await page.goto(`${BASE_URL}/skills`, { waitUntil: 'networkidle', timeout: 15000 });

    await page.waitForTimeout(3000);

    const heading = await page.locator('h3').first().textContent().catch(() => 'NOT FOUND');
    console.log(`\nPage heading: ${heading}`);

    const rows = await page.locator('table tbody tr').count();
    console.log(`Table rows: ${rows}`);

    const errorMsgs = await page.locator('.ant-message-error').allTextContents();
    if (errorMsgs.length) console.log(`Error messages: ${errorMsgs.join(', ')}`);

    await page.screenshot({ path: '/tmp/skills-debug.png', fullPage: true });
    console.log('\nScreenshot: /tmp/skills-debug.png');
  } catch (err) {
    console.error('Navigation failed:', err.message);
    await page.screenshot({ path: '/tmp/skills-debug-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

debugSkillsPage();
