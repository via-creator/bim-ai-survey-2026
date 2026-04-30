/**
 * 충남건축사회 BIM·AI위원회 수요조사 웹앱 - Google Apps Script
 *
 * 배포 방법:
 *   1) Apps Script 편집기에서 본 파일을 저장
 *   2) [배포] → [새 배포] → 유형: 웹 앱
 *   3) 실행 사용자: 나, 액세스 권한: 모든 사용자
 *   4) 발급된 /exec URL 을 프론트엔드 fetch() 대상 주소로 사용
 *
 * 프론트엔드는 fetch() 호출 시 반드시 다음을 따를 것 (CORS 프리플라이트 회피):
 *   - method: 'POST'
 *   - body: JSON.stringify(payload)
 *   - headers: { 'Content-Type': 'text/plain;charset=utf-8' }   // 'application/json' 금지
 */

var SPREADSHEET_ID = '1xspE7B0xooI-cnCowaZL_79_A_BPq6dliEJsqGZ6vcA';

var SHEET_RAW = '원본응답';
var SHEET_PARTICIPANTS = '참여자명단';
var SHEET_DASHBOARD = '집계대시보드';

var HEADERS_RAW = [
  '제출일시', '성함', '사무소명', '지역', '연락처',
  'Q1_경력', 'Q2_사무소규모', 'Q3_Revit경험', 'Q4_병행툴', 'Q5_라이선스',
  'Q6_자가진단', 'Q7_희망수준', 'Q8_관심주제', 'Q9_일정가능', 'Q10_수강의향',
  'Q11_교육비동의', 'Q12_AI활용', 'Q13_AI카테고리', 'Q14_세미나기대',
  'Q15_참여회차', 'Q16_보증금동의', 'Q17_BIM장벽', 'Q18_위원회역점', 'Q19_자유의견'
];

var HEADERS_PARTICIPANTS = ['제출일시', '성함', '사무소명', '지역', '연락처'];


/* ===================== Web 엔드포인트 ===================== */

