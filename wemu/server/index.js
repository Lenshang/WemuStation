// WemuStation server: static hosting + library API. Zero npm dependencies
// (runtime); node-forge is only used by scripts/gen-cert.js for HTTPS certs.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { SYSTEMS, getSystem } from './lib/systems.js';
import { scanSystem } from './lib/library.js';
import { putBlob, getBlob, listBlobs, deleteBlob, getMeta, setMeta } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4464);
const DIST = path.join(ROOT, 'dist');            // vite build output (production)
const THEMES = path.join(ROOT, 'themes');
const EMU_DATA = path.join(ROOT, 'emulator');   // /emulatorjs/data/* → emulator/data/*
const RETROARCH = path.join(ROOT, 'retroarch'); // /retroarch/* → retroarch/* (wasm builds)
const CONFIG_FILE = path.join(ROOT, 'server', 'config.json');

const config = {
  theme: 'slate-es-de',
  variant: 'withoutVideos',
  player: 'retroarch', // 'retroarch' (full RA menu: shaders/overlays) or 'emulatorjs'
  ...(fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {})
};

// ROM_DIR may carry stray quotes from Windows `set X="..."` in .bat files
const romDirEnv = (process.env.ROM_DIR || '').replace(/^"+|"+$/g, '').trim();
const ROMS = path.resolve(romDirEnv || config.romDir || path.join(ROOT, 'roms'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.xml': 'text/xml; charset=utf-8',
  '.zip': 'application/zip',
  '.7z': 'application/x-7z-compressed',
  '.nes': 'application/octet-stream',
  '.sfc': 'application/octet-stream',
  '.smc': 'application/octet-stream',
  '.md': 'application/octet-stream',
  '.gen': 'application/octet-stream',
  '.smd': 'application/octet-stream',
  '.pce': 'application/octet-stream',
  '.gba': 'application/octet-stream',
  '.gb': 'application/octet-stream',
  '.gbc': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.cue': 'text/plain; charset=utf-8',
  '.chd': 'application/octet-stream',
  '.pbp': 'application/octet-stream',
  '.iso': 'application/octet-stream'
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function serveFile(res, filePath, cache = 'no-cache') {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  let stream;
  try {
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': cache,
      'Accept-Ranges': 'none'
    });
    stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', () => res.destroy());
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

function serveDir(res, baseDir, relPath, cache) {
  const target = path.normalize(path.join(baseDir, decodeURIComponent(relPath)));
  if (!target.startsWith(baseDir)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  let stat;
  try { stat = fs.statSync(target); } catch { 
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return;
  }
  if (stat.isDirectory()) return serveFile(res, path.join(target, 'index.html'), cache);
  serveFile(res, target, cache);
}

// BIOS 回退：/roms/bios/ 里没有的 BIOS 文件，在 ROMS 树内搜索同名文件
// （部分整合包把 pgm.zip 等 BIOS 放在游戏目录里）。索引一次建好并缓存。
const biosFallback = { built: false, files: new Map() };
function buildBiosFallbackIndex(root, depth) {
  if (depth > 3) return;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(root, e.name);
    if (e.isDirectory()) buildBiosFallbackIndex(full, depth + 1);
    else biosFallback.files.set(e.name.toLowerCase(), full); // 后扫到的覆盖（多目录同名 BIOS 取最新遍历到的）
  }
}
// 7z 程序定位（Windows 常见安装路径 → PATH）
const SEVENZIP_CANDIDATES = [
  process.env.SEVENZIP_PATH,
  'C:/Program Files/7-Zip/7z.exe',
  'C:/Program Files (x86)/7-Zip/7z.exe',
  '7z'
].filter(Boolean);
let sevenZipBin = SEVENZIP_CANDIDATES.find((c) => { try { fs.accessSync(c); return true; } catch { return false; } }) || null;

function largestFileIn(dir) {
  let best = null, bestSize = -1;
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    let st;
    try { st = fs.statSync(fp); } catch { continue; }
    if (st.isFile() && st.size > bestSize) { best = fp; bestSize = st.size; }
  }
  return best;
}

function serveBiosWithFallback(res, rel) {
  const decoded = decodeURIComponent(rel);
  const biosRoot = path.join(ROMS, 'bios');
  const direct = path.normalize(path.join(biosRoot, decoded));
  if (direct.startsWith(biosRoot) && fs.existsSync(direct)) return serveFile(res, direct, 'no-cache');
  if (!biosFallback.built) { buildBiosFallbackIndex(ROMS, 0); biosFallback.built = true; }
  const hit = biosFallback.files.get(decoded.toLowerCase());
  if (hit) {
    console.log('[bios-fallback]', decoded, '->', hit);
    return serveFile(res, hit, 'no-cache');
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

// FBN 系统的 .zip 街机 ROM：旧 FBA 集组缺 PGM BIOS（pgm.zip）。ROMS 树里
// 能找到 pgm.zip 时，把它的内容与游戏 zip 合并重打后流出（FBAlpha 2012 的
// 集组检查要求 BIOS 与游戏文件同在压缩包内）。
function findInRoms(name, dir, depth, out) {
  if (depth > 3) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findInRoms(name, full, depth + 1, out);
    else if (e.name.toLowerCase() === name && !out.includes(full)) out.push(full);
  }
}

function serveMergedZipRom(res, p) {
  if (!sevenZipBin) {
    res.writeHead(415, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('7z 解压不可用');
    return;
  }
  const rel = decodeURIComponent(p.slice('/roms/'.length));
  const abs = path.normalize(path.join(ROMS, rel));
  if (!abs.startsWith(ROMS)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (!fs.existsSync(abs)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }

  const key = crypto.createHash('md5').update('merge' + abs).digest('hex');
  const workDir = path.join(os.tmpdir(), 'wemu-merge', key);
  const mergedZip = path.join(workDir, 'merged.zip');
  try { if (fs.existsSync(mergedZip)) return serveFile(res, mergedZip, 'no-cache'); } catch { /* ignore */ }

  const run = (args) => new Promise((resolve) => {
    execFile(sevenZipBin, args, { maxBuffer: 256 * 1024 * 1024 }, () => resolve());
  });
  (async () => {
    fs.mkdirSync(workDir, { recursive: true });
    await run(['e', abs, '-o' + path.join(workDir, 'game'), '-y']);
    const pgmCandidates = [];
    findInRoms('pgm.zip', ROMS, 0, pgmCandidates);
    for (const c of pgmCandidates) await run(['e', c, '-o' + path.join(workDir, 'pgm'), '-y']);
    const all = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const fp = path.join(d, f); if (fs.statSync(fp).isFile()) all.push(fp); else walk(fp); } };
    if (fs.existsSync(path.join(workDir, 'game'))) walk(path.join(workDir, 'game'));
    if (fs.existsSync(path.join(workDir, 'pgm'))) walk(path.join(workDir, 'pgm'));
    await run(['a', '-tzip', '-mx=0', mergedZip].concat(all));
    serveFile(res, mergedZip, 'no-cache');
  })().catch((e) => {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('合并失败: ' + (e.message || '').slice(0, 140));
  });
}

// ---------- upload (multipart/form-data, minimal) ----------
function parseMultipart(req, body) {
  const ct = req.headers['content-type'] || '';
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
  if (!m) return null;
  const boundary = '--' + (m[1] || m[2]);
  const parts = [];
  let pos = body.indexOf(boundary);
  while (pos !== -1) {
    const start = pos + boundary.length;
    if (body.slice(start, start + 2).toString() === '--') break;
    const headEnd = body.indexOf('\r\n\r\n', start);
    if (headEnd === -1) break;
    const next = body.indexOf(boundary, headEnd);
    if (next === -1) break;
    const head = body.slice(start, headEnd).toString('utf8');
    const data = body.slice(headEnd + 4, next - 2); // strip trailing \r\n
    const fn = /filename="([^"]*)"/i.exec(head);
    const name = /name="([^"]*)"/i.exec(head);
    parts.push({ name: name?.[1], filename: fn?.[1], data });
    pos = next;
  }
  return parts;
}

