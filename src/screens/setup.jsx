/* GYMKDR · building a routine (Chalk's setup.js). Everything is chosen with the thumb wheel.

   New routine → a plan ("Starter plan" is the ready-made one for someone new to the gym) → the routine
   is made with its workouts named and each one's body parts set, nothing filled in. Each workout is
   then built a step at a time: "Next: Back. Add one, or skip?", with Save and finish always beside
   it. A body part's movements come common ones first (machines and easier versions first for a
   beginner), then the version (barbell, dumbbell, cable…). "(Blank)" names a new exercise, typed
   or spoken. Saving a routine that leaves out a main body part offers to add one exercise for each;
   saving a new routine then asks whether to attach it to particular days. */
import React from 'react';
import { View } from 'react-native';
import CH from '../ch';
import { Topbar, Head, Meta, H2, Chip, Pair, Legend } from '../ui/kit';

const U = CH.u;
const D = () => CH.data, S = () => CH.store;
let w = null; // { mode: 'new' | 'edit', rid, i, back, skip: [body parts skipped for now], gapAsked }

const exName = (id) => (D().ex(id) || { name: 'Unknown exercise' }).name;
const partName = (id) => (id && D().part(id) ? D().part(id).name : 'Other');
const routine = () => (w && w.rid ? CH.routines.get(w.rid) : null);
const day = () => { const r = routine(); return r ? r.days[w.i] : null; };
const save = () => S().save();
const hubEl = () => CH.stage.hubEl();
const menu = (spec) => CH.scrub.open(spec, hubEl(), 'sticky');

/* ---------------- plain words ----------------
   Chips keep the gym's short names (Quads, BB, DB); the description at the top of the screen says
   what they mean, so someone new to the gym can follow along. */
const PART_PLAIN = { chest: 'Your chest', back: 'The sides and middle of your back', shoulders: 'The front and sides of your shoulders', reardelts: 'The back of your shoulders', biceps: 'The front of your upper arms', triceps: 'The back of your upper arms', quads: 'The front of your thighs', hamstrings: 'The back of your thighs', glutes: 'Your bottom and inner thighs', calves: 'Your lower legs', abs: 'Your stomach', forearms: 'Your forearms and grip', olympic: 'Snatch, clean and jerk', cardio: 'Your heart and lungs' };
// Each body part as a phrase that reads in a sentence: "skips your back and the back of your thighs".
const PART_SHORT = { chest: 'your chest', back: 'your back', shoulders: 'your shoulders', reardelts: 'the back of your shoulders', biceps: 'the front of your arms', triceps: 'the back of your arms', quads: 'the front of your thighs', hamstrings: 'the back of your thighs', glutes: 'your bottom (glutes)', calves: 'your calves', abs: 'your stomach', forearms: 'your forearms', olympic: 'Olympic lifts', cardio: 'cardio' };
const MUSCLE_PLAIN = { quads: 'front of thighs', hamstrings: 'back of thighs', glutes: 'bottom', adductors: 'inner thighs', lats: 'sides of the back', upperBack: 'upper back', lowerBack: 'lower back', frontDelts: 'front of shoulders', sideDelts: 'side of shoulders', rearDelts: 'back of shoulders', biceps: 'front of upper arms', triceps: 'back of upper arms', abs: 'stomach', calves: 'lower legs', forearms: 'forearms and grip' };
const KIT_PLAIN = { barbell: 'Barbell: a long bar with weight plates on each end', dumbbell: 'Dumbbell: a short hand weight', kettlebell: 'Kettlebell: a round weight with a handle on top', machine: 'Machine: you choose the weight with a pin', plate: 'Plate-loaded machine: you load weight plates onto it', smith: 'Smith machine: a barbell that runs on guide rails', cable: 'Cable: a handle on a pulley; you choose the weight with a pin', bodyweight: 'Bodyweight: no weights, just you' };
const plainPart = (p) => PART_PLAIN[p] || partName(p);
/* A body part inside a sentence: "the chest", "a chest exercise". Olympic keeps its capital, and an
   Olympic lift is already an exercise ("Add an Olympic lift", "Skip the Olympic lifts"). */
const lowPart = (p) => (p === 'olympic' ? 'Olympic lifts' : partName(p).toLowerCase());
const anExercise = (p) => (p === 'olympic' ? 'an Olympic lift' : `${/^[aeiou]/.test(lowPart(p)) ? 'an' : 'a'} ${lowPart(p)} exercise`);
const anotherOf = (p) => (p === 'olympic' ? 'another Olympic lift' : `another ${lowPart(p)} exercise`);
const shortPart = (p) => PART_SHORT[p] || partName(p).toLowerCase();
const beginner = () => !!S().state.settings.beginner;
// "3 × 6–10", said once in words.
const setsWords = (it) => `${it.sets} sets of ${it.lo} to ${it.hi} reps`;
// A planned exercise's numbers: "3 × 6–10", or cardio's "20 min · 9 km/h · 1% incline".
const nums = (it) => (it.cardio ? CH.cardio.itemText(it) : `${it.sets} × ${it.lo}–${it.hi}`);

/* ---------------- attaching a routine to days ----------------
   A routine's workouts take turns: GYMKDR gives the next one each time you train, whatever the day.
   When a new routine is saved, GYMKDR asks whether to attach it to particular days (Mon · Wed · Fri).
   The workouts still take turns on those days, so a missed day just waits for the next one. The days
   show on Home ("Today (Wednesday) is a training day") and the Calendar, and set the weekly pace. */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SETS = [[0, 3], [1, 4], [0, 2, 4], [1, 3, 5], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5]];
