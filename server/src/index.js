/* 한판 세계여행 온라인 서버 (Cloudflare Workers + Durable Objects)
 * - Room: 방 하나 = 2~4명. 빈자리는 컴퓨터.
 *         주사위는 서버가 굴리고(암호 난수), 규칙 엔진(WT)으로 동작을 확인해 모두에게 같은 판을 보낸다.
 *         황금열쇠 더미 순서는 화면에 보내지 않는다(WT.viewFor).
 *         동작마다 제한 시간(끌 수 있음). 지나면 '야무진' 컴퓨터가 고른 수를 둠.
 *         두 번 연속이면 '자리 비움' → 컴퓨터가 대신. 끊기면 잠깐 기다렸다가 컴퓨터가 대신.
 *         게임 중 나가면 그 자리는 컴퓨터가 이어받고, 다른 사람이 들어와 그 자리를 받을 수 있다.
 *         시간 제한 판은 서버 시계로 재서 시간이 되면 '마지막 바퀴'를 알림.
 * - Lobby: 빠른 참가용 공개 방 목록 (하나뿐)
 */
import { DurableObject } from 'cloudflare:workers';
import W from '../../src/engine.js';
import AI from '../../src/ai.js';

const EMPTY_ROOM_MS = 30 * 60 * 1000;  // 아무도 없으면 30분 뒤 방 정리
const OPEN_ROOM_TTL = 10 * 60 * 1000;  // 빠른 참가에서 오래된 방은 제외
const OFF_GRACE_MS = 8000;             // 끊긴 사람 차례는 이만큼 기다렸다가 컴퓨터가 대신
const BOT_MS = 750;                    // 컴퓨터가 생각하는 척하는 시간(애니메이션 끝난 뒤)
const TURN_SECS = [0, 15, 20, 30, 60];
const SAYS = 8;
const BOTS = ['파랑새봇', '철새봇', '갈매기봇', '두루미봇'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
});
function rand32() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; }
const rnd = () => rand32() / 4294967296;
const randomCode = () => String(100000 + (rand32() % 900000));
const lobbyStub = (env) => env.LOBBY.get(env.LOBBY.idFromName('main'));
const roomStub = (env, code) => env.ROOM.get(env.ROOM.idFromName(code));

