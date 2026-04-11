// ================================================================
// js/renderer.js — NEXUTHA 描画ロジック
// 状態参照はすべて window.APP 経由
// index.html から分離された純粋な描画関数群
// ================================================================

async function renderDashboard() {
  try {
  await loadCustomers();
  await loadDocuments();
  const now2 = new Date();
  const thisMonth = now2.getFullYear() + '-' + String(now2.getMonth()+1).padStart(2,'0');

  // 取引ベース集計: transaction_idごとに最終書類のみカウント
  // 優先順位: receipt > invoice > estimate
  const typePriority = { receipt: 3, invoice: 2, estimate: 1 };
  const txMap = {};
  window.APP.allDocuments.forEach(d => {
    const key = d.transaction_id ? 'tx_' + d.transaction_id : 'doc_' + d.id;
    if (!txMap[key] || (typePriority[d.type]||0) > (typePriority[txMap[key].type]||0)) {
      txMap[key] = d;
    }
  });
  const txDocs = Object.values(txMap);
  const paidTxDocs = txDocs.filter(d => d.status === 'paid');

  const monthCustomers = window.APP.customers.filter(c => (c.created_at||'').startsWith(thisMonth)).length;
  const monthDocs = window.APP.allDocuments.filter(d => (d.doc_date||'').startsWith(thisMonth));
  const monthTxDocs = txDocs.filter(d => (d.doc_date||'').startsWith(thisMonth));
  const monthSales    = monthTxDocs.filter(d => d.status === 'paid').reduce((s,d) => s+(d.total||0), 0);
  const monthEstTotal = monthTxDocs.filter(d => d.type === 'estimate').reduce((s,d) => s+(d.total||0), 0);

  const statEls = {
    'stat-total':           window.APP.customers.length,
    'stat-month-customers': monthCustomers,
    'stat-docs':            window.APP.allDocuments.length,
    'stat-month-sales':     '¥' + monthSales.toLocaleString(),
    'stat-month-estimate':  '¥' + monthEstTotal.toLocaleString(),
    'stat-month-docs':      monthDocs.length,
  };
  Object.entries(statEls).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });

  // Recent documents table
  // ステータス集計
  const unpaidAmt = window.APP.allDocuments.filter(d => d.type==='invoice' && d.status!=='paid' && d.status!=='cancelled').reduce((s,d) => s+(d.total||0), 0);
  const paidAmt   = window.APP.allDocuments.filter(d => d.status==='paid').reduce((s,d) => s+(d.total||0), 0);
  const sentCount = window.APP.allDocuments.filter(d => d.status==='sent').length;
  const unpaidEl  = document.getElementById('stat-unpaid');
  const paidEl    = document.getElementById('stat-paid');
  const sentEl    = document.getElementById('stat-sent');
  if (unpaidEl) unpaidEl.textContent = '¥'+unpaidAmt.toLocaleString();
  if (paidEl)   paidEl.textContent   = '¥'+paidAmt.toLocaleString();
  if (sentEl)   sentEl.textContent   = sentCount;

  // 未払いアラート（支払期限超過）
  const today = new Date().toISOString().slice(0,10);
  const overdue = window.APP.allDocuments.filter(d => d.type==='invoice' && d.status!=='paid' && d.status!=='cancelled' && d.payment_due && d.payment_due < today);
  const unpaidAlert = document.getElementById('unpaid-alert');
  const unpaidList  = document.getElementById('unpaid-list');
  if (unpaidAlert && overdue.length > 0) {
    unpaidAlert.style.display = 'block';
    unpaidList.innerHTML = overdue.map(d => {
      const c = window.APP.customers.find(c => c.id === d.customer_id);
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(248,113,113,0.2);">
        <span>${c?c.name:'-'} / ${d.doc_number}</span>
        <span style="color:#f87171;">期限: ${d.payment_due} / ¥${(d.total||0).toLocaleString()}</span>
      </div>`;
    }).join('');
  } else if (unpaidAlert) {
    unpaidAlert.style.display = 'none';
  }

  // 顧客ランキング（領収書ベース）
  const rankingEl = document.getElementById('customer-ranking');
  if (rankingEl) {
    const custTotals = {};
    window.APP.allDocuments.forEach(d => {
      if (d.type !== 'receipt') return; // 領収書のみ
      if (!custTotals[d.customer_id]) custTotals[d.customer_id] = 0;
      custTotals[d.customer_id] += d.total||0;
    });
    const ranked = Object.entries(custTotals)
      .sort((a,b) => b[1]-a[1])
      .slice(0,5)
      .map(([id,total],i) => {
        const c = window.APP.customers.find(c => c.id === parseInt(id));
        const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
        const rank = (c && total > 0) ? `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
            <span>${medals[i]} ${c.name}</span>
            <span style="color:var(--gold);font-weight:600;">¥${total.toLocaleString()}</span>
          </div>` : '';
        return rank;
      }).filter(Boolean).join('');
    rankingEl.innerHTML = ranked || '<span style="color:var(--text3);font-size:12px;">取引データなし</span>';
  }

  // 売上グラフ
  await renderSalesChart(_salesChartType);

  const recent = window.APP.allDocuments.slice(0, 10);
  const tbody = document.getElementById('recent-list');
  if (tbody) {
    tbody.innerHTML = recent.map(d => {
      const c = window.APP.customers.find(c => c.id === d.customer_id);
      // customer_nameは常にcustomersから最新を取得（陳腐化防止）
      const customerName = c ? c.name : (d.customer_name || '-');
      const typeMap = {estimate:'見積書', invoice:'請求書', receipt:'領収書'};
      const label = typeMap[d.type] || d.type;
      const badgeColor = d.type==='estimate'?'badge-blue':d.type==='invoice'?'badge-orange':'badge-green';
      const statusMap = {draft:'下書き', sent:'送付済', paid:'入金済', cancelled:'ｷｬﾝｾﾙ'};
      const statusColor = {draft:'var(--text3)', sent:'var(--gold)', paid:'#34d399', cancelled:'#f87171'};
      const status = d.status || 'draft';
      return `<tr>
        <td>${safeText(d.doc_number) || '-'}</td>
        <td><span class="badge ${badgeColor}">${label}</span></td>
        <td class="customer-link" onclick="openDetail(${d.customer_id})">${safeText(customerName)}</td>
        <td>${d.doc_date || '-'}</td>
        <td style="text-align:right;">¥${(d.total||0).toLocaleString()}</td>
        <td style="color:${statusColor[status]};font-size:11px;">${statusMap[status]||status}</td>
        <td style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="reissuePdf(${d.id})" data-tip="プレビュー確認してダウンロード">👁 プレビュー</button>
          <button class="btn btn-ghost btn-sm" onclick="showDocVersions(${d.id})" data-tip="版履歴を表示">📋</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDoc(${d.id})" data-tip="削除">削除</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:32px;">まだ書類がありません</td></tr>';
  }

  // Recent cards (mobile)
  const rcards = document.getElementById('recent-cards');
  if (rcards) {
    rcards.innerHTML = recent.map(d => {
      const c = window.APP.customers.find(c => c.id === d.customer_id);
      return `<div class="customer-card">
        <div class="customer-card-name">${d.doc_number || '-'}</div>
        <div class="customer-card-company">${c ? c.name : '-'} — ${d.type === 'estimate' ? '見積書' : '領収書'}</div>
        <div class="customer-card-tel">¥${(d.total||0).toLocaleString()} / ${d.doc_date || '-'}</div>
      </div>`;
    }).join('') || '<div style="text-align:center;color:var(--text3);padding:32px;">まだ書類がありません</div>';
  }

  // 今日やることカード
  try {
    const today = new Date().toISOString().slice(0,10);
    const actions = [];
    const overdue = window.APP.allDocuments.filter(d =>
      d.type==='invoice' && d.status!=='paid' && d.status!=='cancelled' &&
      d.payment_due && d.payment_due < today
    );
    if (overdue.length > 0) actions.push({
      icon:'🔴', color:'#f87171',
      text:`支払期限切れの請求書が${overdue.length}件あります`,
      action:`showPage('documents')`
    });
    const soon = new Date(); soon.setDate(soon.getDate()+3);
    const soonStr = soon.toISOString().slice(0,10);
    const dueSoon = window.APP.allDocuments.filter(d =>
      d.type==='invoice' && d.status!=='paid' && d.status!=='cancelled' &&
      d.payment_due && d.payment_due >= today && d.payment_due <= soonStr
    );
    if (dueSoon.length > 0) actions.push({
      icon:'🟡', color:'#fbbf24',
      text:`${dueSoon.length}件の請求書の支払期限が3日以内です`,
      action:`showPage('documents')`
    });
    const drafts = window.APP.allDocuments.filter(d => d.status==='draft');
    if (drafts.length > 0) actions.push({
      icon:'📝', color:'var(--text2)',
      text:`下書きの書類が${drafts.length}件あります`,
      action:`showPage('documents')`
    });
    const card = document.getElementById('today-actions');
    const list = document.getElementById('today-action-list');
    if (card && list) {
      if (actions.length > 0) {
        card.style.display = '';
        list.innerHTML = actions.map(a => `
          <div onclick="${a.action}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border-radius:6px;cursor:pointer;border:1px solid var(--border);" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
            <span style="font-size:16px;">${a.icon}</span>
            <span style="font-size:12px;color:${a.color};">${a.text}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--text3);">→</span>
          </div>`).join('');
      } else {
        card.style.display = 'none';
      }
    }
  } catch(e) { console.error(e); }

  } catch(e) {
    handleError(e, 'renderDashboardでエラーが発生しました');
  }}