// The days each plan is usually trained on, lit first.
const USUAL = { cardio: '1,3,5', olympic: '0,2,4', fullbody: '0,2,4', starter: '0,2,4', ppl: '0,2,4', upperlower: '0,1,3,4', bodypart: '0,1,2,3,4', hybrid: '0,1,2,3,4', arnold: '0,1,2,3,4,5' };
const dayList7 = (ds) => (ds.length >= 5 && ds.every((d, k) => d === ds[0] + k) ? `${DOW[ds[0]]} to ${DOW[ds[ds.length - 1]]}` : ds.map((i) => DOW[i]).join(' · '));
const longList7 = (ds) => U.list(ds.map((i) => DOW_LONG[i]));
function weekText(wk) {
  if (!wk || !wk.n) return '';
  return wk.days && wk.days.length ? dayList7(wk.days) : `${wk.n} day${wk.n === 1 ? '' : 's'} a week`;
}
// What attaching to these days means for this routine, in a sentence.
function mapText(r, ds) {
  const n = r.days.length;
  if (!n) return `<p>You'll train on ${U.esc(longList7(ds))}.</p>`;
  if (n === 1) return `<p>${U.esc(r.days[0].name)} on ${U.esc(longList7(ds))}.</p>`;
  const first = ds.map((d, k) => `${r.days[(r.next + k) % n].name} on ${DOW_LONG[d]}`);
  return `<p>${U.esc(U.list(first))}${n > ds.length ? '; the rest follow next week' : ''}, then round again.</p><p>Miss a day and that workout simply waits for your next training day.</p>`;
}
const TURNS = '<p>No set days: GYMKDR gives you the next workout each time you train.</p>';
// Do you want to attach this routine to particular days? Asked when a new routine is saved, and from
// Routines → Edit any time. `done` runs once it's answered.
function attachMenu(rid, done) {
  const r = CH.routines.get(rid);
  if (!r) return { options: [] };
  const has = r.week && r.week.days && r.week.days.length;
  const options = [
    { label: has ? 'Any day instead' : 'No, any day', sub: 'Train whenever suits you', icon: 'week', info: TURNS, act: () => setWeek(r, null, done) },
    { label: has ? 'Change the days' : 'Yes, pick the days', sub: has ? `Now ${dayList7(r.week.days)}` : 'Mon · Wed · Fri, or any you like', icon: 'week', info: `<p>Pick the days you plan to train. ${r.days.length > 1 ? 'The workouts take turns on those days.' : ''}</p><p>Home then says when today is a training day, and the Calendar marks them.</p>`, act: () => menu(whichDays(r, done)) },
  ];
  return { title: `Do you want to attach ${r.name} to particular days?`, options, start: 1, keep: true };
}
function whichDays(r, done) {
  const usual = USUAL[r.kind] || '0,2,4';
  const options = [{ label: 'Choose each day', sub: 'Tick the days yourself', icon: 'edit', info: '<p>Choose each day you train, then Done.</p>', act: () => menu(pickDays(r, new Set(), done)) }];
  let at = 0;
  DAY_SETS.forEach((ds) => {
    if (ds.join(',') === usual) at = options.length;
    options.push({ label: dayList7(ds), title: longList7(ds), sub: `${ds.length} days a week${ds.join(',') === usual ? ' · the usual for this plan' : ''}`, icon: 'week', info: mapText(r, ds), act: () => setWeek(r, ds, done) });
  });
  return { title: `Which days for ${r.name}?`, options, start: at, keep: true };
}
// Ticking days one at a time: tap a day twice (or slide to it and tap the button) to add or remove it.
function pickDays(r, sel, done) {
  const ds = Array.from(sel).sort();
  const options = [{ label: sel.size ? `Done · ${sel.size} day${sel.size === 1 ? '' : 's'}` : 'Done', sub: sel.size ? dayList7(ds) : 'Pick at least one day', icon: 'check', off: !sel.size, info: sel.size ? mapText(r, ds) : '', act: () => setWeek(r, ds, done) }];
  for (let i = 6; i >= 0; i--) {
    options.push({ label: DOW_LONG[i], value: sel.has(i) ? '✓' : '', sub: sel.has(i) ? 'A training day · choose it again to remove it' : 'Choose it to add it', icon: 'week', act: () => { if (sel.has(i)) sel.delete(i); else sel.add(i); CH.haptic('select'); CH.scrub.stay(pickDays(r, sel, done)); } });
  }
  // Opens on Friday: every day is in view, Monday to Thursday above it and the weekend and Done below.
  return { title: `${r.name}: your training days`, options, start: 3, keep: true, ordered: true, coach: 'Choose each day you train. Each one gets a tick. Then slide down to Done.' };
}
function setWeek(r, ds, done) {
  r.week = ds && ds.length ? { n: ds.length, days: ds.slice() } : null;
  save();
  if (done) done();
}

/* ---------------- a new routine: the plan ---------------- */
const GLOSS = { 'compound lifts': 'compound lifts (big, many-muscle lifts)', 'high volume': 'high volume (lots of sets)', 'isolation': 'isolation (one muscle at a time)' };
const gloss = (t) => Object.keys(GLOSS).reduce((x, k) => x.replace(k, GLOSS[k]), t);
const splitInfo = (sp) => `<dl><dt>How</dt><dd>${U.esc(gloss(sp.how))}</dd><dt>How often</dt><dd>${U.esc(sp.freq)}</dd><dt>Best for</dt><dd>${U.esc(gloss(sp.best))}</dd>${sp.eg ? `<dt class="opt">For example</dt><dd class="opt">${U.esc(sp.eg)}</dd>` : ''}</dl>`;
const STARTER_INFO = '<p>Two ready-made workouts that take turns, every main muscle in each. Mostly machines, which are the easiest to learn, set up and safe.</p><p>Nothing to choose: you can start straight away, and change any of it later.</p>';
function splitMenu() {
  const options = [{ label: 'Starter plan', title: 'Starter plan', sub: 'Two ready-made workouts, mostly machines', icon: 'stack', info: STARTER_INFO, act: () => makeStarter() }];
  D().SPLITS.forEach((sp) => options.push({
    label: sp.name, title: sp.title,
    sub: sp.days.length === 1 ? 'One workout' : `${sp.days.length} workouts that take turns`,
    icon: 'stack', info: splitInfo(sp), act: () => create(sp),
  }));
  options.push({ label: 'Cardio only', title: 'A cardio routine', sub: 'A walk, run, ride or row of its own', icon: 'flag', info: '<p>One cardio session: the kind, the machine, its settings and the time. Put it on its own days, or on the same day as a weights routine.</p><p>For cardio inside a weights routine, add it to a workout like any exercise.</p>', act: () => newCardioRoutine() });
  // Push / Pull / Legs is the plan offered first.
  return { title: 'New routine · pick a plan', options, lead: Math.max(0, options.findIndex((o) => o.label === 'Push / Pull / Legs')) };
}
// A new routine starts with the plan; the Starter plan is built straight away. The
// days question comes when it's saved.
function newRoutine() { menu(splitMenu()); }
/* A cardio routine: one cardio session (a treadmill walk, a ride) as a routine of its own, so it can
   have its own days in the week like any other. Named after what it is; renamed any time. */
