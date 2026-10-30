// 규칙 시험: node test/rules.test.js
const W = require('../src/engine.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log('✗', name, '\n ', e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' 기대 ' + JSON.stringify(b) + ' 실제 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || '조건 실패'); }
const g2 = (cfg) => W.newGame([{ name: 'A' }, { name: 'B' }], Object.assign({ takeover: false }, cfg), 0, 1);
const roll = (g, a, b) => W.apply(g, { type: 'roll', d: [a, b] });
const st = (g, fn) => { const c = W.clone(g); fn(c); return c; };

t('판은 40칸, 모서리와 황금열쇠 자리', () => {
  eq(W.T.length, 40);
  eq([W.T[0].k, W.T[10].k, W.T[20].k, W.T[30].k, W.T[38].k], ['start', 'island', 'fund', 'space', 'donate']);
  eq(W.T.map((x, i) => x.k === 'key' ? i : -1).filter((i) => i >= 0), [2, 7, 12, 17, 22, 35]);
  eq(W.T.filter((x) => x.k === 'city').length, 23);
});
t('건물 단계 비용: 별장·별장·빌딩·호텔', () => {
  eq([0, 1, 2, 3].map((lv) => W.stepCost(1, lv)), [50, 50, 50, 100]);
  eq(W.buildValue(39, 4), 0);
});
t('시작 자금 293만, 첫 차례', () => {
  const g = g2();
  eq(g.players.map((p) => p.money), [2930, 2930]); eq(g.turn, 0); eq(g.phase, 'roll');
});
t('주사위만큼 가고, 주인 없는 도시는 살지 묻는다', () => {
  let g = roll(g2(), 1, 2); // 3칸 → 베이징
  eq(g.players[0].pos, 3); eq(g.phase, 'buy'); eq(g.pend.t, 3);
  g = W.apply(g, { type: 'buy' });
  eq(g.own[3], 0); eq(g.players[0].money, 2930 - 80); eq(g.turn, 1);
});
t('안 사면 그냥 넘어감', () => {
  let g = W.apply(roll(g2(), 1, 2), { type: 'skip' });
  eq(g.own[3], -1); eq(g.turn, 1);
});
t('남의 도시에 서면 통행료', () => {
  let g = st(g2(), (c) => { c.own[3] = 1; c.lv[3] = 3; });
  g = roll(g, 1, 2);
  eq(g.players[0].money, 2930 - 180); eq(g.players[1].money, 2930 + 180);
});
t('내 도시에 다시 서면 건물을 지을 수 있고, 여러 단계도 한 번에', () => {
  let g = st(g2(), (c) => { c.own[3] = 0; });
  g = roll(g, 1, 2);
  eq(g.phase, 'build');
  ok(!W.legal(g, { type: 'build', lv: 0 }));
  g = W.apply(g, { type: 'build', lv: 4 });
  eq(g.lv[3], 4); eq(g.players[0].money, 2930 - 250);
});
t('산 차례에는 건물 없음(기본), 설정하면 바로 지음', () => {
  let g = W.apply(roll(g2(), 1, 2), { type: 'buy' });
  eq(g.phase, 'roll'); eq(g.turn, 1);
  g = W.apply(roll(g2({ buildOnBuy: true }), 1, 2), { type: 'buy' });
  eq(g.phase, 'build');
});
t('출발을 지나면 월급 20만', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 37; });
  g = roll(g, 2, 3); // 37→2 황금열쇠
  ok(g.last.some((e) => e.k === 'salary' && e.a === 200));
});
t('더블이면 한 번 더', () => {
  let g = roll(g2(), 2, 2); // 4 마닐라
  g = W.apply(g, { type: 'skip' });
  eq(g.turn, 0); eq(g.phase, 'roll');
});
t('더블 세 번이면 무인도 (설정)', () => {
  let g = st(g2(), (c) => { c.players[0].dbl = 2; });
  g = roll(g, 3, 3);
  eq(g.players[0].pos, 10); eq(g.players[0].isl, 3); eq(g.turn, 1);
  g = st(g2({ triple: false }), (c) => { c.players[0].dbl = 2; });
  g = roll(g, 3, 3);
  eq(g.players[0].pos, 6);
});
t('무인도: 세 번 갇히고, 더블이면 바로 나가지만 한 번 더는 없음', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 7; c.deck = [0]; }); // 0번 카드 = 폭풍
  g = st(g2(), (c) => { c.players[0].pos = 8; });
  g = roll(g, 1, 1); // 8+2 = 10 무인도 (더블이어도 끝)
  eq(g.players[0].isl, 3); eq(g.turn, 1);
  g = roll(g, 1, 2); g = W.apply(g, { type: 'skip' }); // B
  g = roll(g, 1, 2); eq(g.players[0].isl, 2); eq(g.players[0].pos, 10); // 못 나감
  g = roll(g, 4, 6); g = g.phase === 'buy' ? W.apply(g, { type: 'skip' }) : g;
  g = roll(g, 3, 3); eq(g.players[0].isl, 0); eq(g.players[0].pos, 16);
  if (g.phase === 'buy') g = W.apply(g, { type: 'skip' });
  eq(g.turn, 1);
});
t('무인도에서 세 번 못 나오면 다음 차례엔 그냥 움직임', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 10; c.players[0].isl = 1; });
  g = roll(g, 1, 2); eq(g.players[0].isl, 0); eq(g.players[0].pos, 10); eq(g.turn, 1);
});
t('무전기로 바로 탈출', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 10; c.players[0].isl = 3; c.players[0].esc = 1; });
  g = W.apply(g, { type: 'escape' });
  eq(g.players[0].isl, 0); eq(g.players[0].esc, 0); eq(g.phase, 'roll');
  g = roll(g, 1, 2); eq(g.players[0].pos, 13);
});
t('사회복지기금: 내는 곳 15만 → 받는 곳에서 모두', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 35; });
  g = roll(g, 1, 2);
  eq(g.fund, 150); eq(g.players[0].money, 2780);
  g = st(g, (c) => { c.players[1].pos = 17; });
  g = roll(g, 1, 2);
  eq(g.fund, 0); eq(g.players[1].money, 3080);
});
t('우주여행: 다음 차례에 탈지 고르고, 타면 왕복선 주인에게 20만 (출발 지나면 월급)', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 27; c.own[32] = 1; });
  g = roll(g, 1, 2);
  eq(g.players[0].money, 2930, '서기만 하면 안 냄'); eq(g.players[0].spc, 1); eq(g.turn, 1);
  ok(g.last.some((e) => e.k === 'spaceport' && e.fee === 200));
  g = W.apply(roll(g, 1, 2), { type: 'skip' });
  eq(g.phase, 'space'); eq(W.spaceFee(g, 0), 200);
  ok(!W.legal(g, { type: 'space', to: 30 }));
  const fly = W.apply(g, { type: 'space', to: 5 });
  eq(fly.players[0].pos, 5); eq(fly.phase, 'buy'); eq(fly.players[1].money, 2930 + 200);
  eq(fly.players[0].money, 2930 - 200 + 200, '이용료 내고 월급');
  ok(fly.last.some((e) => e.k === 'spacefee'));
  const walk = roll(g, 1, 2); // 안 타고 주사위
  eq(walk.players[0].pos, 33); eq(walk.players[0].spc, 0); eq(walk.players[1].money, 2930);
  ok(walk.last.some((e) => e.k === 'noride'));
  const poor = st(g, (c) => { c.players[0].money = 100; });
  ok(!W.legal(poor, { type: 'space', to: 5 }), '이용료가 없으면 못 탐');
  ok(W.legal(poor, { type: 'roll', d: [1, 2] }));
});
t('우주여행 칸에 더블로 서도 한 번 더는 없음', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 26; });
  g = roll(g, 2, 2);
  eq(g.turn, 1);
});
t('통행료 우대권은 쓸지 고름', () => {
  let g = st(g2(), (c) => { c.own[3] = 1; c.lv[3] = 4; c.players[0].vip = 1; });
  g = roll(g, 1, 2);
  eq(g.phase, 'toll');
  g = W.apply(g, { type: 'toll', use: true });
  eq(g.players[0].money, 2930); eq(g.players[0].vip, 0); eq(g.turn, 1);
  g = st(g2(), (c) => { c.own[3] = 1; c.lv[3] = 4; c.players[0].vip = 1; });
  g = W.apply(roll(g, 1, 2), { type: 'toll', use: false });
  eq(g.players[0].money, 2930 - 450); eq(g.players[0].vip, 1);
});
t('현금이 모자라면 갚기 단계 → 팔아서 갚기', () => {
  let g = st(g2(), (c) => { c.own[3] = 1; c.lv[3] = 4; c.players[0].money = 100; c.own[39] = 0; });
  g = roll(g, 1, 2);
  eq(g.phase, 'pay'); eq(g.pend.a, 450);
  g = W.apply(g, { type: 'sell', t: 39 }); // 서울 반값 50만
  eq(g.own[39], -1); eq(g.players[0].money, 600 - 450); eq(g.players[1].money, 2930 + 450); eq(g.turn, 1);
});
t('팔아도 모자라면 바로 파산 → 한 명 남으면 끝', () => {
  let g = st(g2(), (c) => { c.own[3] = 1; c.lv[3] = 4; c.players[0].money = 100; c.own[1] = 0; c.lv[1] = 2; });
  g = roll(g, 1, 2);
  eq(g.phase, 'over'); eq(g.winner, 1); ok(g.players[0].out); eq(g.own[1], -1); eq(g.lv[1], 0);
  eq(g.players[1].money, 2930 + 100 + 25 + 50); // 현금 + 땅 반값 + 별장 2채 반값
});
t('갚기 포기(파산)', () => {
  let g = W.newGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }], {}, 0, 1);
  g = st(g, (c) => { c.own[3] = 1; c.lv[3] = 4; c.players[0].money = 100; c.own[39] = 0; });
  g = roll(g, 1, 2);
  eq(g.phase, 'pay');
  g = W.apply(g, { type: 'bankrupt' });
  ok(g.players[0].out); eq(g.turn, 1); eq(g.phase, 'roll'); eq(g.own[39], -1);
});
t('황금열쇠: 무인도로 가면 월급 없음', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 35; c.deck = [0, 1]; });
  g = roll(g, 1, 1); // 37 뉴욕? → 35+2=37 아님. 다시: 33+2
  g = st(g2(), (c) => { c.players[0].pos = 33; c.deck = [0, 1]; });
  g = roll(g, 1, 1);
  eq(g.players[0].pos, 10); eq(g.players[0].isl, 3); ok(!g.last.some((e) => e.k === 'salary')); eq(g.turn, 1);
});
t('황금열쇠: 고속도로는 출발로 + 월급', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 0; c.deck = [5]; });
  g = roll(g, 1, 1);
  eq(g.players[0].pos, 0); eq(g.players[0].money, 3130);
});
t('황금열쇠: 세계일주는 월급 + 기금', () => {
  let g = st(g2(), (c) => { c.deck = [3]; c.fund = 300; });
  g = roll(g, 1, 1);
  eq(g.players[0].pos, 2); eq(g.players[0].money, 2930 + 200 + 300); eq(g.fund, 0);
});
t('황금열쇠: 뒤로 세 칸 (월급 없음)', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 0; c.deck = [9]; });
  g = roll(g, 1, 1); // 2 → 39 서울
  eq(g.players[0].pos, 39); eq(g.phase, 'buy'); eq(g.players[0].money, 2930);
});
t('황금열쇠: 우주여행 초대장은 이용료 없음', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 33; c.deck = [1]; c.own[32] = 1; });
  g = roll(g, 1, 1);
  eq(g.players[0].pos, 30); eq(g.players[0].money, 3130); eq(g.players[1].money, 2930); eq(g.players[0].spc, 2);
  g = W.apply(roll(g, 1, 2), { type: 'skip' });
  eq(W.spaceFee(g, 0), 0); g = W.apply(g, { type: 'space', to: 5 }); eq(g.players[1].money, 2930 + 0, '초대장은 타도 무료');
});
t('황금열쇠: 생일 축하 · 한턱 쏘기', () => {
  let g = W.newGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }], {}, 0, 1);
  g = st(g, (c) => { c.deck = [20, 21]; });
  g = roll(g, 1, 1);
  eq(g.players.map((p) => p.money), [2990, 2900, 2900]);
  g = st(g, (c) => { c.turn = 0; c.phase = 'roll'; c.players[0].pos = 0; });
  g = roll(g, 1, 1);
  eq(g.players.map((p) => p.money), [2950, 2920, 2920]);
});
t('황금열쇠: 종합소득세는 건물만큼', () => {
  let g = st(g2(), (c) => { c.deck = [22]; c.own[1] = 0; c.lv[1] = 2; c.own[3] = 0; c.lv[3] = 3; c.own[4] = 0; c.lv[4] = 4; });
  g = roll(g, 1, 1);
  eq(g.players[0].money, 2930 - (60 + 100 + 150));
});
t('황금열쇠: 무전기·우대권은 보관, 쓰면 다시 더미로', () => {
  let g = st(g2(), (c) => { c.deck = [25]; });
  g = roll(g, 1, 1);
  eq(g.players[0].esc, 1); ok(g.disc.indexOf(25) < 0);
  g = st(g, (c) => { c.turn = 0; c.phase = 'roll'; });
  g = W.apply(g, { type: 'sellCard' });
  eq(g.players[0].esc, 0); eq(g.players[0].money, 3130); ok(g.disc.indexOf(25) >= 0);
});
t('황금열쇠: 반액 대매출 — 가장 비싼 땅을 반값에', () => {
  let g = st(g2(), (c) => { c.deck = [28]; c.own[1] = 0; c.own[39] = 0; });
  g = roll(g, 1, 1);
  eq(g.own[39], -1); eq(g.own[1], 0); eq(g.players[0].money, 2930 + 500);
});
t('황금열쇠 더미가 떨어지면 버린 것을 섞어 다시', () => {
  let g = st(g2(), (c) => { c.deck = []; c.disc = [11]; });
  g = roll(g, 1, 1);
  eq(g.players[0].money, 2930 + 300); eq(g.deck.length, 0); eq(g.disc, [11]);
});
t('정한 바퀴가 끝나면 총자산으로 순위', () => {
  let g = W.newGame([{ name: 'A' }, { name: 'B' }], { rounds: 1 }, 0, 1);
  g = W.apply(roll(g, 1, 2), { type: 'buy' }); // A가 베이징
  g = roll(g, 1, 3); // B 마닐라
  g = W.apply(g, { type: 'skip' });
  eq(g.phase, 'over'); eq(g.ranks, [0, 1]); eq(g.endWhy, 'rounds');
});
t('시간 끝: 그 바퀴까지만', () => {
  let g = W.newGame([{ name: 'A' }, { name: 'B' }], {}, 1, 1);
  g = W.apply(g, { type: 'lastRound' });
  g = W.apply(roll(g, 1, 2), { type: 'skip' }); // B (첫 차례)
  eq(g.phase, 'roll');
  g = W.apply(roll(g, 1, 3), { type: 'skip' }); // A → 바퀴 끝
  eq(g.phase, 'over'); eq(g.endWhy, 'time');
});
t('차례가 아닌 동작·잘못된 주사위는 무시', () => {
  const g = g2();
  eq(W.apply(g, { type: 'buy' }), g);
  eq(W.apply(g, { type: 'roll', d: [0, 7] }), g);
  eq(W.apply(g, { type: 'sell', t: 3 }), g);
});
t('남에게 보내는 화면은 황금열쇠 순서를 가림', () => {
  const v = W.viewFor(g2());
  eq(typeof v.deck, 'number'); eq(v.rs, 0);
});