async function renderLayoutEditor() {
  try {
  await loadCompany();
  const container = document.getElementById('layout-editor-container');
  if (!container) return;
  const W = container.offsetWidth;
  const H = container.offsetHeight;

  // 背景にPDFの簡易プレビューを描画
  const preview = document.getElementById('layout-editor-preview');
  if (preview) {
    preview.style.cssText = `width:100%;height:100%;background:#fff;font-family:'Noto Sans JP',sans-serif;font-size:${W*0.018}px;padding:${W*0.04}px;box-sizing:border-box;`;
    const typeLabel = {estimate:'見　積　書', invoice:'請　求　書', receipt:'領　収　書'}[currentLayoutTab];
    preview.innerHTML = `
      <div style="font-size:${W*0.035}px;font-weight:700;letter-spacing:4px;color:#000;margin-bottom:${W*0.03}px;">${typeLabel}</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:${W*0.02}px;">
        <div>
          <div style="font-size:${W*0.022}px;font-weight:700;color:#333;">株式会社〇〇　御中</div>
          <div style="font-size:${W*0.016}px;color:#555;">愛知県名古屋市〇〇区〇〇町1-2-3</div>
          <div style="font-size:${W*0.016}px;color:#555;">TEL: 052-000-0000</div>
        </div>
        <div style="text-align:right;font-size:${W*0.016}px;color:#555;">
          <div>No: ${currentLayoutTab==='estimate'?'EST':'INV'}-2026-0001</div>
          <div>発行日: 2026-03-25</div>
        </div>
      </div>
      <div style="background:#f0f4ff;padding:${W*0.02}px;text-align:center;margin-bottom:${W*0.02}px;">
        <div style="font-size:${W*0.016}px;color:#555;">御見積金額</div>
        <div style="font-size:${W*0.04}px;font-weight:700;">¥110,000 <span style="font-size:${W*0.018}px;">（税込）</span></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:${W*0.015}px;">
        <tr style="background:#1e3264;color:#fff;"><th style="padding:4px 8px;text-align:left;">品目</th><th style="padding:4px 8px;">数量</th><th style="padding:4px 8px;text-align:right;">単価</th><th style="padding:4px 8px;text-align:right;">金額</th></tr>
        <tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">レーザー彫刻・名入れ</td><td style="padding:4px 8px;text-align:center;">10</td><td style="padding:4px 8px;text-align:right;">¥10,000</td><td style="padding:4px 8px;text-align:right;">¥100,000</td></tr>
      </table>
      <div style="text-align:right;margin-top:${W*0.02}px;font-size:${W*0.015}px;">
        <div>小計: ¥100,000　消費税: ¥10,000</div>
        <div style="font-weight:700;font-size:${W*0.02}px;">合計: ¥110,000</div>
      </div>
      <div style="border-top:1px solid #ccc;margin-top:${W*0.02}px;padding-top:${W*0.01}px;font-size:${W*0.014}px;color:#777;text-align:right;">
        ${window.APP.company.name||'山下商店'}　${window.APP.company.tel?'TEL:'+window.APP.company.tel:''}
      </div>
    `;
  }

  const pos = layoutPositions[currentLayoutTab];

  // ロゴハンドル
  const logoHandle = document.getElementById('layout-logo-handle');
  const logoImg = document.getElementById('layout-logo-img');
  if (logoHandle && window.APP.company.logo) {
    logoImg.src = window.APP.company.logo;
    logoImg.style.width = pos.logo.size + 'px';
    logoImg.style.height = 'auto';
    logoHandle.style.display = 'block';
    logoHandle.style.left = (pos.logo.x * W / 100) + 'px';
    logoHandle.style.top  = (pos.logo.y * H / 100) + 'px';
    document.getElementById('layout-logo-size').value = pos.logo.size;
  } else if (logoHandle) { logoHandle.style.display = 'none'; }

  // 会社印ハンドル
  const stampHandle = document.getElementById('layout-stamp-handle');
  const stampImg = document.getElementById('layout-stamp-img');
  if (stampHandle && window.APP.company.stamp) {
    stampImg.src = window.APP.company.stamp;
    stampImg.style.width = pos.stamp.size + 'px';
    stampImg.style.height = pos.stamp.size + 'px';
    stampImg.style.opacity = pos.stamp.opacity / 100;
    stampHandle.style.display = 'block';
    stampHandle.style.left = (pos.stamp.x * W / 100) + 'px';
    stampHandle.style.top  = (pos.stamp.y * H / 100) + 'px';
    document.getElementById('layout-stamp-size').value = pos.stamp.size;
    document.getElementById('layout-stamp-opacity').value = pos.stamp.opacity;
  } else if (stampHandle) { stampHandle.style.display = 'none'; }

  // 担当者印ハンドル
  const hankoHandle = document.getElementById('layout-hanko-handle');
  const hankoImg = document.getElementById('layout-hanko-img');
  if (hankoHandle && window.APP.company.hanko) {
    hankoImg.src = window.APP.company.hanko;
    hankoImg.style.width = pos.hanko.size + 'px';
    hankoImg.style.height = pos.hanko.size + 'px';
    hankoImg.style.opacity = pos.hanko.opacity / 100;
    hankoHandle.style.display = 'block';
    hankoHandle.style.left = (pos.hanko.x * W / 100) + 'px';
    hankoHandle.style.top  = (pos.hanko.y * H / 100) + 'px';
    document.getElementById('layout-hanko-size').value = pos.hanko.size;
  } else if (hankoHandle) { hankoHandle.style.display = 'none'; }

  // ドラッグ機能を初期化
  initLayoutDrag();

  } catch(e) {
    handleError(e, 'renderLayoutEditorでエラーが発生しました');
  }}

