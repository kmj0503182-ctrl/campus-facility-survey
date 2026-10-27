/**
 * 캠퍼스 시설 조사 앱 - Code.gs
 * API 키 불필요. 사진은 구글 드라이브(DriveApp)에만 저장합니다.
 *
 * [처음 한 번만] Apps Script 편집기에서 아래 순서로 직접 실행하세요.
 *   1) checkSheets     : 시트를 읽기만 하고, 무엇이 바뀔지 실행 로그에 보여 줍니다. (시트는 바뀌지 않음)
 *   2) prepareSheets   : 백업 사본을 자동으로 만든 뒤, 새 건물 탭을 만들고 기존 탭에 빠진 문항 행을 추가합니다.
 *                        기존 행의 응답·사진·조사자·조사일시는 건드리지 않습니다. 여러 번 실행해도 안전합니다.
 *   3) sortSheetTabs   : 건물 탭을 가나다순으로 정렬하고 이름 앞에 "1. ", "2. " 순번을 붙입니다. (앱 첫 화면의 번호와 같습니다)
 *                        FRONT_TABS에 적은 탭(회의내용, 교내 건물 목록)은 건물 탭보다 앞에 둡니다.
 *                        탭 이름과 순서만 바꾸며 셀 내용은 건드리지 않습니다. 여러 번 실행해도 안전합니다.
 *
 * 참고: 이름이 밑줄(_)로 끝나는 함수는 편집기의 실행 목록에 나오지 않습니다. (다른 함수가 불러 쓰는 부품)
 * 직접 실행하는 함수(checkSheets, prepareSheets, sortSheetTabs 등)는 그래서 밑줄 없이 둡니다.
 * 이 함수들은 준비가 끝난 시트에서 다시 실행해도 아무것도 바꾸지 않도록 만들어져 있습니다.
 */

const SHEET_ID = '1Lyvf5vtgo-ITu2ul26XkMwu1l3zV4-kQqBYzkIERALA';
const APP_TITLE = '캠퍼스 시설 조사';
const DRIVE_FOLDER_NAME = '시설조사_사진';
// 사진 폴더를 주소로 고정하려면, 드라이브에서 그 폴더를 열고 주소창의 주소를 통째로 따옴표 안에 붙여 넣으세요.
// 비워 두면 위 이름으로 폴더를 찾습니다. (어느 쪽이든 휴지통에 있는 폴더는 쓰지 않습니다)
const DRIVE_FOLDER_ID = '';
// 조사일시와 사진 파일 이름에 쓰는 시간대. 프로젝트 설정과 상관없이 항상 한국 시간으로 기록합니다.
const TIME_ZONE = 'Asia/Seoul';
const SUMMARY_SHEET_NAME = '종합의견';
// sortSheetTabs가 맨 앞에 두는 탭(적은 순서대로). 탭 이름의 띄어쓰기는 달라도 됩니다. 시트에 없는 이름은 건너뜁니다.
// 앱은 이 탭들을 읽지도 쓰지도 않습니다. 순서를 정할 때만 씁니다.
const FRONT_TABS = ['회의내용', '교내 건물 목록'];

// 이미 시트에 탭이 있고 응답이 들어 있는 건물 (탭을 새로 만들지 않음)
const EXISTING_BUILDINGS = [
  '김수환관_강의용', '안드레아관_기숙사', '소피이바라관', '중앙도서관', '니콜스관', '콘서트홀'
];

// 새로 추가하는 건물 (prepareSheets가 탭을 만들어 줌)
const NEW_BUILDINGS = [
  '성심관', '다솔관', '비르투스관', '마리아관', '성당',
  '미카엘관', '김수환관_기숙사', '밤비노관', '약학관', '창업보육센터'
];

// 앱 첫 화면과 시트 탭에 쓰이는 순서: 가나다순 (한글은 글자 코드 순서가 가나다순과 같음)
const BUILDINGS = EXISTING_BUILDINGS.concat(NEW_BUILDINGS).sort();

/**
 * 순번이 붙은 건물 이름. 예: "3. 니콜스관". 앱 첫 화면과 시트 탭 이름이 이 한 곳에서 나온 같은 번호를 쓴다.
 * 번호는 화면에 보이는 이름표일 뿐이고, 저장·사진 폴더 등 나머지 동작은 모두 번호 없는 건물 이름으로 한다.
 */
function buildingLabel_(buildingName) {
  const order = BUILDINGS.indexOf(buildingName);
  return order === -1 ? buildingName : (order + 1) + '. ' + buildingName;
}

// 건물 이름 아래 작은 글씨로만 표시되는 설명 (문항 구성에는 영향 없음). 새 건물도 여기에 추가하면 표시됩니다.
const BUILDING_ROLES = {
  '김수환관_강의용': '강의동',
  '안드레아관_기숙사': '기숙사',
  '소피이바라관': '식당',
  '중앙도서관': '도서관',
  '니콜스관': '학생지원시설/행정동',
  '콘서트홀': '기타(강당형 건물)'
};

// 전체 26개 문항. 모든 건물에 전부 표시됩니다. (분류는 참고용이며 더 이상 문항을 걸러내지 않음)
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
    .setTitle(APP_TITLE);
}

/* =====================================================================
 * 탭 찾기
 * ===================================================================== */

/** 탭 이름에서 앞뒤 공백과 앞 번호("5. ", "5) ", "5-")를 뗀다. */
function normalizeTabName_(name) {
  return String(name == null ? '' : name).trim().replace(/^\d+\s*[.)\-_]?\s*/, '').trim();
}

/**
 * 탭 이름 목록에서 건물 탭을 찾는다. 아래 순서로 찾고, 엉뚱한 탭을 잡을 여지가 있으면 고르지 않는다.
 *  ① 이름이 정확히 같은 탭
 *  ② 앞 번호만 다른 탭 (예: "5. 니콜스관")
 *  ③ 건물명이 들어간 탭이 딱 하나일 때 그 탭 (사본·백업 탭과 "종합의견" 탭은 후보에서 제외)
 * 반환: { index: 찾은 위치(없으면 -1), ambiguous: 후보가 여럿이라 고르지 못했을 때 그 탭 이름들 }
 */
