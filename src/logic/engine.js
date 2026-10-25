/* GYMKDR · engine: every number the app shows and every suggestion it makes, as pure functions
   over the lifter's own log. Nothing here touches the page. */
import CH from '../ch';

const D = () => CH.data;
const DAY = 864e5;
const r25 = (w) => Math.round(w * 4) / 4;

// Epley. Only sets of 10 reps or fewer count: estimates drift further from the true max above that.
const e1rm = (w, r) => (!(r > 0) || r > 10 || !(w > 0) ? 0 : r === 1 ? w : w * (1 + r / 30));

const working = (s) => s.sets.filter((x) => !x.wu && x.r > 0);
const setsOf = (s, ex) => s.sets.filter((x) => x.ex === ex && !x.wu && x.r > 0);
const sorted = (sessions) => sessions.slice().sort((a, b) => a.start - b.start);

// Monday-based week key (AU weeks start on Monday).
function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d.getTime();
}

function incFor(ex, settings, fine) {
  const eq = ex ? ex.eq : 'barbell';
  const base = (settings.inc && settings.inc[eq]) || 2.5;
  return fine ? Math.max(0.5, r25(base / 2)) : base;
}

// The last sessions that included this exercise, newest first.
function recent(sessions, exId, n = 2, before = Infinity) {
  const out = [];
  const s = sorted(sessions);
  for (let i = s.length - 1; i >= 0 && out.length < n; i--) {
    if (s[i].start >= before) continue;
    const w = setsOf(s[i], exId);
    if (w.length) out.push({ session: s[i], sets: w });
  }
  return out;
}

/* Double progression. Each exercise carries a rep range. When every planned set reached the top
   of the range, add one increment and drop back to the bottom; otherwise add a rep. Every target
   carries its one-line reason. */
function target(item, sessions, settings, before = Infinity) {
  const ex = D().ex(item.ex);
  // Cardio has no sets or reps to progress: its time and settings come from cardio.js.
  if (ex && ex.cardio) return { kind: 'cardio', sets: [{ w: 0, r: 0 }], reason: '' };
  const n = Math.max(1, item.sets | 0);
  const lo = item.lo, hi = item.hi;
  const inc = incFor(ex, settings, item.fine);
  const [last, prev] = recent(sessions, item.ex, 2, before);
  const light = !!item.light;
  const nSets = light ? Math.max(1, Math.ceil(n / 2)) : n;
  const fill = (w, reps) => Array.from({ length: nSets }, (_, i) => ({ w: r25(w), r: Array.isArray(reps) ? reps[i] : reps }));
  const bw = ex && ex.eq === 'bodyweight';
  const assist = !!(ex && ex.assist); // more weight means more help, so progress is less weight

  if (!last) {
    const start = ex && D().EQUIPMENT[ex.eq] ? D().EQUIPMENT[ex.eq].start : 20;
    return { kind: 'first', sets: fill(start, lo), reason: bw ? `First time: aim for ${lo}–${hi} reps.` : assist ? `First time: pick the help you need for ${lo}–${hi} reps.` : `First time: pick a weight you can lift for ${lo}–${hi} reps.` };
  }
  const lw = assist ? Math.min(...last.sets.map((x) => x.w)) : Math.max(...last.sets.map((x) => x.w));
  const top = last.sets.filter((x) => (assist ? x.w <= lw : x.w >= lw));
  const allTop = top.length >= n && top.slice(0, n).every((x) => x.r >= hi);
  const under = (p) => p && p.sets.filter((x) => x.r < lo).length >= Math.ceil(p.sets.length / 2);
  const lastReps = top.map((x) => x.r);
  const holdReps = Array.from({ length: nSets }, (_, i) => Math.min(bw && lw === 0 ? 99 : hi, Math.max(lo, (lastReps[i] != null ? lastReps[i] : lo) + 1)));

  if (light) {
    return { kind: 'light', sets: fill(lw, holdReps.map((r) => Math.max(lo, r - 1))), reason: `Lighter week: ${nSets} ${nSets === 1 ? 'set' : 'sets'} instead of ${n}, same weight.` };
  }
  if (allTop) {
    if (bw && lw === 0) {
      return { kind: 'hold', sets: fill(0, holdReps.map((r) => Math.max(r, hi))), reason: `Top of the range last time. Raise the range in Routine, or add weight.` };
    }
    const easy = top.slice(0, n).every((x) => x.e === 1);
    if (assist) {
      if (lw <= 0) return { kind: 'hold', sets: fill(0, holdReps.map((r) => Math.max(r, hi))), reason: 'No help needed any more. Try the bodyweight version.' };
      return { kind: 'up', sets: fill(Math.max(0, lw - inc), lo), reason: `${fmtKg(inc)} less help: every set reached ${hi} last time${easy ? ', and it felt easy' : ''}.` };
    }
    return { kind: 'up', sets: fill(lw + inc, lo), reason: `Up ${fmtKg(inc)}: every set reached ${hi} last time${easy ? ', and it felt easy' : ''}.` };
  }
  if (assist && under(last) && under(prev)) {
    return { kind: 'down', sets: fill(lw + inc, lo), reason: `${fmtKg(inc)} more help: under ${lo} reps two sessions running.` };
  }
  if (!assist && under(last) && under(prev) && lw - inc > 0) {
    return { kind: 'down', sets: fill(lw - inc, lo), reason: `Down ${fmtKg(inc)}: under ${lo} reps two sessions running.` };
  }
  const gained = holdReps.some((r, i) => lastReps[i] != null && r > lastReps[i]);
  return { kind: 'hold', sets: fill(lw, holdReps), reason: gained ? `Same weight: one more rep than last time.` : `Same weight as last time.` };
}