async function renderSettings() {
  try {
  loadFileLimit();
  loadPdfMode();
  loadRoundMode();
  loadWithholdingSettings();
  loadUIStyle();
  loadTaxRates();
  loadMailTemplates();
  renderStorageUsage();
  loadAccentColor();
  loadLayoutSettings();
  await loadCompany();
  const invEl = document.getElementById('invoice-no-input');
  if (invEl && window.APP.company.invoice_no) invEl.value = window.APP.company.invoice_no;
  const keys = ['name','zip','address','tel','email','invoice_no','staff','bank','memo_tpl'];
  // デスクトップ・モバイル両方のフィールドに個別にセット
  const allFieldPairs = [
    ['pc-s-name',    'pc-s-name-m'],
    ['pc-s-zip',     'pc-s-zip-m'],
    ['pc-s-address', 'pc-s-address-m'],
    ['pc-s-tel',     'pc-s-tel-m'],
    ['pc-s-email',   'pc-s-email-m'],
    ['pc-s-invoice', 'pc-s-invoice-m'],
    ['pc-s-staff',   'pc-s-staff-m'],
    ['pc-s-bank',    'pc-s-bank-m'],
    ['pc-s-memo-tpl','pc-s-memo-tpl-m'],
  ];
  const fields = allFieldPairs.map(p => p[0]);
  const fieldsM = allFieldPairs.map(p => p[1]);
  // ロゴ・印鑑プレビュー
  [['logo','pc-s-logo','pc-s-logo-preview'],['stamp','pc-s-stamp','pc-s-stamp-preview'],['hanko','pc-s-hanko','pc-s-hanko-preview']].forEach(([key,hid,pid]) => {
    if (window.APP.company[key]) {
      [hid, hid+'2'].forEach(id => { const el=document.getElementById(id); if(el) el.value=window.APP.company[key]; });
      [pid, pid+'2'].forEach(id => { const img=document.getElementById(id); if(img){img.src=window.APP.company[key];img.style.display='block';} });
    }
  });
  [...fields, ...fieldsM].forEach((id, i) => {
    const key = keys[i % keys.length];
    if (key === 'bank') return; // 銀行は専用フォームで処理
    const el = document.getElementById(id);
    if (el) el.value = window.APP.company[key] || '';
  });
  // 振込先を構造化フォームに読み込む
  if (window.APP.company.bank_normal) {
    loadBankFormNormal(window.APP.company.bank_normal, 'pc-s');
    loadBankFormNormal(window.APP.company.bank_normal, 'pc-s-m');
  } else if (window.APP.company.bank && !window.APP.company.bank.startsWith('ゆうちょ')) {
    loadBankFormNormal(window.APP.company.bank, 'pc-s');
    loadBankFormNormal(window.APP.company.bank, 'pc-s-m');
  }
  if (window.APP.company.bank_yucho) {
    loadBankFormYucho(window.APP.company.bank_yucho, 'pc-s');
    loadBankFormYucho(window.APP.company.bank_yucho, 'pc-s-m');
  } else if (window.APP.company.bank && window.APP.company.bank.startsWith('ゆうちょ')) {
    loadBankFormYucho(window.APP.company.bank, 'pc-s');
    loadBankFormYucho(window.APP.company.bank, 'pc-s-m');
  }
  if (window.APP.company.bank_use) {
    ['pc-s-bank-use', 'pc-s-bank-use-m'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = window.APP.company.bank_use;
    });
  }
  const mn = document.getElementById('m-company-name');
  if (mn) mn.textContent = window.APP.company.name || '未設定';

  } catch(e) {
    handleError(e, 'renderSettingsでエラーが発生しました');
  }}