function safeName(name) {
  return path.basename(name).replace(/[\\/:*?"<>|]/g, '_').trim() || 'upload.bin';
}

// ---------- API ----------
// favorites + recently played: persisted server-side (SQLite blobs, ns 'meta')
// so they follow the user across devices. Favorite keys are "<sysId>/<fileName>".
function readMetaJson(name, fallback) {
  try {
    const raw = getMeta(name);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeMetaJson(name, value) {
  setMeta(name, JSON.stringify(value));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

// scan the real systems a favorite/recent key list points into and return the
// matching full game entries (with sysId attached for core selection)
function gamesForKeys(keys) {
  const bySys = new Map();
  for (const key of keys) {
    const sep = key.indexOf('/');
    if (sep === -1) continue;
    const sysId = key.slice(0, sep);
    if (!bySys.has(sysId)) bySys.set(sysId, []);
    bySys.get(sysId).push(key.slice(sep + 1));
  }
  const out = [];
  for (const [sysId, fileNames] of bySys) {
    const sys = getSystem(sysId);
    if (!sys) continue;
    const want = new Set(fileNames);
    for (const g of scanSystem(ROMS, sys).games) {
      if (want.has(g.fileName)) out.push({ ...g, sysId });
    }
  }
  // stable order: follow the key list order
  const byKey = new Map(out.map((g) => [g.sysId + '/' + g.fileName, g]));
  // everything returned here is a favorite by definition
  for (const g of byKey.values()) g.favorite = true;
  return keys.map((k) => byKey.get(k)).filter(Boolean);
}

function apiSystems() {
  // systems without any scanned ROMs are hidden (ES-DE behavior)
  return SYSTEMS.map((s) => {
    let count = 0;
    try {
      count = scanSystem(ROMS, s).games.length;
    } catch { /* dir missing */ }
    return {
      id: s.id,
      fullName: s.fullName,
      shortName: s.shortName,
      manufacturer: s.manufacturer,
      releaseYear: s.releaseYear,
      themeDir: s.themeDir,
      gameCount: count
    };
  }).filter((s) => s.gameCount > 0);
}

async function handleAPI(req, res, url) {
  const p = url.pathname;

  if (req.method === 'GET' && p === '/api/config') {
    return sendJSON(res, 200, {
      theme: config.theme,
      variant: config.variant,
      player: config.player,
      themePath: `/themes/${config.theme}/`
    });
  }
  if (req.method === 'POST' && p === '/api/config') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let patch;
    try {
      patch = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return sendJSON(res, 400, { error: 'invalid JSON' });
    }
    // only known keys, only values that exist on disk
    if (patch.theme && typeof patch.theme === 'string') {
      const dir = path.join(THEMES, patch.theme);
      if (patch.theme.includes('..') || !fs.existsSync(path.join(dir, 'theme.xml')))
        return sendJSON(res, 400, { error: 'unknown theme' });
      config.theme = patch.theme;
    }
    if (patch.variant && typeof patch.variant === 'string') config.variant = patch.variant;
    if (patch.player === 'retroarch' || patch.player === 'emulatorjs') config.player = patch.player;
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
      return sendJSON(res, 500, { error: 'cannot write config: ' + e.message });
    }
    return sendJSON(res, 200, {
      theme: config.theme,
      variant: config.variant,
      player: config.player,
      themePath: `/themes/${config.theme}/`
    });
  }
  if (req.method === 'GET' && p === '/api/systems') {
    return sendJSON(res, 200, apiSystems());
  }
  const gameMatch = /^\/api\/systems\/([\w-]+)\/games$/.exec(p);
  if (req.method === 'GET' && gameMatch) {
    const sys = getSystem(gameMatch[1]);
    if (!sys) return sendJSON(res, 404, { error: 'unknown system' });
    const data = scanSystem(ROMS, sys);
    const favs = new Set(readMetaJson('favorites.json', []));
    if (favs.size) {
      for (const g of data.games) {
        if (favs.has(sys.id + '/' + g.fileName)) g.favorite = true;
      }
    }
    return sendJSON(res, 200, data);
  }
  if (req.method === 'GET' && p === '/api/favorites') {
    return sendJSON(res, 200, readMetaJson('favorites.json', []));
  }
  if (req.method === 'POST' && p === '/api/favorites/toggle') {
    const body = await readJsonBody(req);
    if (!body || typeof body.key !== 'string' || !body.key.includes('/')) {
      return sendJSON(res, 400, { error: 'key required (<sysId>/<fileName>)' });
    }
    const favs = new Set(readMetaJson('favorites.json', []));
    const had = favs.has(body.key);
    if (had) favs.delete(body.key); else favs.add(body.key);
    writeMetaJson('favorites.json', [...favs]);
    return sendJSON(res, 200, { favorite: !had });
  }
  if (req.method === 'GET' && p === '/api/favorite-games') {
    return sendJSON(res, 200, { games: gamesForKeys(readMetaJson('favorites.json', [])) });
  }
  if (req.method === 'GET' && p === '/api/recent-games') {
    return sendJSON(res, 200, { games: readMetaJson('recent.json', []) });
  }
  if (req.method === 'POST' && p === '/api/recent-add') {
    const body = await readJsonBody(req);
    if (!body || typeof body.sysId !== 'string' || typeof body.fileName !== 'string' || !getSystem(body.sysId)) {
      return sendJSON(res, 400, { error: 'sysId/fileName required' });
    }
    const entry = {
      sysId: body.sysId,
      fileName: body.fileName,
      name: String(body.name || body.fileName),
      image: String(body.image || ''),
      video: String(body.video || ''),
      url: String(body.url || ''),
      ts: Date.now()
    };
    const list = readMetaJson('recent.json', []).filter((g) => !(g.sysId === entry.sysId && g.fileName === entry.fileName));
    list.unshift(entry);
    writeMetaJson('recent.json', list.slice(0, 50));
    return sendJSON(res, 200, { ok: true });
  }
  // ---- server-side save/state/config storage (shared by all clients) ----
  // ns: 'save' (SRAM), 'state' (save states), 'cfg' (retroarch.cfg + userdata)
  const SYNC_MAX = 64 * 1024 * 1024;

  if (req.method === 'GET' && p === '/api/storage/list') {
    const ns = url.searchParams.get('ns') || 'save';
    if (!['save', 'state', 'cfg'].includes(ns)) return sendJSON(res, 400, { error: 'bad ns' });
    return sendJSON(res, 200, listBlobs(ns));
  }
  if (req.method === 'GET' && p === '/api/storage/get') {
    const ns = url.searchParams.get('ns');
    const fp = url.searchParams.get('path') || '';
    if (!ns || !fp) return sendJSON(res, 400, { error: 'ns/path required' });
    const row = getBlob(ns, fp);
    if (!row) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': row.data.length,
      'X-Mtime': String(row.mtime),
      'Cache-Control': 'no-store'
    });
    return res.end(row.data);
  }
  if (req.method === 'POST' && p === '/api/storage/put') {
    const ns = url.searchParams.get('ns');
    const fp = url.searchParams.get('path') || '';
    if (!['save', 'state', 'cfg'].includes(ns) || !fp || fp.includes('..')) {
      return sendJSON(res, 400, { error: 'bad ns/path' });
    }
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      chunks.push(c);
      size += c.length;
      if (size > SYNC_MAX) { res.writeHead(413); return res.end('Too large'); }
    }
    const mtime = putBlob(ns, fp, Buffer.concat(chunks));
    return sendJSON(res, 200, { ok: true, mtime });
  }
  if (req.method === 'POST' && p === '/api/storage/delete') {
    const ns = url.searchParams.get('ns');
    const fp = url.searchParams.get('path') || '';
    if (!ns || !fp) return sendJSON(res, 400, { error: 'ns/path required' });
    deleteBlob(ns, fp);
    return sendJSON(res, 200, { ok: true });
  }
  return sendJSON(res, 404, { error: 'not found' });
}