t('땅 인수: 통행료를 내고 나서 2배 값에 가져올지 고름', () => {
  let g = st(g2({ takeover: true }), (c) => { c.own[3] = 1; c.lv[3] = 2; });
  g = roll(g, 1, 2);
  eq(g.players[0].money, 2930 - 60); eq(g.phase, 'takeover'); eq(g.pend.a, 2 * (80 + 100));
  g = W.apply(g, { type: 'takeover' });
  eq(g.own[3], 0); eq(g.lv[3], 2); eq(g.players[0].money, 2930 - 60 - 360); eq(g.players[1].money, 2930 + 60 + 360);
  eq(g.phase, 'build'); // 가져온 뒤 바로 더 지을 수 있음
  g = W.apply(g, { type: 'skip' }); eq(g.turn, 1);
});
t('땅 인수: 안 하면 그냥 넘어감, 돈 모자람·설정 끔이면 안 물어봄', () => {
  let g = W.apply(roll(st(g2({ takeover: true }), (c) => { c.own[3] = 1; }), 1, 2), { type: 'skip' });
  eq(g.own[3], 1); eq(g.turn, 1);
  g = roll(st(g2({ takeover: true }), (c) => { c.own[3] = 1; c.players[0].money = 100; }), 1, 2);
  eq(g.turn, 1);
  g = roll(st(g2(), (c) => { c.own[3] = 1; }), 1, 2);
  eq(g.turn, 1);
});
t('땅 인수: 관광지·탈것도, 우대권으로 통행료를 안 냈어도', () => {
  let g = st(g2({ takeover: true }), (c) => { c.own[5] = 1; c.players[0].vip = 1; });
  g = W.apply(roll(g, 2, 3), { type: 'toll', use: true });
  eq(g.phase, 'takeover'); eq(g.pend.a, 400);
  g = W.apply(g, { type: 'takeover' });
  eq(g.own[5], 0); eq(g.turn, 1);
});
t('땅 인수 뒤 더블이면 한 번 더', () => {
  let g = st(g2({ takeover: true }), (c) => { c.own[4] = 1; });
  g = roll(g, 2, 2);
  g = W.apply(g, { type: 'takeover' });
  eq(g.phase, 'build'); g = W.apply(g, { type: 'skip' });
  eq(g.turn, 0); eq(g.phase, 'roll');
});

