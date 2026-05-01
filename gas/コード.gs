// ===================================================
// 買い物・ストックリスト バックエンド (GAS API)
// スプレッドシートの「表」としてデータを保存する版
// ===================================================

// ① あなたが設定する値
const SPREADSHEET_ID = 'ここにスプレッドシートのIDを貼り付ける';
const TOKEN = 'baby2026';

// 読み込み
const doGet = (e) => {
  if (!e.parameter.token || e.parameter.token !== TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('data');
  const lastRow = sheet.getLastRow();
  
  if (lastRow < 2) return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);

  // 2行目以降のデータを取得
  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const items = values.map(row => ({
    id: String(row[0]),
    text: String(row[1]),
    status: String(row[2]),
    stockCount: Number(row[3]),
    category: String(row[4])
  }));

  return ContentService.createTextOutput(JSON.stringify(items)).setMimeType(ContentService.MimeType.JSON);
};

// 保存
const doPost = (e) => {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON' })).setMimeType(ContentService.MimeType.JSON);
  }

  if (!params.token || params.token !== TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('data');
  const items = JSON.parse(params.data);

  // 一旦クリア（ヘッダー以外）
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
  }

  if (items.length > 0) {
    const rows = items.map(i => [
      i.id || '',
      i.text || '',
      i.status || 'shopping',
      i.stockCount || 0,
      i.category || 'other'
    ]);
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
};

// 初回設定用（スプレッドシートのメニューから手動で実行しても良い）
const setupSheet = () => {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('data');
  sheet.clear();
  sheet.getRange(1, 1, 1, 5).setValues([['ID', '名称', '状態(shopping/stock)', '個数', 'カテゴリー']]);
  sheet.setFrozenRows(1);
};
