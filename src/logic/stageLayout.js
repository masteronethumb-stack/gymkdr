/* GYMKDR · where the thumb's controls go (Chalk's stage.js solver).
   Rim buttons sit out towards the edge of the reach, each 10 pt inside it at its own angle and at
   least 16 pt from the screen edges, spread along the arc. The hub (the Start button) sits inside
   them, as far from the corner as they allow. Buttons are 52–64 pt and the hub 84–104 pt (72 if it
   must). When the reach can't hold every rim button at that size, the least-used fold into More:
   controls are cut before they are shrunk. Smaller margins are a last resort for a very short reach. */
import CH from '../ch';

const U = CH.u;
const R = (th) => CH.reach.R(th);
const pt = (th, r) => CH.reach.fromPolar(th, r);

const TIERS = [
  { m: 16, inset: 10, g: 12, bMax: 64, bMin: 52, hd: [104, 84, 72] },
  { m: 12, inset: 8, g: 10, bMax: 56, bMin: 48, hd: [80, 64] },
  { m: 6, inset: 4, g: 8, bMax: 48, bMin: 44, hd: [64, 56] },
  // Last resort, for the shortest reach the sweep accepts: the hub and one button (More holds the rest).
  { m: 4, inset: 4, g: 4, bMax: 44, bMin: 44, hd: [56, 48], end1: true },
];
const RIM_CAP = 250, HUB_CAP = 170; // a long thumb doesn't send the controls across the screen
const rad = (d) => (d * Math.PI) / 180;
const loc = (a, r) => ({ x: r * Math.cos(rad(a)), y: r * Math.sin(rad(a)) }); // from the corner: x along the bottom, y up

// Every size pairing that fits is tried, and the most balanced one wins.
function solve(n, t) {
  const { W, H } = CH.reach.size();
  const { m, inset, g } = t;
  const edgeOk = (p, s) => p.x >= m + s / 2 && p.y >= m + s / 2 && p.x <= W - m - s / 2 && p.y <= H - m - s / 2;
  const hdMin = t.hd[t.hd.length - 1];
  let best = null;
  for (let b = t.bMax; b >= t.bMin; b -= 2) {
    let rim = [], arc = [0, 90];
    if (n > 0) {
      const c = (a) => Math.min(R(a) - inset - b / 2, RIM_CAP);
      let run = null, cur = null;
      for (let a = 0; a <= 90; a += 0.5) {
        if (edgeOk(loc(a, c(a)), b)) { cur = cur ? [cur[0], a] : [a, a]; if (!run || cur[1] - cur[0] > run[1] - run[0]) run = cur.slice(); } else cur = null;
      }
      if (!run) continue;
      arc = run;
      const A = [], S = [];
      let L = 0;
      for (let a = run[0]; a <= run[1] + 1e-9; a += 0.5) {
        if (A.length) { const p = loc(A[A.length - 1], c(A[A.length - 1])), q = loc(a, c(a)); L += Math.hypot(q.x - p.x, q.y - p.y); }
        A.push(a); S.push(L);
      }
      if (n > 1 && L / (n - 1) < b + g) continue;
      const at = (s) => { const i = S.findIndex((v) => v >= s - 1e-6); return A[i < 0 ? A.length - 1 : i]; };
      if (t.end1 && n === 1) {
        rim = [at(L)].map((a) => ({ a, r: c(a) }));
      } else {
        // The middle of the arc is kept clear for the hub; the rim buttons split to either end.
        const W0 = t.hd[0] * 0.9 + b + g, seg = (L - W0) / 2, sp = b + g;
        const k1 = Math.ceil(n / 2), k2 = n - k1;
        if (seg < b / 2 || (k1 - 1) * sp > seg || (k2 - 1) * sp > seg) continue;
        const ss = [];
        for (let i = 0; i < k1; i++) ss.push(i * sp);
        for (let i = 0; i < k2; i++) ss.push(L - i * sp);
        rim = ss.sort((x, y) => x - y).map((s) => at(s)).map((a) => ({ a, r: c(a) }));
      }
      let clash = false;
      for (let i = 1; i < rim.length; i++) { const p = loc(rim[i - 1].a, rim[i - 1].r), q = loc(rim[i].a, rim[i].r); if (Math.hypot(q.x - p.x, q.y - p.y) < b + g - 0.5) clash = true; }
      if (clash) continue;
    }
    const am = (arc[0] + arc[1]) / 2;
    for (let hd = t.hd[0]; hd >= hdMin; hd -= 4) {
      const dmin = (m + hd / 2) / Math.min(Math.cos(rad(am)), Math.sin(rad(am)));
      const dfit = Math.min(R(am) - inset - hd / 2, HUB_CAP);
      if (dfit < dmin) continue;
      // the hub's resting place: about seven tenths of the way out along the middle of the reach
      const dmax = Math.max(dmin, Math.min(dfit, R(am) * 0.72));
      let found = null;
      for (let d = dmax; d >= dmin; d -= 1) {
        const h = loc(am, d);
        if (rim.every((q) => { const p = loc(q.a, q.r); return Math.hypot(p.x - h.x, p.y - h.y) >= hd / 2 + b / 2 + g; })) { found = d; break; }
      }
      if (found == null) continue;
      const score = Math.min(hd / 88, b / 58) + hd / 10000;
      if (!best || score > best.score) best = { score, b, hd, hub: { a: am, d: found }, rim };
      break;
    }
  }
  return best;
}
// The most rim buttons that fit, at the best tier that holds at least two (or the full set).
function plan(n) {
  for (const t of TIERS) {
    for (let k = n; k >= Math.min(n, t.end1 ? 1 : 2); k--) {
      const s = solve(k, t);
      if (s) return Object.assign(s, { k });
    }
  }
  return null;
}
// Which rim buttons show: all if they fit, otherwise the most-used and a More that holds the rest.
function fold(items, k, openFolded) {
  if (k >= items.length) return { shown: items.slice(), folded: [] };
  const own = items.find((i) => i.more);
  const rank = items.map((it, i) => ({ it, i, p: it.prio || 1 })).filter((o) => o.it !== own).sort((a, b) => a.p - b.p || a.i - b.i);
  const keep = new Set(rank.slice(0, Math.max(0, k - 1)).map((o) => o.it));
  const folded = items.filter((it) => it !== own && !keep.has(it));
  const moreBtn = own || { icon: 'more', label: 'More', more: true, act: openFolded };
  if (!own) moreBtn.badge = (folded.find((f) => f.badge) || {}).badge || '';
  const shown = items.filter((it) => keep.has(it) || it === own);
  if (!own) shown.push(moreBtn);
  return { shown, folded };
}

