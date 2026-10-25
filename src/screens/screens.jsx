/* GYMKDR · screens (Chalk's screens.js). The top of the screen is for reading; the thumb's corner is
   for touching. Home, Calendar, a lift over time, Routines, Progress, Week, Review, a Routine,
   Settings, and the end-of-workout card. Each screen draws itself into the reading column
   (CH.ui.setView) and hands the corner its controls (CH.stage.set). */
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import CH from '../ch';
import Icon from '../ui/Icon';
import { F, useTheme, useVw } from '../ui/theme';
import { Topbar, Head, Kick, Title, Meta, Sec, Dim, Card, Glance, Legend, Chip, WarnMark, H2, Pair, T, B } from '../ui/kit';
import { toast } from '../ui/Toast';
import { askText } from '../ui/Ask';
import { contentAtom, viewAtom } from '../ui/store';
import { pickText, saveFile } from '../logic/files';

const U = CH.u;
const E = () => CH.engine, S = () => CH.store, D = () => CH.data;
const DAY = 864e5;
let current = null, focusCard = 0;
// The routine the Routine page shows (one picked from Routines), else the one in use.
let planRid = null;
const st = () => S().state;
const sessions = () => S().sessions();
const fitAsk = () => {};

/* ---------------- shared bits ---------------- */
/* The corner on every screen but the workout: Home (except at home) and Menu, a slide menu of
   the other screens. */
function nav(sel) {
  return [
    sel === 'today' ? null : { icon: 'today', label: 'Home', prio: 1, act: () => show('today') },
    // At home everything is in the Start button's wheel, so there is no Menu button there.
    sel === 'today' ? null : { icon: 'more', label: 'Menu', prio: 1, menu: () => navMenu(sel), row: { label: 'Menu', sub: 'Calendar, progress, week, routines, settings' } },
  ].filter(Boolean);
}
function navMenu(sel) {
  const n = weekBadge();
  const all = sessions();
  const items = [
    { id: 'calendar', label: 'Calendar', sub: all.length ? `${U.plural(all.length, 'workout')} logged` : 'Every workout, by date', icon: 'week', info: '<p>Go back to any day and see what you did. Pick an exercise there for its progress chart.</p>' },
    { id: 'progress', label: 'Progress', sub: 'How your lifts are going', icon: 'progress', info: '<p>Your main lifts over the last 10 weeks, how much work each muscle got this week, and how often you train.</p>' },
    { id: 'week', label: 'Week', sub: n ? `${n} suggestion${n === '1' ? '' : 's'}` : 'Your last 7 days, checked', icon: 'flag', info: '<p>Muscles that got too little work in the last 7 days, kinds of exercise you missed, and lifts that have stopped going up, with what to change.</p>' },
    { id: 'review', label: 'Review routines', sub: reviewSub(), icon: 'check', info: '<p>Each routine laid out plainly, workout by workout, with every exercise marked Keep or Look at: what\'s going up, what\'s stalled, what keeps getting skipped.</p>' },
    { id: 'routines', label: 'Routines', sub: CH.routines.list().length ? `${U.plural(CH.routines.list().length, 'routine')} · days, names, cardio` : 'None yet', icon: 'stack', info: '<p>Every routine you have, and your week: which routine goes on which day. Rename any routine, give it its days, add cardio to it, or make a cardio routine of its own.</p>' },
    { id: 'settings', label: 'Settings', sub: 'Rest timer, weight steps, import, export', icon: 'settings', info: '<p>Rest timer, weight steps for each kind of kit, muscles to check, haptics, sound, motion, import and export.</p>' },
  ].filter((o) => o.id !== sel);
  return { title: 'Menu', options: items.map((o) => Object.assign(o, { act: () => show(o.id) })), start: 0 };
}
function weekBadge() {
  try { const n = E().review(st(), sessions(), Date.now()).cards.length; return n ? String(n) : ''; } catch (e) { return ''; }
}
/* What's next, which Home shows and Start offers to begin with one tap:
   1. a routine the week plan puts on today, not done yet (weights before cardio when a day has both);
   2. otherwise, when routines are on days, the next one the plan comes to that isn't the one done
      last, so routines A and B take turns (A done last → B, even on a day off);
   3. otherwise the routine in use. Within a routine, its workouts take turns as before. */
const dow = (ts) => (new Date(ts).getDay() + 6) % 7;
const doneToday = (r, all, now) => { const s = lastIn(r, all); return !!s && dayKey(s.start) === dayKey(now); };
function todays(now = Date.now()) {
  const all = sessions();
  return CH.routines.onDay(dow(now)).filter((r) => r.days.length && !doneToday(r, all, now));
}
function lastDoneRoutine(all) {
  for (let i = all.length - 1; i >= 0; i--) { const r = CH.routines.get(all[i].routineId); if (r) return r; }
  return null;
}
function nextPlanned(now) {
  const upcoming = [];
  for (let k = 1; k <= 7; k++) CH.routines.onDay((dow(now) + k) % 7).filter((r) => r.days.length).sort((a, b) => CH.routines.isCardio(a) - CH.routines.isCardio(b)).forEach((r) => { if (!upcoming.includes(r)) upcoming.push(r); });
  if (!upcoming.length) return null;
  const last = lastDoneRoutine(sessions());
  return upcoming.find((r) => r !== last) || upcoming[0];
}
function suggestion() {
  const now = Date.now(), today = todays(now), cur = CH.routines.active();
  const r = today.find((x) => x === cur && !CH.routines.isCardio(x)) || today.find((x) => !CH.routines.isCardio(x)) || today[0] || nextPlanned(now) || cur;
  if (!r || !r.days.length) return null;
  return { r, i: Math.min(r.next, r.days.length - 1), today: today.includes(r), also: today.filter((x) => x !== r) };
}
/* Start: one button. Its menu holds New routine at the bottom and, above it, each routine, the
   one in use highlighted. A routine then lists its days, the next one first: let go on a built day
   to train it, on an empty one to build it. */
function startHub() {
  if (CH.session.active()) return { label: 'Resume', sub: st().active.day, icon: 'play', primary: true, act: () => CH.session.resume() };
  const g = suggestion();
  return { label: 'Start', aria: g ? `Start. Next: ${g.r.days[g.i].name}` : 'Start', icon: 'play', primary: true, menu: homeMenu };
}
function homeMenu() {
  const all = sessions();
  const used = (r) => { const s = lastIn(r, all); return s ? s.start : r.made || 0; };
  const cur = CH.routines.active();
  // Today's routines first (the one Home shows leads), then the one in use, then the most recent.
  const g = suggestion(), today = todays();
  const rank = (r) => (g && r === g.r ? 3 : today.includes(r) ? 2 : r === cur ? 1 : 0);
  const list = CH.routines.list().slice().sort((a, b) => rank(b) - rank(a) || used(b) - used(a));
  const options = [{
    label: 'New routine', sub: 'Choose your own plan and exercises', icon: 'plus',
    info: `<p>Pick a plan, then choose its exercises one body part at a time. When you save it, you can attach it to particular days.</p>${list.length ? '<p>Your other routines stay.</p>' : ''}`,
    act: () => CH.setup.newRoutine(),
  }];
  /* With routines, the wheel opens on what's next, ready to go: one tap on the button starts it
     (or builds it, if that workout has nothing in it yet). With none, it opens on New routine. */
  if (g) {
    const d = g.r.days[g.i], built = d.items.length > 0;
    const when = g.today ? `Today · ${g.r.name !== d.name ? g.r.name : U.plural(d.items.length, 'exercise')}` : `Next · ${g.r.name !== d.name ? g.r.name : U.plural(d.items.length, 'exercise')}`;
    options.push({ label: built ? `Start ${d.name}` : `Build ${d.name}`, title: built ? `Start ${d.name}` : `Build ${d.name}`, sub: built ? when : 'Nothing in it yet · pick its exercises', icon: built ? 'play' : 'plus', info: built ? `<ul>${d.items.map((it) => `<li>${U.esc(exName(it.ex))}<span>${U.esc(nums(it))}</span></li>`).join('')}</ul>` : '', act: () => { CH.routines.activate(g.r.id); if (built) CH.session.start(g.i, g.r.id); else CH.setup.editDay(g.r.id, g.i, 'today'); } });
  }
  list.forEach((r) => {
    const d = r.days[Math.min(r.next, r.days.length - 1)];
    const nextSub = !d ? 'No workouts yet' : r.days.length === 1 ? (d.items.length ? `Train it: ${U.plural(d.items.length, 'exercise')}` : 'Not built yet') : `Next: ${d.name}${d.items.length ? '' : ' · not built yet'}`;
    options.push({ label: r.name, sub: (today.includes(r) ? 'Today · ' : '') + nextSub, icon: CH.routines.isCardio(r) ? 'flag' : 'stack', info: routineInfo(r, all), act: () => CH.scrub.open(dayMenu(r), 'hub', 'sticky') });
  });
  // Cardio on its own: the type, machine, settings and time, then the timer.
  options.push({ label: 'Cardio', sub: 'Walk, run, cycle, row, stairs…', icon: 'flag', info: '<p>Pick the type, the machine, its settings and the time, then Start runs the timer. At the end, log what the machine shows and how hard it felt.</p><p>To make cardio part of a routine, add it to a workout like any exercise.</p>', act: () => CH.cardio.open(CH.cardio.typeMenu((pick) => CH.session.startCardio(pick))) });
  // The rest of the app lives in the same wheel, above the routines.
  navMenu('today').options.forEach((o) => options.push(o));
  return {
    title: list.length ? 'What would you like to do?' : 'Get started', options, start: g ? 1 : 0, keep: true,
    coach: g ? `Tap the button to start ${g.r.days[g.i].name}. Slide for your other routines, and Calendar, Progress, Week and Settings.` : list.length ? 'Your routines are here, and so are Calendar, Progress, Week, Routines and Settings. Nothing starts until you choose it.' : 'Tap the button to make your first routine. Or slide for Cardio, Calendar and Settings.',
  };
}
function routineInfo(r, all) {
  if (r.days.length === 1) return `<ul>${r.days[0].items.map((it) => `<li>${U.esc(exName(it.ex))}<span>${U.esc(nums(it))}</span></li>`).join('')}</ul>`;
  return `<ul>${r.days.map((d, k) => { const ld = CH.routines.lastDone(d, all, r); return `<li>${k === r.next ? '<b>' + U.esc(d.name) + ' · next</b>' : U.esc(d.name)}<span>${d.items.length ? (ld ? U.ago(ld.start) : U.plural(d.items.length, 'exercise')) : 'not built'}</span></li>`; }).join('')}</ul>`;
}
function dayMenu(r) {
  const all = sessions(), n = r.days.length;
  const order = Array.from({ length: n }, (_, k) => (r.next + k) % n);
  const options = order.map((i) => {
    const d = r.days[i], built = d.items.length > 0, ld = CH.routines.lastDone(d, all, r);
    return {
      label: d.name, sub: built ? `${U.plural(d.items.length, 'exercise')}${ld ? ' · done ' + U.ago(ld.start) : ''}${i === r.next ? ' · next' : ''}` : 'Not built yet · build it now', icon: built ? 'play' : 'plus',
      info: built ? `<ul>${d.items.map((it) => `<li>${U.esc(exName(it.ex))}<span>${U.esc(nums(it))}</span></li>`).join('')}</ul>` : `<p>For ${U.esc(U.list(d.parts.map((p) => D().part(p).name.toLowerCase())) || 'any body parts')}. Tap the button to pick its exercises.</p>`,
      act: () => { CH.routines.activate(r.id); if (built) CH.session.start(i, r.id); else CH.setup.editDay(r.id, i, 'today'); },
    };
  });
  options.push({ label: `Edit ${r.name}`, short: 'Edit', sub: 'Workouts, exercises, sets and reps', icon: 'edit', act: () => { planRid = r.id; show('plan'); } });
  return { title: r.name, options, start: 0 };
}
const topbar = (kick) => <Topbar kick={kick} />;
const exName = (id) => (D().ex(id) || { name: 'Unknown exercise' }).name;
const nums = (it) => (it.cardio ? CH.cardio.itemText(it) : `${it.sets} × ${it.lo}–${it.hi}`);
// Sets in words, cardio or lifting: "20 min · 3.1 km" or "60 kg × 8, 8, 7".
const anyText = (sets) => (sets.length && sets[0].c ? sets.map((x) => CH.cardio.entryText(x)).join('; ') : setsText(sets));
const view = (name, el) => CH.ui.setView(name, el);

function show(name) {
  if (current === 'session' && name !== 'session') CH.session.leave();
  current = name;
  // A screen shown again starts at its top, as a new one does.
  viewAtom.set({ name, rev: viewAtom.get().rev + 1 });
  const fn = { welcome: renderWelcome, setup: () => CH.setup.render(), today: renderToday, session: () => CH.session.render(), progress: renderProgress, week: renderWeek, plan: renderPlan, routines: renderRoutines, review: renderReview, settings: renderSettings, calendar: renderCalendar, lift: renderLift, done: () => {} }[name];
  if (fn) fn();
}
function refresh() { if (current && current !== 'done') show(current); }

/* ---------------- first run ---------------- */
function renderWelcome() { show('today'); }

/* ---------------- Home ----------------
   The opening page: the next workout in the routine in use and one button, Start. With no
   routine yet, Start holds a single choice, New routine. */
/* The last workout done from a routine. A workout says which routine and day it came from; only one
   that doesn't (imported, or logged before routines had ids) is matched by its workout's name, so two
   routines that both have a "Full body" never share their history. */
