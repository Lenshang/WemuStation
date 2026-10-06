// ES-DE theme.xml loader: resolves includes, conditionals (colorScheme /
// fontSize / aspectRatio / variant) and variables into a flat view->element map.
// Property values stay unresolved (${vars}) until render time, because the
// carousel re-resolves ${system.*} per system entry.
import { parseXML, kids, kid, txt, type XMLNode } from './xml';
import type { ThemeLayout, ThemeElement } from '../types';

export interface ThemeLoadContext {
  themeRoot: string;    // e.g. "/themes/slate-es-de/"  (ends with /)
  systemTheme: string;  // e.g. "nes" ($system.theme)
  variant: string;      // e.g. "withoutVideos"
  aspectRatio: string;  // e.g. "16:9"
  fontSize: string;     // e.g. "medium"
}

async function fetchXML(url: string): Promise<XMLNode | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return parseXML(await r.text());
  } catch {
    return null;
  }
}

// Depth-first include expansion. `rootEl` is the <theme> element; returns the
// flat list of its expanded top-level nodes. Includes can appear at any depth
// (e.g. inside <aspectRatio> blocks) and are replaced in place; their paths
// support ${system.theme} and resolve relative to the containing file.
async function expandIncludes(
  rootEl: XMLNode,
  baseDir: string,
  systemTheme: string,
  depth = 0
): Promise<XMLNode[]> {
  if (depth > 12) return [];
  const out: XMLNode[] = [];
  for (const node of rootEl.children) {
    if (node.tag === 'include') {
      const raw = txt(node).replace(/\$\{system\.theme\}/g, systemTheme);
      const url = new URL(raw.replace(/^\.\//, ''), baseDir).href;
      const sub = await fetchXML(url);
      if (sub) {
        const subDir = url.endsWith('/') ? url : url.slice(0, url.lastIndexOf('/') + 1);
        const subTheme = sub.children.find((c) => c.tag === 'theme') ?? sub;
        out.push(...(await expandIncludes(subTheme, subDir, systemTheme, depth + 1)));
      } else {
        console.warn('[theme] missing include:', url);
      }
    } else {
      if (node.children.length) {
        node.children = await expandIncludes(node, baseDir, systemTheme, depth + 1);
      }
      out.push(node);
    }
  }
  return out;
}

interface VarCollector {
  variables: Record<string, string>;
  views: Record<string, Record<string, ThemeElement>>;
  sounds: Record<string, string>;
}

function mergeViewNode(node: XMLNode, out: VarCollector) {
  const viewNames = (node.attrs.name || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const vn of viewNames) {
    const view = (out.views[vn] ||= {});
    for (const el of node.children) {
      // <image name="a, b"> style multi-name elements
      const names = (el.attrs.name || '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const name of names.length ? names : ['']) {
        const key = name || el.tag;
        const existing = view[key];
        if (existing && existing.tag === el.tag) {
          Object.assign(existing.props, elementProps(el));
        } else {
          view[key] = { tag: el.tag, name: key, props: elementProps(el) };
        }
      }
    }
  }
}

function elementProps(el: XMLNode): Record<string, string> {
  const props: Record<string, string> = {};
  for (const p of el.children) {
    if (p.children.length === 0) props[p.tag] = txt(p);
  }
  return props;
}

function collectConditional(
  nodes: XMLNode[],
  chosen: { colorScheme: string; fontSize: string; aspectRatio: string; variant: string },
  out: VarCollector
) {
  for (const node of nodes) {
    switch (node.tag) {
      case 'variables': {
        for (const v of node.children) if (v.children.length === 0) out.variables[v.tag] = txt(v);
        break;
      }
      case 'colorScheme': {
        if ((node.attrs.name || '').trim() === chosen.colorScheme)
          collectConditional(node.children, chosen, out);
        break;
      }
      case 'fontSize': {
        if ((node.attrs.name || '').trim() === chosen.fontSize)
          collectConditional(node.children, chosen, out);
        break;
      }
      case 'aspectRatio': {
        if ((node.attrs.name || '').split(',').map((s) => s.trim()).includes(chosen.aspectRatio))
          collectConditional(node.children, chosen, out);
        break;
      }
      case 'variant': {
        const names = (node.attrs.name || '').split(',').map((s) => s.trim());
        if (names.includes('all') || names.includes(chosen.variant))
          collectConditional(node.children, chosen, out);
        break;
      }
      case 'theme': {
        collectConditional(node.children, chosen, out);
        break;
      }
      case 'view': {
        mergeViewNode(node, out);
        break;
      }
      default:
        break;
    }
  }
}

export async function loadTheme(ctx: ThemeLoadContext): Promise<ThemeLayout> {
  // URL constructor needs an absolute base; frontend always runs in a browser
  if (ctx.themeRoot.startsWith('/')) {
    ctx.themeRoot = location.origin + ctx.themeRoot;
  }
  const doc = await fetchXML(ctx.themeRoot + 'theme.xml');
  if (!doc) throw new Error('theme.xml not found at ' + ctx.themeRoot);
  const themeEl = doc.children.find((c) => c.tag === 'theme') ?? doc;
  const nodes = await expandIncludes(themeEl, ctx.themeRoot, ctx.systemTheme);

  // Pick first colorScheme (capabilities order) unless the theme has none.
  const csNode = nodes.find((n) => n.tag === 'colorScheme');
  const chosen = {
    colorScheme: csNode ? (csNode.attrs.name || '').trim() : '',
    fontSize: ctx.fontSize,
    aspectRatio: ctx.aspectRatio,
    variant: ctx.variant
  };

  const out: VarCollector = { variables: {}, views: {}, sounds: {} };
  collectConditional(nodes, chosen, out);

  // Navigation sounds live inside <view name="all"><sound name="..."><path>.
  for (const vn of Object.keys(out.views)) {
    for (const key of Object.keys(out.views[vn])) {
      const el = out.views[vn][key];
      if (el.tag === 'sound') {
        const p = el.props.path;
        if (p) out.sounds[key] = p;
        delete out.views[vn][key];
      }
    }
    if (vn === 'all') delete out.views[vn];
  }

  return {
    themeRoot: ctx.themeRoot,
    views: out.views,
    variables: out.variables,
    sounds: out.sounds
  };
}

// ---- variable expansion (applied at render time) ----

export function makeSystemVars(sys: {
  themeDir: string;
  id: string;
  fullName: string;
  manufacturer: string;
  releaseYear: string;
}): Record<string, string> {
  return {
    'system.theme': sys.themeDir,
    'system.name': sys.id,
    'system.fullName': sys.fullName,
    'system.manufacturer': sys.manufacturer,
    'system.releaseYear': sys.releaseYear
  };
}

export function expandVars(
  value: string,
  variables: Record<string, string>,
  systemVars: Record<string, string>,
  depth = 0
): string {
  if (depth > 8 || !value.includes('${')) return value;
  return value.replace(/\$\{([^}]+)\}/g, (_, name: string) => {
    const key = name.trim();
    if (key in systemVars) return systemVars[key];
    if (key in variables) return expandVars(variables[key], variables, systemVars, depth + 1);
    return '';
  });
}
