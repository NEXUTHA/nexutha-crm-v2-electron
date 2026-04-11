// ================================================================
// js/pdf.js — NEXUTHA PDF生成・プレビュー・レイアウト
// 状態参照はすべて window.APP 経由
// ================================================================

async function generatePDF(docData, customer) {
  const mode = localStorage.getItem('nexutha_pdf_mode') || 'preview_edit';
  if (mode === 'download') {
    // 即ダウンロード
    try {
      await generatePDF_html2canvas(docData, customer);
    } catch(e) {
      console.warn('html2canvas失敗:', e);
      generatePDF_print(docData, customer);
    }
  } else {
    // プレビューを表示
    await showPdfPreview(docData, customer);
  }
}

async function generatePdfHtml(el, docData, customer, company) {
  if (!company) company = await loadCompany();
  // 書類にbankがない場合は会社設定のbankを使用（請求書・見積書のみ）
  if (!docData.bank && window.APP.company.bank && docData.type !== 'receipt') {
    docData = { ...docData, bank: window.APP.company.bank };
  }
  const typeLabels = {estimate:'見　積　書', invoice:'請　求　書', receipt:'領　収　書'};
  const label = typeLabels[docData.type] || '書　類';
  const totalLabelMap = {estimate:'御見積金額', invoice:'ご請求金額', receipt:'領収金額'};
  const totalLabel = totalLabelMap[docData.type] || '合計金額';
  const isReceipt = docData.type === 'receipt';
  const honorific = docData.honorific || '様';
  const atenaFull = (docData.atena || (customer ? customer.name : docData.customer_name||'')) + ' ' + honorific;
  const taxRate_ = docData.taxRate ?? docData.tax_rate ?? 10;
  const taxLabel = taxRate_ === 0 ? '（税なし）' : `（税込${taxRate_}%）`;
  let discountAmt = 0;
  if (docData.discount) {
    const dStr = String(docData.discount).trim();
    discountAmt = dStr.endsWith('%') ? Math.floor((docData.subtotal||0)*parseFloat(dStr)/100) : parseFloat(dStr)||0;
  }
  const finalTotal = (docData.total||0) - discountAmt - (docData.withholding||0);
  const stampHtml = (!docData._imagePositions && docData.show_stamp && window.APP.company.stamp)
    ? `<img src="${window.APP.company.stamp}" style="width:60px;height:60px;opacity:0.85;object-fit:contain;">`
    : (!docData._imagePositions && docData.show_stamp ? `<div style="width:60px;height:60px;border:2px solid #c00;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#c00;">${window.APP.company.name||'印'}</div>` : '');
  const hankoHtml = (!docData._imagePositions && docData.staff && window.APP.company.hanko)
    ? `<img src="${window.APP.company.hanko}" style="width:36px;height:36px;opacity:0.85;object-fit:contain;vertical-align:middle;margin-left:4px;">` : '';
  el.innerHTML = `
    ${docData.reissued ? '<div style="text-align:right;color:#c00;font-size:11px;margin-bottom:4px;font-weight:700;">【再発行】</div>' : ''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div style="font-size:26px;font-weight:700;letter-spacing:6px;">${label}</div>
  
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
      <div style="flex:1;">
        ${customer && customer.company ? `<div style="font-size:14px;font-weight:600;margin-bottom:2px;">${customer.company}</div><div style="font-size:17px;font-weight:700;margin-bottom:4px;">${(docData.atena || (customer ? customer.name : '')) + ' ' + (docData.honorific || '様')}</div>` : `<div style="font-size:17px;font-weight:700;margin-bottom:4px;">${atenaFull}</div>`}
        ${customer && customer.zip ? `<div style="font-size:11px;color:#222;">〒${customer.zip}</div>` : ''}
          ${customer && customer.address ? `<div style="font-size:11px;color:#222;">${customer.address}</div>` : ''}
        ${customer && customer.tel ? `<div style="font-size:11px;color:#222;">TEL: ${customer.tel}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:11px;color:#222;line-height:1.9;min-width:180px;">
        <div>No: <strong>${docData.doc_number||''}</strong></div>
        <div>発行日: ${docData.doc_date||''}</div>
        ${docData.validity ? `<div style="color:#e65;">有効期限: ${docData.validity}</div>` : ''}
        ${docData.payment_due ? `<div style="color:#c60;">支払期限: ${docData.payment_due}</div>` : ''}
      </div>
    </div>
    <div style="background:#f0f4ff;border-radius:4px;padding:16px;text-align:center;margin-bottom:20px;">
      <div style="font-size:12px;color:#222;margin-bottom:4px;">${totalLabel}</div>
      <div style="font-size:28px;font-weight:700;">¥${finalTotal.toLocaleString()} <span style="font-size:13px;">${taxLabel}</span></div>
      ${discountAmt > 0 ? `<div style="font-size:11px;color:#e65;margin-top:4px;">（割引 -¥${discountAmt.toLocaleString()} 適用済み）</div>` : ''}
    </div>
    ${isReceipt && docData.notes ? `<div style="margin-bottom:16px;font-size:12px;padding:10px 14px;border-left:4px solid #1e3264;background:#f8f9ff;">但し書き: <strong>${docData.notes}</strong></div>` : ''}
    ${!isReceipt && docData.notes ? `<div style="margin-bottom:16px;font-size:12px;padding:4px 0;"><strong>件名:</strong> ${docData.notes}</div>` : ''}
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;">
      <thead><tr style="background:#1e3264;color:#fff;">
        <th style="padding:8px 10px;text-align:left;">品目・内容</th>
        <th style="padding:8px 10px;text-align:right;width:55px;">数量</th>
        <th style="padding:8px 10px;text-align:left;width:38px;">単位</th>
        <th style="padding:8px 10px;text-align:right;width:88px;">単価</th>
        <th style="padding:8px 10px;text-align:right;width:88px;">金額</th>
      </tr></thead>
      <tbody>${(docData.items||[]).filter(it=>it.name).map((it,i)=>`
        <tr style="background:${i%2===0?'#fff':'#f8f8f8'};">
          <td style="padding:7px 10px;border-bottom:1px solid #eee;color:#111;">${it.name}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;color:#111;">${it.qty||0}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #eee;color:#111;">${it.unit||''}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;color:#111;">¥${(it.price||0).toLocaleString()}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;color:#111;font-weight:600;">¥${((it.qty||0)*(it.price||0)).toLocaleString()}</td>
        </tr>`).join('')}</tbody>
    </table>
    <div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <table style="font-size:12px;">
        <tr><td style="padding:3px 16px;color:#222;">小計</td><td style="padding:3px 16px;text-align:right;color:#111;">¥${(docData.subtotal||0).toLocaleString()}</td></tr>
        ${(docData.tax8||0)>0?`<tr><td style="padding:3px 16px;color:#222;">消費税（軽減8%）</td><td style="padding:3px 16px;text-align:right;color:#111;">¥${(docData.tax8||0).toLocaleString()}</td></tr>`:''}
        ${(docData.tax10||0)>0||(docData.tax8||0)===0?`<tr><td style="padding:3px 16px;color:#222;">消費税（${docData.taxRate||10}%）</td><td style="padding:3px 16px;text-align:right;color:#111;">¥${((docData.tax10||(docData.tax8?0:docData.tax))||0).toLocaleString()}</td></tr>`:''}
        ${discountAmt>0?`<tr><td style="padding:3px 16px;color:#e65;">割引</td><td style="padding:3px 16px;text-align:right;color:#e65;">-¥${discountAmt.toLocaleString()}</td></tr>`:''}
        ${(docData.withholding||0)>0?`<tr><td style="padding:3px 16px;color:#e65;">源泉徴収税</td><td style="padding:3px 16px;text-align:right;color:#e65;">-¥${(docData.withholding||0).toLocaleString()}</td></tr>`:''}
        <tr style="font-weight:700;font-size:14px;border-top:2px solid #000;">
          <td style="padding:8px 16px;color:#111;">合計</td>
          <td style="padding:8px 16px;text-align:right;color:#111;">¥${finalTotal.toLocaleString()}</td>
        </tr>
      </table>
    </div>
    ${docData.memo ? `<div style="margin-bottom:12px;padding:10px 14px;border:1px solid #eee;border-radius:4px;font-size:11px;color:#222;white-space:pre-wrap;"><strong>備考:</strong> ${docData.memo}</div>` : ''}
    <div style="margin-top:auto;border-top:1px solid #ccc;padding-top:12px;padding-bottom:8px;font-size:10px;color:#222;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div style="flex:1;">
          ${docData.bank ? `<div style="margin-bottom:6px;"><div style="font-size:11px;font-weight:600;color:#111;margin-bottom:2px;">振込先</div>${formatBankForPdf(docData.bank).replace(/<strong>振込先<\/strong><br>/,'').replace(/<br>/g,'<br>')}</div>` : ''}
          ${docData.invoice_no ? `<div style="font-size:10px;color:#222;">登録番号: ${docData.invoice_no}</div>` : (window.APP.company.invoice_no ? `<div style="font-size:10px;color:#222;">登録番号: ${window.APP.company.invoice_no}</div>` : '')}
        </div>
        <div style="text-align:right;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;">
            ${stampHtml}
            <div>
              <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:2px;">${window.APP.company.name||'（会社名未設定）'}</div>
              ${window.APP.company.zip ? `<div style="font-size:11px;color:#222;">〒${window.APP.company.zip}</div>` : ''}
              ${window.APP.company.address ? `<div style="font-size:11px;color:#222;">${window.APP.company.address}</div>` : ''}
              <div style="font-size:11px;color:#222;">${[window.APP.company.tel?'TEL:'+window.APP.company.tel:'',window.APP.company.email].filter(Boolean).join('　')}</div>
              ${docData.staff ? `<div style="font-size:11px;color:#222;margin-top:2px;">担当: ${docData.staff} ${hankoHtml}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;
}

async function generatePDF_html2canvas(docData, customer) {
  try {
  // ローディング表示
  const loadingEl = document.createElement('div');
  loadingEl.id = 'pdf-loading';
  loadingEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
  loadingEl.innerHTML = '<div style="width:48px;height:48px;border:3px solid rgba(200,168,75,0.3);border-top-color:#c8a84b;border-radius:50%;animation:spin 0.8s linear infinite;"></div><div style="color:#c8a84b;font-size:14px;letter-spacing:2px;">PDF生成中...</div>';
  document.body.appendChild(loadingEl);

  await loadCompany();
  const typeLabels = {estimate:'見　積　書', invoice:'請　求　書', receipt:'領　収　書'};
  const label = typeLabels[docData.type] || '書　類';
  const totalLabelMap = {estimate:'御見積金額', invoice:'ご請求金額', receipt:'領収金額'};
  const totalLabel = totalLabelMap[docData.type] || '合計金額';

  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;background:#fff;color:#000;font-family:"Noto Sans JP",sans-serif;font-size:13px;padding:48px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;';
  await generatePdfHtml(el, docData, customer, window.APP.company);
  // プレビューで設定した画像配置を反映
  if (docData._imagePositions) {
    const pos = docData._imagePositions;
    const company2 = await loadCompany();
    // el内の既存ロゴ・印鑑imgを削除（重複防止）
    el.querySelectorAll('img[data-pdf-image]').forEach(i => i.remove());
    // elをrelativeにしてから絶対配置で追加
    el.style.position = 'relative';
    ['logo','stamp','hanko'].forEach(key => {
      const p = pos[key];
      if (!p || p.visible === false) return;
      const src = key==='logo' ? company2.logo : key==='stamp' ? company2.stamp : company2.hanko;
      if (!src) return;
      const imgEl = document.createElement('img');
      imgEl.src = src;
      imgEl.setAttribute('data-pdf-image', key);
      // %→px変換（PDF生成時は794x1123固定）
      const pdfW = 794, pdfH = 1123;
      const px = p.x / 100 * pdfW;
      const py = p.y / 100 * pdfH;
      imgEl.style.cssText = `position:absolute;left:${px}px;top:${py}px;width:${p.size}px;${key!=='logo'?'height:'+p.size+'px;':''}opacity:${(p.opacity||100)/100};pointer-events:none;z-index:10;`;
      el.appendChild(imgEl);
    });
  }

  document.body.appendChild(el);

  try {
    await document.fonts.ready;
    const canvas = await html2canvas(el, { scale:3, useCORS:true, backgroundColor:'#ffffff', allowTaint:true });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W = 210, H = 297;
    const imgH = (canvas.height * W) / canvas.width;
    if (imgH <= H) {
      pdf.addImage(imgData, 'JPEG', 0, 0, W, imgH);
    } else {
      // 複数ページ対応（行切れ防止：テーブル行の境界でページを区切る）
      const pageHeightPx = Math.floor(canvas.width * H / W);
      const rows = el.querySelectorAll('tr');
      let breakPoints = [0]; // ページ区切り位置（px）
      let currentPageHeight = 0;

      rows.forEach(row => {
        const rowTop = row.getBoundingClientRect().top - el.getBoundingClientRect().top;
        const rowH   = row.offsetHeight;
        const scaledTop = rowTop * (canvas.width / el.offsetWidth);
        const scaledH   = rowH   * (canvas.width / el.offsetWidth);
        if (currentPageHeight + scaledH > pageHeightPx * 0.9) {
          breakPoints.push(Math.floor(scaledTop));
          currentPageHeight = canvas.height - scaledTop;
        } else {
          currentPageHeight += scaledH;
        }
      });
      breakPoints.push(canvas.height);

      for (let i = 0; i < breakPoints.length - 1; i++) {
        const startY  = breakPoints[i];
        const endY    = breakPoints[i+1];
        const sliceH  = endY - startY;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width  = canvas.width;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext('2d');
        // 白背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, startY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.95);
        const pageH   = (sliceH * W) / canvas.width;
        if (i > 0) pdf.addPage();
        pdf.addImage(pageImg, 'JPEG', 0, 0, W, pageH);
      }
    }
    const fname = (docData.doc_number||docData.type) + '_' + (docData.doc_date||'') + '.pdf';
    pdf.save(fname);
    showToast('PDF保存: ' + fname);
  } finally {
    document.body.removeChild(el);
    const loading = document.getElementById('pdf-loading');
    if (loading) loading.remove();
  }

  } catch(e) {
    handleError(e, 'generatePDF_html2canvasでエラーが発生しました');
  }}

async function generatePDF_print(docData, customer) {
  try {
  await loadCompany();
  const label = docData.type === 'estimate' ? '見積書' : '領収書';
  const totalLabel = docData.type === 'estimate' ? '御見積金額' : '領収金額';
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${label} ${docData.doc_number||''}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
    <style>
      body{font-family:'Noto Sans JP',sans-serif;font-size:13px;color:#000;padding:40px;max-width:794px;margin:0 auto;}
      h1{text-align:center;font-size:22px;letter-spacing:8px;margin-bottom:24px;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      th{background:#1e3264;color:#fff;padding:8px 10px;}
      td{padding:8px 10px;border-bottom:1px solid #eee;}
      .total-box{background:#f0f4ff;border-radius:4px;padding:16px;text-align:center;margin-bottom:24px;}
      .total-amount{font-size:26px;font-weight:700;}
      .footer{border-top:1px solid #ccc;padding-top:12px;font-size:10px;color:#777;text-align:center;margin-top:32px;}
      @media print{button{display:none!important;}}
    
/* ================================================================
   UIスタイルテーマ
   ================================================================ */

/* A: モダンSaaS */
.ui-saas {
  --bg:#ffffff; --bg2:#f7f7f7; --bg3:#f0f0f0;
  --border:rgba(0,0,0,0.1); --text:#1a1a1a;
  --text2:rgba(26,26,26,0.6); --text3:rgba(26,26,26,0.35);
  --gold:#6366f1; --accent:#6366f1; --radius:8px; --radius-lg:12px;
}
.ui-saas .sidebar { background:#fff; border-right:1px solid #e5e5e5; }
.ui-saas .card { background:#fff; border:1px solid #e5e5e5; border-radius:12px; }
.ui-saas .btn-primary { background:#6366f1; border-radius:8px; }
.ui-saas .stat-card { background:#fff; border:1px solid #e5e5e5; border-radius:12px; }
.ui-saas .nav-item.active { background:#ede9fe; color:#6366f1; border-radius:8px; }
.ui-saas input,.ui-saas select,.ui-saas textarea { background:#fff; border:1px solid #e5e5e5; border-radius:8px; color:#1a1a1a; }
.ui-saas .modal { background:#fff; border-radius:16px; }
.ui-saas .page-title,.ui-saas .page-subtitle { color:#1a1a1a; }
.ui-saas .main-content { background:#f7f7f7; }
.ui-saas #global-tooltip { background:#1a1a1a; color:#fff; border-color:#6366f1; }

/* B: プレミアム（デフォルト） */
.ui-premium {
  --bg:#080808; --bg2:#0f0f0f; --bg3:rgba(255,255,255,0.03);
  --border:rgba(200,168,75,0.2); --text:#f0e8d8;
  --text2:rgba(240,232,216,0.6); --text3:rgba(240,232,216,0.3);
  --gold:#c8a84b; --accent:#c8a84b; --radius:2px; --radius-lg:4px;
}
.ui-premium .sidebar { background:linear-gradient(180deg,#0a0a0a,#050505); border-right:1px solid rgba(200,168,75,0.15); }
.ui-premium .card { background:linear-gradient(135deg,#0f0f0f,#0a0a0a); border:1px solid rgba(200,168,75,0.15); }
.ui-premium .btn-primary { background:linear-gradient(135deg,#c8a84b,#a08030); }
.ui-premium .stat-card { background:linear-gradient(135deg,#0f0f0f,#080808); border:1px solid rgba(200,168,75,0.2); }

/* C: フレンドリー */
.ui-friendly {
  --bg:#fafafa; --bg2:#ffffff; --bg3:#f3f4f6;
  --border:rgba(0,0,0,0.08); --text:#111827;
  --text2:#6b7280; --text3:#9ca3af;
  --gold:#10b981; --accent:#10b981; --radius:12px; --radius-lg:16px;
}
.ui-friendly .sidebar { background:linear-gradient(180deg,#ecfdf5,#f0fdf4); border-right:1px solid #d1fae5; }
.ui-friendly .card { background:#fff; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.08); border:none; }
.ui-friendly .btn-primary { background:#10b981; border-radius:10px; font-weight:600; }
.ui-friendly .stat-card { background:#fff; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); border:none; }
.ui-friendly .nav-item.active { background:#d1fae5; color:#059669; border-radius:10px; }
.ui-friendly input,.ui-friendly select,.ui-friendly textarea { background:#fff; border:1px solid #e5e7eb; border-radius:10px; color:#111827; }
.ui-friendly .modal { background:#fff; border-radius:20px; }
.ui-friendly .page-title,.ui-friendly .page-subtitle { color:#111827; }
.ui-friendly .main-content { background:#fafafa; }
.ui-friendly #global-tooltip { background:#111827; color:#fff; border-color:#10b981; }

/* D: スタートアップ */
.ui-startup {
  --bg:#09090b; --bg2:#111113; --bg3:rgba(255,255,255,0.03);
  --border:rgba(255,255,255,0.08); --text:#fafafa;
  --text2:rgba(250,250,250,0.6); --text3:rgba(250,250,250,0.3);
  --gold:#8b5cf6; --accent:#8b5cf6; --radius:6px; --radius-lg:10px;
}
.ui-startup .sidebar { background:#09090b; border-right:1px solid rgba(255,255,255,0.06); }
.ui-startup .card { background:linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)); border:1px solid rgba(255,255,255,0.08); }
.ui-startup .btn-primary { background:linear-gradient(135deg,#8b5cf6,#6d28d9); border-radius:6px; }
.ui-startup .stat-card { background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(109,40,217,0.05)); border:1px solid rgba(139,92,246,0.2); }
.ui-startup .nav-item.active { background:rgba(139,92,246,0.15); color:#a78bfa; }
.ui-startup input,.ui-startup select,.ui-startup textarea { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fafafa; }
.ui-startup .modal { background:#111113; border:1px solid rgba(255,255,255,0.1); border-radius:12px; }
.ui-startup #global-tooltip { background:#18181b; border-color:rgba(139,92,246,0.5); }

</style>
  </head><body>
    <button onclick="window.print()" style="margin-bottom:16px;padding:8px 24px;background:#1e3264;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">印刷 / PDF保存</button>
    <h1>${label}</h1>
    <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
      <div>
        ${customer && customer.company ? `<div style="font-size:15px;font-weight:600;">${customer.company}</div>` : ''}
        <div style="font-size:16px;font-weight:700;">${docData.atena||(customer?customer.name:docData.customer_name||'')} 様</div>
        ${customer && customer.zip ? `<div style="font-size:11px;color:#555;margin-top:4px;">〒${customer.zip}</div>` : ''}
        ${customer && customer.address ? `<div style="font-size:11px;color:#555;margin-top:4px;">${customer.address}</div>` : ''}
        ${customer && customer.tel ? `<div style="font-size:11px;color:#555;">TEL: ${customer.tel}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:11px;color:#555;">
        <div>No: ${docData.doc_number||''}</div>
        <div>Date: ${docData.doc_date||''}</div>
      </div>
    </div>
    <div class="total-box">
      <div style="font-size:13px;color:#555;margin-bottom:4px;">${totalLabel}</div>
      <div class="total-amount">¥${(docData.total||0).toLocaleString()} <span style="font-size:13px;">（税込）</span></div>
    </div>
    ${docData.type==='receipt' && docData.notes ? `<div style="margin-bottom:16px;font-size:12px;padding:8px 12px;border-left:3px solid #1e3264;">但し書き: ${docData.notes}</div>` : ''}
    ${docData.type!=='receipt' && docData.notes ? `<div style="margin-bottom:16px;font-size:12px;">件名: ${docData.notes}</div>` : ''}
    <table>
      <thead><tr><th style="text-align:left;">品目・内容</th><th style="text-align:right;width:60px;">数量</th><th style="width:50px;">単位</th><th style="text-align:right;width:100px;">単価</th><th style="text-align:right;width:100px;">金額</th></tr></thead>
      <tbody>${(docData.items||[]).filter(it=>it.name).map(it=>`<tr><td>${it.name}</td><td style="text-align:right;">${it.qty||0}</td><td>${it.unit||''}</td><td style="text-align:right;">¥${(it.price||0).toLocaleString()}</td><td style="text-align:right;">¥${((it.qty||0)*(it.price||0)).toLocaleString()}</td></tr>`).join('')}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:32px;">
      <table style="font-size:12px;">
        <tr><td style="padding:4px 16px;">小計</td><td style="padding:4px 16px;text-align:right;">¥${(docData.subtotal||0).toLocaleString()}</td></tr>
        <tr><td style="padding:4px 16px;">消費税（${docData.taxRate||10}%）</td><td style="padding:4px 16px;text-align:right;">¥${(docData.tax||0).toLocaleString()}</td></tr>
        <tr style="font-weight:700;font-size:14px;border-top:2px solid #000;"><td style="padding:8px 16px;">合計</td><td style="padding:8px 16px;text-align:right;">¥${(docData.total||0).toLocaleString()}</td></tr>
      </table>
    </div>
    ${(window.APP.company.name||window.APP.company.address)?`<div class="footer">${[window.APP.company.name,window.APP.company.address,window.APP.company.tel?'TEL:'+window.APP.company.tel:'',window.APP.company.email].filter(Boolean).join('  |  ')}${window.APP.company.invoice_no?'<br>登録番号: '+window.APP.company.invoice_no:''}</div>`:''}
  <div id="toast-container" style="position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;"></div>
<div id="mobile-ai-sheet" style="display:none;position:fixed;bottom:0;left:0;right:0;background:var(--bg2);border-top:1px solid var(--border);z-index:9999;border-radius:12px 12px 0 0;padding:16px;max-height:70vh;overflow-y:auto;"></div>
<div id="mobile-ai-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9998;" onclick="closeMobileAI()"></div>
</body></html>`);
  win.document.close();
  showToast('印刷画面を開きました');

  } catch(e) {
    handleError(e, 'generatePDF_printでエラーが発生しました');
  }}

async function reissuePdf(docId) {
  try {
  // allDocumentsから取得（復号済み）、なければDBから取得
  let doc = allDocuments.find(d => d.id === docId);
  if (!doc) {
    const raw = await NAPI.getDocument(docId);
    if (!raw) return;
    doc = { id: raw.id, customer_id: raw.customer_id, type: raw.type, doc_number: raw.doc_number, doc_date: raw.doc_date, total: raw.total, status: raw.status, created_at: raw.created_at, ..._decRecord(raw) };
  }
  const rawCust = await NAPI.getCustomer(doc.customer_id);
  const cust = rawCust ? { id: rawCust.id, created_at: rawCust.created_at, ..._decRecord(rawCust) } : null;
  await generatePDF(doc, cust);

  } catch(e) {
    handleError(e, 'reissuePdfでエラーが発生しました');
  }}

async function previewFile(fileId) {
  try {
  const res = await fetch(`${API_BASE}/files/${fileId}`);
  const f = res.ok ? await res.json() : null;
  if (!f) return;
  if (f.type.startsWith('image/')) {
    // 画像はモーダルでプレビュー
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    overlay.onclick = () => overlay.remove();
    const img = document.createElement('img');
    img.src = f.data;
    img.style.cssText = 'max-width:90vw;max-height:90vh;object-fit:contain;border-radius:4px;';
    overlay.appendChild(img);
    document.body.appendChild(overlay);
  } else {
    // PDF等はBlobURLで新タブ表示
    const res = await fetch(f.data);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  } catch(e) {
    handleError(e, 'previewFileでエラーが発生しました');
  }}

function formatBankForPdf(bankStr) {
  if (!bankStr) return '';
  if (bankStr.startsWith('ゆうちょ銀行')) {
    const kigoMatch   = bankStr.match(/記号:([^\s]+)/);
    const banMatch    = bankStr.match(/番号:([^\s]+)/);
    const holderMatch = bankStr.match(/名義:(.+)$/);
    const rows = [
      '<strong>振込先</strong>',
      '銀行名：ゆうちょ銀行',
      kigoMatch   ? '記　号：' + kigoMatch[1]   : '',
      banMatch    ? '番　号：' + banMatch[1]     : '',
      holderMatch ? '口座名義：' + holderMatch[1] : '',
    ].filter(Boolean);
    return rows.join('<br>');
  } else {
    const parts = bankStr.split(/[　\s]+/).filter(Boolean);
    const kindIdx = parts.findIndex(p => ['普通','当座','貯蓄'].includes(p));
    if (kindIdx >= 0) {
      const name   = parts.slice(0, Math.max(1, kindIdx-1)).join(' ');
      const branch = kindIdx > 1 ? parts[kindIdx-1] : '';
      const kind   = parts[kindIdx];
      const number = parts[kindIdx+1] || '';
      const holder = parts.slice(kindIdx+2).join(' ');
      const rows = [
        '<strong>振込先</strong>',
        name   ? '銀行名：' + name   : '',
        branch ? '支店名：' + branch : '',
        kind   ? '種　別：' + kind + '預金' : '',
        number ? '口座番号：' + number : '',
        holder ? '口座名義：' + holder : '',
      ].filter(Boolean);
      return rows.join('<br>');
    }
    return '<strong>振込先</strong><br>' + bankStr;
  }
}

function savePdfMode() {
  const mode = document.querySelector('input[name="pdf-mode"]:checked')?.value || 'preview_edit';
  localStorage.setItem('nexutha_pdf_mode', mode);
  showToast('PDF出力設定を保存しました');
}

function loadPdfMode() {
  const mode = localStorage.getItem('nexutha_pdf_mode') || 'preview_edit';
  const radio = document.querySelector(`input[name="pdf-mode"][value="${mode}"]`);
  if (radio) radio.checked = true;
}

async function switchLayoutTab(type) {
  try {
  currentLayoutTab = type;
  ['estimate','invoice','receipt'].forEach(t => {
    const btn = document.getElementById('layout-tab-'+t);
    if (btn) { btn.className = t===type ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'; }
  });
  await renderLayoutEditor();

  } catch(e) {
    handleError(e, 'switchLayoutTabでエラーが発生しました');
  }}

function initLayoutDrag() {
  const container = document.getElementById('layout-editor-container');
  if (!container) return;
  ['logo','stamp','hanko'].forEach(key => {
    const handle = document.getElementById('layout-'+key+'-handle');
    if (!handle || handle.style.display === 'none') return;
    let startX, startY, startLeft, startTop;
    handle.onmousedown = (e) => {
      e.preventDefault();
      startX = e.clientX; startY = e.clientY;
      startLeft = parseInt(handle.style.left)||0;
      startTop  = parseInt(handle.style.top)||0;
      const onMove = (e2) => {
        const dx = e2.clientX - startX;
        const dy = e2.clientY - startY;
        const W = container.offsetWidth;
        const H = container.offsetHeight;
        const newLeft = Math.max(0, Math.min(W-10, startLeft+dx));
        const newTop  = Math.max(0, Math.min(H-10, startTop+dy));
        handle.style.left = newLeft + 'px';
        handle.style.top  = newTop + 'px';
        layoutPositions[currentLayoutTab][key].x = newLeft / W * 100;
        layoutPositions[currentLayoutTab][key].y = newTop  / H * 100;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    // タッチ対応
    handle.ontouchstart = (e) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      startLeft = parseInt(handle.style.left)||0;
      startTop  = parseInt(handle.style.top)||0;
      const onMove = (e2) => {
        const t2 = e2.touches[0];
        const W = container.offsetWidth;
        const H = container.offsetHeight;
        const newLeft = Math.max(0, Math.min(W-10, startLeft+t2.clientX-startX));
        const newTop  = Math.max(0, Math.min(H-10, startTop+t2.clientY-startY));
        handle.style.left = newLeft + 'px';
        handle.style.top  = newTop + 'px';
        layoutPositions[currentLayoutTab][key].x = newLeft / W * 100;
        layoutPositions[currentLayoutTab][key].y = newTop  / H * 100;
      };
      const onUp = () => {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };
      document.addEventListener('touchmove', onMove, {passive:true});
      document.addEventListener('touchend', onUp);
    };
  });
}

function updateLayoutHandleSize(key, size) {
  layoutPositions[currentLayoutTab][key].size = parseInt(size);
  const img = document.getElementById('layout-'+key+'-img');
  if (!img) return;
  img.style.width = size + 'px';
  if (key !== 'logo') img.style.height = size + 'px';
}

function updateLayoutOpacity(val) {
  layoutPositions[currentLayoutTab].stamp.opacity = parseInt(val);
  layoutPositions[currentLayoutTab].hanko.opacity = parseInt(val);
  const si = document.getElementById('layout-stamp-img');
  const hi = document.getElementById('layout-hanko-img');
  if (si) si.style.opacity = val/100;
  if (hi) hi.style.opacity = val/100;
}

function resetLayoutPositions() {
  layoutPositions[currentLayoutTab] = {
    logo:  {x:85,y:2,size:60},
    stamp: {x:75,y:55,size:60,opacity:85},
    hanko: {x:80,y:55,size:40,opacity:85}
  };
  renderLayoutEditor();
  showToast('配置をリセットしました');
}

async function showPdfPreview(docData, customer, _isRebuild=false) {
  try {
  const mode = localStorage.getItem('nexutha_pdf_mode') || 'preview_edit';
  if (mode === 'download') {
    await generatePDF_html2canvas(docData, customer);
    return;
  }
  _previewDocData = docData;
  _previewCustomer = customer;
  setTimeout(peInitRound, 100);
  await loadCompany();
  const type = docData.type || 'estimate';
  loadLayoutSettings();
  const basePos = layoutPositions[type] || layoutPositions.estimate;
  const W = 794;
  const H = 1123;
  // 書類に保存済みの位置があればそれを使用、なければデフォルト
  if (docData._imagePositions && docData._imagePositions.logo) {
    _previewPositions = JSON.parse(JSON.stringify(docData._imagePositions));
  } else {
    _previewPositions = {
      logo:  { x: basePos.logo.x  || 85, y: basePos.logo.y  || 2,  size: basePos.logo.size  || 60, opacity: 100, visible: true },
      stamp: { x: basePos.stamp.x || 75, y: basePos.stamp.y || 75, size: basePos.stamp.size || 70, opacity: basePos.stamp.opacity || 85, visible: true },
      hanko: { x: basePos.hanko.x || 80, y: basePos.hanko.y || 78, size: basePos.hanko.size || 40, opacity: basePos.hanko.opacity || 85, visible: true },
    };
  }
  const contentEl = document.getElementById('pdf-preview-content');
  if (contentEl) {
    const tempEl = document.createElement('div');
    tempEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;background:#fff;color:#000;font-family:"Noto Sans JP",sans-serif;font-size:13px;padding:48px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;';
    document.body.appendChild(tempEl);
    const isReceipt = type === 'receipt';
    const honorific = docData.honorific || '様';
    const atenaFull = (docData.atena || (customer ? customer.name : '')) + ' ' + honorific;
    const taxRate_ = docData.taxRate ?? docData.tax_rate ?? 10;
  const taxLabel = taxRate_ === 0 ? '（税なし）' : `（税込${taxRate_}%）`;
    const typeLabel = {estimate:'見　積　書', invoice:'請　求　書', receipt:'領　収　書'}[type] || type;
    // PDF生成用elと同じHTMLをcontentElに適用
    const previewEl = document.createElement('div');
    previewEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;background:#fff;color:#000;font-family:"Noto Sans JP",sans-serif;font-size:13px;padding:48px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;';
    document.body.appendChild(previewEl);
    await generatePdfHtml(previewEl, {...docData, _imagePositions: docData._imagePositions || {}}, customer, window.APP.company);
    contentEl.innerHTML = previewEl.innerHTML;
    contentEl.style.cssText = 'width:794px;height:1123px;background:#fff;color:#000;font-family:"Noto Sans JP",sans-serif;font-size:13px;padding:48px;box-sizing:border-box;position:relative;display:flex;flex-direction:column;justify-content:space-between;';
    document.body.removeChild(previewEl);
    document.body.removeChild(tempEl);
  }
  const labelEl = document.getElementById('preview-doc-label');
  const typeLabel2 = {estimate:'見積書', invoice:'請求書', receipt:'領収書'};
  if (labelEl) labelEl.textContent = (typeLabel2[type]||type) + ' — ' + (docData.doc_number||'');
  // コンテンツ描画後にハンドルを配置（レイアウト計算を待つ）
  setTimeout(() => {
    setupPreviewHandle('logo', window.APP.company.logo, _previewPositions.logo);
    setupPreviewHandle('stamp', window.APP.company.stamp, _previewPositions.stamp);
    setupPreviewHandle('hanko', window.APP.company.hanko, _previewPositions.hanko);
    document.getElementById('preview-logo-size').value  = _previewPositions.logo.size;
    document.getElementById('preview-stamp-size').value = _previewPositions.stamp.size;
    document.getElementById('preview-stamp-opacity').value = _previewPositions.stamp.opacity;
    document.getElementById('preview-hanko-size').value = _previewPositions.hanko.size;
    document.getElementById('preview-hanko-opacity').value = _previewPositions.hanko.opacity;
  }, 150);
  document.getElementById('preview-send-memo').value = '';
  document.getElementById('pdf-preview-overlay').style.display = 'flex';
  // EDITパネルにデータをロード（再描画時はスキップ）
  if (!_isRebuild) {
    setTimeout(() => {
      if (docData.id) {
        // allDocumentsから復号済みデータを優先使用
        const cached = allDocuments.find(d => d.id === docData.id);
        if (cached) {
          _previewDocData = cached;
          peLoadToPanel(cached);
        } else {
          NAPI.getDocument(docData.id).then(dec => {
            if (dec) {
              _previewDocData = dec;
              peLoadToPanel(dec);
            } else {
              peLoadToPanel(docData);
            }
          }).catch(() => peLoadToPanel(docData));
        }
      } else {
        peLoadToPanel(docData);
      }
      switchPreviewPanel('edit');
    }, 50);
  }

  } catch(e) {
    console.error('showPdfPreview詳細エラー:', e, e.stack);
    handleError(e, 'showPdfPreviewでエラーが発生しました: ' + e.message);
  }}

function setupPreviewHandle(key, src, pos) {
  const handle = document.getElementById('preview-'+key+'-handle');
  const img    = document.getElementById('preview-'+key+'-img');
  const ctrl   = document.getElementById('preview-'+key+'-controls');
  if (!handle || !img) return;
  if (!src || pos.visible === false) {
    handle.style.display = 'none';
    if (ctrl) ctrl.style.display = 'none';
    return;
  }
  img.src = src;
  img.style.width   = pos.size + 'px';
  img.style.height  = key === 'logo' ? 'auto' : pos.size + 'px';
  img.style.opacity = (pos.opacity||100) / 100;
  // %座標→px変換（プレビューの実際サイズに合わせる）
  const contentElP = document.getElementById('pdf-preview-content');
  const pW = contentElP ? contentElP.offsetWidth  : 794;
  const pH = contentElP ? contentElP.offsetHeight : 1123;
  handle.style.display = 'block';
  handle.style.left = (pos.x / 100 * pW) + 'px';
  handle.style.top  = (pos.y / 100 * pH) + 'px';
  if (ctrl) ctrl.style.display = 'block';
  const mode = localStorage.getItem('nexutha_pdf_mode') || 'preview_edit';
  if (mode !== 'preview_edit') return;
  let sx, sy, sl, st;
  handle.onmousedown = (e) => {
    e.preventDefault();
    sx=e.clientX; sy=e.clientY;
    sl=parseInt(handle.style.left)||0; st=parseInt(handle.style.top)||0;
    const onMove = (e2) => {
      let nl = Math.max(0, sl+e2.clientX-sx);
      let nt = Math.max(0, st+e2.clientY-sy);
      // スナップ処理
      const canvas = document.getElementById('pdf-preview-canvas');
      const W = canvas ? canvas.offsetWidth : 794;
      const H = canvas ? canvas.offsetHeight : 650;
      const snapThreshold = 12;
      const snapPoints = {
        x: [0, W*0.25, W*0.5, W*0.75, W, 48, W-48],  // 左端・1/4・中央・3/4・右端・余白
        y: [0, H*0.25, H*0.33, H*0.5, H*0.66, H*0.75, H, 48, H-48],
      };
      let snappedX = false, snappedY = false;
      // スナップインジケーターをリセット
      document.querySelectorAll('.snap-line').forEach(l => l.remove());
      snapPoints.x.forEach(sx2 => {
        if (Math.abs(nl - sx2) < snapThreshold) { nl = sx2; snappedX = true; showSnapLine('v', sx2, H); }
      });
      snapPoints.y.forEach(sy2 => {
        if (Math.abs(nt - sy2) < snapThreshold) { nt = sy2; snappedY = true; showSnapLine('h', sy2, W); }
      });
      handle.style.left = nl+'px'; handle.style.top = nt+'px';
      // px→%で保存
      const cEl = document.getElementById('pdf-preview-content');
      const cW = cEl ? cEl.offsetWidth  : 794;
      const cH = cEl ? cEl.offsetHeight : 1123;
      _previewPositions[key].x = nl / cW * 100;
      _previewPositions[key].y = nt / cH * 100;
    };
    const onUp = () => { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
}

function updatePreviewHandle(key, prop, val) {
  if (!_previewPositions[key]) return;
  _previewPositions[key][prop] = parseFloat(val);
  const img = document.getElementById('preview-'+key+'-img');
  if (!img) return;
  if (prop === 'size') { img.style.width = val+'px'; if (key!=='logo') img.style.height = val+'px'; }
  if (prop === 'opacity') img.style.opacity = val/100;
}

function togglePreviewHandle(key) {
  const pos = _previewPositions[key];
  if (!pos) return;
  if (pos.visible === false) {
    // 表示に戻す
    pos.visible = true;
    const handle = document.getElementById('preview-'+key+'-handle');
    if (handle) handle.style.display = 'block';
    const btn = document.getElementById('toggle-'+key+'-btn');
    if (btn) { btn.textContent = '非表示にする'; btn.style.borderColor = 'rgba(255,100,100,0.4)'; btn.style.color = '#f87171'; }
  } else {
    // 非表示にする
    hidePreviewHandle(key);
    const btn = document.getElementById('toggle-'+key+'-btn');
    if (btn) { btn.textContent = '表示に戻す'; btn.style.borderColor = 'rgba(100,200,100,0.4)'; btn.style.color = '#34d399'; }
  }
}

function hidePreviewHandle(key) {
  if (_previewPositions[key]) _previewPositions[key].visible = false;
  const h = document.getElementById('preview-'+key+'-handle');
  if (h) h.style.display = 'none';
  // コントロールは残す（表示に戻すボタンのため）
}

function resetPreviewPositions() {
  if (_previewDocData && _previewCustomer) showPdfPreview(_previewDocData, _previewCustomer);
}

async function savePreviewAsDefault() {
  try {
  const type = (_previewDocData||{}).type || 'estimate';
  const saved = JSON.parse(localStorage.getItem('nexutha_layout_positions') || '{}');
  // %座標をそのまま保存
  saved[type] = {
    logo:  { x: _previewPositions.logo.x,  y: _previewPositions.logo.y,  size: _previewPositions.logo.size },
    stamp: { x: _previewPositions.stamp.x, y: _previewPositions.stamp.y, size: _previewPositions.stamp.size, opacity: _previewPositions.stamp.opacity },
    hanko: { x: _previewPositions.hanko.x, y: _previewPositions.hanko.y, size: _previewPositions.hanko.size, opacity: _previewPositions.hanko.opacity },
  };
  localStorage.setItem('nexutha_layout_positions', JSON.stringify(saved));
  showToast('この配置をデフォルトとして保存しました');

  } catch(e) {
    handleError(e, 'savePreviewAsDefaultでエラーが発生しました');
  }}

function switchPreviewPanel(tab) {
  const editPanel   = document.getElementById('panel-edit');
  const adjustPanel = document.getElementById('panel-adjust');
  const editTab     = document.getElementById('panel-tab-edit');
  const adjustTab   = document.getElementById('panel-tab-adjust');
  if (tab === 'edit') {
    editPanel.style.display   = 'block';
    adjustPanel.style.display = 'none';
    editTab.style.background  = 'rgba(200,168,75,0.15)';
    editTab.style.borderBottomColor = '#c8a84b';
    editTab.style.color       = '#c8a84b';
    adjustTab.style.background = 'transparent';
    adjustTab.style.borderBottomColor = 'transparent';
    adjustTab.style.color     = '#7a7060';
  } else {
    editPanel.style.display   = 'none';
    adjustPanel.style.display = 'block';
    adjustTab.style.background = 'rgba(200,168,75,0.15)';
    adjustTab.style.borderBottomColor = '#c8a84b';
    adjustTab.style.color     = '#c8a84b';
    editTab.style.background  = 'transparent';
    editTab.style.borderBottomColor = 'transparent';
    editTab.style.color       = '#7a7060';
  }
}

async function _rebuildPreview() {
  if (!_previewDocData || !_previewCustomer) return;
  // ロゴ・印鑑の現在位置を保存
  const savedPositions = JSON.parse(JSON.stringify(_previewPositions));
  const d = _previewDocData;
  const customer = _previewCustomer;
  showPdfPreview(d, customer, true).then(() => {
    // 位置を復元
    _previewPositions = savedPositions;
    const company = loadCompany().then(c => {
      setupPreviewHandle('logo', c.logo, _previewPositions.logo);
      setupPreviewHandle('stamp', c.stamp, _previewPositions.stamp);
      setupPreviewHandle('hanko', c.hanko, _previewPositions.hanko);
    });
  });
}

function _rebuildPreviewOLD_UNUSED() {
  if (!_previewDocData || !_previewCustomer) return;
  try {
    const contentEl = document.getElementById('pdf-preview-content');
    if (!contentEl) return;
    // プレビューのHTMLコンテンツだけ再生成
    const d = _previewDocData;
    const customer = _previewCustomer;
    const type = d.type || 'estimate';
    const honorific = d.honorific || '様';
    const atenaFull = (d.atena && d.atena !== 'undefined' ? d.atena : (customer ? customer.name : '')) + ' ' + honorific;
    const typeLabel = {estimate:'見　積　書', invoice:'請　求　書', receipt:'領　収　書'}[type] || type;
    const items = d.items || [];
    const subtotal = items.reduce((s,it) => s+(it.qty||0)*(it.price||0), 0);
    let tax10=0, tax8=0;
    items.forEach(it => {
      const amt=(it.qty||0)*(it.price||0);
      if(it.taxRate===10||it.taxRate===undefined) tax10+=amt;
      else if(it.taxRate===8) tax8+=amt;
    });
    const taxAmt10=getRoundFn()(tax10*0.10), taxAmt8=getRoundFn()(tax8*0.08);
    const total = subtotal + taxAmt10 + taxAmt8;
    const itemRows = items.map(it => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;">${it.name||''}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;">${it.qty||1}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;">${it.unit||''}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">¥${(it.price||0).toLocaleString()}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">¥${((it.qty||0)*(it.price||0)).toLocaleString()}</td>
      </tr>`).join('');
    contentEl.innerHTML = `
      <div style="padding:48px;font-family:'Noto Sans JP',sans-serif;font-size:13px;color:#000;">
        <div style="font-size:24px;font-weight:700;letter-spacing:6px;margin-bottom:24px;">${typeLabel}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
          <div>
            ${customer && customer.company ? `<div style="font-size:14px;font-weight:600;">${customer.company}</div><div style="font-size:17px;font-weight:700;">${(d.atena || customer.name)} ${d.honorific || '様'}</div>` : `<div style="font-size:17px;font-weight:700;">${atenaFull}</div>`}
          </div>
          <div style="text-align:right;font-size:12px;color:#555;">
            <div>No: ${d.doc_number||''}</div>
            <div>発行日: ${d.doc_date||''}</div>
          </div>
        </div>
        ${d.notes ? `<div style="margin-bottom:12px;font-size:13px;">件名: ${d.notes}</div>` : ''}
        ${type==='receipt' ? `<div style="background:#f0f4ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">
          <div style="font-size:12px;color:#555;margin-bottom:4px;">領収金額</div>
          <div style="font-size:32px;font-weight:700;">¥${total.toLocaleString()}</div>
        </div>` : ''}
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr style="background:#1e3a5f;color:#fff;">
              <th style="padding:8px 6px;text-align:left;">品目・内容</th>
              <th style="padding:8px 6px;text-align:center;width:50px;">数量</th>
              <th style="padding:8px 6px;text-align:center;width:40px;">単位</th>
              <th style="padding:8px 6px;text-align:right;width:80px;">単価</th>
              <th style="padding:8px 6px;text-align:right;width:80px;">金額</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="text-align:right;margin-bottom:4px;">小計: ¥${subtotal.toLocaleString()}</div>
        ${taxAmt10>0?`<div style="text-align:right;margin-bottom:4px;font-size:12px;color:#555;">消費税（10%）: ¥${taxAmt10.toLocaleString()}</div>`:''}
        ${taxAmt8>0?`<div style="text-align:right;margin-bottom:4px;font-size:12px;color:#555;">消費税（8%）: ¥${taxAmt8.toLocaleString()}</div>`:''}
        <div style="text-align:right;font-size:18px;font-weight:700;border-top:2px solid #1e3a5f;padding-top:8px;">合計: ¥${total.toLocaleString()}</div>
        ${d.memo?`<div style="margin-top:16px;font-size:12px;color:#555;">備考: ${d.memo}</div>`:''}
      </div>`;
  } catch(e) { console.error('_rebuildPreview error:', e); }
}