function findSheetMatch_(names, buildingName) {
  const clean = names.map(function (n) { return String(n == null ? '' : n).trim(); });
  const pick = function (list) { return list.map(function (i) { return names[i]; }); };

  const exact = clean.indexOf(buildingName);
  if (exact !== -1) return { index: exact, ambiguous: [] };

  const numbered = [];
  const loose = [];
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === SUMMARY_SHEET_NAME) continue;
    if (normalizeTabName_(clean[i]) === buildingName) { numbered.push(i); continue; }
    if (clean[i].indexOf(buildingName) !== -1 && !/사본|백업|copy|backup/i.test(clean[i])) loose.push(i);
  }
  if (numbered.length === 1) return { index: numbered[0], ambiguous: [] };
  if (numbered.length > 1) return { index: -1, ambiguous: pick(numbered) };
  if (loose.length === 1) return { index: loose[0], ambiguous: [] };
  return { index: -1, ambiguous: pick(loose) };
}

function findSheetIndex_(names, buildingName) {
  return findSheetMatch_(names, buildingName).index;
}

function getSheetForBuilding_(ss, buildingName) {
  const sheets = ss.getSheets();
  const names = sheets.map(function (s) { return s.getName(); });
  const idx = findSheetIndex_(names, buildingName);
  return idx === -1 ? null : sheets[idx];
}

/** 탭에서 문항번호가 적힌 행 번호(1부터)를 찾는다. 없으면 -1. */
function findItemRow_(sheet, itemNumber) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const numbers = sheet.getRange(1, 1, last, 1).getDisplayValues();
  for (let i = 1; i < numbers.length; i++) {
    if (String(numbers[i][0]).trim() === itemNumber) return i + 1;
  }
  return -1;
}

/**
 * 한 행의 응답 내용(C~H열)을 정리한다. dispRow는 그 행의 화면 표시 값(A~H), photoLines는 사진 셀을 "URL | 메모" 줄로 푼 것.
 * rev는 이 내용 전체로 만든 짧은 확인값이다. 내용이 한 글자라도 달라지면 rev도 달라지므로,
 * 화면이 문항을 불러왔을 때의 rev와 저장하려는 순간의 rev를 비교하면 그사이 누가 고쳤는지 알 수 있다.
 */
function rowState_(dispRow, photoLines) {
  const state = {
    적정수준: String(dispRow[2] == null ? '' : dispRow[2]).trim(),
    개선사유: dispRow[3] || '',
    사진URL: (photoLines || []).join('\n'),
    비고: dispRow[5] || '',
    조사자: String(dispRow[6] == null ? '' : dispRow[6]).trim(),
    조사일시: String(dispRow[7] == null ? '' : dispRow[7]).trim()
  };
  const text = JSON.stringify([state.적정수준, state.개선사유, state.사진URL, state.비고, state.조사자, state.조사일시]);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8);
  state.rev = Utilities.base64Encode(digest).substring(0, 16);
  return state;
}

/** 시트에서 한 행을 읽어 rowState_ 형태로 돌려준다. */
function readRowState_(sheet, rowIndex) {
  const disp = sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).getDisplayValues()[0];
  const rich = sheet.getRange(rowIndex, 5).getRichTextValue();
  return rowState_(disp, photoCellToLines_(rich));
}

/** 시트에 이미 들어 있는 내용(cur)이 지금 저장하려는 내용(incoming)과 같은지. 같은 사람이 같은 내용을 두 번 보낸 경우를 가려낸다. */
function sameAnswer_(cur, incoming) {
  if (cur.적정수준 !== incoming.level || cur.개선사유 !== incoming.reason || cur.비고 !== incoming.note) return false;
  if ((incoming.who || cur.조사자) !== cur.조사자) return false;
  const saved = cur.사진URL ? cur.사진URL.split('\n') : [];
  const sending = incoming.photos.filter(function (p) { return p && p.src; });
  if (saved.length !== sending.length) return false;
  for (let i = 0; i < saved.length; i++) {
    const sep = saved[i].indexOf(' | ');
    const url = sep === -1 ? saved[i] : saved[i].substring(0, sep);
    const memo = sep === -1 ? '' : saved[i].substring(sep + 3);
    if ((sending[i].memo || '') !== memo) return false;
    // 아직 올리지 않은 새 사진(data:)은 주소를 비교할 수 없으므로 자리와 메모만 본다.
    if (String(sending[i].src).indexOf('data:') !== 0 && sending[i].src !== url) return false;
  }
  return true;
}

/**
 * 화면이 문항을 불러온 뒤에 시트 내용이 바뀌었는지 확인한다.
 *  - 바뀌지 않았으면(또는 확인값을 보내지 않는 예전 화면이면) null → 그대로 저장을 진행
 *  - 같은 사람의 같은 내용이 이미 들어 있으면 { ok:true, already:true } → 다시 쓰지 않고 성공으로 처리
 *  - 다른 내용으로 바뀌어 있으면 { ok:false, conflict:true, current } → 저장하지 않고 화면에 알린다
 */
function checkBase_(cur, baseRev, incoming) {
  if (typeof baseRev !== 'string' || !baseRev) return null;
  if (cur.rev === baseRev) return null;
  if (sameAnswer_(cur, incoming)) {
    return { ok: true, already: true, photoCell: cur.사진URL, rev: cur.rev, 조사자: cur.조사자, 조사일시: cur.조사일시 };
  }
  return {
    ok: false, conflict: true, current: cur,
    message: '이 문항은 불러온 뒤에 시트의 내용이 바뀌어 저장하지 않았습니다. 건물 목록에서 다시 들어와 확인해 주세요.'
  };
}

/** 조사일시 셀 값(날짜 또는 'yyyy-MM-dd HH:mm' 글자)을 비교용 숫자로 바꾼다. */
function toTime_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return v.getTime() || 0;
  const m = String(v == null ? '' : v).match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime();
}

/* =====================================================================
 * 앱에서 호출하는 함수 (읽기)
 * ===================================================================== */

