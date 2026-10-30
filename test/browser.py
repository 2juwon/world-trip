# 브라우저 자동 플레이: python3 test/browser.py [파일] — 컴퓨터와 한 판(10바퀴) 끝까지 + 한 기기로 잠깐 + 새로고침 이어서
import sys, time, os
from playwright.sync_api import sync_playwright

FILE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/world-trip.html')
OUT = os.environ.get('OUT', '/tmp/claude-0/shots')
os.makedirs(OUT, exist_ok=True)
errs = []

def play_until(page, cond, limit=600):
    t0 = time.time()
    while time.time() - t0 < limit:
        if page.evaluate(cond):
            return True
        page.evaluate("""() => {
          if (busy) return;
          const b = (id) => document.getElementById(id);
          if (SHEET === 'props' || SHEET === 'tile') closeSheet();
          if (!myTurn()) return;
          if (G.phase === 'space') {
            if (SEL < 0) { const t = document.querySelector('.tile[data-i="39"]'); t.click(); }
            (b('aFly') || b('aRoll')).click(); return;
          }
          if (G.phase === 'startPick' || G.phase === 'festival') { const c = document.querySelector('.tile.cando'); if (c && SEL < 0) c.click(); const k = b(G.phase === 'startPick' ? 'aPick' : 'aFest'); if (k && !k.disabled) k.click(); else b('aSkip').click(); return; }
          if (G.phase === 'auction') { const d = b('dBid'); if (d) { (Math.random() < .5 ? d : b('dPass')).click(); } else { const o = b('aOpen'); o && o.click(); } return; }
          if (G.phase === 'trade') { const y = b(Math.random() < .5 ? 'dYes' : 'dNo'); if (y) y.click(); else { const o = b('aOpen'); o && o.click(); } return; }
          if (G.phase === 'roll' && G.cfg.trade && !G.offered && Math.random() < .15 && b('aTrade')) { b('aTrade').click(); const tk = document.querySelector('.mc.th'); if (tk) tk.click(); const go = b('trGo'); if (go && !go.disabled) go.click(); else closeSheet(); return; }
          if (G.phase === 'build') { const o = document.querySelector('#decide .bopt:not([disabled])'); if (o && !DEC.sel) o.click(); const bb = b('dBuild'); (bb && !bb.disabled ? bb : b('dSkip')).click(); return; }
          if (G.phase === 'buy') { const e = b('dBuy'); if (e) { e.click(); return; } }
  if (G.phase === 'pay') { if (!SELL) { const e = b('aSell'); if (e) e.click(); } else { const au = b('sAuto'); if (au) au.click(); const go = b('sGo'); if (go && !go.disabled) go.click(); else b('sCancel').click(); } return; }
  for (const id of ['aRoll', 'aVip']) { const e = b(id); if (e && !e.disabled) { e.click(); return; } }
          const s = b('dSkip'); if (s) s.click();
        }""")
        time.sleep(0.05)
    return False

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('file://' + FILE)
    page.wait_for_timeout(500)
    page.screenshot(path=OUT + '/01-setup.png')
    # 컴퓨터와 3명, 10바퀴
    page.click('#tCpu'); page.fill('#cName', '주원')
    page.click('#cN button:nth-child(3)')
    page.click('#rLen button:nth-child(2)')
    page.click('#sGo')
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/02-start.png')
    page.evaluate('SPEED = 0.03')
    ok = play_until(page, "G && G.round >= 4", 300)
    page.evaluate('SPEED = 1')
    page.wait_for_timeout(200)
    page.screenshot(path=OUT + '/03-mid.png')
    # 내 땅 시트
    page.evaluate("propsSheet()"); page.wait_for_timeout(200); page.screenshot(path=OUT + '/04-props.png'); page.evaluate('closeSheet()')
    page.evaluate("tileSheet(37)"); page.wait_for_timeout(200); page.screenshot(path=OUT + '/05-tile.png'); page.evaluate('closeSheet()')
    # 새로고침 → 이어서
    before = page.evaluate("JSON.stringify([G.seq, G.round])")
    page.wait_for_timeout(300)
    page.reload(); page.wait_for_timeout(600)
    print('켰을 때 이어 하기 묻기:', page.evaluate("SHEET === 'resume' && HOLD"))
    page.screenshot(path=OUT + '/05b-resume.png')
    page.click('#rsGo'); page.wait_for_timeout(200)
    after = page.evaluate("JSON.stringify([G.seq, G.round])")
    print('새로고침', before, '→', after, '(같아야 함)' if before == after else '(달라짐! 진행 중일 수 있음)')
    page.evaluate('SPEED = 0.03')
    ok2 = play_until(page, "G && G.phase === 'over'", 600)
    page.wait_for_timeout(1500)
    page.screenshot(path=OUT + '/06-over.png')
    print('컴퓨터와 끝까지:', ok and ok2, page.evaluate("[G.round, G.endWhy, G.ranks.join(',')].join(' ')"))
    # 한 기기로 2명 사람 + 1 컴퓨터 → 몇 바퀴
    page.evaluate("closeSheet(); setupSheet('local')")
    page.click('#tLocal'); page.click('#lN button:nth-child(2)')
    page.select_option('#lWho1', 'human'); page.select_option('#lWho2', 'easy')
    page.click('#rLen button:nth-child(1)'); page.click('#rMode button:nth-child(2)')
    page.click('#sGo')
    page.evaluate('SPEED = 0.03')
    ok3 = play_until(page, "G && G.round >= 6", 300)
    print('한 기기로(짜릿한 판) 6바퀴:', ok3, page.evaluate('G.cfg.auction'))
    page.evaluate('SPEED = 1')
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/07-local.png')
    # 넓은 화면 어두운
    ctx2 = br.new_context(viewport={'width': 1280, 'height': 820}, color_scheme='dark')
    pg2 = ctx2.new_page()
    pg2.on('pageerror', lambda e: errs.append(str(e)))
    pg2.goto('file://' + FILE); pg2.wait_for_timeout(400)
    pg2.click('#tCpu'); pg2.click('#cN button:nth-child(3)'); pg2.click('#sGo')
    pg2.evaluate('SPEED = 0.03')
    play_until(pg2, "G && G.round >= 8", 300)
    pg2.evaluate('SPEED = 1'); pg2.wait_for_timeout(300)
    pg2.screenshot(path=OUT + '/08-desktop-dark.png')
    # 짜릿한 판: 컴퓨터 2명과 10바퀴 끝까지 (경매·거래·축제·출발지 보너스 버튼을 눌러 가며)
    ctx3 = br.new_context(viewport={'width': 390, 'height': 844})
    pg3 = ctx3.new_page()
    pg3.on('pageerror', lambda e: errs.append(str(e)))
    pg3.goto('file://' + FILE); pg3.wait_for_timeout(400)
    pg3.click('#tCpu'); pg3.click('#cN button:nth-child(2)'); pg3.click('#rMode button:nth-child(2)'); pg3.click('#rLen button:nth-child(2)'); pg3.click('#sGo')
    pg3.evaluate('SPEED = 0.03')
    ok4 = play_until(pg3, "G && G.phase === 'over'", 600)
    print('짜릿한 판 끝까지:', ok4, pg3.evaluate("[G.round, G.endWhy, JSON.stringify(G.cfg)].join(' ')"), pg3.evaluate("LOG.filter(l => /경매|거래|축제|보너스|세트/.test(l)).length"), '건 (모드 사건 기록)')
    for pg in (page, pg2, pg3):
        w = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
        print('가로 넘침', w)
    br.close()
print('오류', errs[:10])