/* The whole corner for a set of rim buttons: where the hub and each shown button sit (centres, in
   the app's box), their sizes, which buttons folded into More, and how far up the controls reach
   (the reading column ends above them). */
function layout(rimItems, openFolded) {
  const { W, H } = CH.reach.size();
  const p = plan(rimItems.length);
  const k = p ? p.k : rimItems.length;
  const { shown, folded } = fold(rimItems, k, openFolded);
  let hub, rim, b;
  if (p) {
    b = p.b;
    const h = pt(p.hub.a, p.hub.d);
    hub = { x: h.x, y: h.y, d: p.hd, a: p.hub.a, r: p.hub.d };
    rim = p.rim.map((q) => ({ a: q.a, r: q.r, p: pt(q.a, q.r) }));
  } else {
    // A reach too short for any tier: a single tidy row in the corner.
    b = 44;
    const h = pt(45, 64);
    hub = { x: h.x, y: h.y, d: 64, a: 45, r: 64 };
    rim = shown.map((_, i) => { const a = 15 + (60 * i) / Math.max(1, shown.length - 1); return { a, r: 110, p: pt(a, 110) }; });
  }
  let top = H - hub.y + hub.d / 2;
  rim.forEach((q) => { top = Math.max(top, H - q.p.y + b / 2); });
  return { W, H, hub, rim, b, shown, folded, top };
}
/* The highest the hub ever sits on any screen. A wheel's lit choice is placed above this, so it
   opens in the same spot on every screen. */
function steadyHub() {
  let best = null;
  for (let n = 0; n <= 5; n++) {
    const p = plan(n);
    if (p) { const h = pt(p.hub.a, p.hub.d); if (!best || h.y - p.hd / 2 < best.top) best = { top: h.y - p.hd / 2, cx: h.x }; }
  }
  return best;
}

export default { layout, steadyHub, plan };
