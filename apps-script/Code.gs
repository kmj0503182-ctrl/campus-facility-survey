/**
 * 캠퍼스 시설 조사 앱 - Code.gs
 * API 키 불필요. 사진은 구글 드라이브(DriveApp)에만 저장합니다.
 */

const SHEET_ID = '1Lyvf5vtgo-ITu2ul26XkMwu1l3zV4-kQqBYzkIERALA';
const APP_TITLE = '캠퍼스 시설 조사';
const DRIVE_FOLDER_NAME = '시설조사_사진';
const SUMMARY_SHEET_NAME = '종합의견';

// 담당자 -> 담당 건물 목록
const ASSIGNMENTS = {
  '이연수': ['김수환관_강의용', '소피이바라관'],
  '김민주': ['안드레아관_기숙사', '니콜스관'],
  '전소정': ['중앙도서관', '콘서트홀']
};

// 건물 -> 역할(유형)
const BUILDING_ROLES = {
  '김수환관_강의용': '강의동',
  '안드레아관_기숙사': '기숙사',
  '소피이바라관': '식당',
  '중앙도서관': '도서관',
  '니콜스관': '학생지원시설/행정동',
  '콘서트홀': '기타(강당형 건물)'
};

// 역할과 무관하게, 건물명 자체로 결정되는 3.10.1(무인 키오스크) 조사 대상
const KIOSK_BUILDINGS = ['소피이바라관', '중앙도서관'];