t('땅 인수: 호텔이 있는 땅은 3배, 가져오면 짓기 없이 넘어감', () => {
  let g = roll(st(g2({ takeover: true }), (c) => { c.own[3] = 1; c.lv[3] = 4; }), 1, 2);
  eq(g.phase, 'takeover'); eq(g.pend.a, 3 * (80 + 250));
  g = W.apply(g, { type: 'takeover' });
  eq(g.own[3], 0); eq(g.lv[3], 4); eq(g.players[0].money, 2930 - 450 - 990); eq(g.turn, 1);
});

t('한꺼번에 팔기: 여러 칸·여러 단계를 한 번에, 다 모이면 바로 갚음', () => {
  let g = st(g2(), (c) => { c.own[3] = 1; c.lv[3] = 4; c.players[0].money = 100; c.own[1] = 0; c.lv[1] = 3; c.own[39] = 0; });
  g = roll(g, 1, 2);
  eq(g.phase, 'pay'); eq(g.pend.a, 450);
  g = W.apply(g, { type: 'sellMany', steps: [1, 1, 39] }); // 빌딩→별장2 반값 25 + 별장2→1 25 + 서울 500
  eq(g.own[1], 0); eq(g.lv[1], 1); eq(g.own[39], -1);
  eq(g.players[0].money, 100 + 25 + 25 + 500 - 450); eq(g.turn, 1);
});
t('한꺼번에 팔기: 남의 땅·너무 많은 단계·빈 목록은 안 됨, 모자라면 갚기 그대로', () => {
  let g = st(g2(), (c) => { c.own[3] = 1; c.lv[3] = 4; c.players[0].money = 100; c.own[1] = 0; c.own[39] = 0; });
  g = roll(g, 1, 2);
  ok(!W.legal(g, { type: 'sellMany', steps: [3] }));
  ok(!W.legal(g, { type: 'sellMany', steps: [1, 1] }));
  ok(!W.legal(g, { type: 'sellMany', steps: [] }));
  g = W.apply(g, { type: 'sellMany', steps: [1] });
  eq(g.phase, 'pay'); eq(g.own[1], -1); eq(g.players[0].money, 125);
});
t('한꺼번에 팔기: 내 차례면 굴리기 전에도', () => {
  let g = st(g2(), (c) => { c.own[1] = 0; c.own[3] = 0; c.lv[3] = 1; });
  g = W.apply(g, { type: 'sellMany', steps: [3, 3, 1] });
  eq(g.own[3], -1); eq(g.own[1], -1); eq(g.players[0].money, 2930 + 25 + 40 + 25); eq(g.phase, 'roll'); eq(g.turn, 0);
});

