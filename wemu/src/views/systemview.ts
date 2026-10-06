// SystemView: theme-rendered static elements + the system carousel.
import type { ThemeLayout, SystemInfo } from '../types';
import { renderStaticElements, rv, resolvePath, type RenderCtx } from '../theme/render';

export interface SystemViewData {
  layout: ThemeLayout;
  systems: SystemInfo[];
  currentIdx: number;
  ctx: Omit<RenderCtx, 'layout' | 'systemVars'>;
  systemVars: Record<string, string>;
  /** entry direction for the carousel slide-in: +1 (from right), -1 (from left), 0 (none) */
  slideDir?: -1 | 0 | 1;
}

const LIVE = new Set(['systemCarousel']);

export async function renderSystemView(root: HTMLElement, data: SystemViewData): Promise<void> {
  const { layout, systems, currentIdx } = data;
  root.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'wemu-view view-fade-in';

  const ctx: RenderCtx = { layout, systemVars: data.systemVars, ...data.ctx };

  // static themed elements first (background, bands, console art, info, clock...)
  const frag = await renderStaticElements('system', ctx, LIVE);
  view.appendChild(frag);

  // --- carousel (live component) ---
  const carouselEl = layout.views['system']?.['systemCarousel'];
  if (carouselEl && systems.length) {
    // expand ${vars} up-front EXCEPT ${system.*}: those must stay raw because
    // the carousel re-resolves them per entry (each logo uses its own system)
    const expandedProps: Record<string, string> = {};
    for (const [k, v] of Object.entries(carouselEl.props)) {
      expandedProps[k] = v.includes('${system.')
        ? expandNonSystemVars(v, ctx.layout.variables)
        : rv(ctx, v);
    }
    const carouselBox = buildCarousel(expandedProps, ctx, systems, currentIdx, data.slideDir ?? 0);
    view.appendChild(carouselBox);
    root.appendChild(view);
    // run the directional entry slide now that the view is laid out
    (carouselBox as HTMLElement & { __enterCarousel?: (dir: -1 | 0 | 1) => void })
      .__enterCarousel?.(data.slideDir ?? 0);
    return;
  }

  root.appendChild(view);
}