function newCardioRoutine(back) {
  CH.cardio.open(CH.cardio.typeMenu((pick) => {
    const name = exName(pick.ex);
    const r = CH.routines.add({ name: CH.routines.freeName(name), kind: 'cardio', profile: 'gym', days: [{ id: U.id(), name, parts: ['cardio'], items: [{ ex: pick.ex, cardio: true, min: pick.min, set: Object.assign({}, pick.set) }] }], next: 0, week: null }, !CH.routines.active());
    const done = () => { CH.ui.show(back || CH.ui.current() || 'routines'); CH.ui.toast(`${U.esc(r.name)} saved${r.week && r.week.days ? `: ${U.esc(weekText(r.week))}` : ''}.`); };
    menu(attachMenu(r.id, done));
  }));
}
// Cardio straight into one workout of a routine, from Routines: the kind, machine, settings and
// time, before or after the weights, then back to where it was asked from.
function addCardioTo(rid, i, back) {
  w = { mode: 'edit', rid, i, back: back || CH.ui.current() || 'routines', skip: [], quick: true };
  CH.ui.show('setup');
  const spec = CH.cardio.typeMenu(addCardio);
  spec.onClose = () => { if (w && w.quick) leave(); };
  menu(spec);
}
function newStarter() { makeStarter(); }
function start() { if (CH.ui.current() !== 'today') CH.ui.show('today'); newRoutine(); }
function create(sp) {
  const days = sp.days.map((n) => ({ id: U.id(), name: n, parts: (D().DAY_PARTS[n] || []).slice(), items: [] }));
  const r = CH.routines.add({ name: CH.routines.freeName(sp.name), kind: sp.id, profile: 'gym', days, next: 0, week: null });
  w = { mode: 'new', rid: r.id, i: 0, back: 'today', skip: [] };
  CH.ui.show('setup');
  CH.scrub.root(stepMenu());
  CH.ui.toast(days.length === 1 ? `${U.esc(r.name)} is made. Now pick its exercises.` : `${U.esc(r.name)} is made: ${U.esc(U.list(sp.days))}. ${U.esc(sp.days[0])} first.`);
}
/* The starter plan: the app's two full-body workouts, built mostly from machines, ready to train. */
function makeStarter() {
  const tmpl = D().ROUTINES.find((x) => x.id === 'fullbody');
  const days = D().buildDays(tmpl, D().profile('machines')).map((d) => {
    const parts = [];
    d.items.forEach((it) => { const p = D().partOf(it.ex); if (p && !parts.includes(p)) parts.push(p); });
    return Object.assign(d, { id: U.id(), parts });
  });
  const r = CH.routines.add({ name: CH.routines.freeName('Starter full body'), kind: 'starter', profile: 'machines', days, next: 0, week: null });
  S().state.settings.beginner = true;
  save();
  w = { mode: 'new', rid: r.id, i: 0, back: 'today', skip: [], starter: true };
  CH.ui.show('setup');
  CH.scrub.root(stepMenu());
  CH.ui.toast(`${U.esc(r.name)} is ready: two workouts that take turns.`);
}
// One exercise's change list, from Review: opens its workout with that exercise's choices.
function editItem(rid, i, k, back) {
  w = { mode: 'edit', rid, i, back: back || CH.ui.current() || 'plan', skip: [] };
  CH.ui.show('setup');
  itemList(k);
}
function editDay(rid, i, back) {
  w = { mode: 'edit', rid, i, back: back || CH.ui.current() || 'plan', skip: [] };
  CH.ui.show('setup');
  CH.scrub.root(stepMenu());
}
function render() {
  if (!w || !day()) { const back = w ? w.back : 'today'; w = null; CH.ui.show(back === 'setup' ? 'today' : back); return; }
  renderDay();
}
function leave(to) {
  const back = to || (w ? w.back : 'today');
  w = null;
  CH.stage.closeList();
  CH.ui.show(back);
}

/* ---------------- a day, by body part ---------------- */
// The day's own body parts first, then any others its exercises belong to.
function sections(d) {
  const ids = d.parts.slice();
  d.items.forEach((it) => { const p = D().partOf(it.ex); if (!ids.includes(p)) ids.push(p); });
  return ids.map((p) => ({ part: p, items: d.items.map((it, k) => ({ it, k })).filter((x) => D().partOf(x.it.ex) === p) }));
}
// The next of the day's body parts with nothing in it (skipped ones wait until asked for).
const nextEmpty = (d) => d.parts.find((p) => !(w && w.skip && w.skip.includes(p)) && !d.items.some((it) => D().partOf(it.ex) === p));
const partsText = (d) => (d.parts.length ? U.list(d.parts.map(lowPart)) : 'any body parts');
function renderDay() {
  const r = routine(), d = day(), n = r.days.length;
  const todo = nextEmpty(d);
  const secs = sections(d);
  // The numbers, said once in words, while the lifter is still new.
  const lift = d.items.find((x) => !x.cardio);
  CH.ui.setView('setup', (
    <View>
      <Topbar kick={r.name} />
      <Head kick={`${w.mode === 'new' ? 'Building · ' : ''}${n > 1 ? `Workout ${w.i + 1} of ${n}` : 'Workout'}`} title={d.name}
        meta={n > 1 ? `${U.list(r.days.map((x) => x.name))} take turns: GYMKDR gives you the next one each time you train.` : null} />
      {!secs.length ? <Meta>No exercises yet. Tap the button, then choose Add an exercise.</Meta>
        : !d.items.length ? <Meta>Pick an exercise for each body part, or skip any. Start with {lowPart(todo || d.parts[0])}.</Meta> : null}
      {secs.map((s) => (
        <View key={s.part} style={{ marginTop: 22 }}>
          <H2 size={24} n={s.items.length || ''} after={s.part === todo ? <Chip kind="dark">Next</Chip> : null}>{partName(s.part)}</H2>
          {s.items.map(({ it, k }) => <Pair key={k} name={exName(it.ex)} value={nums(it)} />)}
          {!s.items.length ? <Pair dim name={w.skip.includes(s.part) ? 'Skipped for now' : 'None yet'} /> : null}
        </View>
      ))}
      {lift && (beginner() || CH.scrub.learning()) ? <Legend>{lift.sets} × {lift.lo}–{lift.hi} means {setsWords(lift)}. A rep is one lift; a set is a round of reps, with a rest after it.</Legend> : null}
    </View>
  ));

  // One button: the day's wheel. It asks about one body part at a time; saving is always beside it.
  CH.stage.set({ hub: { label: 'Build', sub: d.name, icon: 'plus', primary: true, menu: stepMenu }, rim: [] });
}

/* Building a day, one step at a time. The wheel asks about the next empty body part ("Next: Back.
   Add one, or skip?"), with Save and finish right beside it, so stopping is always one step away
   and no body part is compulsory. Any body part can be picked instead, in any order. */