// 전체 26개 문항 (분류: 공통 / 역할명 / 키오스크대상건물)
const ITEMS = [
  {번호:"3.1.1", 분류:"공통", 내용:"교사시설 주요 출입구의 접근로는 장애학생이 안전하고 불편 없이 이동하기에 적정합니까?",
   사유:["접근로 폭 부족","바닥 경사 기울기 과다","단차 존재","장애물 존재","보행로·차도 분리 미흡"]},
  {번호:"3.1.2", 분류:"공통", 내용:"장애인 전용 주차구역의 주차 면수, 설치 위치, 보행안전통로는 장애학생이 이용하기에 적정합니까?",
   사유:["주차 면수 부족","설치 위치 부적절","보행안전통로 미흡","승·하차 공간 부족","출입구와 거리 과다"]},
  {번호:"3.1.3", 분류:"공통", 내용:"장애인 전용 주차구역의 크기, 바닥면, 안내표시는 장애학생이 이용하기에 적정합니까?",
   사유:["구획 크기 미준수","바닥면 불량","바닥 표시 미흡","입식 안내표시 미설치","안내표시 위치 부적절"]},
  {번호:"3.1.4", 분류:"공통", 내용:"교사시설 주출입구(단차 제거, 경사로)는 휠체어 사용학생이 출입하기에 적정합니까?",
   사유:["경사로 미설치","경사로 폭 부족","경사로 기울기·바닥 불량","손잡이 미설치","휠체어 리프트 필요"]},
  {번호:"3.2.1", 분류:"공통", 내용:"교사시설 주출입구(문)는 장애학생이 불편 없이 접근하고 출입하기에 적정합니까?",
   사유:["유효폭 부족","단차 과다","점형블록 미설치","출입문 개폐 불편","출입구 위치 부적절"]},
  {번호:"3.2.2", 분류:"공통", 내용:"교사시설 내부 출입구(문)는 장애학생이 불편 없이 접근하고 출입하기에 적정합니까?",
   사유:["유효폭 부족","단차 과다","손잡이 부적정","출입문 개폐 불편","자동문 미설치"]},
  {번호:"3.2.3", 분류:"공통", 내용:"교사시설 내부 복도는 장애학생이 통행하기에 적정합니까?",
   사유:["유효폭 부족","회전 공간 미확보","장애물 적치","단차 미해소","바닥 상태 불량"]},
  {번호:"3.2.4", 분류:"공통", 내용:"교사시설 내부 계단은 장애학생이 안전하게 이용하기에 적정합니까?",
   사유:["유효폭 부족","손잡이 미설치·부족","미끄럼 방지 미흡","계단코 대비 불분명","시각장애인 안내설비 미설치"]},
  {번호:"3.2.5", 분류:"공통", 내용:"교사시설 내부 승강기는 유효 바닥 크기를 갖추고 있으며, 장애학생이 이용하기에 적정합니까?",
   사유:["장애인용 승강기 미설치","휠체어 사용자용 조작반 미설치","홀·짝층 전용 운행","시각신호·음성안내 미흡","호출버튼 점형블록 미설치"]},
  {번호:"3.3.1", 분류:"공통", 내용:"교사시설 장애인용 화장실은 장애학생이 이용하기에 적정합니까?",
   사유:["전용 화장실 별도 설치 필요","대변기칸 분리 필요","남녀별 설치 필요","출입문 유효폭 미준수","접근 통로 개선 필요"]},
  {번호:"3.3.2", 분류:"공통", 내용:"교사시설 화장실의 위생기기(대변기, 소변기, 세면대)는 장애학생이 접근하고 이용하기에 적정합니까?",
   사유:["대변기 손잡이 설치·위치 미흡","소변기 손잡이 설치·위치 미흡","세면대 하부 공간 부족","위생기기 사용 편의 개선 필요","부가 설비 미설치"]},
  {번호:"3.4.1", 분류:"공통", 내용:"교사시설의 유도 및 안내설비(안내도, 음성안내장치, 유도신호장치 등)는 시각장애학생이 이용하기에 적정합니까?",
   사유:["점자 안내판 설치·위치 미흡","촉지도식 안내도 부재","음성 안내장치 미설치 또는 작동 불량","점형블록 설치 미흡","일반 안내판 점자 병기 미비"]},
  {번호:"3.4.2", 분류:"공통", 내용:"교사시설의 경보·피난설비는 시각 및 청각장애학생이 위급한 상황에서 대피하기에 적정합니까?",
   사유:["비상벨(시각장애인용) 미설치","피난구유도등(시각장애인용) 미설치","비상경보등(청각장애인용) 미설치","피난구유도등(청각장애인용) 미설치","피난 안내 표지판 및 동선 미흡"]},
  {번호:"3.5.1", 분류:"강의동", 내용:"단차 없는 일반 강의실은 휠체어 사용 학생과 시각장애 학생이 이용하기에 적정합니까?",
   사유:["통로 확보 미흡","회전 공간 미확보","접근 가능한 좌석 미설치","시각 안내 보완 필요","접근좌석 수 부족"]},
  {번호:"3.5.2", 분류:"강의동", 내용:"계단식 강의실은 휠체어 사용학생과 시각장애학생이 이용하기에 적정합니까?",
   사유:["접근 경로 단차 미해소","휠체어 접근 좌석 미설치","이동 수단 부족","시각 안내 설비 미흡","접근좌석 수 부족"]},
  {번호:"3.6.1", 분류:"도서관", 내용:"도서관 내부 출입구(개찰구 등)는 휠체어 사용 학생과 시각장애 학생이 이용하기에 적정합니까?",
   사유:["출입구 폭 협소","개찰구 구조 부적정","보조 출입구 미설치","시각 안내 설비 미흡","관리 상태 불량"]},
  {번호:"3.6.2", 분류:"도서관", 내용:"도서관 열람 공간은 휠체어 사용 학생과 시각장애 학생이 독립적으로 이용하기에 적정합니까?",
   사유:["통로 확보 미흡","회전 공간 부족","접근 열람석 미설치 또는 규격 미달","시각 안내 설비 미흡","접근 열람석 수 부족"]},
  {번호:"3.7.1", 분류:"기타(강당형 건물)", 내용:"강당(또는 다목적 집회실)의 무대와 좌석 사이 통로는 장애학생이 이용하기에 적정합니까?",
   사유:["통로 폭 협소","단차 해소 미흡","휠체어 접근 수단 부족","시각 안내 설비 미흡","관리 상태 불량"]},
  {번호:"3.7.2", 분류:"기타(강당형 건물)", 내용:"강당(또는 다목적 집회실) 내 관람석(좌석)은 장애학생이 이용하기에 적정합니까?",
   사유:["휠체어 좌석 수 부족","관람석 유효 바닥면적 부족","접근좌석 수 부족","좌석 분산 배치 미흡","시야 확보 미흡"]},
  {번호:"3.8.1", 분류:"식당", 내용:"식당은 장애학생이 출입하여 식사 메뉴를 확인하고 주문하기에 적정합니까?",
   사유:["출입구 단차 제거 필요","장애인용 키오스크 설치 필요","메뉴 확인 수단 보완 필요","키오스크 접근성 부족","대체 수단 제공 필요"]},
  {번호:"3.8.2", 분류:"식당", 내용:"식당의 식사 공간(좌석, 통로 등)은 장애학생이 자유롭게 접근하고 이용하기에 적정합니까?",
   사유:["휠체어 통로·회전 공간 확보 필요","이동식 테이블·의자 도입 필요","좌석 안내·식별 정보 제공 필요","장애학생 우선 좌석 설치 필요","좌석 배치·동선 개선 필요"]},
  {번호:"3.9.1", 분류:"기숙사", 내용:"기숙사에 장애인용 객실이 설치되어 있으며, 객실 내 위생시설(화장실, 욕실 등)은 장애학생이 이용하기에 적정합니까?",
   사유:["객실 수 미흡","배치 위치 부적절","내부 공간 부족","위생시설 미비","경보·표시 설비 미흡"]},
  {번호:"3.9.2", 분류:"학생지원시설/행정동", 내용:"장애학생 휴게시설은 장애학생이 독립적으로 이용하기에 적정합니까?",
   사유:["휴게시설 신설 필요","공간 확보 부족","장애학생지원센터와 연계 개선 필요","편의설비 미비","실질적 이용 제한"]},
  {번호:"3.9.3", 분류:"학생지원시설/행정동", 내용:"장애학생지원센터는 행정·상담 등의 기능을 수행하기에 적정합니까?",
   사유:["센터 신설 필요","전용 공간 확보 필요","기능별 공간 구분 미흡","편의·보조 설비 미비","장애학생 휴게시설 연계 미흡"]},
  {번호:"3.10.1", 분류:"키오스크대상건물", 내용:"무인 정보제공 수단(무인증명서 발급기, 안내 키오스크 등)은 장애학생이 독립적으로 이용하기에 적정합니까?",
   사유:["출입구 단차 제거 필요","장애인용 키오스크 설치 필요","메뉴 확인 수단 보완 필요","키오스크 접근성 부족","대체 수단 제공 필요"]},
  {번호:"3.10.2", 분류:"공통", 내용:"캠퍼스 내 무장애 경로(연속동선, 안내 포함)는 장애학생이 이용하기에 적정합니까?",
   사유:["경로 단차 해소 필요","통행 폭·회전 공간 확보 필요","시각 안내 설비 보완 필요","차도·보행로 분리 필요","경로 표지 명확화 필요"]}
];

