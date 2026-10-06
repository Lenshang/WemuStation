// GamelistView: theme-rendered statics + live textlist / game media / metadata.
import type { ThemeLayout, GameEntry, SystemInfo } from '../types';
import { renderStaticElements, rv, resolvePath, loadThemeFont, metaValue, type RenderCtx } from '../theme/render';

export interface GamelistViewData {
  layout: ThemeLayout;
  system: SystemInfo;
  games: GameEntry[];
  selIdx: number;
  systemVars: Record<string, string>;
  ctxBase: Omit<RenderCtx, 'layout' | 'systemVars'>;
}

const LIVE = new Set(['gamelistTextlist', 'gameImage', 'gameVideo', 'badges', 'gameImageContainer']);

export interface GamelistRefs {
  root: HTMLElement;
  updateSelection: (idx: number) => void;
  /** visible textlist rows — one page for the ←/→ paging keys (lazy: needs
   *  the box attached to the document before clientHeight is real) */
  pageSize: () => number;
}

export async function renderGamelistView(
  root: HTMLElement,
  data: GamelistViewData
): Promise<GamelistRefs> {
  const { layout, games, selIdx } = data;
  root.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'wemu-view view-fade-in';

  const game = games[selIdx] ?? null;
  const ctx: RenderCtx = { layout, systemVars: data.systemVars, ...data.ctxBase, game };

  // static elements (metadata texts/description are rendered with data-markers
  // so we can update them without rebuilding the whole view)
  const frag = await renderStaticElements('gamelist', ctx, LIVE);
  view.appendChild(frag);

  // --- media (gameImage) ---
  const mediaEl = layout.views['gamelist']?.['gameImage'] || layout.views['gamelist']?.['gameVideo'];
  const mediaBox = document.createElement('div');
  mediaBox.className = 'th-gameimage';
  if (mediaEl) {
    const props = mediaEl.props;
    mediaBox.style.position = 'absolute';
    const [px, py] = (props.pos || '0.63 0.45').split(/\s+/).map(Number);
    const [ox, oy] = (props.origin || '0.5 0.5').split(/\s+/).map(Number);
    mediaBox.style.left = (px * 100) + '%';
    mediaBox.style.top = (py * 100) + '%';
    mediaBox.style.transform = `translate(${-ox * 100}%, ${-oy * 100}%)`;
    if (props.maxSize) {
      const [mw, mh] = props.maxSize.split(/\s+/).map(Number);
      mediaBox.style.width = (mw * 100) + '%';
      mediaBox.style.height = (mh * 100) + '%';
      mediaBox.style.left = `calc(${px * 100}% )`;
    }
    if (props.zIndex) mediaBox.style.zIndex = props.zIndex;
    else mediaBox.style.zIndex = '30';
    const img = document.createElement('img');
    img.draggable = false;
    mediaBox.appendChild(img);
    view.appendChild(mediaBox);
  }

  // --- textlist ---
  const tlEl = layout.views['gamelist']?.['gamelistTextlist'];
  const list = buildTextlist(tlEl?.props || {}, ctx, games, selIdx);
  if (tlEl?.props.fontPath) {
    const fam = await loadThemeFont(resolvePath(ctx, tlEl.props.fontPath));
    list.box.style.fontFamily = `'${fam}', 'Segoe UI', sans-serif`;
  }
  view.appendChild(list.box);

  root.appendChild(view);

  const refs: GamelistRefs = {
    root: view,
    pageSize: list.pageSize,
    updateSelection(idx: number) {
      // textlist selector
      list.update(idx);
      // media
      const g = games[idx];
      const img = mediaBox.querySelector('img') as HTMLImageElement | null;
      if (img) {
        if (g?.image) {
          img.src = g.image;
          img.style.display = '';
          img.onerror = () => { img.style.display = 'none'; };
        } else {
          img.removeAttribute('src');
          img.style.display = 'none';
        }
      }
      // metadata texts / description
      updateMarked(view, g);
    }
  };
  refs.updateSelection(selIdx);
  return refs;
}

