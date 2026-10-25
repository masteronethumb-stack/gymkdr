/* GYMKDR · cardio. Cardio is one more thing a workout holds, chosen with the same thumb wheel:
   the type (walk, run, cycle, row…), the machine (treadmill, rower…), its settings (speed and
   incline, level, damper…) and the time. During the workout the button runs a timer: Start, then
   Stop when you're done. Chalk then asks for the result the machine shows (distance, floors or
   calories, lit on its best guess) and how hard it felt, by the talk test. Done already? Slide on
   Start to log the minutes instead.

   A cardio exercise's id is "cardio:<type>:<machine>". In a routine it's an item
   { ex, cardio: true, min, set: { speed: 9, incline: 1 } }. Logged, it's a set with c: true:
   { ex, c, s (seconds), d (in the machine's unit), set, e (1 Easy … 4 All out), w: 0, r: 0, t },
   so everything that counts lifting sets (r > 0) leaves it alone. */
import CH from '../ch';
const U = CH.u;

const S = () => CH.store;

// Ordered so the usual ones sit together: Walk (lit first) between Run and Row, Cycle beside Run.
const TYPES = [
  { id: 'cycle', name: 'Cycle', machines: ['upright', 'spin', 'recumbent', 'airbike', 'road'], min: 30, about: 'Any bike, in the gym or out on the road.' },
  { id: 'run', name: 'Run', machines: ['treadmill', 'outside'], min: 20, about: 'Jogging or running.' },
  { id: 'walk', name: 'Walk', machines: ['treadmill', 'outside'], min: 30, about: 'Brisk walking, flat or uphill.' },
  { id: 'row', name: 'Row', machines: ['rower'], min: 15, about: 'The rowing machine: legs, back and lungs together.' },
  { id: 'cross', name: 'Cross-trainer', machines: ['elliptical'], min: 20, about: 'The elliptical: easy on the knees.' },
  { id: 'stairs', name: 'Stairs', machines: ['stairmill', 'stepper'], min: 15, about: 'The stair climber or a stepper.' },
  { id: 'ski', name: 'Ski erg', machines: ['skierg'], min: 10, about: 'Pulling down on two handles, standing up.' },
  { id: 'swim', name: 'Swim', machines: ['pool'], min: 30, about: 'Laps of the pool.' },
];
// Each machine: its settings (what you set on it) and the result it shows at the end.
const MACHINES = {
  treadmill: { name: 'Treadmill', settings: ['speed', 'incline'], result: 'km' },
  outside: { name: 'Outside', settings: [], result: 'km' },
  upright: { name: 'Upright bike', settings: ['level'], result: 'km' },
  spin: { name: 'Spin bike', settings: ['resistance'], result: 'km' },
  recumbent: { name: 'Recumbent bike', settings: ['level'], result: 'km', about: 'The bike with a seat back.' },
  airbike: { name: 'Air bike', settings: [], result: 'cal', about: 'The fan bike: the harder you go, the harder it gets.' },
  road: { name: 'Outside', settings: [], result: 'km' },
  rower: { name: 'Rowing machine', settings: ['damper'], result: 'm' },
  stairmill: { name: 'Stair climber', settings: ['level'], result: 'floors', about: 'The moving staircase.' },
  stepper: { name: 'Stepper', settings: ['level'], result: 'floors', about: 'Two pedals you step down on.' },
  elliptical: { name: 'Cross-trainer', settings: ['level', 'ramp'], result: 'km' },
  skierg: { name: 'Ski erg', settings: ['damper'], result: 'm' },
  pool: { name: 'Pool', settings: ['stroke'], result: 'm' },
};
const NAMES = {
  'walk:treadmill': 'Treadmill walk', 'walk:outside': 'Walk outside', 'run:treadmill': 'Treadmill run', 'run:outside': 'Run outside',
  'cycle:upright': 'Upright bike', 'cycle:spin': 'Spin bike', 'cycle:recumbent': 'Recumbent bike', 'cycle:airbike': 'Air bike', 'cycle:road': 'Ride outside',
  'row:rower': 'Rowing machine', 'stairs:stairmill': 'Stair climber', 'stairs:stepper': 'Stepper', 'cross:elliptical': 'Cross-trainer', 'ski:skierg': 'Ski erg', 'swim:pool': 'Swim',
};
// What each setting is, its range, and a sensible first value.
const SETTINGS = {
  speed: { name: 'Speed', about: 'What the treadmill shows, in km/h.', min: 2, max: 20, step: 0.5, def: { walk: 5.5, run: 9 }, fmt: (v) => `${U.kg(v)} km/h` },
  incline: { name: 'Incline', about: 'How steep the treadmill is. 1% feels like walking or running outside.', min: 0, max: 15, step: 0.5, def: 1, fmt: (v) => `${U.kg(v)}% incline` },
  level: { name: 'Level', about: 'The resistance level on the machine’s screen.', min: 1, max: 25, step: 1, def: 6, fmt: (v) => `Level ${v}` },
  resistance: { name: 'Resistance', about: 'The resistance knob or number on the bike.', min: 1, max: 30, step: 1, def: 8, fmt: (v) => `Resistance ${v}` },
  ramp: { name: 'Ramp', about: 'The incline or ramp setting, if it has one. 0 is flat.', min: 0, max: 20, step: 1, def: 0, fmt: (v) => `Ramp ${v}` },
  damper: { name: 'Damper', about: 'The lever on the side of the fan. 3 to 5 suits most people; higher is heavier, not better.', min: 1, max: 10, step: 1, def: 5, fmt: (v) => `Damper ${v}` },
  stroke: { name: 'Stroke', about: 'How you swam.', choices: ['Freestyle', 'Breaststroke', 'Backstroke', 'Mixed'], def: 'Freestyle', fmt: (v) => v },
};
// The result each machine shows: its unit, the steps the wheel moves in, and a guess per minute.
const RESULTS = {
  km: { name: 'Distance', unit: 'km', step: 0.1, max: 100, fmt: (v) => `${(Math.round(v * 10) / 10).toFixed(1)} km` },
  m: { name: 'Distance', unit: 'm', step: 10, max: 20000, fmt: (v) => `${v.toLocaleString('en-AU')} m` },
  floors: { name: 'Floors', unit: 'floors', step: 1, max: 400, fmt: (v) => `${v} floor${v === 1 ? '' : 's'}` },
  cal: { name: 'Calories', unit: 'cal', step: 1, max: 600, fmt: (v) => `${v} cal` },
};
const PER_MIN = { 'walk:outside': 0.09, 'run:outside': 0.16, 'cycle:upright': 0.4, 'cycle:spin': 0.45, 'cycle:recumbent': 0.35, 'cycle:airbike': 12, 'cycle:road': 0.45, 'row:rower': 230, 'stairs:stairmill': 3, 'stairs:stepper': 3, 'cross:elliptical': 0.15, 'ski:skierg': 220, 'swim:pool': 35 };
// How hard it felt, by the talk test.
const EFFORT = { 1: 'Easy', 2: 'Steady', 3: 'Hard', 4: 'All out' };
const EFFORT_HOW = { 1: 'You could chat the whole way', 2: 'Short sentences only', 3: 'A few words at a time', 4: 'No words left' };

