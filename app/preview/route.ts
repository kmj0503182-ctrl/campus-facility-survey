import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Mock of google.script.run so Index.html can be previewed outside Apps Script.
const MOCK_SCRIPT = `<script>
(function () {
  var ROLES = {
    '김수환관_강의용': '강의동', '안드레아관_기숙사': '기숙사', '소피이바라관': '식당',
    '중앙도서관': '도서관', '니콜스관': '학생지원시설/행정동', '콘서트홀': '기타(강당형 건물)'
  };
  var NAMES = ['김수환관_강의용', '안드레아관_기숙사', '소피이바라관', '중앙도서관', '니콜스관', '콘서트홀',
    '성심관', '다솔관', '비르투스관', '마리아관', '성당', '미카엘관', '김수환관_기숙사', '밤비노관', '약학관', '창업보육센터'].sort();
  var BASE = [
    ['3.1.1', '교사시설 주요 출입구의 접근로는 장애학생이 안전하고 불편 없이 이동하기에 적정합니까?', ['접근로 폭 부족','바닥 경사 기울기 과다','단차 존재','장애물 존재','보행로·차도 분리 미흡']],
    ['3.1.2', '장애인 전용 주차구역의 주차 면수, 설치 위치, 보행안전통로는 장애학생이 이용하기에 적정합니까?', ['주차 면수 부족','설치 위치 부적절','보행안전통로 미흡']],
    ['3.5.1', '단차 없는 일반 강의실은 휠체어 사용 학생과 시각장애 학생이 이용하기에 적정합니까?', ['통로 확보 미흡','회전 공간 미확보','접근 가능한 좌석 미설치']],
    ['3.8.1', '식당은 장애학생이 출입하여 식사 메뉴를 확인하고 주문하기에 적정합니까?', ['출입구 단차 제거 필요','장애인용 키오스크 설치 필요']],
    ['3.9.1', '기숙사에 장애인용 객실이 설치되어 있으며, 객실 내 위생시설은 장애학생이 이용하기에 적정합니까?', ['객실 수 미흡','위생시설 미비']],
    ['3.10.2', '캠퍼스 내 무장애 경로(연속동선, 안내 포함)는 장애학생이 이용하기에 적정합니까?', ['경로 단차 해소 필요','통행 폭·회전 공간 확보 필요']]
  ];
  function revOf(it) {
    var s = [it.적정수준, it.개선사유, it.사진URL, it.비고, it.조사자, it.조사일시].join('|');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  var store = {};
  function itemsFor(b) {
    if (!store[b]) {
      store[b] = BASE.map(function (x, i) {
        var open = b === '김수환관_강의용' && i === BASE.length - 1;
        var it = {
          번호: x[0], 내용: x[1], 사유목록: x[2],
          적정수준: open ? '' : '적정', 개선사유: '', 사진URL: '', 비고: '',
          조사자: open ? '' : '이연수', 조사일시: open ? '' : '2026-10-27 09:00'
        };
        it.rev = revOf(it);
        return it;
      });
    }
    return store[b];
  }
  function snapshot(it) {
    return {
      적정수준: it.적정수준, 개선사유: it.개선사유, 사진URL: it.사진URL, 비고: it.비고,
      조사자: it.조사자, 조사일시: it.조사일시, rev: it.rev
    };
  }
  var api = {
    getBuildingOverview: function () {
      return {
        ok: true,
        buildings: NAMES.map(function (b, i) {
          var it = itemsFor(b);
          var done = it.filter(function (x) { return x.적정수준; }).length;
          var last = '';
          it.forEach(function (x) { if (x.조사자) last = x.조사자; });
          return { building: b, label: (i + 1) + '. ' + b, role: ROLES[b] || '', done: done, total: it.length, lastSurveyor: last };
        })
      };
    },
    getBuildingProgress: function (b) {
      if (NAMES.indexOf(b) === -1) return { ok: false, message: '등록되지 않은 건물입니다: ' + b };
      var it = JSON.parse(JSON.stringify(itemsFor(b)));
      return { ok: true, buildingName: b, role: ROLES[b] || '', items: it, total: it.length, done: it.filter(function (x) { return x.적정수준; }).length };
    },
    uploadPhoto: function (b, num, dataUrl) {
      if (NAMES.indexOf(b) === -1) return { ok: false, message: '등록되지 않은 건물입니다: ' + b };
      if (!/^data:image\\/(jpeg|png|webp);base64,/.test(dataUrl || '')) return { ok: false, message: '사진 형식이 올바르지 않습니다.' };
      return { ok: true, url: dataUrl };
    },
    saveAnswer: function (b, num, level, reason, photos, note, surveyor, baseRev) {
      var it = itemsFor(b).find(function (x) { return x.번호 === num; });
      if (!it) return { ok: false, message: '해당 건물 탭에서 문항을 찾을 수 없습니다: ' + num };
      var cell = (photos || []).filter(function (p) { return p && p.src; }).map(function (p) {
        return p.memo ? p.src + ' | ' + p.memo : p.src;
      }).join('\\n');
      var who = String(surveyor || '').trim();
      var same = it.적정수준 === String(level) && it.개선사유 === (reason || '') && it.비고 === (note || '') && it.사진URL === cell && (who || it.조사자) === it.조사자;
      if (baseRev && baseRev !== it.rev) {
        if (same) return { ok: true, already: true, photoCell: it.사진URL, rev: it.rev, 조사자: it.조사자, 조사일시: it.조사일시 };
        return {
          ok: false, conflict: true, photoCell: cell, current: snapshot(it),
          message: '이 문항은 불러온 뒤에 시트의 내용이 바뀌어 저장하지 않았습니다. 건물 목록에서 다시 들어와 확인해 주세요.'
        };
      }
      it.적정수준 = String(level);
      it.개선사유 = reason || '';
      it.사진URL = cell;
      it.비고 = note || '';
      it.조사자 = who || it.조사자 || '';
      it.조사일시 = '2026-10-27 21:40';
      it.rev = revOf(it);
      return { ok: true, photoCell: cell, rev: it.rev, 조사자: it.조사자, 조사일시: it.조사일시 };
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
