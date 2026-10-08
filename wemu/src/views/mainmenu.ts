// ES-DE style main menu: opened with Start on the frontend screens.
// Full-screen list UI navigable by keyboard/gamepad; hosts game import,
// input config, theme switching, the RA main menu and library refresh.
import type { InputManager } from '../input/input';
import type { NavButton } from '../types';
import type { SystemInfo } from '../types';

export interface MainMenuActions {
  openSettings: () => void;
  openRAMainMenu: () => void;
  refreshLibrary: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  coreChoices: { items: { coreId: string; label: string; available: boolean; selected: boolean }[]; pick: (coreId: string) => void };
  themes: string[];
  currentTheme: string;
  onThemePick: (theme: string) => Promise<void>;
  currentSystem: SystemInfo;
  /** 画面设置：按系统写入 per-system retroarch.cfg(着色器/遮罩)。
   *  shaderFiles 为可浏览的预设清单(相对 system/shaders),cn 为中文显示名。*/
  graphicsChoices: {
    shaderFiles: { path: string; cn: string }[];
    overlayFiles: string[];
    current: { shader: string; overlay: string };
    pick: (kind: 'shader' | 'overlay', value: string) => Promise<void>;
  };
}

const THEME_LABELS: Record<string, string> = {
  'slate-es-de': 'Slate（默认）',
  'modern-es-de': 'Modern',
  'linear-es-de': 'Linear'
};

const THEME_MARK = ' ✓';

// 遮罩目录名 → 显示名(覆盖常见系统)
const SYS_NAMES: Record<string, string> = {
  arcade: '街机通用', atomiswave: 'Atomiswave', dc: 'Dreamcast', fc: 'FC/NES', fds: 'FDS',
  gb: 'GB', gba: 'GBA', gbc: 'GBC', gg: 'Game Gear', md: 'MD/Genesis', n64: 'N64',
  naomi: 'NAOMI', neogeo: 'Neo Geo', neogeocd: 'Neo Geo CD', ngp: 'Neo Geo Pocket',
  ngpc: 'NGPC', pce: 'PC Engine', psp: 'PSP', psx: 'PS1', sfc: 'SFC/SNES',
  sg1000: 'SG-1000', sms: 'Master System', sega32x: '32X', segacd: 'Sega CD',
  ss: 'Saturn', wsc: 'WonderSwan', default: '通用 16:9'
};

export class MainMenuPanel {
  private el: HTMLDivElement;
  private listEl!: HTMLDivElement;
  private titleEl!: HTMLDivElement;
  private idx = 0;
  private closed = false;
  private inThemes = false;
  private inCores = false;
  private inGraphics = false;
  /** 画面设置文件浏览器:kind + 当前相对目录('' = 根) */
  private gfxKind: 'shader' | 'overlay' | null = null;
  private gfxDir = '';

  constructor(
    private root: HTMLElement,
    private input: InputManager,
    private act: MainMenuActions
  ) {
    this.el = document.createElement('div');
    this.el.className = 'mainmenu-overlay';
    this.render();
    // document.body, not the #app root: view re-renders wipe #app children
    // attach to body: the #app root gets wiped by every view re-render,
    // which would orphan the panel instance and break the Start/F1 toggle
    document.body.appendChild(this.el);
  }

  isOpen() { return !this.closed; }