function fmtKg(w) {
  const v = r25(w);
  return (Number.isInteger(v) ? String(v) : String(v).replace(/0+$/, '')) + ' kg';
}

/* PRs. A rep PR is a set no earlier set beats on both weight and reps. The first time an
   exercise is logged is not a PR. On an assisted machine, less help is the better set. */
const isAssist = (exId) => !!((D().ex(exId) || {}).assist);
const beats = (p, x, assist) => (assist ? p.w <= x.w : p.w >= x.w) && p.r >= x.r;
/* Which of two PR sets of one exercise is the stronger, for the summary's one PR per exercise.
   On an assisted machine less help wins, then more reps. Otherwise the estimated max, where both
   have one (it isn't estimated without weight or above 10 reps); failing that, the heavier set,
   then the one with more reps: 12 pull-ups beat 9. */
function stronger(a, b, assist) {
  if (assist) return a.w < b.w || (a.w === b.w && a.r > b.r);
  const ea = e1rm(a.w, a.r), eb = e1rm(b.w, b.r);
  if (ea > 0 && eb > 0) return ea > eb;
  return a.w > b.w || (a.w === b.w && a.r > b.r);
}
function prsFor(session, sessions) {
  const before = sessions.filter((s) => s.start < session.start && s.id !== session.id);
  const out = [];
  const seen = new Set();
  const within = [];
  working(session).forEach((set) => {
    const prior = [];
    before.forEach((s) => setsOf(s, set.ex).forEach((x) => prior.push(x)));
    if (!prior.length) return;
    const assist = isAssist(set.ex);
    const againstAll = prior.concat(within.filter((x) => x.ex === set.ex));
    const beaten = againstAll.some((p) => beats(p, set, assist));
    within.push(set);
    if (beaten) return;
    const best = assist ? 0 : Math.max(0, ...prior.map((p) => e1rm(p.w, p.r)));
    const kind = e1rm(set.w, set.r) > best && best > 0 ? 'e1rm' : 'rep';
    const k = set.ex;
    // Keep the strongest PR per exercise.
    const i = out.findIndex((o) => o.ex === k);
    const cand = { ex: k, w: set.w, r: set.r, kind, e1rm: e1rm(set.w, set.r) };
    if (i < 0) out.push(cand);
    else if (stronger(cand, out[i], assist)) out[i] = cand;
    seen.add(k);
  });
  return out;
}

// Would this set be a PR if logged now? Used for the live PR mark on the session screen.
function isPR(set, exId, sessions, earlierToday) {
  if (set.wu || !(set.r > 0)) return null;
  const prior = [];
  sessions.forEach((s) => setsOf(s, exId).forEach((x) => prior.push(x)));
  if (!prior.length) return null;
  const all = prior.concat(earlierToday.filter((x) => x.ex === exId && !x.wu));
  const assist = isAssist(exId);
  if (all.some((p) => beats(p, set, assist))) return null;
  const best = assist ? 0 : Math.max(0, ...prior.map((p) => e1rm(p.w, p.r)));
  return e1rm(set.w, set.r) > best && best > 0 ? 'e1rm' : 'rep';
}