/** 첫 화면용: 전체 건물의 진행률과 최근 조사자. 시트를 한 번만 열고 읽기만 한다. */
function getBuildingOverview() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheets = ss.getSheets();
    const names = sheets.map(function (s) { return s.getName(); });

    const buildings = BUILDINGS.map(function (b) {
      const info = { building: b, label: buildingLabel_(b), role: BUILDING_ROLES[b] || '', done: 0, total: 0, lastSurveyor: '' };
      const match = findSheetMatch_(names, b);
      const idx = match.index;
      if (idx === -1) {
        info.error = match.ambiguous.length ? '이름이 비슷한 탭이 여러 개라 고르지 못했습니다' : '시트에 탭이 없습니다';
        return info;
      }
      const sheet = sheets[idx];
      const last = sheet.getLastRow();
      if (last < 2) {
        info.error = '탭에 문항이 없습니다';
        return info;
      }
      const values = sheet.getRange(2, 1, last - 1, SHEET_HEADERS.length).getValues();
      let lastTime = -1;
      values.forEach(function (row) {
        if (!String(row[0]).trim()) return;
        info.total++;
        if (!String(row[2]).trim()) return;
        info.done++;
        const who = String(row[6]).trim();
        const t = toTime_(row[7]);
        if (who && t >= lastTime) {
          lastTime = t;
          info.lastSurveyor = who;
        }
      });
      return info;
    });

    return { ok: true, buildings: buildings };
  } catch (err) {
    return { ok: false, message: '건물 목록을 불러오지 못했습니다: ' + err.message };
  }
}

/** 건물 탭을 읽어 문항별 기존 응답을 반환. 시트를 읽기만 하며 바꾸지 않는다. */
function getBuildingProgress(buildingName) {
  try {
    if (BUILDINGS.indexOf(buildingName) === -1) {
      return { ok: false, message: '등록되지 않은 건물입니다: ' + buildingName };
    }
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getSheetForBuilding_(ss, buildingName);
    if (!sheet) {
      return { ok: false, message: '"' + buildingName + '" 탭이 시트에 없습니다. Apps Script 편집기에서 prepareSheets를 먼저 실행해 주세요.' };
    }
    const last = sheet.getLastRow();
    if (last < 2) {
      return { ok: false, message: '"' + buildingName + '" 탭에 문항이 없습니다. Apps Script 편집기에서 prepareSheets를 먼저 실행해 주세요.' };
    }

    const disp = sheet.getRange(1, 1, last, SHEET_HEADERS.length).getDisplayValues();
    const rich = sheet.getRange(1, 5, last, 1).getRichTextValues(); // 사진 셀의 링크 주소를 꺼내기 위해 필요

    const byNumber = {};
    ITEMS.forEach(function (it) { byNumber[it.번호] = it; });

    const items = [];
    for (let i = 1; i < disp.length; i++) {
      const row = disp[i];
      const num = String(row[0]).trim();
      if (!num) continue;
      const meta = byNumber[num];
      const state = rowState_(row, rich[i] ? photoCellToLines_(rich[i][0]) : []);
      items.push({
        번호: num,
        내용: meta ? meta.내용 : row[1],
        사유목록: meta ? meta.사유 : [],
        적정수준: state.적정수준,
        개선사유: state.개선사유,
        사진URL: state.사진URL,
        비고: state.비고,
        조사자: state.조사자,
        조사일시: state.조사일시,
        rev: state.rev // 저장할 때 다시 보내, 그사이 다른 사람이 고쳤는지 확인하는 값
      });
    }

    // 시트의 행 순서와 상관없이 항상 문항 번호 순서로 보여 준다. (목록에 없는 번호는 맨 뒤, 시트 순서 유지)
    const orderOf = {};
    ITEMS.forEach(function (it, i) { orderOf[it.번호] = i; });
    items.forEach(function (it, i) { it._pos = i; });
    items.sort(function (a, b) {
      const oa = orderOf.hasOwnProperty(a.번호) ? orderOf[a.번호] : ITEMS.length;
      const ob = orderOf.hasOwnProperty(b.번호) ? orderOf[b.번호] : ITEMS.length;
      return oa !== ob ? oa - ob : a._pos - b._pos;
    });
    items.forEach(function (it) { delete it._pos; });

    const done = items.filter(function (it) { return it.적정수준; }).length;
    return { ok: true, buildingName: buildingName, role: BUILDING_ROLES[buildingName] || '', items: items, total: items.length, done: done };
  } catch (err) {
    return { ok: false, message: '진행 상황을 불러오지 못했습니다: ' + err.message };
  }
}

function getSummaryOptions() {
  return SUMMARY_OPTIONS;
}

/* =====================================================================
 * 앱에서 호출하는 함수 (저장)
 * ===================================================================== */

/**
 * 문항 하나에 대한 응답을 즉시 저장. 해당 문항의 한 행(C~H열)만 쓴다.
 * baseRev: 화면이 이 문항을 불러왔을 때 받은 확인값(rev). 시트의 현재 내용과 다르면 저장하지 않고 알려 준다.
 *          (보내지 않으면 확인 없이 저장한다. 예전 화면이 열려 있는 경우를 위한 동작)
 * 실패해도 사진이 이미 드라이브에 올라간 경우에는 응답에 photoCell(올라간 주소)을 함께 돌려줘, 화면이 같은 사진을 다시 올리지 않게 한다.
 */
