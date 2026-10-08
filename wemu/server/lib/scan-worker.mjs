// Background systems scanner: runs the full library scan in a worker thread
// so the synchronous directory walking never blocks the server event loop.
import { parentPort, workerData } from 'node:worker_threads';
import { scanSystem } from './library.js';

const { roms, systems } = workerData;

const out = systems.map((s) => {
  let count = 0;
  try {
    count = scanSystem(roms, s).games.length;
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

parentPort.postMessage(out);
