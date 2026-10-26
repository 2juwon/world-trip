// src/ui.html에 엔진·컴퓨터를 넣어 한 파일로 만듦 → index.html(Pages, 온라인 서버 주소 포함) · dist/world-trip.html(아티팩트, 컴퓨터와·한 기기로만)
const fs = require('fs');
const ui = fs.readFileSync(__dirname + '/src/ui.html', 'utf8');
const eng = fs.readFileSync(__dirname + '/src/engine.js', 'utf8');
const ai = fs.readFileSync(__dirname + '/src/ai.js', 'utf8');
const flags = fs.readFileSync(__dirname + '/src/flags.js', 'utf8');
const cfg = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
const server = process.env.SERVER != null ? process.env.SERVER : (cfg.server || '');
const core = ui.replace('/*FLAGS*/', () => flags).replace('/*ENGINE*/', () => eng).replace('/*AI*/', () => ai);
const out = core.replace("'__SERVER_URL__'", "''"); // 아티팩트는 다른 서버에 접속할 수 없음
const pagesOut = core.replace("'__SERVER_URL__'", JSON.stringify(server));
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/world-trip.html', out);
const m = pagesOut.match(/<title>[^<]*<\/title>\n?/);
const title = m ? m[0].trim() : '<title>한판 세계여행</title>';
const body = pagesOut.replace(/<title>[^<]*<\/title>\n?/, '').replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const desc = '주사위를 굴려 세계 도시를 사고 통행료를 주고받는 보드게임. 컴퓨터와, 한 기기로, 또는 각자 휴대폰으로 온라인에서';
const icon = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%2714%27 fill=%27%23fbfaf5%27 stroke=%27%23cf3239%27 stroke-width=%273%27 stroke-dasharray=%274 3%27/%3E%3Cpath d=%27M6 19l20-8-6 11-4-3-3 4v-5z%27 fill=%27%2323489a%27/%3E%3C/svg%3E";
const page = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n${title}\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="description" content="${desc}">\n<meta property="og:title" content="한판 세계여행">\n<meta property="og:description" content="${desc}">\n<meta property="og:url" content="https://2juwon.github.io/world-trip/">\n<meta property="og:type" content="website">\n<meta name="theme-color" content="#23489a">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="세계여행">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<link rel="icon" href="${icon}">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n</head>\n<body>\n${body}\n<script>if ('serviceWorker' in navigator) window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });</script>\n</body>\n</html>\n`;
fs.writeFileSync(__dirname + '/index.html', page);
console.log('built', out.length, 'bytes', server ? '(server ' + server + ')' : '');
