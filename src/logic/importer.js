/* GYMKDR · importer: Strong and Hevy CSV exports into workouts.
   Columns are found by name, so small format changes between app versions don't break it.
   Re-importing the same file updates the same workouts instead of duplicating them. */
import CH from '../ch';
const U = CH.u;

const D = () => CH.data;

function csvRows(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const norm = (s) => String(s || '').toLowerCase().replace(/[()\-/,]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
let aliasMap = null;
function aliases() {
  if (aliasMap) return aliasMap;
  aliasMap = new Map();
  D().EXERCISES.forEach((e) => {
    aliasMap.set(norm(e.name), e.id);
    const word = D().EQ_WORD[e.eq];
    [norm(e.name + ' ' + e.eq), norm(e.name + ' ' + word)].forEach((k) => { if (!aliasMap.has(k)) aliasMap.set(k, e.id); });
    e.aliases.forEach((a) => aliasMap.set(norm(a), e.id));
  });
  return aliasMap;
}
// Equipment words in an exercise's name, most specific first ("smith machine" before "machine").
const EQ_WORDS = { 'smith machine': 'smith', 'plate loaded': 'plate', kettlebell: 'kettlebell', barbell: 'barbell', dumbbell: 'dumbbell', 'ez bar': 'barbell', 'trap bar': 'barbell', machine: 'machine', cable: 'cable', band: 'cable', bodyweight: 'bodyweight', weighted: 'bodyweight', assisted: 'machine' };
function match(name) {
  const m = aliases();
  const full = norm(name);
  if (m.has(full)) return { id: m.get(full) };
  const paren = (String(name).match(/\(([^)]*)\)/) || [])[1] || '';
  const bare = norm(String(name).replace(/\([^)]*\)/g, ''));
  const eqHint = Object.keys(EQ_WORDS).find((w) => norm(paren).includes(w));
  if (eqHint && m.has(norm(bare + ' ' + eqHint))) return { id: m.get(norm(bare + ' ' + eqHint)) };
  if (m.has(bare)) return { id: m.get(bare) };
  return { custom: true, name: String(name).trim(), eq: eqHint ? EQ_WORDS[eqHint] : 'machine' };
}

/* Dates. An impossible date (31 February, 25:00) is rejected rather than rolled over into the
   next month. A time with a zone (Chalk's own export: ISO with an offset, or Z) is read as that
   exact moment; a time without one is local time on this device. */