function stepMenu() {
  const r = routine(), d = day();
  if (!r || !d) return { options: [] };
  const todo = nextEmpty(d);
  const options = [];
  let at = 0;
  if (w.mode === 'new' && !r.days.some((x) => x.items.length)) options.push({ label: 'Cancel this routine', sub: 'Pick a different plan', icon: 'close', danger: true, info: `<p>${U.esc(r.name)} is thrown away, and you start again from the days question.</p>`, act: () => { CH.routines.remove(r.id); w = null; CH.ui.show('today'); newRoutine(); } });
  const saveOpt = saveOption();
  const pickOpt = { label: 'Pick a body part', sub: 'Any body part, in any order', icon: 'body', info: `<ul>${d.parts.concat(otherParts(d)).slice(0, 8).map((p) => `<li>${U.esc(partName(p))}<span>${count(d, p) ? count(d, p) + ' added' : ''}</span></li>`).join('')}</ul>`, act: () => menu(partsMenu()) };
  const changeOpt = { label: `Change ${d.name}`, sub: 'Sets, reps, swap, remove, rename', icon: 'edit', info: dayList(d), act: changeList };
  const addOpt = (p) => ({ label: p === 'cardio' ? 'Add cardio' : `Add ${anExercise(p)}`, title: partName(p), sub: `${plainPart(p)} · nothing added yet`, icon: 'body', info: partInfo(p), act: () => menu(moveMenu(p)) });
  /* Two exercises a body part: after the first, "Add another chest exercise" comes first; after
     the second, the next body part does, with the day's other body parts beside it. */
  const lastLift = d.items.slice().reverse().find((x) => !x.cardio);
  const again = w.lastPart && count(d, w.lastPart) ? w.lastPart : lastLift ? D().partOf(lastLift.ex) : null;
  const anotherOpt = again ? anotherOption(d, again) : null;
  const oneSoFar = again && again !== 'cardio' && w.lastPart === again && count(d, again) === 1;
  // The day's other body parts still empty (after the next one), skipped ones included.
  const rest = d.parts.filter((p) => p !== todo && !count(d, p));
  if (todo || oneSoFar) {
    if (todo && !oneSoFar) {
      const pn = partName(todo), later = rest.filter((p) => !(w.skip || []).includes(p));
      options.push({ label: `Skip the ${lowPart(todo)}`, title: `Skip the ${lowPart(todo)} for now`, sub: later.length ? `Next would be ${lowPart(later[0])}` : 'Then save, or add more', icon: 'next', info: `<p>You can add ${U.esc(shortPart(todo))} any time later.</p>`, act: () => { w.skip.push(todo); render(); CH.scrub.root(stepMenu()); } });
    }
    rest.slice().reverse().forEach((p) => options.push(addOpt(p)));
    if (oneSoFar) {
      if (todo) options.push(addOpt(todo));
      at = options.length;
      options.push(anotherOpt);
    } else {
      if (anotherOpt) options.push(anotherOpt);
      at = options.length;
      options.push(addOpt(todo));
    }
    options.push(saveOpt);
    options.push(pickOpt);
    if (d.items.length) options.push(changeOpt);
  } else {
    options.push({ label: d.items.length ? 'Add another exercise' : 'Add an exercise', sub: 'Any body part', icon: 'plus', info: d.parts.length ? '' : `<p>${U.esc(d.name)} has no exercises yet. Pick a body part, then an exercise.</p>`, act: () => menu(partsMenu()) });
    if (anotherOpt) options.push(anotherOpt);
    at = d.items.length ? options.length : options.length - 1;
    options.push(saveOpt);
    const nxt = nextDay();
    if (nxt >= 0) {
      const nd = r.days[nxt];
      options.push(nd.items.length
        ? { label: `Go to ${nd.name}`, sub: `${U.plural(nd.items.length, 'exercise')} · check or change it`, icon: 'next', info: dayList(nd), act: () => { w.i = nxt; w.skip = []; w.lastPart = null; render(); CH.scrub.root(stepMenu()); } }
        : { label: `Build ${nd.name} next`, sub: `For ${partsText(nd)}`, icon: 'next', info: `<p>${U.esc(nd.name)} has no exercises yet. You'll pick them body part by body part, the same way.</p>`, act: () => { w.i = nxt; w.skip = []; w.lastPart = null; render(); CH.scrub.root(stepMenu()); } });
    }
    if (d.items.length) options.push({ label: `Start ${d.name} now`, title: `Train ${d.name} today`, sub: U.plural(d.items.length, 'exercise'), icon: 'play', info: dayList(d), act: startNow });
    if (d.items.length) options.push(changeOpt);
  }
  const title = oneSoFar ? `${partName(again)}: one so far. Add another?` : todo ? `Next: ${partName(todo)}. Add one, or skip?` : d.items.length ? `${d.name}: what next?` : `${d.name} has no exercises yet`;
  return { title, options, start: at, keep: true, coach: todo && !d.items.length ? `Tap the button to add ${anExercise(todo)}, or slide to skip it, or to Save and finish.` : oneSoFar && CH.scrub.learning() ? `Tap the button for ${anotherOf(again)}, or slide for the next body part.` : undefined };
}
function anotherOption(d, p) {
  const pn = partName(p), have = d.items.filter((it) => D().partOf(it.ex) === p).map((it) => exName(it.ex).toLowerCase());
  return {
    label: p === 'cardio' ? 'More cardio' : `Add ${anotherOf(p)}`, title: `${pn}: one more`,
    sub: `${have.length} so far: ${U.list(have)}`, icon: 'plus',
    info: p === 'olympic' ? `<p>So far: ${U.esc(U.list(have))}. A second lift, a pull or an overhead squat, builds the strength behind it.</p>${partInfo(p)}` : `<p>${U.esc(pn)} has ${U.esc(U.list(have))}. ${p === 'cardio' ? 'Add another machine or type.' : 'A second exercise gives it more work, from another angle.'}</p>${partInfo(p)}`,
    act: () => menu(moveMenu(p)),
  };
}
function nextDay() {
  const r = routine(), n = r.days.length, i = w.i;
  const nxt = i + 1 < n ? i + 1 : r.days.findIndex((x, k) => k !== i && !x.items.length);
  return nxt !== i ? nxt : -1;
}
function saveOption() {
  const r = routine(), d = day();
  const empty = r.days.filter((x) => !x.items.length).map((x) => x.name);
  return {
    label: 'Save and finish', sub: 'You can always add more later', icon: 'check',
    info: `${d.items.length ? dayList(d) : ''}<p>${empty.length ? `${U.esc(U.list(empty))} ${empty.length === 1 ? 'has' : 'have'} no exercises yet. Build ${empty.length === 1 ? 'it' : 'them'} another time from Start.` : `${U.esc(r.name)} is ready to train.`}</p>`,
    act: saveAndFinish,
  };
}
const dayList = (d) => `<ul>${d.items.map((it) => `<li>${U.esc(exName(it.ex))}<span>${U.esc(nums(it))}</span></li>`).join('')}</ul>`;
function startNow() {
  const r = routine(), i = w.i;
  w = null;
  CH.routines.activate(r.id);
  r.next = i;
  save();
  CH.session.start(i, r.id);
}
/* Saving: if the whole routine leaves out a main body part, offer to add one exercise for each; then,
   for a new routine, ask whether to attach it to particular days. */
function saveAndFinish() {
  const r = routine();
  const g = gaps(r).skipped;
  if (g.length && !w.gapAsked) {
    w.gapAsked = true;
    menu({
      title: `${r.name} skips ${U.list(g.map(shortPart))}`,
      options: [
        { label: 'Save without them', sub: 'You can add them later', icon: 'check', info: '<p>Your routine is saved as it is.</p>', act: () => afterGaps([]) },
        { label: 'Add one for each', title: 'Add one exercise for each?', sub: U.list(g.map(lowPart)).replace(/^./, (c) => c.toUpperCase()), icon: 'plus', info: `<p>GYMKDR adds one simple exercise for each:</p><ul>${g.map((p) => `<li>${U.esc(partName(p))}<span>${U.esc(exName(gapPick(r, p) || ''))}</span></li>`).join('')}</ul><p>You can swap or remove them later.</p>`, act: () => afterGaps(fillGaps(r, g)) },
      ],
      start: 1, keep: true,
    });
    return;
  }
  afterGaps([]);
}
function afterGaps(added) {
  const r = routine();
  if (r && w.mode === 'new' && !(r.week && r.week.days) && !w.attachAsked) {
    w.attachAsked = true;
    menu(attachMenu(r.id, () => finish(added)));
    return;
  }
  finish(added);
}
function finish(added) {
  const r = routine();
  if (!w) return;
  const back = w.back;
  leave(back === 'setup' ? 'today' : back);
  if (r) CH.ui.toast(`${added && added.length ? `Added ${U.esc(U.list(added.map((x) => x.toLowerCase())))}. ` : ''}${U.esc(r.name)} saved.${r.week && r.week.days ? ` ${U.esc(weekText(r.week))}.` : ''}`);
}

