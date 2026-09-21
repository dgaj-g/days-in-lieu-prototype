/* Days in Lieu · app.js — the FINAL user interface. Uses DIL (logic.js) and S (strings.js) unchanged.
   Talks to window.DIL_API: mock-api.js in the prototype, api-gas.js (google.script.run) in the build.
   No English in this file: every visible string comes from S. Design window: Fable 5.1, 17 Sep 2026. */
var DILApp = (function () {
  'use strict';
  var esc = S.esc, api = function () { return window.DIL_API; };
  var st = {};
  function reset() { st = { me: null, tab: null, inflight: 0, years: {}, nr: null, q: {}, decidedFilter: 'all', badge: 0 }; }
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- server calls, waiting line, busy buttons, toasts ---------- */
  function call(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    st.inflight++; waitLine(true);
    function done() { st.inflight--; if (st.inflight <= 0) { st.inflight = 0; waitLine(false); } }
    return api()[name].apply(api(), args).then(function (r) { done(); return r; }, function (e) { done(); throw e; });
  }
  function waitLine(on) { var w = $('#wait'); if (w) w.classList.toggle('on', !!on); }
  function busy(btn, label) {
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = '1'; btn.dataset.html = btn.innerHTML; btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="dot"></span>' + esc(label || S.common.working);
  }
  function unbusy(btn) {
    if (!btn || !btn.dataset.busy) return;
    btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); btn.innerHTML = btn.dataset.html; delete btn.dataset.busy; delete btn.dataset.html;
  }
  function isBusy(btn) { return !!(btn && btn.dataset.busy); }
  var toastTimer;
  function toast(msg, bad) {
    var t = $('#toast'); if (!t) return;
    t.className = 'toast on' + (bad ? ' bad' : ''); t.innerHTML = '<span class="i">' + (bad ? '!' : '✓') + '</span><span>' + esc(msg) + '</span>';
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3800);
  }
  function serverFailed() { toast(S.common.errorTitle + ' — ' + S.common.errorBody, true); }

  /* ---------- small renderers ---------- */
  function num(n) { n = Number(n) || 0; var w = Math.floor(n); return (n % 1 ? (w ? w : '') + '½' : String(w)) || '0'; }
  function chip(status, extraClass) { return '<span class="chip ' + esc(status) + (extraClass ? ' ' + extraClass : '') + '">' + esc(S.status[status] || status) + '</span>'; }
  function dayChip(d) { var s = d.status === 'approved' && d.date < st.me.today ? 'taken' : d.status; return chip(s); }
  function loading() { return '<div class="card loading-card" aria-busy="true"><span class="sr">' + esc(S.common.pageLoading) + '</span><div class="skel big"></div><div class="skel line"></div><div class="skel line" style="width:50%"></div></div>'; }
  function errorCard() { return '<div class="card"><h3>' + esc(S.common.errorTitle) + '</h3><p class="muted">' + esc(S.common.errorBody) + '</p><button class="btn navy" data-act="retry">' + esc(S.common.tryAgain) + '</button></div>'; }
  function pageHead(title, sub, tools) { return '<div class="page-head"><div><h2>' + esc(title) + '</h2>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>' + (tools ? '<div class="tools">' + tools + '</div>' : '') + '</div>'; }
  function yearSelect(years, current) {
    if (!years || years.length < 2) return '';
    return '<label class="sr" for="year-select">' + esc(S.common.yearLabel) + '</label><select id="year-select" data-act="year">' + years.map(function (y) { return '<option value="' + y.startYear + '"' + (y.startYear === current.startYear ? ' selected' : '') + '>' + esc(S.common.academicYear(y.label)) + '</option>'; }).join('') + '</select>';
  }
  function reasonBlocks(days, oneLabel, manyLabel) {
    var groups = DIL.reasonGroups(days.filter(function (d) { return d.status !== 'withdrawn'; }));
    if (!groups.length) return '';
    if (groups.length === 1) return '<div class="reason"><b>' + esc(oneLabel) + '</b>' + esc(groups[0].reason) + '</div>';
    return groups.map(function (g) { return '<div class="reason"><b>' + esc(g.days.map(function (d) { return DIL.formatShort(d.date); }).join(', ')) + '</b>' + esc(g.reason) + '</div>'; }).join('');
  }
  function whyLabel() { return st.me && st.me.role === 'approver' ? S.decided.note : S.dash.noteFrom(st.me.cfg.principalName); }
  function whyLine(d) { return d.status === 'declined' && d.decisionNote ? '<span class="why"><b>' + esc(whyLabel()) + '</b>' + esc(d.decisionNote) + '</span>' : ''; }
  function insteadLine(r) { return r.replaces && r.replaces.dates && r.replaces.dates.length ? '<p class="instead-line">' + esc(S.dash.insteadOf(r.replaces.dates)) + '</p>' : ''; }
  function dayRow(d, right, noChip) { return '<li><span class="d">' + esc(DIL.formatLong(d.date)) + '</span><span class="p">' + esc(S.portion[d.portion]) + '</span><span class="grow"></span>' + (noChip ? '' : (right || dayChip(d))) + whyLine(d) + '</li>'; }
  // The card's chip is the umbrella; a row gets its own chip only when at least one row would differ from it (partly approved, a taken day, a cancelled day).
  function dayRows(r) { var differ = r.days.some(function (d) { return (d.status === 'approved' && d.date < st.me.today ? 'taken' : d.status) !== r.status; }); return '<ul class="rows">' + r.days.map(function (d) { return dayRow(d, null, !differ); }).join('') + '</ul>'; }

  /* ---------- shell ---------- */
  function navTabs() {
    var me = st.me, tabs = [];
    if (me.role === 'approver') { tabs.push(['queue', S.nav.approver.queue, true], ['decided', S.nav.approver.decided], ['overview', S.nav.approver.overview], ['staff', S.nav.approver.staff], ['dashboard', S.nav.approver.mine]); }
    else { tabs.push(['dashboard', S.nav.staff.dashboard], ['new', S.nav.staff.newRequest]); }
    return '<nav class="nav"><div class="wrap">' + tabs.map(function (t) { return '<button class="tab" data-tab="' + t[0] + '">' + esc(t[1]) + (t[2] ? '<span class="badge" id="badge"' + (st.badge ? '' : ' hidden') + '>' + esc(S.nav.queueBadge(st.badge)) + '</span>' : '') + '</button>'; }).join('') + '</div></nav>';
  }
  function shell() {
    var me = st.me;
    return '<header class="shell"><div class="wrap"><img class="crest" src="assets/crest-160.png" alt="' + esc(S.app.crestAlt) + '"><div class="brand"><h1>' + esc(S.app.name) + '</h1><div class="school">' + esc(S.app.school) + '</div></div>' +
      (me && me.name ? '<div class="who"><b>' + esc(me.name) + '</b><span>' + esc(me.email) + '</span></div>' : '') + '</div></header><div class="waitline" id="wait"></div>' +
      (me && me.role !== 'unknown' && me.email && !me.removed && !me.needName ? navTabs() : '') + '<main><div class="wrap" id="main"></div></main>';
  }
  function setBadge(n) { st.badge = n; var b = $('#badge'); if (b) { b.textContent = S.nav.queueBadge(n); b.hidden = !n; } }
  function go(tab) {
    if (st.tab === 'new' && tab !== 'new' && st.nr && !st.nr.sent && Object.keys(st.nr.picked).length && !st.nr.leaveOK) { showLeaveBar(tab); return; }
    st.tab = tab; $$('.tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    var m = $('#main'); m.innerHTML = loading(); window.scrollTo(0, 0);
    ({ dashboard: renderDashboard, 'new': renderNew, queue: renderQueue, decided: renderDecided, overview: renderOverview, staff: renderStaff })[tab]();
  }
  function showLeaveBar(tab) {
    var m = $('#main'); var old = $('.leave-bar', m); if (old) old.remove();
    m.insertAdjacentHTML('afterbegin', '<div class="confirm leave-bar"><span>' + esc(S.newReq.leaveConfirm) + '</span><button class="btn danger sm" data-act="leave" data-to="' + tab + '">' + esc(S.common.leave) + '</button><button class="btn sm" data-act="stay">' + esc(S.common.stay) + '</button></div>');
    window.scrollTo(0, 0);
  }

  /* ---------- doors ---------- */
  function renderDoor() {
    var me = st.me, m = $('#main');
    if (!me.email) { m.innerHTML = '<div class="card door"><h2>' + esc(S.doors.signedOut.title) + '</h2><p>' + esc(S.doors.signedOut.body) + '</p><a class="btn primary" href="' + esc(me.appUrl || '#') + '" target="_top">' + esc(S.doors.signedOut.button) + '</a></div>'; return; }
    if (me.removed || me.role === 'unknown') { var R = S.doors.removed; m.innerHTML = '<div class="card door"><h2>' + esc(R.title) + '</h2><p>' + esc(R.body(me.email)) + '</p><p id="door-msg">' + esc(R.hint) + '</p><p class="small" style="margin-top:18px">' + esc(R.wrongAccount) + '</p></div>'; return; }
    // the sign-in gave no name: ask once, then in
    var N = S.doors.needName;
    m.innerHTML = '<div class="card door"><h2>' + esc(N.title) + '</h2><p>' + esc(N.body(me.email)) + '</p><label class="f" for="door-name">' + esc(N.nameLabel) + '</label><input type="text" id="door-name" placeholder="' + esc(N.namePlaceholder) + '" autocomplete="name"><div class="help bad" id="door-err"></div><button class="btn primary lg" data-act="door-name">' + esc(N.button) + '</button></div>';
    $('#door-name').focus();
  }
  function doorName(btn) {
    var name = $('#door-name').value.trim(), err = $('#door-err');
    if (!name) { err.textContent = S.doors.needName.needName; $('#door-name').focus(); return; }
    err.textContent = ''; busy(btn, S.common.saving);
    call('setMyName', name).then(function (r) { if (!r.ok) throw 0; st.me.name = r.name; st.me.needName = false; go(st.me.role === 'approver' ? 'queue' : 'dashboard'); }).catch(function () { unbusy(btn); serverFailed(); });
  }
  // My days: the name the sign-in gave (often initial + surname on a staff account) with a one-line way to tidy it
  function nameLine() {
    return '<p class="muted small name-line" id="name-line" style="margin:-8px 0 16px">' + esc(S.dash.shownAs(st.me.name)) + ' <button class="linkish" data-act="name-edit">' + esc(S.dash.changeName) + '</button></p>';
  }
  function nameEdit() {
    var p = $('#name-line'); if (!p) return;
    p.outerHTML = '<div class="card name-edit" id="name-line"><label class="f" for="my-name">' + esc(S.dash.nameLabel) + '</label><div class="name-row"><input type="text" id="my-name" value="' + esc(st.me.name) + '" autocomplete="name"><button class="btn primary sm" data-act="name-save">' + esc(S.dash.saveName) + '</button><button class="btn quiet sm" data-act="name-keep">' + esc(S.common.keep) + '</button></div><div class="help bad" id="name-err"></div></div>';
    $('#my-name').focus(); $('#my-name').select();
  }
  function nameSave(btn) {
    var name = $('#my-name').value.trim(), err = $('#name-err');
    if (!name) { err.textContent = S.dash.needName; $('#my-name').focus(); return; }
    err.textContent = ''; busy(btn, S.common.saving);
    call('setMyName', name).then(function (r) { if (!r.ok) throw 0; st.me.name = r.name; toast(S.dash.nameSaved); go(st.tab); }).catch(function () { unbusy(btn); serverFailed(); });
  }

  /* ---------- staff dashboard ---------- */
  function renderDashboard() {
    var m = $('#main');
    call('myDays', st.years.dashboard || null).then(function (r) {
      if (st.tab !== 'dashboard') return;
      st.dash = r; st.years.dashboard = r.year.startYear;
      var cur = r.year.startYear === st.me.year.startYear, s = r.summary;
      var tools = yearSelect(r.years, r.year) + (cur && st.me.role !== 'approver' ? '<button class="btn primary" data-act="tab" data-tab="new">' + esc(S.dash.newRequest) + '</button>' : '');
      var h = pageHead(S.nav.staff.dashboard, S.dash.role(st.me.role === 'approver' ? S.dash.roleApprover : S.dash.roleStaff, r.year.label), tools);
      if (!cur) h += '<p class="muted small" style="margin:-8px 0 16px">' + esc(S.common.previousYear) + '</p>';
      h += nameLine();
      h += '<div class="tiles">' + tile('ok', s.approved, S.dash.tiles.approved, S.dash.tiles.approvedSub) + tile('taken', s.taken, S.dash.tiles.taken, S.dash.tiles.takenSub) + tile('navy', s.remaining, S.dash.tiles.remaining, S.dash.tiles.remainingSub) + tile('wait', s.pending, S.dash.tiles.pending, S.dash.tiles.pendingSub) + '</div>';
      h += '<div class="card"><h3>' + esc(S.dash.upcoming) + '</h3>' + (s.upcoming.length ? '<ul class="rows">' + s.upcoming.map(function (d) {
        var right = dayChip(d) + (d.date === st.me.today ? ' <span class="chip">' + esc(S.dash.todayTag) + '</span>' : '') + (DIL.canCancelDay(d, st.me.today) ? ' <button class="btn quiet sm" data-act="cancel-ask" data-day="' + esc(d.dayId) + '">' + esc(S.dash.cancelDay) + '</button>' : '');
        return '<li data-day="' + esc(d.dayId) + '"><span class="d">' + esc(DIL.formatFull(d.date)) + '</span><span class="p">' + esc(S.portion[d.portion]) + '</span><span class="grow"></span>' + right + '</li>';
      }).join('') + '</ul>' : '<p class="empty">' + esc(S.dash.upcomingEmpty) + '</p>') + '</div>';
      h += '<h3 style="margin:26px 0 12px;font-family:var(--display);font-size:22px;font-variation-settings:\'opsz\' 40">' + esc(S.dash.requests) + '</h3>';
      h += r.requests.length ? r.requests.map(staffRequestCard).join('') : '<p class="empty">' + esc(cur ? S.dash.requestsEmpty : S.dash.requestsEmptyPast) + '</p>';
      m.innerHTML = h;
    }).catch(function () { if (st.tab === 'dashboard') m.innerHTML = errorCard(); });
  }
  function tile(cls, n, label, sub) { return '<div class="tile ' + cls + '"><div class="n">' + esc(num(n)) + '</div><div class="l">' + esc(label) + '</div><div class="s">' + esc(sub) + '</div></div>'; }
  function staffRequestCard(r) {
    var h = '<div class="card req" data-id="' + esc(r.id) + '"><div class="top"><span class="t">' + esc(S.dash.requestLine(r.total, r.submittedAt)) + '</span>' + chip(r.status) + '</div>' + insteadLine(r);
    h += dayRows(r);
    h += reasonBlocks(r.days, S.dash.reason, S.dash.reasons);
    if (r.decisionNote) h += '<div class="note"><b>' + esc(S.dash.noteFrom(st.me.cfg.principalName)) + '</b>' + esc(r.decisionNote) + '</div>';
    if (r.decidedAt) h += '<p class="muted small" style="margin:8px 0 0">' + esc(S.dash.decidedOn(r.decidedAt)) + '</p>';
    var acts = '';
    if (DIL.canWithdraw(r.days)) acts += '<button class="btn sm" data-act="withdraw-ask">' + esc(S.dash.withdraw) + '</button>';
    if (st.me.role !== 'approver' && r.startYear === st.me.year.startYear && r.days.some(function (d) { return d.status === 'declined'; })) acts += '<button class="btn sm navy" data-act="instead" data-id="' + esc(r.id) + '">' + esc(S.dash.instead) + '</button>';
    if (acts) h += '<div class="actions">' + acts + '</div>';
    return h + '</div>';
  }
  // "Ask for a different day instead": opens a new request carrying the reason and a link to the declined day(s).
  function askInstead(btn) {
    var r = ((st.dash && st.dash.requests) || []).filter(function (x) { return x.id === btn.dataset.id; })[0]; if (!r) return;
    var declined = r.days.filter(function (d) { return d.status === 'declined'; });
    st.nrPreset = { reason: (declined[0] && declined[0].reason) || r.sharedReason || '', replaces: { id: r.id, dates: declined.map(function (d) { return d.date; }) } };
    st.nr = null; go('new');
  }
  function askWithdraw(btn) {
    var card = btn.closest('.req'); var a = $('.actions', card);
    a.innerHTML = '<div class="confirm" style="margin-top:0;flex:1"><span>' + esc(S.dash.withdrawConfirm) + '</span><button class="btn danger sm" data-act="withdraw-yes">' + esc(S.dash.withdrawYes) + '</button><button class="btn sm" data-act="withdraw-no">' + esc(S.common.keep) + '</button></div>';
  }
  function doWithdraw(btn) {
    var card = btn.closest('.req'), id = card.dataset.id; busy(btn, S.common.sendingEmail);
    call('withdraw', id).then(function (r) { if (!r.ok) { if (r.code === 'not_pending') { toast(S.dash.decidedMeanwhile); renderDashboard(); return; } throw 0; } toast(S.dash.withdrawn); renderDashboard(); }).catch(function () { unbusy(btn); serverFailed(); });
  }
  function askCancel(btn) {
    var li = btn.closest('li'), d = st.dash.summary.upcoming.filter(function (x) { return x.dayId === li.dataset.day; })[0];
    li.insertAdjacentHTML('beforeend', '<div class="confirm" style="flex-basis:100%"><span>' + esc(S.dash.cancelConfirm(d.date)) + '</span><button class="btn danger sm" data-act="cancel-yes" data-day="' + esc(d.dayId) + '">' + esc(S.dash.cancelYes) + '</button><button class="btn sm" data-act="cancel-no">' + esc(S.dash.cancelNo) + '</button></div>');
    btn.remove();
  }
  function doCancel(btn) {
    var d = st.dash.summary.upcoming.filter(function (x) { return x.dayId === btn.dataset.day; })[0]; busy(btn, S.common.sendingEmail);
    call('cancelDay', d.dayId).then(function (r) { if (!r.ok) { if (r.code === 'not_allowed') { toast(S.dash.changedMeanwhile); renderDashboard(); return; } throw 0; } toast(S.dash.cancelled(d.date)); renderDashboard(); }).catch(function () { unbusy(btn); serverFailed(); });
  }

  /* ---------- new request ---------- */
  function renderNew() {
    var m = $('#main');
    call('myDays', null).then(function (r) {
      if (st.tab !== 'new') return;
      var win = st.me.window, t = DIL.parts(st.me.today);
      st.nr = { data: r, months: DIL.monthRange(win.start, win.end), mi: 0, picked: {}, reason: '', perDay: false, sent: false, msg: '', replaces: null };
      if (st.nrPreset) { st.nr.reason = st.nrPreset.reason || ''; st.nr.replaces = st.nrPreset.replaces || null; st.nrPreset = null; }
      st.nr.months.forEach(function (mm, i) { if (mm.y === t.y && mm.m === t.m) st.nr.mi = i; });
      m.innerHTML = pageHead(S.newReq.title, S.newReq.sub(win.year.label)) + '<div class="two"><div>' +
        '<div class="card"><div class="step">' + esc(S.newReq.step1) + '</div><p class="muted small" style="margin:0 0 6px">' + esc(S.newReq.step1help) + '</p><div id="instead"></div><div id="cal"></div>' +
        '<label class="f" for="typed">' + esc(S.newReq.typedLabel) + '</label><div class="typed"><input type="text" id="typed" placeholder="' + esc(S.newReq.typedPlaceholder) + '" autocomplete="off"><button class="btn" data-act="typed-add">' + esc(S.newReq.typedAdd) + '</button></div><div class="help" id="typed-help"></div></div>' +
        '<div class="card"><h3>' + esc(S.newReq.picked) + '</h3><div id="picked"></div></div>' +
        '<div class="card"><div class="step">' + esc(S.newReq.step2) + '</div><div id="reason"></div></div>' +
        '</div><div class="sticky"><div class="card summary"><div class="step">' + esc(S.newReq.step3) + '</div><div id="summary"></div></div></div></div>';
      drawInstead(); drawCalendar(); drawPicked(); drawReason(); drawSummary();
    }).catch(function () { if (st.tab === 'new') m.innerHTML = errorCard(); });
  }
  function drawInstead() {
    var n = st.nr, el = $('#instead'); if (!el) return;
    el.innerHTML = n.replaces ? '<div class="instead"><span>' + esc(S.dash.insteadOf(n.replaces.dates)) + '</span><button type="button" class="link" data-act="drop-instead">' + esc(S.newReq.insteadDrop) + '</button></div>' : '';
  }
  function nrCtx() { var n = st.nr; return { todayISO: st.me.today, window: st.me.window, closures: n.data.closures, existing: n.data.existing, picked: [] }; }
  function drawCalendar() {
    var n = st.nr, mm = n.months[n.mi], g = DIL.monthGrid(mm.y, mm.m, nrCtx()), L = S.newReq.calendarLegend;
    var h = '<div class="cal-head"><button class="btn quiet sm" data-act="cal-prev"' + (n.mi === 0 ? ' disabled' : '') + ' aria-label="' + esc(S.newReq.prevMonth) + '">←</button><b>' + esc(g.label) + '</b><button class="btn quiet sm" data-act="cal-next"' + (n.mi === n.months.length - 1 ? ' disabled' : '') + ' aria-label="' + esc(S.newReq.nextMonth) + '">→</button></div><div class="cal">';
    h += DIL.DAY_SHORT.slice(1).concat(DIL.DAY_SHORT.slice(0, 1)).map(function (d) { return '<div class="wd">' + esc(d) + '</div>'; }).join('');
    g.weeks.forEach(function (w) { w.forEach(function (c) {
      var cls = [], title = '', p = c.problem;
      if (!c.inMonth) cls.push('other');
      else if (n.picked[c.iso]) { cls.push('picked'); if (n.picked[c.iso].portion !== 'full') cls.push('half'); }
      else if (p) { if (p.code === 'closure') { cls.push('off', 'closed'); } else if (p.code === 'already_requested') cls.push('mine'); else cls.push('off'); title = S.dateProblem.describe(p); }
      if (c.today) cls.push('today');
      h += '<button type="button" class="' + cls.join(' ') + '" data-act="cal-day" data-iso="' + c.iso + '"' + (title ? ' title="' + esc(title) + '"' : '') + (c.inMonth ? '' : ' tabindex="-1"') + '>' + c.day + '</button>';
    }); });
    h += '</div><div class="legend"><span><i style="background:var(--navy)"></i>' + esc(L.picked) + '</span><span><i style="background:repeating-linear-gradient(135deg,#F1F3F7 0 3px,#DDE3EC 3px 6px)"></i>' + esc(L.closed) + '</span><span><i style="background:var(--ok-soft);border:1px solid var(--ok)"></i>' + esc(L.requested) + '</span></div><div class="help" id="cal-help"></div>';
    $('#cal').innerHTML = h;
  }
  function pickedList() { return Object.keys(st.nr.picked).sort(); }
  function addDay(iso) {
    var n = st.nr; n.picked[iso] = { portion: 'full', reason: n.perDay ? n.reason : '' };
    var p = DIL.parts(iso); n.months.forEach(function (mm, i) { if (mm.y === p.y && mm.m === p.m) n.mi = i; });
    n.msg = ''; drawCalendar(); drawPicked(); drawReason(); drawSummary();
  }
  function removeDay(iso) { delete st.nr.picked[iso]; drawCalendar(); drawPicked(); drawReason(); drawSummary(); }
  function drawPicked() {
    var n = st.nr, list = pickedList();
    if (!list.length) { $('#picked').innerHTML = '<p class="empty">' + esc(S.newReq.pickedEmpty) + '</p>'; return; }
    var h = '<ul class="rows picked-list">' + list.map(function (iso) {
      var pk = n.picked[iso];
      return '<li data-iso="' + iso + '"><span class="d">' + esc(DIL.formatLong(iso)) + '</span><span class="seg">' + DIL.PORTIONS.map(function (p) { return '<button type="button" class="' + (pk.portion === p ? 'on' : '') + '" data-act="portion" data-iso="' + iso + '" data-p="' + p + '">' + esc(S.portion[p]) + '</button>'; }).join('') + '</span><span class="grow"></span><button type="button" class="x" data-act="remove-day" data-iso="' + iso + '" aria-label="' + esc(S.newReq.removeDay(iso)) + '">×</button></li>';
    }).join('') + '</ul>';
    var tot = DIL.total(list.map(function (iso) { return { portion: n.picked[iso].portion }; }));
    h += '<div class="total">' + esc(S.newReq.total(tot)) + '</div>';
    $('#picked').innerHTML = h;
  }
  function drawReason() {
    var n = st.nr, list = pickedList(), quick = (st.me.cfg && st.me.cfg.quickReasons) || [];
    var h = '';
    if (!n.perDay) {
      h += '<label class="f" for="reason-box">' + esc(S.newReq.reasonLabel) + '</label><textarea id="reason-box" data-act="reason" placeholder="' + esc(S.newReq.reasonPlaceholder) + '">' + esc(n.reason) + '</textarea>';
      if (list.length) h += '<div class="help">' + esc(S.newReq.reasonOneForAll(list.length)) + '</div>';
    } else {
      h += list.map(function (iso) { return '<label class="f" for="r-' + iso + '">' + esc(S.newReq.perDayLabel(iso)) + '</label><textarea id="r-' + iso + '" data-act="reason-day" data-iso="' + iso + '" placeholder="' + esc(S.newReq.reasonPlaceholder) + '">' + esc(n.picked[iso].reason) + '</textarea>'; }).join('');
    }
    if (quick.length) h += '<div class="chips"><span class="lbl">' + esc(S.newReq.quickFill) + '</span>' + quick.map(function (q) { return '<button type="button" data-act="quick" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>';
    if (list.length > 1) h += '<p style="margin:14px 0 0"><button type="button" class="link" data-act="toggle-perday">' + esc(n.perDay ? S.newReq.sameReason : S.newReq.differentReason) + '</button></p>';
    $('#reason').innerHTML = h;
  }
  function drawSummary() {
    var n = st.nr, list = pickedList(), box = $('#summary'); if (!box) return;
    if (n.sent) return;
    if (!list.length) { box.innerHTML = '<p class="empty">' + esc(S.newReq.summaryEmpty) + '</p>' + sendButton() + msgLine(); return; }
    var days = list.map(function (iso) { return { date: iso, portion: n.picked[iso].portion, reason: n.perDay ? n.picked[iso].reason : n.reason, status: 'pending' }; });
    var h = '<ul class="rows">' + days.map(function (d) { return '<li><span class="d">' + esc(DIL.formatLong(d.date)) + '</span><span class="p">' + esc(S.portion[d.portion]) + '</span></li>'; }).join('') + '</ul>';
    h += '<div class="total">' + esc(S.newReq.total(DIL.total(days))) + '</div>';
    if (n.replaces) h += '<p class="muted small" style="margin:8px 0 0">' + esc(S.dash.insteadOf(n.replaces.dates)) + '</p>';
    var withReason = days.filter(function (d) { return String(d.reason || '').trim(); });
    if (withReason.length) h += reasonBlocks(withReason, S.dash.reason, S.dash.reasons);
    box.innerHTML = h + sendButton() + msgLine();
  }
  function sendButton() { return '<p style="margin:16px 0 0"><button class="btn primary lg" data-act="send" style="width:100%;justify-content:center">' + esc(S.newReq.send(st.me.cfg.principalName)) + '</button></p>'; }
  function msgLine() { return '<div class="inline-msg bad" id="send-msg">' + esc(st.nr.msg || '') + '</div>'; }
  function setMsg(t) { st.nr.msg = t; var el = $('#send-msg'); if (el) el.textContent = t; }
  function typedAdd() {
    var inp = $('#typed'), help = $('#typed-help'), iso = DIL.parseTypedDate(inp.value, { todayISO: st.me.today });
    help.className = 'help bad';
    if (!iso) { help.textContent = S.dateProblem.invalid; return; }
    var ctx = nrCtx(); ctx.picked = pickedList(); var p = DIL.dateProblem(iso, ctx);
    if (p) { help.textContent = S.dateProblem.describe(p); return; }
    help.className = 'help'; help.textContent = ''; inp.value = ''; addDay(iso);
  }
  function calClick(btn) {
    var iso = btn.dataset.iso, n = st.nr, help = $('#cal-help');
    if (n.picked[iso]) { removeDay(iso); return; }
    var ctx = nrCtx(); var p = DIL.dateProblem(iso, ctx);
    if (p) { help.className = 'help bad'; help.textContent = S.dateProblem.describe(p); return; }
    help.textContent = ''; addDay(iso);
  }
  function send(btn) {
    var n = st.nr, list = pickedList();
    if (!list.length) return setMsg(S.newReq.needDays);
    if (!n.perDay && !n.reason.trim()) return setMsg(S.newReq.needReason);
    if (n.perDay && list.some(function (iso) { return !String(n.picked[iso].reason || '').trim(); })) return setMsg(S.newReq.needEveryReason);
    var sub = { reason: n.perDay ? '' : n.reason.trim(), days: list.map(function (iso) { return { date: iso, portion: n.picked[iso].portion, reason: n.perDay ? n.picked[iso].reason.trim() : '' }; }) };
    if (n.replaces) sub.replaces = n.replaces;
    var v = DIL.validateSubmission(sub, nrCtx());
    if (!v.ok) return setMsg(S.dateProblem.describe(v.detail || { code: v.code }));
    setMsg(''); busy(btn, S.newReq.sending);
    call('submit', sub).then(function (r) {
      if (!r.ok) { unbusy(btn); setMsg(S.dateProblem.describe(r.detail || { code: r.code })); return; }
      n.sent = true; n.leaveOK = true;
      $('#main').innerHTML = pageHead(S.newReq.title, S.newReq.sub(st.me.window.year.label)) + '<div class="done-line">✓ ' + esc(S.newReq.sentTitle) + '</div><div class="card" style="margin-top:16px"><p style="margin:0 0 14px">' + esc(S.newReq.sentBody(st.me.cfg.principalName)) + '</p>' + staffRequestCard(r.request) + '<p style="margin:18px 0 0"><button class="btn navy" data-act="tab" data-tab="dashboard">' + esc(S.newReq.backToDays) + '</button></p></div>';
      window.scrollTo(0, 0);
    }).catch(function () { unbusy(btn); serverFailed(); });
  }

  /* ---------- approver: queue ---------- */
  function renderQueue() {
    var m = $('#main');
    call('queue').then(function (r) {
      if (st.tab !== 'queue') return;
      setBadge(r.count); st.q = {};
      var h = pageHead(S.queue.title, S.queue.sub(r.count));
      if (!r.requests.length) h += '<div class="card"><p class="empty">' + esc(S.queue.empty) + '</p></div>';
      else h += r.requests.map(function (q) { st.q[q.id] = { req: q, choices: {}, why: '', own: {}, note: '' }; q.days.forEach(function (d) { st.q[q.id].choices[d.dayId] = 'approved'; }); return decideCard(q, false); }).join('');
      m.innerHTML = h;
    }).catch(function () { if (st.tab === 'queue') m.innerHTML = errorCard(); });
  }
  function decideCard(q, change) {
    var qs = st.q[q.id], first = DIL.firstName(q.staffName);
    var h = '<div class="card qcard" data-id="' + esc(q.id) + '"><div class="top"><div><div class="name">' + esc(q.staffName) + '</div><div class="meta">' + esc(DIL.formatDays(q.total) + ' · ' + S.queue.sent(q.submittedAt)) + '</div></div>' + (change ? chip(q.status) : '') + '</div>' + insteadLine(q);
    h += '<ul class="rows" id="rows-' + esc(q.id) + '">' + decideRows(q.id) + '</ul>';
    h += reasonBlocks(q.days, S.queue.reason, S.queue.reasons);
    if (q.yearSoFar) h += '<div class="yr">' + esc(S.queue.yearSoFar(first, q.yearSoFar.approved, q.yearSoFar.remaining)) + '</div>';
    if (change) h += '<p class="inline-msg" style="color:#8A6A0C">' + esc(S.queue.changeWarning) + '</p>';
    h += '<label class="f" id="nl-' + esc(q.id) + '" for="note-' + esc(q.id) + '">' + esc(noteLabel(q.id)) + '</label><textarea id="note-' + esc(q.id) + '" data-act="note" placeholder="' + esc(S.queue.notePlaceholder) + '">' + esc(qs.note) + '</textarea>';
    h += '<div class="foot"><button class="btn primary lg" data-act="decide" data-change="' + (change ? '1' : '') + '">' + esc(decideLabel(q.id, change)) + '</button>' + (change ? '<button type="button" class="link" data-act="cancel-change">' + esc(S.queue.cancelChange) + '</button>' : '') + '<span class="inline-msg bad" id="msg-' + esc(q.id) + '"></span></div></div>';
    return h;
  }
  // Live days in order; the declined ones share ONE reason (held on the first of them) unless a day is given its own.
  function liveDays(q) { return q.days.filter(function (d) { return d.status !== 'withdrawn' && d.status !== 'cancelled'; }); }
  function whyState(qs) {
    var dec = liveDays(qs.req).filter(function (d) { return qs.choices[d.dayId] === 'declined'; }), master = dec[0] || null;
    if (master && qs.own[master.dayId] !== undefined) { qs.why = qs.own[master.dayId]; delete qs.own[master.dayId]; }
    return { dec: dec, master: master, covered: dec.filter(function (d) { return qs.own[d.dayId] === undefined; }) };
  }
  function whyMap(qs) {
    var w = whyState(qs), days = {}, i, d, text;
    for (i = 0; i < w.dec.length; i++) {
      d = w.dec[i]; text = String(qs.own[d.dayId] !== undefined ? qs.own[d.dayId] : qs.why).trim();
      if (!text) return { missing: d === w.master ? w.master : d, many: d === w.master && w.covered.length > 1 };
      days[d.dayId] = text;
    }
    return { days: days };
  }
  function decideRows(id) {
    var qs = st.q[id], q = qs.req, first = DIL.firstName(q.staffName), w = whyState(qs), h = '';
    liveDays(q).forEach(function (d) {
      var c = qs.choices[d.dayId], lbl;
      h += '<li><span class="d">' + esc(DIL.formatLong(d.date)) + '</span><span class="p">' + esc(S.portion[d.portion]) + '</span><span class="grow"></span><span class="seg decide"><button type="button" class="' + (c === 'approved' ? 'on ok' : '') + '" data-act="choose" data-day="' + esc(d.dayId) + '" data-c="approved">' + esc(S.queue.approve) + '</button><button type="button" class="' + (c === 'declined' ? 'on no' : '') + '" data-act="choose" data-day="' + esc(d.dayId) + '" data-c="declined">' + esc(S.queue.decline) + '</button></span></li>';
      if (c !== 'declined') return;
      if (d === w.master) {
        lbl = w.covered.length > 1 ? S.queue.dayNoteLabelMany(w.covered.map(function (x) { return x.date; })) : S.queue.dayNoteLabel(d.date);
        h += '<li class="daynote"><label class="f" for="dn-' + esc(d.dayId) + '">' + esc(lbl) + '</label><textarea id="dn-' + esc(d.dayId) + '" data-act="daynote" data-shared="1" placeholder="' + esc(S.queue.dayNotePlaceholder(first)) + '">' + esc(qs.why) + '</textarea></li>';
      } else if (qs.own[d.dayId] !== undefined) {
        h += '<li class="daynote"><label class="f" for="dn-' + esc(d.dayId) + '">' + esc(S.queue.dayNoteLabel(d.date)) + '</label><textarea id="dn-' + esc(d.dayId) + '" data-act="daynote" data-day="' + esc(d.dayId) + '" placeholder="' + esc(S.queue.dayNotePlaceholder(first)) + '">' + esc(qs.own[d.dayId]) + '</textarea><p class="small" style="margin:6px 0 0"><button type="button" class="link" data-act="use-same" data-day="' + esc(d.dayId) + '">' + esc(S.queue.useSame(w.master.date)) + '</button></p></li>';
      } else {
        h += '<li class="daynote same"><span>' + esc(S.queue.sameAs(w.master.date)) + '</span><button type="button" class="link" data-act="own-note" data-day="' + esc(d.dayId) + '">' + esc(S.queue.ownReason) + '</button></li>';
      }
    });
    return h;
  }
  function ownNote(btn) { var id = btn.closest('.qcard').dataset.id, day = btn.dataset.day; st.q[id].own[day] = ''; $('#rows-' + CSS.escape(id)).innerHTML = decideRows(id); var ta = $('#dn-' + CSS.escape(day)); if (ta) ta.focus(); }
  function useSame(btn) { var id = btn.closest('.qcard').dataset.id; delete st.q[id].own[btn.dataset.day]; $('#rows-' + CSS.escape(id)).innerHTML = decideRows(id); }
  function tallies(id) { var qs = st.q[id], a = [], d = []; qs.req.days.forEach(function (x) { if (x.status === 'withdrawn' || x.status === 'cancelled') return; (qs.choices[x.dayId] === 'declined' ? d : a).push(x); }); return { a: DIL.total(a), d: DIL.total(d) }; }
  function noteLabel(id) { return S.queue.noteLabel(DIL.firstName(st.q[id].req.staffName)); }
  function decideLabel(id, change) { var first = DIL.firstName(st.q[id].req.staffName), t = tallies(id); return change ? S.queue.changeButton(first) : S.queue.button(first, t.a, t.d); }
  function choose(btn) {
    var card = btn.closest('.qcard'), id = card.dataset.id, day = btn.dataset.day; st.q[id].choices[day] = btn.dataset.c;
    $('#rows-' + CSS.escape(id)).innerHTML = decideRows(id);
    if (btn.dataset.c === 'declined') { var w = whyState(st.q[id]), ta = $('#dn-' + CSS.escape(day)) || (w.master ? $('#dn-' + CSS.escape(w.master.dayId)) : null); if (ta && !ta.value) ta.focus(); }
    var db = $('[data-act=decide]', card); if (!isBusy(db)) db.textContent = decideLabel(id, !!db.dataset.change);
  }
  function decide(btn) {
    var card = btn.closest('.qcard'), id = card.dataset.id, qs = st.q[id], msg = $('#msg-' + CSS.escape(id)), t = tallies(id), first = DIL.firstName(qs.req.staffName), change = !!btn.dataset.change;
    var w = whyMap(qs);
    if (w.missing) { msg.textContent = w.many ? S.queue.needDayNotes : S.queue.needDayNote(w.missing.date); var ta = $('#dn-' + CSS.escape(w.missing.dayId)); if (ta) ta.focus(); return; }
    msg.textContent = ''; busy(btn, S.queue.busy);
    call('decide', id, qs.choices, { general: qs.note.trim(), days: w.days }, change).then(function (r) {
      if (!r.ok) { unbusy(btn); if (r.code === 'withdrawn') { toast(S.queue.gone(first)); renderQueue(); return; } if (r.code === 'not_pending') { toast(S.queue.alreadyDecided); renderQueue(); return; } msg.textContent = r.code === 'day_note_required' ? S.queue.needDayNote(r.date) : S.queue.failed; return; }
      if (typeof r.queueCount === 'number') setBadge(r.queueCount);
      if (change) { card.outerHTML = decidedCard(r.request); toast(S.queue.done(first)); return; }
      card.innerHTML = '<div class="done-line">✓ ' + esc(S.queue.done(first)) + '</div>';
      setTimeout(function () { card.classList.add('leaving'); setTimeout(function () { if (!document.body.contains(card)) return; card.remove(); var left = $$('.qcard').length; var sub = $('.page-head .sub'); if (sub) sub.textContent = S.queue.sub(left); if (!left && $('#main')) $('#main').insertAdjacentHTML('beforeend', '<div class="card"><p class="empty">' + esc(S.queue.empty) + '</p></div>'); }, 450); }, 1400);
    }).catch(function () { unbusy(btn); msg.textContent = S.queue.failed; serverFailed(); });
  }

  /* ---------- approver: decided ---------- */
  function renderDecided() {
    var m = $('#main');
    call('decided', st.years.decided || null).then(function (r) {
      if (st.tab !== 'decided') return;
      st.dec = r; st.years.decided = r.year.startYear; st.q = {};
      var F = S.decided.filters, f = st.decidedFilter;
      var filters = '<div class="filters">' + ['all', 'approved', 'declined', 'partly', 'other'].map(function (k) { return '<button type="button" class="' + (f === k ? 'on' : '') + '" data-act="filter" data-f="' + k + '">' + esc(F[k]) + '</button>'; }).join('') + '</div>';
      var list = r.requests.filter(function (q) { return f === 'all' || (f === 'other' ? (q.status === 'withdrawn') : q.status === f); });
      m.innerHTML = pageHead(S.decided.title, S.decided.sub(r.year.label), yearSelect(r.years, r.year)) + filters + '<div style="height:16px"></div>' + (list.length ? list.map(decidedCard).join('') : '<div class="card"><p class="empty">' + esc(S.decided.empty) + '</p></div>');
    }).catch(function () { if (st.tab === 'decided') m.innerHTML = errorCard(); });
  }
  function decidedCard(q) {
    var h = '<div class="card req" data-id="' + esc(q.id) + '"><div class="top"><div><span class="t">' + esc(q.staffName) + '</span> <span class="m">· ' + esc(DIL.formatDays(q.total) + ' · ' + S.queue.sent(q.submittedAt)) + '</span></div>' + chip(q.status) + '</div>' + insteadLine(q);
    h += dayRows(q);
    h += reasonBlocks(q.days, S.queue.reason, S.queue.reasons);
    if (q.decisionNote) h += '<div class="note"><b>' + esc(S.decided.note) + '</b>' + esc(q.decisionNote) + '</div>';
    if (q.decidedAt) h += '<p class="muted small" style="margin:8px 0 0">' + esc(S.decided.decidedBy(q.decidedByName, q.decidedAt)) + '</p>';
    if (q.status !== 'withdrawn' && q.startYear === st.me.year.startYear) h += '<div class="actions"><button class="btn sm" data-act="change">' + esc(S.decided.change) + '</button></div>';
    return h + '</div>';
  }
  function startChange(btn) {
    var card = btn.closest('.req'), q = st.dec.requests.filter(function (x) { return x.id === card.dataset.id; })[0];
    st.q[q.id] = { req: q, choices: {}, why: '', own: {}, note: q.decisionNote || '' }; var seen = false;
    q.days.forEach(function (d) { st.q[q.id].choices[d.dayId] = d.status === 'declined' ? 'declined' : 'approved'; if (d.status !== 'declined') return; if (!seen) { st.q[q.id].why = d.decisionNote || ''; seen = true; } else if ((d.decisionNote || '') !== st.q[q.id].why) st.q[q.id].own[d.dayId] = d.decisionNote || ''; });
    card.outerHTML = decideCard(q, true);
  }
  function cancelChange(btn) { var card = btn.closest('.qcard'), q = st.q[card.dataset.id].req; card.outerHTML = decidedCard(q); }

  /* ---------- approver: overview ---------- */
  function renderOverview() {
    var m = $('#main');
    call('overview', st.years.overview || null).then(function (r) {
      if (st.tab !== 'overview') return;
      st.years.overview = r.year.startYear; var T = S.overview.tiles, t = r.totals, C = S.overview.cols;
      var tools = yearSelect(r.years, r.year) + '<button class="btn" data-act="csv">' + esc(S.overview.csv) + '</button>' + (st.me.sheetUrl ? '<a class="btn quiet" href="' + esc(st.me.sheetUrl) + '" target="_top">' + esc(S.overview.sheet) + '</a>' : '');
      var h = pageHead(S.overview.title, S.overview.sub(r.year.label), tools);
      h += '<div class="tiles">' + tile('navy', t.requested, T.requested, T.requestedSub(r.rows.length)) + tile('ok', t.approved, T.approved, T.approvedSub(t.taken, t.remaining)) + tile('no', t.declined, T.declined, T.declinedSub) + tile('wait', t.pending, T.pending, T.pendingSub) + '</div>';
      h += '<div class="card"><h3>' + esc(S.overview.away) + '</h3>' + (r.away.length ? '<ul class="rows">' + r.away.map(function (d) { return '<li><span class="d">' + esc(DIL.formatFull(d.date)) + '</span><span class="who">' + esc(d.staffName) + '</span><span class="grow"></span><span class="p">' + esc(S.portion[d.portion]) + '</span></li>'; }).join('') + '</ul>' : '<p class="empty">' + esc(S.overview.awayEmpty) + '</p>') + '</div>';
      var max = Math.max(1, Math.max.apply(null, r.buckets.map(function (b) { return b.approved + b.pending; })));
      h += '<div class="card"><h3>' + esc(S.overview.byMonth) + '</h3><div class="bars">' + r.buckets.map(function (b) {
        var tot = b.approved + b.pending;
        return '<div class="col' + (b.m === r.currentMonth ? ' now' : '') + '"><div class="v">' + (tot ? esc(num(tot)) : '') + '</div>' + (b.pending ? '<div class="b p" style="height:' + (b.pending / max * 100) + '%"></div>' : '') + '<div class="b" style="height:' + Math.max(1.5, b.approved / max * 100) + '%"></div><div class="l">' + esc(b.label) + '</div></div>';
      }).join('') + '</div><div class="legend" style="margin-top:14px"><span><i style="background:var(--navy)"></i>' + esc(S.overview.byMonthLegend.approved) + '</span><span><i style="background:var(--gold)"></i>' + esc(S.overview.byMonthLegend.pending) + '</span></div></div>';
      h += '<div class="card"><h3>' + esc(S.overview.byStaff) + '</h3>' + (r.rows.length ? '<div class="table-wrap"><table class="table"><thead><tr>' + ['name', 'requested', 'approved', 'declined', 'pending', 'taken', 'remaining'].map(function (k) { return '<th>' + esc(C[k]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        r.rows.map(function (x) { return '<tr><td>' + esc(x.name) + '</td>' + ['requested', 'approved', 'declined', 'pending', 'taken', 'remaining'].map(function (k) { return '<td class="' + (x[k] ? '' : 'z') + '">' + esc(num(x[k])) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '<tr class="total"><td></td>' + ['requested', 'approved', 'declined', 'pending', 'taken', 'remaining'].map(function (k) { return '<td>' + esc(num(t[k])) + '</td>'; }).join('') + '</tr></tbody></table></div>' : '<p class="empty">' + esc(S.overview.byStaffEmpty) + '</p>') + '</div>';
      m.innerHTML = h;
    }).catch(function () { if (st.tab === 'overview') m.innerHTML = errorCard(); });
  }
  function downloadCsv(btn) {
    busy(btn, S.common.working);
    call('csv', st.years.overview || null).then(function (r) {
      unbusy(btn); if (!r.ok) throw 0;
      var blob = new Blob(['﻿' + r.content], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = r.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    }).catch(function () { unbusy(btn); serverFailed(); });
  }

  /* ---------- approver: staff list ---------- */
  function renderStaff() {
    var m = $('#main');
    call('staffList').then(function (r) {
      if (st.tab !== 'staff') return;
      var A = S.staffAdmin, C = A.cols;
      var h = pageHead(A.title, A.sub, '<span class="muted">' + esc(A.count(r.staff.length)) + '</span>');
      h += '<div class="card"><div class="table-wrap"><table class="table staff"><thead><tr><th>' + esc(C.name) + '</th><th style="text-align:left">' + esc(C.email) + '</th><th style="text-align:left">' + esc(C.role) + '</th><th></th></tr></thead><tbody>' + r.staff.map(function (s) {
        var me = DIL.norm(s.email) === DIL.norm(st.me.email), nm = s.name || s.email, toApprover = s.role !== 'approver';
        return '<tr data-email="' + esc(s.email) + '" data-name="' + esc(nm) + '"><td>' + esc(s.name) + (me ? ' <span class="chip">' + esc(A.you) + '</span>' : '') + '</td><td style="text-align:left">' + esc(s.email) + '</td><td style="text-align:left"><span class="role">' + esc(A.roles[s.role] || s.role) + '</span></td><td class="acts">' + (me ? '' : '<button class="btn quiet sm" data-act="role-ask" data-to="' + (toApprover ? 'approver' : 'staff') + '">' + esc(toApprover ? A.makeApprover : A.makeStaff) + '</button> <button class="btn quiet sm" data-act="remove-ask" data-name="' + esc(nm) + '">' + esc(A.remove) + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
      h += '<div class="card"><h3>' + esc(A.addTitle) + '</h3><p class="muted small" style="margin:0 0 10px">' + esc(A.addSub) + '</p><div class="staff-form"><div><label class="f" for="add-name">' + esc(A.addName) + '</label><input type="text" id="add-name" placeholder="' + esc(A.addNamePlaceholder) + '"></div><div><label class="f" for="add-email">' + esc(A.addEmail) + '</label><input type="email" id="add-email" placeholder="' + esc(A.addEmailPlaceholder) + '"></div><div><label class="f" for="add-role">' + esc(A.addRole) + '</label><select id="add-role"><option value="staff">' + esc(A.roles.staff) + '</option><option value="approver">' + esc(A.roles.approver) + '</option></select></div><div><button class="btn primary" data-act="add-staff">' + esc(A.addButton) + '</button></div></div><div class="inline-msg" id="add-msg"></div></div>';
      m.innerHTML = h;
    }).catch(function () { if (st.tab === 'staff') m.innerHTML = errorCard(); });
  }
  function askRole(btn) {
    var tr = btn.closest('tr'), A = S.staffAdmin, to = btn.dataset.to;
    tr.insertAdjacentHTML('afterend', '<tr class="confirm-row"><td colspan="4" style="text-align:left"><div class="confirm" style="margin:0"><span>' + esc(A.roleConfirm(tr.dataset.name, to === 'approver')) + '</span><button class="btn primary sm" data-act="role-yes" data-email="' + esc(tr.dataset.email) + '" data-name="' + esc(tr.dataset.name) + '" data-to="' + esc(to) + '">' + esc(to === 'approver' ? A.makeApprover : A.makeStaff) + '</button><button class="btn sm" data-act="confirm-no">' + esc(S.common.keep) + '</button></div></td></tr>');
    $$('.table [data-act=role-ask],.table [data-act=remove-ask]').forEach(function (b) { b.disabled = true; });
  }
  function doRole(btn) {
    busy(btn, S.common.saving);
    call('staffRole', btn.dataset.email, btn.dataset.to).then(function (r) { if (!r.ok) throw 0; toast(S.staffAdmin.roleChanged(btn.dataset.name, btn.dataset.to === 'approver')); renderStaff(); }).catch(function () { unbusy(btn); serverFailed(); });
  }
  function askRemove(btn) {
    var tr = btn.closest('tr'), A = S.staffAdmin;
    tr.insertAdjacentHTML('afterend', '<tr class="confirm-row"><td colspan="4" style="text-align:left"><div class="confirm" style="margin:0"><span>' + esc(A.removeConfirm(btn.dataset.name)) + '</span><button class="btn danger sm" data-act="remove-yes" data-email="' + esc(tr.dataset.email) + '" data-name="' + esc(btn.dataset.name) + '">' + esc(A.remove) + '</button><button class="btn sm" data-act="confirm-no">' + esc(S.common.keep) + '</button></div></td></tr>');
    $$('.table [data-act=role-ask],.table [data-act=remove-ask]').forEach(function (b) { b.disabled = true; });
  }
  function doRemove(btn) {
    busy(btn, S.common.saving);
    call('staffRemove', btn.dataset.email).then(function (r) { if (!r.ok) throw 0; toast(S.staffAdmin.removed(btn.dataset.name)); renderStaff(); }).catch(function () { unbusy(btn); serverFailed(); });
  }
  function addStaff(btn) {
    var A = S.staffAdmin, name = $('#add-name').value.trim(), email = $('#add-email').value.trim(), role = $('#add-role').value, msg = $('#add-msg');
    if (!name) { msg.textContent = A.needName; $('#add-name').focus(); return; }
    if (!/^[A-Za-z0-9._-]+@c2ken\.net$/i.test(email)) { msg.textContent = A.badEmail; $('#add-email').focus(); return; }
    msg.textContent = ''; busy(btn, S.common.saving);
    call('staffAdd', { name: name, email: email, role: role }).then(function (r) {
      if (!r.ok) { unbusy(btn); msg.textContent = r.code === 'duplicate' ? A.duplicate : r.code === 'bad_email' ? A.badEmail : S.common.errorBody; return; }
      toast(A.added(name)); renderStaff();
    }).catch(function () { unbusy(btn); serverFailed(); });
  }

  /* ---------- events ---------- */
  function onClick(e) {
    var t = e.target.closest('[data-act],[data-tab]'); if (!t) return;
    if (t.dataset.tab && !t.dataset.act) { go(t.dataset.tab); return; }
    var act = t.dataset.act; if (t.tagName === 'BUTTON' && isBusy(t)) return;
    switch (act) {
      case 'tab': go(t.dataset.tab); break;
      case 'retry': go(st.tab); break;
      case 'leave': st.nr.leaveOK = true; go(t.dataset.to); break;
      case 'stay': t.closest('.leave-bar').remove(); break;
      case 'door-name': doorName(t); break;
      case 'name-edit': nameEdit(); break;
      case 'name-save': nameSave(t); break;
      case 'name-keep': go(st.tab); break;
      case 'withdraw-ask': askWithdraw(t); break;
      case 'withdraw-yes': doWithdraw(t); break;
      case 'withdraw-no': renderDashboardCardsOnly(); break;
      case 'cancel-ask': askCancel(t); break;
      case 'cancel-yes': doCancel(t); break;
      case 'cancel-no': renderDashboard(); break;
      case 'cal-prev': st.nr.mi--; drawCalendar(); break;
      case 'cal-next': st.nr.mi++; drawCalendar(); break;
      case 'cal-day': calClick(t); break;
      case 'typed-add': typedAdd(); break;
      case 'remove-day': removeDay(t.dataset.iso); break;
      case 'portion': st.nr.picked[t.dataset.iso].portion = t.dataset.p; drawPicked(); drawCalendar(); drawSummary(); break;
      case 'quick': if (st.nr.perDay) { var last = document.activeElement; var iso = last && last.dataset && last.dataset.iso ? last.dataset.iso : pickedList()[0]; if (iso) { st.nr.picked[iso].reason = t.dataset.q; drawReason(); } } else { st.nr.reason = t.dataset.q; drawReason(); } drawSummary(); break;
      case 'toggle-perday': st.nr.perDay = !st.nr.perDay; if (st.nr.perDay) pickedList().forEach(function (iso) { if (!st.nr.picked[iso].reason) st.nr.picked[iso].reason = st.nr.reason; }); drawReason(); drawSummary(); break;
      case 'send': send(t); break;
      case 'choose': choose(t); break;
      case 'own-note': ownNote(t); break;
      case 'use-same': useSame(t); break;
      case 'instead': askInstead(t); break;
      case 'drop-instead': st.nr.replaces = null; drawInstead(); drawSummary(); break;
      case 'decide': decide(t); break;
      case 'change': startChange(t); break;
      case 'cancel-change': cancelChange(t); break;
      case 'filter': st.decidedFilter = t.dataset.f; renderDecided(); break;
      case 'csv': downloadCsv(t); break;
      case 'remove-ask': askRemove(t); break;
      case 'remove-yes': doRemove(t); break;
      case 'confirm-no': t.closest('tr').remove(); $$('.table [data-act=role-ask],.table [data-act=remove-ask]').forEach(function (b) { b.disabled = false; }); break;
      case 'role-ask': askRole(t); break;
      case 'role-yes': doRole(t); break;
      case 'add-staff': addStaff(t); break;
    }
  }
  function renderDashboardCardsOnly() { renderDashboard(); }
  function onInput(e) {
    var t = e.target, act = t.dataset && t.dataset.act; if (!act) return;
    if (act === 'reason') { st.nr.reason = t.value; drawSummary(); }
    else if (act === 'reason-day') { st.nr.picked[t.dataset.iso].reason = t.value; drawSummary(); }
    else if (act === 'note') { var card = t.closest('.qcard'); st.q[card.dataset.id].note = t.value; }
    else if (act === 'daynote') { var qc = t.closest('.qcard'), qs2 = st.q[qc.dataset.id]; if (t.dataset.shared) qs2.why = t.value; else qs2.own[t.dataset.day] = t.value; if (t.value.trim()) $('#msg-' + CSS.escape(qc.dataset.id)).textContent = ''; }
  }
  function onChange(e) {
    var t = e.target; if (t.dataset.act !== 'year') return;
    st.years[st.tab] = Number(t.value); go(st.tab);
  }
  function onKey(e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'typed') { e.preventDefault(); typedAdd(); }
    else if (e.target.id === 'door-name') { e.preventDefault(); doorName($('[data-act=door-name]')); }
    else if (e.target.id === 'my-name') { e.preventDefault(); nameSave($('[data-act=name-save]')); }
  }

  /* ---------- boot ---------- */
  function boot() {
    reset(); document.title = S.app.title;
    var app = $('#app'); app.innerHTML = '<header class="shell"><div class="wrap"><img class="crest" src="assets/crest-160.png" alt="' + esc(S.app.crestAlt) + '"><div class="brand"><h1>' + esc(S.app.name) + '</h1><div class="school">' + esc(S.app.school) + '</div></div></div></header><div class="waitline on" id="wait"></div><main><div class="wrap" id="main">' + loading() + '</div></main>';
    if (!boot.bound) { boot.bound = true; app.addEventListener('click', onClick); app.addEventListener('input', onInput); app.addEventListener('change', onChange); app.addEventListener('keydown', onKey); }
    call('whoami').then(function (me) {
      st.me = me; st.badge = me.queueCount || 0; app.innerHTML = shell();
      if (!me.email || me.removed || me.role === 'unknown' || me.needName) { renderDoor(); return; }
      var first = me.role === 'approver' ? 'queue' : 'dashboard';
      if (window.DIL_BOOT && window.DIL_BOOT.tab) first = window.DIL_BOOT.tab;
      go(first);
    }).catch(function () { $('#main').innerHTML = errorCard(); waitLine(false); });
  }
  return { boot: boot, go: go, state: function () { return st; } };
})();
