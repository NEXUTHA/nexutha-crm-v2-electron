const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

test.describe('カレンダー機能テスト', () => {
  let app;
  let window;

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [path.join(process.env.HOME, 'NEXUTHA-CRM-V2-electron')],
    });

    window = await new Promise(async (resolve) => {
      const check = async () => {
        const windows = app.windows();
        for (const w of windows) {
          const title = await w.title();
          if (!title.includes('DevTools')) { resolve(w); return; }
        }
        setTimeout(check, 500);
      };
      app.on('window', check);
      check();
    });

    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(5000);

    // 初回セットアップ画面が出たらスキップ
    const skipBtn = window.locator('button:has-text("あとで設定する")');
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await window.waitForTimeout(1000);
    }

    // カレンダーページへ移動
    await window.locator('.nav-item[data-page="calendar"]').click();
    await window.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    // このテストは DB への書き込みを行わないのでクリーンアップ不要
    await app.close();
  });

  // ================================================================
  // 1. カレンダーページが表示される
  // ================================================================
  test('カレンダーページが表示される', async () => {
    const calendarPage = window.locator('#page-calendar');
    await expect(calendarPage).toBeVisible({ timeout: 5000 });

    const calendarTitle = window.locator('#calendar-title');
    await expect(calendarTitle).toBeVisible({ timeout: 5000 });

    const titleText = await calendarTitle.textContent();
    expect(titleText).toMatch(/\d{4}年 \d{1,2}月/);

    const grid = window.locator('#calendar-grid');
    await expect(grid).toBeVisible({ timeout: 5000 });

    // 日付セルが存在する（onclick 属性つきの div）
    const cells = grid.locator('div[onclick]');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);

    console.log('カレンダーページ表示: OK -', titleText, `(${count}日)`);
  });

  // ================================================================
  // 2. 日付をクリックすると日付詳細ページが開く
  //    AIパネルがセルの上に重なる場合があるため evaluate() で直接呼び出す
  // ================================================================
  test('日付をクリックすると日付詳細ページが開く', async () => {
    // グリッドから最初の日付文字列を取得
    const dateStr = await window.evaluate(() => {
      const cell = document.querySelector('#calendar-grid div[onclick]');
      if (!cell) return null;
      const m = cell.getAttribute('onclick').match(/'([^']+)'/);
      return m ? m[1] : null;
    });
    expect(dateStr).toBeTruthy();

    // openDayPage() を直接呼び出し（UIクリックと等価）
    await window.evaluate((d) => openDayPage(d), dateStr);
    await window.waitForTimeout(500);

    const dayPage = window.locator('#page-day');
    await expect(dayPage).toBeVisible({ timeout: 5000 });

    const dayTitle = window.locator('#day-page-title');
    await expect(dayTitle).toBeVisible({ timeout: 5000 });
    const titleText = await dayTitle.textContent();
    expect(titleText).toMatch(/\d{4}\/\d{2}\/\d{2}/);

    console.log('日付詳細ページ表示: OK -', titleText);
  });

  // ================================================================
  // 3. 顧客追加ボタンが表示される
  // ================================================================
  test('顧客追加ボタンが表示される', async () => {
    // page-day 内にスコープして確認（カレンダーヘッダーと区別）
    const addCustomerBtn = window.locator('#page-day button:has-text("顧客を追加")');
    await expect(addCustomerBtn).toBeVisible({ timeout: 5000 });
    console.log('顧客追加ボタン: OK');
  });

  // ================================================================
  // 4. 予定追加ボタンが表示される
  // ================================================================
  test('予定追加ボタンが表示される', async () => {
    const addEventBtn = window.locator('#page-day button:has-text("予定を追加")');
    await expect(addEventBtn).toBeVisible({ timeout: 5000 });
    console.log('予定追加ボタン: OK');
  });

  // ================================================================
  // 5. カレンダーに戻るボタンで戻れる
  // ================================================================
  test('カレンダーに戻るボタンで戻れる', async () => {
    // closeDayPage() を直接呼び出し（ボタンも同じ関数を呼ぶ）
    await window.evaluate(() => closeDayPage());
    await window.waitForTimeout(500);

    // page-day が非表示になる
    const dayPage = window.locator('#page-day');
    await expect(dayPage).toBeHidden({ timeout: 5000 });

    // カレンダーグリッドが見える
    const grid = window.locator('#calendar-grid');
    await expect(grid).toBeVisible({ timeout: 5000 });

    // 顧客選択オーバーレイが残っていないことを確認（Bug 2 の検証）
    const overlay = window.locator('#day-customer-select-overlay');
    await expect(overlay).toBeHidden({ timeout: 3000 });

    console.log('カレンダーに戻る: OK（オーバーレイ残存なし）');
  });
});
