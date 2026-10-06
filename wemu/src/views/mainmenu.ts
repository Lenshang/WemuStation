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
  themes: string[];
  currentTheme: string;
  onThemePick: (theme: string) => Promise<void>;
  currentSystem: SystemInfo;
}

const THEME_LABELS: Record<string, string> = {
  'slate-es-de': 'Slate（默认）',
  'modern-es-de': 'Modern',
  'linear-es-de': 'Linear'
};

const THEME_MARK = ' ✓';

export class MainMenuPanel {
  private el: HTMLDivElement;
  private listEl!: HTMLDivElement;
  private titleEl!: HTMLDivElement;
  private idx = 0;
  private closed = false;
  private inThemes = false;

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
    return [
      { label: '配置按键', act: () => { this.close(); this.act.openSettings(); } },
      { label: 'RA 主菜单（语言 / 着色器 / 手柄…）', act: () => { this.close(); this.act.openRAMainMenu(); } },
      { label: '切换主题', act: () => { this.inThemes = true; this.idx = 0; this.render(); } },
      { label: '刷新游戏库', act: async () => { this.close(); await this.act.refreshLibrary(); } }
    ];
  }

  private render() {
    const items = this.items();
    this.el.innerHTML = '';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'mainmenu-title';
    this.titleEl.textContent = this.inThemes ? '切换主题' : '主菜单';
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
      case 'cancel': this.close(); break;
      default: break;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.el.remove();
  }
}
