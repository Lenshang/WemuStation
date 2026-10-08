// Send key events to the running PPSSPP page via CDP.
const keys = process.argv[2] || 'KeyX';
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
for (const k of keys.split(',')) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: k, key: k.replace('Key', ''), windowsVirtualKeyCode: 0 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: k, key: k.replace('Key', ''), windowsVirtualKeyCode: 0 });
  await new Promise((r) => setTimeout(r, 400));
}
console.log('sent', keys);
process.exit(0);
