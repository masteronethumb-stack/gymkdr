/* GYMKDR · reach. The One Thumb standards: the sweep chooses the side the button goes on, makes
   swapping to the other thumb a gesture rather than a setting, and tells the app where to put
   controls so they're in reach. A touch outside the sweep is fine. Every cold launch opens on the
   hand sweep (pre-filled on relaunch, saved by a countdown, no button for touch); hands swap by
   sweeping the other thumb. The sweep always runs one way: from the side of the screen down to the
   bottom edge. With a screen reader, the hand is chosen with two buttons instead.

   Co-ordinates are the app's box (the screen inside the safe area): x from the left, y from the top. */
import CH from '../ch';

const U = CH.u;
const N = 19; // radii every 5° from along the bottom edge (0°) to straight up the side (90°)
let W = 0, H = 0;

const R = (CH.reach = {
  prof: null, // { hand, r: { right: [...], left: [...] }, at }
  open: false,
  init() {
    const p = CH.local.get('reach', null);
    if (p && p.r && (Array.isArray(p.r.right) || Array.isArray(p.r.left)) && (p.hand === 'left' || p.hand === 'right')) R.prof = p;
  },
  setSize(w, h) { if (w > 0 && h > 0) { W = w; H = h; } },
  size: () => ({ W, H }),
  get hand() { return R.prof ? R.prof.hand : 'right'; },
  other: (h) => (h === 'right' ? 'left' : 'right'),
  save() { R.prof.at = Date.now(); CH.local.set('reach', R.prof); },
  radii(h = R.hand) {
    if (R.prof && R.prof.r[h]) return clean(R.prof.r[h]);
    if (R.prof && R.prof.r[R.other(h)]) return clean(R.prof.r[R.other(h)]);
    const d = U.clamp(Math.min(W * 0.72, H * 0.42), 150, 320);
    return new Array(N).fill(d);
  },
  polar(x, y, h = R.hand) {
    const dx = h === 'right' ? W - x : x, dy = H - y;
    return { r: Math.hypot(dx, dy), th: (Math.atan2(dy, dx) * 180) / Math.PI };
  },
  fromPolar(th, r, h = R.hand) {
    const a = (th * Math.PI) / 180, dx = r * Math.cos(a), dy = r * Math.sin(a);
    return { x: h === 'right' ? W - dx : dx, y: H - dy };
  },
  R(th, h = R.hand) {
    const rr = R.radii(h), t = U.clamp(th, 0, 90) / 5, i = Math.floor(t), f = t - i;
    return i >= N - 1 ? rr[N - 1] : rr[i] * (1 - f) + rr[i + 1] * f;
  },
  inReach(x, y, margin = 0, h = R.hand) {
    const q = R.polar(x, y, h);
    if (q.th < -6 || q.th > 96) return false;
    return q.r <= R.R(q.th, h) - margin;
  },
  // The reach as an SVG path (for the sweep screen).
  path(h = R.hand, rr) {
    const c = R.fromPolar(0, 0, h);
    let d = `M${U.f1(c.x)} ${U.f1(c.y)}`;
    for (let th = 0; th <= 90; th += 2.5) {
      const p = R.fromPolar(th, rr ? interp(rr, th) : R.R(th, h), h);
      d += `L${U.f1(p.x)} ${U.f1(p.y)}`;
    }
    return d + 'Z';
  },
  analyse, radiiFrom, travel,
  /* Judging a sweep: which hand, and whether it's a clean, wide arc swept from the side down to the
     bottom edge. Returns { ok, hand, r } or { ok: false, why: 'wrongWay' | 'narrow' }. */
  judge(pts) {
    const a = analyse(pts, 'right'), b = analyse(pts, 'left');
    const hand = a.cv + (1 - a.frac) <= b.cv + (1 - b.frac) ? 'right' : 'left';
    const res = hand === 'right' ? a : b;
    const bad = pts.length < 6 || res.span < 38 || res.med < 90 || res.cv > 0.38;
    const wrongWay = !bad && travel(pts, hand) < 20;
    if (bad || wrongWay) return { ok: false, why: wrongWay ? 'wrongWay' : 'narrow' };
    return { ok: true, hand, r: radiiFrom(pts, hand) };
  },
  /* The hand watcher: sweep the other thumb to swap. Fed with every touch on the app. A clean, wide
     arc round the other corner, mostly outside this reach, swept from the side down to the bottom
     edge, swaps hands. Returns the new hand, or null. */
  watchEnd(pts, ms) {
    if (R.open || !R.prof || ms > 2600 || pts.length < 8) return null;
    const oh = R.other(R.hand);
    const res = analyse(pts, oh);
    const outside = pts.filter((p) => !R.inReach(p.x, p.y)).length / pts.length;
    if (res.span >= 55 && res.cv < 0.25 && res.med >= 110 && outside >= 0.4 && res.frac >= 0.9 && travel(pts, oh) >= 20) {
      const rr = radiiFrom(pts, oh);
      if (!rr) return null;
      const from = R.hand;
      R.prof.hand = oh;
      R.prof.r[oh] = rr;
      R.save();
      CH.haptic('impact');
      CH.bus.emit('hand', { from, to: oh });
      return oh;
    }
    return null;
  },
});

