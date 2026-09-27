/* Days in Lieu · logic.js — the judgement-bearing routines.
   PURE: no DOM, no SpreadsheetApp, no Session. Runs unchanged in the browser, in Node (tests)
   and in Apps Script V8 (pasted as Logic.gs). Dates are ISO strings 'YYYY-MM-DD' everywhere.
   Design window: Fable 5.1, 17 Sep 2026; claims vs bookings 27 Sep 2026. */
var DIL = (function () {
  'use strict';

  var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON_ALIASES = { sept: 8 };
  var PORTIONS = ['full', 'am', 'pm'];
  var DAY_STATUSES = ['pending', 'approved', 'declined', 'withdrawn', 'cancelled'];
  var CLAIM_STATUSES = ['pending', 'approved', 'partly', 'declined', 'withdrawn'];
  var CLAIM_MAX = 15;   // days one claim may ask for

  // ---------- dates ----------
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toISO(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
  function parts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function isValidISO(iso) {
    var p = parts(iso); if (!p) return false;
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    return dt.getUTCFullYear() === p.y && dt.getUTCMonth() === p.m - 1 && dt.getUTCDate() === p.d;
  }
  function utc(iso) { var p = parts(iso); return Date.UTC(p.y, p.m - 1, p.d); }
  function fromUTC(ms) { var d = new Date(ms); return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  function addDays(iso, n) { return fromUTC(utc(iso) + n * 86400000); }
  function daysBetween(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  function weekdayIndex(iso) { return new Date(utc(iso)).getUTCDay(); }
  function isWeekend(iso) { var w = weekdayIndex(iso); return w === 0 || w === 6; }
  function todayISO(now) { var d = now || new Date(); return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate()); }

  function formatLong(iso) { var p = parts(iso); return DAY_SHORT[weekdayIndex(iso)] + ' ' + p.d + ' ' + MON_SHORT[p.m - 1] + ' ' + p.y; }   // Fri 2 Oct 2026
  function formatShort(iso) { var p = parts(iso); return DAY_SHORT[weekdayIndex(iso)] + ' ' + p.d + ' ' + MON_SHORT[p.m - 1]; }           // Fri 2 Oct
  function formatFull(iso) { var p = parts(iso); return DAY_LONG[weekdayIndex(iso)] + ' ' + p.d + ' ' + MON_LONG[p.m - 1] + ' ' + p.y; }  // Friday 2 October 2026
  function formatMonth(y, m) { return MON_LONG[m - 1] + ' ' + y; }
  function formatUK(iso) { var p = parts(iso); return pad2(p.d) + '/' + pad2(p.m) + '/' + p.y; }

  function formatDays(n) {
    n = Math.round(Number(n) * 2) / 2;
    var whole = Math.floor(n), half = (n - whole) === 0.5;
    var num = whole === 0 ? (half ? '½' : '0') : (String(whole) + (half ? '½' : ''));
    var unit = (n === 0.5 || n === 1) ? 'day' : 'days';
    return num + ' ' + unit;
  }
  function portionValue(portion) { return portion === 'full' ? 1 : (portion === 'am' || portion === 'pm') ? 0.5 : 0; }
  function total(days) { var t = 0; for (var i = 0; i < days.length; i++) t += portionValue(days[i].portion); return Math.round(t * 2) / 2; }

  // ---------- academic year ----------
  function yearStartMD(cfg) {
    var sm = Number(cfg && cfg.yearStartMonth) || 9, sd = Number(cfg && cfg.yearStartDay) || 1;
    return { m: sm, d: sd };
  }
  function yearBounds(startYear, cfg) {
    var s = yearStartMD(cfg);
    var start = toISO(startYear, s.m, s.d);
    var end = addDays(toISO(startYear + 1, s.m, s.d), -1);
    return { label: startYear + '–' + pad2((startYear + 1) % 100), startYear: startYear, start: start, end: end };
  }
  function academicYearOf(iso, cfg) {
    var p = parts(iso), s = yearStartMD(cfg);
    var startYear = (p.m > s.m || (p.m === s.m && p.d >= s.d)) ? p.y : p.y - 1;
    return yearBounds(startYear, cfg);
  }
  function currentYear(today, cfg) {
    if (cfg && String(cfg.yearOverride || '').trim()) return yearBounds(parseInt(cfg.yearOverride, 10), cfg);
    return academicYearOf(today, cfg);
  }
  // The window a new request may fall in: today → end of the current year, extended to the end of
  // NEXT year once the optional Config "nextYearOpens" (MM-DD) date has passed.
  function requestWindow(today, cfg) {
    var y = currentYear(today, cfg);
    var end = y.end, extended = false;
    var open = String((cfg && cfg.nextYearOpens) || '').trim();
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(open);
    if (m) {
      var cand = toISO(y.startYear, +m[1], +m[2]);
      if (cand < y.start) cand = toISO(y.startYear + 1, +m[1], +m[2]);
      if (isValidISO(cand) && today >= cand) { end = yearBounds(y.startYear + 1, cfg).end; extended = true; }
    }
    return { start: today, end: end, year: y, extended: extended };
  }
  function inYear(iso, year) { return iso >= year.start && iso <= year.end; }

  // ---------- typed dates ----------
  function monthIndex(word) {
    word = String(word || '').toLowerCase();
    if (MON_ALIASES.hasOwnProperty(word)) return MON_ALIASES[word];
    for (var i = 0; i < 12; i++) { if (MON_LONG[i].toLowerCase() === word || MON_SHORT[i].toLowerCase() === word) return i; }
    return -1;
  }
  // Accepts 3/10/2026 · 03-10-26 · 3.10.2026 · 3/10 · 3 Oct · 3rd October 2026 · Oct 3 · 2026-10-03. Returns ISO or null.
  function parseTypedDate(text, ctx) {
    var t = String(text || '').toLowerCase().replace(/(\d+)(st|nd|rd|th)\b/g, '$1').replace(/[,\.]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    var m, today = (ctx && ctx.todayISO) || todayISO();
    function check(y, mo, d) { if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; var iso = toISO(y, mo, d); return isValidISO(iso) ? iso : null; }
    function nearest(mo, d) {
      var py = parts(today).y, a = check(py, mo, d), b = check(py + 1, mo, d);
      if (a && a >= today) return a;
      if (b) return b;
      return a;
    }
    function year4(s) { var y = +s; return y < 100 ? y + 2000 : y; }
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) return check(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[\/\- ](\d{1,2})[\/\- ](\d{2}|\d{4})$/.exec(t))) return check(year4(m[3]), +m[2], +m[1]);
    if ((m = /^(\d{1,2})[\/\- ](\d{1,2})$/.exec(t))) return nearest(+m[2], +m[1]);
    if ((m = /^(\d{1,2}) ([a-z]+)(?: (\d{2}|\d{4}))?$/.exec(t))) { var mi = monthIndex(m[2]); if (mi < 0) return null; return m[3] ? check(year4(m[3]), mi + 1, +m[1]) : nearest(mi + 1, +m[1]); }
    if ((m = /^([a-z]+) (\d{1,2})(?: (\d{2}|\d{4}))?$/.exec(t))) { var mj = monthIndex(m[1]); if (mj < 0) return null; return m[3] ? check(year4(m[3]), mj + 1, +m[2]) : nearest(mj + 1, +m[2]); }
    return null;
  }

  // ---------- is this date allowed? ----------
  // ctx: { todayISO, window:{start,end,year}, closures:[{from,to,label}], existing:[{date,status}], picked:[iso] }
  // Returns null when fine, else {code, ...}. Codes: invalid · past · weekend · outside_year · closure · already_requested · already_picked
  function closureFor(iso, closures) {
    for (var i = 0; i < (closures || []).length; i++) {
      var c = closures[i]; if (!c || !isValidISO(c.from)) continue;
      var to = isValidISO(c.to) ? c.to : c.from;
      if (iso >= c.from && iso <= to) return c;
    }
    return null;
  }
  function dateProblem(iso, ctx) {
    if (!isValidISO(iso)) return { code: 'invalid' };
    if (iso < ctx.todayISO) return { code: 'past' };
    if (isWeekend(iso)) return { code: 'weekend', weekday: DAY_LONG[weekdayIndex(iso)] };
    if (iso > ctx.window.end) return { code: 'outside_year', year: ctx.window.year.label, end: ctx.window.end };
    var c = closureFor(iso, ctx.closures);
    if (c) return { code: 'closure', label: c.label || '' };
    var ex = ctx.existing || [];
    for (var i = 0; i < ex.length; i++) {
      if (ex[i].date === iso && (ex[i].status === 'pending' || ex[i].status === 'approved')) return { code: 'already_requested', status: ex[i].status };
    }
    if ((ctx.picked || []).indexOf(iso) >= 0) return { code: 'already_picked' };
    return null;
  }

  // Month grid for the calendar (Monday-first). Cells: {iso, day, inMonth, problem, today}
  function monthGrid(y, m, ctx) {
    var first = toISO(y, m, 1), lead = (weekdayIndex(first) + 6) % 7;   // Monday = 0
    var cells = [], iso = addDays(first, -lead);
    for (var i = 0; i < 42; i++) {
      var p = parts(iso), inMonth = (p.y === y && p.m === m);
      cells.push({ iso: iso, day: p.d, inMonth: inMonth, problem: inMonth ? dateProblem(iso, ctx) : { code: 'other_month' }, today: iso === ctx.todayISO });
      iso = addDays(iso, 1);
    }
    if (!cells[35].inMonth) cells = cells.slice(0, 35);
    var weeks = []; for (var w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));
    return { label: formatMonth(y, m), y: y, m: m, weeks: weeks };
  }
  function monthRange(windowStart, windowEnd) {
    var a = parts(windowStart), b = parts(windowEnd), out = [];
    var y = a.y, m = a.m;
    while (y < b.y || (y === b.y && m <= b.m)) { out.push({ y: y, m: m }); m++; if (m > 12) { m = 1; y++; } }
    return out;
  }

  // ---------- requests & days ----------
  function nextRequestId(existingIds, year) {
    var prefix = 'DIL-' + String(year.startYear).slice(2) + pad2((year.startYear + 1) % 100) + '-', max = 0;
    for (var i = 0; i < (existingIds || []).length; i++) {
      var id = String(existingIds[i] || ''); if (id.indexOf(prefix) !== 0) continue;
      var n = parseInt(id.slice(prefix.length), 10); if (n > max) max = n;
    }
    return prefix + ('000' + (max + 1)).slice(-4);
  }
  function requestStatus(days) {
    var st = days.map(function (d) { return d.status; });
    if (!st.length) return 'withdrawn';
    if (st.indexOf('pending') >= 0) return 'pending';
    if (st.every(function (s) { return s === 'withdrawn'; })) return 'withdrawn';
    var ap = st.filter(function (s) { return s === 'approved' || s === 'cancelled'; }).length;
    var de = st.filter(function (s) { return s === 'declined'; }).length;
    if (de === 0) return 'approved';
    if (ap === 0) return 'declined';
    return 'partly';
  }
  // Validate a new request as it arrives at the server. Returns {ok:true, days:[...]} or {ok:false, code, ...}.
  function validateSubmission(sub, ctx) {
    var days = (sub && sub.days) || [];
    if (!days.length) return { ok: false, code: 'no_days' };
    if (days.length > 30) return { ok: false, code: 'too_many' };
    var seen = [], clean = [];
    var shared = String((sub && sub.reason) || '').trim();
    for (var i = 0; i < days.length; i++) {
      var d = days[i] || {};
      if (PORTIONS.indexOf(d.portion) < 0) return { ok: false, code: 'bad_portion', date: d.date };
      var prob = dateProblem(d.date, { todayISO: ctx.todayISO, window: ctx.window, closures: ctx.closures, existing: ctx.existing, picked: seen });
      if (prob) return { ok: false, code: prob.code, date: d.date, detail: prob };
      var reason = String(d.reason || '').trim() || shared; // a booking's note is optional (27 Sep 2026): the reason lives on the claim
      if (reason.length > 500) return { ok: false, code: 'reason_too_long', date: d.date };
      seen.push(d.date);
      clean.push({ date: d.date, portion: d.portion, value: portionValue(d.portion), reason: reason });
    }
    clean.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var rep = sub && sub.replaces, replaces = null;
    if (rep) {
      if (typeof rep !== 'object' || !/^DIL-\d{4}-\d{4}$/.test(String(rep.id || '')) || !Array.isArray(rep.dates) || !rep.dates.length || rep.dates.length > 30 || !rep.dates.every(isValidISO)) return { ok: false, code: 'bad_replaces' };
      replaces = { id: String(rep.id), dates: rep.dates.slice().sort() };
    }
    // Bookings draw only from days the Principal has approved on a claim (ctx.balance = {startYear: left}).
    if (ctx.balance) {
      var perYear = {};
      clean.forEach(function (d) { var sy = inYear(d.date, ctx.window.year) ? ctx.window.year.startYear : ctx.window.year.startYear + 1; perYear[sy] = (perYear[sy] || 0) + d.value; });
      for (var sy in perYear) {
        var left = Math.round((Number(ctx.balance[sy]) || 0) * 2) / 2, want = Math.round(perYear[sy] * 2) / 2;
        if (want > left) return { ok: false, code: 'over_balance', year: Number(sy), left: left, total: want };
      }
    }
    return { ok: true, days: clean, total: total(clean), sharedReason: shared, replaces: replaces };
  }
  // The principal's decision. choices: {dayId: 'approved'|'declined'}; notes: {general, days: {dayId: why}} (a plain string is a general note).
  // Every declined day carries its own reason; approved days carry none. Returns {ok, days, outcome, note} or {ok:false, code, ...}.
  function applyDecision(days, choices, notes, decidedBy, nowStamp, opts) {
    var allowChange = !!(opts && opts.allowChange), out = [], decided = 0;
    if (!notes || typeof notes !== 'object') notes = { general: notes || '', days: {} };
    var general = String(notes.general || '').trim(), dayNotes = notes.days || {};
    if (general.length > 1000) return { ok: false, code: 'note_too_long' };
    for (var i = 0; i < days.length; i++) {
      var d = days[i];
      if (d.status === 'withdrawn' || d.status === 'cancelled') { out.push(d); continue; }
      if (d.status !== 'pending' && !allowChange) return { ok: false, code: 'not_pending', dayId: d.dayId };
      var c = choices ? choices[d.dayId] : undefined;
      if (c !== 'approved' && c !== 'declined') return { ok: false, code: 'missing_choice', dayId: d.dayId };
      var why = String(dayNotes[d.dayId] || '').trim();
      if (c === 'declined' && !why) return { ok: false, code: 'day_note_required', dayId: d.dayId, date: d.date };
      if (why.length > 500) return { ok: false, code: 'note_too_long', dayId: d.dayId, date: d.date };
      var copy = {}; for (var k in d) copy[k] = d[k];
      copy.status = c; copy.decidedAt = nowStamp; copy.decidedBy = decidedBy; copy.decisionNote = c === 'declined' ? why : '';
      out.push(copy); decided++;
    }
    // The staff member withdrew (or cancelled every day) before this decision landed: nothing to decide, no email.
    if (!decided) return { ok: false, code: 'withdrawn' };
    return { ok: true, days: out, outcome: requestStatus(out), note: general };
  }
  // "a, b and c"
  function joinWords(list) { var a = (list || []).map(String); return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function canWithdraw(days) { return days.length > 0 && days.every(function (d) { return d.status === 'pending' || d.status === 'withdrawn'; }) && days.some(function (d) { return d.status === 'pending'; }); }
  function canCancelDay(day, today) { return day.status === 'approved' && day.date >= today; }

  // ---------- roles ----------
  function norm(email) { return String(email || '').trim().toLowerCase(); }
  // A Staff row counts unless active is 'no' (removed). Blank counts: a row pasted straight into the Sheet is on the list.
  function isOnList(row) { return String(row && row.active || '').trim().toLowerCase() !== 'no'; }
  // First visit: the sign-in gives an email and a name; a person not on the list is added as teaching staff, never as an approver.
  // Pure: returns what to do; the caller appends the row. A removed account (active 'no') is refused — being removed must mean something.
  function registerVisitor(staff, email, name) {
    var e = norm(email); if (!e) return { code: 'no_email' };
    var row = null; (staff || []).forEach(function (s) { if (norm(s.email) === e) row = s; });
    if (row && !isOnList(row)) return { code: 'removed', row: row };
    if (row) return { code: 'known', row: row };
    return { code: 'added', row: { email: e, name: String(name || '').trim(), role: 'staff', active: 'yes' } };
  }
  function findStaff(email, staff) {
    var e = norm(email); if (!e) return null;
    for (var i = 0; i < (staff || []).length; i++) { if (norm(staff[i].email) === e && isOnList(staff[i])) return staff[i]; }
    return null;
  }
  function roleFor(email, staff) {
    var s = findStaff(email, staff);
    if (!s) return 'unknown';
    return String(s.role || '').trim().toLowerCase() === 'approver' ? 'approver' : 'staff';
  }
  function approvers(staff) { return (staff || []).filter(function (s) { return roleFor(s.email, staff) === 'approver'; }); }
  function firstName(name) { var n = String(name || '').trim().replace(/^(mr|mrs|ms|miss|dr|fr|sr)\.?\s+/i, ''); return n.split(/\s+/)[0] || n; }

  // ---------- claims (days in lieu a person says they are owed) ----------
  // A claim: {claimId, staffEmail, staffName, submittedAt, workDate, reason, amountClaimed, amountApproved, status, decisionNote, decidedAt, decidedBy, startYear}
  function isHalfStep(n) { n = Number(n); return isFinite(n) && n > 0 && Math.round(n * 2) === n * 2; }
  function nextClaimId(existingIds, year) {
    var prefix = 'CLM-' + String(year.startYear).slice(2) + pad2((year.startYear + 1) % 100) + '-', max = 0;
    for (var i = 0; i < (existingIds || []).length; i++) {
      var id = String(existingIds[i] || ''); if (id.indexOf(prefix) !== 0) continue;
      var n = parseInt(id.slice(prefix.length), 10); if (n > max) max = n;
    }
    return prefix + ('000' + (max + 1)).slice(-4);
  }
  // The date of the work. Past dates are the normal case; when no year is typed, the occurrence inside
  // the current academic year wins ('12 Sep' on 17 Sep 2026 → 2026-09-12; '5 Feb' → 2027-02-05).
  function parseClaimDate(text, ctx) {
    var iso = parseTypedDate(text, ctx); if (!iso) return null;
    var t = String(text || '').toLowerCase().replace(/(\d+)(st|nd|rd|th)\b/g, '$1').replace(/[,\.]/g, ' ').replace(/\s+/g, ' ').trim();
    var hasYear = /^\d{4}-\d{1,2}-\d{1,2}$/.test(t) || /^\d{1,2}[\/\- ]\d{1,2}[\/\- ](\d{2}|\d{4})$/.test(t) || /^\d{1,2} [a-z]+ (\d{2}|\d{4})$/.test(t) || /^[a-z]+ \d{1,2} (\d{2}|\d{4})$/.test(t);
    var year = ctx && ctx.year; if (hasYear || !year) return iso;
    var p = parts(iso), a = toISO(year.startYear, p.m, p.d), b = toISO(year.startYear + 1, p.m, p.d);
    if (isValidISO(a) && inYear(a, year)) return a;
    if (isValidISO(b) && inYear(b, year)) return b;
    return iso;
  }
  // Validate a claim as it arrives at the server. sub: {reason, workDate, amount}; ctx: {todayISO, year}.
  function validateClaim(sub, ctx) {
    var reason = String((sub && sub.reason) || '').trim();
    if (!reason) return { ok: false, code: 'no_reason' };
    if (reason.length > 500) return { ok: false, code: 'reason_too_long' };
    var amount = Number(sub && sub.amount);
    if (!isHalfStep(amount)) return { ok: false, code: 'bad_amount' };
    if (amount > CLAIM_MAX) return { ok: false, code: 'amount_too_big', max: CLAIM_MAX };
    var date = String((sub && sub.workDate) || '').trim();
    if (!isValidISO(date)) return { ok: false, code: 'bad_date' };
    if (!inYear(date, ctx.year)) return { ok: false, code: 'date_outside_year', year: ctx.year.label };
    return { ok: true, claim: { reason: reason, workDate: date, amount: amount } };
  }
  // The Principal's decision on a claim. decision: {approve: true|false, amount (days approved; blank = all), note}.
  // Fewer days than claimed and a decline both NEED a note (it goes in the email). Never above the amount claimed, never zero (that is a decline).
  function applyClaimDecision(claim, decision, decidedBy, nowStamp, opts) {
    var allowChange = !!(opts && opts.allowChange);
    if (!claim) return { ok: false, code: 'not_pending' };
    if (claim.status === 'withdrawn') return { ok: false, code: 'withdrawn' };
    if (claim.status !== 'pending' && !allowChange) return { ok: false, code: 'not_pending' };
    var note = String((decision && decision.note) || '').trim();
    if (note.length > 1000) return { ok: false, code: 'note_too_long' };
    var claimed = Math.round((Number(claim.amountClaimed) || 0) * 2) / 2, status, approved;
    if (!decision || !decision.approve) {
      if (!note) return { ok: false, code: 'note_required', why: 'declined' };
      status = 'declined'; approved = 0;
    } else {
      var a = decision.amount; approved = (a === undefined || a === null || a === '') ? claimed : Number(a);
      if (!isHalfStep(approved) || approved > claimed) return { ok: false, code: 'bad_amount', claimed: claimed };
      if (approved < claimed) { if (!note) return { ok: false, code: 'note_required', why: 'fewer' }; status = 'partly'; }
      else status = 'approved';
    }
    var copy = {}; for (var k in claim) copy[k] = claim[k];
    copy.status = status; copy.amountApproved = approved; copy.decisionNote = note; copy.decidedAt = nowStamp; copy.decidedBy = decidedBy;
    return { ok: true, claim: copy, outcome: status, approved: approved, claimed: claimed };
  }
  function canWithdrawClaim(claim) { return !!claim && claim.status === 'pending'; }
  // One person's balance for one academic year. Claims count by the year they were sent in (no carry-over);
  // bookings by their date. left = approved on claims − booked − awaiting decision, never below 0.
  function balance(claims, days, today, year) {
    var b = { claimed: 0, approved: 0, booked: 0, taken: 0, upcomingBooked: 0, pending: 0, left: 0, claims: 0, claimsApproved: 0, claimsPending: 0, claimsPendingAmount: 0, claimsDeclined: 0 };
    (claims || []).forEach(function (c) {
      if (Number(c.startYear) !== year.startYear) return;
      var claimed = Number(c.amountClaimed) || 0;
      if (c.status === 'approved' || c.status === 'partly') { b.claims++; b.claimsApproved++; b.claimed += claimed; b.approved += Number(c.amountApproved) || 0; }
      else if (c.status === 'pending') { b.claims++; b.claimed += claimed; b.claimsPending++; b.claimsPendingAmount += claimed; }
      else if (c.status === 'declined') { b.claims++; b.claimed += claimed; b.claimsDeclined += claimed; }
    });
    var s = summarise(days || [], today, year);
    b.booked = s.approved; b.taken = s.taken; b.upcomingBooked = s.remaining; b.pending = s.pending;
    b.left = Math.max(0, b.approved - b.booked - b.pending);
    ['claimed', 'approved', 'booked', 'taken', 'upcomingBooked', 'pending', 'left', 'claimsPendingAmount', 'claimsDeclined'].forEach(function (k) { b[k] = Math.round(b[k] * 2) / 2; });
    return b;
  }
  // May the Principal change a decided claim to `newAmount` (0 = decline)? Not below what is already booked or awaiting.
  function canReduceClaim(claims, days, today, year, claimId, newAmount) {
    var target = null; (claims || []).forEach(function (c) { if (c.claimId === claimId) target = c; });
    if (!target) return { ok: false, code: 'not_found' };
    var b = balance(claims, days, today, year);
    var current = (target.status === 'approved' || target.status === 'partly') ? (Number(target.amountApproved) || 0) : 0;
    var after = Math.round((b.approved - current + (Number(newAmount) || 0)) * 2) / 2, committed = Math.round((b.booked + b.pending) * 2) / 2;
    if (after < committed) return { ok: false, code: 'booked_already', booked: committed, approvedAfter: after, over: Math.round((committed - after) * 2) / 2 };
    return { ok: true, left: Math.round((after - committed) * 2) / 2, booked: committed };
  }

  // ---------- dashboards ----------
  // days: [{date, value, status, ...}] for ONE person; counts only days inside `year`.
  function summarise(days, today, year) {
    var s = { approved: 0, taken: 0, remaining: 0, pending: 0, declined: 0, upcoming: [] };
    for (var i = 0; i < days.length; i++) {
      var d = days[i]; if (!inYear(d.date, year)) continue;
      var v = Number(d.value) || portionValue(d.portion);
      if (d.status === 'approved') { s.approved += v; if (d.date < today) s.taken += v; else { s.remaining += v; s.upcoming.push(d); } }
      else if (d.status === 'pending') { s.pending += v; if (d.date >= today) s.upcoming.push(d); }
      else if (d.status === 'declined') { s.declined += v; }
    }
    s.upcoming.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    ['approved', 'taken', 'remaining', 'pending', 'declined'].forEach(function (k) { s[k] = Math.round(s[k] * 2) / 2; });
    return s;
  }
  // Whole-school table. days: every day row; staff: the Staff tab.
  function perStaff(days, staff, today, year, claims) {
    var byEmail = {}, order = [], claimsBy = {};
    (claims || []).forEach(function (c) { var e = norm(c.staffEmail); (claimsBy[e] = claimsBy[e] || []).push(c); });
    (staff || []).forEach(function (s) { var e = norm(s.email); if (!e || !isOnList(s)) return; byEmail[e] = { email: e, name: s.name || e, role: roleFor(e, staff), days: [] }; order.push(e); });
    days.forEach(function (d) { var e = norm(d.staffEmail); if (!byEmail[e]) { byEmail[e] = { email: e, name: d.staffName || e, role: 'unknown', days: [] }; order.push(e); } byEmail[e].days.push(d); });
    (claims || []).forEach(function (c) { var e = norm(c.staffEmail); if (!byEmail[e]) { byEmail[e] = { email: e, name: c.staffName || e, role: 'unknown', days: [] }; order.push(e); } });
    return order.map(function (e) {
      var r = byEmail[e], s = summarise(r.days, today, year), b = balance(claimsBy[e] || [], r.days, today, year);
      return { email: r.email, name: r.name, role: r.role, requested: Math.round((s.approved + s.declined + s.pending) * 2) / 2, approved: s.approved, declined: s.declined, pending: s.pending, taken: s.taken, remaining: s.remaining,
        claimed: b.claimed, entitled: b.approved, booked: b.booked, left: b.left, claims: b.claims, claimsApproved: b.claimsApproved, claimsPending: b.claimsPending, claimsPendingAmount: b.claimsPendingAmount, claimsDeclined: b.claimsDeclined, awaiting: Math.round((b.pending + b.claimsPendingAmount) * 2) / 2 };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function schoolTotals(rows) {
    var keys = ['requested', 'approved', 'declined', 'pending', 'taken', 'remaining', 'claimed', 'entitled', 'booked', 'left', 'claims', 'claimsApproved', 'claimsPending', 'claimsPendingAmount', 'claimsDeclined', 'awaiting'];
    var t = { staffWithDays: 0, staffWithClaims: 0, staffWithApproved: 0 }; keys.forEach(function (k) { t[k] = 0; });
    rows.forEach(function (r) { keys.forEach(function (k) { t[k] += Number(r[k]) || 0; }); if (r.requested > 0) t.staffWithDays++; if (r.claims > 0) t.staffWithClaims++; if (r.claimsApproved > 0) t.staffWithApproved++; });
    keys.forEach(function (k) { t[k] = Math.round(t[k] * 2) / 2; });
    return t;
  }
  // Approved days per month of the academic year, in year order (Sep … Aug by default).
  function monthBuckets(days, year, cfg) {
    var s = yearStartMD(cfg), out = [];
    for (var i = 0; i < 12; i++) { var mi = ((s.m - 1 + i) % 12); out.push({ m: mi + 1, label: MON_SHORT[mi], approved: 0, pending: 0 }); }
    days.forEach(function (d) {
      if (!inYear(d.date, year)) return;
      var idx = (parts(d.date).m - s.m + 12) % 12, v = Number(d.value) || portionValue(d.portion);
      if (d.status === 'approved') out[idx].approved += v; else if (d.status === 'pending') out[idx].pending += v;
    });
    return out;
  }
  // Who is off (approved) between today and today+6, across staff.
  function offSoon(days, today, span) {
    var end = addDays(today, (span || 7) - 1);
    return days.filter(function (d) { return d.status === 'approved' && d.date >= today && d.date <= end; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.staffName || '').localeCompare(b.staffName || ''); });
  }
  function csvOf(rows, headers) {
    function cell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var lines = [headers.map(cell).join(',')];
    rows.forEach(function (r) { lines.push(headers.map(function (h) { return cell(r[h]); }).join(',')); });
    return lines.join('\r\n');
  }
  // Group a request's days by identical reason, for the compact principal card.
  function reasonGroups(days) {
    var groups = [], seen = {};
    days.forEach(function (d) { var r = String(d.reason || '').trim(); if (seen[r] === undefined) { seen[r] = groups.length; groups.push({ reason: r, days: [] }); } groups[seen[r]].days.push(d); });
    return groups;
  }

  return {
    PORTIONS: PORTIONS, DAY_STATUSES: DAY_STATUSES, CLAIM_STATUSES: CLAIM_STATUSES, CLAIM_MAX: CLAIM_MAX, DAY_SHORT: DAY_SHORT, DAY_LONG: DAY_LONG, MON_SHORT: MON_SHORT, MON_LONG: MON_LONG,
    toISO: toISO, parts: parts, isValidISO: isValidISO, addDays: addDays, daysBetween: daysBetween, weekdayIndex: weekdayIndex, isWeekend: isWeekend, todayISO: todayISO,
    formatLong: formatLong, formatShort: formatShort, formatFull: formatFull, formatMonth: formatMonth, formatUK: formatUK, formatDays: formatDays,
    portionValue: portionValue, total: total,
    yearBounds: yearBounds, academicYearOf: academicYearOf, currentYear: currentYear, requestWindow: requestWindow, inYear: inYear,
    parseTypedDate: parseTypedDate, dateProblem: dateProblem, closureFor: closureFor, monthGrid: monthGrid, monthRange: monthRange,
    nextRequestId: nextRequestId, requestStatus: requestStatus, validateSubmission: validateSubmission, applyDecision: applyDecision, joinWords: joinWords, canWithdraw: canWithdraw, canCancelDay: canCancelDay,
    isHalfStep: isHalfStep, nextClaimId: nextClaimId, parseClaimDate: parseClaimDate, validateClaim: validateClaim, applyClaimDecision: applyClaimDecision, canWithdrawClaim: canWithdrawClaim, balance: balance, canReduceClaim: canReduceClaim,
    norm: norm, findStaff: findStaff, isOnList: isOnList, registerVisitor: registerVisitor, roleFor: roleFor, approvers: approvers, firstName: firstName,
    summarise: summarise, perStaff: perStaff, schoolTotals: schoolTotals, monthBuckets: monthBuckets, offSoon: offSoon, csvOf: csvOf, reasonGroups: reasonGroups
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DIL;
