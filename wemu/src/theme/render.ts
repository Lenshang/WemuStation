// Theme element rendering: turns ThemeElement props into DOM nodes.
// ES-DE coordinates are relative to screen (0..1); origin is the element's own
// anchor expressed as a fraction of its size.
import type { ThemeLayout, ThemeElement, GameEntry } from '../types';
import { expandVars } from './parser';

export interface RenderCtx {
  layout: ThemeLayout;
  systemVars: Record<string, string>;
  W: number;
  H: number;
  game?: GameEntry | null;
  helpEntries?: string[];
  infoTexts?: Record<string, string>;
  gameCount?: number;
}

// ---------- fonts ----------
const fontCache = new Map<string, string>(); // url -> family

export async function loadThemeFont(url: string): Promise<string> {
  const hit = fontCache.get(url);
  if (hit) return hit;
  const family = 'wemu-theme-' + (fontCache.size + 1);
  try {
    const face = new FontFace(family, `url(${url})`);
    await face.load();
    (document.fonts as FontFaceSet).add(face);
    fontCache.set(url, family);
    return family;
  } catch (e) {
    console.warn('[theme] font load failed:', url, e);
    fontCache.set(url, 'inherit');
    return 'inherit';
  }
}

// ---------- helpers ----------
export function rv(ctx: RenderCtx, value: string | undefined, fallback = ''): string {
  if (value === undefined) return fallback;
  return expandVars(value, ctx.layout.variables, ctx.systemVars).trim() || fallback;
}

