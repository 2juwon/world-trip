/* 로컬 서버(wrangler dev --var FAST_TEST:1)에서 판 모드(경매·거래·축제·세트·독점)와 출발지 보너스가 서버를 거쳐 끝까지 도는지
 *   node test/modes.test.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const W = require('../../src/engine.js');
const AI = require('../../src/ai.js');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const { code } = await (await fetch(BASE + '/api/rooms', { method: 'POST', body: '{}' })).json();
const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws/${code}?pid=${crypto.randomUUID().replace(/-/g, '')}&name=t`);
let last = null, acted = '', errs = 0;
const seen = {};
ws.onmessage = (e) => { if (e.data === 'pong') return; const m = JSON.parse(e.data); if (m.t === 'error') { errs++; console.log('err', m.message); return; } last = m; step(); };
await new Promise((r) => { ws.onopen = r; });
ws.send(JSON.stringify({ t: 'settings', settings: { turnSec: 0, players: 3, rounds: 20, timeMin: 0, salary: 300, setBonus: true, monoWin: true, festival: true, auction: true, trade: true } }));
await new Promise((r) => setTimeout(r, 300));
ws.send(JSON.stringify({ t: 'start' }));
let lastSeq = -1;
function step() {
  const r = last.room, g = r.game;
  if (!g) return;
  if (g.seq !== lastSeq) { lastSeq = g.seq; (g.last || []).forEach((e) => { seen[e.k] = (seen[e.k] || 0) + 1; }); }
  if (g.phase === 'over' || r.status === 'ended') {
    console.log('끝:', g.endWhy, g.round + '바퀴', '본 사건:', JSON.stringify(['auctionstart', 'bid', 'auction', 'offer', 'trade', 'reject', 'festival', 'pick', 'set', 'mono'].map((k) => k + ' ' + (seen[k] || 0)).join(', ')));
    const okCfg = g.cfg.salary === 300 && g.cfg.auction && g.cfg.trade && g.cfg.festival && g.cfg.setBonus && g.cfg.monoWin && g.cfg.startPick;
    console.log(okCfg && errs === 0 ? '✓ 판 모드가 서버를 거쳐 끝까지 돎' : '✗ 문제 있음 cfg=' + okCfg + ' errs=' + errs);
    process.exit(okCfg && errs === 0 ? 0 : 1);
  }
  const key = g.seq + ':' + g.phase;
  if (W.actor(g) !== last.seat || acted === key) return;
  acted = key;
  let a = AI.choose(g, 'normal');
  setTimeout(() => { ws.send(JSON.stringify({ t: 'act', seq: g.seq, a })); }, 5);
}
setTimeout(() => { console.log('✗ 시간 초과', JSON.stringify(seen)); process.exit(1); }, 240000);