const fromRoutine = (s, r) => (s.routineId ? s.routineId === r.id && r.days.some((d) => d.id === s.dayId || d.name === s.day) : r.days.some((d) => d.id === s.dayId || d.name === s.day));
const lastIn = (r, all) => { for (let i = all.length - 1; i >= 0; i--) if (fromRoutine(all[i], r)) return all[i]; return null; };
function How() {
  const th = useTheme();
  const steps = [['Tap', 'Start, and its choices appear above it'], ['Slide', 'your thumb up or down to roll through them'], ['Tap', 'the button to choose the lit one (or tap a choice twice)']];
  return (
    <View style={{ marginTop: 22, gap: 10 }}>
      {steps.map(([b, s], i) => (
        <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: th.hubBg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: F.bodyB, fontSize: 14, color: th.hubInk }}>{i + 1}</Text></View>
          <Text style={{ flex: 1, fontFamily: F.body, fontSize: 16, lineHeight: 22, color: th.ink2 }}><Text style={{ fontFamily: F.display, fontSize: 22, color: th.ink }}>{b}</Text>  {s}</Text>
        </Card>
      ))}
    </View>
  );
}
const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// The routine's training days, as they bear on today.
function weekLine(r, prev, now) {
  const wk = r.week;
  if (!wk || !wk.n) return '';
  if (prev && dayKey(prev.start) === dayKey(now)) return 'Trained today';
  if (!wk.days) return `${wk.n} day${wk.n === 1 ? '' : 's'} a week`;
  const today = (new Date(now).getDay() + 6) % 7;
  if (wk.days.includes(today)) return `Today (${DOW_LONG[today]}) is a training day`;
  const next = wk.days.find((d) => d > today);
  return `Next training day: ${DOW_LONG[next != null ? next : wk.days[0]]}`;
}
function PlanRow({ name, t, last, why, up }) {
  const th = useTheme();
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: th.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <Text style={{ flex: 1, fontFamily: F.bodyB, fontSize: 16, lineHeight: 22, color: th.ink }}>{name}</Text>
        <Text style={{ fontFamily: F.display6, fontSize: 21, color: th.ink, fontVariant: ['tabular-nums'] }}>{t}</Text>
      </View>
      {last ? <Text style={{ marginTop: 2, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: th.ink2, fontVariant: ['tabular-nums'] }}>{last}</Text> : null}
      {why ? <Text style={{ marginTop: 2, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: up ? th.accent : th.ink3 }}>{why}</Text> : null}
    </View>
  );
}
function renderToday() {
  const all = sessions(), now = Date.now();
  const g = st().active ? null : suggestion();
  const parts = [];
  if (!CH.routines.list().length && !st().active) {
    parts.push(<Head key="h" kick="Welcome to GYMKDR" title="Start with a routine" meta="One button does everything: the Start button. It holds your routines, and the rest of the app too. Nothing happens until you choose something." />);
    parts.push(<How key="how" />);
  } else if (st().active) {
    const a = st().active;
    const lastT = Math.max(a.start, ...a.sets.map((x) => x.t || 0));
    const stale = now - lastT > 4 * 3600e3;
    parts.push(<Head key="h" kick={stale ? 'Left open' : 'Workout in progress'} title={a.day} meta={`${stale ? `Last touched ${U.ago(lastT, now)}` : `Started ${U.mins(now - a.start)} ago`} · ${U.plural(a.sets.filter((x) => !x.wu).length, 'set')} logged`} />);
    if (stale) parts.push(<Glance key="g">Resume to carry on, save what you logged, or discard it.</Glance>);
  } else if (!g) {
    const r = CH.routines.active();
    parts.push(<Head key="h" kick={r ? r.name : 'Your routine'} title="No workouts yet" meta="Add a workout to this routine in Routines, then its exercises." />);
  } else {
    const { r, i } = g, d = r.days[i], n = r.days.length;
    const prev = lastIn(r, all);
    const wl = g.today ? '' : weekLine(r, prev, now);
    const bits = [r.name !== d.name ? r.name : '', prev ? `last trained ${U.ago(prev.start, now)}` : '', wl].filter(Boolean);
    parts.push(<Head key="h" kick={`${g.today ? `Today · ${DOW_LONG[dow(now)]}` : 'Next workout'}${n > 1 ? ` · ${i + 1} of ${n}` : ''}`} title={d.name} meta={bits.length ? bits.join(' · ').replace(/^./, (c) => c.toUpperCase()) : null} />);
    // Another routine on today too (a run after the weights): said once, under the heading.
    if (g.also.length) parts.push(<Meta key="also">Also today: {U.list(g.also.map((x) => x.name))}. Start has {g.also.length === 1 ? 'it' : 'them'}.</Meta>);
    if (!d.items.length) {
      parts.push(<Glance key="g">{`${d.name} has no exercises yet. Tap Start, then tap again to pick them.`}</Glance>);
    } else {
      const rows = [];
      d.items.forEach((it, k) => {
        const ex = D().ex(it.ex);
        if (!ex) return;
        if (ex.cardio) {
          const l = CH.cardio.last(it.ex), stx = CH.cardio.settingsText(it.ex, it.set);
          rows.push(<PlanRow key={k} name={ex.name} t={`${it.min || 20} min`} last={l ? `Last time ${CH.cardio.entryText(l, true)}` : ''} why={stx ? `Cardio · ${stx}` : 'Cardio'} />);
          return;
        }
        const t = E().target(it, all, st().settings);
        const bw = ex.eq === 'bodyweight' && t.sets[0].w === 0;
        const reps = t.sets.map((x) => x.r);
        const same = reps.every((v) => v === reps[0]);
        const last = E().recent(all, it.ex, 1)[0];
        const lastTxt = last ? `Last time ${last.sets.every((x) => x.w === last.sets[0].w) ? (last.sets[0].w > 0 ? U.kg(last.sets[0].w) + ' kg × ' : '') + last.sets.map((x) => x.r).join(', ') : last.sets.map((x) => U.kg(x.w) + '×' + x.r).join(', ')}` : '';
        // A first time has no weight yet: the lifter picks it at the first set, so none is shown.
        const n2 = t.kind === 'first' ? `${t.sets.length} × ${it.lo}–${it.hi} reps` : `${t.sets.length} × ${bw ? '' : U.kg(t.sets[0].w) + ' kg × '}${same ? reps[0] : reps.join('/')}`;
        rows.push(<PlanRow key={k} name={ex.name} t={n2} last={lastTxt} why={t.reason} up={t.kind === 'up'} />);
      });
      parts.push(<View key="pl" style={{ marginTop: 18 }}>{rows}</View>);
      // The numbers, said once in words, until the first workout is logged.
      const lift = d.items.find((x) => !x.cardio);
      if (!all.length && lift) parts.push(<Legend key="lg">{lift.sets} × {lift.lo}–{lift.hi} reps means {CH.setup.setsWords(lift)}. A rep is one lift; a set is a round of reps, with a rest after it.</Legend>);
    }
  }
  // The week at a glance, one line; the Week screen has the detail.
  if (all.length) {
    const rv = E().review(st(), all, now);
    const miss = rv.missed.map((m) => D().muscle(m.id).name.toLowerCase());
    const quiet = !all.some((x) => x.start > now - 7 * DAY);
    const firstWeek = now - all[0].start < 7 * DAY;
    if (quiet) parts.push(<Glance key="wk">Nothing logged in the last 7 days. Pick up where your routine says and the week review will fill in.</Glance>);
    else if (firstWeek) parts.push(<Glance key="wk">{`${U.plural(all.length, 'workout')} so far. The weekly check starts once you've a full week of workouts.`}</Glance>);
    else parts.push(
      <Glance key="wk">
        {miss.length ? <><WarnMark />{'  '}{miss.length > 3 ? U.plural(miss.length, 'muscle') + ' under' : 'Under'} 4 sets in the last 7 days{miss.length > 3 ? '' : ': ' + U.list(miss)}. Week has the detail.</> : 'Every muscle you track has 4 or more sets in the last 7 days.'}
        {rv.cards.length ? ` ${U.plural(rv.cards.length, 'suggestion')} in Week.` : ''}
      </Glance>,
    );
  }
  view('today', <View>{topbar('')}{parts}</View>);
  CH.stage.set({ hub: startHub(), rim: nav('today') });
}

/* ---------------- Calendar ----------------
   A month at a glance with every workout day marked, the planned days named with the workout that
   falls on them, and what was done on the day picked. Dates slides back through the workouts,
   newest first, with that day's week and detail beside the wheel; letting go on a day lists its
   exercises, and one of those opens its progress chart with that day marked. Earlier and Next move
   the month without losing the day picked. */