const isCardio = (id) => typeof id === 'string' && id.startsWith('cardio:');
const cache = new Map();
function ex(id) {
  if (!isCardio(id)) return null;
  if (cache.has(id)) return cache.get(id);
  const [, type, machine] = id.split(':');
  const t = TYPES.find((x) => x.id === type), m = MACHINES[machine];
  if (!t || !m || !t.machines.includes(machine)) return null;
  const e = { id, name: NAMES[type + ':' + machine] || `${t.name}, ${m.name.toLowerCase()}`, eq: 'cardio', cardio: true, type, machine, main: null, help: [], pattern: null, compound: false, aliases: [] };
  cache.set(id, e);
  return e;
}
const typeOf = (id) => TYPES.find((t) => t.id === (ex(id) || {}).type);
const machineOf = (id) => MACHINES[(ex(id) || {}).machine] || { settings: [], result: null };
const resultOf = (id) => RESULTS[machineOf(id).result] || null;

/* ---------------- words ---------------- */
// The settings in words: "9 km/h · 1% incline".
function settingsText(exId, set) {
  return machineOf(exId).settings.filter((k) => set && set[k] != null && set[k] !== '').map((k) => SETTINGS[k].fmt(set[k])).join(' · ');
}
// A planned item: "20 min · 9 km/h · 1% incline".
function itemText(it) {
  const st = settingsText(it.ex, it.set);
  return `${it.min || 20} min${st ? ' · ' + st : ''}`;
}
const clockText = (sec) => { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`; };
// A logged entry: "20 min · 3.1 km · Steady".
function entryText(x, withSettings) {
  const res = resultOf(x.ex), st = withSettings ? settingsText(x.ex, x.set) : '';
  return [clockText(x.s || 0), x.d > 0 && res ? res.fmt(x.d) : '', st, x.e ? EFFORT[x.e] : ''].filter(Boolean).join(' · ');
}
// The last time this was logged, before now.
function last(exId) {
  const all = S().sessions();
  for (let i = all.length - 1; i >= 0; i--) {
    const hits = all[i].sets.filter((x) => x.c && x.ex === exId);
    if (hits.length) return Object.assign({ at: all[i].start }, hits[hits.length - 1]);
  }
  return null;
}
// Settings to start from: last time's, then the plan's, then each setting's first value.
function startSettings(exId, planned) {
  const t = (ex(exId) || {}).type, l = last(exId), out = {};
  machineOf(exId).settings.forEach((k) => {
    const d = SETTINGS[k].def;
    const v = l && l.set && l.set[k] != null ? l.set[k] : planned && planned[k] != null ? planned[k] : typeof d === 'object' && !Array.isArray(d) ? d[t] : d;
    if (v != null) out[k] = v;
  });
  return out;
}
const defaultMin = (exId) => { const l = last(exId); return l && l.s ? Math.max(1, Math.round(l.s / 60)) : (typeOf(exId) || { min: 20 }).min; };
// A guess at the result, to light on the wheel: a treadmill from its speed, the rest from last time.
function guess(exId, sec, set) {
  const res = resultOf(exId);
  if (!res) return null;
  const e = ex(exId), l = last(exId);
  let v;
  if (e.machine === 'treadmill' && set && set.speed) v = (set.speed * sec) / 3600;
  else if (l && l.d > 0 && l.s > 0) v = (l.d * sec) / l.s;
  else v = (PER_MIN[e.type + ':' + e.machine] || 0.1) * (sec / 60);
  return snap(v, res);
}
const snap = (v, res) => U.clamp(Math.round(Math.round(v / res.step) * res.step * 100) / 100, res.step, res.max);
// The type and machine used most recently, so the wheel opens on them.
function lastUsed() {
  const all = S().sessions();
  for (let i = all.length - 1; i >= 0; i--) { const x = all[i].sets.filter((y) => y.c && ex(y.ex)); if (x.length) return ex(x[x.length - 1].ex); }
  return null;
}

// Minutes in a span, with hard minutes (Hard, All out) counted twice, as the guidelines do.
function minutes(sessions, from, to) {
  let all = 0, weighted = 0;
  sessions.forEach((s) => s.sets.forEach((x) => {
    if (!x.c || !(x.t >= from && x.t < to)) return;
    const m = (x.s || 0) / 60;
    all += m;
    weighted += x.e >= 3 ? 2 * m : m;
  }));
  return { all: Math.round(all), weighted: Math.round(weighted) };
}

/* ---------------- choosing: type, machine, settings, time ----------------
   Each is a thumb wheel. `done({ ex, min, set })` runs at the end. `stopAt` ends the chain early:
   'machine' after the machine (the settings and time then come from last time). */
const open = (spec) => CH.scrub.open(spec, CH.stage.hubEl(), 'sticky');
function typeMenu(done, stopAt) {
  const lu = lastUsed();
  return {
    title: 'Cardio: what kind?', keep: true, start: Math.max(0, TYPES.findIndex((t) => t.id === (lu ? lu.type : 'walk'))),
    options: TYPES.map((t) => ({ label: t.name, sub: t.machines.map((m) => MACHINES[m].name).filter((v, i, a) => a.indexOf(v) === i).join(', '), icon: 'flag', info: `<p>${U.esc(t.about)}</p>`, act: () => (t.machines.length > 1 ? open(machineMenu(t, done, stopAt)) : picked(`cardio:${t.id}:${t.machines[0]}`, done, stopAt)) })),
  };
}
function machineMenu(t, done, stopAt) {
  const lu = lastUsed();
  return {
    title: `${t.name}: which machine?`, keep: true, start: lu && lu.type === t.id ? Math.max(0, t.machines.indexOf(lu.machine)) : 0,
    options: t.machines.map((m) => {
      const id = `cardio:${t.id}:${m}`, l = last(id), mc = MACHINES[m];
      return { label: mc.name, title: NAMES[t.id + ':' + m], sub: l ? `Last time ${entryText(l)}` : mc.settings.length ? `Set: ${mc.settings.map((k) => SETTINGS[k].name.toLowerCase()).join(' and ')}` : 'Nothing to set', icon: 'flag', info: mc.about ? `<p>${U.esc(mc.about)}</p>` : '', act: () => picked(id, done, stopAt) };
    }),
  };
}
function picked(id, done, stopAt) {
  if (stopAt === 'machine') { done({ ex: id, min: defaultMin(id), set: startSettings(id) }); return; }
  settingsChain(id, startSettings(id), 0, (set) => open(timeMenu(id, defaultMin(id), (min) => done({ ex: id, min, set }))));
}
// One wheel per setting, in turn; each opens on the current value.
function settingsChain(id, set, k, done) {
  const keys = machineOf(id).settings;
  if (k >= keys.length) { done(set); return; }
  open(settingMenu(id, keys[k], set[keys[k]], (v) => { set[keys[k]] = v; settingsChain(id, set, k + 1, done); }));
}
function settingMenu(id, key, cur, onPick) {
  const s = SETTINGS[key], e = ex(id), l = last(id);
  const lastV = l && l.set ? l.set[key] : null;
  let vals;
  if (s.choices) vals = s.choices.slice();
  else { vals = []; for (let v = s.min; v <= s.max + 1e-9; v += s.step) vals.push(Math.round(v * 100) / 100); }
  const at = Math.max(0, vals.indexOf(cur));
  return {
    title: `${e.name}: ${s.name.toLowerCase()}`,
    options: vals.map((v) => ({ label: s.fmt(v), sub: v === lastV ? 'Last time' : v === cur ? 'Now' : null, icon: 'flag', info: `<p>${U.esc(s.about)}</p>`, act: () => onPick(v) })),
    start: at, keep: true, ordered: !s.choices,
  };
}
function timeMenu(id, cur, onPick, title) {
  const e = ex(id), l = last(id), lastM = l && l.s ? Math.round(l.s / 60) : null;
  const options = [];
  for (let m = 1; m <= 180; m++) options.push({ label: `${m} min`, sub: m === lastM ? 'Last time' : null, icon: 'timer', info: `<p>${U.esc(title ? 'How long it took.' : 'How long you plan to go for. The timer can run longer or stop sooner on the day.')}</p>`, act: () => onPick(m) });
  return { title: title || `${e.name}: how long?`, options, start: U.clamp(cur, 1, 180) - 1, keep: true, ordered: true };
}

/* ---------------- the result: how far (or floors, or calories), then how hard ---------------- */
function resultMenu(exId, sec, set, onPick) {
  const res = resultOf(exId), e = ex(exId);
  if (!res) { onPick(0); return null; }
  const g = guess(exId, sec, set), l = last(exId);
  const vals = [];
  for (let v = res.step; v <= res.max + 1e-9; v += res.step) vals.push(Math.round(v * 100) / 100);
  const options = [{ label: 'Skip this', sub: `No ${res.name.toLowerCase()} today`, icon: 'next', info: '<p>Logged with its time only.</p>', act: () => onPick(0) }];
  vals.forEach((v) => options.push({ label: res.fmt(v), sub: l && l.d === v ? 'Last time' : v === g ? 'Our guess' : null, icon: 'flag', info: `<p>What the ${U.esc(e.machine === 'outside' || e.machine === 'road' ? 'watch or app' : 'machine')} shows. ${e.machine === 'treadmill' ? 'Lit on speed × time.' : l ? 'Lit on last time’s pace.' : 'Lit on a typical pace.'}</p>`, act: () => onPick(v) }));
  return { title: `${e.name} · ${clockText(sec)}: ${res.name.toLowerCase()}?`, options, start: Math.max(1, vals.indexOf(g) + 1), keep: true, ordered: true, coach: 'Slide to what the machine shows, then tap the button.' };
}
function effortMenu(onPick) {
  return {
    title: 'How hard did it feel?',
    options: [1, 2, 3, 4].map((k) => ({ label: EFFORT[k], sub: EFFORT_HOW[k], icon: 'light', info: `<p>The talk test: ${U.esc(EFFORT_HOW[k].toLowerCase())}.</p>${k >= 3 ? '<p>Hard minutes count twice towards your week.</p>' : ''}`, act: () => onPick(k) })),
    start: 1, keep: true, ordered: true,
  };
}
// After the timer stops (or the minutes are picked): result, then effort, then `done({ d, e })`.
function result(exId, sec, set, done) {
  const after = (d) => open(effortMenu((e) => done({ d, e })));
  const spec = resultMenu(exId, sec, set, after);
  if (spec) CH.scrub.root(spec);
}

CH.cardio = {
  TYPES, MACHINES, SETTINGS, RESULTS, EFFORT,
  isCardio, ex, typeMenu, settingsChain, timeMenu, result, resultMenu, effortMenu, settingsText, itemText, entryText, clockText, last, startSettings, defaultMin, minutes,
  open,
};