// 3.10.3 캠퍼스 종합 문항 선택지
const SUMMARY_OPTIONS = [
  '주요 건물 출입구 및 접근로 개선',
  '주요 교육시설(강의실·도서관·강당) 승강기 설치·개선',
  '장애인 화장실 및 위생설비 보완',
  '시각·청각장애인 안내시설·경보·피난설비 개선',
  '강의실 학습환경(좌석·통로·보조공학) 개선',
  '도서관 출입·열람 접근성 개선',
  '강당(다목적집회실) 좌석·무대 접근성 개선',
  '생활편의시설(식당·기숙사·휴게시설) 개선',
  '장애학생지원센터 전용실 및 전용 휴게시설 확보',
  '무인 키오스크·증명발급기 등 디지털 행정설비 신규 설치·교체'
];

const SHEET_HEADERS = ['문항번호', '문항내용', '적정수준', '개선사유/협조부서', '사진URL', '비고', '조사자', '조사일시'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle(APP_TITLE);
}

function getSheetForBuilding_(ss, buildingName) {
  let sheet = ss.getSheetByName(buildingName);
  if (sheet) return sheet;
  // 탭 이름에 번호 등이 붙어 있어도(예: "5. 니콜스관") 건물명이 포함되면 찾는다.
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().indexOf(buildingName) !== -1) return sheets[i];
  }
  return null;
}

/** 해당 건물에 적용되는 문항 목록 (역할 기반 + 키오스크 건물명 기반) */
function getItemsForBuilding_(buildingName) {
  const role = BUILDING_ROLES[buildingName];
  return ITEMS.filter(function (item) {
    if (item.분류 === '공통') return true;
    if (item.분류 === '키오스크대상건물') return KIOSK_BUILDINGS.indexOf(buildingName) !== -1;
    return item.분류 === role;
  });
}

function getAssignments() {
  return { assignments: ASSIGNMENTS, roles: BUILDING_ROLES };
}

/** 담당자의 건물별 진행률 요약 (건물 목록 화면용) */
function getAssessorOverview(assessorName) {
  const buildings = ASSIGNMENTS[assessorName] || [];
  const result = [];
  buildings.forEach(function (b) {
    const p = getBuildingProgress(b);
    if (p.ok) {
      result.push({ building: b, done: p.done, total: p.total, role: BUILDING_ROLES[b] });
    } else {
      result.push({ building: b, done: 0, total: 0, error: p.message });
    }
  });
  const allDone = result.length > 0 && result.every(function (r) { return r.total > 0 && r.done === r.total; });
  return { buildings: result, allDone: allDone };
}

