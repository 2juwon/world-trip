# 온라인 화면 시험: 로컬 서버(wrangler dev --var SPEED:0.5) + 브라우저 2개
#   SERVER=http://127.0.0.1:8787 node build.js && python3 test/online_browser.py index.html && node build.js
import sys, time, os
from playwright.sync_api import sync_playwright

FILE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
OUT = os.environ.get('OUT', '/tmp/claude-0/shots')
os.makedirs(OUT, exist_ok=True)
errs = []

AUTO = """() => {
  if (busy || MODE !== 'online' || !G) return;
  const b = (id) => document.getElementById(id);
  if (SHEET === 'props' || SHEET === 'tile' || SHEET === 'say') closeSheet();
  if (b('aBack')) { b('aBack').click(); return; }
  if (!myTurn() || NET.pending) return;
  if (G.phase === 'space') { if (SEL < 0) document.querySelector('.tile[data-i="0"]').click(); b('aFly') && b('aFly').click(); return; }
  if (G.phase === 'build') { const o = document.querySelector('[data-lv]:not([disabled])'); (o || b('aSkip')).click(); return; }
  for (const id of ['aRoll', 'aBuy', 'aVip', 'aAuto']) { const e = b(id); if (e && !e.disabled) { e.click(); return; } }
  const s = b('aSkip'); if (s) s.click();
}"""

def pump(pages, cond, limit):
    t0 = time.time()
    while time.time() - t0 < limit:
        if all(p.evaluate(cond) for p in pages):
            return True
        for p in pages:
            p.evaluate(AUTO)
        time.sleep(0.08)
    return False

with sync_playwright() as pw:
    br = pw.chromium.launch()
    A = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page()
    Bc = br.new_context(viewport={'width': 1280, 'height': 820}, color_scheme='dark')
    B = Bc.new_page()
    for p in (A, B):
        p.on('pageerror', lambda e: errs.append(str(e)))
        p.on('console', lambda m: m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'Failed to load resource' not in m.text and errs.append(m.text))
    A.goto('file://' + FILE); A.wait_for_timeout(500)
    A.click('#tOn'); A.fill('#oName', '주원'); A.click('#oCreate')
    A.wait_for_function("SHEET === 'lobby'", timeout=10000)
    code = A.evaluate('NET.code')
    print('방', code)
    A.click('#wN button:nth-child(2)')      # 3명
    A.wait_for_function("NET.room.settings.players === 3")
    A.click('#rLen button:nth-child(2)')    # 10바퀴
    A.wait_for_function("NET.room.settings.rounds === 10")
    A.click('#wT button:nth-child(1)')      # 시간 없음 (시험이 빨리 돌게)
    A.wait_for_function("NET.room.settings.turnSec === 0")
    # 초대 링크로 들어가기
    B.goto('file://' + FILE + '#' + code); B.wait_for_timeout(500)
    B.wait_for_selector('#oInvite')
    B.fill('#oName', '친구'); B.click('#oInvite')
    B.wait_for_function("SHEET === 'lobby'", timeout=10000)
    A.wait_for_function("NET.room.seats.filter(s => s.kind === 'human').length === 2", timeout=8000)
    locked = B.evaluate("[...document.querySelectorAll('#wN button')].every(b => b.disabled)")
    print('손님 설정 잠김:', locked)
    A.screenshot(path=OUT + '/on-01-lobby.png')
    A.click('#wStart')
    A.wait_for_function("NET.room.status === 'playing'", timeout=8000)
    B.wait_for_function("NET.room.status === 'playing' && G && G.players.length === 3", timeout=8000)
    print('시작: 사람', A.evaluate("G.players.filter(p => !p.ai).length"), '컴퓨터', A.evaluate("G.players.filter(p => p.ai).length"))
    # 한마디
    A.evaluate("NET.send({ t:'say', k:2 })")
    B.wait_for_function("NET.room.say && NET.room.say.k === 2", timeout=5000)
    B.wait_for_timeout(200)
    print('말풍선 보임:', B.evaluate("!!document.querySelector('.pp .say')"))
    # 몇 바퀴 → 새로고침 복귀
    for p in (A, B): p.evaluate('SPEED = 0.25')
    pump([A, B], "G && G.round >= 3", 400)
    A.screenshot(path=OUT + '/on-02-mid-phone.png'); B.screenshot(path=OUT + '/on-03-mid-desktop.png')
    seat = B.evaluate('NET.seat')
    B.reload(); B.wait_for_timeout(800)
    B.wait_for_function("MODE === 'online' && G && NET.room && NET.room.status === 'playing'", timeout=10000)
    print('새로고침 뒤 같은 자리:', B.evaluate('NET.seat') == seat)
    B.evaluate('SPEED = 0.25')
    ok = pump([A, B], "G && G.phase === 'over' && SHEET === 'over'", 900)
    A.wait_for_timeout(500)
    ra = A.evaluate("G.ranks.join(',') + ' ' + G.round + ' ' + G.endWhy")
    rb = B.evaluate("G.ranks.join(',') + ' ' + G.round + ' ' + G.endWhy")
    print('끝까지:', ok, ra, '| 두 화면 같음:', ra == rb)
    A.screenshot(path=OUT + '/on-04-over-phone.png'); B.screenshot(path=OUT + '/on-05-over-desktop.png')
    # 한 판 더
    A.click('#oAgain')
    B.wait_for_function("NET.room.status === 'playing' && NET.room.round === 2 && SHEET !== 'over'", timeout=8000)
    print('한 판 더: 됨')
    # 나가기 → 컴퓨터가 이어받음
    B.evaluate("leaveOnline()")
    A.wait_for_function(f"NET.room.seats[{seat}].kind === 'bot'", timeout=8000)
    print('나가면 컴퓨터가 이어받음: 됨')
    A.screenshot(path=OUT + '/on-06-after-leave.png')
    br.close()
print('오류', errs[:10])
