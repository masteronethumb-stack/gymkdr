/* GYMKDR · core: utilities, events, device storage, the store, routines, haptics, sound, keep-awake.
   Ported from Chalk's core.js. The data lives on the phone (AsyncStorage). Every key is loaded into
   memory once at launch, so the rest of the app reads and writes it the way Chalk used
   localStorage; each write goes through to the phone straight away. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import CH from '../ch';

/* ---------------- utilities ---------------- */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad2 = (n) => String(n).padStart(2, '0');
const U = (CH.u = {
  clamp,
  f1: (n) => Math.round(n * 10) / 10,
  // Text going into a short HTML snippet (a wheel's description, a toast): ui/Rich decodes it again.
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; },
  plural: (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's'),
  kg(w) { const v = Math.round(w * 4) / 4; return Number.isInteger(v) ? String(v) : String(v).replace(/0+$/, ''); },
  sets(v) { return Number.isInteger(v) ? String(v) : v.toFixed(1); },
  clock(ms) { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + pad2(s % 60); },
  mins(ms) { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); },
  dayLabel(ts) { return new Date(ts).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); },
  shortDate(ts) { return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); },
  ago(ts, now = Date.now()) {
    const d = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 864e5);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? d + ' days ago' : U.shortDate(ts);
  },
  id: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  later: (ms) => new Promise((r) => setTimeout(r, ms)),
  monthKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); },
  median(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; },
  mean: (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0),
  // A clean curve through noisy samples: least-squares quadratic, lowered so it never rises more
  // than `tol` above the samples (so it stays inside a reach).
  fitCurve(ys, tol = 8) {
    const n = ys.length, t = (i) => i / Math.max(1, n - 1);
    const S = [0, 0, 0, 0, 0], B = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const x = t(i);
      let p = 1;
      for (let k = 0; k <= 4; k++) { S[k] += p; if (k <= 2) B[k] += ys[i] * p; p *= x; }
    }
    const M = [[S[0], S[1], S[2], B[0]], [S[1], S[2], S[3], B[1]], [S[2], S[3], S[4], B[2]]];
    for (let c = 0; c < 3; c++) {
      let piv = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      [M[c], M[piv]] = [M[piv], M[c]];
      if (Math.abs(M[c][c]) < 1e-12) return ys.slice();
      for (let r = 0; r < 3; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
      }
    }
    const a = M[0][3] / M[0][0], b = M[1][3] / M[1][1], c = M[2][3] / M[2][2];
    const fit = ys.map((_, i) => a + b * t(i) + c * t(i) * t(i));
    let over = 0;
    for (let i = 0; i < n; i++) over = Math.max(over, fit[i] - ys[i]);
    const drop = Math.max(0, over - tol);
    return fit.map((v) => v - drop);
  },
});