/* Fractional sets per muscle in a time window: main muscle 1, each helper 0.5. */
function muscleSets(sessions, from, to) {
  const m = {};
  D().MUSCLES.forEach((x) => { m[x.id] = 0; });
  sessions.forEach((s) => {
    if (s.start < from || s.start >= to) return;
    working(s).forEach((set) => {
      const ex = D().ex(set.ex);
      if (!ex || !ex.main || !(ex.main in m)) return;
      m[ex.main] += 1;
      (ex.help || []).forEach((h) => { if (h in m) m[h] += 0.5; });
    });
  });
  return m;
}

function patternSets(sessions, from, to) {
  const p = {};
  D().PATTERNS.forEach((x) => { p[x.id] = 0; });
  sessions.forEach((s) => {
    if (s.start < from || s.start >= to) return;
    working(s).forEach((set) => { const ex = D().ex(set.ex); if (ex && ex.pattern && ex.pattern in p) p[ex.pattern]++; });
  });
  return p;
}

function patternLast(sessions) {
  const last = {};
  sessions.forEach((s) => working(s).forEach((set) => {
    const ex = D().ex(set.ex);
    if (ex && ex.pattern) last[ex.pattern] = Math.max(last[ex.pattern] || 0, s.start);
  }));
  return last;
}

// Weekly best per lift: e1RM for loaded lifts, most reps for bodyweight-only ones.
function weekly(sessions, exId, weeks, now) {
  const w0 = weekStart(now) - (weeks - 1) * 7 * DAY;
  const out = Array.from({ length: weeks }, (_, i) => ({ wk: w0 + i * 7 * DAY, v: null }));
  let usesLoad = false;
  if (!isAssist(exId)) sessions.forEach((s) => setsOf(s, exId).forEach((x) => { if (x.w > 0) usesLoad = true; }));
  sessions.forEach((s) => {
    const i = Math.floor((weekStart(s.start) - w0) / (7 * DAY) + 0.01);
    if (i < 0 || i >= weeks) return;
    setsOf(s, exId).forEach((x) => {
      const v = usesLoad ? e1rm(x.w, x.r) : x.r;
      if (v > 0 && (out[i].v == null || v > out[i].v)) out[i].v = v;
    });
  });
  return { points: out, unit: usesLoad ? 'kg' : 'reps' };
}

function best(sessions, exId) {
  let b = null;
  if (isAssist(exId)) return null; // no one-rep max for a machine that helps
  sorted(sessions).forEach((s) => setsOf(s, exId).forEach((x) => {
    const v = e1rm(x.w, x.r);
    if (v > 0 && (!b || v > b.v)) b = { v, at: s.start, w: x.w, r: x.r };
  }));
  return b;
}

// Latest rep PR for a lift: walk the log and keep the last set no earlier set beat.
function latestPR(sessions, exId) {
  const assist = isAssist(exId);
  const prior = [];
  let last = null;
  sorted(sessions).forEach((s) => {
    const today = [];
    setsOf(s, exId).forEach((x) => {
      if (prior.length && !prior.concat(today).some((p) => beats(p, x, assist))) last = { w: x.w, r: x.r, at: s.start };
      today.push(x);
    });
    today.forEach((x) => prior.push(x));
  });
  return last;
}

// The big barbell lifts lead, in the order lifters usually quote them; everything else follows.
const BIG = ['squat', 'bench', 'deadlift', 'ohp', 'bbRow', 'rdl', 'pullUp', 'frontSquat', 'inclineBench', 'chinUp'];
const rank = (id) => { const i = BIG.indexOf(id); return i < 0 ? 99 : i; };
function mainLifts(sessions, plan, limit = 6) {
  const count = {};
  sessions.forEach((s) => { const seen = new Set(); working(s).forEach((x) => { if (!seen.has(x.ex)) { seen.add(x.ex); count[x.ex] = (count[x.ex] || 0) + 1; } }); });
  return Object.keys(count)
    .filter((id) => count[id] >= 2)
    .map((id) => ({ id, n: count[id], ex: D().ex(id) }))
    .filter((o) => o.ex)
    .map((o) => Object.assign(o, { top: (best(sessions, o.id) || { v: 0 }).v }))
    .filter((o) => o.top > 0)
    .sort((a, b) => (rank(a.id) - rank(b.id)) || (b.ex.compound - a.ex.compound) || (b.n - a.n))
    .slice(0, limit);
}