/* ---------------- gaps: a main body part the whole routine leaves out ---------------- */
const CORE = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'];
const PART_SLOT = { chest: 'chestPress', back: 'row', shoulders: 'shoulderPress', quads: 'squat', hamstrings: 'legCurl', glutes: 'hinge', calves: 'calves', abs: 'abs', biceps: 'biceps', triceps: 'triceps', reardelts: 'rearDelts' };
// Only once every workout has exercises (a half-built routine isn't judged). A body part counts as
// trained if it has its own exercise, or another exercise works it well (squats work the bottom).
function gaps(r) {
  const out = { skipped: [], light: [], perWeek: null };
  // A half-built routine isn't judged; a cardio routine has no body parts to check, and an Olympic
  // lifting plan leaves out chest and arm work on purpose.
  if (!r || !r.days.length || r.days.some((d) => !d.items.length) || CH.routines.isCardio(r) || r.kind === 'olympic') return out;
  const tracked = new Set(S().state.settings.tracked || []);
  const dose = CH.engine.planDose(r);
  const direct = {};
  r.days.forEach((d) => d.items.forEach((it) => { const p = D().partOf(it.ex); if (p) direct[p] = (direct[p] || 0) + it.sets; }));
  out.skipped = CORE.filter((p) => { const part = D().part(p); return part.muscles.some((m) => tracked.has(m)) && !direct[p] && !((dose[part.muscles[0]] || 0) >= 1.5); });
  const per = r.week && r.week.n ? r.week.n : null;
  out.perWeek = per;
  const f = per ? per / r.days.length : 1;
  const skippedMuscles = new Set(out.skipped.flatMap((p) => D().part(p).muscles));
  out.light = D().MUSCLES.filter((m) => tracked.has(m.id) && !skippedMuscles.has(m.id) && (dose[m.id] || 0) * f < 4).map((m) => ({ id: m.id, name: m.name, sets: (dose[m.id] || 0) * f }));
  return out;
}
// The exercise added for a missing body part: the plan's usual one, in the routine's kit.
function gapPick(r, p) {
  const slot = PART_SLOT[p];
  if (!slot) return null;
  // The kit the routine already uses most, then machines (the simplest to learn); never a hard
  // bodyweight move (Nordic curls, inverted rows) picked just because the rest is bodyweight.
  const used = {};
  r.days.forEach((d) => d.items.forEach((it) => { const e = D().ex(it.ex); if (e && e.eq !== 'bodyweight') used[e.eq] = (used[e.eq] || 0) + 1; }));
  const base = D().profile(beginner() ? 'machines' : r.profile);
  const prefer = Object.keys(used).sort((a, b) => used[b] - used[a]).concat(['machine', 'plate', 'cable']).filter((k, i, a) => a.indexOf(k) === i && base.allow.includes(k));
  const prof = { prefer, allow: base.allow };
  const di = gapDay(r, p);
  return D().pickFor(slot, prof, new Set(r.days[di].items.map((x) => x.ex)));
}
// Which workout gets it: one meant for that body part, else the one with the fewest exercises.
function gapDay(r, p) {
  const k = r.days.findIndex((d) => d.parts.includes(p));
  if (k >= 0) return k;
  let best = 0;
  r.days.forEach((d, i) => { if (d.items.length < r.days[best].items.length) best = i; });
  return best;
}
function fillGaps(r, parts) {
  const added = [];
  parts.forEach((p) => {
    const id = gapPick(r, p);
    if (!id) return;
    const d = r.days[gapDay(r, p)];
    if (d.items.some((x) => x.ex === id)) return;
    if (!d.parts.includes(p)) d.parts.push(p);
    insertItem(d, id);
    added.push(exName(id));
  });
  save();
  return added;
}

/* ---------------- choosing an exercise ---------------- */
const count = (d, p) => d.items.filter((it) => D().partOf(it.ex) === p).length;
// Beyond the day's own body parts: Olympic lifts and cardio first (either goes on any day), then the
// other body parts.
const ANY_DAY = ['olympic', 'cardio'];
const otherParts = (d) => ANY_DAY.concat(D().PARTS.map((p) => p.id).filter((p) => !ANY_DAY.includes(p))).filter((p) => !d.parts.includes(p));
function partsMenu() {
  const d = day();
  const own = d.parts.slice().sort((a, b) => (count(d, a) ? 1 : 0) - (count(d, b) ? 1 : 0));
  const others = otherParts(d);
  const opt = (p) => ({ label: partName(p), sub: `${plainPart(p)} · ${count(d, p) ? `${count(d, p)} added` : d.parts.includes(p) ? 'none yet' : `not usually in ${d.name}`}`, icon: 'body', info: partInfo(p), act: () => menu(moveMenu(p)) });
  return { title: `Which body part? · ${d.name}`, options: own.concat(others).map(opt), start: 0 };
}
function partInfo(p) {
  if (p === 'cardio') return '<p>Walk, run, cycle, row, stairs, cross-trainer, ski erg or swim. Pick the type, the machine, its settings and the time.</p>';
  if (p === 'olympic') return '<p>Fast, whole-body barbell lifts: the snatch, the clean and the jerk, with their power, hang and pull versions, and the overhead squat.</p><p class="opt">Done first in a workout, for low reps (5 × 2–3), while you are fresh. Learn them light, ideally with a coach.</p>';
  const list = D().browsePart(p).slice(0, 6).map((b) => (b.fam ? b.fam.name : b.ex.name));
  return list.length ? `<p>Common choices: ${U.esc(U.list(list))}.</p>` : '';
}
const kits = (ids) => Array.from(new Set(ids.map((id) => D().eqName(D().ex(id).eq).toLowerCase())));
const kitText = (ids) => { const k = kits(ids); return k.length > 3 ? k.slice(0, 3).join(', ') + '…' : U.list(k); };
// Muscle names with what they mean: "Quads (front of thighs), glutes (bottom)…"
const mName = (m, first) => { const x = (D().muscle(m) || { name: m }).name; const t = first ? x : x.toLowerCase(); return MUSCLE_PLAIN[m] && MUSCLE_PLAIN[m] !== t.toLowerCase() ? `${t} (${MUSCLE_PLAIN[m]})` : t; };
const musclesText = (e) => (e.main ? [mName(e.main, true)].concat((e.help || []).map((m) => mName(m))) : []);
/* For someone new to the gym: machines and the easier versions first (they're simplest to learn
   and set up), free weights after. Everyone else sees the library's usual order. */
