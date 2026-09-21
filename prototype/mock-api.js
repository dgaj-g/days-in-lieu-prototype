/* Days in Lieu · mock-api.js — PROTOTYPE ONLY. Same API contract the Apps Script server (Code.gs) must honour.
   Runs the very same DIL logic the server will, over in-memory data, with a switchable delay so the
   waiting states can be seen. Nothing here is saved. */
window.DIL_API = (function () {
  'use strict';
  var TODAY = '2026-09-17', APP_URL = 'https://script.google.com/a/macros/c2ken.net/s/EXAMPLE/exec';
  var cfg = { yearStartMonth: 9, yearStartDay: 1, yearOverride: '', nextYearOpens: '', principalName: 'the Principal',
              quickReasons: ['Residential trip', 'Open night', 'Parents’ evening', 'Weekend fixture', 'Exam trip'] };
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
  var requests = [], days = [], seq = 0;
  function add(email, submitted, status, list, reason, note, replaces) {
    var year = DIL.academicYearOf(submitted, cfg), s = DIL.findStaff(email, staff);
    var id = DIL.nextRequestId(requests.map(function (r) { return r.id; }), year);
    var r = { id: id, staffEmail: email, staffName: s.name, submittedAt: submitted, year: year.label, startYear: year.startYear, sharedReason: reason, decisionNote: '', replaces: replaces || null, decidedAt: status === 'pending' ? '' : DIL.addDays(submitted, 1), decidedBy: 'principal001@c2ken.net' };
    requests.push(r);
    list.forEach(function (d, i) { days.push({ dayId: id + '-' + (i + 1), requestId: id, staffEmail: email, staffName: s.name, date: d[0], portion: d[1], value: DIL.portionValue(d[1]), reason: d[2] || reason, status: d[3] || status, decisionNote: (d[3] || status) === 'declined' ? (note || '') : '', decidedAt: r.decidedAt, startYear: year.startYear }); });
  }
  // Damien: last year, then this year
  add('dgartland021@c2ken.net', '2026-02-10', 'approved', [['2026-03-06', 'full'], ['2026-06-05', 'am']], 'Year 8 residential, Feb 2026');
  add('dgartland021@c2ken.net', '2026-09-03', 'approved', [['2026-09-11', 'full'], ['2026-10-02', 'full'], ['2026-10-12', 'am']], 'Year 10 residential, Sat 5 and Sun 6 September');
  add('dgartland021@c2ken.net', '2026-09-10', 'partly', [['2026-11-06', 'full', '', 'approved'], ['2026-11-13', 'pm', 'Open night, Thu 8 Oct', 'declined']], 'Open night, Thu 8 Oct', 'Friday 13th is already short of cover — could you take the Monday instead?');
  add('dgartland021@c2ken.net', '2026-09-16', 'pending', [['2026-11-20', 'full']], 'Senior netball final, Sat 12 Sept');
  // others in the queue
  add('chughes400@c2ken.net', '2026-09-14', 'pending', [['2026-10-05', 'full'], ['2026-10-06', 'full'], ['2026-10-07', 'am']], 'Year 12 geography field trip, Thu 10 – Sat 12 September');
  add('pmorgan212@c2ken.net', '2026-09-15', 'pending', [['2026-09-25', 'pm']], 'Open night, Thu 10 Sept');
  add('aburns118@c2ken.net', '2026-09-02', 'approved', [['2026-09-18', 'full'], ['2026-09-21', 'full']], 'Gaelic blitz, Sat 29 Aug');
  add('pmorgan212@c2ken.net', '2026-09-04', 'declined', [['2026-09-22', 'full']], 'Fixture, Sat 29 Aug', 'The 22nd is the inspection visit — any other day is fine.');
  add('pmorgan212@c2ken.net', '2026-09-16', 'pending', [['2026-09-29', 'full']], 'Fixture, Sat 29 Aug', null, { id: requests[requests.length - 1].id, dates: ['2026-09-22'] });

  var viewer = { email: 'dgartland021@c2ken.net' }, slow = true;
  function wait() { return new Promise(function (res) { setTimeout(res, slow ? 700 + Math.random() * 600 : 60); }); }
  function me() { return DIL.findStaff(viewer.email, staff); }
  function nameOf(email) { var s = DIL.findStaff(email, staff); return s && s.name ? s.name : ''; }
  function autoName() { return profiles.hasOwnProperty(viewer.email) ? profiles[viewer.email] : ''; }
  function role() { return DIL.roleFor(viewer.email, staff); }
  function yearsSeen(email) {
    var ys = {}; days.forEach(function (d) { if (!email || d.staffEmail === email) ys[d.startYear] = 1; });
    var cur = DIL.currentYear(TODAY, cfg).startYear; ys[cur] = 1;
    return Object.keys(ys).map(Number).sort(function (a, b) { return b - a; }).map(function (y) { return DIL.yearBounds(y, cfg); });
  }
  function reqView(r) {
    var ds = days.filter(function (d) { return d.requestId === r.id; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return { id: r.id, staffEmail: r.staffEmail, staffName: nameOf(r.staffEmail) || r.staffName, submittedAt: r.submittedAt, year: r.year, startYear: r.startYear, sharedReason: r.sharedReason,
             decisionNote: r.decisionNote, replaces: r.replaces || null, decidedAt: r.decidedAt, decidedByName: nameOf(r.decidedBy), status: DIL.requestStatus(ds), total: DIL.total(ds), days: ds.map(function (d) { var c = {}; for (var k in d) c[k] = d[k]; c.staffName = nameOf(d.staffEmail) || d.staffName; return c; }) };
  }
  function rawRow(email) { var e = DIL.norm(email); return staff.filter(function (s) { return DIL.norm(s.email) === e; })[0] || null; }
  function need(r) { if (role() !== r && !(r === 'staff' && role() === 'approver')) throw new Error('not allowed'); }
  var api = {
    _setViewer: function (email) { viewer.email = email; }, _setSlow: function (v) { slow = !!v; }, _today: TODAY,
    _forceWithdraw: function (id) { days.forEach(function (d) { if (d.requestId === id && d.status === 'pending') d.status = 'withdrawn'; }); }, // sweep hook: the staff member withdraws under the Principal's feet
    _forceDecide: function (id) { days.forEach(function (d) { if (d.requestId === id && d.status === 'pending') { d.status = 'approved'; d.decidedAt = TODAY; d.decidedBy = 'principal001@c2ken.net'; } }); }, // sweep hook: the Principal decides under the staff member's feet
    whoami: function () { return wait().then(function () { var reg = viewer.email ? DIL.registerVisitor(staff, viewer.email, autoName()) : { code: 'no_email' }; if (reg.code === 'added') staff.push(reg.row);
      var s = me(); return { ok: true, email: viewer.email, name: s ? s.name : '', autoName: autoName(), needName: !!(s && !s.name), removed: reg.code === 'removed', role: role(), queueCount: role() === 'approver' ? requests.map(reqView).filter(function (r) { return r.status === 'pending'; }).length : 0, today: TODAY, appUrl: APP_URL, sheetUrl: 'https://docs.google.com/spreadsheets/d/EXAMPLE', cfg: { principalName: cfg.principalName, quickReasons: cfg.quickReasons }, year: DIL.currentYear(TODAY, cfg), window: DIL.requestWindow(TODAY, cfg) }; }); },
    setMyName: function (name) { return wait().then(function () { need('staff'); name = String(name || '').trim(); if (!name) return { ok: false, code: 'need_name' }; me().name = name; return { ok: true, name: name }; }); },
    myDays: function (startYear) { return wait().then(function () { need('staff'); var year = startYear ? DIL.yearBounds(startYear, cfg) : DIL.currentYear(TODAY, cfg);
      var mine = requests.filter(function (r) { return r.staffEmail === viewer.email && r.startYear === year.startYear; }).map(reqView).sort(function (a, b) { return a.submittedAt < b.submittedAt ? 1 : -1; });
      var myAll = days.filter(function (d) { return d.staffEmail === viewer.email; });
      return { ok: true, year: year, years: yearsSeen(viewer.email), requests: mine, summary: DIL.summarise(myAll, TODAY, year), closures: closures, existing: myAll.map(function (d) { return { date: d.date, status: d.status }; }) }; }); },
    submit: function (sub) { return wait().then(function () { need('staff'); var s = me(), win = DIL.requestWindow(TODAY, cfg); if (!s.name) return { ok: false, code: 'need_name' };
      var v = DIL.validateSubmission(sub, { todayISO: TODAY, window: win, closures: closures, existing: days.filter(function (d) { return d.staffEmail === viewer.email; }) });
      if (!v.ok) return { ok: false, code: v.code, detail: v.detail || v };
      var year = win.year, id = DIL.nextRequestId(requests.map(function (r) { return r.id; }), year);
      var r = { id: id, staffEmail: viewer.email, staffName: s.name, submittedAt: TODAY, year: year.label, startYear: year.startYear, sharedReason: v.sharedReason, decisionNote: '', replaces: v.replaces || null, decidedAt: '', decidedBy: '' };
      requests.push(r); v.days.forEach(function (d, i) { days.push({ dayId: id + '-' + (i + 1), requestId: id, staffEmail: viewer.email, staffName: s.name, date: d.date, portion: d.portion, value: d.value, reason: d.reason, status: 'pending', decisionNote: '', decidedAt: '', startYear: DIL.academicYearOf(d.date, cfg).startYear }); });
      console.log('[mock email → approvers]', S.email.newRequest({ staffName: s.name, total: v.total, days: v.days, replaces: v.replaces, url: APP_URL + '?r=' + id }).subject);
      return { ok: true, request: reqView(r) }; }); },
    withdraw: function (id) { return wait().then(function () { need('staff'); var r = requests.filter(function (x) { return x.id === id && x.staffEmail === viewer.email; })[0]; if (!r) return { ok: false, code: 'not_found' };
      var ds = days.filter(function (d) { return d.requestId === id; }); if (!DIL.canWithdraw(ds)) return { ok: false, code: 'not_pending' };
      ds.forEach(function (d) { if (d.status === 'pending') d.status = 'withdrawn'; }); console.log('[mock email → approvers]', S.email.withdrawn({ staffName: r.staffName, total: DIL.total(ds), days: ds, url: APP_URL }).subject); return { ok: true }; }); },
    cancelDay: function (dayId) { return wait().then(function () { need('staff'); var d = days.filter(function (x) { return x.dayId === dayId && x.staffEmail === viewer.email; })[0]; if (!d || !DIL.canCancelDay(d, TODAY)) return { ok: false, code: 'not_allowed' };
      d.status = 'cancelled'; console.log('[mock email → approvers]', S.email.cancelled({ staffName: d.staffName, day: d, url: APP_URL }).subject); return { ok: true }; }); },
    queue: function () { return wait().then(function () { need('approver'); var year = DIL.currentYear(TODAY, cfg);
      var q = requests.map(reqView).filter(function (r) { return r.status === 'pending'; }).sort(function (a, b) { return a.submittedAt < b.submittedAt ? -1 : 1; });
      q.forEach(function (r) { var s = DIL.summarise(days.filter(function (d) { return d.staffEmail === r.staffEmail; }), TODAY, year); r.yearSoFar = { approved: s.approved, remaining: s.remaining }; });
      return { ok: true, requests: q, count: q.length }; }); },
    decide: function (id, choices, notes, allowChange) { return wait().then(function () { need('approver'); var r = requests.filter(function (x) { return x.id === id; })[0]; if (!r) return { ok: false, code: 'not_found' };
      var ds = days.filter(function (d) { return d.requestId === id; }); var res = DIL.applyDecision(ds, choices, notes, viewer.email, TODAY, { allowChange: !!allowChange }); if (!res.ok) return res;
      res.days.forEach(function (nd) { var d = days.filter(function (x) { return x.dayId === nd.dayId; })[0]; for (var k in nd) d[k] = nd[k]; });
      r.decisionNote = res.note; r.decidedAt = TODAY; r.decidedBy = viewer.email;
      var sum = DIL.summarise(days.filter(function (d) { return d.staffEmail === r.staffEmail; }), TODAY, DIL.currentYear(TODAY, cfg));
      console.log('[mock email → ' + r.staffEmail + ']', S.email.decision({ first: DIL.firstName(r.staffName), principalName: cfg.principalName, submitted: r.submittedAt, days: res.days, outcome: res.outcome, note: r.decisionNote, yearLabel: r.year, approved: sum.approved, remaining: sum.remaining, url: APP_URL }).subject);
      return { ok: true, request: reqView(r), queueCount: requests.map(reqView).filter(function (x) { return x.status === 'pending'; }).length }; }); },
    decided: function (startYear) { return wait().then(function () { need('approver'); var year = startYear ? DIL.yearBounds(startYear, cfg) : DIL.currentYear(TODAY, cfg);
      var list = requests.filter(function (r) { return r.startYear === year.startYear; }).map(reqView).filter(function (r) { return r.status !== 'pending'; }).sort(function (a, b) { return (a.decidedAt || a.submittedAt) < (b.decidedAt || b.submittedAt) ? 1 : -1; });
      return { ok: true, year: year, years: yearsSeen(null), requests: list }; }); },
    overview: function (startYear) { return wait().then(function () { need('approver'); var year = startYear ? DIL.yearBounds(startYear, cfg) : DIL.currentYear(TODAY, cfg);
      var rows = DIL.perStaff(days, staff, TODAY, year).filter(function (r) { return r.requested > 0; });
      return { ok: true, year: year, years: yearsSeen(null), rows: rows, totals: DIL.schoolTotals(rows), buckets: DIL.monthBuckets(days, year, cfg), away: DIL.offSoon(days, TODAY, 7), currentMonth: DIL.parts(TODAY).m }; }); },
    csv: function (startYear) { return wait().then(function () { need('approver'); var year = startYear ? DIL.yearBounds(startYear, cfg) : DIL.currentYear(TODAY, cfg);
      var rows = days.filter(function (d) { return DIL.inYear(d.date, year); }).map(function (d) { return { Name: d.staffName, Email: d.staffEmail, Date: DIL.formatUK(d.date), Day: DIL.DAY_SHORT[DIL.weekdayIndex(d.date)], Portion: S.portion[d.portion], Days: d.value, Status: S.status[d.status], Reason: d.reason, Request: d.requestId, Note: d.decisionNote }; });
      return { ok: true, name: S.overview.csvName(year.label), content: DIL.csvOf(rows, ['Name', 'Email', 'Date', 'Day', 'Portion', 'Days', 'Status', 'Reason', 'Request', 'Note']) }; }); },
    staffList: function () { return wait().then(function () { need('approver'); return { ok: true, staff: staff.filter(DIL.isOnList).map(function (s) { return { email: s.email, name: s.name, role: DIL.roleFor(s.email, staff) }; }).sort(function (a, b) { return (a.name || a.email).localeCompare(b.name || b.email); }) }; }); },
    staffAdd: function (p) { return wait().then(function () { need('approver'); var e = DIL.norm(p.email); if (!/^[a-z0-9._-]+@c2ken\.net$/.test(e)) return { ok: false, code: 'bad_email' }; if (DIL.findStaff(e, staff)) return { ok: false, code: 'duplicate' };
      var row = rawRow(e); if (row) { row.name = String(p.name || '').trim() || row.name; row.role = p.role === 'approver' ? 'approver' : 'staff'; row.active = 'yes'; } else staff.push({ email: e, name: String(p.name || '').trim(), role: p.role === 'approver' ? 'approver' : 'staff', active: 'yes' }); return { ok: true }; }); },
    staffRemove: function (email) { return wait().then(function () { need('approver'); var s = rawRow(email); if (!s || s.active === 'no' || DIL.norm(email) === viewer.email) return { ok: false, code: 'not_allowed' }; s.active = 'no'; return { ok: true }; }); },
    staffRole: function (email, newRole) { return wait().then(function () { need('approver'); var s = rawRow(email); if (!s || s.active === 'no' || DIL.norm(email) === viewer.email) return { ok: false, code: 'not_allowed' }; s.role = newRole === 'approver' ? 'approver' : 'staff'; return { ok: true }; }); },
  };
  return api;
})();
