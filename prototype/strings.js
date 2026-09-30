/* Days in Lieu · strings.js — EVERY user-facing string, in one place. No English lives in app.js or Code.gs.
   Functions take plain values and return strings. Design window: Fable 5.1, 17 Sep 2026; claims vs bookings 27 Sep 2026.
   Words: a CLAIM is the days someone says they are owed; a BOOKING is a date they want off, taken from approved days. */
var S = (function () {
  'use strict';
  var fd = function (n) { return DIL.formatDays(n); };                       // "1½ days"
  var fn = function (n) { return DIL.formatDays(n).replace(/ days?$/, ''); }; // "1½"
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cap = function (s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); };
  var plural = function (n, one, many) { return n === 1 ? '1 ' + one : n + ' ' + many; };
  var S = {
    esc: esc, cap: cap, fd: fd, fn: fn, plural: plural,
    app: {
      name: 'Days in Lieu',
      school: 'Our Lady’s Grammar School',
      schoolLine: 'Our Lady’s Grammar School, Newry',
      title: 'Days in Lieu · Our Lady’s Grammar School',
      emailSender: 'Days in Lieu · Our Lady’s Grammar School',
      senderFor: function (name) { return name ? name + ' · Days in Lieu' : S.app.emailSender; },   // an email the app sends for someone
      crestAlt: 'Our Lady’s Grammar School crest'
    },
    common: {
      working: 'Working…', loading: 'Loading…', sending: 'Sending…', saving: 'Saving…', sendingEmail: 'Sending email…',
      tryAgain: 'Try again', back: 'Back', keep: 'Keep', remove: 'Remove', close: 'Close', add: 'Add', done: 'Done', cancel: 'Cancel', leave: 'Leave', stay: 'Stay',
      signedInAs: function (email) { return 'Signed in as ' + email; },
      yearLabel: 'Year',
      academicYear: function (label) { return 'Academic year ' + label; },
      previousYear: 'You’re looking at a previous year. Claims and bookings are for the current year only.',
      errorTitle: 'That didn’t go through',
      errorBody: 'The school’s server didn’t answer. Nothing was changed. Check you’re still signed in, then try again.',
      pageLoading: 'Fetching your days…',
      noneYet: 'Nothing here yet.'
    },
    status: { pending: 'Awaiting decision', approved: 'Approved', declined: 'Not approved', partly: 'Partly approved', withdrawn: 'Withdrawn', cancelled: 'Cancelled', taken: 'Taken' },
    claimStatus: {
      pending: 'Awaiting decision', approved: 'Approved', declined: 'Not approved', withdrawn: 'Withdrawn', partlyLabel: 'Approved in part',
      partly: function (approved, claimed) { return 'Approved ' + fn(approved) + ' of ' + fd(claimed); },
      chip: function (c) { return c.status === 'partly' ? S.claimStatus.partly(c.amountApproved, c.amountClaimed) : (S.claimStatus[c.status] || c.status); }
    },
    portion: { full: 'Full day', am: 'Morning', pm: 'Afternoon' },
    claimPortion: { full: 'Full day', half: 'Half day' },
    nav: {
      staff: { dashboard: 'My days', claim: 'Claim days', book: 'Book a day off' },
      approver: { queue: 'To decide', decided: 'Decided', overview: 'Overview', staff: 'Staff list' },
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
      nameCheck: {
        title: 'Getting your name from your school account',
        body: 'This takes a few seconds, the first time only.',
        askTitle: 'One step before you start',
        askBody: 'Days in Lieu takes your name from your school account, so you never type it, and sends your emails from your own school address. Google asks your OK for that once.',
        steps: ['Press Confirm with Google. A new tab opens.', 'If Google asks, press Review permissions and choose your school account.', 'If there is a box next to Send email as you, tick it. Then press Continue.', 'Come back to this tab. It carries on by itself.'],
        button: 'Confirm with Google',
        watching: 'Waiting for Google…'
      },
      needName: {
        title: 'What should we call you?',
        body: function (email) { return 'You’re signed in as ' + email + '. Your C2k account didn’t give us a name, so add it once and you’re in. It appears on your claims and bookings and on the Principal’s lists.'; },
        nameLabel: 'Your name, as it should appear', namePlaceholder: 'e.g. Claire Hughes', needName: 'Add your name first.',
        button: 'Continue'
      }
    },
    // ---------- My days (staff home) ----------
    dash: {
      role: function (roleLabel, yearLabel) { return roleLabel + ' · Academic year ' + yearLabel; },
      roleStaff: 'Teaching staff', roleApprover: 'Approver',
      shownAs: function (name) { return 'You appear as ' + name + '.'; },
      // the two doors
      doors: {
        claim: {
          eyebrow: '1 · Claim',
          title: 'Claim days I’m owed',
          body: function (who) { return 'Explain the extra work you did, e.g. SEAG Help or a weekend school trip, and how many days in lieu it earned. You cannot make bookings until ' + who + ' approves the claim.'; },
          button: 'Claim days'
        },
        book: {
          eyebrow: '2 · Book',
          title: 'Book a day off',
          body: function (who) { return 'Pick the dates you want to take from your approved days. ' + cap(who) + ' approves each date.'; },
          button: 'Book a day off',
          left: function (n) { return 'You have ' + fd(n) + ' left to book.'; },
          waiting: function (claims, amount) { return (claims === 1 ? 'Your claim for ' + fd(amount) : 'Your ' + claims + ' claims, ' + fd(amount) + ' in all,') + ' ' + (claims === 1 ? 'is' : 'are') + ' awaiting decision. Once approved, you can book here.'; },
          none: 'You have no approved days left to book. Claim the days you’re owed first — that’s step 1.',
          allBooked: 'You’ve booked every approved day this year. If you’re owed more, claim them — that’s step 1.'
        }
      },
      tiles: {
        approved: 'Approved', approvedSub: function (claims) { return claims ? 'on ' + plural(claims, 'claim', 'claims') + ' this year' : 'no claims approved yet'; },
        booked: 'Booked', bookedSub: function (taken) { return fd(taken) + ' taken so far'; },
        left: 'Left to book', leftSub: 'approved, not yet booked',
        pending: 'Awaiting decision', pendingSub: function (claims, bookings) { var p = []; if (claims) p.push(plural(claims, 'claim', 'claims')); if (bookings) p.push(plural(bookings, 'booking', 'bookings')); return p.length ? p.join(' · ') : 'nothing waiting'; }
      },
      upcoming: 'Coming up',
      upcomingEmpty: 'No upcoming days in lieu.',
      claims: 'Your claims this year',
      claimsEmpty: 'You haven’t claimed any days this year.',
      claimsEmptyPast: 'No claims were made this year.',
      claimMeta: function (c) { return fd(c.amountClaimed) + ' for ' + DIL.formatDateList(c.workDays) + ' · sent ' + DIL.formatShort(c.submittedAt); },
      withdrawClaim: 'Withdraw claim',
      withdrawClaimConfirm: function (who) { return 'Withdraw this claim? ' + cap(who) + ' will be emailed.'; },
      withdrawClaimYes: 'Withdraw', claimWithdrawn: 'Claim withdrawn.',
      claimDecidedMeanwhile: function (who) { return cap(who) + ' has just decided this claim, so it can’t be withdrawn now. Here’s the outcome.'; },
      bookings: 'Your bookings this year',
      bookingsEmpty: 'No bookings yet this year.',
      bookingsEmptyPast: 'No bookings were made this year.',
      requestLine: function (total, sent) { return fd(total) + ' · sent ' + DIL.formatShort(sent); },
      note: 'Your note',
      noteFrom: function (who) { return 'Note from ' + who; },
      decidedOn: function (iso) { return 'Decided ' + DIL.formatShort(iso); },
      withdraw: 'Withdraw booking',
      withdrawConfirm: function (who) { return 'Withdraw this booking? ' + cap(who) + ' will be emailed.'; },
      withdrawYes: 'Withdraw', withdrawn: 'Booking withdrawn.',
      decidedMeanwhile: function (who) { return cap(who) + ' has just decided this booking, so it can’t be withdrawn now. Here’s the outcome.'; },
      changedMeanwhile: function (who) { return 'That day has just changed at ' + who + '’s end, so it can’t be cancelled now. Your list has been refreshed.'; },
      cancelDay: 'Cancel this day',
      cancelConfirm: function (iso, who) { return 'Cancel ' + DIL.formatShort(iso) + '? It goes back into your days left to book, and ' + who + ' will be emailed.'; },
      cancelYes: 'Cancel the day', cancelNo: 'Keep it',
      cancelled: function (iso) { return DIL.formatShort(iso) + ' cancelled.'; },
      todayTag: 'Today',
      instead: 'Book a different day instead',
      insteadOf: function (dates) { return 'Instead of ' + DIL.joinWords(dates.map(DIL.formatLong)) + ', which ' + (dates.length > 1 ? 'weren’t' : 'wasn’t') + ' approved.'; }
    },
    // ---------- Claim days (staff) ----------
    claim: {
      title: 'Claim days in lieu',
      sub: function (yearLabel, who, from) { return (from ? 'For extra work done since ' + DIL.formatLong(from) : 'For extra work done in ' + yearLabel) + '. ' + cap(who) + ' approves the claim; then you can book the days.'; },
      step1: '1 · What did you do?',
      reasonLabel: 'The extra work',
      reasonPlaceholder: 'e.g. Year 10 residential, Friday 4 to Sunday 6 September',
      quickFill: 'Quick fill',
      step2: '2 · When was it?',
      dateLabel: 'Tap every day the work was on, then say whether each was a full or half day. They needn’t be together — three Saturdays is fine.',
      dateHelp: function (yearLabel, from, to) { return from ? 'Days from ' + DIL.formatLong(from) + ' to ' + DIL.formatLong(to) + ' only.' : 'Days in ' + yearLabel + ' only. Days in lieu don’t carry over, so work from an earlier year can’t be claimed.'; },
      pickedLabel: 'Days picked',
      pickedNone: 'Tap a day on the calendar and it appears here.',
      pickedTotal: function (n) { return 'That’s ' + fd(n) + ' in lieu.'; },
      removeDay: function (iso) { return 'Remove ' + DIL.formatLong(iso); },
      prevMonth: 'Earlier month', nextMonth: 'Later month',
      calendarLegend: { picked: 'Picked', today: 'Today' },
      summaryTitle: 'Your claim',
      total: function (n) { return 'You’re claiming ' + fd(n); },
      summaryWhat: 'What', summaryWhen: 'When',
      summaryEmpty: 'Say what you did and it appears here.',
      send: function (who) { return 'Send to ' + who; },
      sending: 'Sending…',
      needReason: 'Say what you did first.',
      needDate: 'Pick the day, or days, the work was on first.',
      sentTitle: 'Claim sent',
      sentBody: function (who) { return 'Once the claim is approved you can book the days.'; },
      backToDays: 'Back to my days',
      leaveConfirm: 'Leave without sending? What you typed will be lost.'
    },
    claimProblem: {
      no_reason: 'Say what you did first.',
      reason_too_long: 'Keep it under 500 characters.',
      bad_amount: 'Days must be a whole or half number, at least ½.',
      amount_too_big: function (p) { return 'One claim can be for at most ' + fd(p.max || 15) + '. Split it into two.'; },
      no_dates: 'Pick the day, or days, the work was on first.',
      bad_portion: 'Choose Full day or Half day for every day.',
      bad_date: 'One of those days isn’t a real date. Pick the days again.',
      date_outside_year: function (p) { return p.from ? 'Claims can cover days from ' + DIL.formatLong(p.from) + ' to ' + DIL.formatLong(p.to) + ' only.' : 'That day isn’t in ' + p.year + '. Days in lieu don’t carry over from an earlier year.'; },
      describe: function (p) { var m = S.claimProblem[p.code]; return typeof m === 'function' ? m(p) : (m || S.claimProblem.bad_date); }
    },
    // ---------- Book a day off (staff) ----------
    newReq: {
      title: 'Book a day off',
      sub: function (left, yearLabel) { return 'You have ' + fd(left) + ' left to book in ' + yearLabel + '.'; },
      nothing: {
        title: 'Nothing to book yet',
        waiting: function (claims, amount, who) { return (claims === 1 ? 'Your claim for ' + fd(amount) + ' is' : 'Your ' + claims + ' claims, ' + fd(amount) + ' in all, are') + ' awaiting decision. Once ' + who + ' approves, you can book dates here.'; },
        none: 'Bookings come from your approved days, and you have none left. Claim the days you’re owed first.',
        allBooked: 'You’ve booked every approved day this year. If you’re owed more, claim them first.',
        button: 'Claim days'
      },
      step1: '1 · Pick the days',
      step1help: 'Choose the days you want off. Weekends, school closures and days that have passed are greyed out.',
      prevMonth: 'Previous month', nextMonth: 'Next month',
      typedLabel: 'Or type a date',
      typedPlaceholder: 'e.g. 3/10/2026 or 3 Oct',
      typedAdd: 'Add',
      picked: 'Your days',
      pickedEmpty: 'No days picked yet.',
      removeDay: function (iso) { return 'Remove ' + DIL.formatShort(iso); },
      total: function (n, left) { return n ? 'You’re booking ' + fd(n) + ' of the ' + fd(left) + ' you have left' : 'No days picked yet'; },
      overLeft: function (left) { return 'That would be more than the ' + fd(left) + ' you have left to book.'; },
      addedHalf: function (iso, left) { return DIL.formatShort(iso) + ' added as a morning, because a full day would be more than the ' + fd(left) + ' you have left. Switch it to Afternoon below if you’d rather.'; },
      fullWouldExceed: function (left) { return 'A full day there would be more than the ' + fd(left) + ' you have left — this one has to stay a half day.'; },
      step2: function (who) { return '2 · A note for ' + who + ' (optional)'; },
      noteLabel: function (who) { return 'Anything ' + who + ' should know?'; },
      notePlaceholder: 'e.g. Would like the Monday to travel',
      step3: '3 · Check and send',
      summaryTitle: 'Your booking',
      summaryEmpty: 'Pick a day and it appears here.',
      send: function (who) { return 'Send to ' + who; },
      sending: 'Sending…',
      needDays: 'Pick at least one day first.',
      sentTitle: 'Booking sent',
      sentBody: function (who) { return 'You’ll get an email as soon as there’s a decision.'; },
      backToDays: 'Back to my days',
      leaveConfirm: 'Leave without sending? Your picks will be lost.',
      insteadDrop: 'Don’t link to the old booking',
      calendarLegend: { picked: 'Picked', closed: 'Closed', requested: 'Already booked' }
    },
    // ---------- To decide (approver): the two views ----------
    views: {
      claims: function (n) { return 'Claims' + (n ? ' · ' + n : ''); },
      bookings: function (n) { return 'Bookings' + (n ? ' · ' + n : ''); },
      sub: function (c, b) {
        if (!c && !b) return 'Nothing waiting — you’re up to date.';
        var p = []; if (c) p.push(plural(c, 'claim', 'claims')); if (b) p.push(plural(b, 'booking', 'bookings'));
        return p.join(' and ') + ' waiting.';
      },
      emptyClaims: 'No claims waiting.',
      emptyBookings: 'No bookings waiting.',
      emptyBoth: 'When a member of staff claims days or books a day off, it appears here and you get an email.',
      otherClaims: function (n) { return plural(n, 'claim is', 'claims are') + ' waiting →'; },
      otherBookings: function (n) { return plural(n, 'booking is', 'bookings are') + ' waiting →'; },
      helpClaims: 'A claim says what extra work was done and how many days in lieu it earned. Approving it gives the person those days to book.',
      helpBookings: 'A booking is a date someone wants off, taken from their approved days.'
    },
    // ---------- a claim card for the Principal ----------
    claimQ: {
      claims: function (amount) { return 'Claims ' + fd(amount); },
      sent: function (iso) { return 'sent ' + DIL.formatLong(iso); },
      what: 'What', when: 'Days of the work',
      yearSoFar: function (first, approved, booked, pending, left) { return first + ' this year: ' + fd(approved) + ' approved · ' + fd(booked) + ' booked · ' + (pending > 0 ? fd(pending) + ' awaiting decision · ' : '') + fd(left) + ' left to book'; },
      choose: { approve: 'Approve', decline: 'Not approved' },
      amountLabel: 'Days to approve',
      of: function (claimed) { return 'of ' + fd(claimed) + ' claimed'; },
      less: 'Half a day fewer', more: 'Half a day more',
      fewerLine: function (a, c) { return 'Approving ' + fn(a) + ' of the ' + fd(c) + ' claimed.'; },
      noteLabel: function (first) { return 'Note to ' + first + ' (optional)'; },
      noteFewer: function (first) { return 'Tell ' + first + ' why fewer'; },
      noteDecline: function (first) { return 'Tell ' + first + ' why not'; },
      notePlaceholder: 'Goes at the end of the email',
      notePlaceholderFewer: 'This goes in the email — e.g. An open night counts as a half day, as agreed in September.',
      notePlaceholderDecline: 'This goes in the email — e.g. A trip during the school day isn’t extra work, so it isn’t in lieu.',
      needNoteFewer: 'Say why fewer first — it goes in the email.',
      needNoteDecline: 'Give the reason first — it goes in the email.',
      button: function (first, a, c) { return a === c ? 'Approve ' + fd(a) + ' and email ' + first : 'Approve ' + fn(a) + ' of ' + fd(c) + ' and email ' + first; },
      declineButton: function (first) { return 'Decline and email ' + first; },
      changeButton: function (first) { return 'Save the new decision and email ' + first; },
      busy: 'Sending email…',
      done: function (first) { return 'Done — ' + first + ' has been emailed.'; },
      failed: 'The email didn’t send, so the decision was not saved. Try again.',
      gone: function (first) { return first + ' withdrew this claim a moment ago, so there’s nothing to decide. The list has been refreshed.'; },
      alreadyDecided: 'Another approver has just decided this one. The list has been refreshed.',
      bookedAlready: function (first, booked) { return first + ' has already booked ' + fd(booked) + ' against this year’s approved days, so the approval can’t go below that. Ask them to cancel a booking first.'; },
      changeWarning: 'Changing a decision sends a new email.',
      cancelChange: 'Keep the current decision'
    },
    // ---------- a booking card for the Principal ----------
    queue: {
      title: 'To decide',
      sub: function (n) { return n === 0 ? 'Nothing waiting — you’re up to date.' : n === 1 ? '1 booking waiting' : n + ' bookings waiting'; },
      empty: 'When a member of staff books a day off, it appears here and you get an email.',
      sent: function (iso) { return 'sent ' + DIL.formatLong(iso); },
      yearSoFar: function (first, approved, booked, pending, left) { return first + ' this year: ' + fd(approved) + ' approved · ' + fd(booked) + ' booked · ' + (pending > 0 ? fd(pending) + ' awaiting decision · ' : '') + fd(left) + ' left to book'; },
      note: 'Note', 
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
      gone: function (first) { return first + ' withdrew this booking a moment ago, so there’s nothing to decide. The list has been refreshed.'; },
      alreadyDecided: 'Another approver has just decided this one. The list has been refreshed.',
      changeWarning: 'Changing a decision sends a new email.',
      cancelChange: 'Keep the current decision'
    },
    decided: {
      title: 'Decided',
      sub: function (label) { return 'Academic year ' + label; },
      filters: { all: 'All', approved: 'Approved', declined: 'Not approved', partly: 'Partly approved', other: 'Withdrawn or cancelled' },
      claimFilters: { all: 'All', approved: 'Approved', partly: 'Approved in part', declined: 'Not approved', other: 'Withdrawn' },
      empty: 'No decided bookings yet this year.',
      emptyClaims: 'No decided claims yet this year.',
      change: 'Change decision',
      decidedBy: function (who, iso) { return 'Decided ' + DIL.formatShort(iso) + ' by ' + who; },
      note: 'Note'
    },
    overview: {
      title: 'Overview',
      sub: function (label) { return 'Academic year ' + label; },
      tiles: {
        approved: 'Approved', approvedSub: function (claims, staff) { return 'on ' + plural(claims, 'claim', 'claims') + ' from ' + plural(staff, 'member of staff', 'members of staff'); },
        booked: 'Booked', bookedSub: function (taken) { return fd(taken) + ' taken so far'; },
        left: 'Left to book', leftSub: 'approved, not yet booked',
        pending: 'Awaiting decision', pendingSub: function (claimDays, bookingDays) { return fd(claimDays) + ' on claims · ' + fd(bookingDays) + ' on bookings'; }
      },
      away: 'Away in lieu, next 7 days',
      awayEmpty: 'Nobody is away in lieu in the next 7 days.',
      byMonth: 'Booked days by month',
      byMonthLegend: { approved: 'Approved', pending: 'Awaiting' },
      byStaff: 'By member of staff',
      cols: { name: 'Name', claimed: 'Claimed', entitled: 'Approved', booked: 'Booked', taken: 'Taken', left: 'Left', awaiting: 'Awaiting', total: 'Whole school' },
      colsHelp: 'Claimed = days asked for on claims · Approved = days the claims earned · Booked = dates approved · Left = approved, not yet booked · Awaiting = days on claims and bookings still to be decided.',
      byStaffEmpty: 'No claims or bookings yet this year.',
      csv: 'Download as CSV', sheet: 'Open the Sheet',
      csvName: function (label) { return 'days-in-lieu-' + label.replace('–', '-') + '.csv'; }
    },
    staffAdmin: {
      title: 'Staff list',
      sub: 'Anyone who opens the link with a C2k account is added here automatically, as teaching staff, with the name their account gives. Approvers see every claim and booking and make the decisions.',
      cols: { name: 'Name', email: 'C2k email', role: 'Role' },
      roles: { staff: 'Teaching staff', approver: 'Approver' },
      you: 'you',
      makeApprover: 'Make an approver', makeStaff: 'Make teaching staff',
      roleConfirm: function (name, toApprover) { return toApprover ? 'Make ' + name + ' an approver? They’ll see every claim and booking, be emailed about each new one and make decisions.' : 'Make ' + name + ' teaching staff? They’ll no longer see the queue or make decisions.'; },
      roleChanged: function (name, toApprover) { return name + (toApprover ? ' is now an approver.' : ' is now teaching staff.'); },
      addTitle: 'Add someone before their first visit',
      addSub: 'Only needed when someone should be an approver before they’ve opened the link, or when a name should be set in advance. Everyone else adds themselves by opening the link.',
      addName: 'Name as it should appear', addNamePlaceholder: 'e.g. Claire Hughes',
      addEmail: 'C2k email', addEmailPlaceholder: 'e.g. chughes123@c2ken.net',
      addRole: 'Role',
      addButton: 'Add to the list',
      added: function (name) { return name + ' added.'; },
      needName: 'Add their name first.',
      badEmail: 'That doesn’t look like a school email (name@c2ken.net or name@ourladysgrammar.newry.ni.sch.uk).',
      duplicate: 'That email is already on the list.',
      remove: 'Remove',
      removeConfirm: function (name) { return 'Remove ' + name + '? They won’t be able to open Days in Lieu until an approver adds them back. Their past claims and bookings stay on record.'; },
      removed: function (name) { return name + ' removed.'; },
      count: function (n) { return n === 1 ? '1 person' : n + ' people'; }
    },
    dateProblem: {
      past: 'That day has passed.',
      weekend: function (p) { return p.weekday + ' isn’t a school day.'; },
      closure: function (p) { return p.label ? 'School is closed that day — ' + p.label + '.' : 'School is closed that day.'; },
      outside_year: function (p) { return 'That’s after ' + DIL.formatShort(p.end) + ', the end of ' + p.year + '. Bookings are for this academic year.'; },
      already_requested: function (p) { return p.status === 'approved' ? 'You already have that day booked.' : 'You’ve already booked that day — it’s awaiting a decision.'; },
      already_picked: 'That day is already in this booking.',
      over_balance: function (p) { return 'That would be more than the ' + fd(p.left) + ' you have left to book.'; },
      invalid: 'That isn’t a date I recognise. Try 3/10/2026 or 3 Oct.',
      no_days: 'Pick at least one day first.', too_many: 'That’s more than 30 days in one booking. Split it into two.',
      bad_portion: 'Choose Full day, Morning or Afternoon for every day.', reason_too_long: 'Keep the note under 500 characters.',
      describe: function (p) { var m = S.dateProblem[p.code]; return typeof m === 'function' ? m(p) : (m || S.dateProblem.invalid); }
    },
    // ---------- every email goes from the own address of the person it is from; nothing is ever sent in their place ----------
    ownMail: {
      // kind: 'claim' | 'request' | 'decision' | 'other'. The words on the card (done: true) and on the line under the header
      // (done: false) while the email goes from the person's own address, then when it has gone. His words, 30 Sep 2026.
      what: { claim: 'your claim', request: 'your request', decision: 'your decision' },
      sending: function (kind, done) { var w = S.ownMail.what[kind]; return (done ? 'Done, sending' : 'Sending') + (w ? ' ' + w : '') + '…'; },
      sent: function (kind) { return { claim: 'Claim sent', request: 'Request sent', decision: 'Decision sent' }[kind] || 'Sent'; },
      needsOK: 'Needs your OK',
      failed: 'An email didn’t send. What you did is saved, so let them know yourself.',
      failedLine: function (first) { return 'Email didn’t send. Let ' + first + ' know yourself.'; },
      frame: 'Send from your own email',
      title: function (names) { return names.length === 1 ? 'Your email to ' + names[0] + ' is waiting' : names.length + ' emails are waiting to go'; },
      body: function (n) { return 'Days in Lieu sends ' + (n === 1 ? 'it' : 'them') + ' from your own school email address. Google needs your OK for that, once only.'; },
      steps: ['Press Continue with Google. A new tab opens.', 'If Google asks, press Review permissions and choose your school account.', 'If there is a box next to Send email as you, tick it. Then press Continue.', 'Come back to this tab. It carries on by itself.'],
      button: 'Continue with Google',
      later: 'Later',
      laterNote: function (n) { return 'Later keeps ' + (n === 1 ? 'it' : 'them') + ' waiting, and Days in Lieu asks again next time you open it.'; },
      laterToast: function (n) { return (n === 1 ? 'Your email is' : 'Your emails are') + ' waiting. Days in Lieu asks again next time you open it.'; },
      watching: 'Waiting for Google…'
    },
    // ---------- emails ----------
    email: {
      sender: 'Days in Lieu · Our Lady’s Grammar School',
      footer: 'Days in Lieu · Our Lady’s Grammar School, Newry',
      dayLine: function (d) { return DIL.formatLong(d.date) + ' — ' + S.portion[d.portion]; },
      dayLineOutcome: function (d) { return DIL.formatLong(d.date) + ' — ' + S.portion[d.portion] + ' — ' + S.status[d.status] + (d.status === 'declined' && d.decisionNote ? ': ' + d.decisionNote : ''); },
      balanceLine: function (yearLabel, b) { return 'Days in lieu for ' + yearLabel + ': ' + fd(b.approved) + ' approved, ' + fd(b.booked) + ' booked, ' + fd(b.left) + ' left to book.'; },
      wrap: function (parts) { return parts.filter(Boolean).join('\n\n') + '\n\n— ' + S.email.footer; },
      wrapHtml: function (parts) { return parts.filter(Boolean).join('') + '<p style="color:#707070">— ' + esc(S.email.footer) + '</p>'; },
      // The short note: who and what, with the link, never the details. It goes instead of the full email, still from the
      // person's own address, when the full one is too long to wait in one property (Code.gs personMail).
      brief: function (kind, c) {
        var B = {
          newClaim: [c.staffName + ' sent a claim', c.staffName + ' has sent a claim for days in lieu.', 'Open it to approve or decline'],
          claimWithdrawn: [c.staffName + ' withdrew a claim', c.staffName + ' has withdrawn a claim. There is nothing to decide.', 'Open Days in Lieu'],
          newRequest: [c.staffName + ' asked to book days', c.staffName + ' has asked to book days in lieu.', 'Open it to approve or decline'],
          withdrawn: [c.staffName + ' withdrew a booking', c.staffName + ' has withdrawn a booking. There is nothing to decide.', 'Open Days in Lieu'],
          cancelled: [c.staffName + ' cancelled a booked day', c.staffName + ' has cancelled a booked day.', 'Open Days in Lieu'],
          claimDecision: ['your claim has been decided', cap(c.principalName) + ' has decided your claim.', 'See the decision'],
          decision: ['your booking has been decided', cap(c.principalName) + ' has decided your booking.', 'See the decision']
        }[kind], hello = c.first ? 'Hello ' + c.first + ',' : '';
        return {
          subject: 'Days in lieu: ' + B[0],
          text: S.email.wrap([hello, B[1], B[2] + ':\n' + c.url]),
          html: S.email.wrapHtml([hello ? '<p>' + esc(hello) + '</p>' : '', '<p>' + esc(B[1]) + '</p>', '<p><a href="' + esc(c.url) + '">' + esc(B[2]) + '</a></p>'])
        };
      },
      newClaim: function (c) { // {staffName, amount, reason, workDays, url}
        return {
          subject: 'Days in lieu: ' + c.staffName + ' claims ' + fd(c.amount),
          text: S.email.wrap([c.staffName + ' says they earned ' + fd(c.amount) + ' in lieu.', 'What: ' + c.reason + '\nWhen: ' + DIL.formatDateList(c.workDays), 'Open the claim to approve or decline:\n' + c.url]),
          html: S.email.wrapHtml(['<p><strong>' + esc(c.staffName) + '</strong> says they earned <strong>' + esc(fd(c.amount)) + '</strong> in lieu.</p>', '<p><strong>What:</strong> ' + esc(c.reason).replace(/\n/g, '<br>') + '<br><strong>When:</strong> ' + esc(DIL.formatDateList(c.workDays)) + '</p>', '<p><a href="' + esc(c.url) + '">Open the claim</a> to approve or decline.</p>'])
        };
      },
      claimDecision: function (c) { // {first, principalName, claim, yearLabel, balance, url}
        var k = c.claim, head = k.status === 'approved' ? 'approved' : k.status === 'partly' ? fn(k.amountApproved) + ' of ' + fd(k.amountClaimed) + ' approved' : 'not approved';
        var outcome = k.status === 'approved' ? 'Approved: ' + fd(k.amountApproved) + ' in lieu, ready to book.' : k.status === 'partly' ? 'Approved in part: ' + fn(k.amountApproved) + ' of the ' + fd(k.amountClaimed) + ' claimed, ready to book.' : 'Not approved.';
        var note = k.decisionNote ? 'Note from ' + c.principalName + ':\n' + k.decisionNote : '';
        return {
          subject: 'Your claim for ' + fd(k.amountClaimed) + ': ' + head,
          text: S.email.wrap(['Hello ' + c.first + ',', cap(c.principalName) + ' has looked at your claim of ' + DIL.formatLong(k.submittedAt) + ' — ' + k.reason + ' (' + DIL.formatDateList(k.workDays) + ').', outcome, note, S.email.balanceLine(c.yearLabel, c.balance), (k.status === 'declined' ? 'See your days:\n' : 'Book a day off:\n') + c.url]),
          html: S.email.wrapHtml(['<p>Hello ' + esc(c.first) + ',</p>', '<p>' + esc(cap(c.principalName)) + ' has looked at your claim of ' + esc(DIL.formatLong(k.submittedAt)) + ' — ' + esc(k.reason) + ' (' + esc(DIL.formatDateList(k.workDays)) + ').</p>', '<p><strong>' + esc(outcome) + '</strong></p>', k.decisionNote ? '<p><strong>Note from ' + esc(c.principalName) + ':</strong><br>' + esc(k.decisionNote).replace(/\n/g, '<br>') + '</p>' : '', '<p>' + esc(S.email.balanceLine(c.yearLabel, c.balance)) + '</p>', '<p><a href="' + esc(c.url) + '">' + (k.status === 'declined' ? 'See your days' : 'Book a day off') + '</a></p>'])
        };
      },
      claimWithdrawn: function (c) { // {staffName, claim, url}
        return { subject: 'Days in lieu: ' + c.staffName + ' withdrew a claim', text: S.email.wrap([c.staffName + ' has withdrawn their claim for ' + fd(c.claim.amountClaimed) + ' (' + c.claim.reason + '). Nothing to do.', c.url]), html: S.email.wrapHtml(['<p><strong>' + esc(c.staffName) + '</strong> has withdrawn their claim for ' + esc(fd(c.claim.amountClaimed)) + ' (' + esc(c.claim.reason) + '). Nothing to do.</p>', '<p><a href="' + esc(c.url) + '">Open Days in Lieu</a></p>']) };
      },
      newRequest: function (c) { // {staffName, total, days, note, balance, url, replaces}
        var lines = c.days.map(S.email.dayLine), instead = c.replaces && c.replaces.dates && c.replaces.dates.length ? S.dash.insteadOf(c.replaces.dates) : '';
        var note = c.note ? 'Note: ' + c.note : '', bal = c.balance ? 'They have ' + fd(c.balance.approved) + ' approved this year, ' + fd(c.balance.booked) + ' already booked and ' + fd(c.balance.left) + ' left to book after this.' : '';
        return {
          subject: 'Days in lieu: ' + c.staffName + ' wants ' + fd(c.total) + ' off',
          text: S.email.wrap([c.staffName + ' wants to take ' + fd(c.total) + ' in lieu.', lines.join('\n'), note, instead, bal, 'Open the booking to approve or decline:\n' + c.url]),
          html: S.email.wrapHtml(['<p><strong>' + esc(c.staffName) + '</strong> wants to take <strong>' + esc(fd(c.total)) + '</strong> in lieu.</p><ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>', note ? '<p>' + esc(note).replace(/\n/g, '<br>') + '</p>' : '', instead ? '<p><em>' + esc(instead) + '</em></p>' : '', bal ? '<p>' + esc(bal) + '</p>' : '', '<p><a href="' + esc(c.url) + '">Open the booking</a> to approve or decline.</p>'])
        };
      },
      decision: function (c) { // {first, principalName, submitted, days, outcome, note, yearLabel, balance, url}
        var head = { approved: 'approved', declined: 'not approved', partly: 'partly approved' }[c.outcome] || c.outcome;
        var lines = c.days.filter(function (d) { return d.status !== 'withdrawn'; }).map(S.email.dayLineOutcome);
        var note = c.note ? 'Note from ' + c.principalName + ':\n' + c.note : '';
        return {
          subject: 'Your booking: ' + head,
          text: S.email.wrap(['Hello ' + c.first + ',', cap(c.principalName) + ' has looked at your booking of ' + DIL.formatLong(c.submitted) + '.', lines.join('\n'), note, S.email.balanceLine(c.yearLabel, c.balance), 'See your days:\n' + c.url]),
          html: S.email.wrapHtml(['<p>Hello ' + esc(c.first) + ',</p>', '<p>' + esc(cap(c.principalName)) + ' has looked at your booking of ' + esc(DIL.formatLong(c.submitted)) + '.</p><ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>', c.note ? '<p><strong>Note from ' + esc(c.principalName) + ':</strong><br>' + esc(c.note).replace(/\n/g, '<br>') + '</p>' : '', '<p>' + esc(S.email.balanceLine(c.yearLabel, c.balance)) + '</p>', '<p><a href="' + esc(c.url) + '">See your days</a></p>'])
        };
      },
      withdrawn: function (c) { // {staffName, total, days, url}
        var when = c.days.map(function (d) { return DIL.formatShort(d.date); }).join(', ');
        return { subject: 'Days in lieu: ' + c.staffName + ' withdrew a booking', text: S.email.wrap([c.staffName + ' has withdrawn their booking for ' + fd(c.total) + ' (' + when + '). Nothing to do.', c.url]), html: S.email.wrapHtml(['<p><strong>' + esc(c.staffName) + '</strong> has withdrawn their booking for ' + esc(fd(c.total)) + ' (' + esc(when) + '). Nothing to do.</p>', '<p><a href="' + esc(c.url) + '">Open Days in Lieu</a></p>']) };
      },
      cancelled: function (c) { // {staffName, day, url}
        return { subject: 'Days in lieu: ' + c.staffName + ' cancelled ' + DIL.formatShort(c.day.date), text: S.email.wrap([c.staffName + ' will no longer be away on ' + DIL.formatLong(c.day.date) + ' (' + S.portion[c.day.portion] + '). The day goes back into their days left to book.', c.url]), html: S.email.wrapHtml(['<p><strong>' + esc(c.staffName) + '</strong> will no longer be away on ' + esc(DIL.formatLong(c.day.date)) + ' (' + esc(S.portion[c.day.portion]) + '). The day goes back into their days left to book.</p>', '<p><a href="' + esc(c.url) + '">Open Days in Lieu</a></p>']) };
      }
    },
    proto: { bar: 'PROTOTYPE · nothing is saved · view as', today: 'Today', latency: 'Slow server' }
  };
  return S;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = S;