/** 건물 탭을 읽어 진행 상황과 문항별 기존 응답을 반환. 탭이 비어 있으면 문항을 자동으로 채워 넣는다. */
function getBuildingProgress(buildingName) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getSheetForBuilding_(ss, buildingName);
    if (!sheet) {
      return { ok: false, message: '해당 건물 탭을 찾을 수 없습니다: ' + buildingName };
    }

    const expected = getItemsForBuilding_(buildingName);
    let data = sheet.getDataRange().getValues();

    // 탭이 비어 있거나 헤더만 있으면 문항을 자동으로 채워 넣는다.
    if (data.length <= 1) {
      sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
      const rows = expected.map(function (it) { return [it.번호, it.내용, '', '', '', '', '', '']; });
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, SHEET_HEADERS.length).setValues(rows);
      }
      data = sheet.getDataRange().getValues();
    }

    const rich = sheet.getDataRange().getRichTextValues(); // 사진 셀의 링크 주소를 꺼내기 위해 필요

    const byNumber = {};
    expected.forEach(function (it) { byNumber[it.번호] = it; });

    const items = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const num = row[0];
      if (!num) continue;
      const meta = byNumber[num];
      items.push({
        번호: num,
        내용: meta ? meta.내용 : row[1],
        사유목록: meta ? meta.사유 : [],
        적정수준: row[2] || '',
        개선사유: row[3] || '',
        사진URL: rich[i] ? photoCellToLines_(rich[i][4]).join('\n') : '',
        비고: row[5] || ''
      });
    }

    const done = items.filter(function (it) { return it.적정수준; }).length;
    return { ok: true, buildingName: buildingName, role: BUILDING_ROLES[buildingName], items: items, total: items.length, done: done };
  } catch (err) {
    return { ok: false, message: '진행 상황을 불러오지 못했습니다: ' + err.message };
  }
}

/** 사진 배열({src, memo})을 처리해 "URL | 메모" 형식의 줄 배열로 반환. src가 이미 URL이면 그대로 둔다. */
function buildPhotoLines_(buildingName, itemNumber, photos) {
  if (!photos || !photos.length) return [];
  return photos.map(function (p, idx) {
    if (!p || !p.src) return '';
    const isNew = p.src.indexOf('data:') === 0;
    const url = isNew ? savePhotoToDrive_(buildingName, itemNumber, p.src, idx) : p.src;
    if (!url) return '';
    return p.memo ? (url + ' | ' + p.memo) : url;
  }).filter(function (line) { return !!line; });
}

/** 문항 하나에 대한 응답을 즉시 저장 */
function saveAnswer(buildingName, itemNumber, level, reason, photos, note, surveyor) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, message: '다른 저장이 진행 중입니다. 잠시 후 다시 시도해 주세요.' };
  }
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getSheetForBuilding_(ss, buildingName);
    if (!sheet) {
      return { ok: false, message: '해당 건물 탭을 찾을 수 없습니다: ' + buildingName };
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === itemNumber) {
        rowIndex = i + 1; // 1-based sheet row
        break;
      }
    }
    if (rowIndex === -1) {
      return { ok: false, message: '해당 건물 탭에서 문항을 찾을 수 없습니다: ' + itemNumber };
    }

    const lines = buildPhotoLines_(buildingName, itemNumber, photos);
    const photoCell = lines.join('\n');

    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    sheet.getRange(rowIndex, 3, 1, 6).setValues([[level, reason || '', photoCell, note || '', surveyor || '', now]]);
    applyPhotoLinks_(sheet.getRange(rowIndex, 5), lines); // 사진URL 셀의 각 URL을 클릭 가능한 링크로

    return { ok: true, photoCell: photoCell };
  } catch (err) {
    return { ok: false, message: '저장 중 오류가 발생했습니다: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

/** 캠퍼스 종합 문항(3.10.3) 저장 - 건물과 무관, 별도 탭에 누적 */
function saveSummary(choice1, choice2, respondent) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, message: '다른 저장이 진행 중입니다. 잠시 후 다시 시도해 주세요.' };
  }
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SUMMARY_SHEET_NAME);
      sheet.getRange(1, 1, 1, 4).setValues([['응답일시', '선택1', '선택2', '응답자']]);
    }
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    sheet.appendRow([now, choice1, choice2, respondent || '']);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: '저장 중 오류가 발생했습니다: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function getSummaryOptions() {
  return SUMMARY_OPTIONS;
}

