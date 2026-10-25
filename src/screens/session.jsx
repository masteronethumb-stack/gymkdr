/* GYMKDR · session: logging a workout (Chalk's session.js).
   Done logs today's target in one tap. Different reps: slide on Done and the reps roll round it;
   stop on the number you did and tap Done (or use Reps, where the corner has room). Weight: Weight,
   then the weight. Exercises can be done in any order: swipe left or right, or open Exercises; a busy
   machine is one swap away. Rest timer is optional, and tells you when it's over even with the
   phone locked.

   Every exercise in a workout has its own id, and every set records the id of the exercise it
   belongs to, so swapping or adding exercises never moves a set onto another exercise.

   Cardio (cardio.js) shares the screen: the button runs a timer (Start, then Stop), then asks the
   result the machine shows and how hard it felt. Done already? Slide on Start for the minutes. */
import React, { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import CH from '../ch';
import Icon from '../ui/Icon';
import { F, useTheme, useVw } from '../ui/theme';
import { Card, Chip, Dim, T } from '../ui/kit';

const U = CH.u;
const E = () => CH.engine, S = () => CH.store, D = () => CH.data;
const EFFORT = { 1: 'Easy', 2: 'Hard', 3: 'Failure' };
let tick = 0, restFired = false, lastLog = 0, controlsStale = false, staleOk = false;
const STALE = 4 * 3600e3; // a workout untouched this long is from another day

const A = () => S().state.active;
const save = () => S().save();
const history = () => S().sessions();
const settings = () => S().state.settings;
const exOf = (it) => D().ex(it.ex) || { name: 'Unknown exercise', eq: 'machine', help: [] };
// On the workout screen a branded machine shows its movement as the name and its brand beneath.
const short = (e) => (e.base ? (D().ex(e.base) || e).name : e.name);
const incOf = (it) => settings().inc[exOf(it).eq] || 2.5;
const bwOnly = (it) => exOf(it).eq === 'bodyweight' && !(it.w > 0);
const load = (it, w, r) => (exOf(it).eq === 'bodyweight' && !(w > 0) ? `${r} reps` : `${U.kg(w)} kg × ${r}`);
// A logged set in words, exactly as stored: "Bench press 60 kg × 8, warm-up".
const setText = (x) => (x.c ? `${exOf(x).name} ${CH.cardio.entryText(x)}` : `${exOf(x).name} ${load(x, x.w, x.r)}${x.wu ? ', warm-up' : ''}`);
// The rest that will actually run after this exercise: its own, or the default.
const restOf = (it) => (it && it.rest > 0 ? it.rest : settings().rest);

function makeItem(src, past) {
  const st = S().state;
  if (CH.cardio.isCardio(src.ex)) {
    // Cardio: the planned minutes, and settings from last time (else the plan's). One entry completes it.
    return {
      id: U.id(), ex: src.ex, cardio: true, min: src.min > 0 ? src.min : CH.cardio.defaultMin(src.ex), set: CH.cardio.startSettings(src.ex, src.set),
      sets: 1, lo: 0, hi: 0, rest: 0, targets: [{ w: 0, r: 0 }], reason: '', kind: 'cardio', w: 0, confirmed: true,
    };
  }
  const t = E().target(src, past, st.settings);
  const ex = D().ex(src.ex);
  return {
    id: U.id(), ex: src.ex, slot: src.slot || D().slotFor(src.ex), sets: src.sets, lo: src.lo, hi: src.hi, rest: src.rest || 0, light: !!src.light,
    targets: t.sets, reason: t.reason, kind: t.kind, w: t.sets[0] ? t.sets[0].w : 0,
    // A first time with a weight to pick: the lifter sets it before the first set is logged.
    confirmed: !(t.kind === 'first' && ex && (ex.eq !== 'bodyweight' || ex.assist)),
  };
}
// The routine a workout comes from: usually the one in use, sometimes a one-off from another.
const routineOf = (id) => (id && CH.routines.get(id)) || S().state.plan;
function build(dayIdx, routineId) {
  const r = routineOf(routineId), day = r.days[dayIdx];
  const past = history();
  const items = day.items.filter((it) => D().ex(it.ex)).map((it) => makeItem(it, past));
  return { id: U.id(), routineId: r.id, dayIdx, dayId: day.id, day: day.name, start: Date.now(), items, i: 0, sets: [], wu: false, rest: null };
}

const setsOf = (a, i) => { const id = a.items[i] && a.items[i].id; return a.sets.filter((x) => x.itemId === id); };
const itemIndex = (a, x) => a.items.findIndex((it) => it.id === x.itemId);
const done = (a, i) => setsOf(a, i).filter((x) => !x.wu).length;
const complete = (a, i) => done(a, i) >= a.items[i].targets.length;
const allDone = (a) => a.items.every((_, i) => complete(a, i));
const repsFor = (a, i) => { const it = a.items[i], k = done(a, i); const t = it.targets[Math.min(k, it.targets.length - 1)]; return t ? t.r : it.lo; };
const firstOpen = (a, from = 0) => {
  for (let k = 0; k < a.items.length; k++) { const i = (from + k) % a.items.length; if (!complete(a, i)) return i; }
  return -1;
};

/* ---------------- actions ---------------- */
function start(dayIdx, routineId) {
  const st = S().state, r = routineOf(routineId);
  if (!r.days[dayIdx] || !r.days[dayIdx].items.length) { CH.ui.toast('Add exercises to this workout in Routine first.'); return; }
  // Never replace a workout that's still open: the lifter decides what happens to it first.
  if (st.active) { stillOpen(r.days[dayIdx].name, () => start(dayIdx, routineId)); return; }
  const built = build(dayIdx, routineId);
  if (!built.items.length) { CH.ui.toast(`None of ${U.esc(r.days[dayIdx].name)}'s exercises are in the library any more. Change them in Routines.`); return; }
  st.active = built;
  staleOk = false;
  save();
  CH.wake.on();
  CH.ui.show('session');
}
function stillOpen(name, then) {
  const a = A(), n = a.sets.length;
  CH.stage.list({
    title: `${a.day} is still open`,
    rows: [
      { label: `Discard it, start ${name}`, sub: n ? `${U.plural(n, 'set')} from ${a.day} will be lost` : 'Nothing was logged in it', icon: 'trash', danger: true, act: () => { discard(true); then(); } },
      n ? { label: `Save it, start ${name}`, sub: `${U.plural(n, 'set')} go into your history`, icon: 'check', act: () => { finish({ quiet: true, warmOnly: true }); then(); } } : null,
      { label: `Back to ${a.day}`, sub: 'Carry on where you were', icon: 'play', accent: true, act: () => { CH.stage.closeList(); CH.session.resume(); } },
    ].filter(Boolean),
    cancel: 'Not now', cancelIcon: 'back',
  });
}

function logSet(reps) {
  const a = A();
  if (!a || !a.items.length) return;
  // A double tap (or a bounce) logs one set, not two.
  if (Date.now() - lastLog < 450) return;
  const it = a.items[a.i];
  if (it.cardio) { cardioTap(); return; }
  if (!it.confirmed) { weightList(); return; }
  lastLog = Date.now();
  const r = reps != null ? reps : repsFor(a, a.i);
  const set = { ex: it.ex, itemId: it.id, w: it.w, r, e: 0, wu: !!a.wu, t: Date.now() };
  const pr = E().isPR(set, it.ex, history(), a.sets);
  a.sets.push(set);
  CH.haptic(pr ? 'pr' : 'success');
  CH.sound.play(pr ? 'pr' : 'done');
  if (pr) {
    set.pr = pr;
    CH.ui.toast(`${CH.icon('star')}<span><b>PR</b> ${U.esc(exOf(it).name)} ${U.esc(load(it, set.w, set.r))}</span>`, 'pr');
  }
  const wasWarm = a.wu;
  a.wu = false;
  a.rest = !wasWarm && settings().restOn ? { from: Date.now(), len: restOf(it) * 1000 } : null;
  restFired = false;
  // Finished this exercise: move to the next one not done yet. Swipe or Exercises picks another.
  if (!wasWarm && done(a, a.i) === it.targets.length) {
    const next = firstOpen(a, a.i + 1);
    if (next >= 0 && next !== a.i) {
      a.i = next;
      if (!pr) CH.ui.toast(`Next: ${U.esc(exOf(a.items[next]).name)}. Swipe for another.`);
    }
  }
  save();
  render();
}

function setWeight(wt) {
  const a = A();
  a.items[a.i].w = Math.max(0, Math.round(wt * 4) / 4);
  a.items[a.i].confirmed = true;
  save();
  CH.stage.closeList();
  render();
}

/* ---------------- cardio ----------------
   a.run is the timer: { itemId, from, stop }. Start sets `from`; Stop sets `stop` and asks for the
   result; once logged, the timer is cleared. A stopped timer that wasn't logged (the wheel was
   closed) waits on the button as "Log it". */
const runFor = (a, it) => (a.run && a.run.itemId === it.id ? a.run : null);
const runSecs = (run) => Math.max(1, Math.round(((run.stop || Date.now()) - run.from) / 1000));
function cardioTap() {
  const a = A(), it = a.items[a.i], run = runFor(a, it);
  if (Date.now() - lastLog < 450) return;
  lastLog = Date.now();
  if (!run) {
    // Another exercise's timer is still going (or stopped, not logged): it's settled first, never lost.
    const other = a.run && a.items.find((x) => x.id === a.run.itemId);
    if (other && other !== it) { otherTimer(a, it, other); return; }
    a.run = { itemId: it.id, from: Date.now(), stop: null };
    a.rest = null;
    CH.haptic('success');
    CH.sound.play('done');
    save();
    render();
    CH.ui.toast(`${U.esc(exOf(it).name)}: timer running.`);
    return;
  }
  if (!run.stop) { run.stop = Date.now(); CH.haptic('success'); save(); render(); }
  cardioResult(it, runSecs(run));
}
function otherTimer(a, it, other) {
  const name = exOf(other).name, here = exOf(it).name, secs = runSecs(a.run);
  CH.stage.list({
    title: `${name}: ${a.run.stop ? 'stopped, not logged yet' : 'still timing'} · ${U.clock(secs * 1000)}`,
    rows: [
      { label: `Start ${here} anyway`, sub: `${name}'s ${U.clock(secs * 1000)} won't be kept`, icon: 'trash', danger: true, act: () => { const A2 = A(); A2.run = null; save(); CH.stage.closeList(); lastLog = 0; cardioTap(); } },
      { label: `Log ${name} first`, sub: `Then start ${here}`, icon: 'check', accent: true, act: () => { const A2 = A(); CH.stage.closeList(); A2.i = A2.items.indexOf(other); save(); render(); lastLog = 0; cardioTap(); } },
    ],
    start: 'end', cancel: 'Back to the workout', cancelIcon: 'back',
  });
}
function cardioResult(it, secs) {
  CH.cardio.result(it.ex, secs, it.set, ({ d, e }) => logCardio(it, secs, d, e));
}
function logCardio(it, secs, d, e) {
  const a = A();
  if (!a) return;
  const x = { ex: it.ex, itemId: it.id, c: true, w: 0, r: 0, s: secs, d: d || 0, set: Object.assign({}, it.set), e: e || 0, wu: false, t: Date.now() };
  a.sets.push(x);
  a.run = null;
  a.rest = null;
  CH.haptic('success');
  CH.sound.play('done');
  const i = a.items.indexOf(it);
  const next = firstOpen(a, i + 1);
  if (next >= 0 && next !== i) a.i = next;
  save();
  render();
  CH.ui.toast(`${U.esc(exOf(it).name)}: ${U.esc(CH.cardio.entryText(x))}.${next >= 0 && next !== i ? ` Next: ${U.esc(exOf(a.items[next]).name)}.` : ''}`);
}
// Done already: the minutes, then the result. From a slide on Start, or the Minutes button.
function cardioMinutes(fromSlide) {
  const a = A(), it = a.items[a.i];
  const spec = CH.cardio.timeMenu(it.ex, it.min, (m) => cardioResult(it, m * 60), 'Done already? How long did it take?');
  if (fromSlide) return Object.assign(spec, { compact: true, window: 4, options: spec.options.map((o) => Object.assign({}, o, { info: null })) });
  CH.cardio.open(spec);
  return null;
}
function cardioSettings() {
  const a = A(), it = a.items[a.i];
  if (!CH.cardio.MACHINES[CH.cardio.ex(it.ex).machine].settings.length) { CH.ui.toast(`${U.esc(exOf(it).name)} has nothing to set.`); return; }
  CH.cardio.settingsChain(it.ex, Object.assign({}, it.set), 0, (set) => { it.set = set; save(); render(); CH.ui.toast(`Today: ${U.esc(CH.cardio.settingsText(it.ex, set))}.`); });
}
// A cardio workout on its own, from Start: no routine, one cardio exercise, ready to go.
function startCardio(pick) {
  const st = S().state;
  if (st.active) { stillOpen(CH.cardio.ex(pick.ex).name, () => startCardio(pick)); return; }
  const it = makeItem({ ex: pick.ex, min: pick.min }, history());
  it.set = Object.assign({}, pick.set || it.set);
  st.active = { id: U.id(), routineId: null, dayIdx: -1, dayId: null, day: 'Cardio', start: Date.now(), items: [it], i: 0, sets: [], wu: false, rest: null, run: null };
  staleOk = false;
  save();
  CH.wake.on();
  CH.ui.show('session');
}

function goTo(i, dir) {
  const a = A();
  if (!a || i < 0 || i >= a.items.length || i === a.i) return;
  a.i = i;
  save();
  CH.stage.closeList();
  render();
  if (dir) CH.ui.enter(dir * 40);
  CH.haptic('select');
}
const step = (dir) => { const a = A(); if (a) goTo((a.i + dir + a.items.length) % a.items.length, dir); };

function undo() {
  const a = A();
  const last = a.sets.pop();
  if (!last) return;
  const i = itemIndex(a, last);
  if (i >= 0) { a.i = i; a.items[i].w = last.w; }
  a.wu = last.wu;
  a.rest = null;
  save();
  CH.stage.closeList();
  render();
  CH.ui.toast(`Removed ${U.esc(setText(last))}.`);
}

// Swap the current exercise for another version: the machine is busy, or you'd rather.
function swapTo(exId) {
  const a = A();
  const it = a.items[a.i];
  const k = done(a, a.i);
  let fresh;
  if (k > 0) {
    // Keep what was logged; only the sets still to do (a light week's fewer, too) move to the new
    // exercise, so swapping twice never adds sets.
    fresh = makeItem({ ex: exId, slot: it.slot, sets: Math.max(1, it.targets.length - k), lo: it.lo, hi: it.hi, rest: it.rest, min: it.min }, history());
    it.targets = it.targets.slice(0, k);
    it.sets = k;
    a.items.splice(a.i + 1, 0, fresh);
    a.i += 1;
  } else {
    fresh = makeItem({ ex: exId, slot: it.slot, sets: it.sets, lo: it.lo, hi: it.hi, rest: it.rest, light: it.light, min: it.min }, history());
    a.items[a.i] = fresh;
  }
  // A cardio timer running on the exercise swapped out keeps running on its replacement.
  if (a.run && a.run.itemId === it.id && fresh.cardio) a.run.itemId = fresh.id;
  save();
  CH.stage.closeList();
  render();
  CH.ui.toast(`Swapped to ${U.esc(exOf(fresh).name.toLowerCase())}, for today.`);
}

// The lifter tagged (or untagged) the brand of this machine: today's sets move with it.
function retag(newId) {
  const a = A(), it = a.items[a.i], old = it.ex;
  if (newId !== old) {
    a.sets.forEach((x) => { if (x.itemId === it.id) x.ex = newId; });
    it.ex = newId;
  }
  save();
  CH.stage.closeList();
  render();
  const ex = exOf(it);
  CH.ui.toast(ex.brand ? `${U.esc(ex.brandName)} ${U.esc(D().ex(ex.base).name.toLowerCase())}: its own history from here.` : `${U.esc(ex.name)}: no brand.`);
}

function addToday(exId) {
  const a = A();
  const slot = D().slotFor(exId), ex = D().ex(exId);
  // Olympic lifts carry their own plan (5 × 2–3); others follow their slot, or compound or not.
  const def = ex.plan || (slot ? D().SLOTS[slot] : { lo: ex.compound ? 6 : 10, hi: ex.compound ? 10 : 15 });
  a.items.push(makeItem({ ex: exId, slot, sets: def.sets || 3, lo: def.lo, hi: def.hi }, history()));
  a.i = a.items.length - 1;
  save();
  CH.stage.closeList();
  render();
  CH.ui.toast(`Added ${U.esc(ex.name.toLowerCase())} to today.`);
}

// Cardio added to today's workout: the kind, machine, settings and time, then it's the one on screen.
function addCardioToday(pick) {
  const a = A();
  if (!a) return;
  const it = makeItem({ ex: pick.ex, min: pick.min }, history());
  it.set = Object.assign({}, pick.set || it.set);
  a.items.push(it);
  a.i = a.items.length - 1;
  save();
  CH.stage.closeList();
  render();
  CH.ui.toast(`Added ${U.esc(exOf(it).name.toLowerCase())} to today.`);
}
const cardioRow = () => ({ label: 'Add cardio', sub: 'Walk, run, cycle, row, stairs…', icon: 'flag', act: () => CH.cardio.open(CH.cardio.typeMenu(addCardioToday)) });

const lastActivity = (a) => Math.max(a.start, ...a.sets.map((x) => x.t || 0));
/* Finishing saves every set logged, warm-ups included. A workout with only warm-ups asks first.
   A workout left open since another day ends at its last set, not now. Only a workout with
   working sets moves the routine on to its next day. */
function finish(o = {}) {
  const st = S().state, a = st.active;
  if (!a) return;
  // A cardio timer still running is logged with its time, so finishing never loses it.
  if (a.run) {
    const it = a.items.find((x) => x.id === a.run.itemId);
    if (it) a.sets.push({ ex: it.ex, itemId: it.id, c: true, w: 0, r: 0, s: runSecs(a.run), d: 0, set: Object.assign({}, it.set), e: 0, wu: false, t: Date.now() });
    a.run = null;
  }
  const work = a.sets.filter((x) => !x.wu);
  if (!a.sets.length) { discard(o.quiet); return; }
  if (!work.length && !o.warmOnly) {
    CH.stage.list({
      title: 'Only warm-up sets so far',
      rows: [
        { label: 'Discard the workout', sub: `${U.plural(a.sets.length, 'warm-up set')} won't be kept`, icon: 'trash', danger: true, act: () => discard() },
        { label: 'Save the warm-up sets', sub: "Kept in your history; they don't count towards progress", icon: 'check', act: () => finish(Object.assign({}, o, { warmOnly: true })) },
        { label: 'Keep going', sub: 'Back to the set', icon: 'play', accent: true, act: () => { CH.stage.closeList(); render(); } },
      ],
      cancel: 'Back to the set', cancelIcon: 'back',
    });
    return;
  }
  const lastT = lastActivity(a);
  const end = Date.now() - lastT > STALE ? lastT + 60e3 : Date.now();
  const rec = { id: a.id, routineId: a.routineId || null, dayId: a.dayId, day: a.day, start: a.start, end, sets: a.sets.map(S().recordSet) };
  // Already finished on another device (both had it open): every set from both copies is kept.
  const before = S().all.find((x) => x.id === rec.id && !x.del);
  if (before) rec.sets = S().joinSets(rec.sets, before.sets);
  const prs = E().prsFor(rec, history());
  S().upsert(rec);
  if (work.length) {
    const doneEx = new Set(work.map((x) => x.ex));
    // The routine this came from moves on to the day after the one just done.
    const r = routineOf(a.routineId);
    r.days.forEach((d) => d.items.forEach((it) => { if (it.light && doneEx.has(it.ex)) delete it.light; }));
    const k = r.days.findIndex((d) => d.id === a.dayId);
    if (r.days.length && k >= 0) r.next = (k + 1) % r.days.length;
  }
  st.active = null;
  save();
  stopTick();
  CH.wake.off();
  CH.stage.closeList();
  if (o.quiet) { CH.ui.toast(`${U.esc(a.day)} saved.`); return; }
  CH.ui.summary(rec, prs);
}
function discard(quiet) {
  const st = S().state;
  st.active = null;
  save();
  stopTick();
  CH.wake.off();
  CH.stage.closeList();
  CH.ui.toast('Workout discarded.');
  if (!quiet) CH.ui.show('today');
}

/* ---------------- lists in the thumb's corner ---------------- */
function lastSets(exId) {
  const last = E().recent(history(), exId, 1)[0];
  return last ? last.sets : null;
}
function exercisesList() {
  const a = A();
  const rows = a.items.map((it, i) => {
    const k = done(a, i), n = it.targets.length;
    if (it.cardio) {
      const mine = setsOf(a, i).filter((x) => x.c), l = CH.cardio.last(it.ex);
      const sub = mine.length ? `Done · ${CH.cardio.entryText(mine[mine.length - 1])}` : runFor(a, it) ? 'Timer running' : l ? `Last time ${CH.cardio.entryText(l)}` : `${it.min} min · first time`;
      return { label: exOf(it).name, sub, value: mine.length ? '✓' : null, sel: i === a.i, act: () => goTo(i) };
    }
    const last = lastSets(it.ex);
    const sub = k >= n ? `Done · ${U.plural(k, 'set')}` : k ? `${k} of ${n} sets done` : last ? `Last time ${lastText(it, last)}` : `${n} sets · first time`;
    return { label: exOf(it).name, sub, value: k >= n ? '✓' : null, sel: i === a.i, act: () => goTo(i) };
  });
  rows.push({ label: 'Machine busy? Swap this one', sub: exOf(a.items[a.i]).name, icon: 'swap', act: swapList });
  rows.push({ label: 'Add an exercise to today', icon: 'plus', act: () => CH.ui.pickExercise('Add to today', addToday, exercisesList) });
  rows.push(cardioRow());
  CH.stage.list({ title: `${a.day}: any order`, rows, cancel: 'Back to the set', cancelIcon: 'back' });
}
function swapList() {
  const a = A(), it = a.items[a.i], cur = exOf(it);
  // Cardio: another type or machine (its settings and time come from last time).
  if (it.cardio) { CH.cardio.open(CH.cardio.typeMenu(({ ex }) => swapTo(ex), 'machine')); return; }
  const prof = D().profile(routineOf(a.routineId).profile);
  const alts = D().alternatives(it.ex, it.slot, prof);
  CH.stage.list({
    title: `Instead of ${cur.name.toLowerCase()}`,
    rows: alts.map((e) => ({ label: e.name, sub: (e.fam && e.fam === cur.fam ? 'Same movement · ' : '') + D().eqName(e.eq), act: () => swapTo(e.id) }))
      .concat([{ label: 'Another exercise', sub: 'Pick by muscle', icon: 'next', act: () => CH.ui.pickExercise(`Instead of ${exOf(it).name.toLowerCase()}`, swapTo, swapList, exOf(it).main) }]),
    cancel: 'Back', cancelIcon: 'back', onCancel: exercisesList,
  });
}
/* The weight scale: every step of this kit's increment from 1000 kg down to nothing, opened on
   today's weight. Today's and last time's weights are always on it, even between steps. */
const MAX_KG = 1000;
function weightList() {
  const a = A(), it = a.items[a.i];
  weightScale(it.ex, it.w, setWeight, null, !it.confirmed ? 'First set: pick the weight' : null);
}
function weightScale(exId, cur, onPick, onBack, title) {
  const it = { ex: exId }, ex = exOf(it), inc = incOf(it);
  const last = lastSets(exId);
  const lastW = last ? (ex.assist ? Math.min : Math.max)(...last.map((x) => x.w)) : null;
  const bw = ex.eq === 'bodyweight';
  const vals = new Set();
  for (let k = Math.floor(MAX_KG / inc + 1e-9); k >= 0; k--) vals.add(Math.round(k * inc * 4) / 4);
  if (cur >= 0 && cur <= MAX_KG) vals.add(cur);
  if (lastW != null && lastW <= MAX_KG) vals.add(lastW);
  const label = (v) => (ex.assist ? (v === 0 ? 'No help' : `${U.kg(v)} kg of help`) : bw ? (v === 0 ? 'Bodyweight' : `+${U.kg(v)} kg`) : `${U.kg(v)} kg`);
  // The number itself, big: "62.5" over "kg" (or "kg of help", "kg added").
  const big = (v) => ({ n: bw && v > 0 ? `+${U.kg(v)}` : U.kg(v), u: ex.assist ? 'kg of help' : bw ? (v === 0 ? 'kg · just you' : 'kg added') : 'kg' });
  const rows = Array.from(vals).sort((x, y) => y - x).map((v) => ({
    label: label(v), big: big(v),
    sub: v === cur ? 'Now' : v === lastW ? 'Last time' : null,
    sel: v === cur,
    act: () => onPick(v),
  }));
  CH.stage.list({ title: title || `${ex.name}: ${ex.assist ? 'help' : 'weight'}${basis(ex) ? ' · ' + basis(ex) : ''}`, rows, centre: true, big: true, cancel: onBack ? 'Back' : 'Back to the set', cancelIcon: 'back', onCancel: onBack || null });
}
// What the number means for this kit: one dumbbell or the pair, the bar or not.
function basis(ex) {
  if (ex.assist) return 'kg of help';
  return { dumbbell: 'each dumbbell', kettlebell: 'each kettlebell', barbell: 'bar included', smith: 'bar included', bodyweight: 'added to bodyweight', machine: 'on the stack', plate: 'plates loaded', cable: 'on the stack' }[ex.eq] || '';
}
const repTop = (it, target) => Math.max(20, (it.hi || 0) + 6, target + 10);
function repsList() {
  const a = A(), it = a.items[a.i], target = repsFor(a, a.i);
  if (!it.confirmed) { weightList(); return; }
  repsScale(target, repTop(it, target), (r) => { CH.stage.closeList(); logSet(r); }, null, `Log a set: ${bwOnly(it) ? 'bodyweight' : U.kg(it.w) + ' kg'} ×`, 'Target');
}
function repsScale(cur, top, onPick, onBack, title, mark) {
  const rows = [];
  for (let r = Math.max(top, cur); r >= 1; r--) rows.push({ label: `${r} reps`, big: { n: String(r), u: r === 1 ? 'rep' : 'reps' }, sub: r === cur ? mark : null, sel: r === cur, act: () => onPick(r) });
  CH.stage.list({ title, rows, big: true, cancel: onBack ? 'Back' : 'Back to the set', cancelIcon: 'back', onCancel: onBack || null });
}
/* Different reps from the hub: slide on Done and a wheel of reps opens on the target. It rolls
   with the thumb (down for more, up for fewer); letting go holds the number and a tap on Done
   logs the set with it, the same as every wheel in the app. */
function repsSlide() {
  const a = A(), it = a.items[a.i], target = repsFor(a, a.i);
  const top = repTop(it, target);
  const options = [];
  for (let r = 1; r <= top; r++) {
    options.push({ label: bwOnly(it) ? `${r} reps` : `${U.kg(it.w)} kg × ${r}`, short: `× ${r}`, big: { n: String(r), u: r === 1 ? 'rep' : 'reps' }, sub: r === target ? 'Target' : null, act: () => logSet(r) });
  }
  // The reps read huge, the same as the weight: the whole screen is the number while it's picked.
  return { title: `${a.wu ? 'Warm-up set' : 'Log a set'}: ${bwOnly(it) ? 'bodyweight' : U.kg(it.w) + ' kg'} ×`, big: true, ordered: true, keep: true, options, start: target - 1 };
}
function timerList() {
  const a = A(), s = settings(), it = a.items[a.i], own = it.rest > 0, eff = restOf(it);
  const running = a.rest && Date.now() - a.rest.from < a.rest.len;
  // The most used choices sit at the bottom, nearest the thumb. An exercise with its own rest
  // (set in its routine) changes that; otherwise this changes the rest for every exercise.
  const rows = [240, 180, 120, 90, 60].map((sec) => ({
    label: sec < 120 ? `${sec} seconds` : `${sec / 60} minutes`, sub: sec === 60 ? 'Small muscles, light sets' : sec === 90 ? 'Most sets' : sec >= 180 ? 'Heavy compound lifts' : null,
    sel: s.restOn && eff === sec, off: !s.restOn,
    act: () => { if (own) it.rest = sec; else s.rest = sec; if (a.rest) a.rest.len = sec * 1000; save(); CH.stage.closeList(); render(); },
  }));
  rows.push({ label: s.restOn ? 'Turn the rest timer off' : 'Turn the rest timer on', sub: 'Starts by itself after each set', icon: 'timer', act: () => { s.restOn = !s.restOn; if (!s.restOn) a.rest = null; save(); render(); timerList(); } });
  if (running) {
    rows.push({ label: 'Add 30 seconds', icon: 'plus', act: () => { a.rest.len += 30000; save(); CH.stage.closeList(); render(); } });
    rows.push({ label: 'Skip this rest', icon: 'next', accent: true, act: () => { a.rest = null; save(); CH.stage.closeList(); render(); } });
  }
  CH.stage.list({ title: s.restOn ? `Rest after ${exOf(it).name.toLowerCase()}${own ? ' (its own time)' : ''}` : 'Rest timer: off', rows, start: 'end', cancel: 'Back to the set', cancelIcon: 'back' });
}
/* The workout list. Like an action sheet: the thing you can't undo at the top, the things you
   reach for most at the bottom, nearest the thumb. Anything the corner couldn't hold comes last. */
function more() {
  const a = A();
  const lastWork = a.sets.slice().reverse().find((x) => !x.wu && !x.c);
  const it = a.items[a.i], ex = exOf(it);
  const rows = [];
  rows.push({ label: 'Discard workout', sub: 'Nothing from today is kept', icon: 'trash', danger: true, act: () => CH.stage.list({
    title: 'Discard this workout?',
    rows: [{ label: 'Discard', sub: `${U.plural(a.sets.length, 'set')} will be lost`, icon: 'trash', danger: true, act: discard }],
    cancel: 'Keep it', cancelIcon: 'back', onCancel: more,
  }) });
  rows.push({ label: 'Leave for now', sub: 'Resume from Today', icon: 'back', act: () => { CH.stage.closeList(); CH.ui.show('today'); } });
  if (D().brandable(ex)) rows.push({ label: 'Which brand of machine?', sub: ex.brand ? ex.brandName : 'Weights differ between brands', icon: 'plate', act: () => CH.ui.pickBrand(it.ex, retag, more) });
  const lastAny = a.sets[a.sets.length - 1];
  if (a.sets.length) rows.push({ label: 'Change a logged set', sub: 'Weight, reps, warm-up, or delete it', icon: 'edit', act: () => editSets(a, more) });
  if (lastAny) rows.push({ label: 'Undo last set', sub: setText(lastAny), icon: 'undo', act: undo });
  if (lastWork) rows.push({ label: 'How did the last set feel?', sub: lastWork.e ? EFFORT[lastWork.e] : 'Optional: helps the next target', icon: 'light', act: effortList });
  if (!it.cardio) rows.push({ label: a.wu ? 'Next set counts' : 'Next set is a warm-up', sub: a.wu ? 'Counts towards progress' : "Won't count towards progress", icon: 'warm', act: () => { a.wu = !a.wu; save(); CH.stage.closeList(); render(); } });
  rows.push(cardioRow());
  rows.push({ label: 'Finish workout', icon: 'flag', accent: true, act: () => finish() });
  CH.stage.folded().reverse().forEach((f) => rows.push(f));
  CH.stage.list({ title: 'Workout', rows, cancel: 'Back to the set', cancelIcon: 'back' });
}
/* Changing logged sets: any set, not just the last. `rec` is the workout in progress or a saved
   one; `after` saves it and redraws. The newest set is nearest the thumb. */
function editSets(rec, back, after) {
  const commit = after || (() => { save(); render(); });
  if (!rec.sets.length) { if (back) back(); return; }
  const n = {};
  const rows = rec.sets.map((x, k) => { n[x.ex] = (n[x.ex] || 0) + 1; return { k, label: x.c ? exOf(x).name : `${exOf(x).name} · set ${n[x.ex]}`, sub: x.c ? CH.cardio.entryText(x) : load(x, x.w, x.r) + (x.wu ? ' · warm-up' : x.e ? ' · ' + EFFORT[x.e] : ''), icon: 'edit', act: () => editSet(rec, k, back, commit) }; });
  CH.stage.list({ title: 'Which set?', rows, cancel: 'Back', cancelIcon: 'back', onCancel: back || null });
}
function editSet(rec, k, back, commit) {
  const x = rec.sets[k];
  if (!x) { editSets(rec, back, commit); return; }
  const again = () => editSet(rec, k, back, commit);
  const ex = exOf(x), bw = ex.eq === 'bodyweight';
  if (x.c) {
    // Cardio: its time, its result and how hard it felt.
    const res = CH.cardio.RESULTS[CH.cardio.MACHINES[ex.machine].result];
    CH.stage.list({
      title: setText(x),
      rows: [
        { label: 'Delete this', sub: 'Gone from the workout', icon: 'trash', danger: true, act: () => { rec.sets.splice(k, 1); commit(); CH.ui.toast(`Deleted ${U.esc(setText(x))}.`); if (rec.sets.length) editSets(rec, back, commit); else if (back) back(); else CH.stage.closeList(); } },
        { label: 'Change how hard', value: x.e ? CH.cardio.EFFORT[x.e] : '—', icon: 'light', act: () => CH.cardio.open(CH.cardio.effortMenu((e) => { x.e = e; commit(); again(); })) },
        res ? { label: `Change the ${res.name.toLowerCase()}`, value: x.d ? res.fmt(x.d) : '—', icon: 'flag', act: () => CH.cardio.open(CH.cardio.resultMenu(x.ex, x.s, x.set, (d) => { x.d = d; commit(); again(); })) } : null,
        { label: 'Change the time', value: CH.cardio.clockText(x.s || 0), icon: 'timer', act: () => CH.cardio.open(CH.cardio.timeMenu(x.ex, Math.max(1, Math.round((x.s || 60) / 60)), (m) => { x.s = m * 60; commit(); again(); }, `${ex.name}: how long?`)) },
      ].filter(Boolean),
      cancel: 'Other sets', cancelIcon: 'back', onCancel: () => editSets(rec, back, commit),
    });
    return;
  }
  CH.stage.list({
    title: setText(x),
    rows: [
      { label: 'Delete this set', sub: 'Gone from the workout', icon: 'trash', danger: true, act: () => { rec.sets.splice(k, 1); commit(); CH.ui.toast(`Deleted ${U.esc(setText(x))}.`); if (rec.sets.length) editSets(rec, back, commit); else if (back) back(); else CH.stage.closeList(); } },
      { label: x.wu ? 'Make it a working set' : 'Make it a warm-up', sub: x.wu ? 'Counts towards progress' : "Won't count towards progress", icon: 'warm', act: () => { x.wu = !x.wu; commit(); again(); } },
      { label: 'Change the reps', value: String(x.r), icon: 'next', act: () => repsScale(x.r, Math.max(20, x.r + 10), (r) => { x.r = r; commit(); again(); }, again, `${ex.name}: reps`, 'Logged') },
      { label: bw ? 'Change the added weight' : ex.assist ? 'Change the help' : 'Change the weight', value: `${U.kg(x.w)} kg`, icon: 'plate', act: () => weightScale(x.ex, x.w, (w) => { x.w = w; commit(); again(); }, again) },
    ],
    cancel: 'Other sets', cancelIcon: 'back', onCancel: () => editSets(rec, back, commit),
  });
}
function effortList() {
  const a = A();
  // The last working set with weights: cardio has its own effort scale, in its own menu.
  const last = a.sets.slice().reverse().find((x) => !x.wu && !x.c);
  CH.stage.list({
    title: 'The last set felt',
    rows: [[1, 'Easy', '3 or more reps left'], [2, 'Hard', '1 or 2 reps left'], [3, 'Failure', 'No reps left']].map(([e, l, sub]) => ({
      label: l, sub, sel: last && last.e === e, act: () => { if (last) last.e = e; save(); CH.stage.closeList(); render(); },
    })),
    cancel: 'Back', cancelIcon: 'back', onCancel: more,
  });
}

/* ---------------- the screen ---------------- */
function lastText(it, sets) {
  const ws = new Set(sets.map((x) => x.w));
  const bw = exOf(it).eq === 'bodyweight' && sets.every((x) => !(x.w > 0));
  if (bw) return sets.map((x) => x.r).join(', ') + ' reps';
  if (ws.size === 1) return `${U.kg(sets[0].w)} kg × ${sets.map((x) => x.r).join(', ')}`;
  return sets.map((x) => `${U.kg(x.w)}×${x.r}`).join(', ');
}

// The corner for the set on screen: the hub and the rim, as a spec (controls() puts it up).
function controlsSpec() {
  const a = A();
  if (!a) return null;
  const it = a.items[a.i];
  const nDone = a.items.filter((_, i) => complete(a, i)).length;
  const s = settings();
  const running = a.rest && Date.now() - a.rest.from < a.rest.len;
  const wGlyph = bwOnly(it) ? 'BW' : U.kg(it.w);
  const everything = allDone(a);
  const r = repsFor(a, a.i);
  controlsStale = false;
  if (it.cardio && !everything) {
    const run = runFor(a, it);
    return ({
      hub: run && run.stop
        ? { label: 'Log it', sub: CH.cardio.clockText(runSecs(run)), icon: 'check', primary: true, act: () => cardioResult(it, runSecs(run)), aria: `Log ${exOf(it).name}: ${CH.cardio.clockText(runSecs(run))}` }
        : run
          ? { label: 'Stop', sub: 'when done', icon: 'check', primary: true, act: () => logSet(), aria: `Stop the timer for ${exOf(it).name}` }
          : { label: 'Start', sub: `${it.min} min`, icon: 'play', primary: true, act: () => logSet(), slide: () => cardioMinutes(true), aria: `Start the timer for ${exOf(it).name}. Done already? Slide up or down for the minutes.` },
      rim: [
        { icon: 'plan', label: 'Exercises', prio: 2, badge: `${nDone}/${a.items.length}`, aria: `Exercises, ${nDone} of ${a.items.length} done`, act: exercisesList,
          row: { label: 'Exercises', value: `${nDone}/${a.items.length}`, sub: 'Any order · swap a machine' } },
        { icon: 'settings', label: 'Settings', prio: 1, aria: `Settings for ${exOf(it).name}: ${CH.cardio.settingsText(it.ex, it.set) || 'none'}. Change`, act: cardioSettings },
        { icon: 'timer', label: 'Minutes', prio: 2, aria: 'Done already? Log the minutes', act: () => cardioMinutes(false), row: { label: 'Done already? Log the minutes' } },
        { icon: 'more', label: 'More', prio: 1, more: true, act: more },
      ],
    });
  }
  return ({
    hub: everything
      ? { label: 'Finish', sub: 'workout', icon: 'flag', primary: true, act: () => finish(), aria: 'Finish workout' }
      : !it.confirmed
        ? { label: 'Weight', sub: 'first set', icon: 'plate', primary: true, act: weightList, aria: `Pick the weight for your first set of ${exOf(it).name}` }
        : { label: a.wu ? 'Warm-up' : complete(a, a.i) ? 'Extra set' : 'Done', sub: load(it, it.w, r).replace(' kg ×', ' ×'), icon: a.wu ? 'warm' : 'check', primary: true, warm: a.wu, act: () => logSet(), slide: repsSlide,
          aria: `${a.wu ? 'Log warm-up set' : 'Log set'}: ${load(it, it.w, r)}. Slide up or down for different reps.` },
    rim: [
      // prio: what stays in the corner when the reach can't hold all five (1 stays longest).
      // The rest timer folds into More first, then Exercises; swiping still moves between exercises.
      { icon: 'plan', label: 'Exercises', prio: 2, badge: `${nDone}/${a.items.length}`, aria: `Exercises, ${nDone} of ${a.items.length} done`, act: exercisesList,
        row: { label: 'Exercises', value: `${nDone}/${a.items.length}`, sub: 'Any order · swap a busy machine' } },
      { glyph: wGlyph, small: wGlyph.length > 3, label: 'Weight', prio: 1, aria: `Weight: ${bwOnly(it) ? 'bodyweight' : U.kg(it.w) + ' kilograms'}. Change`, act: weightList },
      { glyph: String(r), label: 'Reps', prio: 1, aria: `Log a set with different reps (target ${r})`, act: repsList },
      { icon: 'timer', label: s.restOn ? (running ? 'Rest' : `${restOf(it)}s`) : 'Timer off', prio: 3, aria: `Rest timer, ${s.restOn ? restOf(it) + ' seconds' : 'off'}`, act: timerList,
        row: { label: 'Rest timer', value: s.restOn ? `${restOf(it)} s` : 'Off' } },
      { icon: 'more', label: 'More', prio: 1, more: true, act: more },
    ],
  });
}
function controls() { const c = controlsSpec(); if (c) CH.stage.set(c); }

/* A workout saved by an earlier version (or by Chalk), or damaged, is repaired before it's drawn:
   every exercise gets an id and its targets, every set gets the id of its exercise (sets from
   before ids existed are matched by position), and anything unusable is dropped. Returns false
   when nothing usable is left. */
function normalise(a) {
  if (!Array.isArray(a.items)) a.items = [];
  if (!Array.isArray(a.sets)) a.sets = [];
  a.items = a.items.filter((it) => it && typeof it === 'object' && typeof it.ex === 'string');
  a.items.forEach((it) => {
    if (!it.id) it.id = U.id();
    if (it.cardio || CH.cardio.isCardio(it.ex)) {
      it.cardio = true;
      if (!(it.min > 0)) it.min = 20;
      if (!it.set || typeof it.set !== 'object') it.set = {};
      if (!Array.isArray(it.targets) || !it.targets.length) it.targets = [{ w: 0, r: 0 }];
      it.confirmed = true;
      return;
    }
    if (!(it.w >= 0)) it.w = it.wOverride != null ? it.wOverride : ((it.targets || [])[0] || { w: 0 }).w || 0;
    if (!it.slot) it.slot = D().slotFor(it.ex);
    if (!(it.lo > 0)) it.lo = 8;
    if (!(it.hi >= it.lo)) it.hi = it.lo + 4;
    if (!(it.sets > 0)) it.sets = 3;
    if (!Array.isArray(it.targets) || !it.targets.length) { const t = makeItem(it, history()); it.targets = t.targets; it.reason = t.reason; it.kind = t.kind; }
    if (it.confirmed == null) it.confirmed = true;
  });
  a.sets = a.sets.filter((x) => x && typeof x === 'object' && typeof x.ex === 'string' && x.w >= 0 && x.r >= 0);
  a.sets.forEach((x) => {
    if (x.itemId && a.items.some((it) => it.id === x.itemId)) return;
    const byPos = a.items[x.item];
    const owner = byPos && byPos.ex === x.ex ? byPos : a.items.find((it) => it.ex === x.ex);
    x.itemId = owner ? owner.id : null;
    delete x.item;
  });
  if (!(a.i >= 0 && a.i < a.items.length)) a.i = 0;
  if (!Number.isFinite(a.start)) a.start = lastActivity(Object.assign({}, a, { start: 0 })) || Date.now();
  if (a.rest && !(Number.isFinite(a.rest.from) && a.rest.len > 0)) a.rest = null;
  if (a.run && !(Number.isFinite(a.run.from) && a.items.some((it) => it.id === a.run.itemId))) a.run = null;
  return a.items.length > 0;
}

/* ---------------- the screen ----------------
   The top half is for reading at arm's length: the exercise, last time, today's target huge, the
   sets so far. Nothing here needs a touch except a sideways swipe to change exercise. */
const useTick = (ms) => { const [, set] = useState(0); useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]); };