export function resolvePath(ctx: RenderCtx, value: string): string {
  const v = rv(ctx, value);
  if (!v) return '';
  if (/^(https?:)?\/\//.test(v) || v.startsWith('/') || v.startsWith('data:')) return v;
  return new URL(v.replace(/^\.\//, ''), ctx.layout.themeRoot).href;
}

function xy(value: string | undefined, def: [number, number]): [number, number] {
  if (!value) return def;
  const parts = value.split(/\s+/).map(Number);
  return [parts[0] || 0, parts.length > 1 ? parts[1] : parts[0] || 0];
}

function cssColor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const c = v.trim();
  return /^#/.test(c) ? c : '#' + c;
}

// Create a positioned container honoring pos/size/origin/maxSize/zIndex
function applyBox(
  el: HTMLElement,
  props: Record<string, string>,
  ctx: RenderCtx
): HTMLElement {
  const [px, py] = xy(props.pos, [0, 0]);
  const [ox, oy] = xy(props.origin, [0, 0]);
  el.style.left = (px * 100).toFixed(4) + '%';
  el.style.top = (py * 100).toFixed(4) + '%';
  if (props.origin !== undefined || ox || oy) {
    el.style.transform = `translate(${(-ox * 100).toFixed(2)}%, ${(-oy * 100).toFixed(2)}%)`;
  }
  const sizeRaw = props.size;
  if (sizeRaw) {
    const [w, h] = xy(sizeRaw, [0, 0]);
    if (w > 0) el.style.width = (w * 100).toFixed(4) + '%';
    if (h > 0) el.style.height = (h * 100).toFixed(4) + '%';
  }
  if (props.maxSize) {
    const [mw, mh] = xy(props.maxSize, [0, 0]);
    if (mw > 0) el.style.maxWidth = (mw * 100).toFixed(4) + '%';
    if (mh > 0) el.style.maxHeight = (mh * 100).toFixed(4) + '%';
  }
  if (props.zIndex) el.style.zIndex = String(Math.round(Number(props.zIndex) || 0));
  if (props.visible === 'false') el.style.display = 'none';
  return el;
}

async function applyFont(el: HTMLElement, props: Record<string, string>, ctx: RenderCtx) {
  if (props.fontPath) {
    const fam = await loadThemeFont(resolvePath(ctx, props.fontPath));
    el.style.fontFamily = `'${fam}', 'Segoe UI', sans-serif`;
  }
  if (props.fontSize) {
    el.style.fontSize = (Number(props.fontSize) * ctx.H).toFixed(1) + 'px';
  }
}

function applyText(el: HTMLElement, props: Record<string, string>) {
  if (props.color) el.style.color = cssColor(props.color) || '';
  if (props.backgroundColor) {
    el.style.backgroundColor = cssColor(props.backgroundColor) || '';
    el.style.padding = '0.12em 0.45em';
    el.style.borderRadius = '0.25em';
    el.style.width = 'fit-content';
  }
  if (props.letterCase === 'uppercase') el.style.textTransform = 'uppercase';
  if (props.letterCase === 'lowercase') el.style.textTransform = 'lowercase';
  if (props.letterCase === 'capitalized') el.style.textTransform = 'capitalize';
  if (props.lineSpacing) el.style.lineHeight = String(Number(props.lineSpacing) || 1.2);
  switch (props.horizontalAlignment) {
    case 'center': el.style.textAlign = 'center'; break;
    case 'right': el.style.textAlign = 'right'; break;
    default: el.style.textAlign = 'left';
  }
}

// ---------- element renderers ----------
// ES-DE metadata name -> GameEntry field
export const METADATA_FIELD: Record<string, string> = { description: 'desc' };

export const metaValue = (game: GameEntry | null | undefined, name: string): string => {
  if (!game) return '';
  const f = METADATA_FIELD[name] || name;
  return String((game as unknown as Record<string, unknown>)[f] ?? '');
};

type Renderer = (props: Record<string, string>, ctx: RenderCtx) => Promise<HTMLElement | null>;

// ES-DE official default zIndex per element type (THEMES-DEV.md)
export const DEFAULT_Z: Record<string, number> = {
  image: 30, video: 30, animation: 35, badges: 35,
  text: 40, datetime: 40, gamelistinfo: 45, rating: 45,
  carousel: 50, grid: 50, textlist: 50,
  helpsystem: 9999 // always rendered on top
};

const renderers: Record<string, Renderer> = {
  image: async (props, ctx) => {
    const path = props.path ? resolvePath(ctx, props.path) : '';
    if (!path) return null;
    const tint = cssColor(rv(ctx, props.color));
    const hasSize = !!props.size;

    // 1) tinted image: needs a mask box; when the theme only gives maxSize,
    //    wrap a mask div in a sized box so tinting still works
    if (tint) {
      const box = document.createElement('div');
      applyBox(box, props, ctx);
      const inner = document.createElement('div');
      inner.className = 'th-image';
      inner.style.position = 'absolute';
      inner.style.inset = '0';
      inner.style.backgroundColor = tint;
      inner.style.maskImage = `url("${path}")`;
      inner.style.webkitMaskImage = `url("${path}")`;
      inner.style.maskSize = props.tile === 'true' ? 'auto' : '100% 100%';
      inner.style.webkitMaskSize = inner.style.maskSize;
      inner.style.maskRepeat = props.tile === 'true' ? 'repeat' : 'no-repeat';
      inner.style.webkitMaskRepeat = inner.style.maskRepeat;
      if (props.rotation) inner.style.transform = `rotate(${Number(props.rotation) || 0}deg)`;
      // no explicit size: fall back to natural sizing inside the wrapper
      if (!hasSize) {
        const img = document.createElement('img');
        img.src = path;
        img.alt = '';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.opacity = '0';
        img.style.position = 'absolute';
        box.appendChild(img);
        // drive the mask box from the natural image size
        img.addEventListener('load', () => {
          inner.style.width = img.naturalWidth + 'px';
          inner.style.height = img.naturalHeight + 'px';
        });
      }
      box.appendChild(inner);
      return box;
    }

    // 2) untinted: explicit size → stretched/tiled div (theme wants fill);
    //    no size → natural-size <img> honoring maxSize
    if (hasSize) {
      const div = document.createElement('div');
      div.className = 'th-image';
      applyBox(div, props, ctx);
      div.style.backgroundImage = `url("${path}")`;
      div.style.backgroundRepeat = props.tile === 'true' ? 'repeat' : 'no-repeat';
      div.style.backgroundSize = props.tile === 'true' ? 'auto' : '100% 100%';
      if (props.rotation) div.style.transform = `rotate(${Number(props.rotation) || 0}deg)`;
      return div;
    }
    const img = document.createElement('img');
    img.className = 'th-image th-img';
    img.src = path;
    img.draggable = false;
    if (props.rotation) img.style.transform = `rotate(${Number(props.rotation) || 0}deg)`;
    applyBox(img, props, ctx);
    return img;
  },

  text: async (props, ctx) => {
    const div = document.createElement('div');
    div.className = 'th-text';
    applyBox(div, props, ctx);
    applyText(div, props);
    await applyFont(div, props, ctx);
    let content = props.text ?? '';
    if (props.systemdata === 'gamecount') {
      const n = ctx.gameCount ?? 0;
      content = `${n} game${n === 1 ? '' : 's'} available`;
    }
    if (props.metadata) {
      content = metaValue(ctx.game, props.metadata);
      div.dataset.metadata = props.metadata;
    }
    if (!content) content = ctx.infoTexts?.[props.__name ?? ''] ?? '';
    div.textContent = content;
    div.title = content;
    return div;
  },

  datetime: async (props, ctx) => {
    return renderers.text(props, ctx);
  },

  clock: async (props, ctx) => {
    const div = document.createElement('div');
    div.className = 'th-text th-clock';
    applyBox(div, props, ctx);
    applyText(div, props);
    await applyFont(div, props, ctx);
    const tick = () => {
      div.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    tick();
    setInterval(tick, 15000);
    return div;
  },

  helpsystem: async (props, ctx) => {
    const div = document.createElement('div');
    div.className = 'th-text th-help';
    applyBox(div, props, ctx);
    if (props.fontSize) div.style.fontSize = (Number(props.fontSize) * ctx.H).toFixed(1) + 'px';
    if (props.textColor) div.style.color = cssColor(rv(ctx, props.textColor)) || '';
    div.innerHTML = (ctx.helpEntries || [])
      .map((h) => `<span class="help-item">${h}</span>`)
      .join('<span class="help-sep">·</span>');
    return div;
  },

  rating: async (props, ctx) => {
    if (!ctx.game) return null;
    const filled = props.filledPath ? resolvePath(ctx, props.filledPath) : '';
    const unfilled = props.unfilledPath ? resolvePath(ctx, props.unfilledPath) : '';
    if (!filled && !unfilled) return null;
    const div = document.createElement('div');
    div.className = 'th-rating';
    applyBox(div, props, ctx);
    const stars = Math.round((ctx.game.rating || 0) * 5);
    for (let i = 0; i < 5; i++) {
      const img = document.createElement('img');
      img.src = i < stars ? filled : unfilled;
      img.className = 'rating-star';
      if (props.color) img.style.filter = ''; // tint unsupported for <img>; fine for slate
      div.appendChild(img);
    }
    return div;
  }
};

export async function renderThemeElement(
  element: ThemeElement,
  ctx: RenderCtx
): Promise<HTMLElement | null> {
  const fn = renderers[element.tag];
  if (!fn) return null; // badges/video/gamelistinfo/systemstatus handled by views or skipped in v1
  try {
    // expand every property value (${vars}) once at the element boundary
    const props: Record<string, string> = { __name: element.name };
    for (const [k, v] of Object.entries(element.props)) props[k] = rv(ctx, v);
    if (props.zIndex === undefined) props.zIndex = String(zOf(element));
    return await fn(props, ctx);
  } catch (e) {
    console.warn('[theme] element render failed:', element.tag, element.name, e);
    return null;
  }
}

export const zOf = (el: ThemeElement): number => {
  if (el.props.zIndex === undefined || el.props.zIndex === '') return DEFAULT_Z[el.tag] ?? 30;
  const z = Number(el.props.zIndex);
  return Number.isFinite(z) ? z : (DEFAULT_Z[el.tag] ?? 30);
};

// Render all static elements of a view (everything except live components).
export async function renderStaticElements(
  viewName: string,
  ctx: RenderCtx,
  skip: Set<string>
): Promise<DocumentFragment> {
  const frag = document.createDocumentFragment();
  const view = ctx.layout.views[viewName];
  if (!view) return frag;
  const entries = Object.values(view).filter((el) => !skip.has(el.name));
  // stable sort by effective zIndex (theme value or per-tag default)
  entries.sort((a, b) => zOf(a) - zOf(b));
  for (const el of entries) {
    const node = await renderThemeElement(el, ctx);
    if (node) frag.appendChild(node);
  }
  return frag;
}
