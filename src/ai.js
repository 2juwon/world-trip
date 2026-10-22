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

  function choose(g, level, rng) {
    rng = rng || Math.random;
    var L = LEVEL[level] || LEVEL.normal;
    var me = g.turn, p = g.players[me];
    var res = reserve(g, me, L);

    switch (g.phase) {
      case 'roll':
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

  var WAI = { LEVEL: LEVEL, choose: choose, reserve: reserve, danger: danger };
  if (typeof module !== 'undefined' && module.exports) module.exports = WAI; else root.WAI = WAI;
})(this);
