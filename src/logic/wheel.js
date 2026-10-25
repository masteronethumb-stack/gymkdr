/* GYMKDR · the thumb wheel (Chalk's scrub.js, without the page). Every menu in the app is this one
   control. Press a button and its choices rise in a column above the Start button, on the thumb's
   side, with the description read down the other side; the lit choice is always in the column's
   middle slot. The wheel opens on its lit choice (the recommended or current one) with the others
   either side.
   Slide the thumb and the wheel rolls with it. Letting go only holds the choice: nothing happens
   until the button is tapped. Any choice can also be tapped (once to light it, again to choose it).
   The button always says what it will do. Choosing something that has its own choices sprouts them
   from the same button, with Back among them; holding the button still for a moment goes back to the
   first menu (a ring fills while you hold). Tap outside to close.

   This module holds the state; ui/Wheel.tsx draws it and feeds it the thumb's moves. */
import CH from '../ch';
import Layout from './stageLayout';

const U = CH.u;
const HOME_MS = 650;
const SLOT = 52, PITCH = 60, TOP = 40, GAP = 14;

let spec = null, src = null, opts = [], idx = 0, ctr = 0, mode = null;
let drag = null, swallow = false, autoT = 0, homeT = 0, armed = false, homing = false;
let stack = [], chaining = null, last = { title: null, idx: 0, at: 0 };
// How the thumb last moved the wheel since it opened: nothing yet, a slide, or a tap on a choice.
let how = 'open';
let version = 0;
const subs = new Set();
const bump = () => { version++; subs.forEach((f) => f()); };

/* The first few times: a coach line above the wheel says what to do next. It goes once the lifter
   has chosen enough times. */
const LEARN = 30;
const learning = () => { const st = CH.store && CH.store.state; return !!st && (((st.learn || {}).picks) || 0) < LEARN; };
function learned() {
  const st = CH.store && CH.store.state;
  if (!st) return;
  const l = st.learn && typeof st.learn === 'object' ? st.learn : (st.learn = {});
  l.picks = (l.picks || 0) + 1;
  if (l.picks <= LEARN) CH.store.save();
}
const step = () => (spec && spec.compact ? 30 : 36);
const isOpen = () => !!spec;

/* ---------------- geometry: the column above the button ---------------- */
const V = { h: 2, colL: 0, colW: 0, infoL: 0, infoW: 0, base: 0, foot: 0, hubBottom: 0, hintBottom: 0, infoH: 0 };
let hubRect = null; // the Start button's box in the app, set by the stage
function measure() {
  const { W, H } = CH.reach.size();
  const r = hubRect || { x: W - 120, y: H - 140, w: 96, h: 96 };
  const steady = Layout.steadyHub();
  const ownTop = r.y;
  const cx = steady ? steady.cx : r.x + r.w / 2, top = steady ? Math.min(ownTop, steady.top) : ownTop;
  const right = (CH.reach.hand || 'right') !== 'left';
  // A column of numbers needs less width than words, so the huge number beside it gets more.
  const colW = Math.round(spec && spec.big ? U.clamp(W * 0.36, 140, 152) : U.clamp(W * 0.44, 156, 200));
  const centre = right ? Math.min(cx + 14, W - 12 - colW / 2) : Math.max(cx - 14, 12 + colW / 2);
  const colL = Math.round(centre - colW / 2);
  const fit = Math.floor((top - GAP - (TOP + 16) + 8) / PITCH);
  const maxH = Math.max(1, Math.min(4, Math.floor((fit - 1) / 2)));
  V.colL = colL; V.colW = colW;
  V.foot = top - GAP;
  V.h = spec && spec.compact ? 1 : maxH;
  V.base = V.foot - maxH * PITCH - SLOT / 2;
  V.infoL = right ? 20 : colL + colW + 16;
  V.infoW = right ? colL - 16 - 20 : W - 20 - V.infoL;
  V.hubBottom = ownTop + r.h;
  V.hintBottom = Math.min(V.hubBottom, H - 40);
  V.infoH = V.hintBottom - TOP - 16;
}
const half = () => (spec && spec.compact ? 1 : V.h);