const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const keyDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const tinyDay = (k) => keyDate(k).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const shortDay = (k) => keyDate(k).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
const longDay = (k) => keyDate(k).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthOf = (k) => k.slice(0, 7);
const addDays = (k, n) => { const d = keyDate(k); d.setDate(d.getDate() + n); return dayKey(d.getTime()); };
const setsText = (sets) => (sets.every((x) => x.w === sets[0].w) ? (sets[0].w > 0 ? U.kg(sets[0].w) + ' kg × ' : '') + sets.map((x) => x.r).join(', ') + (sets[0].w > 0 ? '' : ' reps') : sets.map((x) => (x.w > 0 ? U.kg(x.w) + '×' : '') + x.r).join(', '));
let calSel = null, calMonth = null;
function byDay(all) {
  const m = new Map();
  all.forEach((x) => { const k = dayKey(x.start); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return m;
}
/* Fix 1: a planned day is named with the workout that will fall on it. A routine's workouts take
   turns, so counting its training days from today (one already trained today doesn't count) gives
   which workout each one is: Push on Monday, Pull on Wednesday, Legs on Friday, Push again. */
function plannedOn(k, days, now = Date.now()) {
  const today = dayKey(now);
  if (k < today) return [];
  const d = (keyDate(k).getDay() + 6) % 7;
  return CH.routines.onDay(d).filter((r) => r.days.length).sort((a, b) => CH.routines.isCardio(a) - CH.routines.isCardio(b)).map((r) => {
    let count = 0;
    for (let j = today; j < k; j = addDays(j, 1)) {
      const on = r.week.days.includes((keyDate(j).getDay() + 6) % 7);
      const done = (days.get(j) || []).some((s) => fromRoutine(s, r));
      if (on && !done) count++;
    }
    const w = r.days[(r.next + count) % r.days.length];
    return { r, name: w.name, label: r.days.length > 1 ? `${r.name}: ${w.name}` : r.name };
  });
}
function renderCalendar() {
  const all = sessions();
  const days = byDay(all);
  if (!calSel || !days.has(calSel)) { calSel = all.length ? dayKey(all[all.length - 1].start) : dayKey(Date.now()); calMonth = null; }
  if (!calMonth) calMonth = monthOf(calSel);
  calContent();
  calControls();
}
function calControls() {
  const all = sessions();
  CH.stage.set({
    hub: all.length ? { label: 'Dates', sub: 'slide', icon: 'week', primary: true, menu: dateMenu } : startHub(),
    // Fix 3: the month moves on its own, so a coming month's planned days can be read too.
    rim: nav('calendar').concat([
      { icon: 'back', label: 'Earlier', aria: 'Earlier month', prio: 2, act: () => moveMonth(-1), row: { label: 'Earlier month' } },
      { icon: 'next', label: 'Next', aria: 'Next month', prio: 2, act: () => moveMonth(1), row: { label: 'Next month' } },
    ]),
  });
}
function moveMonth(dir) {
  const [y, m] = calMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  calMonth = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  calContent();
}
// One day's workouts: each one's exercises and sets.
function DayDetail({ k, compact }) {
  const th = useTheme();
  const all = sessions(), days = byDay(all);
  const ss = days.get(k) || [];
  const pl = !ss.length ? plannedOn(k, days) : [];
  return (
    <View>
      {compact ? <Text style={{ marginTop: 14, fontFamily: F.display6, fontSize: 21, color: th.ink }}>{longDay(k)}</Text> : <Sec>{longDay(k)}</Sec>}
      {!ss.length ? <Dim style={{ fontSize: 14 }}>{pl.length ? `Planned: ${U.list(pl.map((p) => p.label))}.` : 'Rest day.'}</Dim> : null}
      {ss.map((rec) => {
        const work = rec.sets.filter((x) => !x.wu);
        const prior = all.filter((x) => x.start < rec.start);
        const prs = new Set(E().prsFor(rec, prior).map((p) => p.ex));
        const order = [];
        work.forEach((x) => { if (!order.includes(x.ex)) order.push(x.ex); });
        const took = rec.noTime || !(rec.end > rec.start) ? 'time not recorded' : U.mins(rec.end - rec.start);
        const nLift = work.filter((x) => !x.c).length, cMin = Math.round(work.filter((x) => x.c).reduce((t, x) => t + (x.s || 0), 0) / 60);
        const what = [nLift ? U.plural(nLift, 'set') : '', cMin ? `${cMin} min cardio` : ''].filter(Boolean).join(' · ') || 'warm-up sets only';
        const rows = order.map((id) => ({ id, name: exName(id), pr: prs.has(id), v: anyText(work.filter((x) => x.ex === id)) }));
        if (!work.length) {
          const wids = [];
          rec.sets.forEach((x) => { if (!wids.includes(x.ex)) wids.push(x.ex); });
          wids.forEach((id) => rows.push({ id, name: exName(id), v: `${setsText(rec.sets.filter((x) => x.ex === id))} · warm-up` }));
        }
        return (
          <Card key={rec.id} style={{ marginTop: 8 }}>
            {/* Beside the wheel the column is narrow, so each line stacks: the name, then its sets. */}
            <View style={compact ? { marginBottom: 6 } : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <Text style={{ fontFamily: F.display, fontSize: 22, color: th.ink, flexShrink: 1 }}>{rec.day}</Text>
              <Text style={{ fontFamily: F.body, fontSize: 13.5, color: th.ink3, flexShrink: 1, textAlign: compact ? 'left' : 'right' }}>{new Date(rec.start).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} · {took} · {what}</Text>
            </View>
            {rows.map((x, j) => (
              <View key={x.id + j} style={[{ paddingVertical: compact ? 5 : 7, borderTopWidth: 1, borderTopColor: th.line2 }, compact ? null : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }]}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: compact ? undefined : 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: F.bodyB, fontSize: compact ? 14.5 : 15.5, color: th.ink, flexShrink: 1 }}>{x.name}</Text>
                  {x.pr ? <Chip kind="up" icon="star">PR</Chip> : null}
                </View>
                <Text style={{ fontFamily: F.display6, fontSize: compact ? 16 : 17, textAlign: compact ? 'left' : 'right', color: compact ? th.ink2 : th.ink, flexShrink: 1, maxWidth: compact ? undefined : '55%', fontVariant: ['tabular-nums'] }}>{x.v}</Text>
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}
// The month grid. Workout days are dark; planned days are outlined and named with their workout.
function CalGrid({ month, sel }) {
  const th = useTheme(), vw = useVw();
  const all = sessions(), days = byDay(all), now = Date.now();
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1), lead = (first.getDay() + 6) % 7, nDays = new Date(y, mo, 0).getDate();
  const today = dayKey(now);
  const cw = (Math.min(vw(1, 0, 9999) - 32, 576) - 6 * 4) / 7;
  const cells = [];
  for (let k = 0; k < lead; k++) cells.push(null);
  for (let d = 1; d <= nDays; d++) cells.push(`${y}-${pad2(mo)}-${pad2(d)}`);
  while (cells.length % 7) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const label = (t, on) => {
    const fs = Math.max(7.5, Math.min(10.5, (cw - 6) / Math.max(1, t.length * 0.58)));
    return <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ maxWidth: cw - 4, fontFamily: F.bodyB, fontSize: fs, letterSpacing: 0.2, color: on ? th.hubInk : th.ink }}>{t}</Text>;
  };
  return (
    <View accessibilityLabel="Workout days" style={{ marginTop: 16, gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Text key={i} accessibilityElementsHidden style={{ flex: 1, textAlign: 'center', fontFamily: F.bodyB, fontSize: 12, color: th.ink3 }}>{d}</Text>)}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 4 }}>
          {r.map((k, ci) => {
            if (!k) return <View key={ci} style={{ flex: 1, aspectRatio: 1 / 1.08 }} />;
            const ss = days.get(k);
            const pl = !ss ? plannedOn(k, days, now) : [];
            const w = !!ss, plan = pl.length > 0, isSel = all.length && k === sel, isToday = k === today;
            const name = ss ? ss[0].day : plan ? pl[0].name : '';
            return (
              <View key={ci} accessible accessibilityLabel={`${shortDay(k)}${ss ? ': ' + ss.map((x) => x.day).join(', ') : plan ? ': planned, ' + U.list(pl.map((p) => p.label)) : ''}${isSel ? ', picked' : ''}`}
                style={{ flex: 1, aspectRatio: 1 / 1.08, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 1,
                  backgroundColor: w ? th.hubBg : 'transparent', borderWidth: plan ? 2 : isToday && !w ? 1.5 : 0, borderColor: plan ? th.ink3 : th.line }}>
                {isSel ? <View pointerEvents="none" style={{ position: 'absolute', left: -4, top: -4, right: -4, bottom: -4, borderRadius: 15, borderWidth: 3, borderColor: th.accent }} /> : null}
                <Text style={{ fontFamily: F.bodyB, fontSize: 15, color: w ? th.hubInk : plan ? th.ink : th.ink2, fontVariant: ['tabular-nums'] }}>{Number(k.slice(8))}</Text>
                {name ? label(name, w) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
function calContent() {
  const all = sessions(), days = byDay(all);
  const [y, mo] = calMonth.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const plan = [0, 1, 2, 3, 4, 5, 6].filter((d) => CH.routines.onDay(d).length);
  const inMonth = Array.from(days.keys()).filter((k) => k.startsWith(calMonth)).sort();
  const monthName = first.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const selHere = monthOf(calSel) === calMonth;
  view('calendar', (
    <View>
      {topbar('')}
      <Head kick="Calendar" title={monthName} meta={!all.length ? `${plan.length ? 'Your planned days are marked with their workout. ' : ''}Every workout you log shows here on its day.` : `${U.plural(inMonth.length, 'workout day')} this month · ${U.plural(all.length, 'workout')} in all`} />
      <CalGrid month={calMonth} sel={calSel} />
      {plan.length ? <Dim style={{ marginTop: 8, fontSize: 14 }}>Outlined: a planned day, with the workout that falls on it.</Dim> : null}
      {!all.length ? null : selHere ? <DayDetail k={calSel} /> : <MonthList keys={inMonth} name={monthName} />}
      {all.length ? <Dim style={{ marginTop: 14, fontSize: 14 }}>Dates slides back through your workouts. Tap the button on a day to chart one of its exercises. Earlier and Next change the month.</Dim> : null}
    </View>
  ));
}
// Another month than the day picked: its workout days in a list.
function MonthList({ keys, name }) {
  const days = byDay(sessions());
  return (
    <View>
      <Sec>{name}</Sec>
      {!keys.length ? <Dim style={{ fontSize: 14 }}>No workouts this month.</Dim> : keys.slice().reverse().map((k) => {
        const ss = days.get(k);
        const n = ss.reduce((t, s) => t + s.sets.filter((x) => !x.wu).length, 0);
        return <Pair key={k} name={`${shortDay(k)} · ${U.list(ss.map((x) => x.day))}`} value={U.plural(n, 'set')} size={17} />;
      })}
    </View>
  );
}
/* Fix 2: while Dates is open, the reading side shows the picked day's week and what was done that
   day, so sliding through the dates reads as a calendar, not a list. */
function WeekStrip({ k }) {
  const th = useTheme();
  const days = byDay(sessions()), now = Date.now(), today = dayKey(now);
  const mon = addDays(k, -((keyDate(k).getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return (
    <View style={{ flexDirection: 'row', gap: 3, marginTop: 8 }}>
      {week.map((d, i) => {
        const ss = days.get(d), pl = !ss ? plannedOn(d, days, now) : [];
        const w = !!ss, plan = pl.length > 0, sel = d === k;
        return (
          <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 9, backgroundColor: w ? th.hubBg : 'transparent', borderWidth: sel ? 2.5 : plan ? 1.5 : d === today ? 1 : 0, borderColor: sel ? th.accent : plan ? th.ink3 : th.line }}>
            <Text style={{ fontFamily: F.bodyB, fontSize: 10.5, color: w ? th.hubInk : th.ink3 }}>{'MTWTFSS'[i]}</Text>
            <Text style={{ fontFamily: F.bodyB, fontSize: 14, color: w ? th.hubInk : th.ink, fontVariant: ['tabular-nums'] }}>{Number(d.slice(8))}</Text>
          </View>
        );
      })}
    </View>
  );
}
function DatePanel({ k }) {
  const th = useTheme();
  return (
    <View>
      <Text style={{ fontFamily: F.bodyB, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: th.ink3 }}>Calendar · {keyDate(k).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</Text>
      <WeekStrip k={k} />
      <DayDetail k={k} compact />
    </View>
  );
}
function dateMenu() {
  const days = byDay(sessions());
  const keys = Array.from(days.keys()).sort().reverse();
  const options = keys.map((k) => ({ key: k, label: shortDay(k), short: tinyDay(k), sub: U.list(days.get(k).map((x) => x.day)), icon: 'next', act: () => CH.scrub.open(dayExercisesMenu(k), 'hub', 'sticky') }));
  return {
    title: 'Calendar', compact: true, window: 3, options, start: Math.max(0, keys.indexOf(calSel)),
    panel: (o) => (o && o.key ? <DatePanel k={o.key} /> : null),
    onMove: (o) => { if (o.key && calSel !== o.key) { calSel = o.key; calMonth = monthOf(o.key); calContent(); } },
  };
}
function dayExercisesMenu(k) {
  const ss = byDay(sessions()).get(k) || [];
  const ids = [];
  ss.forEach((x) => x.sets.forEach((y) => { if (!y.wu && !y.c && !ids.includes(y.ex)) ids.push(y.ex); }));
  const options = ids.map((id) => {
    const sets = [];
    ss.forEach((x) => x.sets.forEach((y) => { if (!y.wu && y.ex === id) sets.push(y); }));
    return { label: exName(id), sub: setsText(sets), icon: 'progress', info: `<p>${U.esc(longDay(k))}: ${U.esc(setsText(sets))}.</p><p>Tap the button to see ${U.esc(exName(id).toLowerCase())} over time, with this day marked.</p>`, act: () => openLift(id, k) };
  });
  // Putting a saved workout right: any set's weight, reps or warm-up, or delete it.
  ss.forEach((rec) => options.push({ label: `Change ${rec.day}`, short: 'Change', sub: `${U.plural(rec.sets.length, 'set')} · fix a weight or reps`, icon: 'edit', info: `<p>Change any set in ${U.esc(rec.day)} on ${U.esc(longDay(k))}: its weight, reps or warm-up, or delete it. Progress and charts follow.</p>`, act: () => changeSaved(rec, k) }));
  options.push({ label: 'Back to dates', sub: shortDay(k), icon: 'back', act: () => CH.scrub.open(dateMenu(), 'hub', 'sticky') });
  return { title: shortDay(k), options, start: 0 };
}
function changeSaved(rec, k) {
  calSel = k; calMonth = monthOf(k);
  const back = () => { CH.stage.closeList(); renderCalendar(); };
  const after = () => {
    if (rec.sets.length) S().upsert(rec);
    else { S().remove((x) => x.id === rec.id); toast(`${U.esc(rec.day)} had no sets left, so it's gone from your history.`); }
    calContent();
  };
  CH.session.editSets(rec, back, after);
}

/* ---------------- one exercise over time ----------------
   Its best each workout, measured one of these ways (the first that fits is the default):
   estimated max from sets of 10 reps or fewer, heaviest weight, most reps, or for an assisted
   lift the least help. Every workout is in the table; one with no set the measure can use is
   listed there but left off the line. Sessions slides along the line. */
let lift = { ex: null, key: null, i: 0, kind: null };
function openLift(exId, key) { lift = { ex: exId, key: key || null, i: 0, kind: null }; show('lift'); }
function liftSeries(exId, want) {
  const ex = D().ex(exId) || {};
  const rows = sessions().map((s) => ({ s, sets: s.sets.filter((x) => !x.wu && x.ex === exId) })).filter((x) => x.sets.length);
  const loaded = rows.some((x) => x.sets.some((y) => y.w > 0));
  const anyE = loaded && rows.some((x) => x.sets.some((y) => y.w > 0 && E().e1rm(y.w, y.r) > 0));
  const kinds = ex.assist ? ['help', 'reps'] : loaded ? (anyE ? ['e1rm', 'top', 'reps'] : ['top', 'reps']) : ['reps'];
  const kind = kinds.includes(want) ? want : kinds[0];
  const all = rows.map(({ s, sets }) => {
    let v = null, src = null;
    if (kind === 'e1rm') sets.forEach((y) => { const e = y.w > 0 ? E().e1rm(y.w, y.r) : 0; if (e > 0 && (v == null || e > v)) { v = e; src = y; } });
    else if (kind === 'top') { src = sets.slice().sort((a, b) => b.w - a.w || b.r - a.r)[0]; v = src.w > 0 ? src.w : null; }
    else if (kind === 'help') { src = sets.slice().sort((a, b) => a.w - b.w || b.r - a.r)[0]; v = src.w; }
    else { src = sets.slice().sort((a, b) => b.r - a.r || b.w - a.w)[0]; v = src.r; }
    return { t: s.start, key: dayKey(s.start), v, src, sets };
  });
  return { kind, kinds, all, pts: all.filter((p) => p.v != null), lower: kind === 'help' };
}
const liftFmt = (kind, v) => (kind === 'reps' ? `${Math.round(v)} reps` : kind === 'help' ? (v > 0 ? `${U.kg(v)} kg help` : 'No help') : `${U.kg(Math.round(v * 2) / 2)} kg`);
const liftName = { e1rm: 'Estimated max', top: 'Heaviest weight', reps: 'Most reps in a set', help: 'Least help' };
const liftHow = { e1rm: 'From your best set of 10 reps or fewer', top: 'The heaviest set each workout', reps: 'The most reps in one set', help: 'Less help is progress' };
function renderLift() {
  if (!lift.ex) { show('calendar'); return; }
  const ser = liftSeries(lift.ex, lift.kind);
  const at = ser.pts.findIndex((p) => p.key === lift.key);
  lift.i = at >= 0 ? at : ser.pts.length - 1;
  liftContent();
  CH.stage.set({
    hub: ser.pts.length > 1 ? { label: 'Sessions', sub: 'slide', icon: 'progress', primary: true, menu: liftMenu } : { label: 'Exercises', sub: 'charts', icon: 'progress', primary: true, menu: exercisesMenu },
    rim: [
      { icon: 'week', label: 'Calendar', prio: 1, act: () => show('calendar') },
      ser.kinds.length > 1 ? { icon: 'light', label: 'Measure', prio: 3, menu: measureMenu, row: { label: 'Measure', value: liftName[ser.kind], sub: 'Estimated max, heaviest or most reps' } } : null,
      { icon: 'progress', label: 'Exercises', prio: 1, menu: exercisesMenu, row: { label: 'Another exercise', sub: 'Every exercise you have logged' } },
      { icon: 'today', label: 'Home', prio: 2, act: () => show('today') },
    ].filter(Boolean),
  });
}
function measureMenu() {
  const ser = liftSeries(lift.ex, lift.kind);
  return { title: `Measure ${exName(lift.ex).toLowerCase()} by`, options: ser.kinds.map((k) => ({ label: liftName[k], short: liftName[k].split(' ').pop(), sub: liftHow[k], icon: 'progress', act: () => { lift.kind = k; renderLift(); } })), start: Math.max(0, ser.kinds.indexOf(ser.kind)) };
}
function LiftTable({ ser, p }) {
  const th = useTheme();
  const head = ser.kind === 'e1rm' ? 'Est. max' : ser.kind === 'top' ? 'Heaviest' : ser.kind === 'help' ? 'Least help' : 'Most';
  const cell = { fontFamily: F.body, fontSize: 14, lineHeight: 19, color: th.ink, fontVariant: ['tabular-nums'] };
  return (
    <View>
      <View style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: th.line }}>
        {['Date', 'Sets', head].map((h, i) => <Text key={h} style={{ width: i === 0 ? 92 : undefined, flex: i === 1 ? 1 : undefined, textAlign: i === 2 ? 'right' : 'left', fontFamily: F.bodyB, fontSize: 12, color: th.ink3 }}>{h}</Text>)}
      </View>
      {ser.all.slice().reverse().map((q, i) => {
        const sel = q === p;
        const c = sel ? [cell, { fontFamily: F.bodyB }] : cell;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: th.line2 }}>
            <Text style={[c, { width: 92 }]}>{shortDay(q.key)}</Text>
            <Text style={[c, { flex: 1, paddingHorizontal: 10, color: sel ? th.ink : th.ink2 }]}>{setsText(q.sets)}</Text>
            <Text style={[c, { textAlign: 'right' }]}>{q.v == null ? '—' : liftFmt(ser.kind, q.v)}</Text>
          </View>
        );
      })}
    </View>
  );
}
// A single line: 2 pt, round joins, points with a surface ring, the picked one in the accent and
// labelled; three quiet gridlines. Time runs left to right on a real date scale.
function LiftChart({ ser, sel }) {
  const th = useTheme();
  const pts = ser.pts, W = 340, H = 190, L = 44, R = 12, T0 = 18, B0 = 26;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 2) { hi += 1; lo -= 1; }
  const padV = (hi - lo) * 0.12; lo -= padV; hi += padV;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const x = (t) => (pts.length === 1 ? L + (W - L - R) / 2 : L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R));
  const y = (v) => T0 + (1 - (v - lo) / (hi - lo)) * (H - T0 - B0);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + U.f1(x(p.t)) + ' ' + U.f1(y(p.v))).join(' ');
  const s = pts[sel], sx = x(s.t), sy = y(s.v);
  const lab = liftFmt(ser.kind, s.v), lw = lab.length * 7.4 + 12;
  const lx = U.clamp(sx - lw / 2, L, W - R - lw), ly = sy - 32 < 2 ? sy + 12 : sy - 32;
  const ax = { fill: th.ink3, fontSize: 11, fontFamily: F.bodyB };
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${liftName[ser.kind]} for ${exName(lift.ex)}, ${pts.length} workouts, from ${liftFmt(ser.kind, pts[0].v)} to ${liftFmt(ser.kind, pts[pts.length - 1].v)}`} style={{ marginTop: 14, width: '100%', aspectRatio: W / H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((f) => { const v = lo + (hi - lo) * f, yy = y(v); return (
          <React.Fragment key={f}>
            <Line x1={L} x2={W - R} y1={yy} y2={yy} stroke={th.line} strokeWidth={1} />
            <SvgText x={L - 6} y={yy + 4} textAnchor="end" {...ax}>{ser.kind === 'reps' ? String(Math.round(v)) : U.kg(Math.round(v))}</SvgText>
          </React.Fragment>
        ); })}
        {pts.length > 1 ? <Path d={d} fill="none" stroke={th.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
        <Line x1={sx} x2={sx} y1={T0} y2={H - B0} stroke={th.ink3} strokeWidth={1} strokeDasharray="3 3" />
        <Rect x={lx} y={ly} width={lw} height={22} rx={6} fill={th.hubBg} />
        <SvgText x={lx + lw / 2} y={ly + 15} textAnchor="middle" fill={th.hubInk} fontSize={12.5} fontFamily={F.bodyB}>{lab}</SvgText>
        {pts.map((p, i) => <Circle key={i} cx={x(p.t)} cy={y(p.v)} r={i === sel ? 6 : 4} fill={i === sel ? th.accent : th.ink} stroke={th.bg} strokeWidth={2} />)}
        <SvgText x={L} y={H - 6} {...ax}>{shortDay(pts[0].key)}</SvgText>
        {pts.length > 1 ? <SvgText x={W - R} y={H - 6} textAnchor="end" {...ax}>{shortDay(pts[pts.length - 1].key)}</SvgText> : null}
      </Svg>
    </View>
  );
}
function liftContent() {
  const ser = liftSeries(lift.ex, lift.kind), pts = ser.pts, p = pts[lift.i];
  const kick = `${liftName[ser.kind]} · each workout`;
  if (!pts.length) {
    view('lift', <View>{topbar('')}<Head kick={kick} title={exName(lift.ex)} meta={ser.all.length ? 'No workout has a set this measure can use. Try another measure.' : 'Nothing logged for this exercise yet.'} /></View>);
    return;
  }
  const firstP = pts[0], lastP = pts[pts.length - 1];
  const best = pts.reduce((a, b) => ((ser.lower ? b.v < a.v : b.v > a.v) ? b : a));
  const diff = lastP.v - firstP.v, better = ser.lower ? diff < -0.5 : diff > 0.5, worse = ser.lower ? diff > 0.5 : diff < -0.5;
  const change = ser.lower ? (better ? 'Less help by ' : worse ? 'More help by ' : 'Level at ') : (better ? 'Up ' : worse ? 'Down ' : 'Level at ');
  const meta = pts.length > 1 ? `${change}${better || worse ? (ser.kind === 'help' ? U.kg(Math.abs(diff)) + ' kg' : liftFmt(ser.kind, Math.abs(diff))) + ' ' : ''}since ${shortDay(firstP.key)} · best ${liftFmt(ser.kind, best.v)}` : 'One workout so far. The line starts with the next.';
  const off = ser.all.length - pts.length;
  view('lift', (
    <View>
      {topbar('')}
      <Head kick={kick} title={exName(lift.ex)} meta={meta} />
      {off ? <Dim style={{ marginTop: 6, fontSize: 14 }}>{U.plural(off, 'workout')} had no set this measure can use ({ser.kind === 'e1rm' ? 'all over 10 reps' : 'no weight'}), so {off === 1 ? "it's" : "they're"} in the table but not on the line.</Dim> : null}
      <LiftChart ser={ser} sel={lift.i} />
      <Card style={{ marginTop: 10, paddingVertical: 10, gap: 2 }}>
        <B style={{ fontSize: 16 }}>{longDay(p.key)}</B>
        <Dim style={{ fontSize: 15 }}>{liftFmt(ser.kind, p.v)}{ser.kind === 'e1rm' ? ` from ${setsText([p.src])}` : ''} · {setsText(p.sets)}</Dim>
      </Card>
      <Sec>Every workout</Sec>
      <LiftTable ser={ser} p={p} />
    </View>
  ));
}
function liftMenu() {
  const ser = liftSeries(lift.ex, lift.kind);
  const options = ser.pts.map((p, i) => ({ i, label: shortDay(p.key), short: tinyDay(p.key), sub: `${liftFmt(ser.kind, p.v)} · ${setsText(p.sets)}`, icon: 'week', act: () => { lift.key = p.key; calSel = p.key; calMonth = monthOf(p.key); show('calendar'); } })).reverse();
  return { title: exName(lift.ex), compact: true, window: 3, options, start: Math.max(0, ser.pts.length - 1 - lift.i), onMove: (o) => { if (lift.i !== o.i) { lift.i = o.i; lift.key = ser.pts[o.i].key; liftContent(); } } };
}
function exercisesMenu() {
  const all = sessions(), last = new Map(), n = new Map();
  all.forEach((s) => new Set(s.sets.filter((x) => !x.wu && !x.c).map((x) => x.ex)).forEach((id) => { last.set(id, s.start); n.set(id, (n.get(id) || 0) + 1); }));
  const ids = Array.from(last.keys()).sort((a, b) => last.get(b) - last.get(a));
  return { title: 'Charts by exercise', options: ids.map((id) => ({ label: exName(id), sub: `${U.plural(n.get(id), 'workout')} · last ${U.ago(last.get(id))}`, icon: 'progress', act: () => openLift(id, null) })), start: Math.max(0, ids.indexOf(lift.ex)) };
}
function renameRoutine(r, back) {
  askText({ title: 'Name this routine', value: r.name, max: 40, done: (v) => {
    if (v && v !== r.name) { r.name = CH.routines.list().some((x) => x !== r && x.name.toLowerCase() === v.toLowerCase()) ? CH.routines.freeName(v) : v; S().save(); toast(`Renamed to ${U.esc(r.name)}.`); }
    refresh();
  }, cancel: back });
}

/* ---------------- Routines: every routine, and the week ----------------
   The page lists each routine (its days, its workouts, any cardio, when it was last done) under the
   week plan: which routine goes on which day. The button holds the routines (each with its own
   choices: train it, its days, rename, add cardio, change it, review, delete), Plan the week, and
   the two ways to make one: a weights routine or a cardio routine. */
const DOW3 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const isC = (r) => CH.routines.isCardio(r);
const dayNames = (d) => CH.routines.onDay(d).map((x) => x.name);
function routineWhat(r) {
  const items = r.days.flatMap((d) => d.items), cardio = items.filter((it) => it.cardio);
  if (!r.days.length) return 'No workouts yet';
  if (isC(r)) return U.list(cardio.map((it) => `${exName(it.ex).toLowerCase()}, ${it.min} min`)).replace(/^./, (c) => c.toUpperCase());
  const head = r.days.length === 1 ? `${U.plural(items.length - cardio.length, 'exercise')}` : `${U.plural(r.days.length, 'workout')} that take turns: ${U.list(r.days.map((d) => d.name))}`;
  return head + (cardio.length ? ` · with cardio (${U.list(Array.from(new Set(cardio.map((it) => exName(it.ex).toLowerCase()))))})` : '');
}
const daysText = (r) => (r.week && r.week.days && r.week.days.length ? CH.setup.weekText(r.week) : r.week && r.week.n ? CH.setup.weekText(r.week) : 'Any day');
function WeekPlan({ t }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: th.line }}>
      {DOW3.map((dname, d) => {
        const names = dayNames(d), today = d === t;
        return (
          <View key={d} style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: th.line }}>
            <View style={{ width: 92, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontFamily: F.bodyB, fontSize: 16, color: today ? th.ink : th.ink2 }}>{dname}</Text>
              {today ? <Text style={{ fontFamily: F.bodyB, fontSize: 11.5, color: th.ink3 }}>today</Text> : null}
            </View>
            <Text style={{ flex: 1, fontFamily: today && names.length ? F.bodyB : F.body, fontSize: 16, color: names.length ? th.ink : th.ink3 }}>{names.length ? names.join(' + ') : 'Rest'}</Text>
          </View>
        );
      })}
    </View>
  );
}
function RoutineCard({ r, on, last, cur }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: th.line }}>
      <H2 after={<>{on ? <Chip>Today</Chip> : null}{isC(r) ? <Chip>Cardio</Chip> : null}</>}>{r.name}</H2>
      <Text style={{ marginTop: 2, fontFamily: F.bodyB, fontSize: 16, color: th.ink }}>{daysText(r)}</Text>
      <Text style={{ marginTop: 4, fontFamily: F.body, fontSize: 16, lineHeight: 23, color: th.ink2 }}>{routineWhat(r)}</Text>
      <Text style={{ marginTop: 4, fontFamily: F.body, fontSize: 14, color: th.ink3 }}>{last}{cur}</Text>
    </View>
  );
}
// `pageOnly` redraws the page behind an open wheel without touching the button.
function renderRoutines(pageOnly) {
  const list = CH.routines.list(), all = sessions(), now = Date.now(), t = dow(now);
  const cur = CH.routines.active();
  view('routines', (
    <View>
      {topbar('')}
      <Head kick="Routines" title={list.length ? (list.length === 1 ? 'Your routine' : `Your ${list.length} routines`) : 'No routines yet'}
        meta={!list.length ? 'Make one with the button: a weights routine, or a cardio routine (a walk, run, ride or row). You can have as many as you like, and put each on its own days.' : 'Put each routine on the days you train it. Home then shows the one for today.'} />
      {list.length ? (
        <>
          <Sec>Your week</Sec>
          <WeekPlan t={t} />
          {!list.some((r) => r.week && r.week.days && r.week.days.length) ? <Dim style={{ marginTop: 8, fontSize: 14 }}>No routine is on a day yet. Routines › Plan the week puts them on.</Dim> : null}
          {list.map((r) => {
            const ld = lastIn(r, all), on = r.week && r.week.days && r.week.days.includes(t);
            return <RoutineCard key={r.id} r={r} on={on} last={ld ? `Last done ${U.ago(ld.start, now)}` : 'Not done yet'} cur={r === cur && list.length > 1 ? ' · the one Home falls back on' : ''} />;
          })}
        </>
      ) : null}
    </View>
  ));
  if (pageOnly === true) return;
  CH.stage.set({ hub: { label: list.length ? 'Routines' : 'New', sub: list.length ? 'choose one' : 'routine', icon: list.length ? 'stack' : 'plus', primary: true, menu: routinesMenu }, rim: nav('routines') });
}
const wheel = (spec) => CH.scrub.open(spec, 'hub', 'sticky');
function routinesMenu() {
  const list = CH.routines.list(), t = dow(Date.now());
  const sorted = list.slice().sort((a, b) => (b.week && b.week.days && b.week.days.includes(t) ? 1 : 0) - (a.week && a.week.days && a.week.days.includes(t) ? 1 : 0));
  const options = [
    { label: 'New routine', sub: 'Weights: pick a plan, then exercises', icon: 'plus', info: '<p>Pick a plan, then choose its exercises one body part at a time. Add cardio to it whenever you like.</p>', act: () => CH.setup.newRoutine() },
    { label: 'New cardio routine', sub: 'A walk, run, ride or row of its own', icon: 'flag', info: '<p>Pick the kind, the machine, its settings and the time. Then put it on its own days, or on the same day as a weights routine.</p>', act: () => CH.setup.newCardioRoutine('routines') },
  ];
  if (list.length) options.push({ label: 'Plan the week', sub: weekSummary(), icon: 'week', info: weekInfo(), act: () => wheel(weekMenu()) });
  const first = options.length;
  sorted.forEach((r) => options.push({ label: r.name, sub: `${daysText(r)} · ${isC(r) ? 'cardio' : r.days.length === 1 ? 'one workout' : U.plural(r.days.length, 'workout')}`, icon: isC(r) ? 'flag' : 'stack', info: `<p>${U.esc(routineWhat(r))}.</p>${routineInfo(r, sessions())}`, act: () => wheel(routineMenu(r)) }));
  return { title: 'Routines', options, start: list.length ? first : 0, coach: list.length ? 'Choose a routine for its choices: train it, its days, rename it, add cardio. Plan the week is here too.' : undefined };
}
function weekSummary() {
  const on = [0, 1, 2, 3, 4, 5, 6].filter((d) => dayNames(d).length);
  return on.length ? `${on.length} day${on.length === 1 ? '' : 's'} planned: ${on.map((d) => DOW3[d]).join(' · ')}` : 'Which routine on which day';
}
const weekInfo = () => `<dl>${[0, 1, 2, 3, 4, 5, 6].map((d) => `<dt>${DOW_LONG[d]}</dt><dd>${U.esc(dayNames(d).join(' + ') || 'Rest')}</dd>`).join('')}</dl>`;
// One routine's choices.
function routineMenu(r) {
  const d = r.days[Math.min(r.next, Math.max(0, r.days.length - 1))];
  const built = r.days.some((x) => x.items.length);
  const back = () => wheel(routineMenu(r));
  const options = [
    { label: 'Train it now', sub: !built ? 'Nothing in it yet' : r.days.length === 1 ? U.plural(d.items.length, 'exercise') : `Next: ${d.name}`, icon: 'play', off: !built, info: routineInfo(r, sessions()), act: () => { if (r.days.length === 1) { CH.routines.activate(r.id); CH.session.start(0, r.id); } else wheel(dayMenu(r)); } },
    { label: 'Days', sub: daysText(r), title: `${r.name}: which days?`, icon: 'week', info: '<p>The days you train this routine. Home shows it on those days, and the Calendar marks them. Plan the week shows every routine\'s days together.</p>', act: () => wheel(CH.setup.attachMenu(r.id, () => { show('routines'); toast(`${U.esc(r.name)}: ${U.esc(daysText(r).toLowerCase() === 'any day' ? 'any day' : daysText(r))}.`); })) },
    { label: 'Rename', sub: r.name, icon: 'edit', info: '<p>Type a new name for this routine.</p>', act: () => renameRoutine(r, back) },
    { label: isC(r) ? 'Add more cardio' : 'Add cardio', sub: isC(r) ? 'Another machine or type' : 'Before or after the weights', icon: 'flag', info: '<p>Walk, run, cycle, row, stairs, cross-trainer, ski erg or swim: the type, the machine, its settings and the time.</p>', act: () => addCardioTo(r, back) },
    { label: 'See and change it', sub: 'Workouts, exercises, sets and reps', icon: 'edit', act: () => { planRid = r.id; CH.stage.closeList(); show('plan'); } },
    { label: 'Review it', sub: 'What to keep, what to change', icon: 'check', act: () => { reviewRid = r.id; CH.stage.closeList(); show('review'); } },
    { label: `Delete ${r.name}`, sub: 'Logged workouts are kept', icon: 'trash', danger: true, act: () => deleteOne(r, back) },
  ];
  return { title: r.name, options, start: built ? 0 : 1 };
}
// Cardio into one of a routine's workouts (asked which, if it has more than one).
function addCardioTo(r, back) {
  if (!r.days.length) {
    r.days.push({ id: U.id(), name: 'Cardio', parts: ['cardio'], items: [] });
    S().save();
  }
  if (r.days.length === 1) { CH.setup.addCardioTo(r.id, 0, current === 'plan' ? 'plan' : 'routines'); return; }
  wheel({ title: `${r.name}: cardio in which workout?`, options: r.days.map((d, i) => ({ label: d.name, sub: d.items.length ? U.plural(d.items.length, 'exercise') : 'Nothing yet', icon: 'next', act: () => CH.setup.addCardioTo(r.id, i, current === 'plan' ? 'plan' : 'routines') })), start: Math.min(r.next, r.days.length - 1), onClose: back });
}
function deleteOne(r, back) {
  if (st().active && st().active.routineId === r.id) { toast('Finish or discard the workout from it first.'); return; }
  CH.stage.list({
    title: `Delete ${r.name}?`,
    rows: [{ label: 'Delete routine', sub: 'Logged workouts and progress are kept', icon: 'trash', danger: true, act: () => { const n = r.name; CH.routines.remove(r.id); if (planRid === r.id) planRid = null; CH.stage.closeList(); toast(`Deleted ${U.esc(n)}.`); show(CH.routines.list().length ? 'routines' : 'today'); } }],
    cancel: 'Keep it', cancelIcon: 'back', onCancel: back,
  });
}
/* Plan the week: a wheel of the seven days, Monday at the top (each says what's on it), then a
   day's own wheel to tick its routines on and off. A day can hold more than one: weights, then a
   run. Rest day takes everything off it. */
function weekMenu() {
  const t = dow(Date.now());
  const options = [{ label: 'Done', sub: weekSummary(), icon: 'check', back: true, info: weekInfo(), act: () => { const on = [0, 1, 2, 3, 4, 5, 6].filter((x) => dayNames(x).length); show('routines'); toast(on.length ? `Your week: ${on.map((x) => DOW3[x]).join(' · ')}.` : 'No routine is on a day yet.'); } }];
  /* A rolling week with today in the middle (four days before it above, two after it below, then
     Done), so the days read in order from the top and sit evenly either side of the lit one. */
  for (let k = 2; k >= -4; k--) {
    const d = (t + k + 7) % 7;
    const names = dayNames(d);
    options.push({ label: `${DOW3[d]}: ${names.length ? names.join(' + ') : 'rest'}`, title: DOW_LONG[d], sub: names.length ? `${U.plural(names.length, 'routine')}${d === t ? ' · today' : ''}` : `Rest day${d === t ? ' · today' : ''}`, icon: 'week', info: names.length ? `<ul>${CH.routines.onDay(d).map((x) => `<li>${U.esc(x.name)}<span>${isC(x) ? 'cardio' : U.plural(x.days.length, 'workout')}</span></li>`).join('')}</ul>` : '<p>Nothing on this day. Choose it to put a routine on it.</p>', act: () => wheel(dayPlanMenu(d)) });
  }
  return { title: 'Plan the week', options, start: 3, keep: true, ordered: true, coach: 'Choose a day, then tick its routines. A day can have more than one.' };
}
function dayPlanMenu(d) {
  const list = CH.routines.list(), on = CH.routines.onDay(d);
  const again = () => { CH.haptic('select'); if (current === 'routines') renderRoutines(true); CH.scrub.stay(dayPlanMenu(d)); };
  const options = [{ label: 'Rest day', value: on.length ? '' : '✓', sub: on.length ? `Take ${U.list(on.map((x) => x.name))} off ${DOW_LONG[d]}` : `Nothing on ${DOW_LONG[d]}`, icon: 'week', act: () => { on.forEach((x) => CH.routines.setDay(x, d, false)); again(); } }];
  list.forEach((r) => {
    const has = on.includes(r);
    options.push({ label: r.name, value: has ? '✓' : '', sub: has ? `On ${DOW_LONG[d]} · choose it again to take it off` : `Choose it to put it on ${DOW_LONG[d]}`, icon: isC(r) ? 'flag' : 'stack', info: `<p>${U.esc(routineWhat(r))}.</p><p>Its days now: ${U.esc(daysText(r))}.</p>`, act: () => { CH.routines.setDay(r, d, !has); again(); } });
  });
  return { title: `${DOW_LONG[d]}: which routines?`, options, start: on.length ? options.findIndex((o) => o.value === '✓' && o.label !== 'Rest day') : list.length ? 1 : 0, keep: true, coach: 'Choose each routine for this day: it gets a tick. Choose it again to take it off. Go back when done.' };
}

/* ---------------- end of workout ---------------- */
function PRList({ prs }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      {prs.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: th.accentSoft }}>
          <Icon name="star" size={22} color={th.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyB, fontSize: 16, color: th.ink }}>{exName(p.ex)}</Text>
            <Text style={{ fontFamily: F.bodyB, fontSize: 13, color: th.accent }}>{p.kind === 'e1rm' ? 'best estimate yet' : 'rep PR'}</Text>
          </View>
          <Text style={{ fontFamily: F.display, fontSize: 22, color: th.ink, fontVariant: ['tabular-nums'] }}>{p.w > 0 ? U.kg(p.w) + ' kg × ' : ''}{p.r}{p.w > 0 ? '' : ' reps'}</Text>
        </View>
      ))}
    </View>
  );
}
function CList({ items }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {items.map((x, i) => (
        <Card key={i} style={{ gap: 2 }}>
          <Text style={{ fontFamily: F.display, fontSize: 20, color: th.ink }}>{x.name}</Text>
          <Text style={{ fontFamily: F.body, fontSize: 16, color: th.ink2 }}>{x.v}</Text>
        </Card>
      ))}
    </View>
  );
}
function summary(rec, prs) {
  current = 'done';
  viewAtom.set({ name: 'done', rev: viewAtom.get().rev + 1 });
  const all = sessions(), now = Date.now();
  const work = rec.sets.filter((x) => !x.wu && !x.c), cardio = rec.sets.filter((x) => x.c);
  const week = E().muscleSets(all, now - 7 * DAY, now + 1);
  const today = E().muscleSets([rec], rec.start - 1, rec.start + 1);
  const hit = D().MUSCLES.filter((m) => today[m.id] > 0 && st().settings.tracked.includes(m.id)).sort((a, b) => today[b.id] - today[a.id]);
  const cMin = Math.round(cardio.reduce((t, x) => t + (x.s || 0), 0) / 60);
  const meta = [U.mins(rec.end - rec.start), work.length ? U.plural(work.length, 'working set') : '', work.length ? U.plural(new Set(work.map((x) => x.ex)).size, 'exercise') : '', cMin ? `${cMin} min cardio` : ''].filter(Boolean).join(' · ');
  view('done', (
    <View>
      {topbar('Workout saved')}
      <Head kick="Workout done" title={rec.day} meta={meta} />
      {cardio.length ? (
        <>
          <Sec>Cardio</Sec>
          <CList items={cardio.map((x) => ({ name: exName(x.ex), v: CH.cardio.entryText(x, true) }))} />
          <Dim style={{ marginTop: 8, fontSize: 14 }}>{cardioWeek(CH.cardio.minutes(all, now - 7 * DAY, now + 1))}</Dim>
        </>
      ) : null}
      {!work.length && cardio.length ? null : prs.length ? (
        <><Sec>Personal records</Sec><PRList prs={prs} /></>
      ) : <Glance>No PRs today. Same weights next time, one more rep where you can.</Glance>}
      {work.length ? (
        <>
          <Sec>Sets per muscle</Sec>
          <Dim style={{ fontSize: 14, marginBottom: 10 }}>Today, then the last 7 days. Four a week is the smallest dose shown to grow muscle.</Dim>
          <Bars ids={hit.map((m) => m.id)} week={week} today={today} />
        </>
      ) : null}
    </View>
  ));
  CH.stage.set({ hub: { label: 'Close', icon: 'check', primary: true, act: () => show('today') }, rim: nav('') });
}

// A week's cardio against Australia's guideline: 150–300 minutes moderate, or half that hard.
function cardioWeek(m) {
  const hard = m.weighted > m.all ? ` (${m.weighted} with hard minutes counted twice)` : '';
  return `${m.all} min of cardio in the last 7 days${hard}. The guideline is 150 to 300 a week at a steady pace, or half that if it's hard.`;
}

/* ---------------- charts ---------------- */
// Horizontal bars against the 4–10 band. Neutral ink when covered; the warning colour and a word when under 4.
function Bars({ ids, week, today }) {
  const th = useTheme();
  const max = Math.max(12, ...ids.map((id) => week[id] || 0));
  const pct = (v) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <View style={{ marginTop: 4, gap: 7 }}>
      {ids.map((id) => {
        const v = week[id] || 0, under = v < 4;
        return (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text numberOfLines={1} style={{ width: 112, fontFamily: under ? F.bodyB : F.body, fontSize: 14.5, color: under ? th.warn : th.ink }}>{D().muscle(id).name}</Text>
            <View accessible accessibilityLabel={`${D().muscle(id).name}: ${U.sets(v)} sets${under ? ', under 4' : ''}`} style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: th.line2, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: pct(4), width: pct(6), backgroundColor: th.band }} />
              {today ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(today[id] || 0), backgroundColor: th.accentSoft }} /> : null}
              <View style={{ position: 'absolute', left: 0, top: 3, bottom: 3, width: pct(v), borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: under ? th.warn : th.ink2 }} />
            </View>
            <View style={{ width: 84, flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: F.display6, fontSize: 18, color: th.ink, fontVariant: ['tabular-nums'] }}>{U.sets(v)}</Text>
              {under ? <Text style={{ marginLeft: 5, fontFamily: F.bodyB, fontSize: 12, color: th.warn }}>under 4</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
// A single-series sparkline: 2 pt line, the latest point marked, a faint baseline.
function Spark({ points }) {
  const th = useTheme();
  const W = 132, H = 40, P = 5;
  const vals = points.map((p) => p.v).filter((v) => v != null);
  if (vals.length < 2) return <Svg width={W} height={H}><Line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke={th.line} strokeWidth={1} /></Svg>;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { hi += 1; lo -= 1; }
  const x = (i) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P - 4);
  let d = '', last = null;
  points.forEach((p, i) => { if (p.v == null) return; d += (d ? 'L' : 'M') + U.f1(x(i)) + ' ' + U.f1(y(p.v)); last = { i, v: p.v }; });
  return (
    <Svg width={W} height={H} accessibilityElementsHidden>
      <Line x1={P} x2={W - P} y1={H - P + 1} y2={H - P + 1} stroke={th.line} strokeWidth={1} />
      <Path d={d} fill="none" stroke={th.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(last.i)} cy={y(last.v)} r={4} fill={th.accent} stroke={th.bg} strokeWidth={2} />
    </Svg>
  );
}
// Columns for a count each week (sessions, cardio minutes).
function Cols({ weeks, top, label }) {
  const th = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 118, marginTop: 8 }}>
      {weeks.map((w, i) => (
        <View key={i} style={{ flex: 1, height: '100%', alignItems: 'center' }}>
          <Text style={{ fontFamily: F.display6, fontSize: 17, color: th.ink, fontVariant: ['tabular-nums'] }}>{w.n}</Text>
          <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
            <View style={{ width: '70%', minHeight: 2, height: `${(w.n / top) * 100}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: th.ink2 }} />
          </View>
          <Text numberOfLines={1} style={{ alignSelf: 'stretch', textAlign: 'center', borderTopWidth: 1, borderTopColor: th.line, paddingTop: 3, fontFamily: F.body, fontSize: 11.5, color: th.ink3 }}>{i === weeks.length - 1 ? 'This wk' : U.shortDate(w.wk)}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------- Progress ---------------- */
function LiftRow({ l, all, now }) {
  const th = useTheme();
  const wk = E().weekly(all, l.id, 10, now);
  const pts = wk.points.filter((p) => p.v != null);
  const cur = pts.length ? pts[pts.length - 1].v : null;
  const then = wk.points.slice(0, 6).filter((p) => p.v != null);
  const base = then.length ? then[then.length - 1].v : null;
  const delta = cur != null && base != null && pts.length > 1 ? cur - base : null;
  const pr = E().latestPR(all, l.id);
  const unit = wk.unit === 'kg' ? ' kg' : ' reps';
  const fmt = (v) => (wk.unit === 'kg' ? U.kg(Math.round(v * 2) / 2) : Math.round(v)) + unit;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: th.line }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: F.bodyB, fontSize: 16, color: th.ink }}>{l.ex.name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: F.display, fontSize: 26, color: th.ink, fontVariant: ['tabular-nums'] }}>{cur != null ? fmt(cur) : '—'}</Text>
          {delta != null ? <Text style={{ fontFamily: F.bodyB, fontSize: 13.5, color: delta > 0.5 ? th.accent : th.ink3 }}>{delta > 0.5 ? '+' : delta < -0.5 ? '−' : '±'}{wk.unit === 'kg' ? U.kg(Math.abs(Math.round(delta * 2) / 2)) : Math.abs(Math.round(delta))}{unit} in 4 weeks</Text> : null}
        </View>
        <Text style={{ marginTop: 2, fontFamily: F.body, fontSize: 13.5, color: th.ink3 }}>{pr ? `Last PR ${pr.w > 0 ? U.kg(pr.w) + ' kg × ' : ''}${pr.r}${pr.w > 0 ? '' : ' reps'}, ${U.ago(pr.at, now)}` : 'No PR yet beyond the first session'}</Text>
      </View>
      <Spark points={wk.points} />
    </View>
  );
}
function Patterns({ pl, now }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {D().PATTERNS.map((p) => {
        const at = pl[p.id], old = !at || now - at > 14 * DAY;
        return (
          <View key={p.id} style={[{ flexBasis: '48%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 }, old ? { backgroundColor: th.warnSoft } : ({ backgroundColor: th.surface, boxShadow: th.shadow })]}>
            <Text style={{ fontFamily: F.bodyB, fontSize: 13.5, color: th.ink }}>{p.name}</Text>
            <Text style={{ fontFamily: old ? F.bodyB : F.body, fontSize: 13.5, color: old ? th.warn : th.ink3 }}>{at ? U.ago(at, now) : 'not yet'}</Text>
          </View>
        );
      })}
    </View>
  );
}
function renderProgress() {
  const all = sessions(), now = Date.now();
  if (!all.length) {
    view('progress', <View>{topbar('')}<Head kick="Where you're at" title="Progress" meta="Log a workout and this fills in: estimated maxes, PRs, sets per muscle and how often you train." /></View>);
    CH.stage.set({ hub: startHub(), rim: nav('progress') });
    return;
  }
  const lifts = E().mainLifts(all, st().plan, 6);
  const week = E().muscleSets(all, now - 7 * DAY, now + 1);
  const tracked = st().settings.tracked;
  const pw = E().perWeek(all, 8, now);
  const top = Math.max(4, ...pw.map((w) => w.n));
  const hasCardio = all.some((s) => s.sets.some((x) => x.c));
  const cweeks = [];
  if (hasCardio) for (let k = 7; k >= 0; k--) { const to = E().weekStart(now) + 7 * DAY - k * 7 * DAY; cweeks.push({ wk: to - 7 * DAY, n: CH.cardio.minutes(all, to - 7 * DAY, to).all }); }
  view('progress', (
    <View>
      {topbar('')}
      <Head kick="Where you're at" title="Progress" />
      <Sec>Main lifts</Sec>
      <Dim style={{ fontSize: 14 }}>Best estimated max each week, last 10 weeks. From sets of 10 reps or fewer, so treat it as a trend, not a promise.</Dim>
      <View style={{ marginTop: 6 }}>{lifts.map((l) => <LiftRow key={l.id} l={l} all={all} now={now} />)}</View>
      <Sec>Sets per muscle</Sec>
      <Dim style={{ fontSize: 14, marginBottom: 10 }}>Last 7 days. The shaded band is 4–10 sets, where returns per set are best.</Dim>
      <Bars ids={D().MUSCLES.filter((m) => tracked.includes(m.id)).map((m) => m.id)} week={week} />
      <Sec>Sessions per week</Sec>
      <Cols weeks={pw} top={top} label={`Sessions per week for the last 8 weeks: ${pw.map((w) => w.n).join(', ')}`} />
      {hasCardio ? (
        <>
          <Sec>Cardio minutes per week</Sec>
          <Dim style={{ fontSize: 14 }}>{cardioWeek(CH.cardio.minutes(all, now - 7 * DAY, now + 1))}</Dim>
          <Cols weeks={cweeks} top={Math.max(150, ...cweeks.map((w) => w.n))} label={`Cardio minutes per week for the last 8 weeks: ${cweeks.map((w) => w.n).join(', ')}`} />
        </>
      ) : null}
      <Sec>Movement patterns</Sec>
      <Dim style={{ fontSize: 14 }}>When each was last trained. Flagged after 14 days.</Dim>
      <Patterns pl={E().patternLast(all)} now={now} />
    </View>
  ));
  CH.stage.set({ hub: { label: 'Charts', sub: 'by exercise', icon: 'progress', primary: true, menu: exercisesMenu }, rim: nav('progress') });
}

/* ---------------- Week ---------------- */
function Checks({ checks }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 18, gap: 8 }}>
      {checks.map((c) => (
        <View key={c.t} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ok ? th.line2 : th.warnSoft }}>
            {c.ok ? <Icon name="check" size={16} color={th.ink2} stroke={2.6} /> : <Text style={{ fontFamily: F.bodyB, fontSize: 15, color: th.warn }}>!</Text>}
          </View>
          <Text style={{ width: 82, paddingTop: 2, fontFamily: F.bodyB, fontSize: 15, color: th.ink }}>{c.t}</Text>
          <Text style={{ flex: 1, paddingTop: 2, fontFamily: F.body, fontSize: 15, lineHeight: 21, color: th.ink2 }}>{c.d}</Text>
        </View>
      ))}
    </View>
  );
}
function Cards({ cards, focus }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 8, gap: 10 }}>
      {cards.map((c, i) => {
        const on = i === focus;
        return (
          <View key={c.key || i} style={[{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: on ? th.ink : th.line }, on ? ({ backgroundColor: th.surface, boxShadow: th.shadow }) : null]}>
            <Text style={{ position: 'absolute', right: 14, top: 14, fontFamily: F.bodyB, fontSize: 12, color: th.ink3 }}>{i + 1} of {cards.length}</Text>
            <Text style={{ paddingRight: 48, fontFamily: F.display, fontSize: 25, lineHeight: 27, color: th.ink }}>{c.title}</Text>
            <Text style={{ marginTop: 6, fontFamily: F.body, fontSize: 16, lineHeight: 23, color: th.ink2 }}>{c.reason}</Text>
            {on ? <Text style={{ marginTop: 6, fontFamily: F.bodyB, fontSize: 13.5, color: th.ink3 }}>Review opens the choices.</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
function renderWeek() {
  const all = sessions(), now = Date.now();
  const rv = E().review(st(), all, now);
  focusCard = Math.min(focusCard, Math.max(0, rv.cards.length - 1));
  const recent = all.filter((s) => s.start > now - 7 * DAY);
  const nSets = recent.reduce((a, s) => a + s.sets.filter((x) => !x.wu && !x.c).length, 0);
  const cw = CH.cardio.minutes(all, now - 7 * DAY, now + 1);
  const tracked = st().settings.tracked.length;
  const checks = [
    { ok: !rv.missed.length, t: 'Muscles', d: rv.missed.length ? `${rv.missed.length} of ${tracked} under 4 sets: ${U.list(rv.missed.map((m) => D().muscle(m.id).name.toLowerCase() + ' ' + U.sets(m.n)))}` : `All ${tracked} at 4 sets or more` },
    { ok: !rv.missingPatterns.length, t: 'Patterns', d: rv.missingPatterns.length ? `Nothing in 14 days: ${U.list(rv.missingPatterns.map((p) => D().pattern(p.id).name.toLowerCase()))}` : 'All seven trained in the last 14 days' },
    { ok: !rv.lopsided.length, t: 'Balance', d: `Pushing ${rv.push} sets, pulling ${rv.pull}${rv.lopsided.length ? '' : ', close enough'}` },
    { ok: !rv.stalled.length, t: 'Lifts', d: rv.stalled.length ? `Stalled: ${U.list(rv.stalled.map((x) => exName(x.ex).toLowerCase()))}` : 'Nothing stalled for 3 weeks' },
  ];
  // Cardio, once there's any in the last 4 weeks: minutes against the weekly guideline.
  if (CH.cardio.minutes(all, now - 28 * DAY, now + 1).all) checks.push({ ok: cw.weighted >= 150, t: 'Cardio', d: cardioWeek(cw) });
  view('week', (
    <View>
      {topbar('')}
      <Head kick="Last 7 days" title="Week review" meta={`${U.plural(recent.length, 'workout')} · ${U.plural(nSets, 'working set')}${cw.all ? ` · ${cw.all} min cardio` : ''}`} />
      <Checks checks={checks} />
      <Sec>Suggestions</Sec>
      {!rv.ready ? <Glance>Suggestions start after your first full week of logging.</Glance>
        : !rv.cards.length ? <Glance>Nothing to change this week. Keep going.</Glance>
          : <Cards cards={rv.cards} focus={focusCard} />}
    </View>
  ));
  const hub = rv.cards.length ? { label: 'Review', sub: `${focusCard + 1} of ${rv.cards.length}`, icon: 'check', primary: true, act: () => reviewCard(rv.cards[focusCard], rv.cards.length) } : startHub();
  CH.stage.set({ hub, rim: nav('week') });
}
function reviewCard(c, total) {
  const rows = c.actions.map((a) => ({ label: a.label, sub: actionSub(c, a), icon: a.id === 'swap' ? 'swap' : a.id === 'next' ? 'today' : a.id === 'light' ? 'light' : a.id === 'fine' ? 'plate' : 'plus', accent: true, act: () => accept(c, a) }));
  rows.push({ label: 'Not now', sub: 'Ask again next week', icon: 'timer', act: () => dismiss(c, 7) });
  if (c.never) rows.push({ label: c.never, sub: 'Change it back in Settings', icon: 'close', act: () => never(c) });
  else rows.push({ label: "Don't suggest this again", icon: 'close', act: () => dismiss(c, -1) });
  if (total > 1) rows.push({ label: 'Next suggestion', icon: 'next', act: () => { focusCard = (focusCard + 1) % total; CH.stage.closeList(); renderWeek(); } });
  CH.stage.list({ title: c.title, rows, cancel: 'Back', cancelIcon: 'back' });
}
function actionSub(c, a) {
  if (a.id === 'light') return 'Fewer sets at the same weight, once';
  if (a.id === 'fine') return 'Half-size weight increases for this lift';
  if (a.id === 'swap') return 'Same muscle and movement';
  if (a.id === 'next') return 'Changes which day is next';
  if (a.id === 'add') return `2 sets of ${exName(c.add.ex).toLowerCase()}`;
  return '';
}
function markDone(c) { st().dismissed[c.key] = Date.now() + 7 * DAY; }
function accept(c, a) {
  const plan = st().plan;
  if (a.id === 'next') { plan.next = c.day; toast(`${U.esc(plan.days[c.day].name)} is next.`); }
  if (a.id === 'light') { plan.days.forEach((d) => d.items.forEach((it) => { if (it.ex === c.ex) it.light = true; })); toast(`Next ${U.esc(exName(c.ex).toLowerCase())}: fewer sets, same weight.`); }
  if (a.id === 'fine') { plan.days.forEach((d) => d.items.forEach((it) => { if (it.ex === c.ex) it.fine = true; })); toast(`${U.esc(exName(c.ex))} now goes up in half steps.`); }
  if (a.id === 'swap') {
    const vars = E().variations(c.ex, D().profile(plan.profile));
    CH.stage.list({
      title: `Swap ${exName(c.ex).toLowerCase()} for`,
      rows: vars.map((v) => ({ label: v.name, sub: D().eqName(v.eq), act: () => {
        plan.days.forEach((d) => d.items.forEach((it) => { if (it.ex === c.ex) { it.ex = v.id; delete it.light; delete it.fine; } }));
        markDone(c); S().save(); CH.stage.closeList(); toast(`Swapped to ${U.esc(v.name.toLowerCase())} in ${U.esc(plan.name)}.`); renderWeek();
      } })),
      cancel: 'Back', cancelIcon: 'back', onCancel: () => reviewCard(c, 1),
    });
    return;
  }
  if (a.id === 'add') {
    const d = plan.days[c.add.day];
    d.items.push(D().item(c.add.ex, c.add.sets));
    toast(`Added 2 sets of ${U.esc(exName(c.add.ex).toLowerCase())} to ${U.esc(d.name)}.`);
  }
  markDone(c);
  S().save();
  CH.stage.closeList();
  renderWeek();
}
function dismiss(c, days) {
  st().dismissed[c.key] = days < 0 ? -1 : Date.now() + days * DAY;
  S().save();
  CH.stage.closeList();
  renderWeek();
}
function never(c) {
  const s = st().settings;
  if (c.muscle) s.tracked = s.tracked.filter((m) => m !== c.muscle);
  st().dismissed[c.key] = -1;
  S().save();
  CH.stage.closeList();
  renderWeek();
}

/* ---------------- Review: a routine laid out, each exercise marked Keep or Look at ----------------
   From the lifter's own history: going up (keep), new (keep, try it first), holding steady (keep),
   no new best in 3 weeks with 3 workouts since (look at), skipped in 2 of the last 3 times its
   workout was done (look at). A workout not done in 3 weeks while others were, and a main body part
   the routine leaves out, are looked at too. "Keep it" hides a flag for 4 weeks. */
let reviewRid = null;
const KEEP_DAYS = 28;
const keptMap = () => st().kept || (st().kept = {});
function reviewOf(r) {
  const all = sessions(), now = Date.now(), kept = keptMap();
  const own = all.filter((s) => (s.routineId ? s.routineId === r.id : r.days.some((d) => d.id === s.dayId)));
  const stalled = new Map(E().stalls(own.length ? own : all, r, now).map((x) => [x.ex, x]));
  const out = { days: [], look: [], own, recent: own.filter((s) => s.start > now - 28 * DAY).length };
  const keptNow = (key) => kept[key] && kept[key] > now;
  r.days.forEach((d, i) => {
    const ds = own.filter((s) => s.dayId === d.id && s.sets.some((x) => !x.wu)).sort((a, b) => a.start - b.start);
    const lastD = ds[ds.length - 1];
    const day = { d, i, done: ds.length, last: lastD ? lastD.start : 0, items: [] };
    // A workout left behind: not done for 3 weeks while the routine was being trained.
    if (d.items.length && own.length && (!lastD || now - lastD.start > 21 * DAY) && own.some((s) => s.start > now - 21 * DAY) && !keptNow(`${r.id}:day:${d.id}`)) {
      day.flag = { kind: 'day', key: `${r.id}:day:${d.id}`, text: lastD ? `Not done in ${Math.round((now - lastD.start) / (7 * DAY))} weeks` : 'Not done yet, while the others were' };
      out.look.push(Object.assign({ r, d, i }, day.flag));
    }
    d.items.forEach((it, k) => {
      const ex = D().ex(it.ex);
      const v = { it, k, ex, verdict: 'keep', text: '' };
      const last3 = ds.slice(-3);
      const skipped = last3.length >= 2 ? last3.filter((s) => !s.sets.some((x) => x.ex === it.ex && !x.wu)).length : 0;
      const key = `${r.id}:ex:${d.id}:${it.ex}`;
      if (it.cardio) {
        const l = CH.cardio.last(it.ex);
        v.text = l ? `Last time ${CH.cardio.entryText(l)}, ${U.ago(l.at, now)}` : 'New: not done yet';
      } else {
        const g = E().lastGain(all, it.ex), st2 = stalled.get(it.ex), lastR = E().recent(all, it.ex, 1)[0];
        if (!lastR) v.text = 'New: not done yet. Give it a few weeks';
        else if (st2 && (it.light || it.fine)) v.text = `No new best in ${Math.round((now - st2.gain.at) / (7 * DAY))} weeks · ${it.light ? 'a lighter week' : 'smaller steps'} planned`;
        else if (st2) { v.verdict = 'look'; v.kind = 'stall'; v.text = `No new best in ${Math.round((now - st2.gain.at) / (7 * DAY))} weeks (${U.plural(st2.since, 'workout')} since)`; }
        else if (g && now - g.at < 21 * DAY && E().recent(all, it.ex, 99).some((x) => x.session.start < g.at)) v.text = `Going up: new best ${g.w > 0 ? U.kg(g.w) + ' kg × ' : ''}${g.r}${g.w > 0 ? '' : ' reps'}, ${U.ago(g.at, now)}`;
        else v.text = `Holding steady: last time ${setsText(lastR.sets)}`;
      }
      if (v.verdict === 'keep' && skipped >= 2) { v.verdict = 'look'; v.kind = 'skip'; v.text = `Skipped in ${skipped} of the last ${last3.length} ${d.name} workouts`; }
      if (v.verdict === 'look' && keptNow(key)) { v.verdict = 'keep'; v.text += ' · you chose to keep it'; }
      if (v.verdict === 'look') out.look.push({ kind: v.kind, key, r, d, i, it, k, ex, text: v.text });
      day.items.push(v);
    });
    out.days.push(day);
  });
  // A main body part the routine leaves out.
  const g = CH.setup.gaps(r).skipped;
  if (g.length && !keptNow(`${r.id}:gaps`)) out.look.push({ kind: 'gaps', key: `${r.id}:gaps`, r, parts: g, text: `Skips ${U.list(g.map(CH.setup.shortPart))}` });
  return out;
}
function reviewSub() {
  const r = CH.routines.active();
  if (!r) return 'What to keep, what to change';
  try { const n = reviewOf(r).look.length; return n ? `${U.plural(n, 'thing')} to look at in ${r.name}` : `${r.name}: nothing to change`; } catch (e) { return 'What to keep, what to change'; }
}
function Verdict({ look }) {
  const th = useTheme();
  return (
    <View style={[{ alignSelf: 'flex-start', marginTop: 2, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 99 }, look ? { backgroundColor: th.hubBg } : { borderWidth: 1.5, borderColor: th.line }]}>
      <Text style={{ fontFamily: F.bodyB, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: look ? th.hubInk : th.ink2 }}>{look ? 'Look at' : 'Keep'}</Text>
    </View>
  );
}
function ReviewDay({ day, now }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 2, marginBottom: 4 }}>
        <Text accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 26, color: th.ink }}>{day.d.name}</Text>
        <Text style={{ fontFamily: F.body, fontSize: 14, color: th.ink2 }}>{day.done ? `done ${U.plural(day.done, 'time')}, last ${U.ago(day.last, now)}` : 'not done yet'}</Text>
      </View>
      {day.flag ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 6 }}><Verdict look /><T style={{ flex: 1 }}>{day.flag.text}</T></View> : null}
      {!day.items.length ? <Pair dim name="No exercises yet" /> : null}
      {day.items.map((v, j) => (
        <View key={j} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: th.line }}>
          <View style={{ width: 78 }}><Verdict look={v.verdict === 'look'} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyB, fontSize: 16, lineHeight: 22, color: th.ink }}>{v.ex ? v.ex.name : v.it.ex}<Text style={{ fontFamily: F.display6, color: th.ink2 }}>{'  '}{v.it.cardio ? CH.cardio.itemText(v.it) : `${v.it.sets} × ${v.it.lo}–${v.it.hi}`}{v.it.light ? ' · lighter next time' : ''}{v.it.fine ? ' · half steps' : ''}</Text></Text>
            <Text style={{ marginTop: 2, fontFamily: F.body, fontSize: 14, lineHeight: 20, color: v.verdict === 'look' ? th.ink : th.ink2 }}>{v.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
function renderReview() {
  const list = CH.routines.list();
  const r = CH.routines.get(reviewRid) || CH.routines.active() || list[0];
  if (!r) {
    view('review', <View>{topbar('')}<Head kick="Review" title="No routines yet" meta="Make one from Start, and this page lays it out and says what to keep and what to change." /></View>);
    CH.stage.set({ hub: startHub(), rim: nav('review') });
    return;
  }
  reviewRid = r.id;
  const rv = reviewOf(r), now = Date.now();
  const wk = CH.setup.weekText(r.week);
  const planned = r.week && r.week.n ? r.week.n * 4 : null;
  const gl = rv.look.find((x) => x.kind === 'gaps');
  view('review', (
    <View>
      {topbar('')}
      <Head kick={`Review${list.length > 1 ? ` · ${U.plural(list.length, 'routine')}` : ''}${r === CH.routines.active() ? ' · in use' : ''}`} title={r.name}
        meta={`${U.plural(r.days.length, 'workout')}${wk ? ` · ${wk}` : ''} · ${rv.own.length ? `${U.plural(rv.recent, 'workout')} done in the last 4 weeks${planned ? ` (${planned} planned)` : ''}` : 'not trained yet'}`} />
      <Glance offer={rv.look.length > 0}>{!rv.own.length ? 'Nothing to judge yet. Train it for a couple of weeks and each exercise gets a Keep or Look at, from your own numbers.' : rv.look.length ? `Mostly working. ${U.plural(rv.look.length, 'thing')} to look at: tap Review to go through ${rv.look.length === 1 ? 'it' : 'them'}.` : 'Everything is going up or holding steady. Keep it as it is.'}</Glance>
      {rv.days.map((day) => <ReviewDay key={day.d.id || day.i} day={day} now={now} />)}
      <Sec>Balance</Sec>
      <Glance>{gl ? `${r.name} ${gl.text.toLowerCase()}. Review can add one exercise for each.` : r.days.some((d) => !d.items.length) ? 'Some workouts are still empty; balance is checked once each has exercises.' : 'Every main body part is in it.'}</Glance>
    </View>
  ));
  CH.stage.set({ hub: { label: 'Review', sub: rv.look.length ? `${rv.look.length} to look at` : 'all good', icon: 'check', primary: true, menu: () => reviewMenu(r) }, rim: nav('review') });
}
// The button: the things to look at first, then changing a workout, then another routine.
function reviewMenu(r) {
  const rv = reviewOf(r);
  const options = rv.look.map((x) => ({
    label: x.kind === 'gaps' ? 'Missing body parts' : x.kind === 'day' ? x.d.name : x.ex.name,
    title: x.kind === 'gaps' ? `${r.name}: balance` : x.kind === 'day' ? `${x.d.name}: the workout` : `${x.ex.name} · ${x.d.name}`,
    sub: x.text, icon: 'flag', info: `<p>${U.esc(x.text)}.</p>`, act: () => CH.scrub.open(lookActions(r, x), 'hub', 'sticky'),
  }));
  options.push({ label: 'Change a workout', sub: 'Exercises, sets, reps, order', icon: 'edit', info: `<ul>${r.days.map((d) => `<li>${U.esc(d.name)}<span>${U.plural(d.items.length, 'exercise')}</span></li>`).join('')}</ul>`, act: () => CH.scrub.open({ title: `${r.name}: which workout?`, options: r.days.map((d, i) => ({ label: d.name, sub: U.plural(d.items.length, 'exercise'), icon: 'edit', act: () => CH.setup.editDay(r.id, i, 'review') })), start: 0 }, 'hub', 'sticky') });
  const others = CH.routines.list().filter((x) => x !== r);
  if (others.length) options.push({ label: 'Review another routine', sub: U.list(others.map((x) => x.name)), icon: 'stack', act: () => CH.scrub.open({ title: 'Review which routine?', options: others.map((x) => ({ label: x.name, sub: `${U.plural(x.days.length, 'workout')}${x === CH.routines.active() ? ' · in use' : ''}`, icon: 'stack', act: () => { reviewRid = x.id; renderReview(); } })), start: 0 }, 'hub', 'sticky') });
  return { title: rv.look.length ? `${r.name}: ${U.plural(rv.look.length, 'thing')} to look at` : `${r.name}: nothing to change`, options, start: 0, keep: true };
}
// What can be done about one thing: keep it, or the change that fits it.
function lookActions(r, x) {
  const done = (msg) => { S().save(); toast(msg); renderReview(); };
  const keep = { label: 'Keep it', sub: `Hide this for ${KEEP_DAYS / 7} weeks`, icon: 'check', info: '<p>Nothing changes. Review asks again in 4 weeks if it still applies.</p>', act: () => { keptMap()[x.key] = Date.now() + KEEP_DAYS * DAY; done('Kept as it is.'); } };
  const options = [keep];
  if (x.kind === 'gaps') {
    options.push({ label: 'Add one for each', sub: U.list(x.parts.map((p) => CH.setup.partName(p))), icon: 'plus', act: () => { const added = CH.setup.fillGaps(r, x.parts); done(added.length ? `Added ${U.esc(U.list(added.map((n) => n.toLowerCase())))}.` : 'Nothing to add.'); } });
  } else if (x.kind === 'day') {
    options.push({ label: `Do ${x.d.name} next`, sub: 'It comes up next time you train', icon: 'today', act: () => { r.next = x.i; keptMap()[x.key] = Date.now() + 7 * DAY; done(`${U.esc(x.d.name)} is next.`); } });
    options.push({ label: `Remove ${x.d.name}`, sub: 'Logged workouts are kept', icon: 'trash', danger: true, act: () => { r.days.splice(x.i, 1); if (x.i < r.next) r.next -= 1; r.next = r.days.length ? r.next % r.days.length : 0; done(`Removed ${U.esc(x.d.name)}.`); } });
  } else {
    const it = x.it, prof = D().profile(r.profile);
    if (x.kind === 'stall') {
      options.push({ label: 'Lighter week next time', sub: 'Fewer sets at the same weight, once', icon: 'light', act: () => { it.light = true; done(`Next ${U.esc(x.ex.name.toLowerCase())}: fewer sets, same weight.`); } });
      options.push({ label: 'Smaller weight steps', sub: 'Half-size increases for this lift', icon: 'plate', act: () => { it.fine = true; done(`${U.esc(x.ex.name)}: half-size steps.`); } });
    }
    options.push({ label: 'Swap for another version', sub: 'Same movement, other kit or handles', icon: 'swap', act: () => CH.scrub.open({ title: `Instead of ${x.ex.name.toLowerCase()}`, options: D().alternatives(it.ex, it.slot, prof).slice(0, 12).map((e) => ({ label: e.name, sub: D().eqName(e.eq), icon: 'swap', act: () => { it.ex = e.id; it.slot = D().slotFor(e.id); delete it.light; delete it.fine; done(`Swapped to ${U.esc(e.name.toLowerCase())}.`); } })), start: 0 }, 'hub', 'sticky') });
    options.push({ label: 'Change sets or reps', sub: 'Or rest, order, or anything else', icon: 'edit', act: () => CH.setup.editItem(r.id, x.i, x.k, 'review') });
    options.push({ label: 'Remove it', sub: `Take it out of ${x.d.name}`, icon: 'trash', danger: true, act: () => { x.d.items.splice(x.k, 1); done(`Removed ${U.esc(x.ex.name.toLowerCase())} from ${U.esc(x.d.name)}.`); } });
  }
  return { title: x.kind === 'gaps' ? `${r.name}: ${x.text.toLowerCase()}` : x.kind === 'day' ? `${x.d.name}: ${x.text.toLowerCase()}` : `${x.ex.name}: ${x.text.toLowerCase()}`, options, start: 0, keep: true };
}

/* ---------------- Routine: one routine, every workout in it ----------------
   The one picked in Routines (or from Start's Edit), else the one in use. */
const planOf = () => CH.routines.get(planRid) || CH.routines.active() || st().plan;
function PlanDay({ d, next }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <H2 after={next ? <Chip kind="raised">Next</Chip> : null}>{d.name}</H2>
      {d.items.map((it, k) => {
        const ex = D().ex(it.ex);
        return (
          <View key={k} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 12, rowGap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: th.line }}>
            <Text style={{ minWidth: 70, fontFamily: F.display6, fontSize: 19, color: th.ink2, fontVariant: ['tabular-nums'] }}>{it.cardio ? `${it.min} min` : nums(it)}</Text>
            <Text style={{ flexShrink: 1, fontFamily: F.bodyB, fontSize: 16, lineHeight: 22, color: th.ink }}>{ex ? ex.name : it.ex}</Text>
            {it.light ? <Chip>Lighter next time</Chip> : null}
            {it.fine ? <Chip>Half steps</Chip> : null}
          </View>
        );
      })}
      {!d.items.length ? <Pair dim name="No exercises yet" /> : null}
    </View>
  );
}
function renderPlan() {
  const plan = planOf();
  if (!CH.routines.list().length) {
    view('plan', <View>{topbar('')}<Head kick="Your routine" title="No routine yet" meta="Set one up: your days, then a plan, then its exercises." /></View>);
    CH.stage.set({ hub: { label: 'New', sub: 'routine', icon: 'plus', primary: true, menu: () => CH.setup.splitMenu() }, rim: nav('plan') });
    return;
  }
  const others = CH.routines.list().length - 1;
  const wk = CH.setup.weekText(plan.week);
  // A plain offer, not a warning: what the routine leaves out, and how to add it. The finer count
  // (muscles under 4 sets a week) is for lifters past the beginner stage.
  const g = CH.setup.gaps(plan);
  let note = null;
  if (CH.routines.isCardio(plan)) note = <Glance>A cardio routine. Put it on its own days, or alongside a weights routine on the same day, in Routines › Plan the week.</Glance>;
  else if (g.skipped.length) note = <Glance offer>{`${plan.name} skips ${U.list(g.skipped.map(CH.setup.shortPart))}. Add one exercise for each? Tap Edit, then Add what's missing.`}</Glance>;
  else if (plan.days.length && !plan.days.some((d) => !d.items.length) && g.light.length && !st().settings.beginner && sessions().length) {
    const lead = g.perWeek ? `Training ${g.perWeek} day${g.perWeek === 1 ? '' : 's'} a week` : 'Going through every workout once';
    const names = g.light.slice(0, 4).map((m) => m.name.toLowerCase());
    if (g.light.length > 4) names.push(`${g.light.length - 4} more`);
    note = <Glance>{`${lead}, ${U.list(names)} get fewer than 4 sets a week. Fine to start with; Week suggests where to add more as you go.`}</Glance>;
  } else if (plan.days.length && !plan.days.some((d) => !d.items.length)) note = <Glance>Every main body part is in this routine. After your first week, Week checks how much work each muscle got.</Glance>;
  const firstLift = plan.days.flatMap((d) => d.items).find((x) => !x.cardio);
  view('plan', (
    <View>
      {topbar('')}
      <Head kick={`Routine${others ? ` · ${CH.routines.list().indexOf(plan) + 1} of ${others + 1}` : ''}`} title={plan.name}
        meta={plan.days.length === 1 ? 'One workout, done each time you train.' : plan.days.length ? `${U.plural(plan.days.length, 'workout')} that take turns: GYMKDR gives you the next one each time you train.` : 'No workouts yet. Edit adds one.'} />
      <Meta>{plan.week && plan.week.days ? `On ${wk}` : 'Not on particular days (Edit › Days puts it on some)'}</Meta>
      {plan.days.map((d, i) => <PlanDay key={d.id || i} d={d} next={i === plan.next} />)}
      {note}
      {firstLift && (st().settings.beginner || CH.scrub.learning()) ? <Legend>{firstLift.sets} × {firstLift.lo}–{firstLift.hi} means {CH.setup.setsWords(firstLift)}.</Legend> : null}
    </View>
  ));
  CH.stage.set({ hub: { label: 'Edit', sub: 'routine', icon: 'edit', primary: true, act: editPlan }, rim: nav('plan') });
}
function editPlan() {
  const plan = planOf();
  // Deleting the routine sits furthest from the thumb; adding a workout nearest.
  const rows = [{ label: `Delete ${plan.name}`, sub: 'Logged workouts are kept', icon: 'trash', danger: true, act: () => {
    if (st().active && st().active.routineId === plan.id) { toast('Finish or discard the workout from it first.'); return; }
    CH.stage.list({
      title: `Delete ${plan.name}?`,
      rows: [{ label: 'Delete routine', sub: 'Logged workouts and progress are kept', icon: 'trash', danger: true, act: () => { const n = plan.name; CH.routines.remove(plan.id); CH.stage.closeList(); toast(`Deleted ${U.esc(n)}.`); show(CH.routines.list().length ? 'routines' : 'today'); } }],
      cancel: 'Keep it', cancelIcon: 'back', onCancel: editPlan,
    });
  } }];
  rows.push({ label: 'Rename this routine', sub: plan.name, icon: 'edit', act: () => renameRoutine(plan, editPlan) });
  rows.push({ label: 'Review this routine', sub: 'What to keep, what to change', icon: 'check', act: () => { CH.stage.closeList(); reviewRid = plan.id; show('review'); } });
  rows.push({ label: 'All routines', sub: CH.routines.list().length > 1 ? `${U.plural(CH.routines.list().length, 'routine')} and your week` : 'Your routines and your week', icon: 'stack', act: () => { CH.stage.closeList(); show('routines'); } });
  rows.push({ label: CH.routines.isCardio(plan) ? 'Add more cardio' : 'Add cardio', sub: CH.routines.isCardio(plan) ? 'Another machine or type' : 'Before or after the weights', icon: 'flag', act: () => addCardioTo(plan, editPlan) });
  plan.days.forEach((d, i) => rows.push({ label: d.name, sub: `${d.items.length ? U.plural(d.items.length, 'exercise') : 'No exercises yet'}${i === plan.next ? ' · up next' : ''}`, icon: 'next', act: () => CH.setup.editDay(plan.id, i, 'plan') }));
  rows.push({ label: 'Days', value: plan.week && plan.week.days ? `${plan.week.days.length} days` : 'Any day', sub: plan.week && plan.week.days ? CH.setup.weekText(plan.week) : 'Train it on particular days, or any day', icon: 'week', act: () => CH.scrub.open(CH.setup.attachMenu(plan.id, () => { renderPlan(); toast(plan.week && plan.week.days ? `${U.esc(plan.name)}: ${U.esc(CH.setup.weekText(plan.week))}.` : `${U.esc(plan.name)}: any day.`); }), 'hub', 'sticky') });
  rows.push({ label: 'Add a workout', sub: 'Another workout to take turns with these', icon: 'plus', accent: true, act: () => {
    const d = { id: U.id(), name: 'Day ' + String.fromCharCode(65 + plan.days.length), parts: [], items: [] };
    plan.days.push(d);
    S().save(); renderPlan();
    const open = () => CH.setup.editDay(plan.id, plan.days.indexOf(d), 'plan');
    nameDay(d, plan.days, () => { S().save(); open(); }, open);
  } });
  // What the routine leaves out, added in one go: nearest the thumb when there's something to add.
  const gaps = CH.setup.gaps(plan).skipped;
  if (gaps.length) rows.push({ label: "Add what's missing", sub: `One exercise each for ${U.list(gaps.map(CH.setup.shortPart))}`, icon: 'plus', accent: true, act: () => { const added = CH.setup.fillGaps(plan, gaps); CH.stage.closeList(); renderPlan(); toast(added.length ? `Added ${U.esc(U.list(added.map((x) => x.toLowerCase())))}.` : 'Nothing to add.'); } });
  CH.stage.list({ title: `Edit ${plan.name}`, rows, start: 'end', cancel: 'Done', cancelIcon: 'check' });
}
// A workout's name: the common ones in a list, or typed.
const DAY_NAMES = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body', 'Chest', 'Back', 'Shoulders', 'Arms', 'Chest and back', 'Shoulders and arms', 'Glutes and hamstrings', 'Quads and calves', 'Core', 'Olympic lifts', 'Snatch', 'Clean and jerk', 'Cardio'];
function nameDay(d, siblings, after, back) {
  // The common names nearest the thumb: Push, Pull, Legs at the bottom, then typing your own.
  const names = DAY_NAMES.filter((n) => !siblings.some((x) => x !== d && x.name === n)).reverse();
  // A known name brings its body parts with it, if the day has none yet.
  const rows = names.map((n) => ({ label: n, sel: d.name === n, act: () => { d.name = n; if (!d.parts || !d.parts.length) d.parts = (D().DAY_PARTS[n] || []).slice(); CH.stage.closeList(); after(); } }));
  rows.push({ label: 'Type a name', sub: 'Up to 30 letters', icon: 'edit', accent: true, act: () => askText({ title: 'Name this workout', value: d.name, max: 30, done: (v) => { if (v) d.name = v; after(); }, cancel: back }) });
  CH.stage.list({ title: `Name ${d.name}`, rows, start: 'end', cancel: 'Keep this name', cancelIcon: 'back', onCancel: back });
}
// An imported exercise the library didn't recognise: the lifter says which muscle it trains.
function mapMuscle(exId, back) {
  const ex = st().custom[exId];
  if (!ex) return back();
  CH.stage.list({
    title: `${ex.name} trains`,
    rows: D().MUSCLES.map((m) => ({ label: m.name, sel: ex.main === m.id, act: () => { ex.main = m.id; S().save(); renderPlan(); back(); toast(`${U.esc(ex.name)} now counts towards ${U.esc(m.name.toLowerCase())}.`); } })),
    cancel: 'Back', cancelIcon: 'back', onCancel: back,
  });
}
/* Picking an exercise: the muscle, then the movement, then the version (barbell, rope, plate-
   loaded…). A movement with one version skips the last step. "By kit" lists everything for one
   kind of equipment, for a lifter with only kettlebells or a hotel gym. */
function pickExercise(title, done, back, muscle) {
  if (muscle) return pickMovement(title, done, () => pickExercise(title, done, back), muscle);
  const rows = D().MUSCLES.map((m) => {
    const b = D().browse(m.id);
    const n = b.reduce((t, x) => t + (x.fam ? x.ids.length : 1), 0);
    return { label: m.name, sub: `${U.plural(b.length, 'movement')}, ${n} options`, icon: 'next', act: () => pickMovement(title, done, () => pickExercise(title, done, back), m.id) };
  });
  rows.push({ label: 'Olympic lifts', sub: 'Snatch, clean and jerk, pulls…', icon: 'next', act: () => pickMovement(title, done, () => pickExercise(title, done, back), 'olympic') });
  rows.push({ label: 'Browse by kit', sub: 'Barbell, kettlebell, machines, bodyweight…', icon: 'plate', act: () => pickKit(title, done, () => pickExercise(title, done, back)) });
  rows.push({ label: 'Cardio', sub: 'Walk, run, cycle, row, stairs…', icon: 'flag', act: () => CH.cardio.open(CH.cardio.typeMenu(({ ex }) => done(ex), 'machine')) });
  CH.stage.list({ title: title + ': which muscle?', rows, cancel: 'Back', cancelIcon: 'back', onCancel: back });
}
const famKit = (ids) => U.list(Array.from(new Set(ids.map((id) => D().eqName(D().ex(id).eq).toLowerCase()))));
function pickMovement(title, done, back, muscle) {
  const again = () => pickMovement(title, done, back, muscle);
  const oly = muscle === 'olympic';
  const rows = (oly ? D().browsePart('olympic') : D().browse(muscle)).map((b) => {
    if (b.ex) return { label: b.ex.name, sub: D().eqName(b.ex.eq) + (b.ex.custom ? ' · imported' : ''), act: () => done(b.ex.id) };
    if (b.ids.length === 1) { const e = D().ex(b.ids[0]); return { label: e.name, sub: D().eqName(e.eq), act: () => done(e.id) }; }
    return { label: b.fam.name, sub: `${b.ids.length} versions · ${famKit(b.ids)}`, icon: 'next', act: () => pickVersion(title, done, again, b.fam) };
  });
  CH.stage.list({ title: oly ? 'Olympic lifts' : D().muscle(muscle).name, rows, cancel: 'Other muscles', cancelIcon: 'back', onCancel: back });
}
function pickVersion(title, done, back, fam) {
  const rows = fam.ids.map((id) => {
    const e = D().ex(id);
    const other = e.main !== fam.main ? ` · mostly ${D().muscle(e.main).name.toLowerCase()}` : '';
    return { label: e.v, sub: `${e.name}${e.v.toLowerCase().includes(D().eqName(e.eq).toLowerCase()) ? '' : ' · ' + D().eqName(e.eq).toLowerCase()}${other}`, act: () => done(e.id) };
  });
  CH.stage.list({ title: fam.name, rows, cancel: 'Other movements', cancelIcon: 'back', onCancel: back });
}
function pickKit(title, done, back) {
  const rows = Object.keys(D().EQUIPMENT).map((eq) => {
    const n = D().all().filter((e) => e.eq === eq).length;
    return { label: D().EQUIPMENT[eq].long || D().EQUIPMENT[eq].name, sub: U.plural(n, 'exercise'), icon: 'next', off: !n, act: () => pickKitList(title, done, () => pickKit(title, done, back), eq) };
  });
  CH.stage.list({ title: title + ': which kit?', rows, cancel: 'Back to muscles', cancelIcon: 'back', onCancel: back });
}
function pickKitList(title, done, back, eq) {
  const order = D().MUSCLES.map((m) => m.id);
  const list = D().all().filter((e) => e.eq === eq).sort((a, b) => order.indexOf(a.main) - order.indexOf(b.main));
  CH.stage.list({
    title: D().EQUIPMENT[eq].long || D().EQUIPMENT[eq].name,
    rows: list.map((e) => ({ label: e.name, sub: e.main ? D().muscle(e.main).name : 'Not counted', act: () => done(e.id) })),
    cancel: 'Other kit', cancelIcon: 'back', onCancel: back,
  });
}

/* Machine brands. Fifty kilos on one brand's chest press isn't fifty on another's, so a machine
   tagged with its brand keeps its own history. When a lifter first tags a machine they've already
   logged, GYMKDR asks whether those sets were on this one, and moves them across if so. */
function pickBrand(exId, done, back) {
  const ex = D().ex(exId);
  if (!ex) return back();
  const baseId = ex.base || ex.id, base = D().ex(baseId);
  const rows = D().BRANDS.map(([slug, name]) => ({ label: name, sel: ex.brand === slug, act: () => chooseBrand(exId, slug ? baseId + '@' + slug : baseId, done, back) }));
  rows.push({ label: 'No brand', sub: 'One history for every machine', sel: !ex.brand, act: () => chooseBrand(exId, baseId, done, back) });
  CH.stage.list({ title: `Which brand is this ${base.name.toLowerCase()}?`, rows, cancel: 'Back', cancelIcon: 'back', onCancel: back });
}
function chooseBrand(oldId, newId, done, back) {
  if (newId === oldId) { done(newId); return; }
  const has = (id) => sessions().some((s) => s.sets.some((x) => x.ex === id));
  const finish = (move) => {
    if (move) {
      const changed = sessions().filter((s) => s.sets.some((x) => x.ex === oldId)).map((s) => Object.assign({}, s, { sets: s.sets.map((x) => (x.ex === oldId ? Object.assign({}, x, { ex: newId }) : x)) }));
      S().upsertMany(changed);
    }
    CH.routines.list().forEach((r) => r.days.forEach((d) => d.items.forEach((it) => { if (it.ex === oldId) it.ex = newId; })));
    S().save();
    done(newId);
  };
  if (!has(oldId) || has(newId)) { finish(false); return; }
  const was = D().ex(oldId), now = D().ex(newId);
  CH.stage.list({
    title: `Your earlier ${was.name.toLowerCase()} sets`,
    rows: [
      { label: `Were on this ${now.brand ? now.brandName : 'machine'}`, sub: 'Move them across, so progress carries on', icon: 'check', accent: true, act: () => finish(true) },
      { label: 'Were on a different machine', sub: 'This one starts fresh', icon: 'next', act: () => finish(false) },
    ],
    cancel: 'Back', cancelIcon: 'back', onCancel: () => pickBrand(oldId, done, back),
  });
}

/* ---------------- Settings ---------------- */
let report = null; // what the last import or export said, shown under the settings
function KV({ rows }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 18, gap: 10 }}>
      {rows.map(([k, v, dim]) => (
        <View key={k} style={{ flexDirection: 'row', gap: 14 }}>
          <Text style={{ width: 130, fontFamily: F.bodyB, fontSize: 16, lineHeight: 22, color: th.ink }}>{k}</Text>
          <Text style={{ flex: 1, fontFamily: F.body, fontSize: 16, lineHeight: 22, color: th.ink2 }}>{v}{dim ? <Text style={{ color: th.ink3 }}>{dim}</Text> : null}</Text>
        </View>
      ))}
    </View>
  );
}
function Report({ r }) {
  const th = useTheme();
  return (
    <Card style={{ marginTop: 20 }}>
      <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 22, color: th.ink2 }}>
        {r.map((p, i) => (typeof p === 'string' ? p : <Text key={i} style={{ fontFamily: F.bodyB, color: th.ink }}>{p.b}</Text>))}
      </Text>
    </Card>
  );
}
function renderSettings() {
  const s = st().settings;
  const inc = (k) => U.kg(s.inc[k]) + ' kg';
  const untracked = D().MUSCLES.filter((m) => !s.tracked.includes(m.id)).map((m) => m.name.toLowerCase());
  const steps = Object.keys(D().EQUIPMENT).map((k) => `${k === 'bodyweight' ? 'added to bodyweight' : (D().EQUIPMENT[k].long || D().EQUIPMENT[k].name).toLowerCase().replace('smith', 'Smith')} ${inc(k)}`).join(' · ').replace(/^./, (c) => c.toUpperCase());
  view('settings', (
    <View>
      {topbar('')}
      <Head kick="Make it yours" title="Settings" meta="Change opens the list in your thumb's corner." />
      <KV rows={[
        ['Rest timer', s.restOn ? `On, ${s.rest} s` : 'Off', s.restOn ? ' · a notification when it ends, even with the phone locked' : ''],
        ['Weight steps', steps],
        ['Muscles checked', `${s.tracked.length} of ${D().MUSCLES.length}${untracked.length ? ` (not ${U.list(untracked)})` : ''}`],
        ['Haptics', s.haptics ? 'On' : 'Off'],
        ['Sound', s.sound ? 'On' : 'Off', ' · mixes with your music'],
        ['Motion', s.motion === 'reduced' ? 'Reduced' : 'Full'],
        ['Beginner help', s.beginner ? 'On' : 'Off'],
        ['Thumb', CH.reach.hand === 'left' ? 'Left' : 'Right', ' · sweep the other thumb to swap'],
        ['Your data', `${U.plural(sessions().length, 'workout')} · on this phone`, ' · download a backup now and then'],
      ]} />
      {report ? <Report r={report} /> : null}
    </View>
  ));
  CH.stage.set({ hub: { label: 'Change', sub: 'settings', icon: 'settings', primary: true, act: settingsList }, rim: nav('settings') });
}
// The weight steps each kind of kit can be set to: plates, pins and bells come in different jumps.
const STEPS = { barbell: [1, 2.5, 5], dumbbell: [1, 2, 2.5, 5], kettlebell: [2, 4, 8], machine: [2.5, 5, 10], plate: [2.5, 5, 10], smith: [2.5, 5, 10], cable: [1.25, 2.5, 5], bodyweight: [1.25, 2.5, 5] };
function settingsList() {
  const s = st().settings;
  const again = () => { S().save(); CH.applySettings(); renderSettings(); settingsList(); };
  const cyc = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];
  const rows = [
    { label: 'Rest timer', value: s.restOn ? 'On' : 'Off', sub: 'Starts after each set', icon: 'timer', act: () => { s.restOn = !s.restOn; again(); } },
    { label: 'Rest between sets', value: s.rest + ' s', icon: 'timer', off: !s.restOn, act: () => { s.rest = cyc([60, 90, 120, 180, 240], s.rest); again(); } },
    ...Object.entries(STEPS).map(([k, opts]) => ({
      label: `${k === 'bodyweight' ? 'Added bodyweight' : D().EQUIPMENT[k].long || D().EQUIPMENT[k].name} steps`, value: U.kg(s.inc[k]) + ' kg', icon: 'plate',
      act: () => { s.inc[k] = cyc(opts, s.inc[k]); again(); },
    })),
    { label: 'Muscles to check', value: String(s.tracked.length), icon: 'body', act: musclesList },
    { label: 'Haptics', value: s.haptics ? 'On' : 'Off', icon: 'haptics', act: () => { s.haptics = !s.haptics; again(); } },
    { label: 'Sound', value: s.sound ? 'On' : 'Off', icon: 'sound', act: () => { s.sound = !s.sound; again(); } },
    { label: 'Motion', value: s.motion === 'reduced' ? 'Reduced' : 'Full', icon: 'motion', act: () => { s.motion = s.motion === 'reduced' ? 'full' : 'reduced'; again(); } },
    { label: 'Import or restore', sub: 'A Strong, Hevy, GYMKDR or Chalk CSV, or a backup', icon: 'upload', act: pickFile },
    { label: 'Export my workouts', sub: 'CSV, one row per set', icon: 'download', act: exportCsv },
    { label: 'Download a full backup', sub: 'Routines, workouts and settings, to restore anywhere', icon: 'download', act: exportBackup },
    { label: 'Beginner help', value: s.beginner ? 'On' : 'Off', sub: 'Machines and easier versions first; numbers explained', icon: 'body', act: () => { s.beginner = !s.beginner; again(); } },
    { label: 'Show the tips again', sub: 'How the button works, for your next few choices', icon: 'flag', act: () => { st().learn = { picks: 0 }; S().save(); CH.stage.closeList(); toast('The tips are back on.'); renderSettings(); } },
    { label: 'Suggestions turned off', value: String(Object.values(st().dismissed).filter((v) => v === -1).length), sub: 'Turn any back on', icon: 'flag', act: offList },
    { label: 'Sweep your thumb again', icon: 'sweep', act: () => { CH.stage.closeList(); CH.reach.calibrate('resweep').then(() => { CH.stage.layout(); refresh(); }); } },
    { label: 'Erase everything', sub: 'Download a full backup first', icon: 'trash', danger: true, act: () => CH.stage.list({
      title: 'Erase everything?', rows: [{ label: 'Erase', sub: `${U.plural(sessions().length, 'workout')} and ${U.plural(CH.routines.list().length, 'routine')}`, icon: 'trash', danger: true, act: () => { S().reset(); CH.stage.closeList(); report = null; show('welcome'); } }],
      cancel: 'Keep everything', cancelIcon: 'back', onCancel: settingsList,
    }) },
  ];
  // Erase everything sits furthest from the thumb; the rest timer, used most, sits nearest.
  CH.stage.list({ title: 'Settings', rows: rows.filter(Boolean).reverse(), cancel: 'Done', cancelIcon: 'check' });
}
function musclesList() {
  const s = st().settings;
  CH.stage.list({
    title: 'Check these muscles each week',
    rows: D().MUSCLES.map((m) => ({ label: m.name, value: s.tracked.includes(m.id) ? 'On' : 'Off', sel: s.tracked.includes(m.id), act: () => {
      s.tracked = s.tracked.includes(m.id) ? s.tracked.filter((x) => x !== m.id) : s.tracked.concat(m.id);
      // A muscle turned back on can be suggested again.
      if (s.tracked.includes(m.id)) delete st().dismissed['gap:' + m.id];
      S().save(); renderSettings(); musclesList();
    } })),
    cancel: 'Back', cancelIcon: 'back', onCancel: settingsList,
  });
}

/* ---------------- import and export ---------------- */
async function pickFile() {
  CH.stage.closeList();
  let text = null;
  try { text = await pickText(); } catch (e) { toast('That file could not be read.'); return; }
  if (text == null) return;
  onText(String(text));
}
function onText(text) {
  // A backup (JSON) restores; anything else is read as a CSV export.
  if (/^\s*\{/.test(text)) { restoreFrom(text); return; }
  let res;
  try { res = CH.importer.parse(text); } catch (err) { res = { error: err.message || 'That file could not be read.' }; }
  if (res.error) { report = [{ b: 'Nothing imported. ' }, res.error]; toast(U.esc(res.error)); if (current === 'settings') renderSettings(); return; }
  // A workout with rows left out isn't used to replace the copy already here: it would lose those sets.
  const short = new Set((res.rejected || []).map((x) => x.sid).filter(Boolean));
  let kept = 0;
  res.sessions.forEach((x) => {
    if (short.has(x.id) && S().all.some((y) => y.id === x.id && !y.del)) { kept++; return; }
    S().upsert(x);
  });
  // An exercise you've already put right (its muscle, its name) keeps your changes.
  Object.entries(res.custom).forEach(([id, c]) => { if (!st().custom[id]) st().custom[id] = c; });
  if (!CH.routines.list().length) {
    // A routine from what they actually did, grouped by the workout names in the export.
    const plan = CH.importer.planFrom(res.sessions);
    plan.days.forEach((d) => { d.parts = Array.from(new Set(d.items.map((it) => D().partOf(it.ex)).filter(Boolean))); });
    if (plan.days.length) CH.routines.add({ name: CH.routines.freeName('From ' + res.source), kind: 'imported', profile: 'gym', days: plan.days, next: 0 });
  }
  S().save();
  const unk = Object.values(res.custom).filter((c) => !c.main).map((c) => c.name);
  const rej = res.rejected || [];
  report = [
    { b: `Imported from ${res.source}: ` }, `${U.plural(res.sessions.length, 'workout')}, ${U.plural(res.nSets, 'set')} from ${U.plural(res.rows, 'row')}${res.lbs ? ', converted from pounds' : ''}.`,
    ...(rej.length ? [' ', { b: `${U.plural(rej.length, 'row')} left out: ` }, `${rej.slice(0, 4).map((x) => `line ${x.line}, ${x.why}`).join('; ')}${rej.length > 4 ? '; and more' : ''}.`] : [' Every row was imported.']),
    kept ? ` ${U.plural(kept, 'workout')} already here ${kept === 1 ? 'was' : 'were'} left as ${kept === 1 ? 'it was' : 'they were'}, because some of ${kept === 1 ? 'its' : 'their'} rows had problems.` : '',
    unk.length ? ` ${U.plural(unk.length, 'exercise')} weren't recognised, so they count towards progress but not muscles until you say which: ${U.list(unk.slice(0, 8))}${unk.length > 8 ? ' and more' : ''}.` : '',
  ];
  toast(`Imported ${U.plural(res.sessions.length, 'workout')}${rej.length ? `; ${U.plural(rej.length, 'row')} left out` : ''}.`);
  show(current === 'welcome' || current === 'setup' ? 'today' : 'settings');
}
function restoreFrom(text) {
  let b = null;
  try { b = JSON.parse(text); } catch (err) { b = null; }
  // Checked whole before anything changes: a backup that can't be used changes nothing.
  const chk = b ? S().checkBackup(b) : { ok: false, why: "That isn't a GYMKDR backup." };
  if (!chk.ok) { toast(U.esc(chk.why)); return; }
  const n = chk.workouts, nr = chk.routines, bad = chk.damagedRoutines + chk.damagedWorkouts;
  const made = b.made && Number.isFinite(new Date(b.made).getTime()) ? new Date(b.made).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'an unknown date';
  const damaged = bad ? ` ${U.plural(bad, 'damaged entry', 'damaged entries')} will be left out.` : '';
  const apply = (replace) => {
    let r = null;
    try { r = S().restore(b, replace); } catch (err) { r = null; }
    CH.stage.closeList();
    if (!r) { toast("That backup couldn't be used. Nothing was changed."); return; }
    if (replace) { toast(`Restored ${U.plural(r.workouts, 'workout')}.${damaged}`); show('today'); }
    else { toast(r.workouts ? `Added ${U.plural(r.workouts, 'workout')} from the backup.${damaged}` : `Nothing to add: this phone already has every workout in it.${damaged}`); show('settings'); }
  };
  CH.stage.list({
    title: `Backup from ${made}: ${U.plural(n, 'workout')}, ${U.plural(nr, 'routine')}${bad ? ` (${bad} damaged)` : ''}`,
    rows: [
      { label: 'Replace everything with it', sub: 'Workouts and routines not in the backup are deleted', icon: 'trash', danger: true, act: () => apply(true) },
      { label: 'Add it to what is here', sub: 'Keeps everything; adds what this phone is missing', icon: 'plus', accent: true, act: () => apply(false) },
    ],
    cancel: 'Not now', cancelIcon: 'back', onCancel: settingsList,
  });
}
// A timestamp with this phone's offset, so it means the same moment wherever it's read.
function isoLocal(ts) {
  const d = new Date(ts), z = -d.getTimezoneOffset(), a = Math.abs(z);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${z >= 0 ? '+' : '-'}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
}
// A file goes to the share sheet: save it to Files, AirDrop it, or email it to yourself.
async function deliver(name, data, type, what) {
  CH.stage.closeList();
  const how = await saveFile(name, data, type);
  if (how === 'saved') { toast(`${what} ready.`); return; }
  report = [{ b: `${what} couldn't be saved. ` }, 'Try again, or free some space on the phone.'];
  if (current === 'settings') renderSettings();
}
/* The CSV: one row per set. Times carry their offset; ids, warm-ups and effort are kept, so
   importing it back into GYMKDR gives the same workouts. */
function exportCsv() {
  // Cardio rows leave weight and reps blank and fill the last four columns instead.
  const rows = [['date', 'end_time', 'workout', 'exercise', 'set', 'weight_kg', 'reps', 'effort', 'warm_up', 'set_time', 'session_id', 'routine_id', 'day_id', 'exercise_id', 'duration_s', 'distance', 'distance_unit', 'cardio_settings']];
  sessions().forEach((x) => {
    const n = {};
    x.sets.forEach((y) => {
      n[y.ex] = (n[y.ex] || 0) + 1;
      const c = !!y.c, res = c ? CH.cardio.RESULTS[(CH.cardio.MACHINES[(CH.cardio.ex(y.ex) || {}).machine] || {}).result] : null;
      rows.push([isoLocal(x.start), x.noTime || !(x.end > x.start) ? '' : isoLocal(x.end), x.day, exName(y.ex), n[y.ex], c ? '' : y.w, c ? '' : y.r, c ? ['', 'easy', 'steady', 'hard', 'all out'][y.e || 0] : ['', 'easy', 'hard', 'failure'][y.e || 0], y.wu ? 'yes' : 'no', Number.isFinite(y.t) && !x.noTime ? isoLocal(y.t) : '', x.id, x.routineId || '', x.dayId || '', y.ex,
        c ? y.s || 0 : '', c && y.d ? y.d : '', c && y.d && res ? res.unit : '', c ? Object.keys(y.set || {}).map((k) => `${k}=${y.set[k]}`).join(';') : '']);
    });
  });
  const csv = rows.map((r) => r.map((v) => { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',')).join('\n');
  deliver(`gymkdr-workouts-${dayKey(Date.now())}.csv`, csv, 'text/csv', 'Export');
}
function exportBackup() {
  deliver(`gymkdr-backup-${dayKey(Date.now())}.json`, JSON.stringify(S().backup()), 'application/json', 'Backup');
}
// Suggestions turned off for good ("Don't suggest this again"), so they can be turned back on.
function offList() {
  const keys = Object.keys(st().dismissed).filter((k) => st().dismissed[k] === -1);
  const name = (k) => {
    const [kind, id] = k.split(':');
    if (kind === 'stall') return { label: `Stalled: ${exName(id)}`, sub: 'When it stops going up' };
    if (kind === 'gap') return { label: `Under 4 sets: ${(D().muscle(id) || { name: id }).name}`, sub: 'Weekly sets for this muscle' };
    if (kind === 'pattern') return { label: `Not trained lately: ${((D().PATTERNS || []).find((p) => p.id === id) || { name: id }).name}`, sub: 'A movement missing for 2 weeks' };
    if (kind === 'lopsided') return { label: id === 'pushpull' ? 'More pushing than pulling' : 'More quads than hamstrings', sub: 'Balance between sides' };
    if (kind === 'missed') return { label: 'A workout keeps being skipped', sub: 'Days of your routine' };
    return { label: k, sub: '' };
  };
  CH.stage.list({
    title: keys.length ? 'Suggestions turned off · tap to turn back on' : 'No suggestions are turned off',
    rows: keys.map((k) => Object.assign(name(k), { icon: 'flag', act: () => { delete st().dismissed[k]; S().save(); toast('Turned back on. Week will suggest it again when it applies.'); offList(); } })),
    cancel: 'Back', cancelIcon: 'back', onCancel: settingsList,
  });
}

let enterSeq = 0;
CH.applySettings = () => { CH.bus.emit('settings'); };
CH.ui = {
  init() {
    CH.bus.on('notice', (m) => toast(U.esc(m)));
    CH.bus.on('sync', () => refresh());
  },
  // A screen's content for the reading column; `enter` slides it in from one side.
  setView(name, el) { const c = contentAtom.get(); contentAtom.set({ name, el, rev: (c.rev || 0) + 1, enter: c.enter || 0, enterId: c.enterId || 0 }); },
  enter(dx) { const c = contentAtom.get(); contentAtom.set(Object.assign({}, c, { enter: dx, enterId: ++enterSeq })); },
  show, refresh, toast, summary, topbar, pickExercise, pickBrand, pickFile, askText, fitAsk, nameDay, mapMuscle,
  importText: onText,
  current: () => current,
};
export default CH.ui;
