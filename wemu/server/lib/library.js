import fs from 'node:fs';
import path from 'node:path';
import { parseXML, childrenOf, firstChild, textOf } from './xml.js';

// Recursive library scanner with full ES-DE / R36S gamelist.xml support:
// - ROMs in nested subdirectories
// - <folder> entries (R36S category packs) recognized for hidden/marker data
// - R36S metadata fields: screenshot / screentitle / hidden / marquee / desc…
// - One gamelist.xml at the SYSTEM ROOT may describe games in ANY subdirectory
//   (R36S convention); media paths resolve relative to the gamelist's dir.

// Resolve all rom-root subfolders belonging to a system: the system id plus
// any declared aliases, matched case-insensitively (downloaded packs name the
// same console "FC" / "FAMILYCOMPUTER" / "NES", "SFC" / "SNES", "MD" /
// "GENESIS"…). Every matched folder is scanned and the results merged.
export function scanSystem(romRoot, sysDef) {
  const result = { games: [], hasGamelist: false };
  let rootEntries;
  try {
    rootEntries = fs.readdirSync(romRoot, { withFileTypes: true });
  } catch {
    return result;
  }
  const byLower = new Map();
  for (const e of rootEntries) if (e.isDirectory()) byLower.set(e.name.toLowerCase(), e.name);
  const wanted = [...new Set([sysDef.id, ...(sysDef.aliases || [])].map((a) => String(a).toLowerCase()))];
  const dirs = [...new Set(wanted.map((w) => byLower.get(w)).filter(Boolean))];
  for (const name of dirs) {
    const sub = scanDir(path.join(romRoot, name), name, sysDef);
    result.games.push(...sub.games);
    result.hasGamelist = result.hasGamelist || sub.hasGamelist;
  }
  return result;
}

function scanDir(dir, dirName, sysDef) {
  const result = { games: [], hasGamelist: false };

  const exts = new Set(sysDef.extensions.map((e) => e.toLowerCase()));
  const seen = new Set();

  // 1) collect every gamelist.xml in the tree: map absolute-dir → meta map
  const gamelists = new Map(); // absDir -> { byPath: Map, dir: absDir }
  const collectGamelist = (d, depth) => {
    if (depth > 6) return;
    const file = path.join(d, 'gamelist.xml');
    if (fs.existsSync(file)) {
      const m = readGamelist(d);
      if (m.size) {
        gamelists.set(d, { byPath: m, dir: d });
        result.hasGamelist = true;
      }
    }
    let subs;
    try { subs = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of subs) {
      if (e.isDirectory() && !e.name.startsWith('.')) collectGamelist(path.join(d, e.name), depth + 1);
    }
  };
  collectGamelist(dir, 0);

  // 2) metadata lookup: nearest gamelist walking up from the ROM's directory
  const metaFor = (romAbsPath) => {
    let d = path.dirname(romAbsPath);
    while (true) {
      const gl = gamelists.get(d);
      if (gl) {
        const relFromGl = './' + path.relative(d, romAbsPath).split(path.sep).join('/');
        const hit = gl.byPath.get(normKey(relFromGl)) || gl.byPath.get(normKey(path.basename(romAbsPath)));
        if (hit) return { meta: hit, gamelistDir: gl.dir };
      }
      if (d === dir || d.length <= dir.length) break;
      const parent = path.dirname(d);
      if (parent === d) break;
      d = parent;
    }
    return { meta: {}, gamelistDir: dir };
  };

  // 3) walk ROM files
  const walk = (d, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (depth < 6) walk(full, depth + 1);
        continue;
      }
      const ext = path.extname(ent.name).slice(1).toLowerCase();
      if (!exts.has(ext)) continue;
      const absKey = full.toLowerCase();
      if (seen.has(absKey)) continue;
      seen.add(absKey);

      const { meta, gamelistDir } = metaFor(full);
      if (meta.hidden === 'true') continue; // R36S hides BIOS entries etc.

      let st;
      try { st = fs.statSync(full); } catch { continue; }

      const name = meta.name || cleanName(ent.name);
      const img = pickMedia([meta.image, meta.screenshot, meta.screentitle], gamelistDir);
      const screenshot = pickMedia([meta.screenshot, meta.image], gamelistDir);

      result.games.push({
        fileName: path.relative(dir, full).split(path.sep).join('/'),
        name,
        desc: meta.desc || '',
        image: img,
        screenshot,
        marquee: pickMedia([meta.marquee], gamelistDir),
        releasedate: fmtDate(meta.releasedate),
        developer: meta.developer || '',
        publisher: meta.publisher || '',
        genre: meta.genre || '',
        players: meta.players || '',
        rating: meta.rating ? Number(meta.rating) : 0,
        favorite: meta.favorite === 'true',
        playcount: Number(meta.playcount || 0),
        lastplayed: fmtDate(meta.lastplayed),
        size: st.size,
        url: '/roms/' + dirName + '/' + encodeURIComponent(path.relative(dir, full).split(path.sep).join('/'))
      });
    }
  };

  // media URL relative to the system rom dir (which /roms/<id> serves)
  function pickMedia(candidates, gamelistDir) {
    for (const c of candidates) {
      if (!c) continue;
      // gamelist media paths are relative to the gamelist.xml's directory
      const abs = path.resolve(gamelistDir || dir, c.replace(/^\.\//, ''));
      const rel = path.relative(dir, abs).split(path.sep).join('/');
      if (rel.startsWith('..')) continue; // escapes the rom dir; cannot serve
      return '/roms/' + dirName + '/' + rel.split('/').map(encodeURIComponent).join('/');
    }
    return '';
  }

  walk(dir, 0);
  result.games.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  return result;
}

function readGamelist(dir) {
  const byPath = new Map();
  const file = path.join(dir, 'gamelist.xml');
  if (!fs.existsSync(file)) return byPath;
  try {
    const xml = parseXML(fs.readFileSync(file, 'utf8'));
    const gameList = firstChild(xml, 'gameList') || xml;
    for (const game of childrenOf(gameList, 'game')) {
      const p = textOf(firstChild(game, 'path'));
      if (!p) continue;
      const meta = {};
      for (const c of game.children) {
        if (c.tag === 'path') continue;
        meta[c.tag] = textOf(c);
      }
      byPath.set(normKey(p), meta);
    }
    // R36S <folder> entries: carry category names (used when a ROM dir matches)
    for (const folder of childrenOf(gameList, 'folder')) {
      const fp = textOf(firstChild(folder, 'path'));
      if (!fp) continue;
      const fname = textOf(firstChild(folder, 'name')) || path.basename(fp);
      const image = textOf(firstChild(folder, 'image'));
      const desc = textOf(firstChild(folder, 'desc'));
      byPath.set(normKey(fp), { __isFolder: true, name: fname, image, desc });
    }
  } catch (e) {
    console.error(`[library] failed to parse ${file}: ${e.message}`);
  }
  return byPath;
}

function normKey(p) {
  return p.replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase();
}

// Strip extension and common scene tags from a filename for display
function cleanName(name) {
  let n = name.replace(/\.[^.]+$/, '');
  n = n.replace(/\((?:[^()]*(?:Rev|Version|v\d|Beta|Demo|Proto|Europe|USA|Japan|World|En|Fr|De|Es|It|Ja|Zh)[^()]*)\)/gi, '');
  n = n.replace(/\[[^\]]*\]/g, '');
  return n.replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim() || name;
}

// ES-DE datetime format: 19850913T000000
function fmtDate(v) {
  if (!v) return '';
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