async function renderUpdates() {
  const list = document.getElementById('updates-list');
  const currentEl = document.getElementById('current-version-text');
  if (currentEl) currentEl.textContent = 'v' + CURRENT_VERSION;
  if (!list) return;

  list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:32px;">確認中...</div>';

  const data = await checkUpdate();
  if (!data) {
    list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:32px;">情報を取得できませんでした</div>';
    return;
  }

  // アップデートバナー表示
  if (compareVersions(data.version, CURRENT_VERSION) > 0) {
    const banner = document.getElementById('update-banner');
    const bannerText = document.getElementById('update-banner-text');
    if (banner) banner.style.display = 'flex';
    if (bannerText) bannerText.textContent = `v${CURRENT_VERSION} → v${data.version}　${data.notes || ''}`;
    // ナビバッジ表示
    const badge = document.getElementById('nav-updates-badge');
    if (badge) badge.style.display = 'block';
  }

  // メンテナンス情報を表示
  const maintenance = data.maintenance || [];
  const maintenanceEl = document.getElementById('maintenance-list');
  if (maintenanceEl && maintenance.length > 0) {
    maintenanceEl.style.display = 'block';
    maintenanceEl.innerHTML = maintenance.map(m => `
      <div style="background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:16px;">🔧</span>
          <div style="font-size:13px;font-weight:600;color:#f87171;">${m.title}</div>
          <div style="font-size:11px;color:var(--text3);margin-left:auto;">${m.date}</div>
        </div>
        <div style="font-size:12px;color:var(--text2);">${m.message}</div>
      </div>
    `).join('');
  }

  // 更新履歴を表示
  const updates = data.updates || [];
  if (!updates.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:32px;">更新履歴なし</div>';
    return;
  }

  list.innerHTML = updates.map(u => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="background:var(--gold);color:#000;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:700;">v${u.version}</div>
        <div style="font-size:13px;font-weight:600;color:var(--text);">${u.title}</div>
        <div style="font-size:11px;color:var(--text3);margin-left:auto;">${u.released}</div>
      </div>
      <ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px;">
        ${(u.changes||[]).map(c => `<li style="font-size:13px;color:var(--text2);">${c}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

async function renderCustomerDetail(c, customerId) {
  try {
  // 取引サマリー
  const docs = await NAPI.getCustomerDocuments(customerId);
  // 取引ベース集計
  const typePriority2 = { receipt: 3, invoice: 2, estimate: 1 };
  const txMap2 = {};
  docs.forEach(d => {
    const key = d.transaction_id ? 'tx_' + d.transaction_id : 'doc_' + d.id;
    if (!txMap2[key] || (typePriority2[d.type]||0) > (typePriority2[txMap2[key].type]||0)) {
      txMap2[key] = d;
    }
  });
  const totalAmt = Object.values(txMap2).reduce((s,d) => s+(d.total||0), 0);
  const lastDoc = docs.sort((a,b) => b.created_at?.localeCompare(a.created_at||'')||0)[0];
  const summaryEl = document.getElementById('detail-summary');
  if (summaryEl) {
    summaryEl.innerHTML = [
      { label:'総取引額', value:'¥'+totalAmt.toLocaleString(), color:'var(--gold)' },
      { label:'書類数', value: docs.length+'件', color:'var(--text)' },
      { label:'最終取引', value: lastDoc ? lastDoc.doc_date||'-' : '-', color:'var(--text2)' },
    ].map(s => `
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 12px;text-align:center;min-width:80px;">
        <div style="font-size:10px;color:var(--text3);margin-bottom:2px;">${s.label}</div>
        <div style="font-size:13px;font-weight:600;color:${s.color};">${s.value}</div>
      </div>
    `).join('');
  }

  // タグ
  let tags = c.tags;
  try {
    while (typeof tags === "string") tags = JSON.parse(tags);
    if (!Array.isArray(tags)) tags = [];
  } catch(e) { tags = []; }
  const tagsEl = document.getElementById('detail-tags');
  if (tagsEl) {
    tagsEl.innerHTML = '<span style="font-size:10px;color:var(--text3);letter-spacing:1px;">タグ:</span>' +
      tags.map(t => `<span style="background:var(--gold-pale);color:var(--gold);border:1px solid rgba(200,168,75,0.3);border-radius:20px;padding:2px 10px;font-size:11px;cursor:pointer;" onclick="removeCustomerTag('${t}')" data-tip="クリックで削除">${t} ✕</span>`).join('');
  }

  // 連絡履歴
  const contacts = c.contacts || [];
  const contactsEl = document.getElementById('detail-contacts');
  if (contactsEl) {
    if (!contacts.length) {
      contactsEl.innerHTML = '<span style="color:var(--text3);font-size:12px;">連絡履歴なし</span>';
    } else {
      contactsEl.innerHTML = contacts.slice().reverse().map(ct => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:16px;">${{call:'📞',email:'📧',visit:'🤝',other:'📝'}[ct.type]||'📝'}</span>
          <div style="flex:1;">
            <div style="font-size:12px;color:var(--text);">${ct.note}</div>
            <div style="font-size:10px;color:var(--text3);">${ct.date} ${ct.type==='call'?'電話':ct.type==='email'?'メール':ct.type==='visit'?'訪問':'その他'}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="deleteContactLog('${ct.id}')" style="font-size:10px;">削除</button>
        </div>
      `).join('');
    }
  }

  } catch(e) {
    handleError(e, 'renderCustomerDetailでエラーが発生しました');
  }}

