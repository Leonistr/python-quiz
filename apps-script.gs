// Вставьте в Расширения → Apps Script таблицы Google и разверните как веб-приложение.
function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Результаты') || ss.insertSheet('Результаты');
    var n = 20;
    if (sheet.getLastRow() === 0) {
      var h = ['Время', 'ФИО', 'Группа', 'Баллы'];
      for (var i = 1; i <= n; i++) h.push('Задача' + i);
      sheet.appendRow(h);
    }
    var row = [new Date(data.timestamp || new Date()), data.fio, data.group, data.score];
    var res = data.results || [];
    for (var j = 0; j < n; j++) row.push(res[j] ? res[j].passed : 0);
    sheet.appendRow(row);
    // Код студентов — на отдельном листе
    var cs = ss.getSheetByName('Код') || ss.insertSheet('Код');
    res.forEach(function (r) { cs.appendRow([new Date(data.timestamp), data.fio, data.group, r.id, r.passed, r.code]); });
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  } finally { lock.releaseLock(); }
}
function doGet() { return ContentService.createTextOutput('OK'); }
