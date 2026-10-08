// Game player: full-screen iframe hosting either the EmulatorJS shell, the
// RetroArch wasm build, or the standalone PPSSPP wasm build (PSP). The iframe
// isolates the wasm core so exiting tears everything down cleanly. All shells
// speak the same postMessage protocol (ejs-start / ejs-esc / ejs-error) plus
// ra-command for RetroArch controls.
import type { GameEntry, SystemInfo } from '../types';

export type PlayerEngine = 'emulatorjs' | 'retroarch' | 'ppsspp';

export interface PlayerHandle {
  destroy: () => void;
  /** send a message into the player iframe (e.g. ra-command) */
  post: (msg: Record<string, unknown>) => void;
}

export function launchGame(
  appRoot: HTMLElement,
  sys: SystemInfo,
  game: GameEntry | null,
  core: string,
  engine: PlayerEngine,
  onExit: () => void
): PlayerHandle {
  const layer = document.createElement('div');
  layer.className = 'player-layer';

  const qs = new URLSearchParams({ core });
  const isMenuMode = !game; // no game → boot straight into the RA main menu
  if (game) {
    qs.set('game', game.url);
    qs.set('name', game.name);
    // per-system RA config override (player.html adds --appendconfig
    // userdata/per-system/<sys>.cfg): settings saved inside this session's
    // RA menu land in this system's own config, like ArkOS/AmberELEC do
    const sysId = (game as unknown as { sysId?: string }).sysId || sys.id;
    qs.set('sys', sysId);
  } else {
    qs.set('mode', 'menu');
    qs.set('name', 'RetroArch Settings');
  }
  // phantom gamepads can push the real pad to a higher index; pin RA port 1
  // to the first connected pad so controls and hotkeys always work
  const pads = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : [])
    .filter((p): p is Gamepad => !!p);
  if (pads.length) qs.set('padIndex', String(pads[0].index));
  else qs.set('padIndex', '0');
  const iframe = document.createElement('iframe');
  const shell = engine === 'retroarch' ? '/retroarch-player.html'
    : engine === 'ppsspp' ? '/ppsspp-player.html'
    : '/player.html';
  if (engine !== 'emulatorjs') qs.set('t', String(Date.now())); // bypass stale iframe caches
  iframe.src = shell + '?' + qs.toString();
  iframe.allow = 'autoplay; fullscreen; gamepad';

  const topbar = document.createElement('div');
  topbar.className = 'player-topbar visible';
  const title = document.createElement('button');
  title.textContent = game ? `${game.name} — ${sys.shortName}` : 'RetroArch 设置';
  title.style.pointerEvents = 'none';
  const menuBtn = document.createElement('button');
  menuBtn.textContent = '☰ RA菜单';
  menuBtn.title = '打开 RetroArch 完整菜单（着色器/遮罩/重映射），游戏内也可按 F1';
  menuBtn.onclick = () => iframe.contentWindow?.postMessage({ type: 'ra-command', cmd: 'toggle-menu' }, '*');
  const fsBtn = document.createElement('button');
  fsBtn.textContent = '全屏';
  fsBtn.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  const exitBtn = document.createElement('button');
  exitBtn.textContent = '✕ 退出';
  exitBtn.onclick = () => onExit();
  topbar.append(title, menuBtn, fsBtn, exitBtn);
  if (engine !== 'retroarch') menuBtn.remove();

  layer.append(iframe, topbar);
  appRoot.appendChild(layer);

  const onMessage = (e: MessageEvent) => {
    if (e.source !== iframe.contentWindow) return;
    const d = e.data || {};
    if (d.type === 'ejs-start') {
      topbar.classList.remove('visible');
    } else if (d.type === 'ejs-esc') {
      onExit();
    } else if (d.type === 'ra-log') {
      (window as unknown as { __ralogs?: string[] }).__ralogs =
        (window as unknown as { __ralogs?: string[] }).__ralogs || [];
      (window as unknown as { __ralogs: string[] }).__ralogs.push(String(d.line));
    } else if (d.type === 'ra-sync-warning') {
      console.warn('[player]', d.message);
      // 同步状态直接反映在顶栏标题上（toast 太快会错过）
      if (typeof d.message === 'string') title.textContent = `⚠ ${d.message}`;
    } else if (d.type === 'ejs-error') {
      console.error('[player]', d.message);
    }
  };
  window.addEventListener('message', onMessage);

  return {
    destroy() {
      // flush the player's final save/config sync BEFORE tearing down the
      // iframe: pagehide alone races the removal and loses the write
      const iframeWin = iframe.contentWindow;
      const flushed = new Promise<void>((resolve) => {
        const onPersisted = (e: MessageEvent) => {
          if (e.source === iframeWin && (e.data as { type?: string })?.type === 'ra-persisted') {
            window.removeEventListener('message', onPersisted);
            resolve();
          }
        };
        window.addEventListener('message', onPersisted);
        iframeWin?.postMessage({ type: 'ra-persist-now' }, '*');
        // 上限 6s:存档按新旧排序后最先上传,正常几十毫秒完成;
        // 6s 只在服务器不可达(fetch 超时)时才兜底
        setTimeout(resolve, 6000);
      });
      void flushed.then(() => {
        window.removeEventListener('message', onMessage);
        iframe.src = 'about:blank';
        layer.remove();
      });
    },
    post(msg) {
      iframe.contentWindow?.postMessage(msg, '*');
    }
  };
}
