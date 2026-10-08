// Capture a screenshot of the running PPSSPP page via CDP.
const listResp = await fetch('http://127.0.0.1:9223/json/list');
const targets = await listResp.json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('ppsspp-player'));
if (!page) { console.error('no ppsspp page target'); process.exit(1); }
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
  return new Promise((resolve) => { pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
}
const r = await send('Page.captureScreenshot', { format: 'png' });
if (r.result?.data) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.argv[2] || '/tmp/ppsspp-shot.png', Buffer.from(r.result.data, 'base64'));
  console.log('saved', process.argv[2] || '/tmp/ppsspp-shot.png');
} else { console.error('capture failed', JSON.stringify(r).slice(0, 300)); }
process.exit(0);
