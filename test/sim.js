// 컴퓨터끼리 대국: 끝나는지, 돈이 새거나 생기지 않는지, 잘 두는 쪽이 이기는지
const W = require('../src/engine.js');
const A = require('../src/ai.js');
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const die = (r) => 1 + Math.floor(r() * 6);

function total(s) { // 돈은 은행·기금과 오가지만 사람끼리 주고받을 땐 그대로여야 함 — 여기선 음수만 검사
  s.players.forEach((p, i) => { if (p.money < 0) throw new Error('돈이 음수 ' + i + ' ' + JSON.stringify(s.last)); });
}

function play(levels, cfg, seed) {
  const r = rng(seed);
  let s = W.newGame(levels.map((l, i) => ({ name: 'P' + i, ai: l })), cfg, seed % levels.length, seed);
  let steps = 0, turns = 0, keys = 0;
  while (s.phase !== 'over') {
    if (++steps > 20000) throw new Error('끝나지 않음 ' + seed + ' round ' + s.round);
    const lv = levels[s.turn];
    let a = A.choose(s, lv === 'random' ? 'easy' : lv, r);
    if (!a) throw new Error('수가 없음 ' + s.phase);
    if (a.type === 'roll') a = { type: 'roll', d: [die(r), die(r)] };
    const before = s.seq;
    const ns = W.apply(s, a);
    if (ns.seq === before) throw new Error('안 되는 수 ' + JSON.stringify(a) + ' phase ' + s.phase + ' ' + JSON.stringify(s.pend));
    s = ns;
    if (a.type === 'roll') turns++;
    keys += s.last.filter((e) => e.k === 'key').length;
    total(s);
    // 소유 불변식
    s.own.forEach((o, i) => { if (o >= 0 && s.players[o].out) throw new Error('파산한 사람 땅'); if (o < 0 && s.lv[i]) throw new Error('주인 없는 건물'); });
  }
  return { winner: s.winner, rounds: s.round, turns, keys, why: s.endWhy };
}
function match(levels, cfg, n) {
  const w = levels.map(() => 0); let rd = 0, tu = 0, maxR = 0;
  for (let i = 1; i <= n; i++) { const g = play(levels, cfg, i * 7919); w[g.winner]++; rd += g.rounds; tu += g.turns; maxR = Math.max(maxR, g.rounds); }
  console.log(levels.join(' vs '), JSON.stringify(cfg), '승:', w.join('/'), `평균 ${(rd / n).toFixed(1)}바퀴(최대 ${maxR}) 굴림 ${(tu / n).toFixed(0)}`);
}
const N = +process.argv[2] || 200;
match(['normal', 'easy'], {}, N);
match(['easy', 'normal'], {}, N);
match(['normal', 'easy', 'normal'], {}, N);
match(['normal', 'normal', 'normal'], {}, N);
match(['normal', 'easy', 'easy', 'easy'], {}, N);
match(['normal', 'normal', 'normal', 'normal'], {}, N);
match(['normal', 'easy'], { rounds: 15 }, N);
match(['normal', 'normal', 'easy'], { start: 2000, triple: false, buildOnBuy: true }, N);
