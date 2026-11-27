// End-to-end tests on the real Electron app (UI + IPC + SQLite + printing to PDF).
// Run with: npm run test:e2e   (on Linux CI wrap with xvfb-run)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, closeApp, waitForPdf, existing, tid, typeDate, choose } from './helpers.mjs';

describe('Sanad desktop app', () => {
  let ctx;
  let page;

  before(async () => {
    ctx = await launch();
    page = ctx.page;
  });

  after(async () => {
    if (ctx) await ctx.close();
  });

  const nav = (name) => page.locator(tid(`nav-${name}`)).click();
  const toast = () => page.locator('.toast').last();
  const chip = () => page.locator(tid('number-chip'));

  it('starts in Arabic, right-to-left, with the Eleva credit', async () => {
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
    assert.match(await page.locator('.credit').innerText(), /Eleva/);
    // first run: no book yet
    assert.match(await page.locator('.alert').innerText(), /لا يوجد دفتر مفتوح/);
  });

  it('creates a book of 3 notes', async () => {
    await nav('books');
    await page.locator(tid('book-create')).click();
    assert.match(await page.locator('.alert').innerText(), /اكتب اسم الدفتر/);

    await page.locator(tid('book-name')).fill('دفتر تجربة');
    await page.locator(tid('book-count')).fill('3');
    await page.locator(tid('book-create')).click();
    await toast().waitFor();
    const row = page.locator(tid('books-table')).locator('tbody tr').first();
    assert.match(await row.innerText(), /دفتر تجربة/);
    assert.match(await row.innerText(), /0 \/ 3/);
  });

  it('validates the note form', async () => {
    await nav('new');
    await chip().waitFor();
    assert.match(await chip().innerText(), /01 من 3/);
    await page.locator(tid('save')).click();
    assert.match(await page.locator('.alert').innerText(), /اكتب اسم المدين/);
    await page.locator(tid('debtor-name')).fill('محمد الزهراني');
    await page.locator(tid('save')).click();
    assert.match(await page.locator('.alert').innerText(), /اكتب المبلغ/);
  });

  it('writes the amount in words automatically and saves note 01', async () => {
    await page.locator(tid('amount')).fill('1500.25');
    assert.equal(
      await page.locator(tid('amount-words')).inputValue(),
      'ألف وخمسمائة ريال سعودي وخمسة وعشرون هللة فقط لا غير'
    );
    await page.locator(tid('debtor-id_number')).fill('1012345678');
    await page.locator(tid('debtor-id_source')).fill('الباحة');
    await typeDate(page, 'due-date', '15/03/2027');
    assert.equal(await page.locator(tid('due-date')).inputValue(), '15/03/2027');
    assert.match(await page.locator('.field', { has: page.locator(tid('due-date')) }).innerText(), /هجري/);

    await page.locator(tid('save')).click();
    await toast().waitFor();
    assert.match(await toast().innerText(), /01 من 3/);
  });

  it('numbers the next notes 02 and 03 and closes the full book', async () => {
    await page.locator(tid('new-voucher')).click();
    assert.match(await chip().innerText(), /02 من 3/);

    // customer search fills the saved debtor
    await page.locator(tid('debtor-search')).fill('1012');
    await page.getByRole('option').first().click();
    assert.equal(await page.locator(tid('debtor-name')).inputValue(), 'محمد الزهراني');
    assert.equal(await page.locator(tid('debtor-id_source')).inputValue(), 'الباحة');

    await page.locator(tid('amount')).fill('2000');
    await page.locator(tid('save')).click();
    await toast().waitFor();

    await page.locator(tid('new-voucher')).click();
    assert.match(await chip().innerText(), /03 من 3/);
    await page.locator(tid('debtor-name')).fill('سعيد الغامدي');
    await page.locator(tid('amount')).fill('3000');
    await page.locator(tid('save')).click();
    await page.locator('.toast', { hasText: '03 من 3' }).waitFor();

    await page.locator(tid('new-voucher')).click();
    assert.match(await page.locator('.alert').innerText(), /لا يوجد دفتر مفتوح/);

    await nav('books');
    const row = page.locator(tid('books-table')).locator('tbody tr').first();
    assert.match(await row.innerText(), /3 \/ 3/);
    assert.match(await row.innerText(), /مغلق/);
  });

  it('DateInput: calendar, typed Arabic digits and invalid dates', async () => {
    await nav('installments');
    const input = page.locator(tid('inst-issue'));

    await input.fill('٢٥/١٢/٢٠٢٦');
    await input.press('Enter');
    assert.equal(await input.inputValue(), '25/12/2026');

    await input.fill('31/02/2027');
    await input.press('Enter');
    assert.equal(await input.inputValue(), '25/12/2026', 'invalid date is rejected');

    // pick from the calendar: next month, day 10
    await input.click();
    const cal = page.getByRole('dialog');
    await cal.waitFor();
    assert.match(await cal.innerText(), /ديسمبر 2026/);
    assert.match(await cal.innerText(), /جمادى/); // Hijri month under the title
    await page.getByRole('button', { name: 'الشهر الجاي' }).click();
    assert.match(await cal.innerText(), /يناير 2027/);
    await cal.getByRole('gridcell', { name: '10/01/2027' }).click();
    assert.equal(await input.inputValue(), '10/01/2027');
    assert.equal(await cal.count(), 0, 'calendar closes after picking');

    // keyboard: open, move one day forward (ArrowLeft in RTL), Enter
    await input.click();
    await page.locator('.cal-day.focus').focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    assert.equal(await input.inputValue(), '11/01/2027');

    // Escape closes without changing
    await input.click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
  });

  it('Select: keyboard and mouse', async () => {
    const period = page.locator(tid('inst-period'));
    assert.equal(await period.innerText(), 'كل 1 شهر');
    await period.focus();
    await page.keyboard.press('ArrowDown'); // open
    assert.equal(await period.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await period.innerText(), 'كل 3 شهور');
    assert.equal(await period.getAttribute('aria-expanded'), 'false');

    await choose(page, 'inst-period', 'كل 6 شهور');
    assert.equal(await period.innerText(), 'كل 6 شهور');

    // clicking outside closes it
    await period.click();
    await page.locator('.page-head h1').click();
    assert.equal(await period.getAttribute('aria-expanded'), 'false');
  });

  it('installment book: 60,000 over 2 years every 3 months = 8 notes in one PDF', async () => {
    await choose(page, 'inst-period', 'كل 3 شهور');
    await page.locator(tid('inst-name')).fill('أقساط كامري');
    await page.locator(tid('inst-total')).fill('60000');
    await page.locator(tid('inst-years')).fill('2');
    await page.locator(tid('inst-months')).fill('0');
    await typeDate(page, 'inst-first-due', '01/01/2027');

    assert.equal(await page.locator(tid('sum-months')).innerText(), '24');
    assert.equal(await page.locator(tid('sum-count')).innerText(), '8');
    assert.equal(await page.locator(tid('sum-installment')).innerText(), '7,500.00');
    const rows = page.locator(tid('inst-table')).locator('tbody tr');
    assert.equal(await rows.count(), 8);
    assert.match(await rows.nth(7).innerText(), /01 \/ 10 \/ 2028/);

    // debtor is required
    await page.locator(tid('inst-create')).click();
    assert.match(await page.locator('.alert').innerText(), /اكتب اسم المدين/);

    await page.locator(tid('debtor-name')).fill('محمد الزهراني');
    await page.locator(tid('guarantor-name')).fill('سعيد الغامدي');
    await page.locator(tid('inst-create')).click();
    await page.locator(tid('inst-done-title')).waitFor();
    assert.match(await page.locator(tid('inst-done-title')).innerText(), /8/);

    const before = existing(ctx.previews);
    await page.locator(tid('inst-preview')).click();
    const pdf = await waitForPdf(ctx.previews, before);
    assert.equal(pdf.pages, 8);
    assert.equal(pdf.landscape, true, 'A5 landscape by default');
    assert.ok(Math.abs(pdf.width - 595.92) < 2 && Math.abs(pdf.height - 420) < 2, `A5 size, got ${pdf.width}x${pdf.height}`);
  });

  it('lists the installment notes with the right total', async () => {
    await page.locator(tid('inst-one-by-one')).click();
    const rows = page.locator(tid('vouchers-table')).locator('tbody tr');
    await rows.first().waitFor();
    assert.equal(await rows.count(), 8);
    assert.equal(await page.locator(tid('list-total')).innerText(), '60,000.00');
  });

  it('shows numbers and dates in the right order inside Arabic text', async () => {
    const visual = await page.evaluate(() => {
      // digits sorted by their on-screen x position, left to right
      const order = (el) => {
        const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const out = [];
        let n;
        while ((n = tw.nextNode())) {
          for (let i = 0; i < n.length; i++) {
            if (!/\d/.test(n.data[i])) continue;
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            out.push([n.data[i], r.getBoundingClientRect().left]);
          }
        }
        return out.sort((a, b) => a[1] - b[1]).map((x) => x[0]).join('');
      };
      const row = document.querySelector('[data-testid="vouchers-table"] tbody tr:last-child');
      const cells = row.querySelectorAll('td');
      return { number: order(row.querySelector('.num-pill')), due: order(cells[5]) };
    });
    assert.equal(visual.number, '018'); // "01 / 8"
    assert.equal(visual.due, '01012027'); // "01 / 01 / 2027"
  });

  it('previews a single note as one A5 landscape page', async () => {
    const first = page.locator(tid('vouchers-table')).locator('tbody tr').first();
    const id = (await first.getAttribute('data-testid')).replace('row-', '');
    const before = existing(ctx.previews);
    await page.locator(tid(`preview-${id}`)).click();
    const pdf = await waitForPdf(ctx.previews, before);
    assert.equal(pdf.pages, 1);
    assert.equal(pdf.landscape, true);
  });

  it('cancels a note; its number stays and the totals update', async () => {
    const first = page.locator(tid('vouchers-table')).locator('tbody tr').first();
    const id = (await first.getAttribute('data-testid')).replace('row-', '');
    await page.locator(tid(`void-${id}`)).click();
    await page.locator(tid('void-reason')).fill('خطأ في البيانات');
    await page.locator(tid('void-confirm')).click();
    await page.locator('.toast', { hasText: 'تم إلغاء السند' }).waitFor();
    assert.match(await page.locator(tid(`row-${id}`)).innerText(), /ملغي/);
    assert.equal(await page.locator(tid('list-total')).innerText(), '52,500.00');

    await choose(page, 'filter-status', 'ملغي');
    const rows = page.locator(tid('vouchers-table')).locator('tbody tr');
    await page.waitForTimeout(400);
    assert.equal(await rows.count(), 1);
    await choose(page, 'filter-status', 'كل الحالات');
  });

  it('searches notes by name and by number', async () => {
    await choose(page, 'filter-book', 'كل الدفاتر');
    await page.locator(tid('list-search')).fill('سعيد');
    await page.waitForTimeout(400);
    // guarantor of the 8 installment notes + debtor of note 03 in the first book
    assert.equal(await page.locator(tid('vouchers-table')).locator('tbody tr').count(), 9);
    await page.locator(tid('list-search')).fill('03');
    await page.waitForTimeout(400);
    assert.equal(await page.locator(tid('vouchers-table')).locator('tbody tr').count(), 2);
    await page.locator(tid('list-search')).fill('');
  });

  it('settings: paper size, switch and save', async () => {
    await nav('settings');
    const previewBefore = await page.locator('.preview-wrap').boundingBox();
    await choose(page, 'set-paper', 'A5 طولي (زي الورقة الأصلية)');
    const previewAfter = await page.locator('.preview-wrap').boundingBox();
    assert.ok(previewAfter.height > previewBefore.height, 'portrait preview is taller');

    const sw = page.locator(tid('set-silent'));
    assert.equal(await sw.getAttribute('aria-checked'), 'false');
    await sw.click();
    assert.equal(await sw.getAttribute('aria-checked'), 'true');
    await sw.click();

    await page.locator(tid('settings-save')).click();
    await page.locator('.toast', { hasText: 'تم حفظ الإعدادات' }).waitFor();
    const saved = await page.evaluate(() => window.sanad.settings.get());
    assert.equal(saved.data.paper, 'A5');

    // back to the default for the remaining checks
    await choose(page, 'set-paper', 'A5 عرضي (السند مقروء من غير لف)');
    await page.locator(tid('settings-save')).click();
  });

  it('switches to English, left-to-right, and back', async () => {
    await page.locator(tid('lang-toggle')).click();
    await page.waitForFunction(() => document.documentElement.dir === 'ltr');
    assert.match(await page.locator(tid('nav-new')).innerText(), /New note/);
    await nav('installments');
    assert.match(await page.locator('.page-head h1').innerText(), /Installment book/);
    // calendar in English
    await page.locator(tid('inst-issue')).click();
    assert.match(await page.getByRole('dialog').innerText(), /Sun/);
    await page.keyboard.press('Escape');

    await page.locator(tid('lang-toggle')).click();
    await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    assert.match(await page.locator(tid('nav-new')).innerText(), /سند جديد/);
  });

  it('data survives a restart', async () => {
    const dir = ctx.dir;
    await closeApp(ctx.app);
    const { _electron } = await import('playwright-core');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { ROOT } = await import('./helpers.mjs');
    const env = { ...process.env, SANAD_USER_DATA: dir, SANAD_PREVIEW_DIR: ctx.previews };
    delete env.VITE_DEV_SERVER_URL;
    ctx.app = await _electron.launch({
      executablePath: require('electron'),
      args: [ROOT, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
      env,
    });
    page = await ctx.app.firstWindow();
    await page.waitForSelector('.sidebar');
    const books = await page.evaluate(() => window.sanad.books.list());
    assert.equal(books.data.length, 2);
    const list = await page.evaluate(() => window.sanad.vouchers.list({}));
    assert.equal(list.data.length, 11);
  });
});
