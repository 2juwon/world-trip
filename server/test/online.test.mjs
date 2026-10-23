/* 로컬 서버(wrangler dev --var FAST_TEST:1)에 봇을 붙여 온라인 흐름을 확인
 *   cd server && npx wrangler dev --var FAST_TEST:1  (다른 창)
 *   node test/online.test.mjs
 */
import { createRequire } from 'module';
import assert from 'assert';
const require = createRequire(import.meta.url);
const W = require('../../src/engine.js');
const AI = require('../../src/ai.js');

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const WSB = BASE.replace(/^http/, 'ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newPid = () => crypto.randomUUID().replace(/-/g, '');
let passed = 0, leaks = 0, states = 0;
const ok = (name) => { passed++; console.log('✓', name); };

class Bot {
  constructor(name, code, pid) { Object.assign(this, { name, code, pid: pid || newPid() }); this.errors = []; this.last = null; this.waiters = []; this.auto = false; }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WSB}/ws/${this.code}?pid=${this.pid}&name=${encodeURIComponent(this.name)}`);
      this.ws = ws; this.closed = false;
      ws.onopen = () => resolve(this);
      ws.onerror = () => reject(new Error('ws error ' + this.name));
      ws.onclose = () => { this.closed = true; };
      ws.onmessage = (e) => {
        if (e.data === 'pong') return;
        const m = JSON.parse(e.data);
        if (m.t === 'error') { this.errors.push(m); return; }
        this.last = m; states++;
        const g = m.room.game;
        if (g && (typeof g.deck !== 'number' || g.rs !== 0)) leaks++;
        this.waiters = this.waiters.filter((w) => { if (w.f(m)) { w.res(m); return false; } return true; });
        if (this.auto) this.play(m);
      };
    });
  }
  play(m) {
    const r = m.room, g = r.game;
    if (r.status !== 'playing' || !g || g.turn !== m.seat || g.phase === 'over') return;
    if (r.seats[m.seat].away) return;
    const key = g.seq;
    if (this.acted === key) return;
    this.acted = key;
    setTimeout(() => {
      if (!this.last || !this.last.room.game || this.last.room.game.seq !== key) return;
      const a = AI.choose(g, 'normal');
      this.send({ t: 'act', seq: g.seq, a });
    }, 15);
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(f, ms = 8000, label = '') {
    if (this.last && f(this.last)) return Promise.resolve(this.last);
    return new Promise((res, rej) => {
      const w = { f, res };
      this.waiters.push(w);
      setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); rej(new Error('시간 초과: ' + this.name + ' ' + label + ' ' + JSON.stringify(this.last && this.last.room && { st: this.last.room.status, seats: this.last.room.seats, turn: this.last.room.game && this.last.room.game.turn, ph: this.last.room.game && this.last.room.game.phase }))); }, ms);
    });
  }
  get room() { return this.last && this.last.room; }
  get seat() { return this.last.seat; }
  get game() { return this.last && this.last.room.game; }
  close() { try { this.ws.close(); } catch (e) {} }
}
const post = async (path, body) => (await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })).json();
async function until(f, ms = 5000, label = '') { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return; await sleep(30); } throw new Error('시간 초과: ' + label); }
const same = (a, b) => Object.entries(a).every(([k, v]) => b[k] === v);

async function room(names, settings) {
  const { code } = await post('/api/rooms', {});
  const bots = [];
  for (const n of names) {
    const b = await new Bot(n, code).connect();
    bots.push(b);
    await bots[0].wait((m) => m.room.seats.filter((s) => s.online).length === bots.length, 8000, 'join');
    if (settings && bots.length === 1) { b.send({ t: 'settings', settings }); await b.wait((m) => same(settings, m.room.settings), 8000, 'settings'); }
  }
  return { code, bots };
}
const playing = (m) => m.room.status === 'playing' && m.room.game;

async function main() {
  // 1. 방 만들기 · 이름 겹침 · 손님 설정 무시 · 시작 · 빈자리 컴퓨터 · 끝까지
  {
    const { bots } = await room(['주원', '주원'], { players: 3, rounds: 10, timeMin: 0, turnSec: 0 });
    const [a, b] = bots;
    const names = a.room.seats.slice(0, 2).map((s) => s.name);
    assert.deepStrictEqual(names, ['주원', '주원2']); ok('이름이 겹치면 숫자를 붙임');
    b.send({ t: 'settings', settings: { players: 4 } });
    await sleep(300);
    assert.strictEqual(a.room.settings.players, 3); ok('손님은 설정을 못 바꿈');
    b.send({ t: 'start' }); await sleep(200);
    assert.strictEqual(a.room.status, 'waiting'); ok('손님은 시작 못 함');
    a.send({ t: 'start' });
    await a.wait(playing, 5000, 'start');
    assert.strictEqual(a.room.seats[2].kind, 'bot'); assert.strictEqual(a.game.players[2].ai, 'normal'); ok('빈자리는 컴퓨터');
    assert.strictEqual(typeof a.game.deck, 'number'); ok('황금열쇠 순서는 화면에 안 감');
    // 차례 아닌 사람
    const g = a.game, other = g.turn === a.seat ? b : (g.turn === b.seat ? a : b);
    if (g.turn !== other.seat) {
      other.send({ t: 'act', seq: g.seq, a: { type: 'roll' } });
      await until(() => other.errors.length > 0, 3000, 'not turn');
      ok('차례가 아니면 거절');
    }
    // 클라이언트가 보낸 주사위는 무시, lastRound는 거절
    await a.wait((m) => playing(m) && m.room.game.turn === a.seat && m.room.game.phase === 'roll' || (playing(m) && m.room.game.turn === b.seat && m.room.game.phase === 'roll'), 10000, 'roll turn');
    const me = a.game.turn === a.seat ? a : b;
    me.send({ t: 'act', seq: me.game.seq, a: { type: 'lastRound' } });
    await until(() => me.errors.some((e) => /할 수 없는/.test(e.message)), 3000, 'lastRound');
    ok('마지막 바퀴는 손으로 못 정함');
    const seq0 = me.game.seq;
    me.send({ t: 'act', seq: seq0, a: { type: 'roll', d: [6, 6] } });
    const m2 = await me.wait((m) => m.room.game.seq > seq0, 5000, 'roll');
    const ev = m2.room.game.last.find((e) => e.k === 'roll');
    assert.ok(ev && ev.d.every((x) => x >= 1 && x <= 6)); ok('주사위는 서버가 굴림');
    // 지난 화면 수는 무시
    me.send({ t: 'act', seq: seq0, a: { type: 'roll' } });
    await sleep(200);
    a.auto = true; b.auto = true; a.play(a.last); b.play(b.last);
    const end = await a.wait((m) => m.room.status === 'ended', 120000, 'end');
    assert.strictEqual(end.room.game.phase, 'over');
    assert.ok(end.room.game.endWhy === 'rounds' || end.room.game.endWhy === 'last');
    assert.strictEqual(b.last.room.game.winner, end.room.game.winner);
    ok('끝까지 (' + end.room.game.round + '바퀴, ' + end.room.game.endWhy + ')');
    assert.strictEqual(end.room.wins.reduce((x, y) => x + y, 0), 1); ok('방 안 승수');
    // 한 판 더
    b.send({ t: 'again' }); await sleep(200);
    assert.strictEqual(a.room.status, 'ended'); ok('한 판 더는 방장만');
    a.auto = false; b.auto = false;
    a.send({ t: 'again' });
    await a.wait((m) => playing(m) && m.room.round === 2, 5000, 'again');
    ok('한 판 더');
    // 대기실로: 게임 중엔 안 됨
    a.send({ t: 'toWaiting' }); await sleep(200);
    assert.strictEqual(a.room.status, 'playing');
    a.auto = true; b.auto = true; a.play(a.last); b.play(b.last);
    await a.wait((m) => m.room.status === 'ended', 120000, 'end2');
    a.auto = false; b.auto = false;
    a.send({ t: 'toWaiting' });
    await a.wait((m) => m.room.status === 'waiting', 5000, 'waiting');
    assert.strictEqual(a.room.seats[2].kind, 'empty'); ok('대기실로 (컴퓨터 자리 비움)');
    bots.forEach((x) => x.close());
  }

  // 2. 시간 넘김 → 자동 → 두 번이면 자리 비움 → 돌아오기
  {
    const { bots } = await room(['시간', '느림'], { players: 2, turnSec: 15, rounds: 0, timeMin: 0 });
    const [a, b] = bots;
    a.send({ t: 'start' });
    await a.wait(playing, 5000, 'start');
    const slow = a.game.turn === a.seat ? a : b, fast = slow === a ? b : a;
    fast.auto = true; fast.play(fast.last);
    const s0 = slow.game.seq;
    await slow.wait((m) => m.room.game.seq > s0 && m.room.game.last.some((e) => e.p === slow.seat), 8000, 'timeout auto');
    ok('시간이 지나면 컴퓨터가 대신 둠');
    await slow.wait((m) => m.room.seats[slow.seat].away, 30000, 'away');
    ok('두 번 넘기면 자리 비움');
    slow.send({ t: 'back' });
    await slow.wait((m) => !m.room.seats[slow.seat].away, 3000, 'back');
    ok('돌아오기');
    // 끊김 → 컴퓨터가 대신 → 같은 열쇠로 같은 자리
    const seat = slow.seat, pid = slow.pid;
    slow.close();
    await fast.wait((m) => m.room.seats[seat].online === false, 5000, 'offline');
    const s1 = fast.game.seq;
    await fast.wait((m) => m.room.game.seq > s1 + 3, 20000, 'continues');
    ok('끊긴 사람 차례도 이어 감');
    const back = await new Bot('느림', a.code, pid).connect();
    await back.wait((m) => m.seat === seat, 5000, 'same seat');
    assert.strictEqual(back.room.seats[seat].online, true); ok('다시 들어오면 같은 자리');
    // 게임 중 나가기 → 컴퓨터 → 새 사람이 그 자리
    back.send({ t: 'leave' });
    await fast.wait((m) => m.room.seats[seat].kind === 'bot', 5000, 'bot takes');
    ok('나가면 컴퓨터가 이어받음');
    const nb = await new Bot('새손님', a.code).connect();
    await nb.wait((m) => m.seat === seat && m.room.seats[seat].kind === 'human', 5000, 'new takes');
    assert.strictEqual(nb.game.players[seat].ai, null); assert.strictEqual(nb.game.players[seat].name, '새손님');
    ok('새로 온 사람이 그 자리를 받음');
    // 셋째 사람은 못 들어옴(2명 방이 꽉 참)
    const third = new Bot('셋째', a.code);
    await third.connect();
    await sleep(400);
    await until(() => third.errors.some((e) => e.fatal), 3000, 'full'); ok('꽉 찬 방은 거절');
    [fast, nb, third].forEach((x) => x.close());
  }

  // 3. 빠른 참가
  {
    const q1 = await post('/api/quick');
    const a = await new Bot('빠른1', q1.code).connect();
    await a.wait((m) => m.room.seats[0].kind === 'human', 5000, 'q1');
    const q2 = await post('/api/quick');
    assert.strictEqual(q2.code, q1.code); ok('빠른 참가는 기다리는 방으로');
    a.close();
  }

  // 4. 시간 제한 판 (FAST_TEST에선 20분 → 1분)
  if (!process.env.SKIP_TIME) {
    const { bots } = await room(['시계'], { players: 2, rounds: 0, timeMin: 20, turnSec: 0 });
    const [a] = bots;
    a.send({ t: 'start' });
    await a.wait(playing, 5000, 'start');
    a.auto = true; a.play(a.last);
    await a.wait((m) => m.room.game && m.room.game.lastRound, 90000, 'lastRound');
    ok('시간이 되면 마지막 바퀴');
    const e = await a.wait((m) => m.room.status === 'ended', 60000, 'time end');
    assert.ok(e.room.game.endWhy === 'time' || e.room.game.endWhy === 'last'); ok('그 바퀴가 끝나면 끝 (' + e.room.game.endWhy + ')');
    a.close();
  }

  assert.strictEqual(leaks, 0);
  ok('정보 노출 0건 (상태 ' + states + '번 확인)');
  console.log(`\n온라인 시험 ${passed}개 통과`);
}
main().then(() => process.exit(0), (e) => { console.error('✗', e.message); process.exit(1); });
