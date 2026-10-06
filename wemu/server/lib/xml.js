// Minimal XML parser sufficient for gamelist.xml / theme.xml style documents.
// Produces a node tree: { tag, attrs: {name: value}, children: [], text: string }

export function parseXML(text) {
  let i = 0;
  const len = text.length;
  const root = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];

  while (i < len) {
    const lt = text.indexOf('<', i);
    if (lt === -1) break;
    // text content before this tag
    if (lt > i) {
      const chunk = text.slice(i, lt);
      appendText(stack[stack.length - 1], decodeEntities(chunk));
    }
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      const data = end === -1 ? text.slice(lt + 9) : text.slice(lt + 9, end);
      appendText(stack[stack.length - 1], data);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (text.startsWith('<?', lt) || text.startsWith('<!', lt)) {
      // declaration / doctype: skip to '>'
      let depth = 0, j = lt;
      for (; j < len; j++) {
        if (text[j] === '<') depth++;
        else if (text[j] === '>') { depth--; if (depth === 0) break; }
      }
      i = j + 1;
      continue;
    }
    const gt = findTagEnd(text, lt);
    if (gt === -1) break;
    const inner = text.slice(lt + 1, gt);
    i = gt + 1;
    if (inner.startsWith('/')) {
      // closing tag
      if (stack.length > 1) stack.pop();
    } else if (inner.endsWith('/')) {
      // self-closing
      const node = makeNode(inner.slice(0, -1));
      stack[stack.length - 1].children.push(node);
    } else {
      const node = makeNode(inner);
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
  }
  return root;
}

function findTagEnd(text, from) {
  let inQuote = false, q = '';
  for (let j = from; j < text.length; j++) {
    const c = text[j];
    if (inQuote) { if (c === q) inQuote = false; }
    else if (c === '"' || c === "'") { inQuote = true; q = c; }
    else if (c === '>') return j;
  }
  return -1;
}

function makeNode(inner) {
  const m = inner.match(/^([^\s]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*$/);
  const node = { tag: m ? m[1] : inner.trim(), attrs: {}, children: [], text: '' };
  if (m && m[2]) {
    const attrRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = attrRe.exec(m[2]))) node.attrs[a[1]] = decodeEntities(a[2] ?? a[3] ?? '');
  }
  return node;
}

function appendText(node, chunk) {
  if (!chunk) return;
  node.text += chunk;
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Convenience: get direct children with a tag name
export function childrenOf(node, tag) {
  return node.children.filter((c) => c.tag === tag);
}

export function firstChild(node, tag) {
  return node.children.find((c) => c.tag === tag);
}

export function textOf(node) {
  return (node?.text || '').trim();
}
