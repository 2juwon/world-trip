/* 한판 세계여행 컴퓨터 — 공개된 판 정보만 사용 (황금열쇠 순서는 모름) */
(function (root) {
  'use strict';
  var WT = root.WT || (typeof require !== 'undefined' ? require('./engine.js') : null);
  var T = WT.T, N = WT.N;

  // 두 주사위 합의 확률
  var P2 = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map(function (x) { return x / 36; });

  var LEVEL = {
    easy:   { reserve: 0.15, buyChance: 0.65, build: 0.5, noise: 3 },
    normal: { reserve: 0.6, buyChance: 1, build: 1, noise: 0.15 }
  };

  function oppTolls(g, me) { // 남의 땅 통행료 목록
    var a = [];
    for (var i = 0; i < N; i++) if (g.own[i] >= 0 && g.own[i] !== me) a.push(WT.tollOf(g, i));
    return a;
  }
  // 앞으로 2~12칸 안에서 한 번 굴렸을 때 낼 통행료 기댓값 + 가장 큰 통행료
  function danger(g, me, from) {
    var exp = 0, max = 0;
    for (var s = 2; s <= 12; s++) {
      var i = (from + s) % N, o = g.own[i];
      if (o >= 0 && o !== me) { var t = WT.tollOf(g, i); exp += P2[s] * t; if (t > max) max = t; }
    }
    return { exp: exp, max: max };
  }
  // 손에 쥐고 있어야 할 돈
  function reserve(g, me, L) {
    var ts = oppTolls(g, me).sort(function (a, b) { return b - a; });
    var top = ts[0] || 0, second = ts[1] || 0;
    var d = danger(g, me, g.players[me].pos);
    var r = Math.max(top * 0.35 + second * 0.15, d.max * 0.5, d.exp * 3, 60);
    return r * L.reserve;
  }
  function unownedLeft(g) { var c = 0; for (var i = 0; i < N; i++) if (WT.isDeed(i) && g.own[i] < 0) c++; return c; }

  // 땅 하나의 쓸모 (대략 통행료 수익)
  function deedWorth(g, i) {
    var t = T[i];
    if (t.k === 'city') return t.t[4] * 0.35 + t.p * 0.5;
    return t.t[0] * 1.1;
  }

  // 땅 하나의 값어치(거래·경매용): 땅값+건물값, 세트를 채우면 더 귀함
  function holdValue(g, i, who) {
    var v = T[i].p + WT.buildValue(i, g.lv[i]);
    var k = WT.groupOf(i);
    if (g.cfg.setBonus && k >= 0) {
      var gr = WT.GROUPS[k], mine = gr.filter(function (j) { return j !== i && g.own[j] === who; }).length;
      if (mine === gr.length - 1) v *= 1.8; else if (mine) v *= 1.2;
    }
    if (g.cfg.monoWin && T[i].k === 'spot') {
      var sp = WT.SPOTS.filter(function (j) { return j !== i && g.own[j] === who; }).length;
      if (sp === 2) v *= 3; else if (sp === 1) v *= 1.3;
    }
    return v;
  }
  // 거래 제안을 받을지
  function judge(g, o, me, level, rng) {
    var get = 0, lose = 0;
    o.give.forEach(function (i) { get += holdValue(g, i, me); });
    o.take.forEach(function (i) { lose += holdValue(g, i, me); });
    // 상대가 세트·독점을 채우게 되면 그만큼 더 아까움
    o.take.forEach(function (i) { lose += (holdValue(g, i, o.from) - (T[i].p + WT.buildValue(i, g.lv[i]))) * 0.8; });
    get += o.cash;
    if (level === 'easy') return get >= lose * (0.8 + rng() * 0.6);
    // 상대가 독점 승리를 완성하면 절대 안 받음
    if (g.cfg.monoWin) {
      var t = WT.clone(g);
      o.take.forEach(function (i) { t.own[i] = o.from; }); o.give.forEach(function (i) { t.own[i] = me; });
      if (WT.monoOf(t, o.from)) return false;
    }
    return get >= lose * 1.15 + 20;
  }
  // 세트를 채울 땅을 돈 주고 사자고 제안 (가끔)
  function tradeIdea(g, me, L, level, rng) {
    if (!g.cfg.trade || g.offered || level === 'easy' || rng() > 0.35) return null;
    var p = g.players[me], res = reserve(g, me, L);
    for (var k = 0; k < WT.GROUPS.length; k++) {
      var gr = WT.GROUPS[k];
      if (!g.cfg.setBonus && !g.cfg.monoWin) break;
      var mine = gr.filter(function (j) { return g.own[j] === me; }), miss = gr.filter(function (j) { return g.own[j] !== me; });
      if (mine.length !== gr.length - 1 || miss.length !== 1) continue;
      var i = miss[0], o = g.own[i];
      if (o < 0 || g.players[o].out) continue;
      var cash = Math.ceil((T[i].p + WT.buildValue(i, g.lv[i])) * 1.6 / 10) * 10;
      if (p.money - cash < res + 100) continue;
      var off = { type: 'offer', to: o, give: [], take: [i], cash: cash };
      if (WT.legal(g, off)) return off;
    }
    return null;
  }

  function choose(g, level, rng) {
    rng = rng || Math.random;
    var L = LEVEL[level] || LEVEL.normal;
    var me = WT.actor(g), p = g.players[me];
    var res = reserve(g, me, L);

    switch (g.phase) {
      case 'auction': {
        var at = g.pend.t, min = g.pend.min, val = holdValue(g, at, me) * (level === 'easy' ? 0.5 + rng() * 0.6 : 0.85);
        var cap = Math.min(val, p.money - res * 0.8);
        if (cap < min) return { type: 'bid', a: 0 };
        var bid = Math.floor((min + (cap - min) * (level === 'easy' ? rng() : 0.6 + rng() * 0.4)) / 10) * 10;
        return { type: 'bid', a: Math.max(min, Math.min(bid, Math.floor(p.money / 10) * 10)) };
      }
      case 'trade': return { type: 'answer', ok: judge(g, g.pend, me, level, rng) };
      case 'festival': {
        var bf = -1, bt = -1;
        WT.owned(g, me).forEach(function (i) { var t = WT.baseToll(g, i); if (t > bt) { bt = t; bf = i; } });
        return bf >= 0 ? { type: 'festival', t: bf } : { type: 'skip' };
      }
      case 'startPick': {
        var bestT = -1, bs = 0;
        WT.pickable(g, me).forEach(function (i) {
          var cost, gain;
          if (g.own[i] < 0) { cost = T[i].p; gain = holdValue(g, i, me); }
          else { cost = WT.stepCost(i, g.lv[i]); gain = T[i].t[g.lv[i] + 1] - T[i].t[g.lv[i]] + cost * 0.3; }
          if (p.money - cost < res) return;
          if (gain > bs) { bs = gain; bestT = i; }
        });
        return bestT >= 0 ? { type: 'pick', t: bestT } : { type: 'skip' };
      }
      case 'roll':
        var idea = tradeIdea(g, me, L, level, rng);
        if (idea) return idea;
        if (p.isl > 0 && p.esc > 0 && unownedLeft(g) >= 8) return { type: 'escape' };
        if (p.esc > 0 && unownedLeft(g) < 4 && level !== 'easy') return { type: 'sellCard' };
        return { type: 'roll' };

      case 'space': return { type: 'space', to: spaceTarget(g, me, L, rng) };

      case 'buy': {
        var i = g.pend.t, price = T[i].p;
        if (rng() > L.buyChance) return { type: 'skip' };
        // 비싸도 관광지·대도시는 조금 더 무리해서 삼
        var want = T[i].k === 'spot' ? 0.6 : 1;
        if (p.money - price >= res * want) return { type: 'buy' };
        return { type: 'skip' };
      }

      case 'build': {
        var t = g.pend.t, best = 0;
        if (rng() > L.build) return { type: 'skip' };
        for (var lv = g.lv[t] + 1; lv <= 4; lv++) {
          var cost = WT.buildValue(t, lv) - WT.buildValue(t, g.lv[t]);
          if (p.money - cost >= res) best = lv;
        }
        // 빌딩은 별장 2채보다 효율이 좋으니 가능하면 건너뜀
        if (best === 2 && level === 'normal') {
          var c3 = WT.buildValue(t, 3) - WT.buildValue(t, g.lv[t]);
          if (p.money - c3 >= res * 0.8) best = 3;
        }
        return best ? { type: 'build', lv: best } : { type: 'skip' };
      }

      case 'toll':
        return { type: 'toll', use: g.pend.a >= (level === 'easy' ? 0 : 60) };

      case 'takeover': {
        // 웃돈을 주고도 손에 쥘 돈이 남고, 통행료가 쏠쏠한 땅이면 가져옴
        var ti = g.pend.t, price = g.pend.a, left = p.money - price;
        if (level === 'easy') return { type: rng() < 0.3 && left >= 300 ? 'takeover' : 'skip' };
        var toll = WT.tollOf(g, ti), worth = T[ti].k === 'city' ? T[ti].t[Math.min(4, g.lv[ti] + 1)] : T[ti].t[0];
        if (left >= Math.max(res * 1.3, 300) && worth * 4 >= price) return { type: 'takeover' };
        return { type: 'skip' };
      }

      case 'pay': {
        if (p.esc > 0) return { type: 'sellCard' };
        var ord = WT.autoSellOrder(g, me);
        if (ord.length) return { type: 'sell', t: ord[0] };
        return { type: 'bankrupt' };
      }
    }
    return null;
  }

  function spaceScore(g, me, i, L, rng) {
    var p = g.players[me], res = reserve(g, me, L);
    var s = 0, t = T[i], salary = i < WT.SPACE ? WT.SALARY : 0;
    var money = p.money + salary;
    if (WT.isDeed(i)) {
      var o = g.own[i];
      if (o < 0) s = money - t.p >= res * 0.7 ? deedWorth(g, i) : -5;
      else if (o === me) s = t.k === 'city' && g.lv[i] < 4 && money - WT.stepCost(i, g.lv[i]) >= res ? t.t[Math.min(4, g.lv[i] + 1)] * 0.4 : 0;
      else s = -WT.tollOf(g, i) * 1.2;
    } else if (t.k === 'fund') s = g.fund;
    else if (t.k === 'key') s = 10;
    else if (t.k === 'island') s = unownedLeft(g) > 6 ? -80 : 30;
    else if (t.k === 'donate') s = -150;
    s += salary * 0.9;
    s -= danger(g, me, i).exp * 0.8; // 다음 굴림에서 걸릴 위험
    s += (rng() - 0.5) * 80 * L.noise;
    return s;
  }
  function spaceTarget(g, me, L, rng) {
    var best = 0, bs = -1e9;
    for (var i = 0; i < N; i++) {
      if (i === WT.SPACE) continue;
      var s = spaceScore(g, me, i, L, rng);
      if (s > bs) { bs = s; best = i; }
    }
    return best;
  }

  var WAI = { LEVEL: LEVEL, choose: choose, reserve: reserve, danger: danger, judge: judge, holdValue: holdValue };
  if (typeof module !== 'undefined' && module.exports) module.exports = WAI; else root.WAI = WAI;
})(this);