function saveAnswer(buildingName, itemNumber, level, reason, photos, note, surveyor, baseRev) {
  if (BUILDINGS.indexOf(buildingName) === -1) {
    return { ok: false, message: '등록되지 않은 건물입니다: ' + buildingName };
  }
  if (!level) {
    return { ok: false, message: '적정 수준이 선택되지 않았습니다.' };
  }
  itemNumber = String(itemNumber == null ? '' : itemNumber).trim();
  const incoming = {
    level: String(level),
    reason: reason || '',
    note: note || '',
    who: String(surveyor == null ? '' : surveyor).trim(),
    photos: photos || []
  };

  // 1) 사진을 올리기 전에 먼저 확인한다. 이미 다른 내용이 들어 있으면 사진을 올리지 않고 바로 알려 준다.
  try {
    const sheet0 = getSheetForBuilding_(SpreadsheetApp.openById(SHEET_ID), buildingName);
    if (!sheet0) {
      return { ok: false, message: '해당 건물 탭을 찾을 수 없습니다: ' + buildingName };
    }
    const row0 = findItemRow_(sheet0, itemNumber);
    if (row0 === -1) {
      return { ok: false, message: '해당 건물 탭에서 문항을 찾을 수 없습니다: ' + itemNumber };
    }
    const early = checkBase_(readRowState_(sheet0, row0), baseRev, incoming);
    if (early) return early;
  } catch (err) {
    return { ok: false, message: '저장 중 오류가 발생했습니다: ' + String(err && err.message) };
  }

  // 2) 사진 업로드는 시간이 걸리므로 저장 잠금 밖에서 처리한다. (다른 사람의 저장을 막지 않기 위해)
  const created = []; // 이번 호출에서 새로 만든 드라이브 파일
  let lines;
  try {
    lines = buildPhotoLines_(buildingName, itemNumber, incoming.photos, created);
  } catch (err) {
    trashFiles_(created); // 일부만 올라간 사진은 어디에도 연결되지 않으므로 휴지통으로 보낸다
    return { ok: false, message: '사진 저장 중 오류가 발생했습니다: ' + err.message };
  }
  const photoCell = lines.join('\n');

  // 3) 잠금을 잡고 한 번 더 확인한 뒤 쓴다.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, message: '다른 저장이 진행 중입니다. 잠시 후 다시 시도해 주세요.', photoCell: photoCell };
  }
  try {
    SpreadsheetApp.flush();
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getSheetForBuilding_(ss, buildingName);
    if (!sheet) {
      return { ok: false, message: '해당 건물 탭을 찾을 수 없습니다: ' + buildingName, photoCell: photoCell };
    }
    const rowIndex = findItemRow_(sheet, itemNumber);
    if (rowIndex === -1) {
      return { ok: false, message: '해당 건물 탭에서 문항을 찾을 수 없습니다: ' + itemNumber, photoCell: photoCell };
    }

    // 사진을 올리는 동안 다른 저장이 끼어들었는지 다시 본다.
    const cur = readRowState_(sheet, rowIndex);
    const late = checkBase_(cur, baseRev, incoming);
    if (late) {
      if (late.ok) trashFiles_(created);   // 같은 내용이 이미 저장돼 있음: 방금 올린 사진은 쓰이지 않으므로 휴지통으로
      else late.photoCell = photoCell;      // 다른 내용으로 바뀜: 올라간 사진 주소를 돌려줘 다시 올리지 않게 한다
      return late;
    }

    // 조사자 이름이 비어서 들어오면 기존에 적힌 이름을 지우지 않고 그대로 둔다.
    const who = incoming.who || cur.조사자;
    const now = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm');

    // C~G열은 "일반 텍스트"로 고정해, 비고에 "1/2" 같은 글자를 적어도 날짜로 바뀌지 않게 한다.
    try { sheet.getRange(rowIndex, 3, 1, 5).setNumberFormat('@'); } catch (e) { /* 표(테이블) 열에서는 서식 변경이 막혀 있을 수 있음. 저장에는 지장 없음 */ }
    sheet.getRange(rowIndex, 3, 1, 6).setValues([[incoming.level, incoming.reason, photoCell, incoming.note, who, now]]);
    applyPhotoLinks_(sheet.getRange(rowIndex, 5), lines); // 사진URL 셀의 각 URL을 클릭 가능한 링크로

    // 방금 쓴 행을 시트에서 다시 읽어 새 확인값을 만든다. (조사일시는 시트가 표시 형식을 바꿀 수 있어, 쓴 값이 아니라 읽은 값으로 만든다)
    const result = { ok: true, photoCell: photoCell };
    try {
      SpreadsheetApp.flush();
      const after = readRowState_(sheet, rowIndex);
      result.rev = after.rev;
      result.조사자 = after.조사자;
      result.조사일시 = after.조사일시;
    } catch (e) { /* 저장은 끝났음. 확인값만 못 만든 경우이며, 화면은 다음 저장 때 확인 없이 저장한다 */ }
    return result;
  } catch (err) {
    const msg = String(err && err.message);
    if (/데이터 확인|data validation/i.test(msg)) {
      return { ok: false, photoCell: photoCell, message: '시트의 적정수준 열 드롭다운에 "' + incoming.level + '" 항목이 없어 저장이 거부되었습니다. 시트에서 드롭다운 항목에 추가해 주세요.' };
    }
    return { ok: false, photoCell: photoCell, message: '저장 중 오류가 발생했습니다: ' + msg };
  } finally {
    lock.releaseLock();
  }
}

/** 캠퍼스 종합 문항(3.10.3) 저장 - 건물과 무관, 별도 탭에 누적 */
function saveSummary(choice1, choice2, respondent) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, message: '다른 저장이 진행 중입니다. 잠시 후 다시 시도해 주세요.' };
  }
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SUMMARY_SHEET_NAME);
      sheet.getRange(1, 1, 1, 4).setValues([['응답일시', '선택1', '선택2', '응답자']]);
    }
    const now = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm');
    sheet.appendRow([now, choice1, choice2, respondent || '']);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: '저장 중 오류가 발생했습니다: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 사진 한 장을 드라이브에 올리고 그 주소를 돌려준다. 화면에서 사진을 추가하는 즉시 부른다.
 * 시트에는 아무것도 쓰지 않는다. (시트에는 문항을 저장할 때 saveAnswer가 이 주소를 적는다)
 * 그래서 사진만 올리고 문항을 저장하지 않으면, 사진 파일은 드라이브에 있지만 시트에는 연결되지 않은 채로 남는다.
 */