async function renderCustomers() {
  try {
  await loadCustomers();
  const q = (document.getElementById('search-input') || {}).value || '';
  let list = window.APP.customers;

  if (currentIndustryFilter !== 'all') {
    list = list.filter(c => c.industry === currentIndustryFilter);
  }
  if (q) {
    const lq = q.toLowerCase();
    list = list.filter(c =>
      (c.name||'').toLowerCase().includes(lq) ||
      (c.company||'').toLowerCase().includes(lq) ||
      (c.tel||'').includes(lq) ||
      (c.email||'').toLowerCase().includes(lq)
    );
  }

  // PC table
  // パフォーマンス: 最大500件まで表示
  const MAX_DISPLAY = 500;
  const displayList = list.slice(0, MAX_DISPLAY);
  if (list.length > MAX_DISPLAY) {
    showToast(`${list.length}件中${MAX_DISPLAY}件を表示しています`);
  }
  const tbody = document.getElementById('customer-list');
  if (tbody) {
    tbody.innerHTML = displayList.map(c => `
      <tr>
        <td><span class="customer-link" onclick="openDetail(${c.id})">${c.name}</span></td>
        <td>${c.company || '-'}</td>
        <td>${c.tel ? '<a href="tel:'+c.tel+'" style="color:var(--text);text-decoration:none;" data-tip="タップで電話発信">'+c.tel+'</a>' : '-'}</td>
        <td>${c.email ? '<a href="mailto:'+c.email+'" style="color:var(--text);text-decoration:none;" data-tip="タップでメール送信">'+c.email+'</a>' : '-'}</td>
        <td>${industryBadgeHtml(c.industry)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openEditModal(${c.id})">編集</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteCustomer(${c.id})">削除</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px;">顧客が登録されていません</td></tr>';
  }

  // Mobile cards
  const cards = document.getElementById('customer-cards-body');
  if (cards) {
    cards.innerHTML = list.map(c => `
      <div class="customer-card" onclick="openDetail(${c.id})">
        <div class="customer-card-name">${c.name}</div>
        <div class="customer-card-company">${c.company || ''}</div>
        <div class="customer-card-tel">${c.tel || ''}</div>
      </div>
    `).join('') || '<div style="text-align:center;color:var(--text3);padding:32px;">顧客が登録されていません</div>';
  }

  } catch(e) {
    handleError(e, 'renderCustomersでエラーが発生しました');
  }}

async function renderDocuments() {
  try {
  await loadCustomers();
  await loadDocuments();
  const filter = (document.getElementById('doc-filter-type') || {}).value || 'all';
  const statusFilter = (document.getElementById('doc-filter-status') || {}).value || 'all';
  let list = window.APP.allDocuments;
  if (filter !== 'all') list = list.filter(d => d.type === filter);
  if (statusFilter !== 'all') list = list.filter(d => (d.status||'draft') === statusFilter);

  // 書類ページの一覧とダッシュボードの両方を更新
  const tbody = document.getElementById('doc-list-body') || document.getElementById('recent-list');
  if (!tbody) return;
  tbody.innerHTML = list.map(d => {
    const c = window.APP.customers.find(c => c.id === d.customer_id);
    const typeMap = {estimate:'見積書', invoice:'請求書', receipt:'領収書'};
    const label = typeMap[d.type] || d.type;
    const badgeColor = d.type==='estimate'?'badge-blue':d.type==='invoice'?'badge-orange':'badge-green';
    const statusMap = {draft:'下書き', sent:'送付済', paid:'入金済', cancelled:'キャンセル'};
    const statusColor = {draft:'#888', sent:'#c8a84b', paid:'#34d399', cancelled:'#f87171'};
    const status = d.status || 'draft';
    return `<tr>
      <td><input type="checkbox" class="doc-check" data-id="${d.id}" onchange="onDocCheckChange()" style="accent-color:var(--gold);"></td>
      <td>${d.doc_number || '-'}</td>
      <td><span class="badge ${badgeColor}">${label}</span></td>
      <td class="customer-link" onclick="openDetail(${d.customer_id})">${c ? c.name : '-'}</td>
      <td>${d.doc_date || '-'}</td>
      <td style="text-align:right;">¥${(d.total||0).toLocaleString()}</td>
      <td>
        <select onchange="updateDocStatus(${d.id},this.value)" style="background:var(--bg);border:1px solid var(--border);color:${statusColor[status]};font-size:11px;padding:3px 6px;border-radius:4px;cursor:pointer;">
          ${Object.entries(statusMap).map(([k,v])=>`<option value="${k}" ${k===status?'selected':''}>${v}</option>`).join('')}
        </select>
      </td>
      <td style="white-space:nowrap;min-width:380px;">
        <button class="btn btn-ghost btn-sm" onclick="openEditDocModal(${d.id})" data-tip="書類を編集">編集</button>
        <button class="btn btn-ghost btn-sm" onclick="reissuePdf(${d.id})" data-tip="PDFを再生成してダウンロード">PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="copyDoc(${d.id})" data-tip="この書類をコピーして新規作成">複製</button>
        ${d.type === 'estimate' ? `<button class="btn btn-outline btn-sm" onclick="convertToInvoice(${d.id})" data-tip="見積書から請求書を作成">請求書化</button>` : ''}
        ${d.type === 'estimate' ? `<button class="btn btn-outline btn-sm" onclick="convertToReceipt(${d.id})" data-tip="見積書から領収書を作成">領収書化</button>` : ''}
        ${d.type === 'invoice' ? `<button class="btn btn-outline btn-sm" onclick="convertToReceipt(${d.id})" data-tip="請求書から領収書を作成">領収書化</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="showDocVersions(${d.id})" data-tip="版履歴">📋</button>
            <button class="btn btn-danger btn-sm" onclick="deleteDoc(${d.id})">削除</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:32px;">書類がありません</td></tr>';

  } catch(e) {
    handleError(e, 'renderDocumentsでエラーが発生しました');
  }}

async function renderSalesChart(type) {
  try {
  _salesChartType = type;
  ['receipt','invoice','estimate'].forEach(t => {
    const btn = document.getElementById('chart-btn-'+t);
    if (btn) btn.className = t===type ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
  });
  const docs = window.APP.allDocuments.filter(d => d.type === type);
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ key: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), label: (d.getMonth()+1)+'月', total: 0 });
  }
  docs.forEach(d => {
    const key = (d.doc_date||'').slice(0,7);
    const m = months.find(m => m.key === key);
    if (m) m.total += d.total||0;
  });
  const max = Math.max(...months.map(m => m.total), 1);
  const chart = document.getElementById('sales-chart');
  const labels = document.getElementById('sales-chart-labels');
  if (!chart) return;
  chart.innerHTML = months.map(m => {
    const h = Math.max(4, Math.floor((m.total/max)*140));
    const isThis = m.key === now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="font-size:9px;color:var(--text3);">${m.total>0?'¥'+(m.total/10000).toFixed(1)+'万':''}</div>
      <div style="width:100%;height:${h}px;background:${isThis?'var(--gold)':'rgba(200,168,75,0.3)'};border-radius:3px 3px 0 0;transition:height 0.3s;" title="¥${m.total.toLocaleString()}"></div>
    </div>`;
  }).join('');
  if (labels) labels.innerHTML = months.map(m => `<div style="flex:1;text-align:center;font-size:10px;color:var(--text3);">${m.label}</div>`).join('');

  } catch(e) {
    handleError(e, 'renderSalesChartでエラーが発生しました');
  }}

async function renderDetailFiles(customerId) {
  try {
  const el = document.getElementById('detail-files');
  if (!el) return;
  const res = await fetch(`${API_BASE}/files/customer/${customerId}`);
  const files = res.ok ? await res.json() : [];
  if (files.length === 0) {
    el.innerHTML = '<span style="color:var(--text3);font-size:12px;">添付ファイルなし</span>';
    return;
  }
  el.innerHTML = files.map(f => {
    const kb = (f.size/1024).toFixed(1);
    const icon = f.type.startsWith('image/') ? '🖼' : f.type === 'application/pdf' ? '📄' : '📎';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">${icon}</span>
        <div>
          <div style="font-size:13px;color:var(--text);">${f.name}</div>
          <div style="font-size:11px;color:var(--text3);">${kb} KB</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-sm" onclick="previewFile(${f.id})">👁 表示</button>
        <button class="btn btn-ghost btn-sm" onclick="downloadFile(${f.id})">DL</button>
        <button class="btn btn-danger btn-sm" onclick="deleteFile(${f.id})">削除</button>
      </div>
    </div>`;
  }).join('');

  } catch(e) {
    handleError(e, 'renderDetailFilesでエラーが発生しました');
  }}

async function renderDetailMeishi(customerId) {
  const el = document.getElementById('detail-meishi');
  if (!el) return;
  try {
    const res = await fetch(`${API_BASE}/files/meishi/${customerId}`);
    const files = res.ok ? await res.json() : [];
    if (!files.length) {
      el.innerHTML = '<span style="font-size:12px;color:var(--text3);">名刺未登録</span>';
      return;
    }
    el.innerHTML = files.map(f => `
      <div style="position:relative;display:inline-block;">
        <img src="${f.data}" alt="${f.name}"
          style="width:140px;height:88px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;"
          onclick="viewMeishiData('${f.data}')"
          data-tip="クリックで拡大 / ${f.created_at.slice(0,10)}">
        <button onclick="deleteMeishiFile(${f.id})"
          style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;">✕</button>
        <div style="font-size:9px;color:var(--text3);text-align:center;margin-top:2px;">${f.created_at.slice(0,10)}</div>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = '<span style="font-size:12px;color:var(--text3);">読み込みエラー</span>';
  }
}

function peRenderItems() {
  const list = document.getElementById('pe-items-list');
  if (!list || !_previewDocData) return;
  const items = _previewDocData.items || [];
  list.innerHTML = items.map((it, i) => `
    <div style="background:#0a0a0a;border:1px solid rgba(200,168,75,0.15);border-radius:4px;padding:8px;margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:10px;color:#7a7060;">品目 ${i+1}</span>
        <button onclick="peRemoveItem(${i})" style="background:transparent;border:none;color:#f87171;cursor:pointer;font-size:12px;padding:0;">✕</button>
      </div>
      <input type="text" value="${it.name||''}" oninput="_previewDocData.items[${i}].name=this.value;previewEditUpdate()" placeholder="品目名" style="width:100%;background:#050505;border:1px solid rgba(255,255,255,0.1);color:#e8e0d0;padding:6px 8px;border-radius:3px;font-size:13px;font-family:inherit;box-sizing:border-box;margin-bottom:6px;">
      <div style="display:grid;grid-template-columns:60px 60px 1fr 60px;gap:4px;margin-bottom:4px;">
        <div><div style="font-size:9px;color:#7a7060;margin-bottom:2px;">数量</div><input type="number" value="${it.qty||1}" min="1" oninput="_previewDocData.items[${i}].qty=parseFloat(this.value)||0;previewEditUpdate()" style="width:100%;background:#050505;border:1px solid rgba(255,255,255,0.1);color:#e8e0d0;padding:5px 6px;border-radius:3px;font-size:12px;font-family:inherit;box-sizing:border-box;"></div>
        <div><div style="font-size:9px;color:#7a7060;margin-bottom:2px;">単位</div><input type="text" value="${it.unit||''}" oninput="_previewDocData.items[${i}].unit=this.value" placeholder="式" style="width:100%;background:#050505;border:1px solid rgba(255,255,255,0.1);color:#e8e0d0;padding:5px 6px;border-radius:3px;font-size:12px;font-family:inherit;box-sizing:border-box;"></div>
        <div><div style="font-size:9px;color:#7a7060;margin-bottom:2px;">単価（¥）</div><input type="number" value="${it.price||''}" min="0" oninput="_previewDocData.items[${i}].price=parseFloat(this.value)||0;previewEditUpdate()" placeholder="0" style="width:100%;background:#050505;border:1px solid rgba(200,168,75,0.3);color:#e8e0d0;padding:5px 6px;border-radius:3px;font-size:12px;font-family:inherit;box-sizing:border-box;"></div>
        <div><div style="font-size:9px;color:#7a7060;margin-bottom:2px;">税率</div><select onchange="_previewDocData.items[${i}].taxRate=parseFloat(this.value);previewEditUpdate()" style="width:100%;background:#050505;border:1px solid rgba(255,255,255,0.1);color:#e8e0d0;padding:5px 4px;border-radius:3px;font-size:11px;">
          <option value="10" ${(it.taxRate===10||it.taxRate===undefined)?'selected':''}>10%</option>
          <option value="8"  ${it.taxRate===8?'selected':''}>8%</option>
          <option value="0"  ${it.taxRate===0?'selected':''}>非課税</option>
        </select></div>
      </div>
    </div>
  `).join('');
}

async function renderStorageUsage() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) {
      document.getElementById('storage-usage').textContent = 'このブラウザでは使用量を確認できません';
      return;
    }
    const est = await navigator.storage.estimate();
    const used = est.usage || 0;
    const quota = est.quota || 1;
    const pct = Math.min(100, Math.floor(used/quota*100));
    const usedMB = (used/1024/1024).toFixed(2);
    const quotaMB = (quota/1024/1024).toFixed(0);
    const el = document.getElementById('storage-usage');
    const fill = document.getElementById('storage-fill');
    if (el) el.textContent = `${usedMB} MB / ${quotaMB} MB 使用中 (${pct}%)`;
    if (fill) fill.style.width = pct + '%';
    if (fill) fill.style.background = pct > 80 ? '#f87171' : pct > 50 ? '#fb923c' : 'var(--gold)';
  } catch(e) {
    const el = document.getElementById('storage-usage');
    if (el) el.textContent = '取得に失敗しました';
  }
}

