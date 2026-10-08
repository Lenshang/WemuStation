// WemuStation application shell: state machine across
// system view → gamelist view → in-game player.
import { api } from './api';
import type { SystemInfo, GameEntry, ThemeLayout } from './types';
import { loadTheme, makeSystemVars } from './theme/parser';
import { SoundManager } from './theme/sounds';
import { InputManager } from './input/input';
import { renderSystemView } from './views/systemview';
import { renderGamelistView, type GamelistRefs } from './views/gamelistview';
import { SearchPanel } from './views/searchpanel';
import { launchGame, type PlayerHandle, type PlayerEngine } from './views/player';
import { openSettingsPanel } from './views/settings';
import { MainMenuPanel } from './views/mainmenu';

const EJS_CORES: Record<string, string> = {
  nes: 'nes',
  snes: 'snes',
  megadrive: 'segaMD',
  pcengine: 'pce',
  gba: 'gba',
  gb: 'gb',
  psx: 'psx',
  dos: 'dosbox_pure'
};

// RetroArch statically-linked core names (must match /retroarch/*.js builds)
const RA_CORES: Record<string, string> = {
  nes: 'fceumm',
  n64: 'mupen64plus_next',
  nds: 'melonds',
  snes: 'snes9x',
  megadrive: 'genesis_plus_gx',
  pcengine: 'mednafen_pce',
  pcenginecd: 'mednafen_pce',
  segacd: 'genesis_plus_gx',
  sega32x: 'picodrive',
  sg1000: 'genesis_plus_gx',
  pc98: 'np2kai',
  msx2: 'bluemsx',
  lynx: 'handy',
  gba: 'mgba',
  gb: 'gambatte',
  psx: 'pcsx_rearmed',
  gbc: 'gambatte',
  gamegear: 'genesis_plus_gx',
  fbneo: 'fbalpha2012',
  neogeo: 'fbneo',
  neogeocd: 'neocd',
  cps1: 'fbneo',
  cps2: 'fbneo',
  cps3: 'fbneo',
  mame: 'mame2003_plus',
  ngp: 'mednafen_ngp',
  ngpc: 'mednafen_ngp',
  virtualboy: 'mednafen_vb',
  wonderswan: 'mednafen_wswan',
  wonderswancolor: 'mednafen_wswan',
  gameandwatch: 'gw',
  sms: 'genesis_plus_gx',
  '3do': 'opera',
  atari2600: 'stella2014',
  atari5200: 'atari800',
  atari7800: 'prosystem'
};

// 每系统的备选 RA 核心（首个为默认）。玩家可在主菜单切换。
const SYSTEM_CORES: Record<string, string[]> = {
  nes: ['fceumm', 'nestopia'],
  n64: ['mupen64plus_next'],
  nds: ['melonds'],
  snes: ['snes9x', 'snes9x2010', 'snes9x2005'],
  megadrive: ['genesis_plus_gx', 'picodrive'],
  pcengine: ['mednafen_pce', 'mednafen_pce_fast', 'geargrafx'],
  pcenginecd: ['mednafen_pce'],
  segacd: ['genesis_plus_gx', 'picodrive'],
  sega32x: ['picodrive'],
  sg1000: ['genesis_plus_gx'],
  pc98: ['np2kai'],
  msx2: ['bluemsx'],
  lynx: ['handy'],
  gba: ['mgba', 'vba_next'],
  gb: ['gambatte', 'gearboy', 'doublecherrygb'],
  psx: ['pcsx_rearmed'],
  gbc: ['gambatte'],
  gamegear: ['genesis_plus_gx', 'gearsystem'],
  sms: ['gearsystem', 'genesis_plus_gx'],
  neogeo: ['fbalpha2012_neogeo', 'fbalpha2012', 'fbneo'],
  neogeocd: ['neocd'],
  fbneo: ['fbalpha2012', 'fbneo'],
  cps1: ['fbalpha2012_cps1', 'fbalpha2012'],
  cps2: ['fbalpha2012_cps2', 'fbalpha2012'],
  cps3: ['fbalpha2012_cps3', 'fbalpha2012'],
  mame: ['mame2003_plus', 'mame2003', 'mame2000'],
  ngp: ['mednafen_ngp'],
  ngpc: ['mednafen_ngp'],
  virtualboy: ['mednafen_vb'],
  wonderswan: ['mednafen_wswan'],
  wonderswancolor: ['mednafen_wswan'],
  gameandwatch: ['gw'],
  '3do': ['opera'],
  atari2600: ['stella2014'],
  atari5200: ['atari800'],
  atari7800: ['prosystem']
};

