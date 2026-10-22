// 규칙 시험: node test/rules.test.js
const W = require('../src/engine.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log('✗', name, '\n ', e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' 기대 ' + JSON.stringify(b) + ' 실제 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || '조건 실패'); }
const g2 = (cfg) => W.newGame([{ name: 'A' }, { name: 'B' }], cfg, 0, 1);
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
t('우주여행: 왕복선 주인에게 20만, 다음 차례에 원하는 곳으로 (출발 지나면 월급)', () => {
  let g = st(g2(), (c) => { c.players[0].pos = 27; c.own[32] = 1; });
  g = roll(g, 1, 2);
  eq(g.players[0].money, 2730); eq(g.players[1].money, 3130); eq(g.players[0].spc, 1); eq(g.turn, 1);
  g = W.apply(roll(g, 1, 2), { type: 'skip' });
  eq(g.phase, 'space');
  ok(!W.legal(g, { type: 'space', to: 30 }));
  g = W.apply(g, { type: 'space', to: 5 });
  eq(g.players[0].pos, 5); eq(g.phase, 'buy');
  ok(g.last.some((e) => e.k === 'salary'));
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
  eq(g.players[0].pos, 30); eq(g.players[0].money, 3130); eq(g.players[1].money, 2930); eq(g.players[0].spc, 1);
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

console.log(`\n규칙 시험 ${pass}개 통과` + (fail ? `, ${fail}개 실패` : ''));
if (fail) process.exit(1);