function perWeek(sessions, weeks, now) {
  const w0 = weekStart(now) - (weeks - 1) * 7 * DAY;
  const out = Array.from({ length: weeks }, (_, i) => ({ wk: w0 + i * 7 * DAY, n: 0 }));
  sessions.forEach((s) => {
    if (!working(s).length) return;
    const i = Math.floor((weekStart(s.start) - w0) / (7 * DAY) + 0.01);
    if (i >= 0 && i < weeks) out[i].n++;
  });
  return out;
}

// The last session that set a new best: a set no earlier set matched on both weight and reps.
function lastGain(sessions, exId) {
  const prior = [];
  const assist = isAssist(exId);
  let gain = null;
  sorted(sessions).forEach((s) => {
    const sets = setsOf(s, exId);
    if (!sets.length) return;
    const fresh = sets.filter((x) => !prior.some((p) => beats(p, x, assist)));
    if (fresh.length) {
      const top = fresh.slice().sort((a, b) => (assist ? a.w - b.w : b.w - a.w) || (b.r - a.r))[0];
      gain = { at: s.start, w: top.w, r: top.r };
    }
    sets.forEach((x) => prior.push(x));
  });
  return gain;
}

/* A lift has stalled when its last PR is more than three weeks old and it has been trained at
   least three times since. Three weeks is a starting threshold to tune from real logs. */
function stalls(sessions, plan, now) {
  const inPlan = new Set();
  plan.days.forEach((d) => d.items.forEach((i) => inPlan.add(i.ex)));
  const out = [];
  inPlan.forEach((id) => {
    const ex = D().ex(id);
    if (!ex) return;
    const g = lastGain(sessions, id);
    if (!g || now - g.at < 21 * DAY) return;
    const since = sessions.filter((s) => s.start > g.at && setsOf(s, id).length).length;
    if (since >= 3) out.push({ ex: id, gain: g, since });
  });
  return out;
}

// An exercise to fill a gap: one the lifter already logs, then one in the plan, then the library.
function candidate(sessions, plan, test) {
  const count = {};
  sessions.forEach((s) => working(s).forEach((x) => { count[x.ex] = (count[x.ex] || 0) + 1; }));
  const logged = Object.keys(count).filter((id) => { const e = D().ex(id); return e && test(e); }).sort((a, b) => count[b] - count[a]);
  if (logged.length) return logged[0];
  const planned = [];
  plan.days.forEach((d) => d.items.forEach((i) => { const e = D().ex(i.ex); if (e && test(e)) planned.push(i.ex); }));
  if (planned.length) return planned[0];
  const used = new Set(Object.keys(count).map((id) => (D().ex(id) || {}).eq));
  const lib = D().EXERCISES.filter(test);
  const same = lib.filter((e) => used.has(e.eq));
  return ((same.length ? same : lib)[0] || {}).id || null;
}

const LOWER = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'lowerBack']);
const region = (m) => (m === 'abs' ? 'core' : LOWER.has(m) ? 'lower' : 'upper');

// Where to add an exercise: the next day in the rotation that already trains the same part of
// the body and doesn't have this exercise yet. Core work fits anywhere.
function dayFor(plan, exId) {
  const n = plan.days.length;
  const ex = D().ex(exId);
  const want = ex ? region(ex.main) : 'core';
  let fallback = -1;
  for (let k = 0; k < n; k++) {
    const i = (plan.next + k) % n;
    const d = plan.days[i];
    if (d.items.some((x) => x.ex === exId)) continue;
    if (fallback < 0) fallback = i;
    if (want === 'core') return i;
    if (d.items.some((x) => { const e = D().ex(x.ex); return e && region(e.main) === want; })) return i;
  }
  return fallback >= 0 ? fallback : plan.next % Math.max(1, n);
}

// Fractional sets per muscle that one pass through the plan gives.
function planDose(plan, onlyDay) {
  const m = {};
  D().MUSCLES.forEach((x) => { m[x.id] = 0; });
  plan.days.forEach((d, i) => {
    if (onlyDay != null && i !== onlyDay) return;
    d.items.forEach((it) => {
      const ex = D().ex(it.ex);
      if (!ex || !(ex.main in m)) return;
      m[ex.main] += it.sets;
      (ex.help || []).forEach((h) => { if (h in m) m[h] += 0.5 * it.sets; });
    });
  });
  return m;
}

