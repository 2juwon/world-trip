/* 로컬 서버(wrangler dev --var FAST_TEST:1)에서 '한꺼번에 팔기'가 서버를 거쳐 되는지 확인
 *   node test/sellmany.test.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AI = require('../../src/ai.js');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const { code } = await (await fetch(BASE + '/api/rooms', { method: 'POST', body: '{}' })).json();
const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws/${code}?pid=${crypto.randomUUID().replace(/-/g, '')}&name=t`);
let last = null, sent = null, acted = -1;
ws.onmessage = (e) => { if (e.data === 'pong') return; const m = JSON.parse(e.data); if (m.t === 'error') { console.log('err', m.message); return; } last = m; step(); };
await new Promise((r) => { ws.onopen = r; });
ws.send(JSON.stringify({ t: 'settings', settings: { turnSec: 0, players: 2 } }));
await new Promise((r) => setTimeout(r, 300));
ws.send(JSON.stringify({ t: 'start' }));
function step() {
  const r = last.room, g = r.game;
  if (!g || r.status !== 'playing') return;
  if (sent != null) {
    if (g.own[sent] === -1) { console.log('✓ 서버를 거쳐 한꺼번에 팔기 됨 (칸 ' + sent + ')'); process.exit(0); }
    return;
  }
  if (g.turn !== last.seat || acted === g.seq) return;
  acted = g.seq;
  const mine = g.own.map((o, i) => (o === last.seat ? i : -1)).filter((i) => i >= 0);
  if (g.phase === 'roll' && mine.length) { sent = mine[0]; ws.send(JSON.stringify({ t: 'act', seq: g.seq, a: { type: 'sellMany', steps: [sent] } })); return; }
  setTimeout(() => { ws.send(JSON.stringify({ t: 'act', seq: g.seq, a: AI.choose(g, 'normal') })); }, 10);
}
setTimeout(() => { console.log('✗ 시간 초과'); process.exit(1); }, 60000);