async function previewEditUpdate() {
  if (!_previewDocData) return;
  if (_peUpdating) return;
  _peUpdating = true;
  const get = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  _previewDocData.atena       = get('pe-atena');
  _previewDocData.honorific   = _peHonorific;
  _previewDocData.doc_number  = get('pe-docnum');
  _previewDocData.doc_date    = get('pe-date');
  _previewDocData.notes       = get('pe-notes');
  _previewDocData.memo        = get('pe-memo');
  _previewDocData.validity    = get('pe-validity');
  _previewDocData.payment_due = get('pe-payment-due');
  _previewDocData.staff       = get('pe-staff');
  _previewDocData.bank        = get('pe-bank') || _previewDocData.bank;
  _previewDocData.discount    = get('pe-discount');
  _previewDocData.withholding = parseFloat(get('pe-withholding')) || 0;
  _previewDocData.invoice_no  = get('pe-invoice-no');
  const stampChk = document.getElementById('pe-show-stamp');
  _previewDocData.show_stamp  = stampChk ? stampChk.checked : _previewDocData.show_stamp;
  // 合計再計算
  const items = _previewDocData.items || [];
  let subtotal=0, tax10=0, tax8=0;
  items.forEach(it => {
    const amt = (it.qty||0)*(it.price||0);
    subtotal += amt;
    if (it.taxRate===10) tax10 += amt;
    else if (it.taxRate===8) tax8 += amt;
  });
  const taxAmt10 = getRoundFn()(tax10*0.10);
  const taxAmt8  = getRoundFn()(tax8*0.08);
  _previewDocData.subtotal = subtotal;
  _previewDocData.tax      = taxAmt10 + taxAmt8;
  _previewDocData.tax10    = taxAmt10;
  _previewDocData.tax8     = taxAmt8;
  _previewDocData.total    = getTotalRounded(subtotal + taxAmt10 + taxAmt8);
  // プレビューを再描画
  try {
    await _rebuildPreview();
  } finally {
    _peUpdating = false;
  }
}