const EASY = { machine: 0, plate: 1, cable: 2, smith: 3, dumbbell: 4, bodyweight: 5, kettlebell: 6, barbell: 7 };
const easy = (e) => (e ? (EASY[e.eq] != null ? EASY[e.eq] : 4) + (/easier/i.test(e.v || '') ? -0.5 : /harder/i.test(e.v || '') ? 0.5 : 0) : 9);
const easiest = (b) => (b.ex ? easy(b.ex) : Math.min(...b.ids.map((id) => easy(D().ex(id)))));
const byEase = (list, key) => list.map((x, i) => ({ x, i, k: key(x) })).sort((a, b) => a.k - b.k || a.i - b.i).map((y) => y.x);
// The movements for a body part, the common ones first (nearest the thumb), then another body
// part, then "(Blank)" to name a new one.
const OLY_FIRST = { snatch: 'olySnatch', 'clean and jerk': 'olyCleanJerk', 'squat and pull': 'olyPulls', clean: 'olyClean', jerk: 'olyJerk' };
function moveMenu(partId) {
  if (partId === 'cardio') return CH.cardio.typeMenu(addCardio);
  const d = day(), have = new Set(d.items.map((it) => D().baseId(it.ex)));
  let moves = D().browsePart(partId);
  if (beginner()) moves = byEase(moves, easiest);
  // An Olympic lifting day offers its own lift first: Snatch on Snatch day, and so on.
  const first = partId === 'olympic' && OLY_FIRST[d.name.toLowerCase()];
  if (first) moves = moves.filter((b) => b.fam && b.fam.id === first).concat(moves.filter((b) => !(b.fam && b.fam.id === first)));
  const options = moves.map((b) => {
    if (b.ex || b.ids.length === 1) {
      const e = b.ex || D().ex(b.ids[0]);
      return { label: e.name, move: true, inDay: have.has(e.id), sub: (have.has(e.id) ? `In ${d.name} · ` : '') + (D().eqName(e.eq) || 'Your own') + (e.custom ? ' · your own' : ''), icon: 'plus', info: exInfo(e), act: () => add(e.id) };
    }
    const n = b.ids.filter((id) => have.has(id)).length;
    const first = D().ex(b.ids[0]);
    const ids = beginner() ? byEase(b.ids, (id) => easy(D().ex(id))) : b.ids;
    return { label: b.fam.name, move: true, inDay: n > 0, spare: n < b.ids.length, sub: `${n ? n + ` in ${d.name} · ` : ''}${b.ids.length} versions: ${kitText(ids)}`, icon: 'next', info: `<p>${U.esc(U.list(musclesText(first)))}</p><ul>${ids.slice(0, 7).map((id) => `<li>${U.esc(D().ex(id).v)}<span>${U.esc(D().eqName(D().ex(id).eq))}</span></li>`).join('')}</ul>`, act: () => menu(versionMenu(b.fam, partId)) };
  });
  options.push({ label: 'Another body part', sub: `Not ${lowPart(partId)}`, icon: 'body', act: () => menu(partsMenu()) });
  options.push({ label: '(Blank)', title: 'Name your own exercise', sub: 'Type or say a new exercise', icon: 'edit', info: `<p>Not in the list? Type its name, or say it. It counts towards ${U.esc(lowPart(partId))}.</p>`, act: () => nameExercise(partId) });
  /* Fix 4: the wheel opens on the first movement the workout doesn't already have; if it has them
     all (calves has one movement), on the first with a version it hasn't got. */
  let fresh = options.findIndex((o) => o.move && !o.inDay);
  if (fresh < 0) fresh = options.findIndex((o) => o.move && o.spare);
  return { title: `Add to ${d.name}: ${lowPart(partId)}`, options, start: 0, lead: Math.max(0, fresh) };
}
function versionMenu(fam, partId) {
  const d = day(), have = new Set(d.items.map((it) => D().baseId(it.ex)));
  const ids = beginner() ? byEase(fam.ids, (id) => easy(D().ex(id))) : fam.ids;
  const options = ids.map((id) => {
    const e = D().ex(id);
    return { label: e.v, title: e.name, ver: true, inDay: have.has(id), sub: `${have.has(id) ? `In ${d.name} · ` : ''}${D().EQUIPMENT[e.eq] ? D().EQUIPMENT[e.eq].long || D().eqName(e.eq) : 'Your own'}`, icon: 'plus', info: exInfo(e), act: () => add(id) };
  });
  options.push({ label: 'Other movements', sub: partName(partId), icon: 'back', act: () => menu(moveMenu(partId)) });
  const fresh = options.findIndex((o) => o.ver && !o.inDay);
  return { title: `${fam.name}: which version?`, options, start: 0, lead: Math.max(0, fresh) };
}
// Words in a version's name that a newcomer may not know.
const WORDS = [[/goblet/i, 'Goblet: hold one weight against your chest.'], [/front rack/i, 'Front rack: the weights rest on the front of your shoulders.'], [/landmine/i, 'Landmine: one end of a barbell sits in a holder on the floor.'], [/\bez\b/i, 'EZ bar: a short, bent bar that is easier on the wrists.'], [/trap bar/i, 'Trap bar: a hexagon-shaped bar you stand inside.'], [/\bsled\b/i, 'Sled: you push the platform away with your feet.']];
function exInfo(e) {
  const last = CH.engine.recent(S().sessions(), e.id, 1)[0];
  const words = WORDS.filter(([re]) => re.test(`${e.v || ''} ${e.name}`)).map(([, t]) => `<p>${U.esc(t)}</p>`).join('');
  return `<p>${U.esc(KIT_PLAIN[e.eq] || D().eqName(e.eq) || 'Your own exercise')}.</p>${e.main ? `<p>Works your ${U.esc(U.list(musclesText(e)).replace(/^./, (c) => c.toLowerCase()))}.</p>` : ''}${words}${last ? `<p>Last time ${U.esc(last.sets.map((x) => (x.w > 0 ? U.kg(x.w) + ' × ' : '') + x.r).join(', '))}</p>` : ''}`;
}
// In the workout, exercises follow the day's body parts in order.
function insertItem(d, id) {
  const ex = D().ex(id), slot = D().slotFor(id), p = D().partOf(id);
  const def = (ex && ex.plan) || (slot ? D().SLOTS[slot] : { lo: ex && ex.compound ? 6 : 10, hi: ex && ex.compound ? 10 : 15 });
  const item = { ex: id, slot, sets: def.sets || 3, lo: def.lo, hi: def.hi };
  const order = sections(d).map((s) => s.part);
  if (!order.includes(p)) order.push(p);
  // Cardio keeps its place: a warm-up stays first and a finisher stays last.
  let lead = 0;
  while (d.items[lead] && d.items[lead].cardio) lead++;
  let at = d.items.length;
  for (let k = d.items.length - 1; k >= -1; k--) {
    if (k >= 0 && d.items[k].cardio) continue;
    if (k < 0 || order.indexOf(D().partOf(d.items[k].ex)) <= order.indexOf(p)) { at = k + 1; break; }
  }
  d.items.splice(Math.max(at, lead), 0, item);
  return item;
}
/* Cardio into a workout: before the weights as a warm-up, or after them (asked only when the workout
   has weights). Its time and settings are the plan; on the day they start from last time. */