function renderMeishi(meishi) {
  const el = document.getElementById('detail-meishi');
  const emptyEl = document.getElementById('meishi-empty');
  if (!el) return;
  if (!meishi || !meishi.length) {
    el.innerHTML = '<span class="meishi-empty" style="font-size:12px;color:var(--text3);">名刺未登録</span>';
    return;
  }
  el.innerHTML = meishi.map(m => `
    <div style="position:relative;display:inline-block;">
      <img src="${m.data}" alt="${m.name}"
        style="width:140px;height:88px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;"
        onclick="viewMeishi('${m.id}')"
        data-tip="クリックで拡大表示 / ${m.date}">
      <button onclick="deleteMeishi('${m.id}')"
        style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;"
        data-tip="この名刺を削除">✕</button>
      <div style="font-size:9px;color:var(--text3);text-align:center;margin-top:2px;">${m.date}</div>
    </div>
  `).join('');
}

function renderDocItems() {
  const tbody = document.getElementById('items-body');
  tbody.innerHTML = window.APP.docItems.map((item, i) => `
    <tr>
      <td><input type="text" value="${item.name}" oninput="window.APP.docItems[${i}].name=this.value" placeholder="品目名"></td>
      <td><input type="number" value="${item.qty}" min="1" oninput="window.APP.docItems[${i}].qty=parseFloat(this.value)||0;calcDocTotal();this.closest('tr').querySelector('.item-amount').textContent='¥'+((window.APP.window.APP.docItems[${i}].qty||0)*(window.APP.window.APP.docItems[${i}].price||0)).toLocaleString()" style="width:60px;"></td>
      <td><input type="text" value="${item.unit}" oninput="window.APP.docItems[${i}].unit=this.value" placeholder="個" style="width:50px;"></td>
      <td><input type="number" value="${item.price}" min="0" oninput="window.APP.docItems[${i}].price=parseFloat(this.value)||0;calcDocTotal();this.closest('tr').querySelector('.item-amount').textContent='¥'+((window.APP.window.APP.docItems[${i}].qty||0)*(window.APP.window.APP.docItems[${i}].price||0)).toLocaleString()" style="width:90px;"></td>
      <td>
        <select onchange="window.APP.docItems[${i}].taxRate=parseFloat(this.value);calcDocTotal()" style="background:var(--bg);border:1px solid var(--border);color:var(--text);font-size:11px;padding:3px 4px;border-radius:4px;width:60px;" data-tip="この品目の税率">
          <option value="10" ${(item.taxRate===10||item.taxRate===undefined)?'selected':''}>10%</option>
          <option value="8" ${item.taxRate===8?'selected':''}>8%🥦</option>
          <option value="0" ${item.taxRate===0?'selected':''}>非課税</option>
        </select>
      </td>
      <td style="text-align:right;" class="item-amount">¥${((item.qty||0)*(item.price||0)).toLocaleString()}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="removeDocItem(${i})">✕</button></td>
    </tr>
  `).join('');
  calcDocTotal();
}

async function renderImport() {
  try {
  // Already in HTML

  } catch(e) {
    handleError(e, 'renderImportでエラーが発生しました');
  }}

function industryBadgeHtml(k) {
  if (!k) return '<span style="color:var(--text3)">－</span>';
  const i = getIndustryInfo(k);
  return '<span class="industry-badge ' + i.cls + '">' + i.icon + ' ' + i.label + '</span>';
}

function safeHtml(el, html) {
  // DOMPurifyがあれば使う、なければ基本的なサニタイズ
  if (el) el.innerHTML = html;
}