function buildCarousel(
  props: Record<string, string>,
  ctx: RenderCtx,
  systems: SystemInfo[],
  currentIdx: number,
  slideDir: -1 | 0 | 1
): HTMLElement {
  const [px, py] = (props.pos || '0 0.38').split(/\s+/).map(Number);
  const [orgX, orgY] = (props.origin || '0 0').split(/\s+/).map(Number);
  const [w, h] = (props.size || '1 0.36').split(/\s+/).map(Number);
  const [iw, ih] = (props.itemSize || '0.25 0.125').split(/\s+/).map(Number);
  const scale = Number(props.itemScale) || 1.23;
  const unfo = Number(props.unfocusedItemOpacity ?? 0.5);

  const box = document.createElement('div');
  box.className = 'wemu-carousel';
  box.style.left = (px * 100) + '%';
  box.style.top = (py * 100) + '%';
  // ES-DE origin: the pos points at this fraction of the element's own size
  if (orgX || orgY) {
    box.style.transform = `translate(${(-orgX * 100).toFixed(2)}%, ${(-orgY * 100).toFixed(2)}%)`;
  }
  box.style.width = (w * 100) + '%';
  box.style.height = (h * 100) + '%';
  box.style.zIndex = props.zIndex || '50';
  const bg = rv(ctx, props.color);
  if (bg) {
    box.style.background = /^#?[0-9a-fA-F]{6,8}$/.test(bg.replace('#', '')) ? '#' + bg.replace('#', '') : bg;
  }

  const track = document.createElement('div');
  track.className = 'wemu-carousel-track';
  // hidden until enter() positions it, so the pre-layout position never flashes
  track.style.opacity = '0';
  box.style.setProperty('--unfocused-opacity', String(unfo));
  box.style.setProperty('--item-scale', String(scale));

  const itemW = iw * ctx.W;
  const fontColor = rv(ctx, props.textColor, '#f0f0f0');
  track.style.color = fontColor;

  const staticImage = props.staticImage || '';
  // placeholder background shown behind logos while they load / when missing
  const textBgRaw = props.textBackgroundColor || '';
  const textBg = textBgRaw && textBgRaw !== '00000000'
    ? (textBgRaw.startsWith('#') ? textBgRaw : '#' + textBgRaw.replace(/^[0-9a-fA-F]{8}$/, (m) => m))
    : '';

  systems.forEach((sys, i) => {
    const item = document.createElement('div');
    item.className = 'wemu-carousel-item' + (i === currentIdx ? ' active' : '');
    item.style.width = itemW + 'px';
    item.style.height = (ih * ctx.H) + 'px';
    // per-entry variable resolution: ${system.theme} refers to THIS entry
    const entryVars = { ...ctx.systemVars, 'system.theme': sys.themeDir };
    const logoUrl = staticImage
      ? new URL(expandStatic(staticImage, entryVars).replace(/^\.\//, ''), ctx.layout.themeRoot).href
      : '';
    if (logoUrl) {
      const img = document.createElement('img');
      img.src = logoUrl;
      img.alt = sys.fullName;
      // keep the logo inside its own cell: the active item scales up 1.23x,
      // so cap the resting size at ~78% to avoid bleeding onto neighbours
      img.style.maxWidth = '78%';
      img.style.maxHeight = '78%';
      img.style.objectFit = 'contain';
      img.onerror = () => {
        img.remove();
        if (!item.querySelector('.logo-fallback')) {
          const fb = document.createElement('div');
          fb.className = 'logo-fallback';
          fb.textContent = sys.fullName;
          fb.style.maxWidth = '78%';
          fb.style.color = fontColor; // placeholder text follows theme color
          if (textBg) {
            fb.style.background = textBg;
            fb.style.padding = '0.2em 0.5em';
            fb.style.borderRadius = '4px';
          }
          item.appendChild(fb);
        }
      };
      item.appendChild(img);
    } else {
      const fb = document.createElement('div');
      fb.className = 'logo-fallback';
      fb.textContent = sys.fullName;
      fb.style.color = fontColor;
      item.appendChild(fb);
    }
    track.appendChild(item);
  });

  // center the active item. The entry slide must run AFTER the box is in the
  // DOM (clientWidth is 0 before that), so it is exposed as `enter()` and
  // invoked by renderSystemView once the view is attached.
  let entered = false;
  const currentOffset = () => (box.clientWidth - itemW) / 2 - currentIdx * itemW;
  const apply = () => { track.style.transform = `translateX(${currentOffset()}px)`; };
  const enter = (dir: -1 | 0 | 1) => {
    if (entered) { apply(); return; }
    entered = true;
    track.style.opacity = ''; // visible from now on, regardless of slide
    const target = currentOffset();
    if (dir !== 0 && box.clientWidth > 0) {
      // CSS animation driven by variables: the inline transform always holds
      // the true final position, so nothing breaks even if the tab is
      // backgrounded and the animation itself is suspended.
      track.style.setProperty('--slide-from', `${target + dir * itemW}px`);
      track.style.setProperty('--slide-to', `${target}px`);
      track.classList.add(dir > 0 ? 'enter-from-right' : 'enter-from-left');
      track.addEventListener('animationend', () => track.classList.remove('enter-from-right', 'enter-from-left'), { once: true });
    }
    apply();
  };
  const update = () => { if (entered) apply(); };
  requestAnimationFrame(update);
  // re-center on resize
  const ro = new ResizeObserver(update);
  ro.observe(box);

  box.appendChild(track);
  (box as HTMLElement & { __enterCarousel?: (dir: -1 | 0 | 1) => void }).__enterCarousel = enter;
  return box;
}

function expandStatic(v: string, vars: Record<string, string>): string {
  return v.replace(/\$\{([^}]+)\}/g, (_, k) => vars[k.trim()] ?? '');
}

// expand theme variables but leave ${system.*} untouched (per-entry values)
function expandNonSystemVars(v: string, variables: Record<string, string>): string {
  return v.replace(/\$\{([^}]+)\}/g, (full, key: string) => {
    const k = key.trim();
    if (k.startsWith('system.')) return full; // keep raw for per-entry expansion
    let val = variables[k] ?? full;
    for (let i = 0; i < 6 && typeof val === 'string' && val.includes('${') && !val.includes('${system.'); i++) {
      val = val.replace(/\$\{([^}]+)\}/g, (f2, k2: string) => {
        const kk = k2.trim();
        if (kk.startsWith('system.')) return f2;
        return variables[kk] ?? f2;
      });
    }
    return val;
  });
}
