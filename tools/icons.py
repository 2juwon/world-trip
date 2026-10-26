# 앱 아이콘 만들기: python3 tools/icons.py <world-trip 폴더> <대문 폴더>
# 마스커블(가장자리가 잘려도 되는) 아이콘이라 배경을 끝까지 칠하고 그림은 가운데 70% 안에 둠
import sys, os
from playwright.sync_api import sync_playwright
wt, home = sys.argv[1], sys.argv[2]

WORLD = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#23489a"/>
<circle cx="256" cy="256" r="232" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="2" stroke-dasharray="10 12"/>
<circle cx="250" cy="262" r="132" fill="#fbfaf5"/>
<g fill="none" stroke="#9db5e4" stroke-width="7">
<ellipse cx="250" cy="262" rx="58" ry="132"/><path d="M118 262h264M134 200h232M134 324h232M250 130v264"/>
</g>
<path d="M190 214c22-14 46-12 60 4 10 12 2 26-14 28-20 2-26 18-40 18-18 0-26-30-6-50z" fill="#3fb36b"/>
<path d="M276 300c18-8 42-4 50 12 6 14-8 30-24 30-20 0-40-28-26-42z" fill="#3fb36b"/>
<circle cx="250" cy="262" r="132" fill="none" stroke="#fff" stroke-width="10"/>
<g transform="translate(330 150) rotate(-28)">
<path d="M-12 -2l-40 -56h28l56 56z" fill="#a8242b" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
<path d="M-86 0l-16 -36h22l22 34z" fill="#a8242b" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
<path d="M-96 6c0-12 12-20 32-20h104c22 0 40 10 40 20s-18 20-40 20H-64c-20 0-32-8-32-20z" fill="#cf3239" stroke="#fff" stroke-width="6"/>
<path d="M-24 12l-38 64h30l66-64z" fill="#cf3239" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
<path d="M50 -10c12 2 22 8 24 14h-24z" fill="#cfe3ff"/>
<circle cx="-30" cy="4" r="5" fill="#fff"/><circle cx="-8" cy="4" r="5" fill="#fff"/><circle cx="14" cy="4" r="5" fill="#fff"/>
</g>
<path d="M120 420c60 30 150 34 230 -6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 22"/>
</svg>'''

HOME = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#2F5BEA"/>
<g fill="#fff" fill-opacity=".9">''' + ''.join(
  f'<circle cx="{x}" cy="{y}" r="11"/>' for r, y in enumerate(range(150, 371, 55)) for x in (range(146, 380, 74) if r % 2 == 0 else range(183, 340, 74))
) + '''</g>
<path d="M120 420h272" stroke="#fff" stroke-opacity=".55" stroke-width="14" stroke-linecap="round"/>
<path d="M140 420v-26M196 420v-26M256 420v-26M316 420v-26M372 420v-26" stroke="#fff" stroke-opacity=".55" stroke-width="10" stroke-linecap="round"/>
<circle cx="292" cy="236" r="46" fill="#F2B705"/>
<circle cx="276" cy="220" r="14" fill="#fff" fill-opacity=".7"/>
<path d="M252 120c-6 30 6 54 24 70" fill="none" stroke="#F2B705" stroke-opacity=".6" stroke-width="10" stroke-linecap="round" stroke-dasharray="4 18"/>
<circle cx="190" cy="304" r="20" fill="#E8483B"/><circle cx="352" cy="330" r="16" fill="#1A9E75"/>
</svg>'''

def render(svg, size, path):
    pg.set_viewport_size({'width': size, 'height': size})
    pg.set_content(f'<html><body style="margin:0">{svg.replace("<svg ", f"<svg width=\"{size}\" height=\"{size}\" ", 1)}</body></html>')
    pg.screenshot(path=path, clip={'x': 0, 'y': 0, 'width': size, 'height': size}, omit_background=False)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for size in (192, 512): render(WORLD, size, f'{wt}/icon-{size}.png')
    render(WORLD, 180, f'{wt}/apple-touch-icon.png')
    for size in (192, 512): render(HOME, size, f'{home}/icon-{size}.png')
    render(HOME, 180, f'{home}/apple-touch-icon.png')
    b.close()
print('ok')