function uploadPhoto(buildingName, itemNumber, dataUrl) {
  if (BUILDINGS.indexOf(buildingName) === -1) {
    return { ok: false, message: '등록되지 않은 건물입니다: ' + buildingName };
  }
  itemNumber = String(itemNumber == null ? '' : itemNumber).trim();
  if (!/^\d+(\.\d+)*$/.test(itemNumber)) {
    return { ok: false, message: '문항 번호가 올바르지 않습니다.' };
  }
  if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) {
    return { ok: false, message: '사진 형식이 올바르지 않습니다.' };
  }
  if (dataUrl.length > 12 * 1024 * 1024) {
    return { ok: false, message: '사진 용량이 너무 큽니다.' };
  }
  try {
    const folder = getOrCreateFolder_(getTopPhotoFolder_(), buildingName);
    // 같은 초에 여러 장이 올라와도 파일 이름이 겹치지 않도록 짧은 꼬리표를 붙인다.
    const url = savePhotoToDrive_(folder, buildingName, itemNumber, dataUrl, Utilities.getUuid().substring(0, 6));
    return { ok: true, url: url };
  } catch (err) {
    return { ok: false, message: '사진 저장 중 오류가 발생했습니다: ' + String(err && err.message) };
  }
}

/* =====================================================================
 * 사진 (드라이브 저장, 셀 링크)
 * ===================================================================== */

/**
 * 사진 배열({src, memo})을 처리해 "URL | 메모" 형식의 줄 배열로 반환. src가 이미 URL이면 그대로 둔다.
 * created 배열을 넘기면 이번에 새로 만든 드라이브 파일을 거기에 담아 준다.
 */
function buildPhotoLines_(buildingName, itemNumber, photos, created) {
  if (!photos || !photos.length) return [];
  let folder = null;
  return photos.map(function (p, idx) {
    if (!p || !p.src) return '';
    let url = p.src;
    if (p.src.indexOf('data:') === 0) {
      if (!folder) folder = getOrCreateFolder_(getTopPhotoFolder_(), buildingName);
      url = savePhotoToDrive_(folder, buildingName, itemNumber, p.src, idx, created);
    }
    if (!url) return '';
    return p.memo ? (url + ' | ' + p.memo) : url;
  }).filter(function (line) { return !!line; });
}

/** base64 이미지를 드라이브(건물 폴더)에 저장하고 공유 URL을 반환 */
function savePhotoToDrive_(folder, buildingName, itemNumber, base64, idx, created) {
  const match = base64.match(/^data:(image\/\w+);base64,(.*)$/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const rawBase64 = match ? match[2] : base64;
  const bytes = Utilities.base64Decode(rawBase64);
  const ts = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyyMMdd_HHmmss');
  const safeItemNumber = itemNumber.replace(/\./g, '-');
  const suffix = (typeof idx === 'number' ? '_' + (idx + 1) : (idx ? '_' + idx : ''));
  const fileName = safeItemNumber + '_' + buildingName + '_' + ts + suffix + '.jpg';
  const blob = Utilities.newBlob(bytes, mimeType, fileName);

  const file = folder.createFile(blob);
  if (created) created.push(file);
  trySetSharing_(file); // 공유 설정이 막혀 있어도 저장은 계속 진행
  return file.getUrl();
}

/** 이번 저장에서 올렸지만 시트 어디에도 연결되지 않은 사진을 휴지통으로 보낸다. (30일 안에는 되살릴 수 있음) */
function trashFiles_(files) {
  (files || []).forEach(function (file) {
    try { file.setTrashed(true); } catch (e) { /* 실패해도 저장 흐름에는 영향 없음 */ }
  });
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

/**
 * 이미 저장된 사진URL 셀들을 "사진1, 사진2…" 링크 형식으로 변환. Apps Script 편집기에서 직접 실행하세요. 여러 번 실행해도 안전합니다.
 * 건물 탭 16개의 E열만 바꿉니다. 회의내용·교내 건물 목록·종합의견 같은 다른 탭은 열어 보지도 않습니다.
 */
function convertExistingPhotoCellsToLinks() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheets = ss.getSheets();
  const names = sheets.map(function (s) { return s.getName(); });
  const done = {};
  BUILDINGS.forEach(function (b) {
    const idx = findSheetIndex_(names, b);
    if (idx === -1) return;
    const sheet = sheets[idx];
    if (done[sheet.getSheetId()]) return;
    done[sheet.getSheetId()] = true;
    const last = sheet.getLastRow();
    if (last < 2) return;
    const rich = sheet.getRange(2, 5, last - 1, 1).getRichTextValues();
    for (let i = 0; i < rich.length; i++) {
      const lines = photoCellToLines_(rich[i][0]);
      if (lines.length) applyPhotoLinks_(sheet.getRange(i + 2, 5), lines);
    }
  });
}

/** 폴더 목록에서 휴지통에 있지 않은 첫 폴더를 돌려준다. 없으면 null. */
function firstLiveFolder_(it) {
  while (it.hasNext()) {
    const folder = it.next();
    if (!folder.isTrashed()) return folder;
  }
  return null;
}

function getOrCreateFolder_(parent, name) {
  return firstLiveFolder_(parent.getFoldersByName(name)) || parent.createFolder(name);
}

/** DRIVE_FOLDER_ID에 적힌 값(폴더 주소 전체 또는 ID만)에서 폴더 ID를 꺼낸다. */
function folderIdFrom_(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return '';
  const m = s.match(/folders\/([\w-]+)/) || s.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : s;
}

/**
 * 사진을 모으는 최상위 폴더.
 *  - DRIVE_FOLDER_ID가 있으면 그 폴더만 쓴다. 열 수 없거나 휴지통에 있으면 다른 곳에 저장하지 않고 오류를 낸다.
 *  - 없으면 "내 드라이브" 전체에서 DRIVE_FOLDER_NAME 이름으로 찾고(휴지통 제외), 없으면 최상위에 새로 만든다.
 */
function getTopPhotoFolder_() {
  const id = folderIdFrom_(DRIVE_FOLDER_ID);
  if (id) {
    let folder;
    try {
      folder = DriveApp.getFolderById(id);
    } catch (e) {
      throw new Error('DRIVE_FOLDER_ID로 지정한 사진 폴더를 열 수 없습니다. 주소와 폴더 권한을 확인해 주세요.');
    }
    if (folder.isTrashed()) throw new Error('DRIVE_FOLDER_ID로 지정한 사진 폴더가 휴지통에 있습니다.');
    return folder;
  }
  return firstLiveFolder_(DriveApp.getFoldersByName(DRIVE_FOLDER_NAME)) || DriveApp.getRootFolder().createFolder(DRIVE_FOLDER_NAME);
}

function testDriveAccess() {
  DriveApp.getRootFolder();
}

/* =====================================================================
 * 시트 준비 (편집기에서 직접 실행). 앱이 열릴 때는 실행되지 않습니다.
 * ===================================================================== */

/** [읽기 전용] 무엇이 바뀔지 실행 로그에만 보여 준다. 시트는 바뀌지 않는다. */
function checkSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  console.log('[확인만 합니다. 시트는 바뀌지 않습니다]');
  logPlan_(buildPlan_(ss));
}