function updateMarked(view: HTMLElement, g: GameEntry | null) {
  view.querySelectorAll<HTMLElement>('[data-metadata]').forEach((el) => {
    el.textContent = metaValue(g, el.dataset.metadata!);
  });
}

function buildTextlist(
  props: Record<string, string>,
  ctx: RenderCtx,
  games: GameEntry[],
  selIdx: number
) {
  const box = document.createElement('div');
  box.className = 'wemu-textlist';
  box.style.position = 'absolute';
  const [px, py] = (props.pos || '0.025 0.201').split(/\s+/).map(Number);
  const [w, h] = (props.size || '0.39 0.711').split(/\s+/).map(Number);
  const ox = Number((props.origin || '0 0').split(/\s+/)[0]);
  const oy = Number((props.origin || '0 0').split(/\s+/)[1]);
  box.style.left = (px * 100) + '%';
  box.style.top = (py * 100) + '%';
  box.style.width = (w * 100) + '%';
  box.style.height = (h * 100) + '%';
  box.style.transform = `translate(${-ox * 100}%, ${-oy * 100}%)`;
  box.style.zIndex = props.zIndex || '50';

  const fontPx = (Number(props.fontSize) || 0.025) * ctx.H;
  const cPrimary = css(rv(ctx, props.primaryColor, '#000000'));
  const cSelected = css(rv(ctx, props.selectedColor, '#ffffff'));
  const cSelector = css(rv(ctx, props.selectorColor, '#161616'));
  const upper = props.letterCase === 'uppercase';
  const align = props.horizontalAlignment === 'center' ? 'center' : props.horizontalAlignment === 'right' ? 'right' : 'left';
  const margin = (Number(props.horizontalMargin) || 0) * ctx.W;

  const inner = document.createElement('div');
  inner.className = 'wemu-textlist-inner';
  box.appendChild(inner);

  const rows: HTMLElement[] = [];
  games.forEach((g, i) => {
    const row = document.createElement('div');
    row.className = 'wemu-textlist-row';
    row.style.fontSize = fontPx + 'px';
    row.style.lineHeight = (fontPx * 1.55) + 'px';
    row.style.textAlign = align;
    row.style.paddingLeft = margin + 'px';
    row.style.paddingRight = margin + 'px';
    row.style.color = cPrimary;
    if (upper) row.style.textTransform = 'uppercase';
    row.style.fontFamily = getComputedStyle(box).fontFamily || 'inherit';
    row.innerHTML = (g.favorite ? '<span class="fav">★</span>' : '') + escapeHtml(g.name);
    row.addEventListener('click', () => row.dispatchEvent(new CustomEvent('gamelist-select', { bubbles: true, detail: i })));
    inner.appendChild(row);
    rows.push(row);
  });

  const update = (idx: number) => {
    rows.forEach((r, i) => {
      const sel = i === idx;
      r.classList.toggle('selected', sel);
      r.style.background = sel ? cSelector : 'transparent';
      r.style.color = sel ? cSelected : cPrimary;
    });
    // keep selection visible
    const row = rows[idx];
    if (row) {
      const rTop = row.offsetTop, rH = row.offsetHeight;
      if (rTop < inner.scrollTop) inner.scrollTop = rTop;
      else if (rTop + rH > inner.scrollTop + inner.clientHeight)
        inner.scrollTop = rTop + rH - inner.clientHeight;
    }
  };

  // visible row count (one page) — must be evaluated lazily: clientHeight is
  // 0 until the box is attached to the document
  const pageSize = () =>
    Math.max(1, Math.round(box.clientHeight / (rows[0]?.offsetHeight || fontPx * 1.55 || 1)));

  return { box, update, pageSize };
}

function css(v?: string): string {
  if (!v) return '';
  return v.startsWith('#') ? v : '#' + v;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
