/* 한판 세계여행 규칙 엔진 — 상태는 JSON, apply로만 바뀜
 * 돈 단위는 천 원 (200 = 20만 원)
 */
(function (root) {
  'use strict';

  // ── 판 40칸 ─────────────────────────────────────────
  // k: start 출발 · city 도시(건물 가능) · spot 관광지(건물 없음) · ride 탈것 · key 황금열쇠
  //    island 무인도 · fund 사회복지기금 받는 곳 · space 우주여행 · donate 사회복지기금 내는 곳
  // p: 땅값, b: [별장, 빌딩, 호텔] 건설비, t: [대지, 별장1, 별장2, 빌딩, 호텔] 통행료
  function C(n, en, p, b, t) { return { k: 'city', n: n, en: en, p: p, b: b, t: t }; }
  var B1 = [50, 150, 250], B2 = [100, 300, 500], B3 = [150, 450, 750], B4 = [200, 600, 1000];
  var T = [
    { k: 'start', n: '출발' },
    C('타이베이', 'TPE', 50, B1, [2, 10, 30, 90, 250]),
    { k: 'key', n: '황금열쇠' },
    C('베이징', 'PEK', 80, B1, [4, 20, 60, 180, 450]),
    C('마닐라', 'MNL', 80, B1, [4, 20, 60, 180, 450]),
    { k: 'spot', n: '제주도', en: 'CJU', p: 200, t: [300] },
    C('싱가포르', 'SIN', 100, B1, [6, 30, 90, 270, 550]),
    { k: 'key', n: '황금열쇠' },
    C('카이로', 'CAI', 100, B1, [6, 30, 90, 270, 550]),
    C('이스탄불', 'IST', 120, B1, [8, 40, 100, 300, 600]),
    { k: 'island', n: '무인도' },
    C('아테네', 'ATH', 140, B2, [10, 50, 150, 450, 750]),
    { k: 'key', n: '황금열쇠' },
    C('코펜하겐', 'CPH', 160, B2, [12, 60, 180, 500, 900]),
    C('스톡홀름', 'STO', 160, B2, [12, 60, 180, 500, 900]),
    { k: 'ride', n: '초음속 여객기', en: 'JET', p: 200, t: [300] },
    C('베른', 'BRN', 180, B2, [14, 70, 200, 550, 950]),
    { k: 'key', n: '황금열쇠' },
    C('베를린', 'BER', 180, B2, [14, 70, 200, 550, 950]),
    C('오타와', 'YOW', 200, B2, [16, 80, 220, 600, 1000]),
    { k: 'fund', n: '사회복지기금' },
    C('부에노스아이레스', 'EZE', 220, B3, [18, 90, 250, 700, 1050]),
    { k: 'key', n: '황금열쇠' },
    C('상파울루', 'GRU', 240, B3, [20, 100, 300, 750, 1100]),
    C('시드니', 'SYD', 240, B3, [20, 100, 300, 750, 1100]),
    { k: 'spot', n: '부산', en: 'PUS', p: 500, t: [600] },
    C('하와이', 'HNL', 260, B3, [22, 110, 330, 800, 1150]),
    C('리스본', 'LIS', 260, B3, [22, 110, 330, 800, 1150]),
    { k: 'ride', n: '호화 여객선', en: 'SHIP', p: 300, t: [250] },
    C('마드리드', 'MAD', 280, B3, [24, 120, 360, 860, 1200]),
    { k: 'space', n: '우주여행' },
    C('도쿄', 'TYO', 300, B4, [26, 130, 390, 900, 1250]),
    { k: 'ride', n: '우주왕복선', en: 'SHTL', p: 450, t: [400] },
    C('파리', 'PAR', 320, B4, [28, 150, 450, 1000, 1400]),
    C('로마', 'ROM', 320, B4, [28, 150, 450, 1000, 1400]),
    { k: 'key', n: '황금열쇠' },
    C('런던', 'LON', 350, B4, [35, 170, 500, 1100, 1500]),
    C('뉴욕', 'NYC', 350, B4, [35, 170, 500, 1100, 1500]),
    { k: 'donate', n: '사회복지기금' },
    { k: 'spot', n: '서울', en: 'SEL', p: 1000, t: [2000] }
  ];
  var N = 40, START = 0, ISLAND = 10, FUND = 20, SPACE = 30, DONATE = 38, SHUTTLE = 32;
  var SPACE_FEE = 200, SALARY = 200, ESC_SELL = 200;
  var LV_NAME = ['땅', '별장 1채', '별장 2채', '빌딩', '호텔'];
  // 줄(변): 0 아시아·아프리카, 1 유럽, 2 아메리카·오세아니아, 3 세계 대도시
  function sideOf(i) { return Math.floor(i / 10); }
  function isDeed(i) { var k = T[i].k; return k === 'city' || k === 'spot' || k === 'ride'; }
  // 건물 가치(그 단계까지 들인 돈): [0, 별장, 별장×2, 빌딩, 호텔]
  function buildValue(i, lv) { var b = T[i].b; if (!b || !lv) return 0; return [0, b[0], b[0] * 2, b[1], b[2]][lv]; }
  function stepCost(i, lv) { return buildValue(i, lv + 1) - buildValue(i, lv); } // lv → lv+1
  function tollOf(g, i) { var t = T[i]; if (!t.t) return 0; return t.k === 'city' ? t.t[g.lv[i]] : t.t[0]; }

  // ── 황금열쇠 ─────────────────────────────────────────
  // f: island 무인도 · space 우주여행 칸으로(이용료 없음) · world 세계일주 · go 그 칸으로 · back 뒤로
  //    money 받기/내기 · birthday 모두에게서 받기 · treat 모두에게 주기 · tax 건물마다 · keep 보관 · half 반액 대매출
  var KEYS = [
    { n: '폭풍 경보', d: '폭풍을 만나 무인도로 떠밀려 가요. 출발지를 지나도 월급은 없어요.', f: 'island' },
    { n: '우주여행 초대장', d: '우주여행 칸으로 가요. 이용료는 내지 않아요.', f: 'space' },
    { n: '우주여행 초대장', d: '우주여행 칸으로 가요. 이용료는 내지 않아요.', f: 'space' },
    { n: '세계일주 초대권', d: '한 바퀴 돌아 제자리로! 월급과 모인 사회복지기금을 받아요.', f: 'world' },
    { n: '사회복지기금 배당', d: '사회복지기금 받는 곳으로 가요.', f: 'go', v: FUND },
    { n: '고속도로', d: '출발지로 곧장 달려가 월급을 받아요.', f: 'go', v: START },
    { n: '제주 여행', d: '제주도로 가요. 주인이 있으면 통행료를 내요.', f: 'go', v: 5 },
    { n: '부산 여행', d: '부산으로 가요. 주인이 있으면 통행료를 내요.', f: 'go', v: 25 },
    { n: '서울 여행', d: '서울로 가요. 주인이 있으면 통행료를 내요.', f: 'go', v: 39 },
    { n: '길을 잃었어요', d: '뒤로 세 칸 가요.', f: 'back', v: 3 },
    { n: '여권을 두고 왔어요', d: '뒤로 두 칸 가요.', f: 'back', v: 2 },
    { n: '노벨평화상', d: '평화상 상금 30만 원을 받아요.', f: 'money', v: 300 },
    { n: '복권 당첨', d: '여행지에서 산 복권이 당첨! 20만 원을 받아요.', f: 'money', v: 200 },
    { n: '장학금', d: '장학금 10만 원을 받아요.', f: 'money', v: 100 },
    { n: '마라톤 완주', d: '마라톤 완주 상금 10만 원을 받아요.', f: 'money', v: 100 },
    { n: '연금', d: '연금 5만 원을 받아요.', f: 'money', v: 50 },
    { n: '해외 유학', d: '유학비 10만 원을 내요.', f: 'money', v: -100 },
    { n: '병원비', d: '여행 중 감기에 걸렸어요. 병원비 5만 원을 내요.', f: 'money', v: -50 },
    { n: '과속 벌금', d: '렌터카 과속 벌금 5만 원을 내요.', f: 'money', v: -50 },
    { n: '기념품 쇼핑', d: '기념품을 너무 많이 샀어요. 3만 원을 내요.', f: 'money', v: -30 },
    { n: '생일 축하', d: '오늘은 내 생일! 모두에게서 3만 원씩 받아요.', f: 'birthday', v: 30 },
    { n: '한턱 쏘기', d: '여행 기념으로 한턱! 모두에게 2만 원씩 줘요.', f: 'treat', v: 20 },
    { n: '종합소득세', d: '별장 1채 3만, 빌딩 10만, 호텔 15만 원씩 세금을 내요.', f: 'tax', v: [30, 100, 150] },
    { n: '건물 수리비', d: '별장 1채 3만, 빌딩 6만, 호텔 10만 원씩 수리비를 내요.', f: 'tax', v: [30, 60, 100] },
    { n: '방범비', d: '건물이 있는 도시마다 5만 원씩 내요.', f: 'tax', v: [50, 50, 50], per: 'city' },
    { n: '무인도 탈출 무전기', d: '갖고 있다가 무인도에서 쓰면 바로 나와요. 필요 없으면 은행에 20만 원에 팔 수 있어요.', f: 'keep', v: 'esc' },
    { n: '통행료 우대권', d: '갖고 있다가 남의 땅에서 쓰면 통행료를 한 번 안 내요.', f: 'keep', v: 'vip' },
    { n: '통행료 우대권', d: '갖고 있다가 남의 땅에서 쓰면 통행료를 한 번 안 내요.', f: 'keep', v: 'vip' },
    { n: '반액 대매출', d: '가진 것 중 가장 비싼 땅을 건물과 함께 반값에 은행에 팔아요.', f: 'half' }
  ];

  var DEFAULT_CFG = {
    start: 2930,       // 시작 자금 293만 원
    triple: true,      // 더블 세 번이면 무인도
    buildOnBuy: false, // 산 차례에 바로 건물 (원작은 다음 방문부터)
    takeover: true,    // 통행료를 낸 뒤 그 땅을 웃돈(2배, 호텔이 있으면 3배) 주고 인수
    rounds: 0,         // 0 = 끝까지(파산), n = n바퀴 뒤 총자산
    timeMin: 0         // 0 = 시간 제한 없음, n분이 지나면 그 바퀴까지
  };

  // ── 난수 (상태 안에 씨앗을 두어 다시 섞기도 결정적으로) ──
  function rngOf(g) {
    return function () {
      g.rs = (g.rs + 0x6D2B79F5) >>> 0;
      var t = g.rs;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var x = arr[i]; arr[i] = arr[j]; arr[j] = x; }
    return arr;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function newGame(players, cfg, first, seed, now) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    var g = {
      v: 1, seq: 0, cfg: cfg,
      players: players.map(function (p, i) {
        return { name: p.name, color: p.color == null ? i : p.color, ai: p.ai || null,
          money: cfg.start, pos: 0, isl: 0, spc: 0, esc: 0, vip: 0, dbl: 0, out: false, laps: 0 };
      }),
      own: T.map(function () { return -1; }), lv: T.map(function () { return 0; }),
      fund: 0, deck: [], disc: [], rs: (seed >>> 0) || 1,
      turn: first || 0, first: first || 0, round: 1, phase: 'roll', pend: null, again: false,
      last: [], out: [], winner: -1, ranks: null, lastRound: false, t0: now || 0, endWhy: ''
    };
    g.deck = shuffle(KEYS.map(function (_, i) { return i; }), rngOf(g));
    return g;
  }

  // ── 돈 ──────────────────────────────────────────────
  function sellValueAll(g, pi) { // 가진 것을 모두 은행에 팔 때 받는 돈
    var s = 0;
    for (var i = 0; i < N; i++) if (g.own[i] === pi) s += Math.floor((T[i].p + buildValue(i, g.lv[i])) / 2);
    return s;
  }
  function assets(g, pi) { // 총자산: 현금 + 땅값 + 건물값
    var p = g.players[pi], s = p.money;
    for (var i = 0; i < N; i++) if (g.own[i] === pi) s += T[i].p + buildValue(i, g.lv[i]);
    return s;
  }
  function owned(g, pi) { var a = []; for (var i = 0; i < N; i++) if (g.own[i] === pi) a.push(i); return a; }
  function alive(g) { var a = []; g.players.forEach(function (p, i) { if (!p.out) a.push(i); }); return a; }

  // 한 단계 팔기: 건물이 있으면 맨 위 건물부터, 없으면 땅. 받는 돈은 들인 돈의 절반
  function sellStep(g, pi, i) {
    if (g.own[i] !== pi) return 0;
    var a;
    if (g.lv[i] > 0) { a = Math.floor(stepCost(i, g.lv[i] - 1) / 2); g.lv[i]--; }
    else { a = Math.floor(T[i].p / 2); g.own[i] = -1; }
    g.players[pi].money += a;
    return a;
  }
  // 자동으로 팔 순서: 통행료가 적게 줄어드는 것부터 (건물 → 땅, 싼 곳부터)
  function autoSellOrder(g, pi) {
    return owned(g, pi).sort(function (a, b) {
      var la = g.lv[a] > 0 ? 0 : 1, lb = g.lv[b] > 0 ? 0 : 1;
      if (la !== lb) return la - lb;
      return tollOf(g, a) - tollOf(g, b) || T[a].p - T[b].p;
    });
  }
  function autoRaise(g, pi, need) { // need만큼 현금이 될 때까지 팔기
    var p = g.players[pi], guard = 200;
    while (p.money < need && guard-- > 0) {
      var ord = autoSellOrder(g, pi);
      if (!ord.length) break;
      var i = ord[0], a = sellStep(g, pi, i);
      ev(g, { k: 'sell', p: pi, t: i, a: a, lv: g.own[i] === pi ? g.lv[i] : -1, auto: true });
    }
    return p.money >= need;
  }

  function ev(g, e) { g.last.push(e); }

  function give(g, to, a) { if (to >= 0) g.players[to].money += a; else if (to === -2) g.fund += a; }

  // 돈 내기. 현금이 모자라면: 차례인 사람은 '갚기' 단계로(팔 것을 고름), 아니면 자동으로 팔고 그래도 모자라면 파산
  // to: 사람 번호 · -1 은행 · -2 사회복지기금
  function charge(g, pi, to, a, why) {
    var p = g.players[pi];
    if (a <= 0 || p.out) return true;
    if (p.money >= a) { p.money -= a; give(g, to, a); return true; }
    if (p.money + sellValueAll(g, pi) < a) { bankrupt(g, pi, to, why); return false; }
    if (pi === g.turn && !g.pend) { g.phase = 'pay'; g.pend = { a: a, to: to, why: why }; return false; }
    autoRaise(g, pi, a);
    p.money -= a; give(g, to, a);
    return true;
  }

  function bankrupt(g, pi, to, why) {
    var p = g.players[pi];
    owned(g, pi).forEach(function (i) { p.money += Math.floor((T[i].p + buildValue(i, g.lv[i])) / 2); g.own[i] = -1; g.lv[i] = 0; });
    var paid = p.money;
    give(g, to, paid);
    p.money = 0; p.out = true;
    for (var c = 0; c < p.esc; c++) g.disc.push(keyIndex('esc'));
    for (c = 0; c < p.vip; c++) g.disc.push(keyIndex('vip'));
    p.esc = 0; p.vip = 0; p.isl = 0; p.spc = 0;
    g.out.push(pi);
    ev(g, { k: 'bankrupt', p: pi, to: to, a: paid, why: why });
    if (alive(g).length <= 1) finish(g, 'last');
  }
  function keyIndex(kind) { for (var i = 0; i < KEYS.length; i++) if (KEYS[i].f === 'keep' && KEYS[i].v === kind) return i; return -1; }

  function finish(g, why) {
    if (g.phase === 'over') return;
    g.phase = 'over'; g.pend = null; g.again = false; g.endWhy = why;
    // 살아남은 사람은 총자산 순, 파산한 사람은 늦게 파산한 순
    var liv = alive(g).sort(function (a, b) { return assets(g, b) - assets(g, a) || a - b; });
    var outs = g.out.slice().reverse();
    g.ranks = liv.concat(outs);
    g.winner = g.ranks[0];
    ev(g, { k: 'over', w: g.winner, why: why });
  }

  // ── 움직이기 ─────────────────────────────────────────
  function walk(g, pi, steps, salary) { // 앞으로 steps칸, 출발을 지나면 월급
    var p = g.players[pi], from = p.pos, passed = false;
    for (var s = 0; s < steps; s++) { p.pos = (p.pos + 1) % N; if (p.pos === START) passed = true; }
    ev(g, { k: 'move', p: pi, from: from, to: p.pos, n: steps });
    if (passed && salary !== false) { p.money += SALARY; p.laps++; ev(g, { k: 'salary', p: pi, a: SALARY }); }
  }
  function jump(g, pi, to, salary) { // 그 칸까지 앞으로 (한 바퀴 돌아갈 수도)
    var p = g.players[pi], n = (to - p.pos + N) % N;
    if (n === 0) n = N;
    walk(g, pi, n, salary);
  }

  function land(g) {
    var pi = g.turn, p = g.players[pi], i = p.pos, t = T[i];
    switch (t.k) {
      case 'city': case 'spot': case 'ride': {
        var o = g.own[i];
        if (o < 0) {
          if (p.money >= t.p) { g.phase = 'buy'; g.pend = { t: i }; return; }
          ev(g, { k: 'cant', p: pi, t: i });
          return done(g);
        }
        if (o === pi) {
          if (t.k === 'city' && g.lv[i] < 4 && p.money >= stepCost(i, g.lv[i])) { g.phase = 'build'; g.pend = { t: i }; return; }
          return done(g);
        }
        var a = tollOf(g, i);
        if (p.vip > 0) { g.phase = 'toll'; g.pend = { t: i, a: a, to: o }; return; }
        ev(g, { k: 'toll', p: pi, to: o, t: i, a: Math.min(a, p.money + sellValueAll(g, pi)) });
        if (charge(g, pi, o, a, 'toll')) return afterToll(g, i);
        return afterCharge(g);
      }
      case 'key': return drawKey(g);
      case 'island':
        p.isl = 3; g.again = false; p.dbl = 0;
        ev(g, { k: 'island', p: pi });
        return done(g);
      case 'fund': {
        var f = g.fund; g.fund = 0; p.money += f;
        ev(g, { k: 'fund', p: pi, a: f });
        return done(g);
      }
      case 'donate': {
        ev(g, { k: 'donate', p: pi, a: 150 });
        if (charge(g, pi, -2, 150, 'donate')) return done(g);
        return afterCharge(g);
      }
      case 'space': {
        g.again = false; p.dbl = 0;
        var free = p.spc === 2;
        p.spc = 1;
        var so = g.own[SHUTTLE];
        if (!free && so >= 0 && so !== pi) {
          ev(g, { k: 'spacefee', p: pi, to: so, a: SPACE_FEE });
          if (!charge(g, pi, so, SPACE_FEE, 'space')) return afterCharge(g);
        } else ev(g, { k: 'spaceport', p: pi, free: free });
        return done(g);
      }
      default: return done(g);
    }
  }
  function afterCharge(g) { // charge가 false: 갚기 단계로 갔거나 파산함
    if (g.phase === 'pay' || g.phase === 'over') return;
    return done(g);
  }

  // 땅 인수: 웃돈(땅값+건물값의 2배, 호텔이 있으면 3배)을 주인에게 주고 가져옴
  function takeoverRate(g, i) { return g.lv[i] >= 4 ? 3 : 2; }
  function takeoverPrice(g, i) { return takeoverRate(g, i) * (T[i].p + buildValue(i, g.lv[i])); }
  function canTakeover(g, pi, i) {
    var o = g.own[i];
    return !!g.cfg.takeover && o >= 0 && o !== pi && !g.players[o].out && !g.players[pi].out && g.players[pi].money >= takeoverPrice(g, i);
  }
  function afterToll(g, i) {
    if (g.phase === 'over') return;
    if (canTakeover(g, g.turn, i)) { g.phase = 'takeover'; g.pend = { t: i, a: takeoverPrice(g, i), from: g.own[i] }; return; }
    return done(g);
  }

  function drawKey(g) {
    var pi = g.turn, p = g.players[pi];
    if (!g.deck.length) { g.deck = shuffle(g.disc, rngOf(g)); g.disc = []; }
    var id = g.deck.shift(), k = KEYS[id];
    ev(g, { k: 'key', p: pi, c: id });
    var back = true; // 카드를 버린 더미로
    switch (k.f) {
      case 'island':
        g.disc.push(id);
        p.pos = ISLAND; p.isl = 3; g.again = false; p.dbl = 0;
        ev(g, { k: 'warp', p: pi, to: ISLAND });
        ev(g, { k: 'island', p: pi });
        return done(g);
      case 'space':
        g.disc.push(id);
        jump(g, pi, SPACE);
        p.spc = 2;
        return land(g);
      case 'world': {
        g.disc.push(id);
        walk(g, pi, N);
        var f = g.fund; g.fund = 0; p.money += f;
        ev(g, { k: 'fund', p: pi, a: f });
        return done(g);
      }
      case 'go':
        g.disc.push(id);
        jump(g, pi, k.v);
        return land(g);
      case 'back': {
        g.disc.push(id);
        var from = p.pos;
        p.pos = (p.pos - k.v + N) % N;
        ev(g, { k: 'move', p: pi, from: from, to: p.pos, n: -k.v });
        return land(g);
      }
      case 'money':
        g.disc.push(id);
        if (k.v > 0) { p.money += k.v; return done(g); }
        if (charge(g, pi, -1, -k.v, 'key')) return done(g);
        return afterCharge(g);
      case 'birthday':
        g.disc.push(id);
        alive(g).forEach(function (j) {
          if (j === pi) return;
          if (charge(g, j, pi, k.v, 'birthday')) ev(g, { k: 'gift', p: j, to: pi, a: k.v });
        });
        if (g.phase === 'over') return;
        return done(g);
      case 'treat': {
        g.disc.push(id);
        var others = alive(g).filter(function (j) { return j !== pi; });
        var total = k.v * others.length;
        if (p.money >= total) { others.forEach(function (j) { p.money -= k.v; g.players[j].money += k.v; ev(g, { k: 'gift', p: pi, to: j, a: k.v }); }); return done(g); }
        // 모자라면 은행에 내는 것처럼 모아서 나눠 줌
        if (charge(g, pi, -1, total, 'treat')) { others.forEach(function (j) { g.players[j].money += k.v; }); return done(g); }
        if (g.phase === 'pay') { g.pend.split = others; g.pend.each = k.v; }
        return afterCharge(g);
      }
      case 'tax': {
        g.disc.push(id);
        var sum = 0;
        owned(g, pi).forEach(function (i) {
          var lv = g.lv[i];
          if (!lv) return;
          if (k.per === 'city') sum += k.v[0];
          else if (lv <= 2) sum += k.v[0] * lv; else if (lv === 3) sum += k.v[1]; else sum += k.v[2];
        });
        ev(g, { k: 'tax', p: pi, a: sum });
        if (charge(g, pi, -1, sum, 'tax')) return done(g);
        return afterCharge(g);
      }
      case 'keep':
        back = false;
        if (k.v === 'esc') p.esc++; else p.vip++;
        return done(g);
      case 'half': {
        g.disc.push(id);
        var mine = owned(g, pi);
        if (!mine.length) { ev(g, { k: 'nohalf', p: pi }); return done(g); }
        mine.sort(function (a, b) { return (T[b].p + buildValue(b, g.lv[b])) - (T[a].p + buildValue(a, g.lv[a])) || b - a; });
        var i = mine[0], v = Math.floor((T[i].p + buildValue(i, g.lv[i])) / 2);
        g.own[i] = -1; g.lv[i] = 0; p.money += v;
        ev(g, { k: 'halfsale', p: pi, t: i, a: v });
        return done(g);
      }
    }
    if (back) g.disc.push(id);
    return done(g);
  }

  // 이번 칸 처리가 끝남 → 더블이면 한 번 더, 아니면 다음 사람
  function done(g) {
    if (g.phase === 'over') return;
    g.pend = null;
    var p = g.players[g.turn];
    if (!p.out && g.again) { g.phase = 'roll'; return; }
    nextTurn(g);
  }

  function nextTurn(g) {
    var n = g.players.length, cur = g.turn;
    g.players[cur].dbl = 0; g.again = false; g.pend = null;
    var nx = cur;
    for (var k = 1; k <= n; k++) { var j = (cur + k) % n; if (!g.players[j].out) { nx = j; break; } }
    var rel = function (i) { return (i - g.first + n) % n; };
    if (rel(nx) <= rel(cur)) {
      // 한 바퀴(모두 한 번씩) 끝
      if ((g.cfg.rounds && g.round >= g.cfg.rounds) || g.lastRound) { g.turn = nx; return finish(g, g.lastRound ? 'time' : 'rounds'); }
      g.round++;
    }
    g.turn = nx;
    g.phase = g.players[nx].spc ? 'space' : 'roll';
    ev(g, { k: 'turn', p: nx });
  }

  // ── 동작 ─────────────────────────────────────────────
  // roll {d:[a,b]} · escape(무전기) · space {to} · buy · build {lv} · skip(안 사기/안 짓기) · toll {use}
  // sell {t} (한 단계) · sellCard(무전기 팔기) · bankrupt(갚기 포기) · lastRound(시간 끝)
  function legal(g, a) {
    if (!a || g.phase === 'over') return false;
    var p = g.players[g.turn];
    switch (a.type) {
      case 'roll': return g.phase === 'roll' && a.d && a.d.length === 2 && a.d.every(function (x) { return x >= 1 && x <= 6 && (x | 0) === x; });
      case 'escape': return g.phase === 'roll' && p.isl > 0 && p.esc > 0;
      case 'space': return g.phase === 'space' && (a.to | 0) === a.to && a.to >= 0 && a.to < N && a.to !== SPACE;
      case 'buy': return g.phase === 'buy' && p.money >= T[g.pend.t].p;
      case 'build': {
        if (g.phase !== 'build') return false;
        var i = g.pend.t, lv = a.lv | 0;
        return lv > g.lv[i] && lv <= 4 && p.money >= buildValue(i, lv) - buildValue(i, g.lv[i]);
      }
      case 'skip': return g.phase === 'buy' || g.phase === 'build' || g.phase === 'takeover';
      case 'takeover': return g.phase === 'takeover' && p.money >= g.pend.a;
      case 'toll': return g.phase === 'toll';
      case 'sell': return ['roll', 'buy', 'build', 'toll', 'space', 'pay', 'takeover'].indexOf(g.phase) >= 0 && g.own[a.t] === g.turn;
      case 'sellCard': return g.phase !== 'over' && p.esc > 0;
      case 'sellMany': { // 여러 칸을 한꺼번에: steps = [칸, 칸, ...] 한 번에 한 단계씩 (같은 칸을 여러 번 넣으면 더 팜)
        if (['roll', 'buy', 'build', 'toll', 'space', 'pay', 'takeover'].indexOf(g.phase) < 0) return false;
        if (!Array.isArray(a.steps) || !a.steps.length || a.steps.length > 200) return false;
        var cnt = {};
        for (var q = 0; q < a.steps.length; q++) {
          var ti = a.steps[q];
          if ((ti | 0) !== ti || ti < 0 || ti >= N || g.own[ti] !== g.turn) return false;
          cnt[ti] = (cnt[ti] || 0) + 1;
          if (cnt[ti] > g.lv[ti] + 1) return false;
        }
        return true;
      }
      case 'bankrupt': return g.phase === 'pay';
      case 'lastRound': return !g.lastRound;
    }
    return false;
  }

  function apply(g0, a) {
    if (!legal(g0, a)) return g0;
    var g = clone(g0);
    g.seq++; g.last = [];
    var pi = g.turn, p = g.players[pi];
    switch (a.type) {
      case 'roll': {
        var d = a.d, sum = d[0] + d[1], dbl = d[0] === d[1];
        ev(g, { k: 'roll', p: pi, d: d.slice(), isl: p.isl > 0 });
        if (p.isl > 0) {
          if (dbl) { p.isl = 0; g.again = false; ev(g, { k: 'out', p: pi }); walk(g, pi, sum); return land(g), g; }
          p.isl--;
          ev(g, { k: 'stay', p: pi, left: p.isl });
          nextTurn(g);
          return g;
        }
        if (dbl) {
          p.dbl++;
          if (g.cfg.triple && p.dbl >= 3) {
            p.pos = ISLAND; p.isl = 3; p.dbl = 0; g.again = false;
            ev(g, { k: 'triple', p: pi });
            ev(g, { k: 'warp', p: pi, to: ISLAND });
            ev(g, { k: 'island', p: pi });
            nextTurn(g);
            return g;
          }
        }
        g.again = dbl;
        walk(g, pi, sum);
        land(g);
        return g;
      }
      case 'escape':
        p.esc--; p.isl = 0; g.disc.push(keyIndex('esc'));
        ev(g, { k: 'radio', p: pi });
        return g;
      case 'space':
        p.spc = 0; g.again = false;
        ev(g, { k: 'fly', p: pi, from: p.pos, to: a.to });
        jump(g, pi, a.to);
        land(g);
        return g;
      case 'buy': {
        var i = g.pend.t;
        p.money -= T[i].p; g.own[i] = pi;
        ev(g, { k: 'buy', p: pi, t: i, a: T[i].p });
        if (g.cfg.buildOnBuy && T[i].k === 'city' && p.money >= stepCost(i, 0)) { g.phase = 'build'; g.pend = { t: i }; return g; }
        done(g);
        return g;
      }
      case 'build': {
        var t = g.pend.t, cost = buildValue(t, a.lv) - buildValue(t, g.lv[t]);
        p.money -= cost; g.lv[t] = a.lv;
        ev(g, { k: 'build', p: pi, t: t, lv: a.lv, a: cost });
        done(g);
        return g;
      }
      case 'skip':
        ev(g, { k: 'skip', p: pi, t: g.pend.t, ph: g.phase });
        done(g);
        return g;
      case 'toll': {
        var pd = g.pend;
        g.pend = null;
        if (a.use) { p.vip--; g.disc.push(keyIndex('vip')); ev(g, { k: 'vip', p: pi, t: pd.t, a: pd.a }); afterToll(g, pd.t); return g; }
        g.phase = 'roll'; // 잠깐 (charge가 pay로 바꿀 수 있게)
        ev(g, { k: 'toll', p: pi, to: pd.to, t: pd.t, a: Math.min(pd.a, p.money + sellValueAll(g, pi)) });
        if (charge(g, pi, pd.to, pd.a, 'toll')) afterToll(g, pd.t); else afterCharge(g);
        return g;
      }
      case 'takeover': {
        var tk = g.pend, from = g.own[tk.t];
        p.money -= tk.a; g.players[from].money += tk.a; g.own[tk.t] = pi;
        ev(g, { k: 'takeover', p: pi, from: from, t: tk.t, a: tk.a });
        g.pend = null;
        if (T[tk.t].k === 'city' && g.lv[tk.t] < 4 && p.money >= stepCost(tk.t, g.lv[tk.t])) { g.phase = 'build'; g.pend = { t: tk.t }; return g; }
        done(g);
        return g;
      }
      case 'sell': {
        var am = sellStep(g, pi, a.t);
        ev(g, { k: 'sell', p: pi, t: a.t, a: am, lv: g.own[a.t] === pi ? g.lv[a.t] : -1 });
        if (g.phase === 'pay' && p.money >= g.pend.a) payDebt(g);
        else if (g.phase === 'build' && (g.own[g.pend.t] !== pi || p.money < stepCost(g.pend.t, g.lv[g.pend.t]) || g.lv[g.pend.t] >= 4)) done(g);
        return g;
      }
      case 'sellMany': {
        var got = 0;
        a.steps.forEach(function (ti) {
          if (g.own[ti] !== pi) return;
          var am2 = sellStep(g, pi, ti); got += am2;
          ev(g, { k: 'sell', p: pi, t: ti, a: am2, lv: g.own[ti] === pi ? g.lv[ti] : -1, many: true });
        });
        ev(g, { k: 'sold', p: pi, a: got, n: a.steps.length });
        if (g.phase === 'pay' && p.money >= g.pend.a) payDebt(g);
        else if (g.phase === 'build' && (g.own[g.pend.t] !== pi || p.money < stepCost(g.pend.t, g.lv[g.pend.t]) || g.lv[g.pend.t] >= 4)) done(g);
        else if (g.phase === 'takeover' && p.money < g.pend.a) done(g);
        return g;
      }
      case 'sellCard':
        p.esc--; p.money += ESC_SELL; g.disc.push(keyIndex('esc'));
        ev(g, { k: 'sellcard', p: pi, a: ESC_SELL });
        if (g.phase === 'pay' && p.money >= g.pend.a) payDebt(g);
        return g;
      case 'bankrupt': {
        var pp = g.pend;
        g.pend = null;
        bankrupt(g, pi, pp.to, pp.why);
        if (g.phase !== 'over') nextTurn(g);
        return g;
      }
      case 'lastRound':
        g.lastRound = true;
        ev(g, { k: 'lastround' });
        return g;
    }
    return g;
  }
  function payDebt(g) {
    var pd = g.pend, p = g.players[g.turn];
    p.money -= pd.a;
    if (pd.split) pd.split.forEach(function (j) { g.players[j].money += pd.each; });
    else give(g, pd.to, pd.a);
    ev(g, { k: 'paid', p: g.turn, to: pd.to, a: pd.a });
    g.pend = null; g.phase = 'roll';
    done(g);
  }

  // 남에게 보낼 화면: 황금열쇠 더미 순서는 가림
  function viewFor(g) {
    var v = clone(g);
    v.deck = g.deck.length; v.disc = g.disc.length; v.rs = 0;
    return v;
  }

  // 지금 결정할 사람 (언제나 차례인 사람)
  function actor(g) { return g.phase === 'over' ? -1 : g.turn; }

  var WT = {
    T: T, N: N, KEYS: KEYS, START: START, ISLAND: ISLAND, FUND: FUND, SPACE: SPACE, DONATE: DONATE, SHUTTLE: SHUTTLE,
    SALARY: SALARY, SPACE_FEE: SPACE_FEE, ESC_SELL: ESC_SELL, LV_NAME: LV_NAME, DEFAULT_CFG: DEFAULT_CFG,
    sideOf: sideOf, isDeed: isDeed, buildValue: buildValue, stepCost: stepCost, tollOf: tollOf,
    takeoverPrice: takeoverPrice, takeoverRate: takeoverRate, canTakeover: canTakeover,
    newGame: newGame, apply: apply, legal: legal, viewFor: viewFor, actor: actor,
    assets: assets, owned: owned, alive: alive, sellValueAll: sellValueAll, autoSellOrder: autoSellOrder, clone: clone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = WT; else root.WT = WT;
})(this);