const handler = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  // 多线程 WASM 核心（dosbox_pure）需要 SharedArrayBuffer：
  // 这两个头让页面 cross-origin-isolated，SAB 才可用。本站资源同源，无 CORP 影响。
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  if (!p.startsWith('/api/storage')) console.log('[req]', req.method, p);
  try {
    if (p.startsWith('/api/')) return await handleAPI(req, res, url);
    if (p.startsWith('/emulatorjs/')) return serveDir(res, EMU_DATA, p.slice('/emulatorjs'.length), 'no-cache');
    if (p.startsWith('/retroarch/')) return serveDir(res, RETROARCH, p.slice('/retroarch'.length), 'no-cache');
    if (p.startsWith('/themes/')) return serveDir(res, THEMES, p.slice('/themes'.length), 'public, max-age=600');
    if (p.startsWith('/roms/bios/')) return serveBiosWithFallback(res, p.slice('/roms/bios/'.length));
    // FBA2012/FBNeo 系街机 zip：集组要求 BIOS 与游戏文件同包——合并 pgm.zip 后流出
    if (p.startsWith('/roms/') && /\.zip$/i.test(p) && /fbalpha|fbneo/i.test(req.headers.referer || '')) {
      return serveMergedZipRom(res, p);
    }
    if (p.startsWith('/roms/')) return serveDir(res, ROMS, p.slice('/roms'.length), 'no-cache');
    if (p.startsWith('/player.html')) return serveFile(res, path.join(ROOT, 'public', 'player.html'));
    if (p.startsWith('/retroarch-player.html')) return serveFile(res, path.join(ROOT, 'public', 'retroarch-player.html'));

    // SPA: serve vite build output if present, otherwise hint to run vite dev
    if (fs.existsSync(path.join(DIST, 'index.html'))) {
      if (p === '/' || !path.extname(p)) return serveFile(res, path.join(DIST, 'index.html'));
      return serveDir(res, DIST, p, 'public, max-age=3600');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<meta charset="utf-8"><body style="background:#111;color:#ccc;font-family:sans-serif"><p>API 正常运行。前端请用 <code>npm run dev</code>（Vite, 端口 5173），或 <code>npm run build</code> 后再访问本端口。</p></body>');
  } catch (e) {
    console.error('[server]', e);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal error: ' + e.message);
  }
};