/** 백업 사본을 만든 뒤 시트를 준비한다. (권장) */
function prepareSheets() {
  runPrepare_(true);
}

/** 백업 사본 자동 생성이 막혀 있을 때만 사용. 반드시 직접 사본을 만든 뒤 실행하세요. */
function prepareSheetsWithoutBackup() {
  runPrepare_(false);
}

function runPrepare_(withBackup) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const plan = buildPlan_(ss);
    console.log('[실행 전 상태]');
    logPlan_(plan);

    const todo = plan.filter(function (p) {
      return p.action === 'create' || p.action === 'fill' || p.action === 'add';
    });

    if (!todo.length) {
      console.log('시트에 변경할 내용이 없습니다.');
    } else {
      // 1) 백업 사본. 실패하면 아무것도 바꾸지 않고 중단한다.
      if (withBackup) {
        let backup;
        try {
          const stamp = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyyMMdd_HHmm');
          backup = DriveApp.getFileById(SHEET_ID).makeCopy('백업_' + ss.getName() + '_' + stamp);
        } catch (e) {
          throw new Error('백업 사본을 만들지 못해 중단했습니다. 시트는 바뀌지 않았습니다. (' + e.message + ')');
        }
        console.log('백업 사본을 만들었습니다: ' + backup.getName() + '\n' + backup.getUrl());
      }

      // 새 탭의 열 너비·서식을 맞추기 위한 기준 탭 (기존 건물 탭 중 첫 번째)
      let refSheet = null;
      plan.forEach(function (p) {
        if (!refSheet && p.sheet && p.itemRows > 0) refSheet = p.sheet;
      });

      // 2) 적용
      let problems = 0;
      todo.forEach(function (p) {
       try {
        if (p.action === 'create') {
          const sheet = ss.insertSheet(p.building, ss.getNumSheets());
          fillEmptySheet_(sheet, refSheet, true);
          console.log('새 탭 생성: ' + p.building + ' (문항 ' + ITEMS.length + '개)');
        } else if (p.action === 'fill') {
          fillEmptySheet_(p.sheet, refSheet, false);
          console.log('빈 탭에 문항 채움: ' + p.tabName + ' (문항 ' + ITEMS.length + '개)');
        } else {
          const before = snapshotAnswers_(p.sheet);
          const added = addMissingRows_(p.sheet);
          SpreadsheetApp.flush();
          const after = snapshotAnswers_(p.sheet);
          const changed = Object.keys(before).filter(function (num) { return before[num] !== after[num]; });
          if (changed.length) {
            problems += changed.length;
            console.log('⚠ ' + p.tabName + ': 문항 ' + added + '개 추가. 기존 행 중 내용이 달라진 문항이 있습니다 → ' + changed.join(', ') + ' (백업 사본과 비교해 주세요)');
          } else {
            console.log(p.tabName + ': 문항 ' + added + '개 추가. 기존 ' + Object.keys(before).length + '개 행은 실행 전과 동일함을 확인했습니다.');
          }
        }
       } catch (e) {
        problems++;
        console.log('⚠ ' + p.building + ': 처리하지 못했습니다 → ' + e.message);
       }
      });
      SpreadsheetApp.flush();
      if (problems) console.log('⚠ 확인이 필요한 행이 ' + problems + '개 있습니다. 위 로그를 봐 주세요.');
    }

    // 3) 사진 폴더를 미리 만들어 둔다. (여러 사람이 동시에 첫 사진을 올릴 때 같은 이름의 폴더가 두 개 생기는 것 방지)
    try {
      const top = getTopPhotoFolder_();
      BUILDINGS.forEach(function (b) { getOrCreateFolder_(top, b); });
      console.log('사진 폴더 준비 완료.');
    } catch (e) {
      console.log('사진 폴더 준비는 건너뛰었습니다(앱 사용에는 지장 없음): ' + e.message);
    }

    console.log('[실행 후 상태]');
    logPlan_(buildPlan_(ss));
  } finally {
    lock.releaseLock();
  }
}

/**
 * 건물 탭을 가나다순으로 정렬하고, 탭 이름을 순번이 붙은 이름("니콜스관" → "3. 니콜스관")으로 맞춘다.
 * 순번은 앱 첫 화면에 보이는 번호와 같다. (buildingLabel_ 한 곳에서 정함)
 * 탭 이름과 순서만 바꾸며 셀 내용은 읽지도 쓰지도 않는다.
 * 탭 순서: FRONT_TABS에 적은 탭(회의내용, 교내 건물 목록) → 건물 탭 → "종합의견" → 그 밖의 탭(지금 순서 그대로).
 */
