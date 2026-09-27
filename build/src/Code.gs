/* Days in Lieu · Code.gs — the server. Google Apps Script, V8, bound to the Days in Lieu Google Sheet.
   Honours exactly the API contract of prototype/mock-api.js: the browser calls api(name, args) through
   google.script.run and gets back the same shapes the prototype returned. All judgement lives in Logic.gs (DIL)
   and every word of English in Strings.gs (S) — this file only reads and writes the Sheet and sends the emails.
   Build: Fable 5.1, 27 Sep 2026. */

// The Principal. setup() puts her on the Staff tab as an approver, so the approval side opens for her the first time she follows the link.
// Her account has two names — fmcalinden045@ourladysgrammar.newry.ni.sch.uk and fmcalinden045@c2ken.net — and DIL.norm folds
// the school-domain form to the c2ken.net form, so whichever the sign-in reports, it is the same row.
var PRINCIPAL_EMAIL = 'fmcalinden045@c2ken.net';

var SHEETS = ['Staff', 'Config', 'Closures', 'Claims', 'Requests', 'Days'];
var HEAD = {
  Staff:    ['Email', 'Name', 'Role', 'Active'],
  Config:   ['Key', 'Value'],
  Closures: ['From', 'To', 'Label'],
  Claims:   ['ClaimId', 'StaffEmail', 'StaffName', 'SubmittedAt', 'WorkDays', 'Reason', 'AmountClaimed', 'AmountApproved', 'Status', 'DecisionNote', 'DecidedAt', 'DecidedBy', 'StartYear'],
  Requests: ['Id', 'StaffEmail', 'StaffName', 'SubmittedAt', 'Year', 'StartYear', 'SharedReason', 'DecisionNote', 'ReplacesId', 'ReplacesDates', 'DecidedAt', 'DecidedBy'],
  Days:     ['DayId', 'RequestId', 'StaffEmail', 'StaffName', 'Date', 'Portion', 'Value', 'Reason', 'Status', 'DecisionNote', 'DecidedAt', 'StartYear']
};
var CONFIG_DEFAULTS = [
  ['yearStartMonth', '9', 'Month the academic year starts (1–12).'],
  ['yearStartDay', '1', 'Day of that month.'],
  ['yearOverride', '', 'Leave blank. A start year (e.g. 2026) forces that academic year for testing.'],
  ['nextYearOpens', '', 'Leave blank, or MM-DD from which bookings may be made into next year (e.g. 06-01).'],
  ['principalName', 'the Principal', 'How the app refers to the approver in sentences, lower case.'],
  ['quickReasons', 'Residential trip, Weekend fixture, SEAG Help', 'Quick-fill buttons on the claim form, comma separated.']
];
var NUMERIC = { Claims: ['AmountClaimed', 'AmountApproved', 'StartYear'], Requests: ['StartYear'], Days: ['Value', 'StartYear'] };   // per sheet: Config's Value column is text

/* ---------- the web page ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {}, boot = {};
  var email = viewerEmail();
  if ((p.c || p.r) && email) { var st = loadStore(); if (DIL.roleFor(email, st.staff) === 'approver') boot.tab = 'queue'; }
  var t = HtmlService.createTemplateFromFile('index');
  t.boot = JSON.stringify(boot);
  return t.evaluate().setTitle(S.app.title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')     // the in-page meta is dropped by Apps Script; this one is honoured
    .setFaviconUrl('https://dgaj-g.github.io/days-in-lieu-prototype/prototype/assets/crest-160.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

/* ---------- one entry point for the browser ---------- */
function api(name, args) {
  if (!API.hasOwnProperty(name)) throw new Error('Unknown call: ' + name);
  var out = API[name].apply(null, args || []);
  return JSON.parse(JSON.stringify(out === undefined ? null : out));   // plain JSON only: no Date objects across the wire
}

