// Minimal CDP driver: launch nothing, attach to an already-running headless
// Edge (--remote-debugging-port=9223), poll page state, print PPSSPP boot log.
// Usage: node scripts/ppsspp-cdp-test.mjs <url> <maxSeconds>
const url = process.argv[2] || 'http://localhost:4464/coi-test.html';
const maxSec = Number(process.argv[3] || 240);

const listResp = await fetch('http://127.0.0.1:9223/json/list');
const targets = await listResp.json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.error('no page target'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value ?? r.result?.result?.description ?? JSON.stringify(r.result);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable').catch(() => {});
const logs = [];
ws.onmessage2 = null;
// collect console + page errors
ws.addEventListener('message', (ev) => {
  try {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled') {
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      if (text) logs.push('[console.' + m.params.type + '] ' + String(text).slice(0, 300));
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + String(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 300));
    } else if (m.method === 'Log.entryAdded') {
      logs.push('[log.' + m.params.entry.level + '] ' + String(m.params.entry.text).slice(0, 300));
    }
  } catch { /* ignore */ }
});

await send('Page.navigate', { url });
const start = Date.now();
let lastState = '';
while ((Date.now() - start) / 1000 < maxSec) {
  await new Promise((r) => setTimeout(r, 5000));
  const st = await evalJs(`(() => {
    const lt = document.getElementById('loading-text');
    const ld = document.getElementById('loading');
    return JSON.stringify({
      hidden: ld ? ld.classList.contains('hide') : null,
      text: lt ? lt.textContent : document.title,
      canvasW: (document.getElementById('canvas')||{}).width || 0,
      coi: window.crossOriginIsolated,
      scriptLoaded: !!document.querySelector('script[src*="PPSSPPSDL"]'),
      moduleReady: !!(window.Module && window.Module.calledRun),
      ppssppLogs: (window.__ppsspplocal || []).slice(-8)
    });
  })()`);
  if (st !== lastState) {
    lastState = st;
    try {
      const p = JSON.parse(st);
      console.log(new Date().toISOString().slice(11, 19), JSON.stringify({ hidden: p.hidden, text: p.text, canvasW: p.canvasW, scriptLoaded: p.scriptLoaded, moduleReady: p.moduleReady }));
      for (const l of p.ppssppLogs || []) console.log('   [ppsspp]', String(l).slice(0, 200));
    } catch { console.log(new Date().toISOString().slice(11, 19), st); }
  }
  const parsed = JSON.parse(st);
  if (parsed.hidden === true) { console.log('BOOT OK — loading hidden'); break; }
  if (typeof parsed.text === 'string' && parsed.text.startsWith('启动失败')) { console.log('BOOT FAILED'); break; }
}
console.log('--- last 40 log lines ---');
for (const l of logs.slice(-40)) console.log(l);
process.exit(0);