/* ---------------- opening and closing ---------------- */
function open(s, m, at) {
  // A menu opened by choosing something in another menu is its child: Back returns there.
  const parent = chaining;
  chaining = null;
  if (parent) stack.push(parent); else if (at == null) stack = [];
  src = s;
  spec = typeof s === 'function' ? s() : s;
  if (!spec) return;
  opts = (spec.options || []).filter(Boolean).slice();
  if (!opts.length) { spec = null; bump(); return; }
  if (stack.length && !opts.some((o) => o.icon === 'back' || o.back)) {
    const p = stack[stack.length - 1];
    opts.push({ label: 'Back', sub: p.title || '', icon: 'back', back: true, act: () => goBack() });
  }
  measure();
  // The menu's own first choice (its recommendation) moves to the middle of the wheel.
  const lead = spec.lead != null ? spec.lead : spec.start === 0 ? 0 : null;
  let leadAt = null;
  if (lead != null && !spec.keep && opts.length >= 3 && !spec.compact && lead < opts.length) {
    const [f] = opts.splice(lead, 1);
    leadAt = opts.length + 1 > 2 * half() + 1 ? Math.min(half(), Math.floor(opts.length / 2)) : Math.floor(opts.length / 2);
    opts.splice(leadAt, 0, f);
  }
  mode = m;
  armed = false;
  how = 'open';
  const mid = Math.floor((opts.length - 1) / 2);
  let want = U.clamp(spec.keep ? spec.start || 0 : leadAt != null ? leadAt : spec.start > 0 || (spec.start === 0 && spec.compact) ? spec.start : mid, 0, opts.length - 1);
  /* The wheel opens full: the lit choice sits in the middle with real choices filling the slots
     either side. A menu of choices is reordered to do it; a scale (`ordered`) keeps its order, and
     its Back goes to whichever end gives the lit value more neighbours. */
  if (!spec.compact) {
    const hh = Math.min(half(), Math.floor((opts.length - 1) / 2));
    const backAt = opts.length - 1, autoBack = opts[backAt] && opts[backAt].back;
    if (spec.ordered) {
      if (autoBack && want < hh) { opts.unshift(opts.pop()); want += 1; }
    } else {
      const t = opts.length <= 2 * half() + 1 ? Math.floor((opts.length - 1) / 2) : U.clamp(want, hh, opts.length - 1 - hh);
      if (t !== want) { const [o] = opts.splice(want, 1); opts.splice(t, 0, o); want = t; }
    }
  }
  const again = last.title === (spec.title || '') && Date.now() - last.at < 700;
  idx = U.clamp(at != null ? at : again ? last.idx : want, 0, opts.length - 1);
  ctr = idx;
  bump();
  if (spec.onMove && opts[idx]) spec.onMove(opts[idx], idx);
}
function close(cancelled) {
  if (!spec) return;
  stopAuto(); stopHome();
  const s = spec;
  last = { title: s.title || '', idx, at: Date.now() };
  spec = null; src = null; opts = []; mode = null; drag = null; armed = false;
  if (cancelled) stack = [];
  bump();
  if (s.onHide) s.onHide();
  if (cancelled && s.onClose) s.onClose();
}
function pick(i) {
  if (!spec) return;
  if (i != null) idx = i;
  const o = opts[idx];
  if (!o || o.off) { CH.haptic('warning'); return; }
  CH.haptic('success');
  learned();
  const here = { s: src, idx, title: spec.title || '' };
  close(false);
  if (o.back) { o.act(); return; }
  chaining = here;
  try { if (o.act) o.act(o); } finally { if (chaining === here) { chaining = null; if (!spec) stack = []; } }
}
function goBack() {
  const p = stack.pop();
  if (!p) return;
  open(p.s, 'sticky', p.idx);
  pop();
}
function goHome() {
  if (!stack.length) return;
  const root = stack[0];
  stack = [];
  close(false);
  open(root.s, 'sticky', root.idx);
  CH.haptic('impact');
  pop();
  if (CH.ui && CH.ui.toast) CH.ui.toast({ icon: 'back', text: root.title || 'Back to the start' });
}
let popAt = 0;
function pop() { popAt = Date.now(); bump(); }

/* ---------------- what the chips say ----------------
   Chips are kept short and tidy: gym shorthand (BB, DB, KB…), no icons. The full name reads on the
   other side of the screen. */