  /** 画面设置文件浏览器:列出 gfxKind 对应树的当前目录(子目录在前) */
  private gfxItems(): { label: string, act: () => void, isDir: boolean }[] {
    const gc = this.act.graphicsChoices;
    const prefix = this.gfxDir ? this.gfxDir + '/' : '';
    const dirSet = new Map<string, boolean>();
    const files: { label: string, pick: () => Promise<void> }[] = [];
    const items: { path: string; cn?: string }[] = this.gfxKind === 'shader'
      ? gc.shaderFiles
      : gc.overlayFiles.map((p) => ({ path: p }));
    for (const f of items) {
      if (!f.path.startsWith(prefix)) continue;
      const rest = f.path.slice(prefix.length);
      if (!rest) continue;
      const slash = rest.indexOf('/');
      if (slash > -1) dirSet.set(rest.slice(0, slash), true);
      else {
        if (this.gfxKind === 'shader') {
          const path = f.path;
          const label = (f.cn || rest.replace(/\.glslp$/, ''));
          files.push({ label, pick: async () => { await gc.pick('shader', path); this.gfxDir = ''; this.render(); } });
        } else {
          const path = f.path;
          const label = rest.replace(/\.cfg$/, '');
          files.push({ label, pick: async () => { await gc.pick('overlay', path); this.gfxDir = ''; this.render(); } });
        }
      }
    }
    const out: { label: string, act: () => void, isDir: boolean }[] = [];
    if (this.gfxDir) {
      out.push({ label: '📁 ..（上级目录）', act: () => { this.gfxDir = this.gfxDir.includes('/') ? this.gfxDir.slice(0, this.gfxDir.lastIndexOf('/')) : ''; this.idx = 0; this.render(); }, isDir: true });
    } else if (this.gfxKind === 'shader') {
      out.push({ label: '✕ 关闭着色器', act: async () => { await gc.pick('shader', ''); this.closeBrowser(); this.render(); }, isDir: true });
    } else if (this.gfxKind === 'overlay') {
      out.push({ label: '✕ 无遮罩', act: async () => { await gc.pick('overlay', ''); this.closeBrowser(); this.render(); }, isDir: true });
    }
    for (const d of [...dirSet.keys()].sort()) {
      out.push({ label: '📁 ' + d, act: () => { this.gfxDir = prefix + d; this.idx = 0; this.render(); }, isDir: true });
    }
    for (const f of files.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))) {
      out.push({ label: f.label, act: f.pick, isDir: false });
    }
    return out;
  }

  private closeBrowser() {
    this.inGraphics = false;
    this.gfxKind = null;
    this.gfxDir = '';
    this.idx = 0;
  }

  private items(): { label: string, act: () => void }[] {
    if (this.inThemes) {
      return this.act.themes.map((t) => ({
        label: (THEME_LABELS[t] || t) + (t === this.act.currentTheme ? THEME_MARK : ''),
        act: async () => {
          if (t !== this.act.currentTheme) {
            await this.act.onThemePick(t);
          }
          this.inThemes = false;
          this.render();
        }
      }));
    }
    if (this.inCores) {
      return this.act.coreChoices.items.map((c) => ({
        label: c.label + (c.selected ? THEME_MARK : '') + (c.available ? '' : '（未构建）'),
        act: async () => {
          this.act.coreChoices.pick(c.coreId);
          this.inCores = false;
          this.render();
        }
      }));
    }
    // 画面设置文件浏览器:像 RA 自带的那样逐级进文件夹选择
    if (this.inGraphics && this.gfxKind) {
      return this.gfxItems();
    }
    if (this.inGraphics) {
      return [
        { label: '📁 着色器滤镜', act: () => { this.gfxKind = 'shader'; this.gfxDir = ''; this.idx = 0; this.render(); } },
        { label: '📁 屏幕遮罩', act: () => { this.gfxKind = 'overlay'; this.gfxDir = ''; this.idx = 0; this.render(); } }
      ];
    }
    return [
      { label: '配置按键', act: () => { this.close(); this.act.openSettings(); } },
      { label: '画面设置（着色器 / 遮罩）', act: () => { this.inGraphics = true; this.gfxKind = null; this.gfxDir = ''; this.idx = 0; this.render(); } },
      { label: 'RA 主菜单（语言 / 着色器 / 手柄…）', act: () => { this.close(); this.act.openRAMainMenu(); } },
      { label: '切换主题', act: () => { this.inThemes = true; this.inCores = false; this.idx = 0; this.render(); } },
      ...(this.act.coreChoices ? [{
        label: '模拟器核心',
        act: () => { this.inCores = true; this.inThemes = false; this.idx = 0; this.render(); }
      }] : []),
      { label: '刷新游戏库', act: async () => { this.close(); await this.act.refreshLibrary(); } },
      {
        label: document.fullscreenElement ? '退出全屏' : '全屏',
        act: async () => {
          await this.act.toggleFullscreen();
          this.render();
        }
      }
    ];
  }

  private render() {
    const items = this.items();
    this.el.innerHTML = '';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'mainmenu-title';
    let title = '主菜单';
    if (this.inThemes) title = '切换主题';
    else if (this.inCores) title = '模拟器核心';
    else if (this.inGraphics) {
      title = '画面设置';
      if (this.gfxKind) {
        title += ' / ' + (this.gfxKind === 'shader' ? '着色器滤镜' : '屏幕遮罩');
        if (this.gfxDir) title += ' / ' + this.gfxDir;
      }
    }
    this.titleEl.textContent = title + ` — ${this.act.currentSystem.shortName}`;
    this.el.appendChild(this.titleEl);

    this.listEl = document.createElement('div');
    this.listEl.className = 'mainmenu-list';
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'mainmenu-item' + (i === this.idx ? ' selected' : '');
      row.textContent = it.label;
      row.addEventListener('click', () => { this.idx = i; it.act(); });
      this.listEl.appendChild(row);
    });
    this.el.appendChild(this.listEl);
    const selRow = this.listEl.querySelector('.mainmenu-item.selected');
    selRow?.scrollIntoView({ block: 'nearest' });

    const help = document.createElement('div');
    help.className = 'mainmenu-help';
    help.textContent = '↑↓ 选择 · X/回车 确认 · Esc/B 返回';
    this.el.appendChild(help);
  }

  private move(delta: number) {
    const n = this.items().length;
    this.idx = (this.idx + delta + n) % n;
    this.render();
  }

  private activate() {
    const items = this.items();
    items[this.idx]?.act();
  }

  handle(btn: NavButton | 'settings' | 'ramenu') {
    if (this.closed) return;
    switch (btn) {
      case 'up': this.move(-1); break;
      case 'down': this.move(1); break;
      case 'accept': this.activate(); break;
      case 'cancel':
        if (this.inGraphics && this.gfxKind) {
          // 浏览器内:先逐级返回,根目录再退出浏览器
          if (this.gfxDir) {
            this.gfxDir = this.gfxDir.includes('/') ? this.gfxDir.slice(0, this.gfxDir.lastIndexOf('/')) : '';
          } else {
            this.closeBrowser();
          }
          this.idx = 0;
          this.render();
        } else if (this.inGraphics || this.inThemes || this.inCores) { this.inThemes = false; this.inCores = false; this.inGraphics = false; this.gfxKind = null; this.gfxDir = ''; this.idx = 0; this.render(); }
        else this.close();
        break;
      default: break;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.el.remove();
  }
}
