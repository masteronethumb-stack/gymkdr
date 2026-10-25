/* GYMKDR · stage (Chalk's stage.js, without the page). Everything the thumb touches, laid out inside
   the measured reach: the hub (the one big action) and the rim (a few buttons on an arc out towards
   the edge of the reach). Screens hand it their controls; ui/Stage.tsx draws them.
   Every list is the thumb wheel, turning round the hub. */
import CH from '../ch';
import Layout from './stageLayout';
import { stageAtom } from '../ui/store';

const U = CH.u;
let cfg = { hub: null, rim: [] };
let G = null; // the last layout
let rev = 0;
let foldedNow = [];

// Labels are read beside their buttons; their size is estimated from the words, so the reading
// column can end above them too.
const labW = (t) => Math.round(String(t || '').length * 7.6 + 14);
const LAB_H = 22;

function labelBox(g, b, text) {
  const { W, H } = CH.reach.size();
  const w = labW(text), h = LAB_H;
  const a = (g.a * Math.PI) / 180;
  const out = CH.reach.fromPolar(g.a, g.r + b / 2 + 6 + Math.abs(Math.cos(a)) * (w / 2) + Math.abs(Math.sin(a)) * (h / 2));
  return { x: U.clamp(out.x - w / 2, 6, W - w - 6), y: U.clamp(out.y - h / 2, 6, H - h - 4), w, h };
}

function foldedRows() {
  return foldedNow.map((it) => ({
    label: (it.row && it.row.label) || it.label,
    value: it.row && it.row.value != null ? it.row.value : it.badge || null,
    sub: it.row && it.row.sub,
    icon: it.icon || 'next', sel: it.sel, off: it.off,
    // A folded button that opens a slide menu opens it on the hub instead.
    act: () => { S.closeList(); if (it.act) it.act(); else if (it.menu) CH.scrub.open(it.menu, 'hub', 'sticky'); },
  }));
}
function openFolded() {
  S.list({ title: 'More', rows: foldedRows(), cancel: 'Back', cancelIcon: 'back' });
}

function layout() {
  const { W, H } = CH.reach.size();
  if (!W || !H) return;
  G = Layout.layout(cfg.rim, openFolded);
  foldedNow = G.folded;
  const labels = G.shown.map((r, i) => (G.rim[i] ? labelBox(G.rim[i], G.b, r.label) : null));
  /* How far up the controls reach. The reading column ends above them (and their labels), so no
     text ever sits behind a button. Longer pages scroll inside the column. */
  let top = G.top;
  labels.forEach((l) => { if (l) top = Math.max(top, H - l.y); });
  const reachH = Math.round(top + 16);
  const d = G.hub.d;
  CH.scrub.setHubRect({ x: G.hub.x - d / 2, y: G.hub.y - d / 2, w: d, h: d });
  rev++;
  stageAtom.set({ hub: cfg.hub, rim: G.shown, G, labels, reachH, rev });
}

function listSpec(L) {
  const rows = (L.rows || []).slice().reverse();
  const cancel = { label: L.cancel || 'Cancel', icon: L.cancelIcon || 'close', nav: true, act: () => { if (L.onCancel) L.onCancel(); } };
  const options = [cancel].concat(rows.map((r) => Object.assign({}, r, { act: r.off ? null : () => { if (r.act) r.act(); } })));
  let start = null;
  const sel = rows.findIndex((r) => r.sel);
  if (sel >= 0) start = sel + 1;
  const lead = sel < 0 && L.start === 'end' && rows.length ? 1 : null;
  // A list with a current value marked (a weight, the reps, the rest time) is a scale: it keeps its order.
  return { title: L.title || '', options, start, lead, ordered: sel >= 0, big: !!L.big, onClose: () => { if (L.onCancel) L.onCancel(); } };
}

const S = (CH.stage = {
  steadyHub: () => Layout.steadyHub(),
  // Replace the hub and rim together (a screen's controls).
  set(c) {
    if (CH.scrub && CH.scrub.isOpen() && !c.keepMenu && !c.keepList) CH.scrub.dismiss();
    cfg.hub = c.hub || null;
    cfg.rim = (c.rim || []).slice(0, 5);
    layout();
  },
  hub(h) { if (CH.scrub && CH.scrub.isOpen()) CH.scrub.dismiss(); cfg.hub = h; layout(); },
  /* Only the rim, leaving the hub alone (fix 6: the end of a rest changes the rest button, and a
     thumb already pressing the hub keeps its press). */
  rim(r) { cfg.rim = (r || []).slice(0, 5); layout(); },
  current: () => cfg,
  list(L) { CH.scrub.open(listSpec(L), 'hub', 'sticky'); },
  closeList: () => { if (CH.scrub.isOpen()) CH.scrub.dismiss(); },
  listOpen: () => CH.scrub.isOpen(),
  folded: () => foldedRows(),
  layout,
  geometry: () => G,
  swapHands() { layout(); },
  hubEl: () => 'hub',
  hubCentre: () => (G ? { x: G.hub.x, y: G.hub.y } : { x: 0, y: 0 }),
  rimEl: (label) => (G ? G.shown.find((b) => (b.aria || b.label || '').startsWith(label)) || null : null),
  // The size of the thumb's region, so screens can keep reading content above it.
  reachTop: () => Math.max(CH.reach.R(80), CH.reach.R(88)),
});

export default S;