function parseDate(s) {
  if (!s) return NaN;
  const t = String(s).trim();
  const real = (y, mo, d, h, mi, se) => { const x = new Date(y, mo, d, h, mi, se); return x.getFullYear() === y && x.getMonth() === mo && x.getDate() === d && h < 24 && mi < 60 && se < 60 ? x.getTime() : NaN; };
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    const local = real(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    if (!Number.isFinite(local)) return NaN;
    return m[7] ? Date.parse(t.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')) : local;
  }
  m = t.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})/);
  if (m) {
    const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].toLowerCase());
    if (mo >= 0) return real(+m[3], mo, +m[1], +m[4], +m[5], 0);
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return real(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  return Date.parse(t);
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
// A number from a cell: blank is 0, anything that isn't a number is NaN (and the row is rejected).
const num = (v) => (String(v == null ? '' : v).trim() === '' ? 0 : Number(String(v).trim().replace(',', '.')));
const EFFORTS = { easy: 1, '1': 1, hard: 2, '2': 2, failure: 3, '3': 3 };

/* Reading a file. Every row is either imported or listed as rejected, with the reason, so the
   report accounts for the whole file. Chalk's own export round-trips exactly: its ids, warm-ups,
   effort and set times come back as they were. */
function parse(text) {
  const rows = csvRows(text.replace(/^﻿/, ''));
  if (rows.length < 2) return { error: "That file has no rows to import." };
  const head = rows[0].map((h) => norm(String(h).replace(/_/g, ' ')));
  const col = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const colLike = (word) => head.findIndex((h) => h.includes(word));
  let source = 'a CSV file';
  const c = {};
  if (col('session id') >= 0 && col('exercise id') >= 0) {
    source = 'GYMKDR';
    Object.assign(c, { date: col('date'), title: col('workout'), ex: col('exercise'), kg: col('weight kg'), reps: col('reps'), sid: col('session id'), eid: col('exercise id'), rid: col('routine id'), did: col('day id'), end: col('end time'), settime: col('set time'), effort: col('effort'), warm: col('warm up'), secs: col('duration s'), dist: col('distance'), cset: col('cardio settings') });
  } else if (col('exercise title') >= 0 && col('set index') >= 0) {
    source = 'Hevy';
    Object.assign(c, { date: col('start time'), endT: col('end time'), title: col('title'), ex: col('exercise title'), type: col('set type'), kg: col('weight kg'), lbs: col('weight lbs'), reps: col('reps'), rpe: col('rpe') });
  } else if (col('exercise name') >= 0 && col('set order') >= 0) {
    source = 'Strong';
    Object.assign(c, { date: col('date'), title: col('workout name'), ex: col('exercise name'), order: col('set order'), w: col('weight'), unit: col('weight unit'), reps: col('reps'), kg: col('weight kg'), lbs: col('weight lbs'), dur: col('duration') });
  } else {
    Object.assign(c, { date: colLike('date') >= 0 ? colLike('date') : colLike('start'), title: col('workout', 'workout name', 'title'), ex: colLike('exercise'), w: colLike('weight'), reps: colLike('reps'), effort: col('effort'), warm: col('warm up', 'warmup') });
  }
  if (c.ex < 0 || c.reps < 0 || c.date < 0) return { error: "GYMKDR couldn't find the date, exercise and reps columns in that file." };
  const has = (k) => c[k] != null && c[k] >= 0;
  const cell = (r, k) => (has(k) ? String(r[c[k]] == null ? '' : r[c[k]]).trim() : '');
  const custom = {}, bySession = new Map(), rejected = [];
  let nSets = 0, lbsSeen = false;
  rows.slice(1).forEach((r, k) => {
    const line = k + 2;
    const name = cell(r, 'ex');
    const reps = num(cell(r, 'reps'));
    const at = parseDate(cell(r, 'date'));
    // A row left out is tied to the workout it belonged to, so a re-import never replaces a saved
    // workout with an incomplete copy of it.
    const rej = (why) => rejected.push(Number.isFinite(at) ? { line, why, sid: cell(r, 'sid') || 'i' + hash(source + (String(at) + '|' + (cell(r, 'title') || 'Workout'))) } : { line, why });
    if (!name) { rej('no exercise name'); return; }
    if (!Number.isFinite(at)) { rej(`a date GYMKDR can't read (${cell(r, 'date') || 'blank'})`); return; }
    // Chalk's own cardio rows: time, distance and settings instead of weight and reps.
    if (CH.cardio && CH.cardio.isCardio(cell(r, 'eid')) && CH.cardio.ex(cell(r, 'eid')) && cell(r, 'secs') !== '') {
      const secs = num(cell(r, 'secs')), dist = cell(r, 'dist') === '' ? 0 : num(cell(r, 'dist'));
      if (!(secs > 0 && secs < 86400) || !(dist >= 0)) { rej(`cardio with a time or distance GYMKDR can't read (${cell(r, 'secs')}, ${cell(r, 'dist')})`); return; }
      const set = {};
      cell(r, 'cset').split(';').forEach((kv) => { const [k, v] = kv.split('='); if (k && v != null && v !== '') set[k.trim()] = Number.isFinite(Number(v)) ? Number(v) : v.trim(); });
      const title = cell(r, 'title') || 'Workout', sid = cell(r, 'sid'), key = sid || String(at) + '|' + title;
      if (!bySession.has(key)) {
        const end = parseDate(cell(r, 'end'));
        const rec = { id: sid || 'i' + hash(source + key), dayId: cell(r, 'did') || 'import:' + norm(title), day: title, start: at, end: Number.isFinite(end) && end >= at ? end : at, sets: [] };
        if (cell(r, 'rid')) rec.routineId = cell(r, 'rid');
        if (!(Number.isFinite(end) && end > at)) rec.noTime = true;
        bySession.set(key, rec);
      }
      const s = bySession.get(key), t = parseDate(cell(r, 'settime'));
      s.sets.push({ ex: cell(r, 'eid'), c: true, w: 0, r: 0, s: Math.round(secs), d: dist, set, e: { easy: 1, steady: 2, hard: 3, 'all out': 4 }[cell(r, 'effort').toLowerCase()] || 0, wu: false, t: Number.isFinite(t) ? t : at + s.sets.length * 1000 });
      nSets++;
      return;
    }
    if (!Number.isInteger(reps) || reps < 1 || reps > 999) { rej(reps === 0 ? 'no reps' : `reps that aren't a whole number from 1 to 999 (${cell(r, 'reps') || 'blank'})`); return; }
    let w = 0;
    if (cell(r, 'kg') !== '') w = num(cell(r, 'kg'));
    else if (cell(r, 'lbs') !== '') { w = num(cell(r, 'lbs')) * 0.45359237; lbsSeen = true; }
    else if (has('w')) {
      w = num(cell(r, 'w'));
      if (/lb/i.test(cell(r, 'unit')) || /lb/.test(head[c.w])) { w *= 0.45359237; lbsSeen = true; }
    }
    if (!Number.isFinite(w) || w < 0 || w > 1000) { rej(`a weight that isn't 0 to 1,000 kg (${cell(r, 'kg') || cell(r, 'lbs') || cell(r, 'w')})`); return; }
    w = Math.round(w * 100) / 100;
    const warm = /^(yes|true|1|warm.?up|w)$/i.test(cell(r, 'warm')) || /warm/i.test(cell(r, 'type')) || /^w/i.test(cell(r, 'order'));
    const mt = match(name);
    const eid = cell(r, 'eid');
    let id = mt.id;
    if (eid && D().ex(eid)) id = eid; // Chalk's own export names the exact exercise, brand included
    else if (mt.custom) {
      // Your own or imported exercise: the same id it had, or one from its full name (never cut short).
      id = eid && /^(c_|u)/.test(eid) ? eid : 'c_' + hash(mt.name) + hash(Array.from(mt.name).reverse().join(''));
      if (!custom[id]) custom[id] = { id, name: mt.name, eq: mt.eq, main: null, help: [], pattern: null, compound: false, aliases: [], custom: true };
    }
    const title = cell(r, 'title') || 'Workout';
    const sid = cell(r, 'sid');
    const key = sid || String(at) + '|' + title;
    if (!bySession.has(key)) {
      const end = parseDate(cell(r, 'end')) || parseDate(cell(r, 'endT'));
      const rec = { id: sid || 'i' + hash(source + key), dayId: cell(r, 'did') || 'import:' + norm(title), day: title, start: at, end: Number.isFinite(end) && end >= at ? end : at, sets: [] };
      if (cell(r, 'rid')) rec.routineId = cell(r, 'rid');
      if (!(Number.isFinite(end) && end > at)) rec.noTime = true; // the file doesn't say how long it took
      bySession.set(key, rec);
    }
    const s = bySession.get(key);
    const t = parseDate(cell(r, 'settime'));
    // Without set times, sets keep their order a second apart; that isn't presented as real timing.
    s.sets.push({ ex: id, w, r: reps, e: EFFORTS[cell(r, 'effort').toLowerCase()] || 0, wu: !!warm, t: Number.isFinite(t) ? t : at + s.sets.length * 1000 });
    nSets++;
  });
  const sessions = Array.from(bySession.values()).sort((a, b) => a.start - b.start);
  if (!sessions.length) return { error: `Nothing could be imported: ${rejected.length ? U.plural(rejected.length, 'row') + ' had problems, such as ' + rejected[0].why + ' on line ' + rejected[0].line : 'the file has no sets'}.`, rejected };
  return { sessions, custom, nSets, source, lbs: lbsSeen, rejected, rows: rows.length - 1 };
}

// A starting plan from what the lifter actually did: one day per workout name, most recent first.
function planFrom(sessions) {
  const latest = new Map();
  sessions.forEach((s) => latest.set(s.day, s));
  const recent = Array.from(latest.values()).sort((a, b) => b.start - a.start).slice(0, 6).reverse();
  const days = recent.map((s) => {
    const order = [], count = {};
    s.sets.filter((x) => !x.wu).forEach((x) => { if (!(x.ex in count)) { order.push(x.ex); count[x.ex] = 0; } count[x.ex]++; });
    return { id: s.dayId, name: s.day, items: order.map((ex) => D().item(ex, Math.min(6, count[ex]))) };
  });
  return { days, next: 0 };
}

CH.importer = { parse, planFrom, csvRows, match, parseDate };
