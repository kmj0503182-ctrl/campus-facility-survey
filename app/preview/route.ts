import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Mock of google.script.run so Index.html can be previewed outside Apps Script.
const MOCK_SCRIPT = `<script>
(function () {
  var ASSIGNMENTS = {
    '이연수': ['김수환관_강의용', '소피이바라관'],
    '김민주': ['안드레아관_기숙사', '니콜스관'],
    '전소정': ['중앙도서관', '콘서트홀']
  };
  var ROLES = {
    '김수환관_강의용': '강의동', '안드레아관_기숙사': '기숙사', '소피이바라관': '식당',
    '중앙도서관': '도서관', '니콜스관': '학생지원시설/행정동', '콘서트홀': '기타(강당형 건물)'
  };
  var REASONS = ['접근로 폭 부족', '바닥 경사 기울기 과다', '단차 존재', '장애물 존재', '보행로·차도 분리 미흡'];
  var BASE = [
    ['3.1.1', '교사시설 주요 출입구의 접근로는 장애학생이 안전하고 불편 없이 이동하기에 적정합니까?'],
    ['3.1.2', '장애인 전용 주차구역의 주차 면수, 설치 위치, 보행안전통로는 장애학생이 이용하기에 적정합니까?'],
    ['3.1.4', '교사시설 주출입구(단차 제거, 경사로)는 휠체어 사용학생이 출입하기에 적정합니까?'],
    ['3.2.3', '교사시설 내부 복도는 장애학생이 통행하기에 적정합니까?'],
    ['3.3.1', '교사시설 장애인용 화장실은 장애학생이 이용하기에 적정합니까?']
  ];
  var store = {};
  function itemsFor(b) {
    if (!store[b]) store[b] = BASE.map(function (x, i) {
      var seeded = b === '소피이바라관' || (b === '김수환관_강의용' && i < 2);
      return { 번호: x[0], 내용: x[1], 사유목록: REASONS, 적정수준: seeded ? '적정' : '', 개선사유: '', 사진URL: '', 비고: '' };
    });
    return store[b];
  }
  var api = {
    getAssignments: function () { return { assignments: ASSIGNMENTS, roles: ROLES }; },
    getAssessorOverview: function (name) {
      var list = (ASSIGNMENTS[name] || []).map(function (b) {
        var it = itemsFor(b);
        return { building: b, role: ROLES[b], total: it.length, done: it.filter(function (x) { return x.적정수준; }).length };
      });
      return { buildings: list, allDone: list.every(function (r) { return r.done === r.total; }) };
    },
    getBuildingProgress: function (b) {
      var it = JSON.parse(JSON.stringify(itemsFor(b)));
      return { ok: true, items: it, total: it.length, done: it.filter(function (x) { return x.적정수준; }).length };
    },
    saveAnswer: function (b, num, level, reason, photos, note) {
      var it = itemsFor(b).find(function (x) { return x.번호 === num; });
      var cell = (photos || []).map(function (p) { return p.memo ? p.src + ' | ' + p.memo : p.src; }).join('\\n');
      Object.assign(it, { 적정수준: level, 개선사유: reason, 사진URL: cell, 비고: note });
      return { ok: true, photoCell: cell };
    },
    getSummaryOptions: function () {
      return ['주요 건물 출입구 및 접근로 개선', '주요 교육시설(강의실·도서관·강당) 승강기 설치·개선', '장애인 화장실 및 위생설비 보완',
        '시각·청각장애인 안내시설·경보·피난설비 개선', '강의실 학습환경(좌석·통로·보조공학) 개선', '도서관 출입·열람 접근성 개선',
        '강당(다목적집회실) 좌석·무대 접근성 개선', '생활편의시설(식당·기숙사·휴게시설) 개선',
        '장애학생지원센터 전용실 및 전용 휴게시설 확보', '무인 키오스크·증명발급기 등 디지털 행정설비 신규 설치·교체'];
    },
    saveSummary: function () { return { ok: true }; }
  };
  function runner() {
    var ok = function () {}, fail = function () {};
    var r = {
      withSuccessHandler: function (f) { ok = f; return r; },
      withFailureHandler: function (f) { fail = f; return r; }
    };
    Object.keys(api).forEach(function (k) {
      r[k] = function () {
        var args = arguments;
        setTimeout(function () { try { ok(api[k].apply(null, args)); } catch (e) { fail(e); } }, 350);
      };
    });
    return r;
  }
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get: runner });
})();
</script>`

export async function GET() {
  const html = await readFile(path.join(process.cwd(), 'apps-script', 'Index.html'), 'utf8')
  return new Response(html.replace('</head>', `${MOCK_SCRIPT}\n</head>`), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