// The plan's weekly dose at the pace the lifter actually trains (sessions a week over the last 4).
function planWeekly(plan, sessions, now) {
  // Only this routine's own workouts set its pace; another routine trained alongside it doesn't.
  const own = sessions.filter((s) => (s.routineId ? s.routineId === plan.id : plan.days.some((d) => d.id === s.dayId)));
  if (own.length) sessions = own;
  const n = Math.max(1, plan.days.length);
  const recentN = sessions.filter((s) => s.start > now - 28 * DAY && working(s).length).length;
  const first = sessions.length ? Math.min(...sessions.map((s) => s.start)) : now;
  const weeks = Math.min(4, Math.max(1, (now - first) / (7 * DAY)));
  // Before any workouts, the routine's training days say the pace (else once through a week).
  const perWeek = sessions.length ? recentN / weeks : (plan.week && plan.week.n) || n;
  const f = Math.min(3, Math.max(0.25, perWeek / n));
  const dose = planDose(plan);
  Object.keys(dose).forEach((k) => { dose[k] *= f; });
  return dose;
}

const SINGULAR = new Set(['chest', 'upperBack', 'lowerBack']);
const agoText = (d) => (d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago');
const fmtSets = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)) + (v === 1 ? ' set' : ' sets');

/* The weekly review: four checks, then at most three suggestion cards, each with its reason. */
function review(state, sessions, now) {
  const tracked = new Set(state.settings.tracked);
  const from7 = now - 7 * DAY;
  const ms = muscleSets(sessions, from7, now + 1);
  const ps = patternSets(sessions, from7, now + 1);
  const pl = patternLast(sessions);
  const first = sessions.length ? Math.min(...sessions.map((s) => s.start)) : now;
  // Suggestions change the routine in use, so with none (every routine deleted) there are none.
  const plan = state.plan && Array.isArray(state.plan.days) ? state.plan : { days: [] };
  const ready = now - first >= 7 * DAY && plan.days.length > 0;

  const missed = D().MUSCLES.filter((m) => tracked.has(m.id) && ms[m.id] < 4).map((m) => ({ id: m.id, n: ms[m.id] }));
  const missingPatterns = D().PATTERNS.filter((p) => !pl[p.id] || now - pl[p.id] > 14 * DAY).map((p) => ({ id: p.id, last: pl[p.id] || 0 }));
  const push = ps.hpush + ps.vpush, pull = ps.hpull + ps.vpull;
  const lopsided = [];
  if (push >= 6 && push > 1.5 * pull) lopsided.push({ kind: 'pushpull', a: push, b: pull });
  if (ms.quads >= 6 && ms.quads > 2 * ms.hamstrings && tracked.has('hamstrings')) lopsided.push({ kind: 'quadham', a: ms.quads, b: ms.hamstrings });
  const stalled = stalls(sessions, plan, now);

  const cards = [];
  const off = (key) => { const d = state.dismissed[key]; return d === -1 || (d && d > now); };
  const dayName = (i) => (plan.days[i] || {}).name || 'a workout';

  if (ready) {
    stalled.forEach((st) => {
      const key = 'stall:' + st.ex;
      if (off(key)) return;
      const name = D().ex(st.ex).name;
      const planned = plan.days.some((d) => d.items.some((i) => i.ex === st.ex && (i.light || i.fine)));
      if (planned) return;
      cards.push({
        key, kind: 'stall', ex: st.ex,
        title: `${name} has stalled`,
        reason: `Last PR ${st.gain.w > 0 ? fmtKg(st.gain.w) + ' × ' : ''}${st.gain.r}${st.gain.w > 0 ? '' : ' reps'}, ${agoText(Math.round((now - st.gain.at) / DAY))}. Trained ${st.since} times since without beating it.`,
        actions: [
          { id: 'light', label: 'Lighter week next time' },
          { id: 'fine', label: 'Smaller weight steps' },
          { id: 'swap', label: 'Swap to a variation' },
        ],
      });
    });
    // A muscle under 4 sets either isn't in the plan enough (add sets) or its day was missed
    // (do that day next). Missed days are grouped so one card covers every muscle they fix.
    const weeklyPlan = planWeekly(plan, sessions, now);
    const lastDone = (dayId) => Math.max(0, ...sessions.filter((s) => s.dayId === dayId && working(s).length).map((s) => s.start));
    const byDay = new Map();
    const gaps = missed.slice().sort((a, b) => a.n - b.n);
    gaps.forEach((g) => {
      // Days that dose this muscle but haven't been done in the last 7 days.
      let pick = -1, bestDose = 0;
      plan.days.forEach((d, i) => {
        if (lastDone(d.id) > from7) return;
        const dose = planDose(plan, i)[g.id];
        if (dose > bestDose) { pick = i; bestDose = dose; }
      });
      if (pick >= 0) {
        if (pick === plan.next) return; // already next up
        if (!byDay.has(pick)) byDay.set(pick, []);
        byDay.get(pick).push(g);
        return;
      }
      const key = 'gap:' + g.id;
      if (off(key)) return;
      const exId = candidate(sessions, plan, (e) => e.main === g.id);
      if (!exId) return;
      const day = dayFor(plan, exId);
      const m = D().muscle(g.id).name;
      cards.push({
        key, kind: 'gap', muscle: g.id, add: { ex: exId, day, sets: 2 },
        title: `${m}: ${fmtSets(g.n)} in 7 days`,
        reason: `Your plan gives about ${fmtSets(Math.round(weeklyPlan[g.id] * 2) / 2)} a week, under the 4 that is the smallest dose shown to grow muscle. Add 2 sets of ${D().ex(exId).name.toLowerCase()} to ${dayName(day)}?`,
        actions: [{ id: 'add', label: `Add to ${dayName(day)}` }],
        never: `Don't track ${m.toLowerCase()}`,
      });
    });
    byDay.forEach((list, i) => {
      const d = plan.days[i];
      const key = 'missed:' + d.id;
      if (off(key)) return;
      const names = list.map((g) => D().muscle(g.id).name.toLowerCase());
      const at = lastDone(d.id);
      const ago = at ? Math.round((now - at) / DAY) : null;
      const joined = names.length < 2 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
      cards.unshift({
        key, kind: 'missed', day: i, muscles: list.map((g) => g.id),
        title: `${d.name} is overdue`,
        reason: `${joined[0].toUpperCase() + joined.slice(1)} ${list.length === 1 && SINGULAR.has(list[0].id) ? 'is' : 'are'} under 4 sets in the last 7 days. Your plan covers ${list.length === 1 && SINGULAR.has(list[0].id) ? 'it' : 'them'} on ${d.name}${ago != null ? `, last done ${agoText(ago)}` : ', not done yet'}. Do it next?`,
        actions: [{ id: 'next', label: `Do ${d.name} next` }],
      });
    });
    missingPatterns.forEach((p) => {
      const key = 'pattern:' + p.id;
      if (off(key)) return;
      const exId = candidate(sessions, plan, (e) => e.pattern === p.id);
      if (!exId) return;
      const day = dayFor(plan, exId);
      const pn = D().pattern(p.id).name;
      cards.push({
        key, kind: 'pattern', pattern: p.id, add: { ex: exId, day, sets: 2 },
        title: `No ${pn.toLowerCase()} work in 14 days`,
        reason: `Add 2 sets of ${D().ex(exId).name.toLowerCase()} to ${dayName(day)}?`,
        actions: [{ id: 'add', label: `Add to ${dayName(day)}` }],
        never: `Don't check ${pn.toLowerCase()}`,
      });
    });
    lopsided.forEach((l) => {
      const key = 'lopsided:' + l.kind;
      if (off(key)) return;
      const pullSide = l.kind === 'pushpull';
      const muscleCovered = !pullSide && cards.some((c) => c.muscle === 'hamstrings');
      if (muscleCovered) return;
      const exId = pullSide ? candidate(sessions, plan, (e) => e.pattern === 'hpull') : candidate(sessions, plan, (e) => e.main === 'hamstrings');
      if (!exId) return;
      const day = dayFor(plan, exId);
      cards.push({
        key, kind: 'lopsided', add: { ex: exId, day, sets: 2 },
        title: pullSide ? `Pushing ${l.a} sets, pulling ${l.b}` : `Quads ${fmtSets(l.a)}, hamstrings ${fmtSets(l.b)}`,
        reason: `A nudge, not a rule: there's little evidence for a fixed ratio. Add 2 sets of ${D().ex(exId).name.toLowerCase()} to ${dayName(day)}?`,
        actions: [{ id: 'add', label: `Add to ${dayName(day)}` }],
      });
    });
  }
  return { ms, ps, missed, missingPatterns, lopsided, stalled, cards: cards.slice(0, 3), ready, push, pull };
}

