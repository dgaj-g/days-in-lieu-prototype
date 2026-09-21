/* Days in Lieu · strings.js — EVERY user-facing string, in one place. No English lives in app.js or Code.gs.
   Functions take plain values and return strings. Design window: Fable 5.1, 17 Sep 2026. */
var S = (function () {
  'use strict';
  var fd = function (n) { return DIL.formatDays(n); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cap = function (s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); };
  var S = {
    esc: esc, cap: cap,
    app: {
      name: 'Days in Lieu',
      school: 'Our Lady’s Grammar School',
      schoolLine: 'Our Lady’s Grammar School, Newry',
      title: 'Days in Lieu · Our Lady’s Grammar School',
      emailSender: 'Days in Lieu · Our Lady’s Grammar School',
      crestAlt: 'Our Lady’s Grammar School crest'
    },
    common: {
      working: 'Working…', loading: 'Loading…', sending: 'Sending…', saving: 'Saving…', sendingEmail: 'Sending email…',
      tryAgain: 'Try again', back: 'Back', keep: 'Keep', remove: 'Remove', close: 'Close', add: 'Add', done: 'Done', cancel: 'Cancel', leave: 'Leave', stay: 'Stay',
      signedInAs: function (email) { return 'Signed in as ' + email; },
      yearLabel: 'Year',
      academicYear: function (label) { return 'Academic year ' + label; },
      previousYear: 'You’re looking at a previous year. New requests are for the current year only.',
      errorTitle: 'That didn’t go through',
      errorBody: 'The school’s server didn’t answer. Nothing was changed. Check you’re still signed in, then try again.',
      pageLoading: 'Fetching your days…',
      noneYet: 'Nothing here yet.'
    },
    status: { pending: 'Awaiting decision', approved: 'Approved', declined: 'Not approved', partly: 'Partly approved', withdrawn: 'Withdrawn', cancelled: 'Cancelled', taken: 'Taken' },
    portion: { full: 'Full day', am: 'Morning', pm: 'Afternoon' },
    nav: {
      staff: { dashboard: 'My days', newRequest: 'New request' },
      approver: { queue: 'To decide', decided: 'Decided', overview: 'Overview', staff: 'Staff list', mine: 'My days' },
      queueBadge: function (n) { return n ? String(n) : ''; }
    },
    doors: {
      signedOut: {
        title: 'Sign in to continue',
        body: 'Days in Lieu uses your C2k account. Sign in to Google with your school account, then open the link again.',
        button: 'Open again'
      },
      removed: {
        title: 'This account was removed from the staff list',
        body: function (email) { return 'You’re signed in as ' + email + '. Days in Lieu is for the teaching staff of Our Lady’s Grammar School, and this account was taken off the list.'; },
        hint: 'If that’s a mistake, ask the Principal to add you back from the Staff list, then open the link again.',
        wrongAccount: 'Signed in with the wrong account? Switch Google account and open the link again.'
      },
      needName: {
        title: 'What should we call you?',
        body: function (email) { return 'You’re signed in as ' + email + '. Your C2k account didn’t give us a name, so add it once and you’re in. It appears on your requests and on the Principal’s lists.'; },
        nameLabel: 'Your name, as it should appear', namePlaceholder: 'e.g. Claire Hughes', needName: 'Add your name first.',
        button: 'Continue'
      }
    },
    dash: {
      role: function (roleLabel, yearLabel) { return roleLabel + ' · Academic year ' + yearLabel; },
      roleStaff: 'Teaching staff', roleApprover: 'Approver',
      shownAs: function (name) { return 'You appear as ' + name + '.'; }, changeName: 'Change', nameLabel: 'Your name, as it should appear', saveName: 'Save', needName: 'Add your name first.', nameSaved: 'Name saved.',
      tiles: {
        approved: 'Approved', approvedSub: 'this academic year',
        taken: 'Taken', takenSub: 'already passed',
        remaining: 'Still to take', remainingSub: 'approved, coming up',
        pending: 'Awaiting decision', pendingSub: 'with the Principal'
      },
      newRequest: 'Make a request',
      upcoming: 'Coming up',
      upcomingEmpty: 'No upcoming days in lieu.',
      requests: 'Your requests this year',
      requestsEmpty: 'You haven’t made a request this year.',
      requestsEmptyPast: 'No requests were made this year.',
      requestLine: function (total, sent) { return fd(total) + ' · sent ' + DIL.formatShort(sent); },
      reason: 'Reason', reasons: 'Reasons',
      noteFrom: function (who) { return 'Note from ' + who; },
      decidedOn: function (iso) { return 'Decided ' + DIL.formatShort(iso); },
      withdraw: 'Withdraw request',
      withdrawConfirm: 'Withdraw this request? The Principal will be emailed.',
      withdrawYes: 'Withdraw', withdrawn: 'Request withdrawn.',
      decidedMeanwhile: 'The Principal has just decided this request, so it can’t be withdrawn now. Here’s the outcome.',
      changedMeanwhile: 'That day has just changed at the Principal’s end, so it can’t be cancelled now. Your list has been refreshed.',
      cancelDay: 'Cancel this day',
      cancelConfirm: function (iso) { return 'Cancel ' + DIL.formatShort(iso) + '? It will no longer count as taken, and the Principal will be emailed.'; },
      cancelYes: 'Cancel the day', cancelNo: 'Keep it',
      cancelled: function (iso) { return DIL.formatShort(iso) + ' cancelled.'; },
      todayTag: 'Today',
      instead: 'Ask for a different day instead',
      insteadOf: function (dates) { return 'Instead of ' + DIL.joinWords(dates.map(DIL.formatLong)) + ', which ' + (dates.length > 1 ? 'weren’t' : 'wasn’t') + ' approved.'; }
    },
    newReq: {
      title: 'New request',
      sub: function (yearLabel) { return 'Days in lieu for ' + yearLabel; },
      step1: '1 · Pick the days',
      step1help: 'Click the days you want in lieu. Weekends, school closures and days that have passed are greyed out.',
      prevMonth: 'Previous month', nextMonth: 'Next month',
      typedLabel: 'Or type a date',
      typedPlaceholder: 'e.g. 3/10/2026 or 3 Oct',
      typedAdd: 'Add',
      picked: 'Your days',
      pickedEmpty: 'No days picked yet.',
      removeDay: function (iso) { return 'Remove ' + DIL.formatShort(iso); },
      total: function (n) { return n ? 'You’re claiming ' + fd(n) : 'No days picked yet'; },
      step2: '2 · Give the reason',
      reasonLabel: 'What did you do to earn these days?',
      reasonPlaceholder: 'e.g. Year 10 residential, Saturday 26 and Sunday 27 September',
      reasonOneForAll: function (n) { return n > 1 ? 'This one reason covers all ' + n + ' days.' : 'This reason goes with the day above.'; },
      differentReason: 'A day has a different reason',
      sameReason: 'Use one reason for every day',
      perDayLabel: function (iso) { return 'Reason for ' + DIL.formatShort(iso); },
      quickFill: 'Quick fill',
      step3: '3 · Check and send',
      summaryTitle: 'Your request',
      summaryEmpty: 'Pick a day and it appears here.',
      send: function (who) { return 'Send to ' + who; },
      sending: 'Sending…',
      needDays: 'Pick at least one day first.',
      needReason: 'Add the reason first.',
      needEveryReason: 'Every day needs a reason — or switch back to one reason for all.',
      sentTitle: 'Request sent',
      sentBody: function (who) { return cap(who) + ' has been emailed. You’ll get an email as soon as there’s a decision.'; },
      backToDays: 'Back to my days',
      leaveConfirm: 'Leave without sending? Your picks will be lost.',
      insteadDrop: 'Don’t link to the old request',
      calendarLegend: { picked: 'Picked', closed: 'Closed', requested: 'Already requested' }
    },
    queue: {
      title: 'To decide',
      sub: function (n) { return n === 0 ? 'Nothing waiting — you’re up to date.' : n === 1 ? '1 request waiting' : n + ' requests waiting'; },
      empty: 'When a member of staff makes a request, it appears here and you get an email.',
      sent: function (iso) { return 'sent ' + DIL.formatLong(iso); },
      yearSoFar: function (first, approved, remaining) { return first + ' this year: ' + fd(approved) + ' approved · ' + fd(remaining) + ' still to take'; },
      reason: 'Reason', reasons: 'Reasons',
      approve: 'Approve', decline: 'Decline',
      noteLabel: function (first) { return 'Anything else for ' + first + ' (optional)'; },
      notePlaceholder: 'Goes at the end of the email',
      dayNoteLabel: function (iso) { return 'Why ' + DIL.formatShort(iso) + ' can’t be approved'; },
      dayNotePlaceholder: function (first) { return 'This goes in the email to ' + first + ' — e.g. Cover is very short that Friday. Could you take the Monday instead?'; },
      dayNoteLabelMany: function (isos) { return 'Why ' + DIL.joinWords(isos.map(DIL.formatShort)) + ' can’t be approved'; },
      sameAs: function (iso) { return 'Same reason as ' + DIL.formatShort(iso) + '.'; },
      ownReason: 'Different reason for this day',
      useSame: function (iso) { return 'Use the same reason as ' + DIL.formatShort(iso); },
      needDayNotes: 'Give the reason first — it goes in the email.',
      needDayNote: function (iso) { return 'Give a reason for ' + DIL.formatShort(iso) + ' first — it goes in the email.'; },
      button: function (first, a, d) {
        if (d === 0) return 'Approve ' + fd(a) + ' and email ' + first;
        if (a === 0) return 'Decline and email ' + first;
        return 'Approve ' + fd(a) + ', decline ' + fd(d) + ' and email ' + first;
      },
      changeButton: function (first) { return 'Save the new decision and email ' + first; },
      busy: 'Sending email…',
      done: function (first) { return 'Done — ' + first + ' has been emailed.'; },
      failed: 'The email didn’t send, so the decision was not saved. Try again.',
      gone: function (first) { return first + ' withdrew this request a moment ago, so there’s nothing to decide. The list has been refreshed.'; },
      alreadyDecided: 'Another approver has just decided this one. The list has been refreshed.',
      changeWarning: 'Changing a decision sends a new email.',
      cancelChange: 'Keep the current decision'
    },
    decided: {
      title: 'Decided',
      sub: function (label) { return 'Academic year ' + label; },
      filters: { all: 'All', approved: 'Approved', declined: 'Not approved', partly: 'Partly approved', other: 'Withdrawn or cancelled' },
      empty: 'No decided requests yet this year.',
      change: 'Change decision',
      decidedBy: function (who, iso) { return 'Decided ' + DIL.formatShort(iso) + ' by ' + who; },
      note: 'Note'
    },
    overview: {
      title: 'Overview',
      sub: function (label) { return 'Academic year ' + label; },
      tiles: {
        requested: 'Requested', requestedSub: function (n) { return n === 1 ? 'from 1 member of staff' : 'from ' + n + ' members of staff'; },
        approved: 'Approved', approvedSub: function (taken, remaining) { return fd(taken) + ' taken · ' + fd(remaining) + ' to come'; },
        declined: 'Not approved', declinedSub: 'this year',
        pending: 'Awaiting decision', pendingSub: 'go to “To decide”'
      },
      away: 'Away in lieu, next 7 days',
      awayEmpty: 'Nobody is away in lieu in the next 7 days.',
      byMonth: 'Approved days by month',
      byMonthLegend: { approved: 'Approved', pending: 'Awaiting' },
      byStaff: 'By member of staff',
      cols: { name: 'Name', requested: 'Requested', approved: 'Approved', declined: 'Not approved', pending: 'Awaiting', taken: 'Taken', remaining: 'Still to take' },
      byStaffEmpty: 'No requests yet this year.',
      csv: 'Download as CSV', sheet: 'Open the Sheet',
      csvName: function (label) { return 'days-in-lieu-' + label.replace('–', '-') + '.csv'; }
    },
    staffAdmin: {
      title: 'Staff list',
      sub: 'Anyone who opens the link with a C2k account is added here automatically, as teaching staff, with the name their account gives. Approvers see every request and make the decisions.',
      cols: { name: 'Name', email: 'C2k email', role: 'Role' },
      roles: { staff: 'Teaching staff', approver: 'Approver' },
      you: 'you',
      makeApprover: 'Make an approver', makeStaff: 'Make teaching staff',
      roleConfirm: function (name, toApprover) { return toApprover ? 'Make ' + name + ' an approver? They’ll see every request, be emailed about each new one and make decisions.' : 'Make ' + name + ' teaching staff? They’ll no longer see the queue or make decisions.'; },
      roleChanged: function (name, toApprover) { return name + (toApprover ? ' is now an approver.' : ' is now teaching staff.'); },
      addTitle: 'Add someone before their first visit',
      addSub: 'Only needed when someone should be an approver before they’ve opened the link, or when a name should be set in advance. Everyone else adds themselves by opening the link.',
      addName: 'Name as it should appear', addNamePlaceholder: 'e.g. Claire Hughes',
      addEmail: 'C2k email', addEmailPlaceholder: 'e.g. chughes123@c2ken.net',
      addRole: 'Role',
      addButton: 'Add to the list',
      added: function (name) { return name + ' added.'; },
      needName: 'Add their name first.',
      badEmail: 'That doesn’t look like a C2k email (name@c2ken.net).',
      duplicate: 'That email is already on the list.',
      remove: 'Remove',
      removeConfirm: function (name) { return 'Remove ' + name + '? They won’t be able to open Days in Lieu until an approver adds them back. Their past requests stay on record.'; },
      removed: function (name) { return name + ' removed.'; },
      count: function (n) { return n === 1 ? '1 person' : n + ' people'; }
    },
    dateProblem: {
      past: 'That day has passed.',
      weekend: function (p) { return p.weekday + ' isn’t a school day.'; },
      closure: function (p) { return p.label ? 'School is closed that day — ' + p.label + '.' : 'School is closed that day.'; },
      outside_year: function (p) { return 'That’s after ' + DIL.formatShort(p.end) + ', the end of ' + p.year + '. Requests are for this academic year.'; },
      already_requested: function (p) { return p.status === 'approved' ? 'You already have that day approved.' : 'You’ve already asked for that day — it’s awaiting a decision.'; },
      already_picked: 'That day is already in this request.',
      invalid: 'That isn’t a date I recognise. Try 3/10/2026 or 3 Oct.',
      no_days: 'Pick at least one day first.', no_reason: 'Add the reason first.', too_many: 'That’s more than 30 days in one request. Split it into two.',
      bad_portion: 'Choose Full day, Morning or Afternoon for every day.', reason_too_long: 'Keep each reason under 500 characters.',
      describe: function (p) { var m = S.dateProblem[p.code]; return typeof m === 'function' ? m(p) : (m || S.dateProblem.invalid); }
    },
    // ---------- emails ----------
    email: {
      sender: 'Days in Lieu · Our Lady’s Grammar School',
      footer: 'Days in Lieu · Our Lady’s Grammar School, Newry',
      dayLine: function (d) { return DIL.formatLong(d.date) + ' — ' + S.portion[d.portion]; },
      dayLineOutcome: function (d) { return DIL.formatLong(d.date) + ' — ' + S.portion[d.portion] + ' — ' + S.status[d.status] + (d.status === 'declined' && d.decisionNote ? ': ' + d.decisionNote : ''); },
      newRequest: function (c) { // c: {staffName, total, days, url, replaces}
        var lines = c.days.map(S.email.dayLine), instead = c.replaces && c.replaces.dates && c.replaces.dates.length ? S.dash.insteadOf(c.replaces.dates) : '';
        var groups = DIL.reasonGroups(c.days);
        var reason = groups.length === 1 ? 'Reason: ' + groups[0].reason : groups.map(function (g) { return g.days.map(function (d) { return DIL.formatShort(d.date); }).join(', ') + ': ' + g.reason; }).join('\n');
        return {
          subject: 'Days in lieu: ' + c.staffName + ' asks for ' + fd(c.total),
          text: c.staffName + ' has asked for ' + fd(c.total) + ' in lieu.\n\n' + lines.join('\n') + '\n\n' + reason + (instead ? '\n\n' + instead : '') + '\n\nOpen the request to approve or decline:\n' + c.url + '\n\n— ' + S.email.footer,
          html: '<p><strong>' + esc(c.staffName) + '</strong> has asked for <strong>' + esc(fd(c.total)) + '</strong> in lieu.</p><ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul><p>' + esc(reason).replace(/\n/g, '<br>') + '</p>' + (instead ? '<p><em>' + esc(instead) + '</em></p>' : '') + '<p><a href="' + esc(c.url) + '">Open the request</a> to approve or decline.</p><p style="color:#707070">— ' + esc(S.email.footer) + '</p>'
        };
      },
      decision: function (c) { // c: {first, principalName, submitted, days, outcome, note, yearLabel, approved, remaining, url}
        var head = { approved: 'approved', declined: 'not approved', partly: 'partly approved' }[c.outcome] || c.outcome;
        var lines = c.days.filter(function (d) { return d.status !== 'withdrawn'; }).map(S.email.dayLineOutcome);
        var note = c.note ? '\n\nNote from ' + c.principalName + ':\n' + c.note : '';
        return {
          subject: 'Your days in lieu: ' + head,
          text: 'Hello ' + c.first + ',\n\n' + cap(c.principalName) + ' has looked at your request of ' + DIL.formatLong(c.submitted) + '.\n\n' + lines.join('\n') + note + '\n\nYour days in lieu for ' + c.yearLabel + ': ' + fd(c.approved) + ' approved, ' + fd(c.remaining) + ' still to take.\n\nSee your days:\n' + c.url + '\n\n— ' + S.email.footer,
          html: '<p>Hello ' + esc(c.first) + ',</p><p>' + esc(cap(c.principalName)) + ' has looked at your request of ' + esc(DIL.formatLong(c.submitted)) + '.</p><ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' + (c.note ? '<p><strong>Note from ' + esc(c.principalName) + ':</strong><br>' + esc(c.note).replace(/\n/g, '<br>') + '</p>' : '') + '<p>Your days in lieu for ' + esc(c.yearLabel) + ': <strong>' + esc(fd(c.approved)) + '</strong> approved, <strong>' + esc(fd(c.remaining)) + '</strong> still to take.</p><p><a href="' + esc(c.url) + '">See your days</a></p><p style="color:#707070">— ' + esc(S.email.footer) + '</p>'
        };
      },
      withdrawn: function (c) { // {staffName, total, days, url}
        return { subject: 'Days in lieu: ' + c.staffName + ' withdrew a request', text: c.staffName + ' has withdrawn their request for ' + fd(c.total) + ' (' + c.days.map(function (d) { return DIL.formatShort(d.date); }).join(', ') + '). Nothing to do.\n\n' + c.url + '\n\n— ' + S.email.footer, html: '<p><strong>' + esc(c.staffName) + '</strong> has withdrawn their request for ' + esc(fd(c.total)) + ' (' + esc(c.days.map(function (d) { return DIL.formatShort(d.date); }).join(', ')) + '). Nothing to do.</p><p><a href="' + esc(c.url) + '">Open Days in Lieu</a></p><p style="color:#707070">— ' + esc(S.email.footer) + '</p>' };
      },
      cancelled: function (c) { // {staffName, day, url}
        return { subject: 'Days in lieu: ' + c.staffName + ' cancelled ' + DIL.formatShort(c.day.date), text: c.staffName + ' will no longer be away on ' + DIL.formatLong(c.day.date) + ' (' + S.portion[c.day.portion] + '). It no longer counts as taken.\n\n' + c.url + '\n\n— ' + S.email.footer, html: '<p><strong>' + esc(c.staffName) + '</strong> will no longer be away on ' + esc(DIL.formatLong(c.day.date)) + ' (' + esc(S.portion[c.day.portion]) + '). It no longer counts as taken.</p><p><a href="' + esc(c.url) + '">Open Days in Lieu</a></p><p style="color:#707070">— ' + esc(S.email.footer) + '</p>' };
      }
    },
    proto: { bar: 'PROTOTYPE · nothing is saved · view as', today: 'Today', latency: 'Slow server' }
  };
  return S;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = S;