function doGet(e) {
  return jsonResponse({
    result: 'success',
    message: 'BIM·AI 수요조사 엔드포인트 정상 동작',
    time: new Date().toISOString()
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var data = parsePayload(e);
    if (!data) {
      return jsonResponse({ result: 'error', message: '요청 본문이 비어있거나 JSON 파싱 실패' });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var rawSheet = getOrCreateSheet(ss, SHEET_RAW, HEADERS_RAW);
    var partSheet = getOrCreateSheet(ss, SHEET_PARTICIPANTS, HEADERS_PARTICIPANTS);

    var submittedAt = data['제출일시'] || formatNow();

    var rawRow = HEADERS_RAW.map(function (h) {
      if (h === '제출일시') return submittedAt;
      var v = data[h];
      if (v === undefined || v === null) return '';
      if (Array.isArray(v)) return v.join(', ');
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });
    rawSheet.appendRow(rawRow);

    var partRow = HEADERS_PARTICIPANTS.map(function (h) {
      if (h === '제출일시') return submittedAt;
      return data[h] || '';
    });
    partSheet.appendRow(partRow);

    updateDashboard(ss);

    return jsonResponse({ result: 'success' });
  } catch (err) {
    return jsonResponse({ result: 'error', message: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


/* ===================== 헬퍼 ===================== */

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parsePayload(e) {
  if (!e) return null;
  try {
    if (e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      return e.parameter;
    }
  } catch (err) {
    return null;
  }
  return null;
}

function formatNow() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (headers && headers.length > 0) {
    var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var hasHeader = firstRow.some(function (v) { return v !== '' && v !== null; });
    if (!hasHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1f3864')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}


/* ===================== 집계 대시보드 ===================== */

function updateDashboard(ss) {
  var raw = ss.getSheetByName(SHEET_RAW);
  if (!raw) return;

  var dash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!dash) {
    dash = ss.insertSheet(SHEET_DASHBOARD);
  }
  dash.clear();

  var lastRow = raw.getLastRow();
  if (lastRow < 2) {
    dash.getRange(1, 1).setValue('아직 응답이 없습니다.');
    return;
  }

  var values = raw.getRange(2, 1, lastRow - 1, HEADERS_RAW.length).getValues();
  var idx = {};
  HEADERS_RAW.forEach(function (h, i) { idx[h] = i; });

  var total = values.length;

  var revitDist = countBy(values, idx['Q10_수강의향']);
  var aiSessionDist = countBy(values, idx['Q15_참여회차']);
  var regionDist = countBy(values, idx['지역']);

  var selfScores = values
    .map(function (r) { return parseFloat(r[idx['Q6_자가진단']]); })
    .filter(function (n) { return !isNaN(n); });
  var selfAvg = selfScores.length
    ? (selfScores.reduce(function (a, b) { return a + b; }, 0) / selfScores.length)
    : 0;

  var licenseValues = values.map(function (r) { return String(r[idx['Q5_라이선스']] || ''); });
  var licenseYes = licenseValues.filter(function (v) {
    return /가능|보유|예|yes|y$|확보|있음|조달가능/i.test(v);
  }).length;
  var licenseRatio = total > 0 ? (licenseYes / total) : 0;

  var row = 1;

  dash.getRange(row, 1, 1, 2).setValues([['항목', '값']])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  row++;

  dash.getRange(row++, 1, 1, 2).setValues([['총 응답수', total]]);
  dash.getRange(row++, 1, 1, 2).setValues([['자가진단 점수 평균', Number(selfAvg.toFixed(2))]]);
  dash.getRange(row++, 1, 1, 2).setValues([
    ['라이선스 조달가능 비율', (licenseRatio * 100).toFixed(1) + '%']
  ]);

  row++;
  row = writeDistribution(dash, row, 'Q10 Revit 수강의향 분포', revitDist);
  row++;
  row = writeDistribution(dash, row, 'Q15 AI 세미나 참여회차 분포', aiSessionDist);
  row++;
  row = writeDistribution(dash, row, '지역별 응답수', regionDist);

  dash.autoResizeColumns(1, 2);
}

function countBy(rows, colIdx) {
  var map = {};
  rows.forEach(function (r) {
    var raw = r[colIdx];
    if (raw === '' || raw === null || raw === undefined) return;
    var parts = Array.isArray(raw) ? raw : String(raw).split(/[,;\|]/);
    parts.forEach(function (p) {
      var k = String(p).trim();
      if (!k) return;
      map[k] = (map[k] || 0) + 1;
    });
  });
  return map;
}

function writeDistribution(sheet, startRow, title, distMap) {
  sheet.getRange(startRow, 1, 1, 2).setValues([[title, '응답수']])
    .setFontWeight('bold').setBackground('#d9e1f2');
  startRow++;

  var keys = Object.keys(distMap).sort(function (a, b) { return distMap[b] - distMap[a]; });
  if (keys.length === 0) {
    sheet.getRange(startRow, 1, 1, 2).setValues([['(데이터 없음)', 0]]);
    return startRow + 1;
  }
  var data = keys.map(function (k) { return [k, distMap[k]]; });
  sheet.getRange(startRow, 1, data.length, 2).setValues(data);
  return startRow + data.length;
}


/* ===================== 수동 테스트용 ===================== */

function _testInit() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getOrCreateSheet(ss, SHEET_RAW, HEADERS_RAW);
  getOrCreateSheet(ss, SHEET_PARTICIPANTS, HEADERS_PARTICIPANTS);
  updateDashboard(ss);
}

function _testPost() {
  var sample = {
    '성함': '홍길동', '사무소명': '테스트건축', '지역': '천안', '연락처': '010-0000-0000',
    'Q1_경력': '5년', 'Q2_사무소규모': '소규모', 'Q3_Revit경험': '입문',
    'Q4_병행툴': 'AutoCAD', 'Q5_라이선스': '조달가능',
    'Q6_자가진단': 3, 'Q7_희망수준': '중급', 'Q8_관심주제': '패밀리,협업',
    'Q9_일정가능': '평일저녁', 'Q10_수강의향': '높음', 'Q11_교육비동의': '동의',
    'Q12_AI활용': '문서요약', 'Q13_AI카테고리': '실무', 'Q14_세미나기대': '높음',
    'Q15_참여회차': '3회', 'Q16_보증금동의': '동의', 'Q17_BIM장벽': '학습시간',
    'Q18_위원회역점': '교육', 'Q19_자유의견': '잘 부탁드립니다.'
  };
  var fakeEvent = { postData: { contents: JSON.stringify(sample) } };
  Logger.log(doPost(fakeEvent).getContent());
}