// A close variation for a stalled lift: same main muscle and pattern, different exercise.
// Other versions to swap a stalled lift for: the same movement on other kit first.
function variations(exId, profile) {
  return D().alternatives(exId, null, profile).filter((e) => e.main === (D().ex(exId) || {}).main).slice(0, 14);
}

/* Example history: eight weeks of Upper / Lower on a simple capacity model, built with the
   app's own targets so it progresses the way a real lifter using Chalk would. Bench stalls for
   the last four weeks, and last Friday's session was missed. Marked `x` so it can be cleared. */
function example(plan, settings, now) {
  let seed = 20260930;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const start = { bench: 70, bbRow: 60, ohp: 40, latPulldown: 55, latRaise: 8, dbCurl: 12, squat: 90, rdl: 80, legPress: 140, calfRaise: 60, legRaise: 0,
    dbIncline: 24, pullUp: 0, cableRow: 55, dbOhp: 18, facePull: 20, pushdown: 25, deadlift: 120, splitSquat: 16, legExt: 45, seatedCalf: 40, cableCrunch: 30 };
  const cap = {};
  const lo = {};
  plan.days.forEach((d) => d.items.forEach((i) => { lo[i.ex] = i.lo; }));
  // Capacity starts two reps above the bottom of each range: e1RM for loaded lifts, reps for bodyweight.
  Object.entries(start).forEach(([k, w]) => { cap[k] = w > 0 ? w * (1 + ((lo[k] || 8) + 2) / 30) : (lo[k] || 8) + 1; });
  const growth = (k, week) => (k === 'bench' && week >= 4 ? -0.004 : start[k] > 0 ? 0.022 : 0.05);
  const sessions = [];
  const t0 = new Date(now);
  t0.setHours(18, 10, 0, 0);
  const weekdays = { 1: 0, 2: 1, 4: 2, 5: 3 };
  let lastFridaySkipped = false;
  for (let back = 56; back >= 1; back--) {
    const day = new Date(t0.getTime() - back * DAY);
    const wd = day.getDay();
    if (!(wd in weekdays)) continue;
    if (wd === 5 && !lastFridaySkipped && back <= 7) { lastFridaySkipped = true; continue; }
    const di = weekdays[wd];
    const d = plan.days[di];
    const week = Math.floor((56 - back) / 7);
    const s = { id: 'x' + day.getTime().toString(36), dayId: d.id, day: d.name, start: day.getTime(), end: day.getTime() + 58 * 60e3, sets: [], x: true, u: now };
    let t = s.start;
    d.items.forEach((item) => {
      const k = item.ex;
      if (!(k in cap)) return;
      cap[k] *= 1 + growth(k, week) + (rnd() - 0.5) * 0.004;
      const tg = target(item, sessions, settings);
      let w = tg.kind === 'first' ? (start[k] || 0) : tg.sets[0].w;
      tg.sets.forEach((st, i) => {
        const fatigue = 1 - i * 0.025;
        const possible = w > 0 ? Math.floor(30 * ((cap[k] * fatigue) / w - 1)) : Math.floor(cap[k] * fatigue);
        const r = Math.max(1, Math.min(st.r + (rnd() < 0.25 ? 1 : 0), possible, item.hi + 1));
        t += 150e3;
        const e = i === tg.sets.length - 1 && rnd() < 0.5 ? 2 : r >= item.hi && rnd() < 0.3 ? 1 : 0;
        s.sets.push({ ex: k, w: r25(w), r, e, wu: false, t });
      });
    });
    sessions.push(s);
  }
  return sessions;
}

CH.engine = { agoText, planDose, planWeekly, lastGain, e1rm, target, prsFor, isPR, muscleSets, patternSets, patternLast, weekly, best, latestPR, mainLifts, perWeek, stalls, review, variations, example, weekStart, fmtKg, fmtSets, recent, DAY };