const ABBR = [[/\bbarbell\b/gi, 'BB'], [/\bdumbbells?\b/gi, 'DB'], [/\bkettlebells?\b/gi, 'KB'], [/\bsmith machine\b/gi, 'Smith'], [/\bplate-loaded\b/gi, 'Plate'], [/\bmachine\b/gi, 'machine'], [/\bcable\b/gi, 'Cable'], [/\bbodyweight\b/gi, 'BW'], [/\bsingle-leg\b/gi, '1-leg'], [/\bsingle-arm\b/gi, '1-arm'], [/\bone leg\b/gi, '1-leg'], [/\bone arm\b/gi, '1-arm'], [/\bseated\b\s*/gi, '']];
// Shortened only when the full words wouldn't fit a chip: "Overhead squat" stays whole.
const SOFT = [[/\bincline\b/gi, 'Incl.'], [/\bdecline\b/gi, 'Decl.'], [/\boverhead\b/gi, 'OH']];
function abbr(t) {
  const orig = String(t || '');
  let x = orig;
  ABBR.forEach(([re, r]) => { x = x.replace(re, r); });
  if (x.replace(/\s+/g, ' ').trim().length > 18) SOFT.forEach(([re, r]) => { x = x.replace(re, r); });
  x = x.replace(/\s+/g, ' ').replace(/^, |, $/g, '').trim();
  // Fix 5: a choice that is only a word the shortening drops ("Seated") keeps its own words.
  if (!x) x = orig.trim();
  return x.charAt(0).toUpperCase() + x.slice(1);
}
/* Leaving a menu (Back, Cancel, Done) never looks like a choice in it: it carries a chunky icon and
   a thin line sets it apart, so "Go back" can't be mistaken for the Back muscle. */
const isNav = (o) => !!o && !!(o.back || o.nav || o.icon === 'back');
const chipText = (o) => (isNav(o) && /^back$/i.test(o.label.trim()) ? 'Go back' : abbr(o.chip || o.label));

function hint() {
  const o = opts[idx];
  if (!o) return { text: '', coach: false };
  if (learning()) {
    const t = `“${chipText(o)}”`;
    return {
      coach: true,
      text: how === 'row' ? `${t} is lit. Tap it again, or tap the button, to choose it.`
        : how === 'slid' ? (isNav(o) ? 'Tap the button to go back.' : `Tap the button to choose ${t}.`)
          : spec.coach || 'Slide to see more. Tap the button to choose the lit one.',
    };
  }
  const n = opts.filter((x) => !isNav(x)).length, more = opts.length > 2 * half() + 1;
  return { coach: false, text: spec.big ? 'Slide to change it · tap the button' : `${U.plural(n, 'choice')}${more ? ' · slide for more' : ''} · tap the button` };
}

function setIdx(i) {
  const j = U.clamp(i, 0, opts.length - 1);
  if (j === idx && ctr === idx) return;
  idx = j; ctr = j;
  CH.haptic('select');
  bump();
  if (spec.onMove && opts[idx]) spec.onMove(opts[idx], idx);
}
function arm() { armed = true; bump(); }

/* ---------------- the thumb ----------------
   Every wheel turns round the Start button, whichever button opened it. A rim button that opens one
   hands its choices to the Start button; the thumb slides from where it is. */
function press(s, p, fromHub) {
  const continuing = !!spec && (fromHub || !s);
  if (!continuing) { if (spec) close(false); open(s, 'press'); }
  if (!spec) return;
  swallow = true;
  drag = { y0: p.y, x0: p.x, base: idx, moved: false, from: 'anchor', continuing, t0: Date.now() };
  // Holding still inside a menu that came from another one: back to the first menu.
  if (continuing && stack.length) {
    homing = true; bump();
    homeT = setTimeout(() => { if (drag && !drag.moved) { drag.homed = true; stopHome(); goHome(); } }, HOME_MS);
  }
}
function stopHome() { if (homeT) { clearTimeout(homeT); homeT = 0; } if (homing) { homing = false; bump(); } }
function move(p) {
  if (!drag) return;
  const dy = p.y - drag.y0, dx = p.x - drag.x0;
  if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; stopHome(); armed = false; bump(); }
  if (!drag.moved) return;
  // The wheel rolls with the thumb: slide down and the choice above rolls into place.
  setIdx(drag.base + Math.round(dy / step()));
  stopAuto();
  const far = Math.abs(dy) > 120;
  if (far && ((dy > 0 && idx < opts.length - 1) || (dy < 0 && idx > 0))) {
    const dir = dy > 0 ? 1 : -1;
    autoT = setInterval(() => { if (!drag) return stopAuto(); drag.base += dir; setIdx(idx + dir); if (idx <= 0 || idx >= opts.length - 1) stopAuto(); }, 150);
  }
}
function stopAuto() { if (autoT) { clearInterval(autoT); autoT = 0; } }
function up() {
  if (!drag) return;
  const d = drag;
  stopAuto(); stopHome();
  drag = null;
  setTimeout(() => { swallow = false; }, 400);
  if (d.homed) return;
  if (d.from === 'overlay') {
    if (d.moved) { how = 'slid'; arm(); return; }
    if (d.row != null) {
      // a tap on a choice lights it; a tap on the lit one chooses it
      if (d.row === idx) pick(); else { idx = d.row; how = 'row'; CH.haptic('select'); arm(); if (spec.onMove && opts[idx]) spec.onMove(opts[idx], idx); }
      return;
    }
    close(true);
    return;
  }
  // Letting go holds the choice; only a tap on the button commits it.
  if (d.moved) { how = 'slid'; arm(); return; }
  if (d.continuing) { pick(); return; }
  if (opts.length === 1) { pick(0); return; }
  mode = 'sticky';
  arm();
}
function cancel() {
  if (!drag) return;
  stopAuto(); stopHome();
  drag = null;
  swallow = false;
  arm();
}
// A touch on the wheel itself (not the button): on a choice, or outside the column.
function overlayDown(p, row) {
  if (!spec) return;
  drag = { y0: p.y, x0: p.x, base: idx, moved: false, from: 'overlay', row: row != null && opts[row] && !opts[row].off ? row : null };
}
/* A button that acts on a tap but also has a wheel (Done: tap to log the target, slide for other
   reps). Nothing opens until the thumb clearly slides up or down from it; then the wheel opens on
   its starting choice and rolls with the thumb from there. Returns true once the wheel has opened. */