function sortSheetTabs() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // 1) 건물마다 탭을 찾는다. 하나라도 겹치면(두 건물이 같은 탭을 가리키면) 아무것도 바꾸지 않고 중단한다.
    const sheets = ss.getSheets();
    const names = sheets.map(function (s) { return s.getName(); });
    const found = [];
    const usedIds = {};
    BUILDINGS.forEach(function (b) {
      const idx = findSheetIndex_(names, b);
      if (idx === -1) {
        console.log('⚠ ' + b + ': 탭이 없어 건너뜁니다. (prepareSheets를 먼저 실행해 주세요)');
        return;
      }
      const id = sheets[idx].getSheetId();
      if (usedIds[id]) {
        throw new Error('"' + names[idx] + '" 탭이 건물 두 곳(' + usedIds[id] + ', ' + b + ')에 해당해 중단했습니다. 시트는 바뀌지 않았습니다.');
      }
      usedIds[id] = b;
      found.push({ building: b, sheet: sheets[idx], oldName: names[idx] });
    });

    // 2) 이름 앞에 순번 붙이기 ("니콜스관" → "3. 니콜스관")
    //    붙이려는 이름을 이미 다른 탭이 쓰고 있으면 이름을 바꿀 수 없으므로, 아무것도 바꾸기 전에 확인하고 중단한다.
    found.forEach(function (f) {
      f.newName = buildingLabel_(f.building);
      const taken = names.indexOf(f.newName);
      if (taken !== -1 && sheets[taken].getSheetId() !== f.sheet.getSheetId()) {
        throw new Error('"' + f.newName + '"이라는 이름의 탭이 이미 따로 있어 중단했습니다. 그 탭의 이름을 바꾸거나 지운 뒤 다시 실행해 주세요. 시트는 바뀌지 않았습니다.');
      }
    });
    let renamed = 0;
    found.forEach(function (f) {
      if (f.oldName === f.newName) return;
      f.sheet.setName(f.newName);
      renamed++;
      console.log('이름 변경: "' + f.oldName + '" → "' + f.newName + '"');
    });

    // 3) 탭 이동 (맨 앞에 둘 탭 → 건물 탭 가나다순 → 종합의견 → 나머지)
    const order = [];
    const placed = {};
    const place = function (sheet) {
      if (placed[sheet.getSheetId()]) return;
      placed[sheet.getSheetId()] = true;
      order.push(sheet);
    };
    const squish = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }; // 띄어쓰기 차이는 무시하고 비교
    FRONT_TABS.forEach(function (wanted) {
      let at = -1;
      for (let i = 0; i < names.length && at === -1; i++) {
        if (squish(names[i]) === squish(wanted) && !usedIds[sheets[i].getSheetId()]) at = i;
      }
      if (at === -1) {
        console.log('(맨 앞에 둘 "' + wanted + '" 탭이 시트에 없어 건너뜁니다)');
        return;
      }
      place(sheets[at]);
    });
    found.forEach(function (f) { place(f.sheet); });
    const summary = ss.getSheetByName(SUMMARY_SHEET_NAME);
    if (summary) place(summary);
    let moved = 0;
    order.forEach(function (sheet, i) {
      if (ss.getSheets()[i].getSheetId() === sheet.getSheetId()) return; // 이미 제자리
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(i + 1);
      moved++;
    });
    SpreadsheetApp.flush();

    console.log('이름 변경 ' + renamed + '개, 위치 이동 ' + moved + '개.');
    console.log('[현재 탭 순서] ' + ss.getSheets().map(function (s) { return s.getName(); }).join(' | '));
  } finally {
    lock.releaseLock();
  }
}

/** 건물별로 현재 상태와 필요한 작업을 계산한다. 시트를 읽기만 한다. */
function buildPlan_(ss) {
  const sheets = ss.getSheets();
  const names = sheets.map(function (s) { return s.getName(); });

  return BUILDINGS.map(function (b) {
    const isNew = NEW_BUILDINGS.indexOf(b) !== -1;
    const match = findSheetMatch_(names, b);
    const idx = match.index;
    if (idx === -1) {
      // 이름이 비슷한 탭이 여러 개면 새 탭을 만들지 않고 사람에게 확인을 맡긴다.
      const action = match.ambiguous.length ? 'ambiguous' : (isNew ? 'create' : 'missing');
      return { building: b, action: action, sheet: null, tabName: '', candidates: match.ambiguous, itemRows: 0, answered: 0, missing: [], hasValidation: false };
    }
    const sheet = sheets[idx];
    const last = sheet.getLastRow();
    if (last <= 1) {
      return { building: b, action: 'fill', sheet: sheet, tabName: names[idx], itemRows: 0, answered: 0, missing: [], hasValidation: false };
    }
    const disp = sheet.getRange(2, 1, last - 1, 3).getDisplayValues();
    const nums = [];
    let answered = 0;
    disp.forEach(function (row) {
      const num = String(row[0]).trim();
      if (!num) return;
      nums.push(num);
      if (String(row[2]).trim()) answered++;
    });
    const missing = ITEMS.filter(function (it) { return nums.indexOf(it.번호) === -1; })
      .map(function (it) { return it.번호; });

    let hasValidation = false;
    try {
      hasValidation = sheet.getRange(2, 3, last - 1, 1).getDataValidations()
        .some(function (r) { return r[0] !== null; });
    } catch (e) { /* 확인 실패는 무시 */ }

    return {
      building: b, action: missing.length ? 'add' : 'none', sheet: sheet, tabName: names[idx],
      itemRows: nums.length, answered: answered, missing: missing, hasValidation: hasValidation
    };
  });
}

function logPlan_(plan) {
  plan.forEach(function (p) {
    let line;
    if (p.action === 'create') {
      line = p.building + ' → 탭 없음: 새 탭을 만들고 문항 ' + ITEMS.length + '개를 넣습니다.';
    } else if (p.action === 'missing') {
      line = '⚠ ' + p.building + ' → 탭을 찾지 못했습니다. 기존 건물이라 자동으로 만들지 않습니다. 시트의 탭 이름을 확인해 주세요.';
    } else if (p.action === 'ambiguous') {
      line = '⚠ ' + p.building + ' → 이름이 비슷한 탭이 여러 개라 고르지 못했습니다: ' + p.candidates.join(', ')
        + '. 쓰는 탭 하나의 이름을 "' + p.building + '"(으)로 정확히 바꿔 주세요.';
    } else if (p.action === 'fill') {
      line = p.building + ' → 탭 "' + p.tabName + '"이 비어 있음: 문항 ' + ITEMS.length + '개를 넣습니다.';
    } else if (p.action === 'add') {
      line = p.building + ' → 탭 "' + p.tabName + '": 문항 ' + p.itemRows + '행(응답 ' + p.answered + '건). 추가할 문항 '
        + p.missing.length + '개: ' + p.missing.join(', ');
    } else {
      line = p.building + ' → 탭 "' + p.tabName + '": 문항 ' + p.itemRows + '행(응답 ' + p.answered + '건). 변경 없음.';
    }
    if (p.hasValidation) {
      line += '\n   ⚠ 적정수준(C열)에 데이터 확인(드롭다운) 규칙이 있습니다. "해당 없음"이 거부될 수 있으니 규칙에 "해당 없음"을 추가하거나 규칙을 지워 주세요.';
    }
    console.log(line);
  });
}