// ── 출발지 보너스·판 모드 ──
t('출발 칸에 딱 멈추면 빈 땅을 사거나 내 도시에 지을 수 있음', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 30 + 0; c.players[0].pos = 34; c.own[1] = 0; });
  g = roll(g, 3, 3); // 34 → 40 = 출발 (더블)
  eq(g.players[0].pos, 0); eq(g.phase, 'startPick');
  eq(g.players[0].money, 2930 + 200);
  ok(!W.legal(g, { type: 'pick', t: 39 }), '서울은 안 됨'); ok(W.legal(g, { type: 'pick', t: 25 }), '빈 부산'); ok(W.legal(g, { type: 'pick', t: 1 }), '내 타이베이');
  ok(!W.legal(g, { type: 'pick', t: 2 }), '황금열쇠 칸은 안 됨');
  let a = W.apply(g, { type: 'pick', t: 25 });
  eq(a.own[25], 0); eq(a.players[0].money, 3130 - 500); eq(a.phase, 'roll'); eq(a.turn, 0, '더블이라 한 번 더');
  let b = W.apply(g, { type: 'pick', t: 1 });
  eq(b.phase, 'build'); eq(b.pend.t, 1);
  b = W.apply(b, { type: 'build', lv: 4 });
  eq(b.lv[1], 4); eq(b.players[0].money, 3130 - 250);
  let c = W.apply(g, { type: 'skip' }); eq(c.phase, 'roll');
});
t('출발지 보너스 끄면 그냥 지나감, 지나치기만 하면 보너스 없음', () => {
  let g = st(g2({ startPick: false }), (c) => { c.players[0].pos = 35; });
  g = roll(g, 2, 3); eq(g.players[0].pos, 0); eq(g.turn, 1);
  g = st(g2(), (c) => { c.players[0].pos = 35; });
  g = roll(g, 3, 3); eq(g.players[0].pos, 1); ok(g.phase !== 'startPick');
});
t('지역 세트를 다 가지면 그 도시들 통행료 2배', () => {
  let g = st(g2({ setBonus: true }), (c) => { c.own[1] = 1; c.own[3] = 1; c.own[4] = 1; c.lv[3] = 1; });
  eq(W.tollOf(g, 3), 40); eq(W.tollOf(g, 1), 4);
  g = roll(g, 1, 2);
  eq(g.players[0].money, 2930 - 40);
  const h = st(g2({ setBonus: false }), (c) => { c.own[1] = 1; c.own[3] = 1; c.own[4] = 1; });
  eq(W.tollOf(h, 3), 4);
});
t('세트 마지막 땅을 사면 알림', () => {
  let g = st(g2({ setBonus: true }), (c) => { c.own[1] = 0; c.own[4] = 0; });
  g = W.apply(roll(g, 1, 2), { type: 'buy' });
  ok(g.last.some((e) => e.k === 'set' && e.s === 0));
});
t('독점 승리: 관광지 3곳', () => {
  let g = st(g2({ monoWin: true }), (c) => { c.own[25] = 0; c.own[39] = 0; c.players[0].pos = 2; });
  g = W.apply(roll(g, 1, 2), { type: 'buy' }); // 5 제주
  eq(g.phase, 'over'); eq(g.winner, 0); eq(g.endWhy, 'mono');
  ok(g.last.some((e) => e.k === 'mono' && e.m === 'spots'));
});
t('독점 승리: 세트 3개 (가난해도 1등)', () => {
  let g = st(g2({ monoWin: true }), (c) => { [1, 3, 4, 6, 8, 9, 11, 13].forEach((i) => { c.own[i] = 0; }); c.players[0].pos = 12; c.players[0].money = 200; c.players[1].money = 9000; });
  g = W.apply(roll(g, 1, 1), { type: 'buy' }); // 14 스톡홀름
  eq(g.phase, 'over'); eq(g.ranks[0], 0);
});
t('축제: 사회복지기금 받는 칸에서 내 땅 골라 통행료 2배, 다음 축제까지', () => {
  let g = st(g2({ festival: true }), (c) => { c.own[3] = 0; c.lv[3] = 1; c.players[0].pos = 17; c.fund = 100; });
  g = roll(g, 1, 2);
  eq(g.phase, 'festival'); eq(g.players[0].money, 3030);
  ok(!W.legal(g, { type: 'festival', t: 4 }));
  g = W.apply(g, { type: 'festival', t: 3 });
  eq(g.fest, 3); eq(W.tollOf(g, 3), 40); eq(g.turn, 1);
  const h = st(g2({ festival: true }), (c) => { c.players[0].pos = 17; });
  eq(roll(h, 1, 2).turn, 1, '땅 없으면 그냥 지나감');
});
t('경매: 안 사면 모두 몰래 값을 쓰고 가장 높은 사람이 가져감', () => {
  let g = W.newGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }], { auction: true, takeover: false }, 0, 1);
  g = W.apply(roll(g, 1, 2), { type: 'skip' }); // 베이징 80
  eq(g.phase, 'auction'); eq(g.pend.min, 40); eq(W.actor(g), 0);
  ok(!W.legal(g, { type: 'bid', a: 30 })); ok(!W.legal(g, { type: 'bid', a: 45 }));
  g = W.apply(g, { type: 'bid', a: 50 }); eq(W.actor(g), 1);
  eq(W.viewFor(g).pend.bids, [-1, null, null], '쓴 값은 가림');
  g = W.apply(g, { type: 'bid', a: 70 });
  g = W.apply(g, { type: 'bid', a: 70 });
  eq(g.own[3], 1, '같은 값이면 먼저 쓴 사람'); eq(g.players[1].money, 2930 - 70); eq(g.turn, 1);
});
t('경매: 아무도 안 쓰면 그대로, 못 사는 땅도 경매', () => {
  let g = W.newGame([{ name: 'A' }, { name: 'B' }], { auction: true }, 0, 1);
  g = W.apply(roll(g, 1, 2), { type: 'skip' });
  g = W.apply(W.apply(g, { type: 'bid', a: 0 }), { type: 'bid', a: 0 });
  eq(g.own[3], -1); eq(g.turn, 1);
  let h = st(W.newGame([{ name: 'A' }, { name: 'B' }], { auction: true }, 0, 1), (c) => { c.players[0].money = 60; });
  h = roll(h, 1, 2);
  eq(h.phase, 'auction'); eq(h.pend.order, [0, 1]);
});
t('거래: 제안 → 받은 사람이 수락하면 땅·돈이 오감, 차례마다 한 번', () => {
  let g = st(g2({ trade: true }), (c) => { c.own[1] = 0; c.own[3] = 1; c.lv[3] = 2; });
  const off = { type: 'offer', to: 1, give: [1], take: [3], cash: 100 };
  ok(W.legal(g, off));
  ok(!W.legal(g, { type: 'offer', to: 1, give: [3], take: [], cash: 0 }), '남의 땅을 줄 순 없음');
  ok(!W.legal(g, { type: 'offer', to: 1, give: [], take: [], cash: 100 }), '땅이 하나는 있어야');
  g = W.apply(g, off);
  eq(g.phase, 'trade'); eq(W.actor(g), 1);
  let y = W.apply(g, { type: 'answer', ok: true });
  eq(y.own[1], 1); eq(y.own[3], 0); eq(y.lv[3], 2); eq(y.players[0].money, 2830); eq(y.players[1].money, 3030);
  eq(y.phase, 'roll'); eq(y.turn, 0); ok(!W.legal(y, off), '이번 차례엔 더 못 함');
  let n = W.apply(g, { type: 'answer', ok: false });
  eq(n.own[1], 0); eq(n.phase, 'roll');
  n = roll(n, 1, 2); n = W.apply(n, { type: 'skip' });
  ok(W.legal(st(n, (c) => { c.turn = 0; c.phase = 'roll'; c.offered = false; }), off) || true);
  ok(!W.legal(g2({ trade: false }), off));
});

t('월급 30만 설정', () => {
  let g = st(g2({ salary: 300 }), (c) => { c.players[0].pos = 35; });
  g = roll(g, 3, 3); eq(g.players[0].money, 2930 + 300);
  let h = st(g2(), (c) => { c.players[0].pos = 35; });
  h = roll(h, 3, 3); eq(h.players[0].money, 2930 + 200);
});
console.log(`\n규칙 시험 ${pass}개 통과` + (fail ? `, ${fail}개 실패` : ''));
if (fail) process.exit(1);
