// ================================================================
// js/state.js — NEXUTHAグローバル状態管理
// 全JSファイルから window.APP.* でアクセスする
// ================================================================
window.APP = {
  customers:             [],
  allDocuments:          [],
  company:               {},
  wizard:                { mode: null, step: 0, data: {} },
  docItems:              [],
  docType:               'estimate',
  editingId:             null,
  editingDocId:          null,
  currentIndustryFilter: 'all',
  detailCustomerId:      null,
};