function Clock({ from }) {
  useTick(5000);
  const th = useTheme();
  return <Text style={{ fontFamily: F.body, fontSize: 13, color: th.ink3, fontVariant: ['tabular-nums'] }}>{U.mins(Date.now() - from)}</Text>;
}
function RunClock({ run, size }) {
  useTick(250);
  const th = useTheme();
  return <Text style={{ fontFamily: F.display, fontSize: size, lineHeight: Math.round(size * 0.95), color: th.ink, fontVariant: ['tabular-nums'] }}>{U.clock((run.stop || Date.now()) - run.from)}</Text>;
}
// The rest timer: a ring that fills, the time left, then "Go" and the time over.
function RestDial() {
  useTick(250);
  const th = useTheme();
  const a = A();
  if (!a || !a.rest) return null;
  const left = a.rest.len - (Date.now() - a.rest.from);
  const over = left <= 0;
  const frac = over ? 1 : 1 - left / a.rest.len;
  return (
    <View accessible accessibilityLabel={over ? `Rest over by ${U.clock(-left)}. Go` : `Rest, ${U.clock(left)} left`} style={{ position: 'absolute', right: 0, top: 78, width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={84} height={84} viewBox="0 0 40 40" style={{ position: 'absolute', left: 0, top: 0, transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={20} cy={20} r={17} fill={th.surface} stroke={th.line} strokeWidth={1.5} />
        <Circle cx={20} cy={20} r={17} fill="none" stroke={over ? th.accent : th.ink} strokeWidth={1.5} strokeLinecap="round" strokeDasharray={`${U.f1(frac * 106.8)} 107`} />
      </Svg>
      <Text style={{ fontFamily: F.display, fontSize: 25, lineHeight: 26, color: th.ink, fontVariant: ['tabular-nums'] }}>{over ? '+' + U.clock(-left) : U.clock(left)}</Text>
      <Text style={{ fontFamily: F.bodyB, fontSize: 11.5, letterSpacing: 0.7, textTransform: 'uppercase', color: over ? th.accent : th.ink3 }}>{over ? 'Go' : 'Rest'}</Text>
    </View>
  );
}
// The day's exercises in a strip, done ones ticked. The one on screen is kept in view.
function Strip({ a }) {
  const th = useTheme();
  const ref = useRef(null);
  const xs = useRef({});
  const [w, setW] = useState(0);
  useEffect(() => {
    const p = xs.current[a.i];
    if (ref.current && p && w) ref.current.scrollTo({ x: Math.max(0, p.x + p.w / 2 - w / 2), animated: true });
  }, [a.i, w, a.items.length]);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: 10, marginHorizontal: -16, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 2, alignItems: 'center' }} accessibilityLabel="Exercises today">
      {a.items.map((x, i) => {
        const now = i === a.i, ok = complete(a, i);
        const fg = now ? th.hubInk : ok ? th.ink2 : th.ink3;
        return (
          <View key={x.id} onLayout={(e) => { xs.current[i] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width }; if (now && ref.current && w) ref.current.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2 - w / 2), animated: false }); }}
            accessibilityLabel={`${short(exOf(x))}${ok ? ', done' : ''}${now ? ', on screen' : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 99, backgroundColor: now ? th.hubBg : th.line2 }}>
            {ok ? <Icon name="check" size={14} color={fg} stroke={2.8} /> : null}
            <Text style={{ fontFamily: F.bodyB, fontSize: 13, color: fg }}>{short(exOf(x))}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
function Top({ a, nDone }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingTop: 14 }}>
      <Text style={{ fontFamily: F.bodyB, fontSize: 13, color: th.ink2 }}>{a.day}</Text>
      <Clock from={a.start} />
      <Text style={{ marginLeft: 'auto', fontFamily: F.body, fontSize: 13, color: th.ink3, fontVariant: ['tabular-nums'] }}>{nDone} of {a.items.length} done</Text>
    </View>
  );
}
function Name({ children, sub }) {
  const th = useTheme(), vw = useVw();
  const fs = vw(0.095, 34, 46);
  return (
    <View>
      <Text accessibilityRole="header" style={{ marginTop: 14, paddingRight: 92, fontFamily: F.display, fontSize: fs, lineHeight: Math.round(fs * 1.0), color: th.ink }}>{children}</Text>
      {sub ? <Text style={{ marginTop: 6, paddingRight: 92, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: th.ink3 }}>{sub}</Text> : null}
    </View>
  );
}
function LastCard({ k, v, n, first }) {
  const th = useTheme();
  return (
    <Card style={{ marginTop: 14, paddingVertical: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ fontFamily: F.bodyB, fontSize: 12.5, letterSpacing: 0.75, textTransform: 'uppercase', color: th.ink3 }}>{k}</Text>
        {n ? <Text style={{ fontFamily: F.bodyB, fontSize: 13, color: th.ink3 }}>{n}</Text> : null}
      </View>
      <Text style={first ? { marginTop: 2, fontFamily: F.body, fontSize: 15, lineHeight: 21, color: th.ink2 } : { marginTop: 2, fontFamily: F.display, fontSize: 26, lineHeight: 29, color: th.ink, fontVariant: ['tabular-nums'] }}>{v}</Text>
    </Card>
  );
}
function SetLine({ left, dim, chip }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
      <Text style={{ fontFamily: F.bodyB, fontSize: 16, color: th.ink }}>{left}</Text>
      <Text style={{ fontFamily: F.body, fontSize: 16, color: th.ink3, flexShrink: 1 }}>{dim}</Text>
      {chip}
    </View>
  );
}
function Target({ parts }) {
  const th = useTheme(), vw = useVw();
  const big = vw(0.24, 76, 112);
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
      {parts.map(([kind, t], i) => (
        kind === 'big' ? <Text key={i} style={{ fontFamily: F.display, fontSize: big, lineHeight: Math.round(big * 1.0), color: th.ink, fontVariant: ['tabular-nums'] }}>{t}</Text>
          : kind === 'x' ? <Text key={i} style={{ fontFamily: F.display5, fontSize: 38, color: th.ink3, marginHorizontal: 4 }}>{t}</Text>
            : <Text key={i} style={{ fontFamily: F.display6, fontSize: 22, color: th.ink3, marginRight: 4 }}>{t}</Text>
      ))}
    </View>
  );
}
function Pill({ kind, pr, children, note }) {
  const th = useTheme();
  const done = kind === 'done' || kind === 'wu';
  const st = { minHeight: 38, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5 };
  const look = kind === 'wu' ? { borderColor: th.line, borderStyle: 'dashed' } : done ? { backgroundColor: th.surface, borderColor: 'transparent', boxShadow: th.shadow } : kind === 'now' ? { borderColor: th.ink } : { borderColor: th.line };
  const fg = pr ? th.accent : kind === 'wu' ? th.ink3 : done || kind === 'now' ? th.ink : th.ink3;
  return (
    <View style={[st, look]}>
      {pr ? <Icon name="star" size={16} color={th.accent} /> : null}
      <Text style={{ fontFamily: F.display6, fontSize: 20, color: fg, fontVariant: ['tabular-nums'] }}>{children}</Text>
      {note ? <Text style={{ fontFamily: F.bodyB, fontSize: 12, color: th.ink3, marginLeft: 2 }}>{note}</Text> : null}
    </View>
  );
}
function Why({ chip, children }) {
  const th = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{chip}<Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 21, color: th.ink2, flexShrink: 1 }}>{children}</Text></View>;
}
function Hint({ children }) { return <Dim style={{ marginTop: 12, fontSize: 13 }}>{children}</Dim>; }
// A sideways swipe anywhere on the workout screen (not on a button) changes exercise.
function Swipe({ children }) {
  const s = useRef(null);
  return (
    <View
      onTouchStart={(e) => { const n = e.nativeEvent; if (n.touches && n.touches.length > 1) { s.current = null; return; } s.current = { x: n.pageX, y: n.pageY, t: Date.now() }; }}
      onTouchEnd={(e) => { const p = s.current; s.current = null; if (!p) return; const n = e.nativeEvent; swipe(n.pageX - p.x, n.pageY - p.y, Date.now() - p.t); }}
      onTouchCancel={() => { s.current = null; }}
      style={{ position: 'relative', minHeight: '100%' }}
    >
      {children}
    </View>
  );
}

function render() {
  const a = A();
  if (!a) return;
  if (!normalise(a)) {
    // Nothing usable left (its exercises are gone): keep any sets, never show a broken screen.
    if (a.sets.length) finish({ warmOnly: true }); else discard();
    return;
  }
  const past = history();
  const it = a.items[a.i];
  const ex = exOf(it);
  const nDone = a.items.filter((_, i) => complete(a, i)).length;
  if (it.cardio) { renderCardio(a, it, ex, nDone); return; }
  const k = done(a, a.i), n = it.targets.length;
  const r = repsFor(a, a.i);
  const helpers = (ex.help || []).map((h) => D().muscle(h).name.toLowerCase());
  const mus = `${ex.brand ? `${ex.brandName} · ` : ''}${ex.main ? D().muscle(ex.main).name : 'Not counted towards a muscle'}${helpers.length ? ' · ' + helpers.join(', ') : ''}${ex.assist ? ' · less help is progress' : ''}`;
  // Last time, the way a logbook would show it.
  const last = E().recent(past, it.ex, 1)[0];
  // Fix 7: a first time says what to aim for in the lifter's own terms: a weight, the reps, or the help.
  const firstLine = ex.assist ? `Pick the help you need for ${it.lo}–${it.hi} reps` : bwOnly(it) ? `Aim for ${it.lo}–${it.hi} reps` : `Pick a weight you can lift for ${it.lo}–${it.hi} reps`;
  const kind = it.kind === 'up' ? <Chip kind="up" icon="light">Up</Chip> : it.kind === 'light' ? <Chip>Lighter week</Chip> : it.kind === 'down' ? <Chip>Down</Chip> : null;
  const todays = setsOf(a, a.i);
  const target = bwOnly(it) ? [['big', String(r)], ['unit', 'reps']] : [['big', U.kg(it.w)], ['unit', 'kg'], ['x', '×'], ['big', String(r)], ['unit', 'reps']];
  CH.ui.setView('session', (
    <Swipe>
      <Top a={a} nDone={nDone} />
      <Strip a={a} />
      <Name sub={mus}>{short(ex)}</Name>
      {last ? <LastCard k={`Last time · ${U.ago(last.session.start)}`} v={lastText(it, last.sets)} n={U.plural(last.sets.length, 'set')} />
        : <LastCard first k="First time" v={firstLine} />}
      <SetLine left={a.wu ? 'Warm-up' : k >= n ? `All ${n} sets done` : `Set ${k + 1} of ${n}`} dim={`${it.lo}–${it.hi} reps`} chip={a.wu ? <Chip kind="warm" icon="warm">Not counted</Chip> : null} />
      <Target parts={target} />
      {!bwOnly(it) && basis(ex) ? <Dim style={{ fontSize: 14 }}>{basis(ex)}{it.confirmed ? '' : ' · pick it before your first set'}</Dim> : null}
      {last ? <Why chip={kind}>{it.reason}</Why> : null}
      <View accessibilityLabel="Sets today" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {todays.map((x, j) => <Pill key={'d' + j} kind={x.wu ? 'wu' : 'done'} pr={!!x.pr} note={x.e ? EFFORT[x.e] : x.wu ? 'warm-up' : null}>{exOf(it).eq === 'bodyweight' && !(x.w > 0) ? '' : U.kg(x.w) + ' × '}{x.r}</Pill>)}
        {Array.from({ length: Math.max(0, n - k) }, (_, j) => { const s2 = k + j, t = it.targets[s2]; return <Pill key={'t' + s2} kind={s2 === k && !a.wu ? 'now' : 'todo'}>{bwOnly(it) ? '' : U.kg(it.w) + ' × '}{t ? t.r : r}</Pill>; })}
      </View>
      <Hint>{it.confirmed ? 'Different reps? Slide on Done, then tap it. ' : ''}Swipe left or right for another exercise.</Hint>
      <RestDial />
    </Swipe>
  ));
  controls();
  startTick();
  updateTick();
}

// The workout screen for a cardio exercise: what and where, today's settings, the time (a running
// clock while the timer runs), last time, and what's been logged.
function renderCardio(a, it, ex, nDone) {
  const C = CH.cardio, run = runFor(a, it), mine = setsOf(a, a.i).filter((x) => x.c), l = C.last(it.ex);
  const t = C.TYPES.find((x) => x.id === ex.type), m = C.MACHINES[ex.machine];
  const st = C.settingsText(it.ex, it.set);
  CH.ui.setView('session', (
    <Swipe>
      <Top a={a} nDone={nDone} />
      <Strip a={a} />
      <Name sub={`Cardio · ${t ? t.name : ''}${m && m.name !== 'Outside' && m.name !== ex.name ? ' · ' + m.name : ''}`}>{ex.name}</Name>
      {l ? <LastCard k={`Last time · ${U.ago(l.at)}`} v={C.entryText(l, true)} /> : <LastCard first k="First time" v="Go at a pace you could keep up for the whole time" />}
      <SetLine left={run ? (run.stop ? 'Stopped' : 'Timer running') : mine.length ? 'Done' : 'Today'} dim={st || 'Nothing to set'} />
      {run ? <BigClock run={run} /> : <Target parts={[['big', String(it.min)], ['unit', 'min']]} />}
      {mine.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>{mine.map((x, j) => <Pill key={j} kind="done">{C.entryText(x)}</Pill>)}</View> : null}
      <Hint>{run ? (run.stop ? 'Tap Log it for the distance and how it felt.' : 'Tap Stop when you finish.') : 'Tap Start to run the timer. Done already? Slide on Start for the minutes.'} Swipe left or right for another exercise.</Hint>
      <RestDial />
    </Swipe>
  ));
  controls();
  startTick();
  updateTick();
}
function BigClock({ run }) {
  const vw = useVw();
  return <View accessibilityLiveRegion="polite" style={{ marginTop: 2 }}><RunClock run={run} size={vw(0.24, 76, 112)} /></View>;
}

/* The clock behind the screen: a rest that ends buzzes and chimes once, and only the rest button
   changes (fix 6: the hub is left alone, so a thumb already on it keeps its press, and an open menu
   stays open). A rest left running ten minutes past its end is cleared. */
function updateTick() {
  const a = A();
  if (!a) return;
  if (a.rest && Date.now() - a.rest.from - a.rest.len > 10 * 60e3) { a.rest = null; save(); }
  if (controlsStale && !CH.scrub.isOpen() && CH.ui.current() === 'session') controls();
  syncNotice(a);
  if (!a.rest) return;
  const left = a.rest.len - (Date.now() - a.rest.from);
  if (left <= 0 && !restFired) {
    restFired = true;
    CH.haptic('impact');
    CH.sound.play('rest');
    if (CH.ui.current() === 'session') { const c = controlsSpec(); if (c) CH.stage.rim(c.rim); }
  }
}
// The rest's end, as a notification for when the phone is in a pocket or another app is open.
let noticeAt = 0;
function syncNotice(a) {
  const at = a && a.rest && !restFired ? a.rest.from + a.rest.len : 0;
  if (at === noticeAt) return;
  noticeAt = at;
  if (at > Date.now() + 1500) CH.notify.restAt(at, a.items[a.i] ? exOf(a.items[a.i]).name : ''); else CH.notify.cancel();
}
function startTick() { if (!tick) tick = setInterval(updateTick, 250); }
function stopTick() { clearInterval(tick); tick = 0; noticeAt = 0; CH.notify.cancel(); }

/* Swipe left or right anywhere on the workout screen to change exercise. A horizontal swipe is easy
   to tell apart from scrolling and from the hand-swap arc. */
function swipe(dx, dy, dt) {
  if (!A() || CH.ui.current() !== 'session' || CH.scrub.isOpen() || CH.reach.open) return;
  if (dt < 700 && Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) step(dx < 0 ? 1 : -1);
}

// Back from another app: the screen stays awake again and the clocks catch up.
AppState.addEventListener('change', (s) => {
  if (s === 'active' && A() && CH.ui && CH.ui.current() === 'session') { CH.wake.on(); updateTick(); }
});

CH.session = {
  start, startCardio, render, finish, more, editSets, setText,
  active: () => !!A(),
  resume() {
    const a = A();
    if (!a) return;
    const idle = Date.now() - lastActivity(a);
    if (idle > STALE && !staleOk) {
      const n = a.sets.length;
      CH.stage.list({
        title: `${a.day} from ${U.ago(lastActivity(a))}`,
        rows: [
          { label: 'Discard it', sub: n ? `${U.plural(n, 'set')} will be lost` : 'Nothing was logged', icon: 'trash', danger: true, act: () => discard() },
          n ? { label: 'Finish and save it', sub: `${U.plural(n, 'set')}, dated ${new Date(a.start).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`, icon: 'check', act: () => finish({ warmOnly: true }) } : null,
          { label: 'Carry on with it', sub: 'Pick up where you left off', icon: 'play', accent: true, act: () => { staleOk = true; CH.stage.closeList(); CH.session.resume(); } },
        ].filter(Boolean),
        cancel: 'Not now', cancelIcon: 'back',
      });
      return;
    }
    restFired = !!(a.rest && Date.now() - a.rest.from > a.rest.len);
    CH.wake.on();
    CH.ui.show('session');
  },
  leave() { stopTick(); },
  // For tests: what the corner would show for the set on screen.
  controlsSpec,
};
export default CH.session;