/* ---------------- events ---------------- */
const handlers = {};
CH.bus = {
  on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); return () => { handlers[evt] = (handlers[evt] || []).filter((f) => f !== fn); }; },
  emit(evt, data) { (handlers[evt] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
};

/* ---------------- device storage ----------------
   Everything under the app's prefix is read into memory at launch (loadStorage, before the first
   screen). Reads come from memory; writes go to memory and then to the phone. A write the phone
   refuses is reported, never treated as saved. */
const LS = 'gymkdr1.';
const mem = new Map();
const failedWrites = new Set();
async function loadStorage() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(LS));
    const pairs = keys.length ? await AsyncStorage.multiGet(keys) : [];
    pairs.forEach(([k, v]) => { if (v != null) mem.set(k, v); });
  } catch (e) { /* the app still runs, from memory, and says nothing was saved */ }
}
const ls = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem(k, v) {
    const text = String(v);
    mem.set(k, text);
    AsyncStorage.setItem(k, text).then(() => { if (failedWrites.delete(k)) refreshUnsaved(); }).catch(() => { failedWrites.add(k); refreshUnsaved(); });
  },
  removeItem(k) { mem.delete(k); AsyncStorage.removeItem(k).catch(() => {}); },
  keys: () => Array.from(mem.keys()),
};
const local = (CH.local = {
  get(k, d) {
    const v = ls.getItem(LS + k);
    if (v == null) return d;
    try { return JSON.parse(v); } catch (e) {
      // Damaged text is kept aside, not thrown away, so a later save can't erase it unseen.
      ls.setItem(LS + 'damaged.' + k + '.' + Date.now(), v);
      CH.bus.emit('notice', 'Some saved data on this phone was damaged. A copy is kept; Settings → Download a full backup includes it.');
      return d;
    }
  },
  set(k, v) { try { ls.setItem(LS + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  remove(k) { ls.removeItem(LS + k); },
});

const K = { state: 'state', sessions: 'sessions' };

const defaults = () => ({
  rest: 90,
  restOn: true,
  inc: { barbell: 2.5, dumbbell: 2, kettlebell: 4, machine: 5, plate: 5, smith: 2.5, cable: 2.5, bodyweight: 2.5 },
  haptics: true,
  sound: true,
  motion: reduceMotion ? 'reduced' : 'full',
  tracked: null, // filled from the muscle list on first run
  beginner: false, // new to the gym: machines and easier versions first, numbers explained
  // GYMKDR is the vertical build: a menu's choices rise in a column above the button.
  split: 'vertical',
});
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((on) => { reduceMotion = !!on; }).catch(() => {});

/* Routines. A lifter keeps any number; one is in use, and `state.plan` always means that one.
   `plan` is a getter that isn't saved: the routines list is the only copy. */
const EMPTY = () => ({ id: null, name: '', days: [], next: 0 });
function link(state) {
  let stub = EMPTY();
  Object.defineProperty(state, 'plan', {
    configurable: true,
    enumerable: false,
    get() { return state.routines.find((r) => r.id === state.current) || stub; },
    set(v) {
      const r = state.routines.find((x) => x.id === state.current);
      if (r) { r.days = v.days || []; r.next = v.next || 0; } else { stub = EMPTY(); CH.routines.add(Object.assign({ name: 'My routine', kind: 'custom' }, v)); }
    },
  });
  return state;
}
const fresh = () => link({ v: 7, updatedAt: 0, onboarded: false, settings: defaults(), routines: [], current: null, custom: {}, dismissed: {}, active: null, learn: { picks: 0 } });
const cleanRoutine = (r) => {
  if (!r.id) r.id = U.id();
  // Damaged days and exercises (from an edited backup, say) are dropped rather than crashing the app.
  r.days = Array.isArray(r.days) ? r.days.filter((d) => d && typeof d === 'object') : [];
  r.days.forEach((d) => {
    if (!d.id) d.id = U.id();
    d.items = Array.isArray(d.items) ? d.items.filter((it) => it && typeof it === 'object' && typeof it.ex === 'string' && it.ex) : [];
    d.parts = Array.isArray(d.parts) ? d.parts.filter((x) => typeof x === 'string') : [];
  });
  if (!(r.next >= 0 && r.next < Math.max(1, r.days.length))) r.next = 0;
  if (!r.name) r.name = 'My routine';
  if (!r.kind) r.kind = 'custom';
  if (!r.profile) r.profile = 'gym';
  if (!r.made) r.made = Date.now();
  // Training days: how many a week, and which (0 = Monday), or null for none set.
  if (r.week && typeof r.week === 'object') {
    const days = Array.isArray(r.week.days) ? Array.from(new Set(r.week.days.filter((d) => Number.isInteger(d) && d >= 0 && d < 7))).sort() : null;
    const n = days && days.length ? days.length : Math.round(Number(r.week.n));
    r.week = n >= 1 && n <= 7 ? { n, days: days && days.length ? days : null } : null;
  } else r.week = null;
  return r;
};

function normalise(s) {
  const f = fresh();
  if (!s || typeof s !== 'object') return f;
  const src = Object.assign({}, s);
  delete src.plan; delete src.routine;
  const out = Object.assign(f, src);
  out.settings = Object.assign(defaults(), s.settings && typeof s.settings === 'object' ? s.settings : {});
  // A setting of the wrong kind (from an edited backup, say) goes back to its default.
  const def = defaults();
  Object.keys(def).forEach((k) => { if (def[k] !== null && typeof out.settings[k] !== typeof def[k]) out.settings[k] = def[k]; });
  out.settings.inc = Object.assign(defaults().inc, (s.settings && s.settings.inc && typeof s.settings.inc === 'object') ? s.settings.inc : {});
  Object.keys(out.settings.inc).forEach((k) => { if (!(Number(out.settings.inc[k]) > 0)) out.settings.inc[k] = defaults().inc[k] || 2.5; });
  if (!Array.isArray(out.settings.tracked)) out.settings.tracked = CH.data.defaultTracked();
  else out.settings.tracked = out.settings.tracked.filter((m) => typeof m === 'string');
  out.settings.split = 'vertical';
  out.routines = Array.isArray(out.routines) ? out.routines.filter((r) => r && typeof r === 'object').map(cleanRoutine) : [];
  if (!out.routines.some((r) => r.id === out.current)) out.current = out.routines.length ? out.routines[0].id : null;
  out.v = 7;
  if (!out.custom || typeof out.custom !== 'object' || Array.isArray(out.custom)) out.custom = {};
  Object.keys(out.custom).forEach((k) => {
    const e = out.custom[k];
    if (!e || typeof e !== 'object' || typeof e.name !== 'string') { delete out.custom[k]; return; }
    e.id = k;
    if (!CH.data.EQUIPMENT[e.eq]) e.eq = 'machine';
    if (!Array.isArray(e.help)) e.help = [];
    if (!Array.isArray(e.aliases)) e.aliases = [];
  });
  if (!out.dismissed || typeof out.dismissed !== 'object') out.dismissed = {};
  if (!out.learn || typeof out.learn !== 'object') out.learn = { picks: 0 };
  if (!Number.isFinite(out.learn.picks)) out.learn.picks = 0;
  return out;
}
const liveSession = (s) => s && typeof s === 'object' && s.id && !s.del && Array.isArray(s.sets) && Number.isFinite(s.start);
// A record that can be kept: a workout with sets, or a deletion marker. Anything else is ignored.
const validRecord = (r) => r && typeof r === 'object' && typeof r.id === 'string' && r.id && Number.isFinite(r.start) && (r.del || Array.isArray(r.sets));
// A logged set: an exercise, and for weights a number of reps and a weight.
const okSet = (x) => !!x && typeof x === 'object' && typeof x.ex === 'string' && !!x.ex && (x.c ? true : Number.isFinite(x.w) && Number.isFinite(x.r));
const own = (r) => { const c = JSON.parse(JSON.stringify(r)); if (!c.del) c.sets = c.sets.filter(okSet); return c; };
const setKey = (x) => `${x.t || 0}|${x.ex}`;
// A set as history keeps it (the workout in progress also carries item ids and cardio settings).
const recordSet = (x) => (x.c ? { ex: x.ex, c: true, w: 0, r: 0, s: x.s || 0, d: x.d || 0, set: x.set || {}, e: x.e || 0, wu: false, t: x.t } : { ex: x.ex, w: x.w, r: x.r, e: x.e || 0, wu: !!x.wu, t: x.t });
// Two copies of one workout's sets, joined: every set from either, in the order they were done.
const joinSets = (first, second) => { const have = new Set(first.map(setKey)); return first.concat(second.filter((x) => !have.has(setKey(x)))).sort((a, b) => (a.t || 0) - (b.t || 0)); };

/* Every write goes through here. A failed write is never treated as saved: the store says "Not
   saved" and a notice tells the lifter to download a backup, until a later write succeeds. */
function persist(k, value) {
  const ok = local.set(k, value);
  if (!ok) { failedWrites.add(LS + k); refreshUnsaved(); }
  return ok;
}
function refreshUnsaved() {
  const was = store.unsaved;
  store.unsaved = failedWrites.size > 0;
  if (store.unsaved && !was) CH.bus.emit('notice', "This phone couldn't save your changes. Keep GYMKDR open and download a backup from Settings.");
  if (store.unsaved !== was) CH.bus.emit('sync', store.unsaved ? 'unsaved' : 'device');
}

const store = (CH.store = {
  status: 'device',
  unsaved: false,
  state: fresh(),
  all: [], // every session record, deletion markers included
  load: loadStorage,
  init() {
    this.state = normalise(local.get(K.state, null));
    if (!this.state.settings.tracked) this.state.settings.tracked = CH.data.defaultTracked();
    const s = local.get(K.sessions, []);
    this.all = Array.isArray(s) ? s.filter(validRecord).map(own) : [];
  },
  sessions() { return this.all.filter(liveSession).sort((a, b) => a.start - b.start); },
  recordSet, joinSets, okSet,
  save() {
    this.state.updatedAt = Math.max(Date.now(), (this.state.updatedAt || 0) + 1);
    persist(K.state, this.state);
    CH.bus.emit('saved');
  },
  upsert(session) {
    session.u = Date.now();
    const i = this.all.findIndex((x) => x.id === session.id);
    if (i >= 0) this.all[i] = session; else this.all.push(session);
    persist(K.sessions, this.all);
  },
  upsertMany(list) {
    const now = Date.now();
    list.forEach((session) => {
      session.u = now;
      const i = this.all.findIndex((x) => x.id === session.id);
      if (i >= 0) this.all[i] = session; else this.all.push(session);
    });
    if (list.length) persist(K.sessions, this.all);
  },
  remove(pred) {
    let n = 0;
    this.all.forEach((s, i) => {
      if (!s.del && pred(s)) { this.all[i] = { id: s.id, start: s.start, del: true, u: Date.now() }; n++; }
    });
    if (n) persist(K.sessions, this.all);
    return n;
  },
  reset() {
    const keep = this.state.settings;
    this.all = [];
    persist(K.sessions, this.all);
    ls.keys().filter((k) => k.startsWith(LS + 'damaged.')).forEach((k) => ls.removeItem(k));
    this.state = fresh();
    this.state.settings = Object.assign(defaults(), { haptics: keep.haptics, sound: keep.sound, motion: keep.motion, tracked: CH.data.defaultTracked() });
    this.save();
  },
  flush() { /* every write already goes straight to the phone */ },
  // No account sync in GYMKDR: there is never another device's copy to choose.
  otherState: () => null,
  useOtherState() {},
  // A full backup: everything needed to rebuild GYMKDR on another phone.
  backup() {
    const damaged = {};
    ls.keys().filter((k) => k.startsWith(LS + 'damaged.')).forEach((k) => { damaged[k.slice(LS.length)] = ls.getItem(k); });
    return { format: 'gymkdr-backup', version: 1, made: new Date().toISOString(), state: JSON.parse(JSON.stringify(this.state)), sessions: JSON.parse(JSON.stringify(this.all)), damaged };
  },
  /* What a backup holds, checked before anything is changed: whether it can be used at all, and
     how many damaged routines or workouts would be left out. Chalk backups are read too. */
  checkBackup(b) {
    if (!b || (b.format !== 'gymkdr-backup' && b.format !== 'chalk-backup') || !b.state || typeof b.state !== 'object' || !Array.isArray(b.sessions)) return { ok: false, why: "That isn't a GYMKDR backup." };
    if (b.state.routines != null && !Array.isArray(b.state.routines)) return { ok: false, why: 'That backup is damaged: its routines are unreadable. Nothing was changed.' };
    const rs = b.state.routines || [];
    const badRoutine = (r) => !r || typeof r !== 'object' || (r.days != null && !Array.isArray(r.days)) || (r.days || []).some((d) => !d || typeof d !== 'object' || (d.items != null && !Array.isArray(d.items)) || (d.items || []).some((it) => !it || typeof it !== 'object' || typeof it.ex !== 'string'));
    const badWorkout = (x) => !validRecord(x) || (!x.del && x.sets.some((y) => !okSet(y)));
    return { ok: true, routines: rs.filter((r) => r && typeof r === 'object').length, workouts: b.sessions.filter((x) => validRecord(x) && !x.del).length, damagedRoutines: rs.filter(badRoutine).length, damagedWorkouts: b.sessions.filter(badWorkout).length };
  },
  /* Restoring a backup. "Add" keeps everything here and only adds what this phone is missing.
     "Replace" makes this phone match the backup. Either way a workout in progress here is kept.
     The new copy is built first and swapped in at the end, so a backup that fails part-way
     changes nothing. */
  restore(b, replace) {
    const theirs = normalise(b.state);
    const recs = (Array.isArray(b.sessions) ? b.sessions : []).filter(validRecord).map(own);
    const now = Date.now();
    let all = this.all.slice(), state = this.state, added = 0;
    if (replace) {
      const keep = new Set(recs.map((r) => r.id));
      all = all.map((x) => (!x.del && !keep.has(x.id) ? { id: x.id, start: x.start, del: true, u: now } : x));
      recs.forEach((r) => { r.u = Math.max(now, r.u || 0); const i = all.findIndex((x) => x.id === r.id); if (i >= 0) all[i] = r; else all.push(r); });
      if (this.state.active) theirs.active = this.state.active;
      state = theirs;
      added = recs.filter((r) => !r.del).length;
    } else {
      recs.filter((r) => !r.del).forEach((r) => {
        const i = all.findIndex((x) => x.id === r.id);
        if (i >= 0 && !all[i].del) return;
        r.u = now;
        if (i >= 0) all[i] = r; else all.push(r);
        added++;
      });
      theirs.routines.forEach((r) => { if (!state.routines.some((x) => x.id === r.id)) state.routines.push(r); });
      Object.keys(theirs.custom).forEach((k) => { if (!state.custom[k]) state.custom[k] = theirs.custom[k]; });
      if (!state.current && state.routines.length) state.current = state.routines[0].id;
    }
    this.all = all;
    this.state = state;
    persist(K.sessions, this.all);
    this.save();
    return { workouts: added, routines: theirs.routines.length };
  },
});

/* ---------------- routines ---------------- */
CH.routines = {
  list: () => store.state.routines,
  active: () => store.state.routines.find((r) => r.id === store.state.current) || null,
  get: (id) => store.state.routines.find((r) => r.id === id) || null,
  // A name nobody else is using: "Push / Pull / Legs", then "… · Dumbbells", then "… 2".
  freeName(name, extra) {
    const taken = new Set(store.state.routines.map((r) => r.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    if (extra && !taken.has((name + ' · ' + extra).toLowerCase())) return name + ' · ' + extra;
    for (let n = 2; ; n++) if (!taken.has((name + ' ' + n).toLowerCase())) return name + ' ' + n;
  },
  add(r, activate = true) {
    cleanRoutine(r);
    store.state.routines.push(r);
    if (activate || !store.state.current) store.state.current = r.id;
    store.state.onboarded = true;
    store.save();
    return r;
  },
  activate(id) {
    if (!this.get(id)) return;
    store.state.current = id;
    store.save();
  },
  remove(id) {
    const st = store.state;
    st.routines = st.routines.filter((r) => r.id !== id);
    if (st.current === id) st.current = st.routines.length ? st.routines[0].id : null;
    store.save();
  },
  /* The week: any number of routines can each be put on any weekday (0 = Monday), and a day can
     hold more than one (weights, then a run). */
  onDay: (d) => store.state.routines.filter((r) => r.week && Array.isArray(r.week.days) && r.week.days.includes(d)),
  setDay(r, d, on) {
    const ds = new Set((r.week && r.week.days) || []);
    if (on) ds.add(d); else ds.delete(d);
    const days = Array.from(ds).sort((a, b) => a - b);
    r.week = days.length ? { n: days.length, days } : null;
    store.save();
  },
  // A routine that's only cardio (a run on its own days): no body parts to check.
  isCardio: (r) => { const items = r ? r.days.flatMap((d) => d.items) : []; return !!r && (r.kind === 'cardio' || (items.length > 0 && items.every((it) => it.cardio))); },
  /* When a day in a routine was last done: its own workouts, or one logged under the same name that
     doesn't say which routine it came from (imported, or older). */
  lastDone(day, sessions, routine) {
    for (let i = sessions.length - 1; i >= 0; i--) {
      const s = sessions[i];
      if (s.dayId === day.id || (s.day === day.name && (!s.routineId || (routine && s.routineId === routine.id)))) return s;
    }
    return null;
  },
};

/* ---------------- haptics: one meaning each, and an off switch ---------------- */
CH.haptic = (kind) => {
  if (!store.state.settings.haptics || Platform.OS === 'web') return;
  try {
    if (kind === 'select') Haptics.selectionAsync();
    else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === 'pr') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'impact') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // success: a set logged, a choice made
  } catch (e) { /* haptics are optional */ }
};

/* ---------------- sound: short tones that mix with the lifter's own music ----------------
   The tones are small WAV files (assets/sounds). The audio session mixes with other apps' audio
   and respects the silent switch. */
const SOUNDS = {
  rest: require('../../assets/sounds/rest.wav'),
  pr: require('../../assets/sounds/pr.wav'),
  done: require('../../assets/sounds/done.wav'),
};
const players = {};
let audioReady = false;
async function audioSetup() {
  if (audioReady) return;
  audioReady = true;
  try { await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }); } catch (e) { /* optional */ }
}
CH.sound = {
  unlock() { audioSetup(); },
  play(kind) {
    if (!store.state.settings.sound || AppState.currentState !== 'active') return;
    audioSetup();
    try {
      const src = SOUNDS[kind] || SOUNDS.done;
      let p = players[kind];
      if (!p) { p = players[kind] = createAudioPlayer(src); p.volume = kind === 'done' ? 0.5 : 0.9; }
      p.seekTo(0).catch(() => {});
      p.play();
    } catch (e) { /* sound is optional */ }
  },
};

/* ---------------- the screen stays on while a workout runs ---------------- */
let awake = false;
CH.wake = {
  on() { if (awake) return; awake = true; activateKeepAwakeAsync('workout').catch(() => { awake = false; }); },
  off() { if (!awake) return; awake = false; deactivateKeepAwake('workout').catch(() => {}); },
};