function slideMove(s, start, p) {
  if (spec && drag) { move(p); return true; }
  const dy = p.y - start.y, dx = p.x - start.x;
  if (Math.abs(dy) < 14 || Math.abs(dy) < Math.abs(dx)) return false;
  open(s, 'press');
  if (!spec) return false;
  swallow = true;
  drag = { y0: p.y, x0: p.x, base: idx, moved: true, from: 'anchor', continuing: false, t0: Date.now() };
  return true;
}

const W = (CH.scrub = {
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  version: () => version,
  setHubRect(r) { hubRect = r; if (spec) { measure(); bump(); } },
  // what the Wheel component draws
  snapshot() {
    if (!spec) return null;
    const h = half();
    const rows = [];
    for (let d = -h; d <= h; d++) {
      const k = ctr + d, o = opts[k];
      rows.push({ d, k, o, on: k === idx, chip: o ? chipText(o) : '', nav: isNav(o), lineAbove: isNav(o) && opts[k + 1] && !isNav(opts[k + 1]), lineBelow: isNav(o) && opts[k - 1] && !isNav(opts[k - 1]), top: Math.round(V.base - d * PITCH - SLOT / 2), empty: !o, void: !o && (opts.length < 2 * h + 1 || how === 'open') });
    }
    return { spec, opts, idx, rows, V: Object.assign({}, V), slot: SLOT, armed, dragging: !!drag && drag.moved, how, hint: hint(), homing, popAt, stackDepth: stack.length };
  },
  open: (s, a, m) => open(s, m || 'sticky'),
  press, move, up, cancel, overlayDown, slideMove,
  // The button's own click (a screen reader's activation): choose the lit one, or open the menu.
  click(s) {
    if (spec) { pick(); return; }
    open(s, 'sticky');
    armed = true; bump();
  },
  pickRow: (k) => pick(k),
  // A screen reader's swipe up or down on the button (or a keyboard's arrows): one choice along.
  nudge(dir) { if (!spec) return; how = 'slid'; armed = true; setIdx(idx + dir); bump(); },
  consumeClick() { if (swallow) { swallow = false; return true; } return false; },
  close: () => close(true), isOpen,
  // a screen changing underneath closes the menu without its cancel action
  dismiss: () => { if (spec) { close(false); stack = []; } },
  // a fresh first menu: no Back to whatever came before
  root: (s) => { chaining = null; if (spec) close(false); stack = []; open(s, 'sticky'); },
  // The same menu again, redrawn after a change made from it (a day ticked): same place, same Back.
  stay: (s) => { chaining = null; if (spec) close(false); open(s, 'sticky', last.idx); },
  learning,
  chipText, abbr,
  current: () => (spec && idx >= 0 ? opts[idx].label : null),
  title: () => (spec ? spec.title || '' : null),
  index: () => (spec ? idx : -1),
  labels: () => opts.map((o) => ({ label: o.label, sub: o.sub || '', value: o.value != null ? String(o.value) : '' })),
  relayout: () => { if (spec) { measure(); bump(); } },
  vertical: () => true,
  slotPitch: PITCH,
});

export default W;
