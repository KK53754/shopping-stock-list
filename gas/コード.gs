// ===================================================
// 買い物・ストックリスト バックエンド (GAS API)
// ===================================================

// ① あなたが設定する値（手順2で変更してください）
const SPREADSHEET_ID = 'ここにスプレッドシートのIDを貼り付ける';
const TOKEN = 'ここに好きなパスワードを入れる（例: family-list-2025）';

// ===================================================
// GETリクエスト: データを読み込んでJSONで返す
// アクセス例: https://script.google.com/macros/s/xxxxx/exec?token=xxxx
// ===================================================
const doGet = (e) => {
  // トークン認証
  if (!e.parameter.token || e.parameter.token !== TOKEN) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName('data');

  const value = sheet.getRange('A1').getValue();

  // データがなければ空配列を返す
  return ContentService
    .createTextOutput(value || '[]')
    .setMimeType(ContentService.MimeType.JSON);
};

// ===================================================
// POSTリクエスト: データをスプレッドシートに保存する
// ===================================================
const doPost = (e) => {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // トークン認証
  if (!params.token || params.token !== TOKEN) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // スプレッドシートのA1セルにJSONを保存
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName('data');

  sheet.getRange('A1').setValue(params.data);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
};