/**
 * 기존 탭에 빠진 문항 행만 추가한다. 기존 행은 값을 다시 쓰지 않으므로 응답·사진 링크·조사자·조사일시가 그대로 유지된다.
 *  - 먼저 문항 번호 순서에 맞는 자리에 "행 삽입"을 시도한다.
 *  - 시트가 행 삽입을 거부하면(구글 시트의 "표"로 변환된 탭 등) 기존 행을 전혀 움직이지 않고 맨 아래에 추가한다.
 *    앱은 행 순서와 상관없이 문항 번호 순서로 보여 주므로 사용에는 차이가 없다.
 */
function addMissingRows_(sheet) {
  const last = sheet.getLastRow();
  const nums = sheet.getRange(1, 1, last, 1).getDisplayValues()
    .map(function (r) { return String(r[0]).trim(); }); // nums[i] = (i+1)번째 행의 문항번호
  let anchor = 1; // 이 행 바로 아래에 다음 누락 문항을 넣는다 (처음에는 머리글 행)
  let added = 0;
  let appendMode = false;
  let appended = 0;
  const wrong = []; // 넣고 나서 확인했더니 문항번호가 다르게 표시된 것

  // "3.5.1" 같은 번호가 날짜로 바뀌지 않도록 A~B열을 일반 텍스트로 정한 뒤 값을 넣는다.
  const writeItem = function (row, it) {
    const cell = sheet.getRange(row, 1, 1, 2);
    try { cell.setNumberFormat('@'); } catch (e) { /* 표(테이블) 열에서는 서식 변경이 막혀 있을 수 있음 */ }
    cell.setValues([[it.번호, it.내용]]);
  };
  const shownNumber = function (row) {
    return String(sheet.getRange(row, 1).getDisplayValue()).trim();
  };

  ITEMS.forEach(function (it) {
    const idx = nums.indexOf(it.번호);
    if (idx !== -1) {
      anchor = idx + 1;
      return;
    }
    if (!appendMode) {
      try {
        sheet.insertRowAfter(anchor);
      } catch (e) {
        appendMode = true;
        console.log('   (' + sheet.getName() + ': 중간에 행을 삽입할 수 없는 탭이라 맨 아래에 추가합니다. 사유: ' + e.message + ')');
      }
    }
    let writtenRow;
    if (appendMode) {
      sheet.appendRow([it.번호, it.내용]);
      writtenRow = sheet.getLastRow();
      // 맨 아래에 붙인 번호가 날짜 등으로 바뀌어 보이면 그 칸만 텍스트로 정하고 다시 적는다.
      if (shownNumber(writtenRow) !== it.번호) writeItem(writtenRow, it);
      appended++;
    } else {
      writtenRow = anchor + 1;
      sheet.getRange(writtenRow, 1, 1, SHEET_HEADERS.length).clearContent();
      writeItem(writtenRow, it);
      nums.splice(anchor, 0, it.번호);
      anchor = writtenRow;
    }
    if (shownNumber(writtenRow) !== it.번호) wrong.push(it.번호);
    added++;
  });
  if (appended) console.log('   (' + sheet.getName() + ': ' + appended + '개 문항을 맨 아래 행에 추가했습니다)');
  if (wrong.length) {
    console.log('   ⚠ ' + sheet.getName() + ': 문항번호가 적은 대로 보이지 않는 행이 있습니다 → ' + wrong.join(', ')
      + ' (시트에서 A열 서식을 "일반 텍스트"로 바꾸고 번호를 다시 적어 주세요)');
  }
  return added;
}

/** 빈 탭에 머리글과 전체 문항을 넣는다. withFormat이 true면 기준 탭의 열 너비·서식을 따라 한다. */
function fillEmptySheet_(sheet, refSheet, withFormat) {
  const cols = SHEET_HEADERS.length;
  const rows = ITEMS.map(function (it) { return [it.번호, it.내용, '', '', '', '', '', '']; });

  if (withFormat) {
    try {
      if (refSheet) {
        refSheet.getRange(1, 1, 1, cols).copyTo(sheet.getRange(1, 1, 1, cols), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        refSheet.getRange(2, 1, 1, cols).copyTo(sheet.getRange(2, 1, rows.length, cols), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        for (let c = 1; c <= cols; c++) sheet.setColumnWidth(c, refSheet.getColumnWidth(c));
        sheet.setFrozenRows(refSheet.getFrozenRows());
      } else {
        sheet.getRange(1, 1, 1, cols).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
    } catch (e) {
      // 서식 복사 실패는 무시 (내용은 아래에서 정상적으로 들어감)
    }
  }

  sheet.getRange(1, 1, 1, cols).setValues([SHEET_HEADERS]);
  try { sheet.getRange(2, 1, rows.length, 2).setNumberFormat('@'); } catch (e) { /* 서식 지정 실패는 무시 */ } // "3.1.1" 같은 번호가 날짜·숫자로 바뀌지 않게
  sheet.getRange(2, 1, rows.length, cols).setValues(rows);
}

/** 탭의 각 문항 행 내용을 문항번호별로 기록해 둔다. (행 추가 전후 비교용) */
function snapshotAnswers_(sheet) {
  const snap = {};
  const last = sheet.getLastRow();
  if (last < 2) return snap;
  const disp = sheet.getRange(2, 1, last - 1, SHEET_HEADERS.length).getDisplayValues();
  const rich = sheet.getRange(2, 5, last - 1, 1).getRichTextValues();
  for (let i = 0; i < disp.length; i++) {
    const num = String(disp[i][0]).trim();
    if (!num) continue;
    snap[num] = JSON.stringify([disp[i].slice(1), photoCellToLines_(rich[i][0])]);
  }
  return snap;
}
