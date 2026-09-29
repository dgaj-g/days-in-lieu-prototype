/* Days in Lieu · mock-api.js — PROTOTYPE ONLY. Same API contract the Apps Script server (Code.gs) must honour.
   Runs the very same DIL logic the server will, over in-memory data, with a switchable delay so the
   waiting states can be seen. Nothing here is saved. Fourth round, 27 Sep 2026: CLAIMS (days owed) and BOOKINGS (dates off). */
window.DIL_API = (function () {
  'use strict';
  var TODAY = '2026-09-17', APP_URL = 'https://script.google.com/a/macros/c2ken.net/s/EXAMPLE/exec';
  var cfg = { yearStartMonth: 9, yearStartDay: 1, yearOverride: '', nextYearOpens: '', claimsFrom: '2026-07-01', principalName: 'the Principal',
              quickReasons: ['Residential trip', 'Weekend fixture', 'SEAG Help'] };
  var staff = [
    { email: 'dgartland021@c2ken.net', name: 'Damien Gartland', role: 'staff', active: 'yes' },
    { email: 'chughes400@c2ken.net', name: 'Claire Hughes', role: 'staff', active: 'yes' },
    { email: 'pmorgan212@c2ken.net', name: 'Peter Morgan', role: 'staff', active: 'yes' },
    { email: 'aburns118@c2ken.net', name: 'Aoife Burns', role: 'staff', active: 'yes' },
    { email: 'principal001@c2ken.net', name: 'The Principal', role: 'approver', active: 'yes' },
    { email: 'left000@c2ken.net', name: 'Left Last Year', role: 'staff', active: 'no' }
  ];
  // What the C2k sign-in hands the front door for each account (staff profiles come as initial + surname; one gives nothing at all).
  var profiles = { 'dgartland021@c2ken.net': 'D Gartland', 'chughes400@c2ken.net': 'C Hughes', 'principal001@c2ken.net': 'The Principal', 'snew999@c2ken.net': 'S New', 'blank777@c2ken.net': '', 'left000@c2ken.net': 'L Lastyear' };
  var closures = [
    { from: '2026-10-26', to: '2026-10-30', label: 'Halloween break' }, { from: '2026-12-21', to: '2027-01-01', label: 'Christmas holidays' },
    { from: '2027-02-15', to: '2027-02-19', label: 'Mid-term break' }, { from: '2027-03-17', to: '2027-03-17', label: 'St Patrick’s Day' },
    { from: '2027-03-29', to: '2027-04-09', label: 'Easter holidays' }, { from: '2027-05-03', to: '2027-05-03', label: 'Bank holiday' },
    { from: '2027-07-01', to: '2027-08-31', label: 'Summer holidays' }
  ];
  var P = 'principal001@c2ken.net';
  // ---------- CLAIMS (the Claims tab) ----------
  var claims = [];
  // days: 'YYYY-MM-DD' for a full day, 'YYYY-MM-DD:half' for a half day — exactly what the sheet cell holds. The amount claimed is their sum.
  function claim(email, submitted, days, reason, status, approved, note) {
    var year = DIL.academicYearOf(submitted, cfg), s = DIL.findStaff(email, staff), workDays = DIL.parseWorkDays(days).sort(function (a, b) { return a.date < b.date ? -1 : 1; }), amount = DIL.claimTotal(workDays);
    var c = { claimId: DIL.nextClaimId(claims.map(function (x) { return x.claimId; }), year), staffEmail: email, staffName: s.name, submittedAt: submitted, workDays: workDays, reason: reason,
              amountClaimed: amount, amountApproved: status === 'pending' || status === 'declined' || status === 'withdrawn' ? 0 : (approved === undefined ? amount : approved),
              status: status, decisionNote: note || '', decidedAt: status === 'pending' || status === 'withdrawn' ? '' : DIL.addDays(submitted, 1), decidedBy: status === 'pending' || status === 'withdrawn' ? '' : P, startYear: year.startYear };
    claims.push(c); return c;
  }
  // Damien: last year, then this year (approved 3 + ½ + 3 = 6½; 1 awaiting; 1 not approved)
  claim('dgartland021@c2ken.net', '2026-02-09', ['2026-02-06', '2026-02-07:half'], 'Year 8 residential', 'approved');
  claim('dgartland021@c2ken.net', '2026-09-07', ['2026-09-04', '2026-09-05', '2026-09-06'], 'Year 10 residential', 'approved');
  claim('dgartland021@c2ken.net', '2026-09-09', ['2026-09-08'], 'Open night', 'partly', 0.5, 'Open night is a half day in lieu, as agreed at the staff meeting.');
  claim('dgartland021@c2ken.net', '2026-09-14', ['2026-09-19', '2026-09-26', '2026-10-03'], 'SEAG Help — Saturday classes', 'approved');
  claim('dgartland021@c2ken.net', '2026-09-16', ['2026-09-12'], 'Senior netball final', 'pending');
  claim('dgartland021@c2ken.net', '2026-09-11', ['2026-09-11'], 'Exam trip', 'declined', 0, 'Exam trips during the school day are not in lieu.');
  // Claire: 3 approved, ½ awaiting
  claim('chughes400@c2ken.net', '2026-09-13', ['2026-09-10', '2026-09-11', '2026-09-12'], 'Year 12 geography field trip', 'approved');
  claim('chughes400@c2ken.net', '2026-09-15', ['2026-09-24:half'], 'Parents’ evening', 'pending');
  // Peter: 2 approved, 1 awaiting
  claim('pmorgan212@c2ken.net', '2026-09-03', ['2026-09-05'], 'Weekend fixture — senior hurling', 'approved');
  claim('pmorgan212@c2ken.net', '2026-09-11', ['2026-09-10'], 'Open night', 'approved');
  claim('pmorgan212@c2ken.net', '2026-09-16', ['2026-09-19'], 'SEAG Help', 'pending');
  // Aoife: 2 approved, all booked
  claim('aburns118@c2ken.net', '2026-09-01', ['2026-09-05', '2026-09-06'], 'Gaelic blitz weekend', 'approved');

  // ---------- BOOKINGS (the Requests + Days tabs) ----------
  var requests = [], days = [];
  function add(email, submitted, status, list, note, decisionNote, replaces) {
    var year = DIL.academicYearOf(submitted, cfg), s = DIL.findStaff(email, staff);
    var id = DIL.nextRequestId(requests.map(function (r) { return r.id; }), year);
    var r = { id: id, staffEmail: email, staffName: s.name, submittedAt: submitted, year: year.label, startYear: year.startYear, sharedReason: note || '', decisionNote: '', replaces: replaces || null, decidedAt: status === 'pending' ? '' : DIL.addDays(submitted, 1), decidedBy: status === 'pending' ? '' : P };
    requests.push(r);
    list.forEach(function (d, i) { var st = d[2] || status; days.push({ dayId: id + '-' + (i + 1), requestId: id, staffEmail: email, staffName: s.name, date: d[0], portion: d[1], value: DIL.portionValue(d[1]), reason: note || '', status: st, decisionNote: st === 'declined' ? (decisionNote || '') : '', decidedAt: r.decidedAt, startYear: DIL.academicYearOf(d[0], cfg).startYear }); });
    return r;
  }
  // Damien: last year (1½ booked of 1½), then this year (booked 3½, awaiting ½ → 2½ left of 6½)
  add('dgartland021@c2ken.net', '2026-02-10', 'approved', [['2026-03-06', 'full'], ['2026-06-05', 'am']]);
  add('dgartland021@c2ken.net', '2026-09-08', 'approved', [['2026-09-11', 'full'], ['2026-10-02', 'full'], ['2026-10-12', 'am']]);
  add('dgartland021@c2ken.net', '2026-09-10', 'partly', [['2026-11-06', 'full', 'approved'], ['2026-11-13', 'pm', 'declined']], 'Long weekend for the Belfast trip', 'Friday 13th is already short of cover — could you take the Monday instead?');
  add('dgartland021@c2ken.net', '2026-09-16', 'pending', [['2026-11-20', 'pm']]);
  // Claire: 2½ awaiting of 3 approved
  add('chughes400@c2ken.net', '2026-09-14', 'pending', [['2026-10-05', 'full'], ['2026-10-06', 'full'], ['2026-10-07', 'am']], 'Would like the Monday to travel');
  // Peter: ½ awaiting, one declined, its replacement awaiting → ½ left of 2
  add('pmorgan212@c2ken.net', '2026-09-15', 'pending', [['2026-09-25', 'pm']]);
  var pDeclined = add('pmorgan212@c2ken.net', '2026-09-04', 'declined', [['2026-09-22', 'full']], '', 'The 22nd is the inspection visit — any other day is fine.');
  add('pmorgan212@c2ken.net', '2026-09-16', 'pending', [['2026-09-29', 'full']], '', '', { id: pDeclined.id, dates: ['2026-09-22'] });
  // Aoife: both days booked → 0 left
  add('aburns118@c2ken.net', '2026-09-02', 'approved', [['2026-09-18', 'full'], ['2026-09-21', 'full']]);

  var viewer = { email: 'dgartland021@c2ken.net' }, slow = true;
  function wait() { return new Promise(function (res) { setTimeout(res, slow ? 700 + Math.random() * 600 : 60); }); }
  function me() { return DIL.findStaff(viewer.email, staff); }
  function nameOf(email) { var s = DIL.findStaff(email, staff); return s && s.name ? s.name : ''; }
  function autoName() { return profiles.hasOwnProperty(viewer.email) ? profiles[viewer.email] : ''; }
  function role() { return DIL.roleFor(viewer.email, staff); }
  function yearsSeen(email) {
    var ys = {}; days.forEach(function (d) { if (!email || d.staffEmail === email) ys[d.startYear] = 1; }); claims.forEach(function (c) { if (!email || c.staffEmail === email) ys[c.startYear] = 1; });
    var cur = DIL.currentYear(TODAY, cfg).startYear; ys[cur] = 1;
    return Object.keys(ys).map(Number).sort(function (a, b) { return b - a; }).map(function (y) { return DIL.yearBounds(y, cfg); });
  }
  function reqView(r) {
    var ds = days.filter(function (d) { return d.requestId === r.id; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return { id: r.id, staffEmail: r.staffEmail, staffName: nameOf(r.staffEmail) || r.staffName, submittedAt: r.submittedAt, year: r.year, startYear: r.startYear, sharedReason: r.sharedReason,
             decisionNote: r.decisionNote, replaces: r.replaces || null, decidedAt: r.decidedAt, decidedByName: nameOf(r.decidedBy), status: DIL.requestStatus(ds), total: DIL.total(ds), days: ds.map(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.staffName = nameOf(d.staffEmail) || d.staffName; return c; }) };
  }
  function claimView(c) { var v = {}; for (var k in c) v[k] = c[k]; v.staffName = nameOf(c.staffEmail) || c.staffName; v.decidedByName = nameOf(c.decidedBy); return v; }
  function daysOf(email) { return days.filter(function (d) { return d.staffEmail === email; }); }
  function claimsOf(email) { return claims.filter(function (c) { return c.staffEmail === email; }); }
  function balanceOf(email, year) { return DIL.balance(claimsOf(email), daysOf(email), TODAY, year); }
  function pendingClaims() { return claims.filter(function (c) { return c.status === 'pending'; }).map(claimView).sort(function (a, b) { return a.submittedAt < b.submittedAt ? -1 : 1; }); }
  function pendingBookings() { return requests.map(reqView).filter(function (r) { return r.status === 'pending'; }).sort(function (a, b) { return a.submittedAt < b.submittedAt ? -1 : 1; }); }
  function queueCount() { return role() === 'approver' ? pendingClaims().length + pendingBookings().length : 0; }
  function rawRow(email) { var e = DIL.norm(email); return staff.filter(function (s) { return DIL.norm(s.email) === e; })[0] || null; }
  // Roles are exclusive: an approver's own days in lieu are handled outside this app, so approvers cannot use the staff calls.
  function need(r) { var me = role(); if (r === 'any' ? me === 'unknown' : me !== r) throw new Error('not allowed'); }
  var api = {
    _setViewer: function (email) { viewer.email = email; }, _setSlow: function (v) { slow = !!v; }, _today: TODAY,
    _forceWithdraw: function (id) { days.forEach(function (d) { if (d.requestId === id && d.status === 'pending') d.status = 'withdrawn'; }); }, // sweep hook: the staff member withdraws under the Principal's feet
    _forceDecide: function (id) { days.forEach(function (d) { if (d.requestId === id && d.status === 'pending') { d.status = 'approved'; d.decidedAt = TODAY; d.decidedBy = P; } }); }, // sweep hook: the Principal decides under the staff member's feet
    _forceWithdrawClaim: function (id) { claims.forEach(function (c) { if (c.claimId === id && c.status === 'pending') c.status = 'withdrawn'; }); },
    _forceDecideClaim: function (id) { claims.forEach(function (c) { if (c.claimId === id && c.status === 'pending') { c.status = 'approved'; c.amountApproved = c.amountClaimed; c.decidedAt = TODAY; c.decidedBy = P; } }); },
    whoami: function () { return wait().then(function () { var reg = viewer.email ? DIL.registerVisitor(staff, viewer.email, autoName()) : { code: 'no_email' }; if (reg.code === 'added') staff.push(reg.row);
      var s = me(); return { ok: true, email: viewer.email, name: s ? s.name : '', autoName: autoName(), needName: !!(s && !s.name), removed: reg.code === 'removed', role: role(), queueCount: queueCount(), today: TODAY, appUrl: APP_URL, sheetUrl: 'https://docs.google.com/spreadsheets/d/EXAMPLE', cfg: { principalName: cfg.principalName, quickReasons: cfg.quickReasons }, year: DIL.currentYear(TODAY, cfg), window: DIL.requestWindow(TODAY, cfg), claimWindow: DIL.claimWindow(DIL.currentYear(TODAY, cfg), cfg) }; }); },
    myName: function () { return wait().then(function () { var s = me(); return { ok: true, name: s ? s.name : '' }; }); },
    setMyName: function (name) { return wait().then(function () { need('any'); name = String(name || '').trim(); if (!name) return { ok: false, code: 'need_name' }; me().name = name; return { ok: true, name: name }; }); },
    // ----- staff: my days -----
    myDays: function (startYear) { return wait().then(function () { need('staff'); var year = startYear ? DIL.yearBounds(startYear, cfg) : DIL.currentYear(TODAY, cfg);
      var mine = requests.filter(function (r) { return r.staffEmail === viewer.email && r.startYear === year.startYear; }).map(reqView).sort(function (a, b) { return a.submittedAt < b.submittedAt ? 1 : -1; });
      var myClaims = claimsOf(viewer.email).filter(function (c) { return c.startYear === year.startYear && c.status !== 'withdrawn'; }).map(claimView).sort(function (a, b) { return a.submittedAt < b.submittedAt ? 1 : -1; });
      var myAll = daysOf(viewer.email);
      return { ok: true, year: year, years: yearsSeen(viewer.email), requests: mine, claims: myClaims, balance: balanceOf(viewer.email, year), summary: DIL.summarise(myAll, TODAY, year), closures: closures, existing: myAll.map(function (d) { return { date: d.date, status: d.status }; }) }; }); },
    // ----- staff: claims -----
    submitClaim: function (sub) { return wait().then(function () { need('staff'); var s = me(), year = DIL.currentYear(TODAY, cfg); if (!s.name) return { ok: false, code: 'need_name' };
      var v = DIL.validateClaim(sub, { todayISO: TODAY, year: year, window: DIL.claimWindow(year, cfg) }); if (!v.ok) return v;
      var c = { claimId: DIL.nextClaimId(claims.map(function (x) { return x.claimId; }), year), staffEmail: viewer.email, staffName: s.name, submittedAt: TODAY, workDays: v.claim.workDays, reason: v.claim.reason, amountClaimed: v.claim.amount, amountApproved: 0, status: 'pending', decisionNote: '', decidedAt: '', decidedBy: '', startYear: year.startYear };
      claims.push(c); console.log('[mock email → approvers]', S.email.newClaim({ staffName: s.name, amount: c.amountClaimed, reason: c.reason, workDays: c.workDays, url: APP_URL + '?claim=' + c.claimId }).subject);
      return { ok: true, claim: claimView(c), balance: balanceOf(viewer.email, year) }; }); },
    withdrawClaim: function (id) { return wait().then(function () { need('staff'); var c = claims.filter(function (x) { return x.claimId === id && x.staffEmail === viewer.email; })[0]; if (!c) return { ok: false, code: 'not_found' };
      if (!DIL.canWithdrawClaim(c)) return { ok: false, code: 'not_pending', claim: claimView(c) };
      c.status = 'withdrawn'; console.log('[mock email → approvers]', S.email.claimWithdrawn({ staffName: c.staffName, claim: c, url: APP_URL }).subject); return { ok: true }; }); },
    // ----- staff: bookings -----
    submit: function (sub) { return wait().then(function () { need('staff'); var s = me(), win = DIL.requestWindow(TODAY, cfg); if (!s.name) return { ok: false, code: 'need_name' };
      var bal = {}; bal[win.year.startYear] = balanceOf(viewer.email, win.year).left; if (win.extended) bal[win.year.startYear + 1] = balanceOf(viewer.email, DIL.yearBounds(win.year.startYear + 1, cfg)).left;
      var v = DIL.validateSubmission(sub, { todayISO: TODAY, window: win, closures: closures, existing: daysOf(viewer.email), balance: bal });
      if (!v.ok) return { ok: false, code: v.code, detail: v.detail || v, left: v.left, total: v.total };
      var year = win.year, id = DIL.nextRequestId(requests.map(function (r) { return r.id; }), year);
      var r = { id: id, staffEmail: viewer.email, staffName: s.name, submittedAt: TODAY, year: year.label, startYear: year.startYear, sharedReason: v.sharedReason, decisionNote: '', replaces: v.replaces || null, decidedAt: '', decidedBy: '' };
      requests.push(r); v.days.forEach(function (d, i) { days.push({ dayId: id + '-' + (i + 1), requestId: id, staffEmail: viewer.email, staffName: s.name, date: d.date, portion: d.portion, value: d.value, reason: d.reason, status: 'pending', decisionNote: '', decidedAt: '', startYear: DIL.academicYearOf(d.date, cfg).startYear }); });
      var b = balanceOf(viewer.email, year);
      console.log('[mock email → approvers]', S.email.newRequest({ staffName: s.name, total: v.total, days: v.days, note: v.sharedReason, replaces: v.replaces, balance: b, url: APP_URL + '?r=' + id }).subject);
      return { ok: true, request: reqView(r), balance: b }; }); },
    withdraw: function (id) { return wait().then(function () { need('staff'); var r = requests.filter(function (x) { return x.id === id && x.staffEmail === viewer.email; })[0]; if (!r) return { ok: false, code: 'not_found' };
      var ds = days.filter(function (d) { return d.requestId === id; }); if (!DIL.canWithdraw(ds)) return { ok: false, code: 'not_pending' };
      ds.forEach(function (d) { if (d.status === 'pending') d.status = 'withdrawn'; }); console.log('[mock email → approvers]', S.email.withdrawn({ staffName: r.staffName, total: DIL.total(ds), days: ds, url: APP_URL }).subject); return { ok: true }; }); },
    cancelDay: function (dayId) { return wait().then(function () { need('staff'); var d = days.filter(function (x) { return x.dayId === dayId && x.staffEmail === viewer.email; })[0]; if (!d || !DIL.canCancelDay(d, TODAY)) return { ok: false, code: 'not_allowed' };
      d.status = 'cancelled'; console.log('[mock email → approvers]', S.email.cancelled({ staffName: d.staffName, day: d, url: APP_URL }).subject); return { ok: true }; }); },
    // ----- approver: to decide -----
    queue: function () { return wait().then(function () { need('approver'); var year = DIL.currentYear(TODAY, cfg);
      var q = pendingBookings(); q.forEach(function (r) { r.balance = balanceOf(r.staffEmail, year); });
      var c = pendingClaims(); c.forEach(function (k) { k.balance = balanceOf(k.staffEmail, year); });
      return { ok: true, claims: c, requests: q, count: c.length + q.length }; }); },
    decideClaim: function (id, decision, allowChange) { return wait().then(function () { need('approver'); var c = claims.filter(function (x) { return x.claimId === id; })[0]; if (!c) return { ok: false, code: 'not_found' };
      var year = DIL.yearBounds(c.startYear, cfg);
      if (allowChange && c.status !== 'pending' && c.status !== 'withdrawn') { var can = DIL.canReduceClaim(claimsOf(c.staffEmail), daysOf(c.staffEmail), TODAY, year, id, decision && decision.approve ? (decision.amount === undefined || decision.amount === null || decision.amount === '' ? c.amountClaimed : Number(decision.amount)) : 0); if (!can.ok) return can; }
      var res = DIL.applyClaimDecision(c, decision, viewer.email, TODAY, { allowChange: !!allowChange }); if (!res.ok) return res;
      for (var k in res.claim) c[k] = res.claim[k];
      var b = balanceOf(c.staffEmail, year);
      console.log('[mock email → ' + c.staffEmail + ']', S.email.claimDecision({ first: DIL.firstName(c.staffName), principalName: cfg.principalName, claim: c, yearLabel: year.label, balance: b, url: APP_URL }).subject);
      return { ok: true, claim: claimView(c), balance: b, queueCount: queueCount() }; }); },
    decide: function (id, choices, notes, allowChange) { return wait().then(function () { need('approver'); var r = requests.filter(function (x) { return x.id === id; })[0]; if (!r) return { ok: false, code: 'not_found' };
      var ds = days.filter(function (d) { return d.requestId === id; }); var res = DIL.applyDecision(ds, choices, notes, viewer.email, TODAY, { allowChange: !!allowChange }); if (!res.ok) return res;
      res.days.forEach(function (nd) { var d = days.filter(function (x) { return x.dayId === nd.dayId; })[0]; for (var k in nd) d[k] = nd[k]; });
      r.decisionNote = res.note; r.decidedAt = TODAY; r.decidedBy = viewer.email;
      var b = balanceOf(r.staffEmail, DIL.yearBounds(r.startYear, cfg));
      console.log('[mock email → ' + r.staffEmail + ']', S.email.decision({ first: DIL.firstName(r.staffName), principalName: cfg.principalName, submitted: r.submittedAt, days: res.days, outcome: res.outcome, note: r.decisionNote, yearLabel: r.year, balance: b, url: APP_URL }).subject);
      return { ok: true, request: reqView(r), balance: b, queueCount: queueCount() }; }); },
    // The preview has no send page (whoami gives no sendUrl), so nothing ever waits: every decision email is sent at once.
    mailState: function (ids) { return wait().then(function () { var o = {}; (ids || []).forEach(function (id) { o[id] = 'gone'; }); return { ok: true, states: o }; }); },
    decided: function (startYear) { return wait().then(function () { need('approver'); var year = startYear ? DIL.yearBounds(startYear, cfg) : DIL.currentYear(TODAY, cfg);
      var list = requests.filter(function (r) { return r.startYear === year.startYear; }).map(reqView).filter(function (r) { return r.status !== 'pending'; }).sort(function (a, b) { return (a.decidedAt || a.submittedAt) < (b.decidedAt || b.submittedAt) ? 1 : -1; });
      var cl = claims.filter(function (c) { return c.startYear === year.startYear && c.status !== 'pending'; }).map(claimView).sort(function (a, b) { return (a.decidedAt || a.submittedAt) < (b.decidedAt || b.submittedAt) ? 1 : -1; });
      cl.forEach(function (k) { k.balance = balanceOf(k.staffEmail, year); });
      return { ok: true, year: year, years: yearsSeen(null), claims: cl, requests: list }; }); },
    overview: function (startYear) { return wait().then(function () { need('approver'); var year = startYear ? DIL.yearBounds(startYear, cfg) : DIL.currentYear(TODAY, cfg);
      var rows = DIL.perStaff(days, staff, TODAY, year, claims).filter(function (r) { return r.claims > 0 || r.requested > 0; });
      return { ok: true, year: year, years: yearsSeen(null), rows: rows, totals: DIL.schoolTotals(rows), buckets: DIL.monthBuckets(days, year, cfg), away: DIL.offSoon(days, TODAY, 7), currentMonth: DIL.parts(TODAY).m }; }); },
    csv: function (startYear) { return wait().then(function () { need('approver'); var year = startYear ? DIL.yearBounds(startYear, cfg) : DIL.currentYear(TODAY, cfg);
      var rows = DIL.perStaff(days, staff, TODAY, year, claims).filter(function (r) { return r.claims > 0 || r.requested > 0; }).map(function (r) { return { Name: r.name, Email: r.email, Claimed: r.claimed, Approved: r.entitled, Booked: r.booked, Taken: r.taken, Left: r.left, Awaiting: r.awaiting }; });
      return { ok: true, name: S.overview.csvName(year.label), content: DIL.csvOf(rows, ['Name', 'Email', 'Claimed', 'Approved', 'Booked', 'Taken', 'Left', 'Awaiting']) }; }); },
    staffList: function () { return wait().then(function () { need('approver'); return { ok: true, staff: staff.filter(DIL.isOnList).map(function (s) { return { email: s.email, name: s.name, role: DIL.roleFor(s.email, staff) }; }).sort(function (a, b) { return (a.name || a.email).localeCompare(b.name || b.email); }) }; }); },
    staffAdd: function (p) { return wait().then(function () { need('approver'); var e = DIL.norm(p.email); if (!/^[a-z0-9._-]+@c2ken\.net$/.test(e)) return { ok: false, code: 'bad_email' }; if (DIL.findStaff(e, staff)) return { ok: false, code: 'duplicate' };
      var row = rawRow(e); if (row) { row.name = String(p.name || '').trim() || row.name; row.role = p.role === 'approver' ? 'approver' : 'staff'; row.active = 'yes'; } else staff.push({ email: e, name: String(p.name || '').trim(), role: p.role === 'approver' ? 'approver' : 'staff', active: 'yes' }); return { ok: true }; }); },
    staffRemove: function (email) { return wait().then(function () { need('approver'); var s = rawRow(email); if (!s || s.active === 'no' || DIL.norm(email) === viewer.email) return { ok: false, code: 'not_allowed' }; s.active = 'no'; return { ok: true }; }); },
    staffRole: function (email, newRole) { return wait().then(function () { need('approver'); var s = rawRow(email); if (!s || s.active === 'no' || DIL.norm(email) === viewer.email) return { ok: false, code: 'not_allowed' }; s.role = newRole === 'approver' ? 'approver' : 'staff'; return { ok: true }; }); },
  };
  return api;
})();