export function cleanName(s) {
  s = String(s || '').replace(/[\u0000-\u001f\u007f<>&"']/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, 8).join('') || '손님';
}
const emptySeat = () => ({ kind: 'empty', pid: null, name: '', offAt: 0, left: false });
const botName = (i) => BOTS[i];
const die = () => 1 + (rand32() % 6);

export const DEFAULT_SETTINGS = {
  players: 2, start: 2930, triple: true, buildOnBuy: false, rounds: 20, timeMin: 0,
  turnSec: 30, ai: 'normal', public: false,
};
export function cleanSettings(cur, s, minPlayers) {
  const out = { ...cur };
  if (!s || typeof s !== 'object') return out;
  if ([2, 3, 4].includes(s.players)) out.players = Math.max(s.players, minPlayers || 2);
  if ([2000, 2930, 5000].includes(s.start)) out.start = s.start;
  for (const k of ['triple', 'buildOnBuy', 'public']) if (typeof s[k] === 'boolean') out[k] = s[k];
  // 판 길이: 바퀴와 시간은 하나만
  if ([0, 10, 20, 30].includes(s.rounds) && [0, 20, 30, 45, 60].includes(s.timeMin)) { out.rounds = s.rounds; out.timeMin = s.rounds ? 0 : s.timeMin; }
  if (TURN_SECS.includes(s.turnSec)) out.turnSec = s.turnSec;
  if (['easy', 'normal'].includes(s.ai)) out.ai = s.ai;
  return out;
}
const cfgOf = (s) => ({ start: s.start, triple: s.triple, buildOnBuy: s.buildOnBuy, rounds: s.rounds, timeMin: s.timeMin });

// 화면 애니메이션이 끝날 때까지 걸리는 시간(대략) — 다음 동작은 이 뒤에
export function animMs(log) {
  let t = 0;
  for (const e of log || []) {
    switch (e.k) {
      case 'roll': t += 1000; break;
      case 'move': t += 150 + (Math.abs(e.n) >= 40 ? 40 * 28 : Math.abs(e.n) * 115); break;
      case 'key': t += 2100; break;
      case 'fly': t += 850; break;
      case 'warp': t += 650; break;
      case 'buy': case 'build': t += 700; break;
      case 'toll': case 'spacefee': t += 850; break;
      case 'bankrupt': t += 1150; break;
      case 'gift': t += 400; break;
      case 'skip': t += 280; break;
      case 'sell': case 'sellcard': case 'paid': t += 450; break;
      case 'turn': case 'salary': case 'over': break;
      default: t += 700;
    }
  }
  return t;
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.speed = env && env.FAST_TEST === '1' ? 0.05 : (env && +env.SPEED > 0 ? +env.SPEED : 1); // 로컬 시험에서만 시간을 줄임
    this.tspeed = env && env.FAST_TEST === '1' ? 0.005 : this.speed; // 시간 제한 판(분 단위)
    ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || null; });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async init(code, isPublic) {
    if (this.room) return false;
    this.room = {
      v: 1, code, created: Date.now(), hostPid: null,
      settings: { ...DEFAULT_SETTINGS, public: !!isPublic },
      seats: [emptySeat(), emptySeat(), emptySeat(), emptySeat()],
      status: 'waiting', game: null, round: 0, wins: [0, 0, 0, 0], result: null,
      away: [false, false, false, false], strikes: [0, 0, 0, 0],
      turnAt: 0, deadline: 0, pending: null, say: null,
    };
    await this.arm({ kind: 'cleanup', at: Date.now() + EMPTY_ROOM_MS });
    await this.save();
    return true;
  }
  async save() { if (this.room) await this.ctx.storage.put('room', this.room); }
  async arm(p) {
    if (!this.room) return;
    this.room.pending = p || null;
    const ta = p && p.kind === 'cleanup' ? 0 : this.timeAt();
    const at = p ? (ta ? Math.min(p.at, ta) : p.at) : ta;
    if (at) await this.ctx.storage.setAlarm(at);
    else await this.ctx.storage.deleteAlarm();
  }

  sockets() { return this.ctx.getWebSockets().filter((ws) => ws.readyState === 1); }
  pidOf(ws) { try { return (ws.deserializeAttachment() || {}).pid || null; } catch (e) { return null; } }
  connectedPids(except) {
    const set = new Set();
    for (const ws of this.sockets()) if (ws !== except) { const p = this.pidOf(ws); if (p) set.add(p); }
    return set;
  }
  seatOf(pid) { return pid && this.room ? this.room.seats.findIndex((s) => s.pid === pid) : -1; }
  humans() { return this.room.seats.filter((s) => s.kind === 'human').length; }
  pickHost(except) {
    const r = this.room, online = this.connectedPids();
    const h = r.seats.find((s) => s.kind === 'human' && s.pid !== except && online.has(s.pid))
      || r.seats.find((s) => s.kind === 'human' && s.pid !== except);
    r.hostPid = h ? h.pid : null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server);
    const pid = (url.searchParams.get('pid') || '').toLowerCase();
    const name = cleanName(url.searchParams.get('name'));
    server.serializeAttachment({ pid });
    const fail = (code, message) => {
      try { server.send(JSON.stringify({ t: 'error', fatal: true, code, message })); server.close(4000, code); } catch (e) { /* 이미 닫힘 */ }
      return new Response(null, { status: 101, webSocket: client });
    };
    if (!/^[a-f0-9]{16,64}$/.test(pid)) return fail('bad_player', '접속 정보가 올바르지 않아요. 새로고침해 주세요');
    if (!this.room) return fail('no_room', '없는 방이에요. 방 번호를 확인해 주세요');
    const res = this.join(pid, name);
    if (!res.ok) return fail(res.code, res.message);
    await this.afterChange({ lobby: true });
    return new Response(null, { status: 101, webSocket: client });
  }

  join(pid, name) {
    const r = this.room;
    let i = this.seatOf(pid);
    if (i >= 0) { // 다시 들어옴
      const s = r.seats[i];
      s.offAt = 0;
      if (r.status === 'waiting') s.name = this.uniqueName(name, i);
      if (!r.hostPid || this.seatOf(r.hostPid) < 0) r.hostPid = pid;
      return { ok: true, seat: i };
    }
    const n = r.settings.players;
    if (r.status === 'waiting') {
      i = r.seats.findIndex((s, k) => k < n && s.kind === 'empty');
      if (i < 0) return { ok: false, code: 'full', message: '방이 꽉 찼어요' };
    } else {
      // 게임 중이거나 끝난 방: 컴퓨터가 두는 자리를 이어받음
      const g = r.game, cnt = g ? g.players.length : n;
      i = r.seats.findIndex((s, k) => k < cnt && s.kind === 'bot' && (!g || !g.players[k].out));
      if (i < 0 && r.status === 'ended') i = r.seats.findIndex((s, k) => k < n && s.kind === 'empty');
      if (i < 0) return { ok: false, code: 'full', message: '빈자리가 없어요' };
    }
    r.seats[i] = { ...emptySeat(), kind: 'human', pid, name: this.uniqueName(name, i) };
    r.away[i] = false; r.strikes[i] = 0;
    if (r.game && i < r.game.players.length) { r.game.players[i].name = r.seats[i].name; r.game.players[i].ai = null; }
    if (!r.hostPid || this.seatOf(r.hostPid) < 0) r.hostPid = pid;
    return { ok: true, seat: i };
  }
  uniqueName(name, idx) {
    const used = this.room.seats.filter((s, k) => k !== idx && s.kind !== 'empty').map((s) => s.name);
    if (!used.includes(name)) return name;
    const base = Array.from(name).slice(0, 7).join('');
    for (let d = 2; d <= 9; d++) if (!used.includes(base + d)) return base + d;
    return base + '*';
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > 2000) return;
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    const r = this.room;
    if (!r || !msg || typeof msg.t !== 'string') return;
    const pid = this.pidOf(ws);
    const seat = this.seatOf(pid);
    if (seat < 0) return;
    const err = (message) => { try { ws.send(JSON.stringify({ t: 'error', message })); } catch (e) { /* 무시 */ } };
    try {
      switch (msg.t) {
        case 'act': {
          const g = r.game, a = msg.a;
          if (r.status !== 'playing' || !g) return err('지금은 할 수 없어요');
          if (g.turn !== seat) return err('내 차례가 아니에요');
          if ((msg.seq | 0) !== g.seq) return this.afterChange(); // 이미 지나간 화면에서 누름
          if (!a || typeof a.type !== 'string' || a.type === 'lastRound') return err('할 수 없는 동작이에요');
          const clean = { type: a.type };
          if (a.type === 'roll') clean.d = [die(), die()];
          if ('to' in a) clean.to = a.to | 0;
          if ('lv' in a) clean.lv = a.lv | 0;
          if ('t' in a) clean.t = a.t | 0;
          if ('use' in a) clean.use = !!a.use;
          if (!W.legal(g, clean)) { err('지금은 그렇게 할 수 없어요'); return this.afterChange(); }
          r.away[seat] = false; r.strikes[seat] = 0;
          return this.doAct(clean);
        }
        case 'back':
          r.away[seat] = false; r.strikes[seat] = 0;
          return this.afterChange();
        case 'say': {
          const k = msg.k | 0;
          if (k < 0 || k >= SAYS) return;
          const now = Date.now();
          if (r.say && r.say.seat === seat && now - r.say.at < 1500) return; // 너무 잦은 말 막기
          r.say = { seat, k, at: now };
          if (r.away[seat]) { r.away[seat] = false; r.strikes[seat] = 0; }
          return this.afterChange();
        }
        case 'start':
          if (r.hostPid !== pid) return err('방장만 시작할 수 있어요');
          if (r.status !== 'waiting') return;
          return this.newRound();
        case 'again':
          if (r.hostPid !== pid) return err('방장만 다시 시작할 수 있어요');
          if (r.status !== 'ended') return;
          return this.newRound();
        case 'settings': {
          if (r.hostPid !== pid || r.status !== 'waiting') return;
          r.settings = cleanSettings(r.settings, msg.settings, this.humans());
          this.compactSeats();
          return this.afterChange({ lobby: true });
        }
        case 'toWaiting':
          if (r.hostPid !== pid || r.status !== 'ended') return;
          this.toWaiting();
          return this.afterChange({ lobby: true });
        case 'leave':
          return this.leave(pid);
        case 'hello':
          return this.afterChange();
      }
    } catch (e) {
      console.error('message', e);
      err('서버에서 처리하지 못했어요');
    }
  }

  // 편 수를 줄였을 때 사람을 앞자리로 모음
  compactSeats() {
    const r = this.room, n = r.settings.players;
    const people = r.seats.filter((s) => s.kind === 'human');
    r.seats = [0, 1, 2, 3].map((k) => people[k] || emptySeat());
    if (people.length > n) r.settings.players = Math.min(4, people.length);
  }
  toWaiting() {
    const r = this.room;
    r.status = 'waiting'; r.game = null; r.result = null;
    r.seats = r.seats.map((s) => (s.kind === 'human' ? s : emptySeat()));
    this.compactSeats();
  }

  async webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch (e) { /* 이미 닫힘 */ }
    await this.dropped(ws);
  }
  async webSocketError(ws) { await this.dropped(ws); }

  async dropped(ws) {
    const r = this.room;
    if (!r) return;
    const pid = this.pidOf(ws);
    const i = this.seatOf(pid);
    if (i < 0) return;
    const online = this.connectedPids(ws);
    if (!online.has(pid)) {
      if (r.status === 'waiting') { r.seats[i] = emptySeat(); this.compactSeats(); }
      else r.seats[i].offAt = Date.now(); // 게임 중·끝난 뒤에는 자리를 남겨 두고 기다림
      if (r.hostPid === pid) {
        const h = r.seats.find((s) => s.kind === 'human' && online.has(s.pid));
        r.hostPid = h ? h.pid : (this.seatOf(pid) >= 0 ? pid : null);
      }
    }
    await this.afterChange({ lobby: true, except: ws });
  }

  async leave(pid) {
    const r = this.room;
    const i = this.seatOf(pid);
    if (i >= 0) {
      if (r.status === 'playing' && r.game && i < r.game.players.length) {
        // 컴퓨터가 이어받음
        r.seats[i] = { ...emptySeat(), kind: 'bot', name: r.seats[i].name, left: true };
        r.game.players[i].ai = r.settings.ai;
        r.away[i] = false; r.strikes[i] = 0;
      } else {
        r.seats[i] = emptySeat();
        if (r.status === 'waiting') this.compactSeats();
      }
      if (r.hostPid === pid) this.pickHost(pid);
    }
    for (const w of this.ctx.getWebSockets()) if (this.pidOf(w) === pid) { try { w.close(1000, 'left'); } catch (e) { /* 무시 */ } }
    await this.afterChange({ lobby: true });
  }

  async newRound() {
    const r = this.room, s = r.settings, n = s.players;
    const players = [];
    for (let i = 0; i < 4; i++) {
      const seat = r.seats[i];
      if (i >= n) { if (seat.kind === 'bot') r.seats[i] = emptySeat(); continue; }
      if (seat.kind !== 'human') r.seats[i] = { ...emptySeat(), kind: 'bot', name: botName(i) };
      const st = r.seats[i];
      players.push({ name: st.name, color: i, ai: st.kind === 'bot' ? s.ai : null });
    }
    r.game = W.newGame(players, cfgOf(s), rand32() % n, rand32(), Date.now());
    r.status = 'playing'; r.result = null; r.round += 1;
    r.away = [false, false, false, false]; r.strikes = [0, 0, 0, 0];
    r.turnAt = Date.now(); r.say = null;
    if (r.round === 1 || r.wins.length !== 4) r.wins = [0, 0, 0, 0];
    await this.afterChange({ lobby: true });
  }

  /* ── 한 동작 ── */
  async doAct(a) {
    const r = this.room;
    const ng = W.apply(r.game, a);
    if (ng === r.game) { console.error('illegal', JSON.stringify(a), r.game.phase); return this.afterChange(); }
    r.game = ng;
    return this.afterAction();
  }
  async autoAct(level) {
    const g = this.room.game;
    let a = AI.choose(g, level, rnd);
    if (!a) { console.error('no move', g.phase); return this.afterChange(); }
    if (a.type === 'roll') a = { type: 'roll', d: [die(), die()] };
    return this.doAct(a);
  }
  async afterAction() {
    const r = this.room, g = r.game;
    r.turnAt = Date.now();
    if (g.phase === 'over') {
      r.status = 'ended';
      r.result = { winner: g.winner, round: r.round };
      r.wins[g.winner] = (r.wins[g.winner] || 0) + 1;
      return this.afterChange({ lobby: true });
    }
    return this.afterChange();
  }
  timeAt() { // 시간 제한 판: 마지막 바퀴 알릴 시각
    const r = this.room, g = r.game;
    if (!g || r.status !== 'playing' || !g.cfg.timeMin || g.lastRound) return 0;
    return g.t0 + g.cfg.timeMin * 60000 * this.tspeed;
  }

  /* ── 다음에 할 일 예약 ── */
  async schedule(online) {
    const r = this.room;
    if (!r) return;
    const now = Date.now();
    r.deadline = 0;
    r.seats.forEach((s) => {
      if (s.kind !== 'human') return;
      if (online.has(s.pid)) s.offAt = 0; else if (!s.offAt) s.offAt = now;
    });
    const anyone = r.seats.some((s) => s.kind === 'human' && online.has(s.pid));
    if (!anyone) return this.arm({ kind: 'cleanup', at: now + EMPTY_ROOM_MS });
    if (r.status !== 'playing' || !r.game) return this.arm(null);
    const g = r.game, t = g.turn, s = r.seats[t], step = r.round + ':' + g.seq;
    const base = r.turnAt + animMs(g.last) * this.speed;
    if (g.phase === 'over') return this.arm(null);
    const offline = s.kind === 'human' && !online.has(s.pid);
    if (s.kind !== 'human' || r.away[t] || offline) {
      let at = base + BOT_MS * this.speed;
      if (offline && !r.away[t]) at = Math.max(at, s.offAt + OFF_GRACE_MS * this.speed);
      return this.arm({ kind: 'bot', step, at });
    }
    if (r.settings.turnSec > 0) {
      const at = base + r.settings.turnSec * 1000 * this.speed;
      r.deadline = at;
      return this.arm({ kind: 'timeout', step, at, seat: t });
    }
    return this.arm(null);
  }

  async alarm() {
    const r = this.room;
    if (!r) return;
    if (!r.pending) { if (this.timeAt()) { r.pending = { kind: 'none', at: 0 }; } else return; }
    const p = r.pending;
    try {
      if (p.kind === 'cleanup') {
        if (this.connectedPids().size) { await this.afterChange(); return; }
        await this.removeFromLobby();
        await this.ctx.storage.deleteAlarm();
        await this.ctx.storage.deleteAll();
        this.room = null;
        return;
      }
      const ta = this.timeAt();
      if (ta && Date.now() >= ta - 50) {
        r.game = W.apply(r.game, { type: 'lastRound' });
        r.turnAt = Math.max(r.turnAt, Date.now() - 1); // 진행 중 애니메이션은 그대로 기다림
        await this.afterChange();
        return;
      }
      const g = r.game;
      if (!g || r.status !== 'playing' || r.round + ':' + g.seq !== p.step) { r.pending = null; await this.afterChange(); return; }
      if (Date.now() < p.at - 50) { await this.afterChange(); return; }
      r.pending = null;
      const s = r.seats[g.turn];
      if (p.kind === 'none' || Date.now() < p.at - 50) { await this.afterChange(); return; }
      if (p.kind === 'timeout') {
        r.strikes[p.seat] = (r.strikes[p.seat] || 0) + 1;
        if (r.strikes[p.seat] >= 2) r.away[p.seat] = true;
        return this.autoAct('normal');
      }
      if (p.kind === 'bot') return this.autoAct(s.kind === 'bot' ? r.settings.ai : 'normal');
    } catch (e) {
      console.error('alarm', e);
      r.pending = null;
      await this.afterChange();
    }
  }

  async afterChange(opt = {}) {
    if (!this.room) return;
    const online = this.connectedPids(opt.except);
    await this.schedule(online);
    await this.save();
    this.broadcast(online);
    if (opt.lobby) await this.notifyLobby(online);
  }

  view(online) {
    const r = this.room;
    return {
      code: r.code, status: r.status, settings: r.settings, host: this.seatOf(r.hostPid),
      seats: r.seats.map((s, i) => ({ kind: s.kind, name: s.name, online: s.kind === 'human' && online.has(s.pid), away: !!r.away[i], left: !!s.left })),
      round: r.round, wins: r.wins, result: r.result, deadline: r.deadline || 0, turnSec: r.settings.turnSec,
      say: r.say, game: r.game ? W.viewFor(r.game) : null,
    };
  }
  broadcast(online) {
    if (!this.room) return;
    const room = this.view(online);
    const now = Date.now();
    for (const ws of this.sockets()) {
      const seat = this.seatOf(this.pidOf(ws));
      try { ws.send(JSON.stringify({ t: 'state', now, seat, room })); } catch (e) { /* 끊긴 소켓 */ }
    }
  }

  async notifyLobby(online) {
    const r = this.room;
    if (!r) return;
    online = online || this.connectedPids();
    const humans = r.seats.filter((s) => s.kind === 'human' && online.has(s.pid)).length;
    try { await lobbyStub(this.env).update({ code: r.code, public: r.settings.public, status: r.status, humans, max: r.settings.players }); }
    catch (e) { console.error('lobby', e); }
  }
  async removeFromLobby() { try { await lobbyStub(this.env).remove(this.room.code); } catch (e) { /* 무시 */ } }
}

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rooms = {};
    ctx.blockConcurrencyWhile(async () => { this.rooms = (await ctx.storage.get('rooms')) || {}; });
  }
  async save() { await this.ctx.storage.put('rooms', this.rooms); }
  prune() {
    const now = Date.now();
    for (const [c, r] of Object.entries(this.rooms)) if (now - r.updated > 2 * 60 * 60 * 1000) delete this.rooms[c];
  }
  async update(info) {
    if (!info || !info.code) return;
    const cur = this.rooms[info.code];
    if (!info.public) { if (cur) { delete this.rooms[info.code]; await this.save(); } return; }
    this.rooms[info.code] = { ...cur, ...info, created: cur ? cur.created : Date.now(), updated: Date.now() };
    this.prune();
    await this.save();
  }
  async remove(code) { if (this.rooms[code]) { delete this.rooms[code]; await this.save(); } }
  open() {
    const now = Date.now();
    return Object.values(this.rooms).filter((r) => r.public && r.status === 'waiting' && r.humans < r.max && now - r.updated < OPEN_ROOM_TTL);
  }
  // 사람이 기다리는 공개 방 → 막 만든 빈 공개 방 → 새로 만들기
  async quick() {
    const open = this.open().sort((a, b) => b.humans - a.humans || a.created - b.created);
    if (open.length) { open[0].updated = Date.now(); open[0].humans++; await this.save(); return { code: open[0].code }; }
    for (let k = 0; k < 6; k++) {
      const code = randomCode();
      if (await roomStub(this.env, code).init(code, true)) {
        const now = Date.now();
        this.rooms[code] = { code, public: true, status: 'waiting', humans: 0, max: 2, created: now, updated: now };
        await this.save();
        return { code };
      }
    }
    throw new Error('방을 만들지 못했어요');
  }
  async stats() {
    const now = Date.now();
    const open = this.open();
    const playing = Object.values(this.rooms).filter((r) => r.public && r.status === 'playing' && now - r.updated < 60 * 60 * 1000).length;
    return { waitingRooms: open.filter((r) => r.humans > 0).length, waitingPlayers: open.reduce((n, r) => n + r.humans, 0), playingRooms: playing };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname === '/api/quick' && request.method === 'POST') return json(await lobbyStub(env).quick());
      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        let body = {};
        try { body = await request.json(); } catch (e) { /* 빈 본문 */ }
        const isPublic = !!(body && body.public);
        for (let k = 0; k < 6; k++) {
          const code = randomCode();
          if (await roomStub(env, code).init(code, isPublic)) {
            if (isPublic) await lobbyStub(env).update({ code, public: true, status: 'waiting', humans: 0, max: 2 });
            return json({ code });
          }
        }
        return json({ error: '방을 만들지 못했어요' }, 500);
      }
      if (url.pathname === '/api/stats') return json(await lobbyStub(env).stats());
      const m = url.pathname.match(/^\/ws\/(\d{6})$/);
      if (m) {
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426, headers: CORS });
        return roomStub(env, m[1]).fetch(request);
      }
      if (url.pathname === '/') return new Response('세계여행 서버가 돌고 있어요', { headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS } });
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: '서버 오류가 났어요' }, 500);
    }
  },
};