function addCardio(pick) {
  const d = day();
  const item = { ex: pick.ex, cardio: true, min: pick.min, set: Object.assign({}, pick.set) };
  const put = (first) => {
    w.lastPart = 'cardio';
    if (first) d.items.unshift(item); else d.items.push(item);
    if (!d.parts.includes('cardio') && !d.parts.length) d.parts.push('cardio');
    save();
    if (w.quick) { const r = routine(); leave(); CH.ui.toast(`Added ${U.esc(exName(pick.ex).toLowerCase())} to ${U.esc(r.days.length > 1 ? d.name : r.name)}${first ? ', first' : ''}.`); return; }
    render();
    CH.ui.toast(`Added ${U.esc(exName(pick.ex).toLowerCase())}.`);
    CH.scrub.root(stepMenu());
  };
  if (!d.items.some((x) => !x.cardio)) { put(false); return; }
  menu({
    title: `${exName(pick.ex)}: before or after the weights?`,
    options: [
      { label: 'Before, to warm up', sub: `First in ${d.name}`, icon: 'flag', info: '<p>A few easy minutes first gets you warm for the weights.</p>', act: () => put(true) },
      { label: 'After the weights', sub: `Last in ${d.name}`, icon: 'flag', info: '<p>Lifting first, while you’re fresh; cardio to finish.</p>', act: () => put(false) },
    ],
    start: 1, keep: true,
    onClose: () => { if (w && w.quick) leave(); },
  });
}
function add(id, again) {
  const d0 = day();
  // Fix 4: an exercise the workout already has is only added twice on purpose.
  if (!again && d0.items.some((it) => D().baseId(it.ex) === D().baseId(id))) {
    const p = D().partOf(id);
    menu({
      title: `${exName(id)} is already in ${d0.name}. Add it again?`,
      options: [
        { label: 'Pick another', sub: `Other ${lowPart(p)} movements`, icon: 'back', info: `<p>${U.esc(d0.name)} keeps the one it has.</p>`, act: () => menu(moveMenu(p)) },
        { label: 'Add it again', sub: 'Two lots of the same exercise', icon: 'plus', info: `<p>Some plans do the same exercise twice (heavy, then lighter). Most don't.</p>`, act: () => add(id, true) },
      ],
      start: 0, keep: true,
    });
    return;
  }
  w.lastPart = D().partOf(id);
  insertItem(day(), id);
  save();
  render();
  CH.ui.toast(`Added ${U.esc(exName(id).toLowerCase())}.`);
  // Back to the steps: it asks about the next body part, with Save and finish beside it.
  CH.scrub.root(stepMenu());
}

/* "(Blank)": a new exercise by name, typed or spoken, then the kit it uses (guessed from the name). */
const KIT_WORDS = [['smith', 'smith'], ['kettlebell', 'kettlebell'], ['dumbbell', 'dumbbell'], [' db ', 'dumbbell'], ['barbell', 'barbell'], ['ez bar', 'barbell'], ['cable', 'cable'], ['rope', 'cable'], ['plate', 'plate'], ['hammer strength', 'plate'], ['machine', 'machine'], ['push-up', 'bodyweight'], ['push up', 'bodyweight'], ['pull-up', 'bodyweight'], ['pull up', 'bodyweight'], ['chin', 'bodyweight'], ['dip', 'bodyweight'], ['plank', 'bodyweight'], ['bodyweight', 'bodyweight']];
const guessKit = (name) => { const n = ' ' + name.toLowerCase() + ' '; const hit = KIT_WORDS.find(([w]) => n.includes(w)); return hit ? hit[1] : 'machine'; };
function nameExercise(partId) {
  CH.ui.askText({
    title: 'Name the exercise', value: '', placeholder: 'For example, landmine press', max: 40, mic: true,
    done: (v) => {
      if (!v) return;
      const known = D().all().find((e) => e.name.toLowerCase() === v.toLowerCase());
      if (known) { add(known.id); return; }
      menu(kitMenu(v, partId));
    },
    cancel: () => menu(moveMenu(partId)),
  });
}
function kitMenu(name, partId) {
  const eqs = Object.keys(D().EQUIPMENT), guess = guessKit(name);
  const options = eqs.map((eq) => ({ label: D().EQUIPMENT[eq].long || D().EQUIPMENT[eq].name, sub: eq === guess ? 'Our guess from the name' : KIT_PLAIN[eq].split(':')[1].trim().replace(/^./, (c) => c.toUpperCase()), icon: 'plate', info: `<p>${U.esc(KIT_PLAIN[eq])}.</p>`, act: () => addCustom(name, eq, partId) }));
  return { title: `${name} · what kit?`, options, start: Math.max(0, eqs.indexOf(guess)) };
}
function addCustom(name, eq, partId) {
  const p = D().part(partId);
  const id = 'u' + U.id();
  const oly = partId === 'olympic';
  S().state.custom[id] = Object.assign({ id, name, eq, main: p ? p.muscles[0] || null : null, help: [], pattern: null, compound: false, aliases: [], custom: true, own: true }, oly ? { main: 'glutes', help: ['quads', 'hamstrings', 'upperBack'], pattern: 'hinge', compound: true, oly: true, plan: { sets: 5, lo: 2, hi: 3 } } : {});
  save();
  add(id);
}