function closePdfPreview() {
  document.getElementById('pdf-preview-overlay').style.display = 'none';
  _previewDocData = null;
  _previewCustomer = null;
}

async function confirmPdfDownload() {
  // OKボタン押下時も位置を書類データに保存
  if (_previewDocData && _previewPositions) {
    _previewDocData._imagePositions = JSON.parse(JSON.stringify(_previewPositions));
    if (_previewDocData.id) {
      try { await NAPI.updateDocument(_previewDocData.id, _previewDocData); } catch(e) {}
    }
  }
  try {
  if (!_previewDocData || !_previewCustomer) return;
  const memo = document.getElementById('preview-send-memo')?.value;
  if (memo && _previewDocData.id) {
    await NAPI.updateDocument(_previewDocData.id, { ..._previewDocData, send_memo: memo });
  }
  const docWithPos = { ..._previewDocData, _imagePositions: JSON.parse(JSON.stringify(_previewPositions)) };
  const customerSnapshot = { ..._previewCustomer };
  closePdfPreview();
  await generatePDF_html2canvas(docWithPos, customerSnapshot);

  } catch(e) {
    handleError(e, 'confirmPdfDownloadでエラーが発生しました');
  }}

async function saveLayoutSettings() {
  try {
  const saved = JSON.parse(localStorage.getItem('nexutha_layout_positions') || '{}');
  saved[currentLayoutTab] = layoutPositions[currentLayoutTab];
  localStorage.setItem('nexutha_layout_positions', JSON.stringify(saved));
  showToast(({estimate:'見積書',invoice:'請求書',receipt:'領収書'}[currentLayoutTab]) + 'のレイアウトを保存しました');

  } catch(e) {
    handleError(e, 'saveLayoutSettingsでエラーが発生しました');
  }}

function loadLayoutSettings() {
  const saved = JSON.parse(localStorage.getItem('nexutha_layout_positions') || '{}');
  Object.keys(saved).forEach(k => {
    if (layoutPositions[k] && saved[k]) {
      // ネストされたオブジェクトを正しくマージ
      ['logo','stamp','hanko'].forEach(part => {
        if (saved[k][part]) {
          layoutPositions[k][part] = { ...layoutPositions[k][part], ...saved[k][part] };
        }
      });
    }
  });
}