const CORE_LABELS: Record<string, string> = {
  fceumm: 'FCEUmm', nestopia: 'Nestopia（高精度）',
  snes9x: 'Snes9x（推荐）', snes9x2010: 'Snes9x 2010', snes9x2005: 'Snes9x 2005', snes9x2002: 'Snes9x 2002',
  genesis_plus_gx: 'Genesis Plus GX', picodrive: 'Picodrive',
  mednafen_pce: 'Beetle PCE', mednafen_pce_fast: 'Beetle PCE Fast', geargrafx: 'Geargrafx',
  handy: 'Handy（Lynx）', bluemsx: 'blueMSX', np2kai: 'Neko Project II Kai',
  mupen64plus_next: 'Mupen64Plus-Next', melonds: 'melonDS',
  mgba: 'mGBA（推荐）', vba_next: 'VBA Next',
  gambatte: 'Gambatte（推荐）', gearboy: 'Gearboy', doublecherrygb: 'DoubleCherryGB',
  pcsx_rearmed: 'PCSX ReARMed',
  fbalpha2012: 'FB Alpha 2012', fbneo: 'FBNeo（新版）',
  neocd: 'NeoGeo CD（NeoCD）',
  fbalpha2012_neogeo: 'FB Alpha 2012 NeoGeo', fbalpha2012_cps1: 'FB Alpha 2012 CPS1', fbalpha2012_cps2: 'FB Alpha 2012 CPS2', fbalpha2012_cps3: 'FB Alpha 2012 CPS3',
  mame2003_plus: 'MAME 2003 Plus', mame2003: 'MAME 2003', mame2000: 'MAME 2000',
  mednafen_ngp: 'Beetle NeoPop', mednafen_vb: 'Beetle VB', mednafen_wswan: 'Beetle WonderSwan',
  gw: 'Game & Watch', genesis_plus_gx_sms: '',
  gearsystem: 'Gearsystem',
  stella2014: 'Stella 2014', atari800: 'Atari800', prosystem: 'ProSystem', opera: 'Opera（3DO）'
};

function coreLabel(coreId: string): string {
  return CORE_LABELS[coreId] || coreId;
}

// 走专用 wasm 引擎（非 RetroArch / EmulatorJS）的系统。PSP 用独立的
// PPSSPP 构建（RetroArch 没有 PSP 核心，EmulatorJS 也没有）。
const SPECIAL_ENGINES: Record<string, PlayerEngine> = {
  psp: 'ppsspp'
};

const ROM_EXTENSIONS: Record<string, string[]> = {
  nes: ['nes', 'fds', 'unf', 'unif', 'zip', '7z'],
  snes: ['smc', 'sfc', 'swc', 'fig', 'zip', '7z'],
  megadrive: ['md', 'smd', 'gen', 'bin', '68k', 'zip', '7z'],
  pcengine: ['pce', 'cue', 'ccd', 'zip', '7z'],
  gba: ['gba', 'zip', '7z'],
  gb: ['gb', 'gbc', 'zip', '7z'],
  psx: ['bin', 'cue', 'pbp', 'chd', 'iso', 'img', 'zip', '7z'],
  psp: ['iso', 'cso', 'pbp', 'chd', 'elf'],
  gbc: ['gbc', 'cgb', 'zip', '7z'],
  gamegear: ['gg', 'bin', 'zip', '7z'],
  fbneo: ['zip', '7z'],
  neogeo: ['zip', '7z'],
  cps1: ['zip', '7z'],
  cps2: ['zip', '7z'],
  cps3: ['zip', '7z'],
  mame: ['zip', '7z'],
  ngp: ['ngp', 'zip', '7z'],
  ngpc: ['ngp', 'ngc', 'zip', '7z'],
  virtualboy: ['vb', 'vboy', 'bin', 'zip', '7z'],
  wonderswan: ['ws', 'zip', '7z'],
  wonderswancolor: ['ws', 'wsc', 'zip', '7z'],
  gameandwatch: ['gw', 'mgw', 'zip'],
  sms: ['sms', 'zip', '7z'],
  '3do': ['iso', 'chd', 'cue', 'zip'],
  atari2600: ['a26', '7z', 'zip', 'bin'],
  atari5200: ['a52', '7z', 'zip', 'bin'],
  atari7800: ['a78', '7z', 'zip', 'bin']
};

export class App {
  root: HTMLElement;
  input = new InputManager();
  sounds = new SoundManager();