/* ---------------- changing what's there ---------------- */
function changeList() {
  const d = day(), r = routine(), i = w.i;
  const rows = [];
  // Editing a routine later, the workout itself can go, move or be made next; furthest from the thumb.
  if (w.mode === 'edit') {
    rows.push({ label: 'Remove this workout', sub: 'Logged workouts are kept', icon: 'trash', danger: true, act: () => CH.stage.list({
      title: `Remove ${d.name}?`,
      rows: [{ label: 'Remove workout', sub: `From ${r.name}`, icon: 'trash', danger: true, act: () => { r.days.splice(i, 1); if (i < r.next) r.next -= 1; r.next = r.days.length ? r.next % r.days.length : 0; save(); CH.ui.toast(`Removed ${U.esc(d.name)}.`); leave(); } }],
      cancel: 'Keep it', cancelIcon: 'back', onCancel: changeList,
    }) });
    if (i > 0) rows.push({ label: 'Move earlier', sub: `Before ${r.days[i - 1].name}`, icon: 'undo', act: () => { r.days.splice(i - 1, 0, r.days.splice(i, 1)[0]); if (r.next === i) r.next = i - 1; else if (r.next === i - 1) r.next = i; w.i = i - 1; save(); render(); changeList(); } });
    if (i !== r.next) rows.push({ label: 'Do this one next', sub: `Instead of ${r.days[r.next].name}`, icon: 'today', act: () => { r.next = i; save(); CH.ui.toast(`${U.esc(d.name)} is up next.`); render(); changeList(); } });
  }
  rows.push({ label: 'Rename this workout', sub: d.name, icon: 'edit', act: () => CH.ui.nameDay(d, r.days, () => { save(); render(); changeList(); }, changeList) });
  sections(d).forEach((s) => s.items.forEach(({ it, k }) => rows.push({ label: exName(it.ex), sub: `${partName(s.part)} · ${nums(it)}`, icon: 'next', act: () => itemList(k) })));
  CH.stage.list({ title: `Change ${d.name}`, rows, start: 'end', cancel: 'Done', cancelIcon: 'check' });
}
const RANGES = [[3, 5], [4, 6], [5, 8], [6, 10], [8, 12], [10, 15], [12, 20], [15, 25]];
function itemList(k) {
  const d = day(), it = d.items[k];
  if (!it) return changeList();
  if (it.cardio) { cardioItemList(k); return; }
  const again = () => { save(); render(); itemList(k); };
  const ri = RANGES.findIndex((x) => x[0] === it.lo && x[1] === it.hi);
  const p = D().partOf(it.ex);
  let prev = -1;
  for (let j = k - 1; j >= 0; j--) if (D().partOf(d.items[j].ex) === p) { prev = j; break; }
  const ex = D().ex(it.ex) || {};
  // Remove furthest from the thumb; Swap, the change made most, nearest.
  const rows = [{ label: 'Remove', sub: `Take it out of ${d.name}`, icon: 'trash', danger: true, act: () => { d.items.splice(k, 1); save(); render(); if (d.items.length) changeList(); else CH.stage.closeList(); } }];
  if (prev >= 0) rows.push({ label: 'Move up', sub: `Before ${exName(d.items[prev].ex).toLowerCase()}`, icon: 'undo', act: () => { const [x] = d.items.splice(k, 1); d.items.splice(prev, 0, x); save(); render(); itemList(prev); } });
  // Your own and imported exercises can be put right: which muscle they count towards, and their name.
  if (ex.custom) {
    rows.push({ label: 'Counts towards', value: ex.main ? D().muscle(ex.main).name : 'No muscle', sub: ex.own ? 'Your own exercise' : 'Imported exercise', icon: 'body', act: () => CH.ui.mapMuscle(it.ex, () => { render(); itemList(k); }) });
    rows.push({ label: 'Rename this exercise', sub: ex.name, icon: 'edit', act: () => CH.ui.askText({ title: 'Rename the exercise', value: ex.name, max: 40, mic: true, done: (v) => { if (v) { S().state.custom[it.ex].name = v; save(); } render(); itemList(k); }, cancel: () => itemList(k) }) });
  }
  if (D().brandable(ex)) rows.push({ label: 'Machine brand', value: ex.brand ? ex.brandName : 'None', sub: 'Each brand keeps its own history', icon: 'plate', act: () => CH.ui.pickBrand(it.ex, () => { render(); itemList(k); }, () => itemList(k)) });
  rows.push({ label: 'Rest', value: (it.rest || S().state.settings.rest) + ' s', sub: it.rest ? 'This exercise only' : 'Your default', act: () => { const o = [60, 90, 120, 180, 240]; it.rest = o[(o.indexOf(it.rest || S().state.settings.rest) + 1) % o.length]; again(); } });
  rows.push({ label: 'Rep range', value: `${it.lo}–${it.hi}`, sub: 'Tap for the next range', act: () => { const x = RANGES[(ri + 1) % RANGES.length]; it.lo = x[0]; it.hi = x[1]; again(); } });
  rows.push({ label: 'Sets', value: String(it.sets), sub: 'Tap to change, 1 to 6', act: () => { it.sets = (it.sets % 6) + 1; again(); } });
  rows.push({ label: 'Swap for another version', sub: 'Other kit, handles or movements', icon: 'swap', accent: true, act: () => variants(k) });
  CH.stage.list({ title: exName(it.ex), rows, start: 'end', cancel: 'Back', cancelIcon: 'back', onCancel: changeList });
}
// A cardio exercise in a workout: its time, its settings, another type or machine, or out.
function cardioItemList(k) {
  const d = day(), it = d.items[k];
  const again = () => { save(); render(); cardioItemList(k); };
  const rows = [{ label: 'Remove', sub: `Take it out of ${d.name}`, icon: 'trash', danger: true, act: () => { d.items.splice(k, 1); save(); render(); if (d.items.length) changeList(); else CH.stage.closeList(); } }];
  if (k > 0) rows.push({ label: 'Move earlier', sub: `Before ${exName(d.items[k - 1].ex).toLowerCase()}`, icon: 'undo', act: () => { d.items.splice(k - 1, 0, d.items.splice(k, 1)[0]); save(); render(); cardioItemList(k - 1); } });
  if (k < d.items.length - 1) rows.push({ label: 'Move later', sub: `After ${exName(d.items[k + 1].ex).toLowerCase()}`, icon: 'next', act: () => { d.items.splice(k + 1, 0, d.items.splice(k, 1)[0]); save(); render(); cardioItemList(k + 1); } });
  rows.push({ label: 'Another type or machine', sub: 'Pick it again from the start', icon: 'swap', act: () => menu(CH.cardio.typeMenu((pick) => { Object.assign(it, { ex: pick.ex, min: pick.min, set: Object.assign({}, pick.set) }); again(); })) });
  if (CH.cardio.MACHINES[CH.cardio.ex(it.ex).machine].settings.length) rows.push({ label: 'Settings', value: '', sub: CH.cardio.settingsText(it.ex, it.set) || 'None yet', icon: 'settings', act: () => CH.cardio.settingsChain(it.ex, Object.assign(CH.cardio.startSettings(it.ex), it.set), 0, (set) => { it.set = set; again(); }) });
  rows.push({ label: 'Time', value: `${it.min} min`, sub: 'How long you plan to go for', icon: 'timer', accent: true, act: () => menu(CH.cardio.timeMenu(it.ex, it.min, (m) => { it.min = m; again(); })) });
  CH.stage.list({ title: exName(it.ex), rows, start: 'end', cancel: 'Back', cancelIcon: 'back', onCancel: changeList });
}
function variants(k) {
  const it = day().items[k];
  const cur = D().ex(it.ex) || {};
  const alts = D().alternatives(it.ex, it.slot, D().profile(routine().profile));
  const swap = (id) => { it.ex = id; it.slot = D().slotFor(id); delete it.light; delete it.fine; save(); CH.stage.closeList(); render(); CH.ui.toast(`Swapped to ${U.esc(exName(id).toLowerCase())}.`); };
  CH.stage.list({
    title: `Instead of ${exName(it.ex).toLowerCase()}`,
    rows: alts.map((e) => ({ label: e.name, sub: (e.fam && e.fam === cur.fam ? 'Same movement · ' : '') + D().eqName(e.eq), act: () => swap(e.id) })),
    cancel: 'Back', cancelIcon: 'back', onCancel: () => itemList(k),
  });
}


CH.setup = {
  start, newRoutine, newStarter, newCardioRoutine, addCardioTo, splitMenu, attachMenu, editDay, editItem, render, active: () => !!w,
  // For the Routines screen: the training days in words, and the gap check and fix.
  weekText, gaps, fillGaps, partName, shortPart, setsWords, gapPick,
};
export default CH.setup;
