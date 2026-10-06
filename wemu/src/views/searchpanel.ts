// Game search overlay: keyboard-typing search over the current system's list.
// Matches the raw name and its pinyin initials (拳皇97 -> qh97), so Chinese
// libraries can be searched by initials ("mlst" -> 马里奥赛车...). Opened with
// the Y button / F key from the gamelist; closed with Esc/B.
import type { GameEntry } from '../types';
import { ensurePinyin, initials } from '../util/pinyin';

const MAX_RESULTS = 60;

export class SearchPanel {
  private overlay: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private games: GameEntry[] = [];
  private hay: string[] = [];       // lowercase name + initials, per game
  private hayFor: GameEntry[] | null = null; // games array the index was built for
  private resultIdx: number[] = []; // games indices currently listed
  private sel = 0;
  private onPick: (gameIdx: number) => void = () => {};

  constructor(root: HTMLElement) {
    const overlay = document.createElement('div');
    overlay.className = 'wemu-search-overlay';
    const panel = document.createElement('div');
    panel.className = 'wemu-search-panel';

    const input = document.createElement('input');
    input.className = 'wemu-search-input';
    input.placeholder = '搜索游戏…（支持拼音首字母，如 kof、mlst）';
    input.spellcheck = false;

    const listEl = document.createElement('div');
    listEl.className = 'wemu-search-results';

    const hintEl = document.createElement('div');
    hintEl.className = 'wemu-search-hint';
    hintEl.textContent = '↑↓ 选择 · ⏎/A 运行 · Esc/B 关闭';

    panel.append(input, listEl, hintEl);
    overlay.appendChild(panel);
    root.appendChild(overlay);

    input.addEventListener('input', () => this.filter(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.pick(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });

    this.overlay = overlay;
    this.input = input;
    this.listEl = listEl;
    this.hintEl = hintEl;
  }

  isOpen() { return this.overlay !== null && this.overlay.style.display !== 'none'; }

  async open(games: GameEntry[], onPick: (gameIdx: number) => void) {
    this.games = games;
    this.onPick = onPick;
    if (!this.overlay) return;
    this.overlay.style.display = '';
    if (this.input) {
      this.input.value = '';
      // defer so the overlay is visible before focus steals the caret
      setTimeout(() => this.input?.focus(), 0);
    }
    this.filter('');
    // build the initials index in the background (one pinyin call per name;
    // ~1700 names is fast, but stay async so the panel paints immediately)
    if (this.hayFor !== games) {
      const py = await ensurePinyin();
      this.hay = games.map((g) => (g.name + ' ' + py(g.name)).toLowerCase());
      this.hayFor = games;
      this.filter(this.input?.value || '');
    }
  }

  close() {
    if (this.overlay) this.overlay.style.display = 'none';
    if (this.input) this.input.blur();
  }

  /** gamepad routing while the panel is open (keyboard goes to the input) */
  handle(btn: string) {
    if (btn === 'up') this.move(-1);
    else if (btn === 'down') this.move(1);
    else if (btn === 'accept') this.pick();
    else if (btn === 'cancel' || btn === 'menu' || btn === 'option' || btn === 'search') this.close();
  }

  private move(delta: number) {
    if (!this.resultIdx.length) return;
    this.sel = (this.sel + delta + this.resultIdx.length) % this.resultIdx.length;
    this.renderSelection();
  }

  private pick() {
    const gi = this.resultIdx[this.sel];
    if (gi === undefined) return;
    this.close();
    this.onPick(gi);
  }

  private filter(raw: string) {
    if (!this.listEl) return;
    const q = raw.trim().toLowerCase();
    this.resultIdx = [];
    if (!q) {
      // empty query: browse the first MAX_RESULTS entries
      for (let i = 0; i < this.games.length && i < MAX_RESULTS; i++) this.resultIdx.push(i);
    } else {
      for (let i = 0; i < this.games.length; i++) {
        const name = this.games[i].name.toLowerCase();
        if (name.includes(q) || (this.hay.length === this.games.length && this.hay[i].includes(q))) {
          this.resultIdx.push(i);
          if (this.resultIdx.length >= MAX_RESULTS) break;
        }
      }
    }
    this.sel = 0;
    this.renderResults();
  }

  private renderResults() {
    const list = this.listEl;
    if (!list) return;
    list.innerHTML = '';
    if (!this.resultIdx.length) {
      const empty = document.createElement('div');
      empty.className = 'wemu-search-empty';
      empty.textContent = this.games.length && this.hayFor !== this.games ? '正在建立拼音索引…' : '没有匹配的游戏';
      list.appendChild(empty);
      return;
    }
    this.resultIdx.forEach((gi, r) => {
      const row = document.createElement('div');
      row.className = 'wemu-search-row' + (r === this.sel ? ' selected' : '');
      row.textContent = this.games[gi].name;
      row.addEventListener('click', () => {
        this.sel = r;
        this.pick();
      });
      row.addEventListener('mousemove', () => {
        if (this.sel !== r) { this.sel = r; this.renderSelection(); }
      });
      list.appendChild(row);
    });
    this.renderSelection();
  }

  private renderSelection() {
    const list = this.listEl;
    if (!list) return;
    const rows = list.querySelectorAll<HTMLElement>('.wemu-search-row');
    rows.forEach((r, i) => r.classList.toggle('selected', i === this.sel));
    const selRow = rows[this.sel] as HTMLElement | undefined;
    if (selRow) {
      const top = selRow.offsetTop, h = selRow.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + h > list.scrollTop + list.clientHeight) list.scrollTop = top + h - list.clientHeight;
    }
  }
}