  themeName = 'slate-es-de';
  themeVariant = 'withoutVideos';
  playerEngine: 'retroarch' | 'emulatorjs' = 'retroarch';
  systems: SystemInfo[] = [];
  sysIdx = 0;
  games: GameEntry[] = [];
  gameIdx = 0;
  screen: 'system' | 'gamelist' | 'game' = 'system';

  layout: ThemeLayout | null = null;
  infoTexts: Record<string, string> = {};
  private gamelistRefs: GamelistRefs | null = null;
  private searchPanel: SearchPanel | null = null;
  private coreSelection: Record<string, string> = {};
  favoriteGames: GameEntry[] = [];
  recentGames: GameEntry[] = [];
  private player: PlayerHandle | null = null;
  private busy = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async init() {
    this.showSplash('正在启动 WemuStation…');
    try {
      const cfg = await api.config();
      this.themeName = cfg.theme || this.themeName;
      this.themeVariant = cfg.variant || this.themeVariant;
      this.playerEngine = cfg.player === 'emulatorjs' ? 'emulatorjs' : 'retroarch';
      this.loadCoreSelection();
      await this.loadSystems();
      if (!this.systems.length) throw new Error('没有可用的系统（ROM 目录为空？）');
      this.unhideSplashText();
      void this.probeRetroarchCores();
      void this.loadGraphicsAssets();
      await this.loadSystemTheme(this.systems[this.sysIdx]);
      this.input.on((btn, rawKey) => this.handleInput(btn, rawKey));
      this.input.onExitCombo = () => this.handleExitCombo();
      this.addSettingsButton();
      this.input.onGamepadChange = (n) => {
        if (n > 0) this.toast(`🎮 手柄已连接 (${n})`);
      };
      this.removeSplash();
      await this.renderSystem('view-fade-in');
    } catch (e) {
      this.showSplash(`启动失败：${(e as Error).message}`, true);
      throw e;
    }
  }

