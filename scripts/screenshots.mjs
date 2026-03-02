#!/usr/bin/env node
/**
 * Capture screenshots of Money Flow for the README.
 * Run: npx playwright install chromium && node scripts/screenshots.mjs
 */
import { chromium } from 'playwright';

const BASE = 'https://localhost:5174';
const OUT = 'docs';
const VIEWPORT = { width: 1280, height: 900 };

async function main() {
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    ignoreHTTPSErrors: true,
    colorScheme: 'light',
  });
  const page = await ctx.newPage();

  // Disable File System Access API so the app falls through to IDB mode
  await page.addInitScript(() => {
    delete window.showDirectoryPicker;
  });

  // Navigate and wait for app to load (seeds default empty accounts)
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Dismiss IDB notice if present
  const dismissBtn = page.locator('button[aria-label="Dismiss"]');
  if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dismissBtn.click();
    await page.waitForTimeout(300);
  }

  // Inject demo data into the correct IDB database (money-flow-data / app-data store)
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('money-flow-data', 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('app-data')) {
          db.createObjectStore('app-data');
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('app-data', 'readwrite');
        const store = tx.objectStore('app-data');

        store.put([
          { id: 'acc-tax',       name: 'Tax Reserve',  balanceCents: 385000,  targetCents: 0, role: 'tax' },
          { id: 'acc-everyday',  name: 'Essentials',   balanceCents: 280000,  targetCents: 350000, role: 'spending' },
          { id: 'acc-fun',       name: 'Fun',          balanceCents: 52000,   targetCents: 80000, role: 'spending' },
          { id: 'acc-savings',   name: 'Savings',      balanceCents: 1200000, targetCents: 1500000, role: 'savings' },
          { id: 'acc-investing', name: 'Investing',    balanceCents: 450000,  targetCents: 600000, role: 'investing' },
        ], 'accounts');

        store.put({
          taxPct: 30,
          taxAccountId: 'acc-tax',
          overflowRatios: [
            { accountId: 'acc-everyday', pct: 50 },
            { accountId: 'acc-fun',      pct: 20 },
            { accountId: 'acc-savings',  pct: 20 },
            { accountId: 'acc-investing', pct: 10 },
          ],
          floorItems: [
            { id: 'fi-1', label: 'Rent',         amountCents: 120000, accountId: 'acc-everyday' },
            { id: 'fi-2', label: 'Utilities',     amountCents: 15000,  accountId: 'acc-everyday' },
            { id: 'fi-3', label: 'Subscriptions', amountCents: 4500,   accountId: 'acc-fun' },
          ],
          confirmedRecurring: [],
          theme: 'light',
        }, 'settings');

        store.put([
          {
            id: 'alloc-3',
            date: '2026-03-01',
            invoiceAmountCents: 450000,
            invoiceCurrency: 'EUR',
            invoiceEurEquivalentCents: 450000,
            source: 'Acme Corp',
            mode: 'distribute',
            moves: [
              { destinationAccountId: 'acc-tax', amountCents: 135000, calculation: '30% of €4,500.00', reason: 'Tax reserve' },
              { destinationAccountId: 'acc-everyday', amountCents: 157500, calculation: '50% of €3,150.00 post-tax', reason: 'Essentials (overflow)' },
              { destinationAccountId: 'acc-fun', amountCents: 63000, calculation: '20% of €3,150.00 post-tax', reason: 'Fun (overflow)' },
              { destinationAccountId: 'acc-savings', amountCents: 63000, calculation: '20% of €3,150.00 post-tax', reason: 'Savings (overflow)' },
              { destinationAccountId: 'acc-investing', amountCents: 31500, calculation: '10% of €3,150.00 post-tax', reason: 'Investing (overflow)' },
            ],
          },
          {
            id: 'alloc-2',
            date: '2026-02-15',
            invoiceAmountCents: 320000,
            invoiceCurrency: 'EUR',
            invoiceEurEquivalentCents: 320000,
            source: 'Widget Inc',
            mode: 'distribute',
            moves: [
              { destinationAccountId: 'acc-tax', amountCents: 96000, calculation: '30% of €3,200.00', reason: 'Tax reserve' },
              { destinationAccountId: 'acc-everyday', amountCents: 70000, calculation: 'Fill €700 toward €3,500 target', reason: 'Essentials (target fill)' },
              { destinationAccountId: 'acc-fun', amountCents: 28000, calculation: 'Fill €280 toward €800 target', reason: 'Fun (target fill)' },
              { destinationAccountId: 'acc-savings', amountCents: 85000, calculation: 'Pro-rata fill toward €15,000 target', reason: 'Savings (target fill)' },
              { destinationAccountId: 'acc-investing', amountCents: 41000, calculation: 'Pro-rata fill toward €6,000 target', reason: 'Investing (target fill)' },
            ],
          },
          {
            id: 'alloc-1',
            date: '2026-01-20',
            invoiceAmountCents: 550000,
            invoiceCurrency: 'EUR',
            invoiceEurEquivalentCents: 550000,
            source: 'TechStart Ltd',
            mode: 'distribute',
            moves: [
              { destinationAccountId: 'acc-tax', amountCents: 165000, calculation: '30% of €5,500.00', reason: 'Tax reserve' },
              { destinationAccountId: 'acc-everyday', amountCents: 192500, calculation: '50% of €3,850.00 post-tax', reason: 'Essentials (overflow)' },
              { destinationAccountId: 'acc-fun', amountCents: 77000, calculation: '20% of €3,850.00 post-tax', reason: 'Fun (overflow)' },
              { destinationAccountId: 'acc-savings', amountCents: 77000, calculation: '20% of €3,850.00 post-tax', reason: 'Savings (overflow)' },
              { destinationAccountId: 'acc-investing', amountCents: 38500, calculation: '10% of €3,850.00 post-tax', reason: 'Investing (overflow)' },
            ],
          },
        ], 'history');

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });

  // Reload to pick up seeded data
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Dismiss IDB notice again if present
  const dismissBtn2 = page.locator('button[aria-label="Dismiss"]');
  if (await dismissBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dismissBtn2.click();
    await page.waitForTimeout(300);
  }

  // Wait for account cards to render
  await page.waitForTimeout(500);

  // --- Screenshot 1: Dashboard with accounts ---
  await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });
  console.log('Captured: dashboard.png');

  // --- Screenshot 2: Enter an invoice and show allocation ---
  const amountInput = page.locator('input[inputmode="decimal"]');
  if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await amountInput.fill('4500');
    // Fill the source field
    const sourceInput = page.locator('input[placeholder*="client"]');
    if (await sourceInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sourceInput.fill('Acme Corp');
    }
    const calcBtn = page.getByRole('button', { name: /calculate/i });
    if (await calcBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await calcBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/allocation.png`, fullPage: true });
      console.log('Captured: allocation.png');

      // Check off a couple of moves to show the verification flow
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      if (count >= 2) {
        await checkboxes.nth(0).check();
        await page.waitForTimeout(300);
        await checkboxes.nth(1).check();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/verification.png`, fullPage: true });
        console.log('Captured: verification.png');
      }

      // Cancel to go back to entry
      const cancelBtn = page.getByRole('button', { name: /cancel/i });
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // --- Screenshot 3: History page ---
  await page.click('nav button:has-text("History")');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/history.png`, fullPage: true });
  console.log('Captured: history.png');

  // --- Screenshot 4: Settings page ---
  await page.click('nav button:has-text("Settings")');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/settings.png`, fullPage: true });
  console.log('Captured: settings.png');

  // --- Screenshot 5: Dark mode dashboard ---
  await page.click('nav button:has-text("Dashboard")');
  await page.waitForTimeout(300);
  // Force dark mode by adding class directly and clicking the toggle
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  const themeBtn = page.locator('button[aria-label*="theme"]');
  if (await themeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await themeBtn.click(); // light -> dark
    await page.waitForTimeout(500);
  }
  // Ensure dark class is set (belt and suspenders)
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/dark-mode.png`, fullPage: true });
  console.log('Captured: dark-mode.png');

  await browser.close();
  console.log('\nAll screenshots saved to docs/');
}

main().catch(e => { console.error(e); process.exit(1); });
