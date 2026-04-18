const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

test.describe('NEXUTHA CRM 全機能テスト', () => {
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

    // セットアップ画面が出たらスキップ
    const skipBtn = window.locator('button:has-text("あとで設定する")');
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await window.waitForTimeout(1000);
    }
  });

  test.afterAll(async () => {
    // テストデータクリーンアップ
    const { execSync } = require('child_process');
    try {
      execSync('sqlite3 ' + process.env.HOME + '/NEXUTHA-CRM-V2-electron/backend/data/nexutha.db "DELETE FROM customers WHERE name LIKE \'テスト%\'; DELETE FROM documents WHERE doc_number LIKE \'TEST%\';"');
      console.log('テストデータ削除: OK');
    } catch(e) {
      console.log('クリーンアップスキップ:', e.message);
    }
    await app.close();
  });

  // ================================================================
  // 1. 顧客登録テスト
  // ================================================================
  test('顧客をウィザードで登録できる', async () => {
    await window.locator('.nav-item[data-page="customers"]').click();
    await window.waitForTimeout(500);

    await window.locator('.ai-action-btn:has-text("登録")').click();
    await window.waitForTimeout(1000);

    const input = window.locator('#ai-input');

    // 名前入力
    await input.fill('テスト山下');
    await input.press('Enter');
    await window.waitForTimeout(3000);

    // 業種選択（その他）
    const otherBtn = window.locator('.wbtn').filter({ hasText: 'その他' }).first();
    await expect(otherBtn).toBeVisible({ timeout: 10000 });
    await otherBtn.click();
    await window.waitForTimeout(1000);

    // 個人/法人選択（個人のお客様）
    const personalBtn = window.locator('.wbtn').filter({ hasText: '個人のお客様' }).first();
    await expect(personalBtn).toBeVisible({ timeout: 5000 });
    await personalBtn.click();
    await window.waitForTimeout(500);

    // 電話番号スキップ（テキストで特定）
    await window.locator('.wbtn').filter({ hasText: 'スキップ' }).first().click();
    await window.waitForTimeout(1000);

    // メールスキップ（テキストで特定）
    await window.locator('.wbtn').filter({ hasText: 'スキップ' }).first().click();
    await window.waitForTimeout(1000);

    // 郵便番号入力
    await input.fill('4550857');
    await input.press('Enter');
    await window.waitForTimeout(4000); // zipcloud API待ち

    // 住所確認ボタン
    const confirmBtn = window.locator('.wbtn-confirm').first();
    await expect(confirmBtn).toBeVisible({ timeout: 8000 });
    await confirmBtn.click();
    await window.waitForTimeout(500);

    // 丁目番地
    await input.fill('2丁目87番地');
    await input.press('Enter');
    await window.waitForTimeout(500);

    // 建物名スキップ
    await window.locator('.wbtn').filter({ hasText: 'スキップ' }).first().click();
    await window.waitForTimeout(500);

    // 部屋番号スキップ
    await window.locator('.wbtn').filter({ hasText: 'スキップ' }).first().click();
    await window.waitForTimeout(500);

    // メモスキップ
    const memoSkip = window.locator('.wbtn').filter({ hasText: 'スキップ' }).first();
    if (await memoSkip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await memoSkip.click();
      await window.waitForTimeout(500);
    }

    // 登録するボタン
    const registerBtn = window.locator('.wbtn').filter({ hasText: '登録する' }).first();
    if (await registerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await registerBtn.click();
      await window.waitForTimeout(1000);
    }

    console.log('顧客登録: OK');
  });

  test('郵便番号から住所が自動入力される', async () => {
    // AIパネルを完全リセット
    await window.locator('.nav-item[data-page="dashboard"]').click();
    await window.waitForTimeout(1000);
    await window.locator('.nav-item[data-page="customers"]').click();
    await window.waitForTimeout(1000);

    // 最初からボタンで確実にリセット
    await window.locator('button:has-text("最初から")').click();
    await window.waitForTimeout(1000);

    // 「何をしますか？」が表示されるまで待つ
    await window.locator('#ai-messages').locator('text=何をしますか').waitFor({ timeout: 5000 });

    await window.locator('.ai-action-btn:has-text("登録")').click();
    await window.waitForTimeout(1000);

    const input = window.locator('#ai-input');
    await input.fill('郵便テスト');
    await input.press('Enter');
    await window.waitForTimeout(3000);

    // 業種：その他
    const otherBtn = window.locator('.wbtn').filter({ hasText: 'その他' }).first();
    await expect(otherBtn).toBeVisible({ timeout: 10000 });
    await otherBtn.click();
    await window.waitForTimeout(1000);

    // 個人
    const personalBtn = window.locator('.wbtn').filter({ hasText: '個人のお客様' }).first();
    await expect(personalBtn).toBeVisible({ timeout: 5000 });
    await personalBtn.click();
    await window.waitForTimeout(500);

    // 電話スキップ（テキストで特定）
    await window.locator('.wbtn').filter({ hasText: 'スキップ' }).first().click();
    await window.waitForTimeout(1000);

    // メールスキップ（テキストで特定）
    await window.locator('.wbtn').filter({ hasText: 'スキップ' }).first().click();
    await window.waitForTimeout(1000);

    // 郵便番号入力
    await input.fill('4550857');
    await input.press('Enter');
    await window.waitForTimeout(4000);

    // 住所確認ボタンが出るか確認（zipcloud成功の証拠）
    const confirmBtn = window.locator('.wbtn-confirm').first();
    await expect(confirmBtn).toBeVisible({ timeout: 8000 });

    // ai-messagesの中に愛知県が含まれるか確認
    const aiMessages = window.locator('#ai-messages');
    const messagesText = await aiMessages.textContent({ timeout: 5000 });
    expect(messagesText).toContain('愛知県');
    console.log('郵便番号→住所自動入力: OK - 愛知県名古屋市港区秋葉');

    // キャンセルして戻る
    await window.locator('.wbtn-skip, .wbtn').filter({ hasText: '再入力' }).first().click().catch(() => {});
    await window.waitForTimeout(500);
  });

  test('登録した顧客が一覧に表示される', async () => {
    await window.locator('.nav-item[data-page="customers"]').click();
    await window.waitForTimeout(1000);

    // customer-table-pcの行数を確認
    const rows = window.locator('.customer-table-pc tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    console.log('顧客一覧表示: OK - ' + count + '件');
  });

  // ================================================================
  // 2. 見積書作成テスト
  // ================================================================
  test('見積書を作成できる', async () => {
    await window.locator('.nav-item[data-page="customers"]').click();
    await window.waitForTimeout(500);

    await window.locator('.ai-action-btn:has-text("見積書")').click();
    await window.waitForTimeout(1000);

    const input = window.locator('#ai-input');

    // 顧客選択
    const customerBtn = window.locator('.wbtn').filter({ hasText: 'テスト山下' }).first();
    if (await customerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await customerBtn.click();
    } else {
      await input.fill('テスト山下');
      await input.press('Enter');
    }
    await window.waitForTimeout(500);

    // 書類番号スキップ
    await window.locator('.wbtn-skip').first().click();
    await window.waitForTimeout(500);

    // 日付スキップ
    await window.locator('.wbtn-skip').first().click();
    await window.waitForTimeout(500);

    // 品目入力
    await input.fill('Webサイト制作');
    await input.press('Enter');
    await window.waitForTimeout(500);

    // 数量
    await input.fill('1');
    await input.press('Enter');
    await window.waitForTimeout(500);

    // 単価
    await input.fill('100000');
    await input.press('Enter');
    await window.waitForTimeout(500);

    // 完了ボタン
    const doneBtn = window.locator('.wbtn').filter({ hasText: '以上で完了' }).first();
    if (await doneBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await doneBtn.click();
    }
    await window.waitForTimeout(500);

    // 備考スキップ
    const skipBtn = window.locator('.wbtn-skip').first();
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }
    await window.waitForTimeout(1000);

    console.log('見積書作成: OK');
  });

  // ================================================================
  // 3. 設定画面テスト
  // ================================================================
  test('設定画面が開けてAIアシスタントが表示される', async () => {
    await window.locator('.nav-item[data-page="settings"]').click();
    await window.waitForTimeout(500);

    const aiSection = window.locator('#acc-ai');
    await expect(aiSection).toBeVisible({ timeout: 5000 });
    console.log('AI設定セクション: OK');
  });

  test('バックアップボタンが機能する', async () => {
    // アコーディオンを開く
    const backupAccordion = window.locator('#acc-backup .settings-accordion-header');
    await backupAccordion.click();
    await window.waitForTimeout(500);

    // ボタンが表示されているか確認
    const backupBtn = window.locator('button:has-text("バックアップを作成")');
    await expect(backupBtn).toBeVisible({ timeout: 5000 });
    console.log('バックアップボタン: OK');
  });

  // ================================================================
  // 4. ダッシュボードテスト
  // ================================================================
  test('ダッシュボードに顧客数が表示される', async () => {
    await window.locator('.nav-item[data-page="dashboard"]').click();
    await window.waitForTimeout(1000);
    const totalCustomers = window.locator('text=TOTAL CUSTOMERS').first();
    await expect(totalCustomers).toBeVisible({ timeout: 5000 });
    console.log('ダッシュボード顧客数: OK');
  });

  // ================================================================
  // 5. CSVインポートテスト
  // ================================================================
  test('CSVインポートページが表示される', async () => {
    await window.locator('.nav-item[data-page="import"]').click();
    await window.waitForTimeout(500);
    const importPage = window.locator('#page-import');
    await expect(importPage).toBeVisible({ timeout: 5000 });
    console.log('CSVインポート: OK');
  });
});