/* ---------- who is asking ---------- */
function viewerEmail() { try { return DIL.norm(Session.getActiveUser().getEmail()); } catch (err) { return ''; } }
function today() { return DIL.todayISO(new Date()); }
function appUrl() { try { return ScriptApp.getService().getUrl() || ''; } catch (err) { return ''; } }

/* ---------- the Sheet ---------- */
function ss() { return SpreadsheetApp.getActive(); }
function sheet(name) { var s = ss().getSheetByName(name); if (!s) throw new Error('Sheet "' + name + '" is missing — run Set up from the Days in Lieu menu.'); return s; }
function cellISO(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}
function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
// Every row of a sheet as an object keyed by its headers (lower-camel), plus _row (1-based sheet row) for writing back.
function readRows(name) {
  var vals = sheet(name).getDataRange().getValues(), head = HEAD[name], out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r], o = { _row: r + 1 }, blank = true;
    for (var c = 0; c < head.length; c++) {
      var h = head[c], v = row[c];
      if (v !== '' && v != null) blank = false;
      o[lowerFirst(h)] = (NUMERIC[name] || []).indexOf(h) >= 0 ? (v === '' || v == null ? 0 : Number(v)) : cellISO(v);
    }
    if (!blank) out.push(o);
  }
  return out;
}
function rowValues(name, o) { return HEAD[name].map(function (h) { var v = o[lowerFirst(h)]; return v == null ? '' : v; }); }
function appendRow(name, o) { sheet(name).appendRow(rowValues(name, o)); }
function saveRow(name, o) {   // o._row known → overwrite in place; else find by first column
  var s = sheet(name), r = o._row;
  if (!r) { var ids = s.getRange(2, 1, Math.max(s.getLastRow() - 1, 1), 1).getValues(); for (var i = 0; i < ids.length; i++) if (cellISO(ids[i][0]) === String(o[lowerFirst(HEAD[name][0])])) { r = i + 2; break; } }
  if (!r) throw new Error('Row not found in ' + name);
  s.getRange(r, 1, 1, HEAD[name].length).setValues([rowValues(name, o)]);
}
function withLock(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// Everything a call needs, read once. Claims/Requests/Days are unpacked from their cells into the shapes DIL expects.
function loadStore() {
  var cfg = {}; readRows('Config').forEach(function (r) { cfg[r.key] = r.value; });
  cfg.quickReasons = String(cfg.quickReasons || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  cfg.principalName = cfg.principalName || 'the Principal';
  var staff = readRows('Staff').map(function (r) { return { _row: r._row, email: r.email, name: r.name, role: r.role, active: r.active }; });
  var closures = readRows('Closures').map(function (r) { return { from: r.from, to: r.to, label: r.label }; });
  var claims = readRows('Claims').map(function (r) { r.workDays = DIL.parseWorkDays(r.workDays); return r; });
  var requests = readRows('Requests').map(function (r) { r.replaces = r.replacesId ? { id: r.replacesId, dates: String(r.replacesDates || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean) } : null; return r; });
  var days = readRows('Days');
  return { cfg: cfg, staff: staff, closures: closures, claims: claims, requests: requests, days: days };
}
function claimRow(c) { var o = {}; for (var k in c) o[k] = c[k]; o.workDays = DIL.workDaysCell(c.workDays); return o; }
function requestRow(r) { var o = {}; for (var k in r) o[k] = r[k]; o.replacesId = r.replaces ? r.replaces.id : ''; o.replacesDates = r.replaces ? r.replaces.dates.join(',') : ''; return o; }
function strip(o) { var v = {}; for (var k in o) if (k !== '_row') v[k] = o[k]; return v; }

/* ---------- emails ---------- */
function sendMail(to, msg) {
  var list = [].concat(to).filter(Boolean); if (!list.length) return;
  MailApp.sendEmail({ to: list.join(','), subject: msg.subject, body: msg.text, htmlBody: msg.html, name: S.app.emailSender });
}
function approverEmails(st) { return DIL.approvers(st.staff).map(function (s) { return s.email; }); }

/* ---------- views (the same shapes the prototype returned) ---------- */
function nameOf(st, email) { var s = DIL.findStaff(email, st.staff); return s && s.name ? s.name : ''; }
function reqView(st, r) {
  var ds = st.days.filter(function (d) { return d.requestId === r.id; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return { id: r.id, staffEmail: r.staffEmail, staffName: nameOf(st, r.staffEmail) || r.staffName, submittedAt: r.submittedAt, year: r.year, startYear: r.startYear, sharedReason: r.sharedReason,
           decisionNote: r.decisionNote, replaces: r.replaces || null, decidedAt: r.decidedAt, decidedByName: nameOf(st, r.decidedBy), status: DIL.requestStatus(ds), total: DIL.total(ds),
           days: ds.map(function (d) { var c = strip(d); c.staffName = nameOf(st, d.staffEmail) || d.staffName; return c; }) };
}
function claimView(st, c) { var v = strip(c); v.staffName = nameOf(st, c.staffEmail) || c.staffName; v.decidedByName = nameOf(st, c.decidedBy); return v; }
function daysOf(st, email) { return st.days.filter(function (d) { return DIL.norm(d.staffEmail) === DIL.norm(email); }); }
function claimsOf(st, email) { return st.claims.filter(function (c) { return DIL.norm(c.staffEmail) === DIL.norm(email); }); }
function balanceOf(st, email, year) { return DIL.balance(claimsOf(st, email), daysOf(st, email), today(), year); }
function pendingClaims(st) { return st.claims.filter(function (c) { return c.status === 'pending'; }).map(function (c) { return claimView(st, c); }).sort(function (a, b) { return a.submittedAt < b.submittedAt ? -1 : 1; }); }
function pendingBookings(st) { return st.requests.map(function (r) { return reqView(st, r); }).filter(function (r) { return r.status === 'pending'; }).sort(function (a, b) { return a.submittedAt < b.submittedAt ? -1 : 1; }); }
function queueCount(st, email) { return DIL.roleFor(email, st.staff) === 'approver' ? pendingClaims(st).length + pendingBookings(st).length : 0; }
function yearsSeen(st, email) {
  var ys = {}; st.days.forEach(function (d) { if (!email || DIL.norm(d.staffEmail) === email) ys[d.startYear] = 1; }); st.claims.forEach(function (c) { if (!email || DIL.norm(c.staffEmail) === email) ys[c.startYear] = 1; });
  ys[DIL.currentYear(today(), st.cfg).startYear] = 1;
  return Object.keys(ys).map(Number).sort(function (a, b) { return b - a; }).map(function (y) { return DIL.yearBounds(y, st.cfg); });
}
// Roles are exclusive: the Principal's own days in lieu are handled outside this app, so an approver cannot use the staff calls.
function need(st, email, role) { var r = DIL.roleFor(email, st.staff); if (role === 'any' ? r === 'unknown' : r !== role) throw new Error('not allowed'); }
function me(st, email) { var s = DIL.findStaff(email, st.staff); if (!s) throw new Error('not on the list'); return s; }

/* ---------- the API ---------- */
var API = {
  whoami: function () {
    var email = viewerEmail(), st = loadStore(), reg = email ? DIL.registerVisitor(st.staff, email, '') : { code: 'no_email' };
    if (reg.code === 'added') { withLock(function () { appendRow('Staff', reg.row); }); st.staff.push(reg.row); }
    var s = email ? DIL.findStaff(email, st.staff) : null, role = email ? DIL.roleFor(email, st.staff) : 'unknown';
    return { ok: true, email: email, name: s ? s.name : '', autoName: '', needName: !!(s && !s.name), removed: reg.code === 'removed', role: role, queueCount: queueCount(st, email), today: today(),
             appUrl: appUrl(), sheetUrl: role === 'approver' ? ss().getUrl() : '', cfg: { principalName: st.cfg.principalName, quickReasons: st.cfg.quickReasons },
             year: DIL.currentYear(today(), st.cfg), window: DIL.requestWindow(today(), st.cfg) };
  },
  setMyName: function (name) {
    var email = viewerEmail(), st = loadStore(); need(st, email, 'any'); name = String(name || '').trim(); if (!name) return { ok: false, code: 'need_name' };
    var s = me(st, email); s.name = name; withLock(function () { saveRow('Staff', s); }); return { ok: true, name: name };
  },
  // ----- staff: my days -----
  myDays: function (startYear) {
    var email = viewerEmail(), st = loadStore(); need(st, email, 'staff'); var year = startYear ? DIL.yearBounds(startYear, st.cfg) : DIL.currentYear(today(), st.cfg);
    var mine = st.requests.filter(function (r) { return DIL.norm(r.staffEmail) === email && Number(r.startYear) === year.startYear; }).map(function (r) { return reqView(st, r); }).sort(function (a, b) { return a.submittedAt < b.submittedAt ? 1 : -1; });
    var myClaims = claimsOf(st, email).filter(function (c) { return Number(c.startYear) === year.startYear && c.status !== 'withdrawn'; }).map(function (c) { return claimView(st, c); }).sort(function (a, b) { return a.submittedAt < b.submittedAt ? 1 : -1; });
    var myAll = daysOf(st, email).map(strip);
    return { ok: true, year: year, years: yearsSeen(st, email), requests: mine, claims: myClaims, balance: balanceOf(st, email, year), summary: DIL.summarise(myAll, today(), year), closures: st.closures, existing: myAll.map(function (d) { return { date: d.date, status: d.status }; }) };
  },
  // ----- staff: claims -----
  submitClaim: function (sub) {
    var email = viewerEmail(), st = loadStore(); need(st, email, 'staff'); var s = me(st, email), year = DIL.currentYear(today(), st.cfg); if (!s.name) return { ok: false, code: 'need_name' };
    var v = DIL.validateClaim(sub, { todayISO: today(), year: year }); if (!v.ok) return v;
    var c = withLock(function () {
      var fresh = loadStore();
      var k = { claimId: DIL.nextClaimId(fresh.claims.map(function (x) { return x.claimId; }), year), staffEmail: email, staffName: s.name, submittedAt: today(), workDays: v.claim.workDays, reason: v.claim.reason, amountClaimed: v.claim.amount, amountApproved: 0, status: 'pending', decisionNote: '', decidedAt: '', decidedBy: '', startYear: year.startYear };
      appendRow('Claims', claimRow(k)); return k;
    });
    st.claims.push(c);
    sendMail(approverEmails(st), S.email.newClaim({ staffName: s.name, amount: c.amountClaimed, reason: c.reason, workDays: c.workDays, url: appUrl() + '?c=' + c.claimId }));
    return { ok: true, claim: claimView(st, c), balance: balanceOf(st, email, year) };
  },
  withdrawClaim: function (id) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'staff'); var c = st.claims.filter(function (x) { return x.claimId === id && DIL.norm(x.staffEmail) === email; })[0]; if (!c) return { ok: false, code: 'not_found' };
      if (!DIL.canWithdrawClaim(c)) return { ok: false, code: 'not_pending', claim: claimView(st, c) };
      c.status = 'withdrawn'; saveRow('Claims', claimRow(c));
      sendMail(approverEmails(st), S.email.claimWithdrawn({ staffName: c.staffName, claim: c, url: appUrl() })); return { ok: true };
    });
  },
  // ----- staff: bookings -----
  submit: function (sub) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'staff'); var s = me(st, email), win = DIL.requestWindow(today(), st.cfg); if (!s.name) return { ok: false, code: 'need_name' };
      var bal = {}; bal[win.year.startYear] = balanceOf(st, email, win.year).left; if (win.extended) bal[win.year.startYear + 1] = balanceOf(st, email, DIL.yearBounds(win.year.startYear + 1, st.cfg)).left;
      var v = DIL.validateSubmission(sub, { todayISO: today(), window: win, closures: st.closures, existing: daysOf(st, email), balance: bal });
      if (!v.ok) return { ok: false, code: v.code, detail: v.detail || v, left: v.left, total: v.total };
      var year = win.year, id = DIL.nextRequestId(st.requests.map(function (r) { return r.id; }), year);
      var r = { id: id, staffEmail: email, staffName: s.name, submittedAt: today(), year: year.label, startYear: year.startYear, sharedReason: v.sharedReason, decisionNote: '', replaces: v.replaces || null, decidedAt: '', decidedBy: '' };
      appendRow('Requests', requestRow(r)); st.requests.push(r);
      v.days.forEach(function (d, i) { var day = { dayId: id + '-' + (i + 1), requestId: id, staffEmail: email, staffName: s.name, date: d.date, portion: d.portion, value: d.value, reason: d.reason, status: 'pending', decisionNote: '', decidedAt: '', startYear: DIL.academicYearOf(d.date, st.cfg).startYear }; appendRow('Days', day); st.days.push(day); });
      var b = balanceOf(st, email, year);
      sendMail(approverEmails(st), S.email.newRequest({ staffName: s.name, total: v.total, days: v.days, note: v.sharedReason, replaces: v.replaces, balance: b, url: appUrl() + '?r=' + id }));
      return { ok: true, request: reqView(st, r), balance: b };
    });
  },
  withdraw: function (id) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'staff'); var r = st.requests.filter(function (x) { return x.id === id && DIL.norm(x.staffEmail) === email; })[0]; if (!r) return { ok: false, code: 'not_found' };
      var ds = st.days.filter(function (d) { return d.requestId === id; }); if (!DIL.canWithdraw(ds)) return { ok: false, code: 'not_pending' };
      ds.forEach(function (d) { if (d.status === 'pending') { d.status = 'withdrawn'; saveRow('Days', d); } });
      sendMail(approverEmails(st), S.email.withdrawn({ staffName: r.staffName, total: DIL.total(ds), days: ds, url: appUrl() })); return { ok: true };
    });
  },
  cancelDay: function (dayId) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'staff'); var d = st.days.filter(function (x) { return x.dayId === dayId && DIL.norm(x.staffEmail) === email; })[0]; if (!d || !DIL.canCancelDay(d, today())) return { ok: false, code: 'not_allowed' };
      d.status = 'cancelled'; saveRow('Days', d);
      sendMail(approverEmails(st), S.email.cancelled({ staffName: d.staffName, day: d, url: appUrl() })); return { ok: true };
    });
  },
  // ----- approver: to decide -----
  queue: function () {
    var email = viewerEmail(), st = loadStore(); need(st, email, 'approver'); var year = DIL.currentYear(today(), st.cfg);
    var q = pendingBookings(st); q.forEach(function (r) { r.balance = balanceOf(st, r.staffEmail, year); });
    var c = pendingClaims(st); c.forEach(function (k) { k.balance = balanceOf(st, k.staffEmail, year); });
    return { ok: true, claims: c, requests: q, count: c.length + q.length };
  },
  decideClaim: function (id, decision, allowChange) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'approver'); var c = st.claims.filter(function (x) { return x.claimId === id; })[0]; if (!c) return { ok: false, code: 'not_found' };
      var year = DIL.yearBounds(Number(c.startYear), st.cfg);
      if (allowChange && c.status !== 'pending' && c.status !== 'withdrawn') { var can = DIL.canReduceClaim(claimsOf(st, c.staffEmail), daysOf(st, c.staffEmail), today(), year, id, decision && decision.approve ? (decision.amount === undefined || decision.amount === null || decision.amount === '' ? c.amountClaimed : Number(decision.amount)) : 0); if (!can.ok) return can; }
      var res = DIL.applyClaimDecision(c, decision, email, today(), { allowChange: !!allowChange }); if (!res.ok) return res;
      for (var k in res.claim) if (k !== '_row') c[k] = res.claim[k];
      var b = balanceOf(st, c.staffEmail, year);
      // The email first, then the Sheet: a decision the person was never told about is not a decision.
      sendMail(c.staffEmail, S.email.claimDecision({ first: DIL.firstName(c.staffName), principalName: st.cfg.principalName, claim: c, yearLabel: year.label, balance: b, url: appUrl() }));
      saveRow('Claims', claimRow(c));
      return { ok: true, claim: claimView(st, c), balance: b, queueCount: queueCount(st, email) };
    });
  },
  decide: function (id, choices, notes, allowChange) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'approver'); var r = st.requests.filter(function (x) { return x.id === id; })[0]; if (!r) return { ok: false, code: 'not_found' };
      var ds = st.days.filter(function (d) { return d.requestId === id; }); var res = DIL.applyDecision(ds, choices, notes, email, today(), { allowChange: !!allowChange }); if (!res.ok) return res;
      res.days.forEach(function (nd) { var d = st.days.filter(function (x) { return x.dayId === nd.dayId; })[0]; for (var k in nd) if (k !== '_row') d[k] = nd[k]; });
      r.decisionNote = res.note; r.decidedAt = today(); r.decidedBy = email;
      var b = balanceOf(st, r.staffEmail, DIL.yearBounds(Number(r.startYear), st.cfg));
      sendMail(r.staffEmail, S.email.decision({ first: DIL.firstName(r.staffName), principalName: st.cfg.principalName, submitted: r.submittedAt, days: res.days, outcome: res.outcome, note: r.decisionNote, yearLabel: r.year, balance: b, url: appUrl() }));
      ds.forEach(function (d) { saveRow('Days', d); }); saveRow('Requests', requestRow(r));
      return { ok: true, request: reqView(st, r), balance: b, queueCount: queueCount(st, email) };
    });
  },
  decided: function (startYear) {
    var email = viewerEmail(), st = loadStore(); need(st, email, 'approver'); var year = startYear ? DIL.yearBounds(startYear, st.cfg) : DIL.currentYear(today(), st.cfg);
    var list = st.requests.filter(function (r) { return Number(r.startYear) === year.startYear; }).map(function (r) { return reqView(st, r); }).filter(function (r) { return r.status !== 'pending'; }).sort(function (a, b) { return (a.decidedAt || a.submittedAt) < (b.decidedAt || b.submittedAt) ? 1 : -1; });
    var cl = st.claims.filter(function (c) { return Number(c.startYear) === year.startYear && c.status !== 'pending'; }).map(function (c) { return claimView(st, c); }).sort(function (a, b) { return (a.decidedAt || a.submittedAt) < (b.decidedAt || b.submittedAt) ? 1 : -1; });
    cl.forEach(function (k) { k.balance = balanceOf(st, k.staffEmail, year); });
    return { ok: true, year: year, years: yearsSeen(st, null), claims: cl, requests: list };
  },
  overview: function (startYear) {
    var email = viewerEmail(), st = loadStore(); need(st, email, 'approver'); var year = startYear ? DIL.yearBounds(startYear, st.cfg) : DIL.currentYear(today(), st.cfg);
    var rows = DIL.perStaff(st.days, st.staff, today(), year, st.claims).filter(function (r) { return r.claims > 0 || r.requested > 0; });
    return { ok: true, year: year, years: yearsSeen(st, null), rows: rows, totals: DIL.schoolTotals(rows), buckets: DIL.monthBuckets(st.days, year, st.cfg), away: DIL.offSoon(st.days, today(), 7), currentMonth: DIL.parts(today()).m };
  },
  csv: function (startYear) {
    var email = viewerEmail(), st = loadStore(); need(st, email, 'approver'); var year = startYear ? DIL.yearBounds(startYear, st.cfg) : DIL.currentYear(today(), st.cfg);
    var rows = DIL.perStaff(st.days, st.staff, today(), year, st.claims).filter(function (r) { return r.claims > 0 || r.requested > 0; }).map(function (r) { return { Name: r.name, Email: r.email, Claimed: r.claimed, Approved: r.entitled, Booked: r.booked, Taken: r.taken, Left: r.left, Awaiting: r.awaiting }; });
    return { ok: true, name: S.overview.csvName(year.label), content: DIL.csvOf(rows, ['Name', 'Email', 'Claimed', 'Approved', 'Booked', 'Taken', 'Left', 'Awaiting']) };
  },
  // ----- approver: the staff list -----
  staffList: function () {
    var email = viewerEmail(), st = loadStore(); need(st, email, 'approver');
    return { ok: true, staff: st.staff.filter(DIL.isOnList).map(function (s) { return { email: s.email, name: s.name, role: DIL.roleFor(s.email, st.staff) }; }).sort(function (a, b) { return (a.name || a.email).localeCompare(b.name || b.email); }) };
  },
  staffAdd: function (p) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'approver'); var e = DIL.norm(p && p.email); if (!/^[a-z0-9._-]+@c2ken\.net$/.test(e)) return { ok: false, code: 'bad_email' }; if (DIL.findStaff(e, st.staff)) return { ok: false, code: 'duplicate' };
      var row = st.staff.filter(function (s) { return DIL.norm(s.email) === e; })[0];
      if (row) { row.name = String(p.name || '').trim() || row.name; row.role = p.role === 'approver' ? 'approver' : 'staff'; row.active = 'yes'; saveRow('Staff', row); }
      else appendRow('Staff', { email: e, name: String(p.name || '').trim(), role: p.role === 'approver' ? 'approver' : 'staff', active: 'yes' });
      return { ok: true };
    });
  },
  staffRemove: function (target) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'approver'); var s = st.staff.filter(function (x) { return DIL.norm(x.email) === DIL.norm(target); })[0];
      if (!s || s.active === 'no' || DIL.norm(target) === email) return { ok: false, code: 'not_allowed' }; s.active = 'no'; saveRow('Staff', s); return { ok: true };
    });
  },
  staffRole: function (target, newRole) {
    var email = viewerEmail(); return withLock(function () {
      var st = loadStore(); need(st, email, 'approver'); var s = st.staff.filter(function (x) { return DIL.norm(x.email) === DIL.norm(target); })[0];
      if (!s || s.active === 'no' || DIL.norm(target) === email) return { ok: false, code: 'not_allowed' }; s.role = newRole === 'approver' ? 'approver' : 'staff'; saveRow('Staff', s); return { ok: true };
    });
  }
};