  /** 全屏切换：主菜单入口。手柄按键不构成浏览器手势，被拒绝时给出提示 */
  private async toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        this.toast('已退出全屏');
      } else {
        await document.documentElement.requestFullscreen();
        this.toast('已进入全屏');
      }
    } catch {
      this.toast('浏览器拒绝了全屏请求——请用鼠标/触摸点一次该菜单项');
    }
  }

  // ---------- theme ----------
  private async loadSystemTheme(sys: SystemInfo) {
    const themeRoot = new URL(`/themes/${this.themeName}/`, location.origin).href;
    [this.layout, this.infoTexts] = await Promise.all([
      loadTheme({
        themeRoot,
        systemTheme: sys.themeDir,
        variant: this.themeVariant,
        aspectRatio: this.aspect(),
        fontSize: 'medium'
      }),
      this.loadSystemInfo(themeRoot, sys.themeDir)
    ]);
    // (re)load nav sounds in the background; never block input on them
    if (this.soundsLoadedFor !== this.themeName) {
      void this.sounds.preload(themeRoot, this.layout.sounds || {}).then(() => {
        this.soundsLoadedFor = this.themeName;
      });
    }
  }

  private soundsLoaded = false;
  private soundsLoadedFor = '';
  private mainMenu: MainMenuPanel | null = null;

  // 画面设置资源:着色器预设清单(含中文名)/遮罩 cfg 清单
  shaderFiles: { path: string; cn: string }[] = [];
  overlayList: string[] = [];
  graphicsCurrent = { shader: '', overlay: '' };

  private async cfgGet(path: string): Promise<Uint8Array | null> {
    const r = await fetch('/api/storage/get?ns=cfg&path=' + encodeURIComponent(path), { cache: 'no-cache' });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  }

  private async cfgPut(path: string, data: Uint8Array): Promise<void> {
    await fetch('/api/storage/put?ns=cfg&path=' + encodeURIComponent(path), { method: 'POST', body: new Blob([data as BlobPart]) });
  }

  private async loadGraphicsAssets() {
    try {
      const presets: { asciiPath: string; cnName: string }[] = await (await fetch('/retroarch/shaders/presets.json', { cache: 'no-cache' })).json();
      const man: string[] = await (await fetch('/retroarch/shaders/manifest.json', { cache: 'no-cache' })).json();
      const cn = new Map<string, string>();
      for (const p of presets) cn.set(p.asciiPath, p.cnName);
      this.shaderFiles = man
        .filter((f) => f.endsWith('.glslp'))
        .map((f) => ({ path: f, cn: cn.get(f) || '' }));
    } catch { /* 无着色器包 */ }
    try {
      const man: string[] = await (await fetch('/retroarch/overlays/manifest.json', { cache: 'no-cache' })).json();
      this.overlayList = man.filter((f) => f.endsWith('.cfg'));
    } catch { /* 无遮罩包 */ }
  }

  /** 读取当前系统 per-system cfg 里的着色器/遮罩设置(菜单打开时刷新) */
  private async refreshGraphicsCurrent() {
    const sys = this.systems[this.sysIdx];
    if (!sys) return;
    try {
      const bytes = await this.cfgGet('/per-system/' + sys.id.replace(/[^\w.\-]+/g, '_') + '.cfg');
      if (!bytes) { this.graphicsCurrent = { shader: '', overlay: '' }; return; }
      const txt = new TextDecoder().decode(bytes);
      const get = (k: string) => { const m = new RegExp('(?:^|\\n)' + k + ' = "([^"]*)"').exec(txt); return m ? m[1] : ''; };
      const shader = get('video_shader').replace(/^\/home\/web_user\/retroarch\/system\/shaders\//, '');
      // RA 1.22 的遮罩主键是 input_overlay(video_overlay 旧键已不存在),
      // 回退读旧键只为兼容本前端旧版本写入的残留配置
      const overlay = (get('input_overlay') || get('video_overlay'))
        .replace(/^\/home\/web_user\/retroarch\/system\/overlays\//, '');
      this.graphicsCurrent = { shader, overlay };
    } catch { /* ignore */ }
  }

  private async openMainMenu() {
    if (this.mainMenu?.isOpen()) return;
    await this.refreshGraphicsCurrent();
    this.mainMenu = new MainMenuPanel(this.root, this.input, {
      openSettings: () => this.openSettings(),
      openRAMainMenu: () => this.openRAMainMenu(),
      toggleFullscreen: () => this.toggleFullscreen(),
      coreChoices: (function (self: App) {
        const sys = self.systems[self.sysIdx];
        const ids = SYSTEM_CORES[sys.id] || [];
        return {
          items: ids.map((c) => ({ coreId: c, label: coreLabel(c), available: self.retroarchAvailable.has(c), selected: self.selectedRaCore(sys.id) === c })),
          pick: (coreId: string) => {
            self.saveCoreSelection(sys.id, coreId);
            self.toast(`已选择 ${coreLabel(coreId)}：重启游戏后生效`);
          }
        };
      })(this),
      refreshLibrary: async () => {
        await this.loadSystems();
        await this.renderSystem('view-fade-in');
        this.toast('游戏库已刷新');
      },
      themes: ['slate-es-de', 'modern-es-de', 'linear-es-de'],
      currentTheme: this.themeName,
      onThemePick: async (t) => {
        await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: t }) });
        this.themeName = t;
        this.soundsLoadedFor = '';
        await this.loadSystemTheme(this.systems[this.sysIdx]);
        await this.renderSystem('view-fade-in');
        this.toast(`主题已切换：${t}`);
      },
      graphicsChoices: (function (self: App) {
        const cfgPath = (sysId: string) => '/per-system/' + sysId.replace(/[^\w.\-]+/g, '_') + '.cfg';
        // 简易 cfg 行编辑:仅替换已存在的键或追加到末尾
        const getVal = (txt: string, key: string): string => {
          const m = new RegExp('(?:^|\\n)' + key + ' = "([^"]*)"').exec(txt);
          return m ? m[1] : '';
        };
        const setVal = (txt: string, key: string, val: string): string => {
          const re = new RegExp('(?:^|\\n)(' + key + ' = ")[^"]*(")');
          if (re.test(txt)) return txt.replace(re, (m, a, b) => (m.startsWith('\n') ? '\n' : '') + a + val + b);
          return txt.replace(/\s*$/, '\n') + key + ' = "' + val + '"\n';
        };
        return {
          shaderFiles: self.shaderFiles,
          overlayFiles: self.overlayList,
          current: self.graphicsCurrent,
          pick: async (kind: 'shader' | 'overlay', value: string) => {
            const sys = self.systems[self.sysIdx];
            if (!sys) return;
            // 当前系统尚未有过 per-system 配置时,用全局配置播种一份
            let txt = '';
            {
              const bytes = await self.cfgGet(cfgPath(sys.id));
              if (bytes) txt = new TextDecoder().decode(bytes);
              else {
                const g = await self.cfgGet('/userdata/retroarch.cfg');
                txt = g ? new TextDecoder().decode(g) : '';
              }
            }
            if (kind === 'shader') {
              txt = setVal(txt, 'video_shader', '/home/web_user/retroarch/system/shaders/' + value);
              txt = setVal(txt, 'video_shader_enable', value ? 'true' : 'false');
            } else {
              // 必须写 input_overlay:RA 1.22 构建里已没有 video_overlay 键,
              // 写旧键 RA 启动时读不到,遮罩永远不生效
              txt = setVal(txt, 'input_overlay', value ? '/home/web_user/retroarch/system/overlays/' + value : '');
              txt = setVal(txt, 'input_overlay_enable', value ? 'true' : 'false');
            }
            await self.cfgPut(cfgPath(sys.id), new TextEncoder().encode(txt));
            if (kind === 'shader') {
              self.graphicsCurrent.shader = value;
              self.toast(value ? '着色器已保存，重启游戏生效' : '着色器已关闭，重启游戏生效');
            } else {
              self.graphicsCurrent.overlay = value;
              self.toast(value ? '遮罩已保存，重启游戏生效' : '遮罩已关闭，重启游戏生效');
            }
          }
        };
      })(this),
      currentSystem: this.systems[this.sysIdx]
    });
  }

  private async applyTheme(themeName: string) {
    this.themeName = themeName;
    this.soundsLoadedFor = '';
    await this.loadSystemTheme(this.systems[this.sysIdx]);
  }
  // cores with a built RetroArch wasm bundle (probed at startup)
  retroarchAvailable = new Set<string>();

  /** real systems + virtual collections (recent / favorites) into one carousel */
  private async loadSystems() {
    const base = (await api.systems()).filter((s) => EJS_CORES[s.id] || RA_CORES[s.id] || SPECIAL_ENGINES[s.id]);
    try {
      this.favoriteGames = await api.favoriteGames();
      this.recentGames = await api.recentGames();
    } catch { /* keep previous lists on transient errors */ }
    const virtual: SystemInfo[] = [
      { id: 'recent', fullName: '最近游戏', shortName: '最近游戏', manufacturer: '', releaseYear: '', themeDir: 'auto-lastplayed', gameCount: this.recentGames.length },
      { id: 'favorite', fullName: '收藏', shortName: '收藏', manufacturer: '', releaseYear: '', themeDir: 'auto-favorites', gameCount: this.favoriteGames.length }
    ];
    this.systems = [...virtual, ...base];
  }

  private async probeRetroarchCores() {
    const all = new Set<string>(Object.values(RA_CORES));
    for (const list of Object.values(SYSTEM_CORES)) for (const c of list) all.add(c);
    await Promise.all([...all].map(async (core) => {
      try {
        const r = await fetch(`/retroarch/${core}_libretro.js`, { method: 'HEAD' });
        if (r.ok) this.retroarchAvailable.add(core);
      } catch { /* not built */ }
    }));
  }

  /** 系统当前生效的 RA 核心：玩家选择 > 每系统默认 */
  private selectedRaCore(sysId: string): string | undefined {
    const picked = this.coreSelection[sysId];
    if (picked && (RA_CORES[sysId] === picked || SYSTEM_CORES[sysId]?.includes(picked))) return picked;
    return RA_CORES[sysId];
  }

  private loadCoreSelection() {
    try { this.coreSelection = JSON.parse(localStorage.getItem('wemu-core-sel') || '{}'); } catch { this.coreSelection = {}; }
  }

  private saveCoreSelection(sysId: string, coreId: string) {
    this.coreSelection[sysId] = coreId;
    try { localStorage.setItem('wemu-core-sel', JSON.stringify(this.coreSelection)); } catch { /* ignore */ }
  }

  private async loadSystemInfo(themeRoot: string, themeDir: string): Promise<Record<string, string>> {
    try {
      const r = await fetch(`${themeRoot}${themeDir}/systeminfo.xml`);
      if (!r.ok) return {};
      const { parseXML, kids, kid, txt } = await import('./theme/xml');
      const doc = parseXML(await r.text());
      const out: Record<string, string> = {};
      for (const view of kids(doc, 'view')) {
        if ((view.attrs.name || '') !== 'system') continue;
        for (const text of kids(view, 'text')) {
          const name = text.attrs.name || '';
          const t = kid(text, 'text');
          if (name && t) out[name] = txt(t);
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  private aspect(): string {
    return window.innerWidth / window.innerHeight > 1.2 ? '16:9' : '4:3';
  }

  private renderCtxBase() {
    return {
      W: window.innerWidth,
      H: window.innerHeight,
      helpEntries: this.screen === 'gamelist'
        ? ['↑↓ 选择', '←→ 翻页', '⏎/A 运行', 'Y 收藏', 'X/F 搜索', 'Esc/B 返回', 'F1 菜单']
        : ['← → 选择系统', '⏎/A 进入', 'F1 添加游戏'],
      infoTexts: this.infoTexts,
      gameCount: this.screen === 'gamelist' ? this.games.length : this.systems[this.sysIdx]?.gameCount
    };
  }

  // ---------- views ----------
  private async renderSystem(anim = '', slideDir: -1 | 0 | 1 = 0) {
    if (!this.layout) return;
    this.mainMenu?.close();
    this.mainMenu = null;
    this.screen = 'system';
    const sys = this.systems[this.sysIdx];
    await renderSystemView(this.root, {
      layout: this.layout,
      systems: this.systems,
      currentIdx: this.sysIdx,
      systemVars: makeSystemVars(sys),
      ctx: this.renderCtxBase(),
      slideDir
    });
    if (anim) this.root.firstElementChild?.classList.add(anim);
  }

  private async renderGamelist() {
    if (!this.layout) return;
    const sys = this.systems[this.sysIdx];
    // virtual collections read from the server-side favorites/recent stores
    // (always re-fetched on entry — they may have changed on another device)
    let games: GameEntry[];
    if (sys.id === 'favorite') {
      games = this.favoriteGames = await api.favoriteGames();
      this.toast(this.favoriteGames.length ? '' : '还没有收藏，在游戏列表按 Y 收藏');
    } else if (sys.id === 'recent') {
      games = this.recentGames = await api.recentGames();
      this.toast(this.recentGames.length ? '' : '还没有游戏记录，运行一局即会出现');
    } else {
      games = (await api.games(sys.id)).games;
    }
    this.games = games;
    this.gameIdx = 0;
    if (!this.games.length) {
      if (sys.id !== 'favorite' && sys.id !== 'recent') {
        this.toast(`「${sys.fullName}」还没有游戏，按 F1 导入 ROM`);
      }
      return;
    }
    this.screen = 'gamelist';
    this.sounds.play('select');
    this.gamelistRefs = await renderGamelistView(this.root, {
      layout: this.layout,
      system: sys,
      games: this.games,
      selIdx: this.gameIdx,
      systemVars: makeSystemVars(sys),
      ctxBase: this.renderCtxBase()
    });
    this.gamelistRefs.root.addEventListener('gamelist-select', ((e: CustomEvent) => {
      this.gameIdx = e.detail;
      this.gamelistRefs?.updateSelection(this.gameIdx);
      this.sounds.play('scroll');
    }) as EventListener);
  }

  private exitArmedUntil = 0;

  /** ES-DE style double-press confirmation: first Select+Start arms, second
   *  press within 2.5s actually exits the game back to the frontend. */
  private handleExitCombo() {
    if (this.screen !== 'game') return;
    var now = Date.now();
    if (this.exitArmedUntil && now < this.exitArmedUntil) {
      this.exitArmedUntil = 0;
      this.exitGame();
      return;
    }
    this.exitArmedUntil = now + 2500;
    this.toast('再按一次 Select+Start 确认退出');
  }

  // ---------- input ----------
  private async handleInput(btn: string, rawKey?: string) {
    if (btn === 'settings') {
      this.openSettings();
      return;
    }
    if (btn === 'ramenu') {
      this.openRAMainMenu();
      return;
    }
    // the ES-style main menu swallows all frontend input while open
    if (this.mainMenu?.isOpen()) {
      this.mainMenu.handle(btn as never);
      return;
    }
    // the search overlay eats everything: keyboard goes to its <input>,
    // gamepad arrives here and is routed to the result list
    if (this.searchPanel?.isOpen()) {
      this.searchPanel.handle(btn);
      return;
    }
    if (this.busy) return;

    // Start/Select open the main menu on frontend screens (like ES-DE).
    // NOTE: only 'menu' here — 'option' (Y) must fall through so the
    // gamelist can bind it to search.
    if (btn === 'menu' && (this.screen === 'system' || this.screen === 'gamelist')) {
      this.openMainMenu();
      return;
    }
    if (this.screen === 'game') {
      // While playing, single buttons/keys belong to the emulated game —
      // only these act on the shell:
      //   Select+Start twice (within 2.5s) → exit to frontend (ES-DE style
      //   double-press confirmation, first press shows a hint)
      //   keyboard Esc                     → exit
      //   keyboard F1 / gamepad L3         → RA quick menu (inside RA itself)
      return;
    }
    switch (this.screen) {
      case 'system':
        if (btn === 'left' || btn === 'right') await this.moveSystem(btn === 'right' ? 1 : -1);
        else if (btn === 'accept') await this.enterGamelist();
        else if (btn === 'menu' || btn === 'option') this.openMainMenu();
        break;
      case 'gamelist':
        if (btn === 'up' || btn === 'down') {
          const delta = btn === 'down' ? 1 : -1;
          if (!this.games.length) return;
          this.gameIdx = (this.gameIdx + delta + this.games.length) % this.games.length;
          this.gamelistRefs?.updateSelection(this.gameIdx);
          this.sounds.play('scroll');
        } else if (btn === 'left' || btn === 'right') {
          // page jump by the number of visible list rows (no wrap — a page
          // past the end clamps, like ES-DE's letter jumps)
          if (!this.games.length) return;
          const page = Math.max(1, (this.gamelistRefs ? this.gamelistRefs.pageSize() : 0) || 1);
          const next = btn === 'right'
            ? Math.min(this.games.length - 1, this.gameIdx + page)
            : Math.max(0, this.gameIdx - page);
          if (next !== this.gameIdx) {
            this.gameIdx = next;
            this.gamelistRefs?.updateSelection(this.gameIdx);
            this.sounds.play('scroll');
          }
        } else if (btn === 'accept') {
          this.startGame();
        } else if (btn === 'cancel') {
          this.sounds.play('back');
          await this.renderSystem('view-fade-in');
        } else if (btn === 'search') {
          this.openSearch();
        } else if (btn === 'favorite' || btn === 'option') {
          // Y toggles favorite — ES-DE convention
          this.toggleFavorite();
        } else if (btn === 'menu') {
          this.openMainMenu();
        }
        break;
    }
  }

  private async moveSystem(delta: number) {
    if (this.busy || this.systems.length < 2) return;
    this.busy = true;
    this.sysIdx = (this.sysIdx + delta + this.systems.length) % this.systems.length;
    try {
      await this.loadSystemTheme(this.systems[this.sysIdx]);
      // no view-level slide: the background/bands stay put (like ES-DE),
      // only the carousel slides directionally via slideDir
      await this.renderSystem('', delta > 0 ? 1 : -1);
      this.sounds.play('quicksysselect');
    } finally {
      this.busy = false;
    }
  }

  private async enterGamelist() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.renderGamelist();
    } finally {
      this.busy = false;
    }
  }

  private openSearch() {
    if (!this.games.length) return;
    if (!this.searchPanel) {
      this.searchPanel = new SearchPanel(this.root);
    }
    this.searchPanel.open(this.games, (idx) => {
      this.gameIdx = idx;
      this.gamelistRefs?.updateSelection(this.gameIdx);
      this.startGame();
    });
  }

  /** toggle favorite on the selected game (server-side, follows the user) */
  private async toggleFavorite() {
    const sys = this.systems[this.sysIdx];
    const g = this.games[this.gameIdx];
    if (!g) return;
    const key = (g.sysId || sys.id) + '/' + g.fileName;
    try {
      const r = await api.toggleFavorite(key);
      g.favorite = r.favorite;
      this.toast(r.favorite ? '★ 已收藏' : '已取消收藏');
      this.sounds.play(r.favorite ? 'select' : 'back');
      if (sys.id === 'favorite' && !r.favorite) {
        // unfavorite while inside the favorites collection: drop the entry
        this.favoriteGames = this.favoriteGames.filter((x) => !(x.sysId === g.sysId && x.fileName === g.fileName));
        this.games = this.favoriteGames;
        this.gameIdx = Math.min(this.gameIdx, Math.max(0, this.games.length - 1));
        if (this.games.length) {
          await this.renderGamelist();
        } else {
          this.gamelistRefs?.root.remove();
          this.gamelistRefs = null;
          this.screen = 'system';
          await this.renderSystem('view-fade-in');
        }
      }
    } catch {
      this.toast('收藏失败（服务器不可用？）');
    }
  }

  // ---------- game ----------
  private startGame() {
    const sys = this.systems[this.sysIdx];
    const game = this.games[this.gameIdx];
    if (!sys || !game) return;
    // favorites/recent entries carry their real system id
    const coreId = game.sysId || sys.id;
    // PSP 等专用引擎系统：走独立 PPSSPP wasm（RetroArch 无 PSP 核心，EJS 也没有）
    const engine: PlayerEngine = SPECIAL_ENGINES[coreId] ?? this.playerEngine;
    const raCore = this.selectedRaCore(coreId);
    const ejsCore = EJS_CORES[coreId];
    let core = engine === 'retroarch' ? raCore : engine === 'ppsspp' ? 'ppsspp' : ejsCore;
    if (!core) {
      // RA 引擎缺核心但 EJS 有 → 自动回退 EJS
      if (ejsCore) {
        this.toast(`${sys.fullName} 使用 EmulatorJS 引擎运行`);
        return this.startGameEJS(ejsCore);
      }
      this.toast(`暂不支持 ${sys.fullName}`);
      return;
    }
    if (engine === 'retroarch' && !this.retroarchAvailable.has(core)) {
      if (!ejsCore) {
        this.toast(`RetroArch 核心尚未构建，且 ${sys.fullName} 无 EmulatorJS 备选`);
        return;
      }
      this.toast('RetroArch 核心尚未构建，回退 EmulatorJS 引擎');
      return this.startGameEJS(ejsCore);
    }
    this.sounds.play('launch');
    this.screen = 'game';
    document.body.classList.add('in-game'); // hide help bar + gear button
    this.player = launchGame(this.root, sys, game, core, engine, () => this.exitGame());
    // record in the server-side "recently played" list (fire and forget)
    void api.recentAdd({
      sysId: coreId,
      fileName: game.fileName,
      name: game.name,
      image: game.image,
      video: game.video || '',
      url: game.url
    }).then(() => {
      this.recentGames = this.recentGames.filter((g) => !(g.sysId === coreId && g.fileName === game.fileName));
      this.recentGames.unshift({ ...game, sysId: coreId, ts: Date.now() } as GameEntry);
      this.recentGames = this.recentGames.slice(0, 50);
    }).catch(() => {});
    this.toast(engine === 'ppsspp'
      ? 'Esc 呼出 PSP 菜单 · 手柄 Select+Start 退出'
      : engine === 'retroarch'
        ? 'Select+Start 退出 · Select+X 呼出 RA 菜单'
        : 'Esc 退出游戏（手柄 Start+Select）');
  }

  /** Boot RetroArch straight into its main menu (settings), no game loaded. */
  private openRAMainMenu() {
    if (this.playerEngine !== 'retroarch') {
      this.toast('RA 主菜单仅支持 RetroArch 引擎');
      return;
    }
    const sys = this.systems[this.sysIdx];
    const core = RA_CORES[sys.id] || 'fceumm';
    this.screen = 'game';
    document.body.classList.add('in-game');
    this.player = launchGame(this.root, sys, null, core, 'retroarch', () => this.exitGameToSystem());
    this.toast('方向键移动 · X 确认 · 改完到 Configuration File → Save Configuration 保存');
  }

  private exitGameToSystem() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    document.body.classList.remove('in-game');
    void this.renderSystem('view-fade-in');
  }

  private startGameEJS(core: string) {
    const sys = this.systems[this.sysIdx];
    const game = this.games[this.gameIdx];
    this.screen = 'game';
    this.player = launchGame(this.root, sys, game, core, 'emulatorjs', () => this.exitGame());
  }

  private exitGame() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    document.body.classList.remove('in-game');
    this.screen = 'gamelist';
    // 退出后列表保留原选中项(renderGamelist 默认会重置到第一项)
    const resumeIdx = this.gameIdx;
    void this.enterGamelist().then(() => {
      if (this.gamelistRefs && this.games[resumeIdx]) {
        this.gameIdx = resumeIdx;
        this.gamelistRefs.updateSelection(resumeIdx);
      }
    });
  }

  // ---------- settings / menus ----------
  private openRAMenu() {
    // inside a running game: toggle the RA quick menu in place
    this.player?.post({ type: 'ra-command', cmd: 'toggle-menu' });
  }

  private openSettings() {
    if (this.screen === 'game') return;
    openSettingsPanel(document.body, this.input, () => this.openRAMainMenu());
  }

  private addSettingsButton() {
    const btn = document.createElement('button');
    btn.className = 'gear-btn';
    btn.title = '按键设置（F2）';
    btn.textContent = '⚙';
    btn.onclick = () => this.openSettings();
    // body, not #app: view re-renders wipe #app's children
    document.body.appendChild(btn);
  }

  // ---------- ui utils ----------
  private toast(msg: string) {
    const t = document.createElement('div');
    t.className = 'wemu-toast';
    t.textContent = msg;
    this.root.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  private showSplash(msg: string, error = false) {
    let sp = document.querySelector('.boot-splash') as HTMLElement | null;
    if (!sp) {
      sp = document.createElement('div');
      sp.className = 'boot-splash';
      sp.innerHTML = '<div class="spin"></div><div class="msg"></div>';
      this.root.appendChild(sp);
    }
    const m = sp.querySelector('.msg') as HTMLElement;
    m.textContent = msg;
    m.classList.toggle('error', error);
    if (error) sp.querySelector('.spin')?.remove();
  }

  private unhideSplashText() { /* reserved */ }
  private removeSplash() {
    document.querySelector('.boot-splash')?.remove();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