/** base64 이미지를 드라이브에 저장하고 공유 URL을 반환 */
function savePhotoToDrive_(buildingName, itemNumber, base64, idx) {
  const match = base64.match(/^data:(image\/\w+);base64,(.*)$/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const rawBase64 = match ? match[2] : base64;
  const bytes = Utilities.base64Decode(rawBase64);
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const safeItemNumber = itemNumber.replace(/\./g, '-');
  const suffix = (typeof idx === 'number' ? '_' + (idx + 1) : '');
  const fileName = safeItemNumber + '_' + buildingName + '_' + ts + suffix + '.jpg';
  const blob = Utilities.newBlob(bytes, mimeType, fileName);

  const root = getOrCreateTopFolder_(DRIVE_FOLDER_NAME);
  const buildingFolder = getOrCreateFolder_(root, buildingName);
  const file = buildingFolder.createFile(blob);
  trySetSharing_(file); // 공유 설정이 막혀 있어도 저장은 계속 진행
  return file.getUrl();
}

/** 공유 설정 시도: 전체 링크 공유 → 조직 내 링크 공유 → 포기(폴더 권한 상속) */
function trySetSharing_(file) {
  const attempts = [
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Access.DOMAIN_WITH_LINK
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      file.setSharing(attempts[i], DriveApp.Permission.VIEW);
      return true;
    } catch (e) {
      // 관리자 정책으로 막힌 경우 다음 옵션 시도
    }
  }
  return false;
}

/**
 * 사진 셀을 "사진1", "사진2 | 메모" 형태로 쓰고, "사진N" 글자마다 실제 드라이브 링크를 건다.
 * lines는 앱과 주고받는 형식("URL" 또는 "URL | 메모") 배열. 번호는 셀마다 1부터 새로 매긴다.
 */
function applyPhotoLinks_(range, lines) {
  if (!lines || !lines.length) return;
  const parsed = lines.map(function (line, i) {
    const sep = line.indexOf(' | ');
    const url = sep === -1 ? line : line.substring(0, sep);
    const memo = sep === -1 ? '' : line.substring(sep + 3);
    const label = '사진' + (i + 1);
    return { url: url, label: label, text: memo ? label + ' | ' + memo : label };
  });
  const text = parsed.map(function (p) { return p.text; }).join('\n');
  const builder = SpreadsheetApp.newRichTextValue().setText(text);
  let pos = 0;
  parsed.forEach(function (p) {
    if (p.url.indexOf('http') === 0) {
      builder.setLinkUrl(pos, pos + p.label.length, p.url);
    }
    pos += p.text.length + 1; // 줄바꿈 1글자 포함
  });
  range.setRichTextValue(builder.build());
}

/**
 * 사진 셀(서식 있는 텍스트)을 앱 형식 줄 배열("URL" 또는 "URL | 메모")로 되돌린다.
 * 새 형식("사진1")은 글자에 걸린 링크에서, 예전 형식(URL 글자 그대로)은 글자에서 주소를 읽는다.
 */
function photoCellToLines_(rtv) {
  if (!rtv) return [];
  const text = rtv.getText();
  if (!text) return [];
  const result = [];
  let pos = 0;
  text.split('\n').forEach(function (line) {
    if (line) {
      const sep = line.indexOf(' | ');
      const label = sep === -1 ? line : line.substring(0, sep);
      const memo = sep === -1 ? '' : line.substring(sep + 3);
      let url = rtv.getLinkUrl(pos, pos + 1);
      if (!url && label.indexOf('http') === 0) url = label;
      if (url) result.push(memo ? url + ' | ' + memo : url);
    }
    pos += line.length + 1;
  });
  return result;
}

/** 이미 저장된 사진URL 셀들을 전부 "사진1, 사진2…" 링크 형식으로 변환. Apps Script 편집기에서 직접 실행하세요. 여러 번 실행해도 안전합니다. */
function convertExistingPhotoCellsToLinks() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ss.getSheets().forEach(function (sheet) {
    if (sheet.getName() === SUMMARY_SHEET_NAME) return;
    const last = sheet.getLastRow();
    if (last < 2) return;
    const rich = sheet.getRange(2, 5, last - 1, 1).getRichTextValues();
    for (let i = 0; i < rich.length; i++) {
      const lines = photoCellToLines_(rich[i][0]);
      if (lines.length) applyPhotoLinks_(sheet.getRange(i + 2, 5), lines);
    }
  });
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

/** 최상위 폴더를 "내 드라이브" 전체에서 이름으로 검색 (위치가 하위 폴더로 옮겨져도 찾음). 없으면 최상위에 새로 만든다. */
function getOrCreateTopFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return DriveApp.getRootFolder().createFolder(name);
}

function testDriveAccess() {
  DriveApp.getRootFolder();
}