/* ---------- setting up the Sheet (run once, from the Days in Lieu menu or the editor) ---------- */
function onOpen() { try { SpreadsheetApp.getUi().createMenu('Days in Lieu').addItem('Set up the sheets', 'setup').addToUi(); } catch (err) {} }
function setup() {
  var book = ss();
  SHEETS.forEach(function (name) {
    var s = book.getSheetByName(name) || book.insertSheet(name);
    if (s.getLastRow() === 0) {
      s.getRange('A:Z').setNumberFormat('@');                   // dates are ISO text, never Sheet dates
      s.getRange(1, 1, 1, HEAD[name].length).setValues([HEAD[name]]).setFontWeight('bold'); s.setFrozenRows(1);
      if (name === 'Config') CONFIG_DEFAULTS.forEach(function (row) { s.appendRow([row[0], row[1], row[2]]); });
      if (name === 'Staff') { var e = viewerEmail(), p = DIL.norm(PRINCIPAL_EMAIL); if (e) s.appendRow([e, '', 'approver', 'yes']); if (p && p !== e) s.appendRow([p, '', 'approver', 'yes']); }
    }
  });
  var first = book.getSheets()[0]; if (SHEETS.indexOf(first.getName()) < 0 && book.getSheets().length > SHEETS.length) book.deleteSheet(first);
}
