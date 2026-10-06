// Unified input: keyboard + Gamepad API → semantic NavButton events with
// ES-DE-style key repeat. Bindings (keyboard keys & gamepad button indices)
// are user-configurable and persisted in localStorage.
import type { NavButton } from '../types';

type Handler = (btn: NavButton | 'settings' | 'ramenu', rawKey?: string) => void | Promise<void>;

export interface Bindings {
  keys: Record<string, NavButton>;  // normalized e.key -> action
  pad: Record<number, NavButton>;   // gamepad button index -> action
}

export const ACTIONS: NavButton[] = ['up', 'down', 'left', 'right', 'accept', 'cancel', 'menu', 'option', 'search', 'favorite'];

export const DEFAULT_BINDINGS: Bindings = {
  keys: {
    arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    enter: 'accept', ' ': 'accept', x: 'accept',
    escape: 'cancel', backspace: 'cancel', z: 'cancel',
    f1: 'menu', tab: 'menu',
    f2: 'option',
    f: 'search',
    c: 'favorite'
  },
  pad: {
    12: 'up', 13: 'down', 14: 'left', 15: 'right', // dpad
    0: 'accept',  // south (Xbox A) = accept
    1: 'cancel',  // east  (Xbox B) = back
    2: 'search',  // west  (Xbox X) = search (gamelist)
    3: 'option',  // north  (Xbox Y) = options
    9: 'menu',    // start
    8: 'option'   // select/back
  }
};

const REPEAT_DELAY = 420;  // ms before first repeat
const REPEAT_RATE = 130;   // ms between repeats
const POLL_MS = 12;

const STORE_KEY = 'wemu-bindings-v3'; // v3: pad X repurposed to search
const COMBO_KEY = 'wemu-combos-v1';

export interface ComboConfig {
  exit: number[];   // gamepad buttons held together → exit to frontend (default Select+Start)
  menu: number[];   // gamepad buttons held together → RetroArch menu (default Select+X)
}

export const DEFAULT_COMBOS: ComboConfig = {
  exit: [8, 9],  // Select + Start
  menu: [8, 2]   // Select + X
};

export class InputManager {
  private handlers = new Set<Handler>();
  private held = new Map<NavButton, number>();
  private firstFire = new Set<NavButton>();
  private timerId = 0;
  gamepadCount = 0;
  onGamepadChange?: (count: number) => void;
  exitCombo = false;
  menuCombo = false;
  private prevExitCombo = false;
  /** fired once per NEW hold of the exit combo (edge, not level) */
  onExitCombo?: () => void;

  bindings: Bindings = InputManager.load();
  combos: ComboConfig = InputManager.loadCombos();

