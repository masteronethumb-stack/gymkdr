/* GYMKDR · short formatted text. A wheel choice's description and a toast are written as small HTML
   snippets (ported from Chalk): paragraphs, a list with a value on the right (<li>Name<span>3 × 8</span></li>),
   a definition list, bold and icons. This draws them as React Native text. */
import React from 'react';
import { Text, View, TextStyle } from 'react-native';
import Icon from './Icon';
import { F, useTheme } from './theme';

type Node = { tag: string; cls: string; kids: Node[] } | string;

const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m] || m);

export function parse(html: string): Node[] {
  const root: Node = { tag: 'root', cls: '', kids: [] };
  const stack: { tag: string; cls: string; kids: Node[] }[] = [root as any];
  const re = /<(\/?)([a-z0-9]+)([^>]*)>/gi;
  let at = 0, m: RegExpExecArray | null;
  const text = (t: string) => { if (t) stack[stack.length - 1].kids.push(decode(t)); };
  while ((m = re.exec(html))) {
    text(html.slice(at, m.index));
    at = re.lastIndex;
    const [, close, tagRaw, attrs] = m;
    const tag = tagRaw.toLowerCase();
    if (tag === 'br') { stack[stack.length - 1].kids.push('\n'); continue; }
    if (close) {
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const cm = /class="([^"]*)"/.exec(attrs);
    const node = { tag, cls: cm ? cm[1] : '', kids: [] as Node[] };
    stack[stack.length - 1].kids.push(node);
    if (!/\/\s*$/.test(attrs)) stack.push(node);
  }
  text(html.slice(at));
  return (root as any).kids;
}

const BLOCK = new Set(['p', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'div', 'section', 'h2', 'h3']);

type Opts = { scale: number; hideOpt: boolean; maxItems: number | null; base: TextStyle; vertical: boolean };

// Inline content: text, bold, italics, icons.
function inline(nodes: Node[], o: Opts, th: any, key = 'i'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  nodes.forEach((n, i) => {
    const k = `${key}.${i}`;
    if (typeof n === 'string') {
      // icon markers: ⟦icon:name⟧
      const parts = n.split(/(⟦icon:[a-z]+⟧)/);
      parts.forEach((p, j) => {
        const im = /^⟦icon:([a-z]+)⟧$/.exec(p);
        if (im) out.push(<Icon key={`${k}.${j}`} name={im[1]} size={Math.round(18 * o.scale)} color={(o.base.color as string) || th.ink} />);
        else if (p) out.push(p);
      });
      return;
    }
    if (n.cls.split(' ').includes('opt') && o.hideOpt) return;
    const kids = inline(n.kids, o, th, k);
    if (n.tag === 'b' || n.tag === 'strong') out.push(<Text key={k} style={{ fontFamily: F.bodyB }}>{kids}</Text>);
    else if (n.tag === 'i' || n.tag === 'em') out.push(<Text key={k} style={{ fontFamily: F.bodyI }}>{kids}</Text>);
    else if (n.tag === 'small') out.push(<Text key={k} style={{ fontSize: Math.round(12 * o.scale) }}>{kids}</Text>);
    else out.push(<Text key={k}>{kids}</Text>);
  });
  return out;
}

function blocks(nodes: Node[], o: Opts, th: any, key = 'b'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let run: Node[] = [];
  const flush = (k: string) => { if (run.length && run.some((x) => typeof x !== 'string' || x.trim())) out.push(<Text key={k} style={o.base}>{inline(run, o, th, k)}</Text>); run = []; };
  nodes.forEach((n, i) => {
    const k = `${key}.${i}`;
    if (typeof n === 'string' || !BLOCK.has(n.tag)) { run.push(n); return; }
    flush(k + 'r');
    if (n.cls.split(' ').includes('opt') && o.hideOpt) return;
    if (n.tag === 'p') out.push(<Text key={k} style={[o.base, { marginBottom: 6 * o.scale }]}>{inline(n.kids, o, th, k)}</Text>);
    else if (n.tag === 'ul' || n.tag === 'ol') {
      const items = n.kids.filter((x) => typeof x !== 'string' && x.tag === 'li') as any[];
      const shown = o.maxItems != null && items.length > o.maxItems ? items.slice(0, o.maxItems) : items;
      out.push(
        <View key={k} style={{ gap: 3 * o.scale, marginBottom: 6 * o.scale }}>
          {shown.map((li, j) => {
            const val = li.kids.filter((x: Node) => typeof x !== 'string' && x.tag === 'span');
            const rest = li.kids.filter((x: Node) => !(typeof x !== 'string' && x.tag === 'span'));
            return (
              <View key={j} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <Text style={[o.base, { flex: 1 }]}>{inline(rest, o, th, `${k}.${j}`)}</Text>
                {val.length ? <Text style={[o.base, { fontFamily: F.display6, fontSize: Math.round((o.vertical ? 16 : 17) * o.scale), color: th.ink, textAlign: 'right', flexShrink: 1 }]}>{inline(val[0].kids, o, th, `${k}.${j}v`)}</Text> : null}
              </View>
            );
          })}
          {shown.length < items.length ? <Text style={[o.base, { color: th.ink3, fontFamily: F.bodyI }]}>and {items.length - shown.length} more</Text> : null}
        </View>,
      );
    } else if (n.tag === 'li') out.push(<Text key={k} style={o.base}>{inline(n.kids, o, th, k)}</Text>);
    else if (n.tag === 'dl') out.push(<View key={k} style={{ marginBottom: 6 * o.scale }}>{blocks(n.kids, o, th, k)}</View>);
    else if (n.tag === 'dt') out.push(<Text key={k} style={[o.base, { fontFamily: F.bodyB, color: th.ink, fontSize: Math.round(13 * o.scale), letterSpacing: 0.3, marginTop: out.length ? 8 * o.scale : 0 }]}>{inline(n.kids, o, th, k)}</Text>);
    else if (n.tag === 'dd') out.push(<Text key={k} style={o.base}>{inline(n.kids, o, th, k)}</Text>);
    else out.push(<View key={k}>{blocks(n.kids, o, th, k)}</View>);
  });
  flush(key + 'end');
  return out;
}

export default function Rich({ html, size = 15, color, scale = 1, hideOpt = false, maxItems = null, vertical = true }: { html: string; size?: number; color?: string; scale?: number; hideOpt?: boolean; maxItems?: number | null; vertical?: boolean }) {
  const th = useTheme();
  const base: TextStyle = { fontFamily: F.body, fontSize: Math.round(size * scale), lineHeight: Math.round(size * scale * 1.4), color: color || th.ink2 };
  return <View>{blocks(parse(html || ''), { scale, hideOpt, maxItems, base, vertical }, th)}</View>;
}

// One line of inline formatting (a toast): bold and icons, no blocks.
export function RichLine({ html, style }: { html: string; style: TextStyle }) {
  const th = useTheme();
  return <Text style={style}>{inline(parse(html || ''), { scale: 1, hideOpt: false, maxItems: null, base: style, vertical: true }, th)}</Text>;
}

// Plain text of a snippet (for screen readers).
export const plain = (html: string) => decode(String(html || '').replace(/⟦icon:[a-z]+⟧/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