// A sweep wobbles by a few points, so the saved reach is smoothed into one clean curve that stays
// within 10 points of what the thumb actually swept.
const cleaned = new WeakMap();
function clean(rr) {
  if (cleaned.has(rr)) return cleaned.get(rr);
  const cap = Math.max(200, Math.hypot(W, H));
  const out = U.fitCurve(rr, 10).map((v) => Math.round(U.clamp(v, 110, cap)));
  cleaned.set(rr, out);
  return out;
}
function interp(rr, th) {
  const t = U.clamp(th, 0, 90) / 5, i = Math.floor(t), f = t - i;
  return i >= N - 1 ? rr[N - 1] : rr[i] * (1 - f) + rr[i + 1] * f;
}
function analyse(pts, h) {
  const pol = pts.map((p) => R.polar(p.x, p.y, h));
  const inQ = pol.filter((q) => q.th >= -10 && q.th <= 100);
  if (!inQ.length) return { med: 0, cv: 9, span: 0, frac: 0 };
  const rs = inQ.map((q) => q.r), m = U.mean(rs);
  const sd = Math.sqrt(U.mean(rs.map((r) => (r - m) * (r - m))));
  const ths = inQ.map((q) => q.th);
  return { med: U.median(rs), cv: m ? sd / m : 9, span: Math.max(...ths) - Math.min(...ths), frac: inQ.length / pts.length };
}
function radiiFrom(pts, h) {
  const r = new Array(N).fill(0);
  pts.forEach((p) => {
    const q = R.polar(p.x, p.y, h);
    if (q.th < -8 || q.th > 98) return;
    const i = U.clamp(Math.round(q.th / 5), 0, N - 1);
    r[i] = Math.max(r[i], q.r);
  });
  const known = r.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (!known.length) return null;
  for (let i = 0; i < N; i++) {
    if (r[i]) continue;
    const lo = known.filter((k) => k < i).pop(), hi = known.find((k) => k > i);
    if (lo != null && hi != null) r[i] = r[lo] + ((r[hi] - r[lo]) * (i - lo)) / (hi - lo);
    else r[i] = r[lo != null ? lo : hi];
  }
  const cap = Math.hypot(W, H);
  return U.fitCurve(r, 10).map((v) => Math.round(U.clamp(v, 110, cap)));
}
// Which way a stroke went round the corner, in degrees: positive when it started up the side and
// finished down at the bottom edge (the One Thumb direction), negative the other way.
function travel(pts, h) {
  const th = pts.map((p) => R.polar(p.x, p.y, h).th);
  const k = Math.max(2, Math.round(th.length * 0.2));
  return U.median(th.slice(0, k)) - U.median(th.slice(-k));
}

export default R;
