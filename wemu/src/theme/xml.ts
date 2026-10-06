// Minimal XML parser (same algorithm as server/lib/xml.js, TS version).
export interface XMLNode {
  tag: string;
  attrs: Record<string, string>;
  children: XMLNode[];
  text: string;
}

export function parseXML(text: string): XMLNode {
  let i = 0;
  const len = text.length;
  const root: XMLNode = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: XMLNode[] = [root];

  while (i < len) {
    const lt = text.indexOf('<', i);
    if (lt === -1) break;
    if (lt > i) stack[stack.length - 1].text += decode(text.slice(i, lt));
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      stack[stack.length - 1].text += end === -1 ? text.slice(lt + 9) : text.slice(lt + 9, end);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (text.startsWith('<?', lt)) {
      const end = text.indexOf('?>', lt);
      i = end === -1 ? len : end + 2;
      continue;
    }
    if (text.startsWith('<!', lt)) {
      const end = text.indexOf('>', lt);
      i = end === -1 ? len : end + 1;
      continue;
    }
    let gt = -1, inQ = false, q = '';
    for (let j = lt; j < len; j++) {
      const c = text[j];
      if (inQ) { if (c === q) inQ = false; }
      else if (c === '"' || c === "'") { inQ = true; q = c; }
      else if (c === '>') { gt = j; break; }
    }
    if (gt === -1) break;
    const inner = text.slice(lt + 1, gt);
    i = gt + 1;
    if (inner.startsWith('/')) {
      if (stack.length > 1) stack.pop();
    } else if (inner.endsWith('/')) {
      stack[stack.length - 1].children.push(makeNode(inner.slice(0, -1)));
    } else {
      const node = makeNode(inner);
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
  }
  return root;
}

function makeNode(inner: string): XMLNode {
  const m = /^([^\s]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*$/.exec(inner);
  const node: XMLNode = { tag: m ? m[1] : inner.trim(), attrs: {}, children: [], text: '' };
  if (m && m[2]) {
    const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = re.exec(m[2]))) node.attrs[a[1]] = decode(a[2] ?? a[3] ?? '');
  }
  return node;
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export const kids = (n: XMLNode, tag: string) => n.children.filter((c) => c.tag === tag);
export const kid = (n: XMLNode, tag: string) => n.children.find((c) => c.tag === tag);
export const txt = (n?: XMLNode) => (n?.text || '').trim();