function lanAddresses() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const it of ifs[name] || []) {
      if (it.family === 'IPv4' && !it.internal) out.push(it.address);
    }
  }
  return out;
}

const HTTP_PORT = Number(process.env.PORT || 4464);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 4465);
const CERT_DIR = path.join(ROOT, 'certs');
const CERT_KEY = path.join(CERT_DIR, 'key.pem');
const CERT_CRT = path.join(CERT_DIR, 'cert.pem');

http.createServer(handler).listen(HTTP_PORT, () => {
  console.log(`WemuStation (HTTP)  : http://localhost:${HTTP_PORT}`);
  for (const ip of lanAddresses()) console.log(`                      http://${ip}:${HTTP_PORT}`);
  console.log(`  roms:  ${ROMS}`);
  console.log(`  theme: ${config.theme} | player: ${config.player}`);
});

// HTTPS is required for the Gamepad API on non-localhost origins — without it
// LAN clients can play with the keyboard but gamepads stay invisible.
if (fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT)) {
  const creds = {
    key: fs.readFileSync(CERT_KEY),
    cert: fs.readFileSync(CERT_CRT)
  };
  https.createServer(creds, handler).listen(HTTPS_PORT, () => {
    console.log(`WemuStation (HTTPS) : https://localhost:${HTTPS_PORT}  (self-signed)`);
    for (const ip of lanAddresses()) console.log(`                      https://${ip}:${HTTPS_PORT}  <- gamepad users should use this`);
  });
} else {
  console.log(`(no certs/ found — HTTPS disabled. LAN gamepad support needs it: npm run gen-cert)`);
}
