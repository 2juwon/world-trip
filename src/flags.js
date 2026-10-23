/* 국기 (30×20 SVG를 직접 그림 — 간단히 줄인 모양) */
(function (root) {
  'use strict';
  function star(cx, cy, r, fill, rot) {
    var p = [], a0 = (rot || -90) * Math.PI / 180;
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.4 : r, a = a0 + i * Math.PI / 5;
      p.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2));
    }
    return '<polygon points="' + p.join(' ') + '" fill="' + fill + '"/>';
  }
  function rect(x, y, w, h, f) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"/>'; }
  function hbands(cols) { var h = 20 / cols.length; return cols.map(function (c, i) { return rect(0, i * h, 30, h + 0.05, c); }).join(''); }
  function vbands(cols, ws) { var x = 0, tot = ws ? ws.reduce(function (a, b) { return a + b; }, 0) : cols.length; return cols.map(function (c, i) { var w = 30 * (ws ? ws[i] : 1) / tot, r = rect(x, 0, w + 0.05, 20, c); x += w; return r; }).join(''); }
  var UK = rect(0, 0, 30, 20, '#012169') +
    '<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.4"/>' +
    '<path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#C8102E" stroke-width="3.4"/>';
  var nordic = function (bg, cr, inner) { return rect(0, 0, 30, 20, bg) + rect(8, 0, 4, 20, cr) + rect(0, 8, 30, 4, cr) + (inner ? rect(9, 0, 2, 20, inner) + rect(0, 9, 30, 2, inner) : ''); };
  var F = {
    kr: rect(0, 0, 30, 20, '#fff') +
      '<g transform="rotate(33.7 15 10)"><path d="M10 10a5 5 0 0 1 10 0z" fill="#CD2E3A"/><path d="M10 10a5 5 0 0 0 10 0z" fill="#0047A0"/><circle cx="12.5" cy="10" r="2.5" fill="#CD2E3A"/><circle cx="17.5" cy="10" r="2.5" fill="#0047A0"/></g>' +
      [[5, 4.2, -33], [25, 15.8, -33], [25, 4.2, 33], [5, 15.8, 33]].map(function (t) {
        return '<g transform="translate(' + t[0] + ' ' + t[1] + ') rotate(' + t[2] + ')">' + rect(-2.4, -1.9, 4.8, 0.85, '#000') + rect(-2.4, -0.42, 4.8, 0.85, '#000') + rect(-2.4, 1.05, 4.8, 0.85, '#000') + '</g>';
      }).join(''),
    jp: rect(0, 0, 30, 20, '#fff') + '<circle cx="15" cy="10" r="6" fill="#BC002D"/>',
    cn: rect(0, 0, 30, 20, '#EE1C25') + star(5, 5, 3, '#FFFF00') + star(10, 2, 1, '#FFFF00', -60) + star(12, 4, 1, '#FFFF00', -80) + star(12, 7, 1, '#FFFF00', -100) + star(10, 9, 1, '#FFFF00', -120),
    tw: rect(0, 0, 30, 20, '#FE0000') + rect(0, 0, 15, 10, '#000095') + star(7.5, 5, 3.2, '#fff') + '<circle cx="7.5" cy="5" r="1.8" fill="#000095"/><circle cx="7.5" cy="5" r="1.45" fill="#fff"/>',
    ph: rect(0, 0, 30, 10, '#0038A8') + rect(0, 10, 30, 10, '#CE1126') + '<path d="M0 0L17.3 10L0 20z" fill="#fff"/><circle cx="5.6" cy="10" r="1.9" fill="#FCD116"/>' + star(1.8, 2.6, 0.9, '#FCD116') + star(1.8, 17.4, 0.9, '#FCD116') + star(13.6, 10, 0.9, '#FCD116'),
    sg: rect(0, 0, 30, 10, '#EF3340') + rect(0, 10, 30, 10, '#fff') + '<circle cx="6.2" cy="5" r="3.4" fill="#fff"/><circle cx="7.6" cy="5" r="3.2" fill="#EF3340"/>' +
      [[10, 3], [12.4, 4.6], [11.5, 7.2], [8.6, 7.2], [7.7, 4.6]].map(function (s) { return star(s[0], s[1], 0.75, '#fff'); }).join(''),
    eg: hbands(['#CE1126', '#fff', '#000']) + '<path d="M15 7.6l1.6 1.3-.4 2.4h-2.4l-.4-2.4z" fill="#C09300"/><path d="M12.6 8.8l2.4 1.2 2.4-1.2-.6 2.6h-3.6z" fill="#C09300" opacity=".85"/>',
    tr: rect(0, 0, 30, 20, '#E30A17') + '<circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#E30A17"/>' + star(17.4, 10, 2.4, '#fff', 180),
    gr: (function () { var s = ''; for (var i = 0; i < 9; i++) s += rect(0, i * 20 / 9, 30, 20 / 9 + 0.05, i % 2 ? '#fff' : '#0D5EAF'); return s; })() + rect(0, 0, 11.1, 11.1, '#0D5EAF') + rect(4.44, 0, 2.22, 11.1, '#fff') + rect(0, 4.44, 11.1, 2.22, '#fff'),
    dk: nordic('#C8102E', '#fff'),
    se: nordic('#006AA7', '#FECC02'),
    ch: rect(0, 0, 30, 20, '#DA291C') + rect(13.2, 4.5, 3.6, 11, '#fff') + rect(9.5, 8.2, 11, 3.6, '#fff'),
    de: hbands(['#000', '#DD0000', '#FFCE00']),
    ca: vbands(['#D80621', '#fff', '#D80621'], [1, 2, 1]) + '<path d="M15 4l1 2 1.4-.6-.5 3 1.8-1.6.4 1 1.6-.3-.6 1.7.8.6-3 2.3.4 1.2-2.7-.4V16h-.6v-2.4l-2.7.4.4-1.2-3-2.3.8-.6-.6-1.7 1.6.3.4-1 1.8 1.6-.5-3 1.4.6z" fill="#D80621"/>',
    ar: hbands(['#74ACDF', '#fff', '#74ACDF']) + '<circle cx="15" cy="10" r="1.9" fill="#F6B40E"/>',
    br: rect(0, 0, 30, 20, '#009C3B') + '<path d="M3 10L15 2.2L27 10L15 17.8z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/><path d="M10.8 9.2c2.8-.6 6-.3 8.3 1.2" stroke="#fff" stroke-width=".8" fill="none"/>',
    au: rect(0, 0, 30, 20, '#012169') + '<g transform="scale(.5)">' + UK + '</g>' + star(7.5, 15.2, 2.2, '#fff') + star(22.5, 15.5, 1.1, '#fff') + star(19.5, 8.5, 1.1, '#fff') + star(22.5, 3.5, 1.1, '#fff') + star(25.8, 7.5, 1.1, '#fff') + star(24.3, 10.6, 0.6, '#fff'),
    us: (function () { var s = rect(0, 0, 30, 20, '#fff'); for (var i = 0; i < 13; i += 2) s += rect(0, i * 20 / 13, 30, 20 / 13, '#B22234'); s += rect(0, 0, 12, 20 * 7 / 13, '#3C3B6E'); for (var r = 0; r < 5; r++) for (var c = 0; c < 6; c++) s += '<circle cx="' + (1.1 + c * 1.9 + (r % 2) * 0.95).toFixed(2) + '" cy="' + (1.2 + r * 2.4) + '" r=".45" fill="#fff"/>'; return s; })(),
    pt: vbands(['#046A38', '#DA291C'], [2, 3]) + '<circle cx="12" cy="10" r="3.6" fill="#FFE900"/><rect x="10.6" y="8.2" width="2.8" height="3.6" rx=".8" fill="#DA291C" stroke="#fff" stroke-width=".5"/>',
    es: hbands(['#AA151B', '#F1BF00', '#F1BF00', '#AA151B']) + '<rect x="7" y="7.2" width="3" height="5" rx=".6" fill="#AA151B" opacity=".75"/>',
    fr: vbands(['#002395', '#fff', '#ED2939']),
    it: vbands(['#009246', '#fff', '#CE2B37']),
    gb: UK
  };
  var PLACE = {
    TPE: ['tw', '타이완'], PEK: ['cn', '중국'], MNL: ['ph', '필리핀'], CJU: ['kr', '대한민국'], PUS: ['kr', '대한민국'], SEL: ['kr', '대한민국'],
    SIN: ['sg', '싱가포르'], CAI: ['eg', '이집트'], IST: ['tr', '튀르키예'], ATH: ['gr', '그리스'], CPH: ['dk', '덴마크'], STO: ['se', '스웨덴'],
    BRN: ['ch', '스위스'], BER: ['de', '독일'], YOW: ['ca', '캐나다'], EZE: ['ar', '아르헨티나'], GRU: ['br', '브라질'], SYD: ['au', '오스트레일리아'],
    HNL: ['us', '미국'], LIS: ['pt', '포르투갈'], MAD: ['es', '스페인'], TYO: ['jp', '일본'], PAR: ['fr', '프랑스'], ROM: ['it', '이탈리아'],
    LON: ['gb', '영국'], NYC: ['us', '미국']
  };
  function flag(code, cls) {
    if (!F[code]) return '';
    return '<svg class="' + (cls || 'flag') + '" viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">' + F[code] + '</svg>';
  }
  root.FLAGS = { flag: flag, PLACE: PLACE, codes: Object.keys(F) };
})(this);