  static loadCombos(): ComboConfig {
    try {
      const raw = localStorage.getItem(COMBO_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.exit) && Array.isArray(parsed.menu)) return parsed;
      }
    } catch { /* fallthrough */ }
    return JSON.parse(JSON.stringify(DEFAULT_COMBOS));
  }

  saveCombos() {
    try { localStorage.setItem(COMBO_KEY, JSON.stringify(this.combos)); } catch { /* ignore */ }
  }

  resetCombos() {
    this.combos = JSON.parse(JSON.stringify(DEFAULT_COMBOS));
    this.saveCombos();
  }

  // when set, the next keyboard/gamepad press is consumed as a rebinding
  private captureTarget: { action: NavButton, device: 'keys' | 'pad', resolve: (v: string | number) => void } | null = null;

  static load(): Bindings {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          keys: { ...DEFAULT_BINDINGS.keys, ...(parsed.keys || {}) },
          pad: { ...DEFAULT_BINDINGS.pad, ...(parsed.pad || {}) }
        };
      }
    } catch { /* fallthrough */ }
    return JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }

  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.bindings)); } catch { /* ignore */ }
  }

  resetBindings() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.save();
  }

  // capture the next press (keyboard or gamepad) as a new binding
  capture(action: NavButton, device: 'keys' | 'pad'): Promise<string | number> {
    this.captureTarget = { action, device, resolve: () => {} };
    return new Promise((resolve) => {
      this.captureTarget!.resolve = resolve;
    });
  }

  cancelCapture() {
    this.captureTarget = null;
  }

  constructor() {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('gamepadconnected', this.onPadEvent);
    window.addEventListener('gamepaddisconnected', this.onPadEvent);
    this.timerId = window.setInterval(this.loop, POLL_MS);
  }

  on(fn: Handler): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  keyLabel(action: NavButton): string {
    for (const [k, v] of Object.entries(this.bindings.keys)) if (v === action) return k === ' ' ? 'Space' : k.toUpperCase();
    return '—';
  }

  padLabel(action: NavButton): string {
    for (const [k, v] of Object.entries(this.bindings.pad)) if (v === action) return 'Btn ' + k;
    return '—';
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;

    // F2 opens the settings panel, F3 boots the RetroArch main menu
    if (e.key === 'F2') {
      e.preventDefault();
      for (const h of this.handlers) h('settings');
      return;
    }
    if (e.key === 'F3') {
      e.preventDefault();
      for (const h of this.handlers) h('ramenu');
      return;
    }

    const norm = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    if (this.captureTarget && this.captureTarget.device === 'keys') {
      e.preventDefault();
      const target = this.captureTarget;
      this.bindings.keys[norm] = target.action;
      // unbind the key from any other action to keep maps one-to-one
      for (const [k, v] of Object.entries(this.bindings.keys)) {
        if (k !== norm && v === target.action) delete this.bindings.keys[k];
      }
      this.save();
      target.resolve(norm);
      this.captureTarget = null;
      return;
    }
    const btn = this.bindings.keys[norm];
    if (!btn) return;
    e.preventDefault();
    this.fire(btn, e.key);
  };

  private onPadEvent = () => {
    this.gamepadCount = this.getGamepads().length;
    this.onGamepadChange?.(this.gamepadCount);
  };

  private getGamepads(): Gamepad[] {
    if (!navigator.getGamepads) return [];
    return Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p);
  }

  private padState(): { pressed: Set<NavButton>, exitCombo: boolean, menuCombo: boolean } {
    const pressed = new Set<NavButton>();
    let exitCombo = false;
    let menuCombo = false;
    const comboHeld = (pad: Gamepad, combo: number[]) =>
      combo.length > 0 && combo.every((i) => pad.buttons[i]?.pressed || pad.buttons[i]?.value > 0.55);
    for (const pad of this.getGamepads()) {
      pad.buttons.forEach((b, i) => {
        if (!(b.pressed || b.value > 0.55)) return;
        if (this.captureTarget && this.captureTarget.device === 'pad') {
          const target = this.captureTarget;
          this.bindings.pad[i] = target.action;
          for (const [k, v] of Object.entries(this.bindings.pad)) {
            if (Number(k) !== i && v === target.action) delete this.bindings.pad[Number(k)];
          }
          this.save();
          target.resolve(i);
          this.captureTarget = null;
          return;
        }
        const mapped = this.bindings.pad[i];
        if (mapped) pressed.add(mapped);
      });
      const b = (i: number) => pad.buttons[i]?.pressed;
      // gamepad combos (work while a game is running; the shell ignores
      // single buttons then, they belong to the emulated game)
      if (comboHeld(pad, this.combos.exit)) exitCombo = true;   // default: Select+Start
      if (pad.buttons[4]?.pressed && pad.buttons[5]?.pressed) exitCombo = true; // L1+R1 common alternative
      if (comboHeld(pad, this.combos.menu)) menuCombo = true;   // default: Select+X → RetroArch menu
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      if (ax < -0.5) pressed.add('left');
      if (ax > 0.5) pressed.add('right');
      if (ay < -0.5) pressed.add('up');
      if (ay > 0.5) pressed.add('down');
    }
    return { pressed, exitCombo, menuCombo };
  }

  private loop = () => {
    const { pressed, exitCombo, menuCombo } = this.padState();
    this.exitCombo = exitCombo;
    this.menuCombo = menuCombo;
    if (exitCombo && !this.prevExitCombo && this.onExitCombo) this.onExitCombo();
    this.prevExitCombo = exitCombo;

    for (const btn of pressed) {
      if (!this.held.has(btn)) {
        this.fire(btn);
        this.held.set(btn, performance.now());
        this.firstFire.add(btn);
      }
    }
    for (const btn of Array.from(this.held.keys())) {
      if (!pressed.has(btn)) {
        this.held.delete(btn);
        this.firstFire.delete(btn);
      }
    }
    const now = performance.now();
    for (const [btn, last] of this.held) {
      const isDir = btn === 'up' || btn === 'down' || btn === 'left' || btn === 'right';
      if (!isDir) continue;
      const delay = this.firstFire.has(btn) ? REPEAT_DELAY : REPEAT_RATE;
      if (now - last >= delay) {
        this.fire(btn);
        this.held.set(btn, now);
        this.firstFire.delete(btn);
      }
    }
  };

  private fire(btn: NavButton, rawKey?: string) {
    for (const h of this.handlers) h(btn, rawKey);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    clearInterval(this.timerId);
  }
}
