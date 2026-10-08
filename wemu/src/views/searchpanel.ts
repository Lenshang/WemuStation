// Game search overlay: searchable by raw name and pinyin initials
// (拳皇97 -> qh97). Two input paths share one state:
//  - physical keyboard types into the <input> directly
//  - gamepad navigates an on-screen keyboard (dpad + A), so the couch-only
//    player can search without a keyboard
// Opened with X/Y/F from the gamelist; closed with B/Esc.
import type { GameEntry } from '../types';
import { ensurePinyin, initials } from '../util/pinyin';

const MAX_RESULTS = 60;

// on-screen keyboard rows (grid is 10 columns wide)
const KEY_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '⌫'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '空格', '清空']
];

export class SearchPanel {
  private overlay: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private keyCells: HTMLElement[][] = [];
  private games: GameEntry[] = [];
  private hay: string[] = [];       // lowercase name + initials, per game
  private hayFor: GameEntry[] | null = null;
  private resultIdx: number[] = []; // games indices currently listed
  private sel = 0;
  private zone: 'keys' | 'results' = 'keys';
  private keyRow = 1;
  private keyCol = 0;
  private onPick: (gameIdx: number) => void = () => {};

  constructor(_root: HTMLElement) {
    const overlay = document.createElement('div');
    overlay.className = 'wemu-search-overlay';
    const panel = document.createElement('div');
    panel.className = 'wemu-search-panel';

    const input = document.createElement('input');
    input.className = 'wemu-search-input';
    input.placeholder = '搜索…（拼音首字母，如 kof / mlst）';
    input.spellcheck = false;

    const osk = document.createElement('div');
    osk.className = 'wemu-osk';
    const cells: HTMLElement[][] = [];
    KEY_ROWS.forEach((row, r) => {
      for (const k of row) {
        if (k === '') continue;
        const cell = document.createElement('div');
        cell.className = 'wemu-osk-key' + (k === '空格' ? ' wide' : '');
        cell.textContent = k;
        cell.addEventListener('click', () => this.activateKey(k));
        osk.appendChild(cell);
        (cells[r] = cells[r] || []).push(cell);
        cell.dataset.row = String(r);
        cell.dataset.key = k;
      }
    });

    const listEl = document.createElement('div');
    listEl.className = 'wemu-search-results';

    const hintEl = document.createElement('div');
    hintEl.className = 'wemu-search-hint';
    hintEl.textContent = 'A 确认 · B 关闭 · ↑↓ 键盘/结果切换 · 也可直接用键盘输入';

    panel.append(input, osk, listEl, hintEl);
    overlay.appendChild(panel);
    // 挂 body：#app 会在每次视图重建时被清空，挂那里会被连根移除
    document.body.appendChild(overlay);

    input.addEventListener('input', () => { this.query = input.value; this.filter(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.zone = 'results'; this.renderFocus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.pick(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });

    this.overlay = overlay;
    this.input = input;
    this.listEl = listEl;
    this.hintEl = hintEl;
    this.keyCells = cells.filter(Boolean) as HTMLElement[][];
  }

  isOpen() { return this.overlay !== null && this.overlay.style.display !== 'none'; }

  async open(games: GameEntry[], onPick: (gameIdx: number) => void) {
    this.games = games;
    this.onPick = onPick;
    if (!this.overlay) return;
    if (!this.overlay.isConnected) document.body.appendChild(this.overlay);
    this.overlay.style.display = '';
    this.zone = 'keys';
    this.keyRow = 1; this.keyCol = 0;
    if (this.input) {
      this.input.value = '';
      setTimeout(() => this.input?.focus(), 0);
    }
    this.query = '';
    this.filter();
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
    if (btn === 'up') this.navVertical(-1);
    else if (btn === 'down') this.navVertical(1);
    else if (btn === 'left') this.navHorizontal(-1);
    else if (btn === 'right') this.navHorizontal(1);
    else if (btn === 'accept') this.activate();
    else if (btn === 'cancel' || btn === 'menu' || btn === 'search') this.close();
    else if (btn === 'option') { // Y = backspace shortcut on the keyboard
      if (this.zone === 'keys') this.activateKey('⌫');
    }
  }

  private query = '';

  private navHorizontal(delta: number) {
    if (this.zone === 'keys') {
      const row = KEY_ROWS[this.keyRow] || [];
      this.keyCol = Math.max(0, Math.min(row.length - 1, this.keyCol + delta));
      this.renderFocus();
    } else {
      this.move(delta);
    }
  }

  private navVertical(delta: number) {
    if (this.zone === 'keys') {
      const next = this.keyRow + delta;
      if (next < 0) return;
      if (next >= KEY_ROWS.length) {
        if (this.resultIdx.length) { this.zone = 'results'; this.sel = 0; this.renderFocus(); }
        return;
      }
      this.keyRow = next;
      this.keyCol = Math.min(this.keyCol, Math.max(0, (KEY_ROWS[this.keyRow] || []).length - 1));
      this.renderFocus();
    } else {
      this.move(delta);
    }
  }

  private activate() {
    if (this.zone === 'keys') {
      const k = (KEY_ROWS[this.keyRow] || [])[this.keyCol];
      if (k) this.activateKey(k);
    } else {
      this.pick();
    }
  }

  private activateKey(k: string) {
    if (k === '⌫') this.query = this.query.slice(0, -1);
    else if (k === '空格') this.query += ' ';
    else if (k === '清空') this.query = '';
    else this.query += k.toLowerCase();
    if (this.input) this.input.value = this.query;
    this.filter();
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

  private filter(query?: string) {
    if (!this.listEl) return;
    const q = this.query.trim().toLowerCase();
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
    this.renderFocus();
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

  private renderFocus() {
    for (const row of this.keyCells) {
      for (const cell of row) {
        const r = Number(cell.dataset.row);
        const k = cell.dataset.key || '';
        const col = (KEY_ROWS[r] || []).indexOf(k);
        cell.classList.toggle('focus', this.zone === 'keys' && r === this.keyRow && col === this.keyCol);
      }
    }
  }
}
