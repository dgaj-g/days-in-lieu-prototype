// Runs dist/Code.gs in Node against in-memory stand-ins for the Apps Script services, as the people who will use it.
// Proves the Sheet round trip and the API contract without touching Google. Usage: node build/test/harness.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist');
const src = ['Logic.gs', 'Strings.gs', 'Code.gs'].map(f => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n');

/* ---------- stand-ins ---------- */
let viewer = '', TZ = 'Europe/London', mails = [], allMail = [];
// The directory: names it will give, accounts it refuses (as C2k refuses everyone but the owner), and a call count.
const directory = { names: {}, refuse: {}, calls: 0 }, props = {};
// Google's userinfo: what each token belongs to (the name check posts the visitor's own token).
const tokens = {};
class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = this.sheet.rows[this.r - 1 + i] || []; out.push(Array.from({ length: this.nc }, (_, j) => row[this.c - 1 + j] === undefined ? '' : row[this.c - 1 + j])); } return out; }
  setValues(v) { v.forEach((row, i) => { const rr = this.r - 1 + i; this.sheet.rows[rr] = this.sheet.rows[rr] || []; row.forEach((x, j) => { this.sheet.rows[rr][this.c - 1 + j] = x; }); }); return this; }
  setNumberFormat() { return this; } setFontWeight() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  getName() { return this.name; } getLastRow() { return this.rows.length; } setFrozenRows() {}
  getDataRange() { const nc = Math.max(1, ...this.rows.map(r => r.length)); return new Range(this, 1, 1, Math.max(this.rows.length, 1), nc); }
  getRange(a, c, nr, nc) { if (typeof a === 'string') return new Range(this, 1, 1, 1, 26); return new Range(this, a, c, nr || 1, nc || 1); }
  appendRow(v) { this.rows.push(v.slice()); return this; }
}
const book = { sheets: {}, getSheetByName(n) { return this.sheets[n] || null; }, insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }, getSheets() { return Object.values(this.sheets); }, getUrl() { return 'https://docs.google.com/spreadsheets/d/TEST'; }, deleteSheet() {} };
const ctx = {
  console, JSON, Date, Math, Number, String, Object, Array, RegExp, Error, parseInt, parseFloat, isFinite, encodeURIComponent, decodeURIComponent,
  SpreadsheetApp: { getActive: () => book, getUi: () => { throw new Error('no ui'); } },
  Session: { getActiveUser: () => ({ getEmail: () => viewer }), getEffectiveUser: () => ({ getEmail: () => 'admin@c2ken.net' }), getScriptTimeZone: () => TZ },
  AdminDirectory: { Users: { get: (e) => { directory.calls++; if (directory.refuse[e]) throw new Error('API call to directory.users.get failed with error: Not Authorized to access this resource/api'); if (!directory.names[e]) throw new Error('Resource Not Found: userKey'); return { name: { fullName: directory.names[e] } }; } } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: (k) => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
  MailApp: { sendEmail: (m) => { if (m.to.indexOf('@bounce.') >= 0) throw new Error('mail refused'); mails.push(m); allMail.push(m); } },
  HtmlService: { createTemplateFromFile: (n) => ({ evaluate() { return { setTitle() { return this; }, addMetaTag() { return this; }, setFaviconUrl() { return this; }, setXFrameOptionsMode() { return this; } }; } }), createHtmlOutputFromFile: () => ({ getContent: () => '' }), XFrameOptionsMode: { ALLOWALL: 1 } },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  UrlFetchApp: { fetch: (url, o) => { const u = tokens[String(o.headers.Authorization).replace('Bearer ', '')]; return { getResponseCode: () => (u ? 200 : 401), getContentText: () => JSON.stringify(u || { error: 'invalid_token' }) }; } },
  ContentService: { createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/a/macros/c2ken.net/s/TEST/exec' }) }
};
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'dist' });
const call = (name, ...args) => vm.runInContext('api', ctx)(name, args);
const as = (email, name, ...args) => { viewer = email; return call(name, ...args); };
const TODAY = vm.runInContext('today()', ctx);
const D = vm.runInContext('DIL', ctx);

/* ---------- checks ---------- */
let fails = 0, n = 0;
function ok(cond, label, extra) { n++; if (!cond) { fails++; console.log('FAIL', label, extra === undefined ? '' : JSON.stringify(extra).slice(0, 300)); } else console.log('ok  ', label); }
function eq(a, b, label) { ok(JSON.stringify(a) === JSON.stringify(b), label, { got: a, want: b }); }
function lastMail() { return mails[mails.length - 1]; }
function rows(name) { return book.sheets[name].rows.slice(1); }
// future weekdays from today, skipping weekends and closures
function weekday(offset) { let d = TODAY, k = 0; while (k < offset) { d = D.addDays(d, 1); if (!D.isWeekend(d)) k++; } return d; }

// 1. set up as an admin account, with the Principal named in PRINCIPAL_EMAIL
viewer = 'admin@c2ken.net'; vm.runInContext("PRINCIPAL_EMAIL = 'fmcalinden045@c2ken.net'; setup()", ctx);
eq(Object.keys(book.sheets).sort(), ['Claims', 'Closures', 'Config', 'Days', 'Requests', 'Staff'], 'setup creates the six sheets');
eq(rows('Staff'), [['admin@c2ken.net', '', 'approver', 'yes'], ['fmcalinden045@c2ken.net', '', 'approver', 'yes']], 'the deploying account and the Principal are both approvers');
// The Principal signs in under the school domain: same account, same row, approver, straight to the approval side
let pr = as('fmcalinden045@ourladysgrammar.newry.ni.sch.uk', 'whoami');
eq([pr.role, pr.email, pr.removed], ['approver', 'fmcalinden045@c2ken.net', false], 'school-domain sign-in resolves to the Principal\'s c2ken row');
eq(rows('Staff').length, 2, 'no duplicate row for the alias');
eq(D.norm('FMcAlinden045@OurLadysGrammar.Newry.NI.sch.uk'), 'fmcalinden045@c2ken.net', 'norm folds domain and case');
eq(D.norm('chughes400@c2ken.net'), 'chughes400@c2ken.net', 'c2ken form unchanged');
eq(rows('Config').map(r => r[0]), ['yearStartMonth', 'yearStartDay', 'yearOverride', 'nextYearOpens', 'principalName', 'quickReasons', 'appUrl', 'nameUrl', 'claimsFrom', 'sendUrl'], 'config defaults');
book.sheets.Config.rows.find(r => r[0] === 'sendUrl')[1] = '';   // sections 1–13: every email goes at once, as it did before the send link
book.sheets.Closures.appendRow([weekday(3), weekday(3), 'Inset day']);
let me = as('fmcalinden045@c2ken.net', 'whoami');
eq([me.role, me.needName, me.queueCount, !!me.sheetUrl], ['approver', true, 0, true], 'principal whoami: approver, needs a name, sees the sheet');
eq(me.cfg.quickReasons, ['Residential trip', 'Weekend fixture', 'SEAG Help'], 'quick reasons come from Config as a list');
eq(as('fmcalinden045@c2ken.net', 'setMyName', 'The Principal'), { ok: true, name: 'The Principal' }, 'principal names themselves');
eq(rows('Staff')[1][1], 'The Principal', 'name written to the Staff sheet');

// 2. a new teacher arrives
me = as('dgartland021@c2ken.net', 'whoami');
eq([me.role, me.needName, me.removed], ['staff', true, false], 'unknown c2k account is added as staff, needs a name');
eq(rows('Staff').length, 3, 'added to the Staff sheet');
eq(as('dgartland021@c2ken.net', 'submitClaim', { reason: 'x', workDays: [{ date: TODAY, portion: 'full' }] }), { ok: false, code: 'need_name' }, 'cannot claim without a name');
as('dgartland021@c2ken.net', 'setMyName', 'Damien Gartland');
me = as('dgartland021@c2ken.net', 'whoami'); eq([me.name, me.needName, me.sheetUrl], ['Damien Gartland', false, ''], 'named; staff never see the sheet link');
let d0 = as('dgartland021@c2ken.net', 'myDays');
eq([d0.balance.approved, d0.balance.left, d0.claims.length, d0.requests.length], [0, 0, 0, 0], 'empty year');

// 3. a claim with a half day, in the past, non-consecutive
const sat1 = D.addDays(TODAY, -((D.weekdayIndex(TODAY) + 1) % 7)), sat2 = D.addDays(sat1, -7);
const year = me.year;
const inYr = (iso) => D.inYear(iso, year);
const workDays = [sat1, sat2].filter(inYr).map((d, i) => ({ date: d, portion: i ? 'half' : 'full' }));
mails = [];
let c1 = as('dgartland021@c2ken.net', 'submitClaim', { reason: 'SEAG Help — Saturday classes', workDays });
ok(c1.ok && c1.claim.status === 'pending', 'claim submitted', c1);
eq(c1.claim.amountClaimed, D.claimTotal(workDays), 'amount claimed is the sum of the days');
eq(c1.claim.workDays, workDays.slice().sort((a, b) => a.date < b.date ? -1 : 1), 'work days come back sorted with portions');
eq(rows('Claims')[0][4], D.workDaysCell(c1.claim.workDays), 'WorkDays cell holds the compact form');
eq([mails.length, lastMail().to], [1, 'admin@c2ken.net,fmcalinden045@c2ken.net'], 'claim email goes to every approver');
ok(/claims/.test(lastMail().subject) && lastMail().htmlBody.indexOf('Open the claim') > 0, 'claim email subject and body', lastMail().subject);
ok(lastMail().htmlBody.indexOf('/TEST/exec?claim=') > 0, 'blank Config appUrl: email links to the service URL');
eq(me.claimWindow, D.claimWindow(year, { claimsFrom: '2026-07-01' }), 'whoami hands the page the claim window (Config claimsFrom 2026-07-01)');
eq(as('dgartland021@c2ken.net', 'submitClaim', { reason: 'Old', workDays: [{ date: D.addDays(me.claimWindow.start, -1), portion: 'full' }] }).code, 'date_outside_year', 'the day before the claim window refused: no carry-over');
// The claim window: 2026–27 reaches back to 1 July 2026; later years do not; a bad setting is ignored.
const y26 = D.yearBounds(2026, {}), y27 = D.yearBounds(2027, {}), w26 = D.claimWindow(y26, { claimsFrom: '2026-07-01' });
eq([w26.start, w26.end, w26.from, w26.label], ['2026-07-01', '2027-08-31', '2026-07-01', y26.label], '2026–27 claims reach back to Wed 1 Jul 2026');
eq([D.claimWindow(y27, { claimsFrom: '2026-07-01' }).start, D.claimWindow(y27, { claimsFrom: '2026-07-01' }).from], ['2027-09-01', ''], 'the July 2026 setting lapses in 2027–28');
eq([D.claimWindow(y26, { claimsFrom: 'soon' }).start, D.claimWindow(y26, {}).start, D.claimWindow(y26, { claimsFrom: '2026-10-01' }).start, D.claimWindow(y26, { claimsFrom: '2025-06-01' }).start],
   ['2026-09-01', '2026-09-01', '2026-09-01', '2026-09-01'], 'a blank, bad, later or two-years-back claimsFrom leaves the year start');
eq(D.validateClaim({ reason: 'Summer school', workDays: [{ date: '2026-07-01', portion: 'full' }] }, { todayISO: '2026-09-28', year: y26, window: w26 }).ok, true, 'work on Wed 1 Jul 2026 can be claimed');
const early = D.validateClaim({ reason: 'June', workDays: [{ date: '2026-06-30', portion: 'full' }] }, { todayISO: '2026-09-28', year: y26, window: w26 });
eq([early.code, early.from, early.to], ['date_outside_year', '2026-07-01', '2027-08-31'], 'work on Tue 30 Jun 2026 refused');
eq(vm.runInContext('S', ctx).claimProblem.describe(early), 'Claims can cover days from Wed 1 Jul 2026 to Tue 31 Aug 2027 only.', 'the refusal names the window');
eq(D.claimMonths(w26)[0], { y: 2026, m: 7 }, 'the claim calendar opens back to July 2026');
eq(D.claimMonthGrid(2026, 7, { todayISO: '2026-09-28', year: y26, window: w26 }).weeks.some(w => w.some(c => c.iso === '2026-07-01' && !c.problem)), true, 'Wed 1 Jul 2026 can be tapped on the claim calendar');
eq(as('dgartland021@c2ken.net', 'submitClaim', { reason: 'Bad', workDays: [{ date: TODAY, portion: 'am' }] }).code, 'bad_portion', 'a booking portion is not a claim portion');

// 4. cannot book before approval
let bk0 = as('dgartland021@c2ken.net', 'submit', { reason: '', days: [{ date: weekday(1), portion: 'full' }] });
eq(bk0.code, 'over_balance', 'booking refused: nothing approved yet');

// 5. Principal approves fewer, with a note
viewer = 'fmcalinden045@c2ken.net';
let q = call('queue'); eq([q.count, q.claims.length, q.requests.length], [1, 1, 0], 'queue shows the claim');
eq(q.claims[0].balance.left, 0, 'year line on the claim card: 0 left');
eq(call('decideClaim', c1.claim.claimId, { approve: true, amount: 1, note: '' }).code, 'note_required', 'fewer days needs a note');
mails = [];
let dec = call('decideClaim', c1.claim.claimId, { approve: true, amount: 1, note: 'Saturday classes are a half day each.' });
eq([dec.ok, dec.claim.status, dec.claim.amountApproved, dec.balance.left, dec.queueCount], [true, 'partly', 1, 1, 0], 'partly approved, 1 left, queue empty');
eq(rows('Claims')[0][8], 'partly', 'status written back to the Claims sheet');
eq([mails.length, lastMail().to], [1, 'dgartland021@c2ken.net'], 'decision email to the teacher');
ok(/1 of 1½ days approved/.test(lastMail().subject), 'decision subject says how many', lastMail().subject);
eq(call('decideClaim', c1.claim.claimId, { approve: true, note: '' }).code, 'not_pending', 'cannot decide twice without allowChange');

// 6. book: a full day then a half, over-balance refused, closure refused
viewer = 'dgartland021@c2ken.net';
let d1 = call('myDays'); eq([d1.balance.approved, d1.balance.left], [1, 1], 'teacher sees 1 approved, 1 left');
eq(call('submit', { reason: '', days: [{ date: weekday(1), portion: 'full' }, { date: weekday(2), portion: 'am' }] }).code, 'over_balance', '1½ booked against 1 left refused');
eq(call('submit', { reason: '', days: [{ date: weekday(3), portion: 'full' }] }).code, 'closure', 'inset day refused');
mails = [];
book.sheets.Config.rows.find(r => r[0] === 'appUrl')[1] = 'https://script.google.com/a/macros/c2ken.net/s/LIVE/exec';
let bk1 = call('submit', { reason: 'Long weekend', days: [{ date: weekday(1), portion: 'am' }, { date: weekday(2), portion: 'pm' }] });
eq([bk1.ok, bk1.request.status, bk1.request.total, bk1.balance.left, bk1.balance.pending], [true, 'pending', 1, 0, 1], 'booking of two halves sent; 0 left while awaiting');
eq(rows('Requests').length + rows('Days').length, 3, 'one request row, two day rows');
eq(lastMail().to, 'admin@c2ken.net,fmcalinden045@c2ken.net', 'booking email to every approver');
ok(lastMail().htmlBody.indexOf('/LIVE/exec?r=') > 0, 'Config appUrl wins over the service URL in emails');
eq(call('submit', { reason: '', days: [{ date: weekday(1), portion: 'pm' }] }).code, 'already_requested', 'same day again refused');

// 7. Principal declines one half with a reason, approves the other
viewer = 'fmcalinden045@c2ken.net';
q = call('queue'); eq([q.count, q.requests[0].days.length], [1, 2], 'booking in the queue');
const [dA, dB] = q.requests[0].days.map(d => d.dayId);
let ch = {}; ch[dA] = 'approved'; ch[dB] = 'declined';
eq(call('decide', bk1.request.id, ch, { general: '', days: {} }).code, 'day_note_required', 'declined day needs a reason');
mails = [];
let dd = call('decide', bk1.request.id, ch, { general: 'See you Friday', days: { [dB]: 'Short of cover that afternoon' } });
eq([dd.ok, dd.request.status, dd.balance.left, dd.balance.booked], [true, 'partly', 0.5, 0.5], 'partly approved booking; ½ left again');
eq(rows('Days').map(r => r[8]).sort(), ['approved', 'declined'], 'day statuses written');
eq(rows('Days').filter(r => r[8] === 'declined')[0][9], 'Short of cover that afternoon', 'declined day carries its reason');
eq(lastMail().to, 'dgartland021@c2ken.net', 'decision email to the teacher');

// 8. decided list, overview, csv, staff admin
let de = call('decided'); eq([de.claims.length, de.requests.length], [1, 1], 'decided lists both');
let ov = call('overview'); eq(ov.rows.length, 1, 'overview: one member of staff with activity');
eq([ov.rows[0].entitled, ov.rows[0].booked, ov.rows[0].left], [1, 0.5, 0.5], 'overview numbers');
let csv = call('csv'); ok(csv.ok && csv.content.split(/\r?\n/)[0] === 'Name,Email,Claimed,Approved,Booked,Taken,Left,Awaiting', 'csv header', csv.content);
eq(call('staffAdd', { email: 'CHughes400@ourladysgrammar.newry.ni.sch.uk', name: 'Claire Hughes', role: 'staff' }), { ok: true }, 'add staff by the school-domain address (stored as c2ken)');
eq(rows('Staff').filter(r => r[0] === 'chughes400@c2ken.net').length, 1, 'stored in the c2ken form');
eq(call('staffAdd', { email: 'someone@gmail.com', name: 'X', role: 'staff' }).code, 'bad_email', 'only c2ken addresses');
eq(call('staffAdd', { email: 'chughes400@c2ken.net', name: 'Claire', role: 'staff' }).code, 'duplicate', 'no duplicates');
eq(call('staffRemove', 'fmcalinden045@c2ken.net').code, 'not_allowed', 'cannot remove yourself');
eq(call('staffRole', 'chughes400@c2ken.net', 'approver'), { ok: true }, 'promote to approver');
eq(call('staffList').staff.map(s => s.role).sort(), ['approver', 'approver', 'approver', 'staff'], 'staff list shows roles');
eq(call('staffRemove', 'chughes400@c2ken.net'), { ok: true }, 'remove');
eq(as('chughes400@c2ken.net', 'whoami').removed, true, 'a removed account sees the removed door');
eq(rows('Staff').length, 4, 'removed stays on the sheet as inactive');

// 9. withdraw and cancel
viewer = 'dgartland021@c2ken.net';
let c2 = call('submitClaim', { reason: 'Netball final', workDays: [{ date: TODAY, portion: 'full' }] });
eq(call('withdrawClaim', c2.claim.claimId), { ok: true, mail: '' }, 'withdraw a pending claim');
eq(call('withdrawClaim', c2.claim.claimId).code, 'not_pending', 'cannot withdraw twice');
eq(call('myDays').claims.length, 1, 'withdrawn claim hidden from my days');
let up = call('myDays').summary.upcoming; eq(up.length, 1, 'one upcoming approved day');
eq(call('cancelDay', up[0].dayId), { ok: true, mail: '' }, 'cancel an upcoming approved day');
eq(call('myDays').balance.left, 1, 'cancelled day goes back into the balance');
eq(call('cancelDay', up[0].dayId).code, 'not_allowed', 'cannot cancel twice');

// 10. a decision whose email fails is not saved
viewer = 'p2@bounce.c2ken.net'; book.sheets.Staff.appendRow(['p2@bounce.c2ken.net', 'Bounce', 'staff', 'yes']);
let c3 = call('submitClaim', { reason: 'Trip', workDays: [{ date: TODAY, portion: 'full' }] }).claim;
viewer = 'fmcalinden045@c2ken.net';
let threw = false; try { call('decideClaim', c3.claimId, { approve: true, note: '' }); } catch (e) { threw = true; }
ok(threw, 'mail failure surfaces as an error to the browser');
eq(rows('Claims').filter(r => r[0] === c3.claimId)[0][8], 'pending', 'and the claim stays pending in the sheet');

// 11. role guards and the JSON wire
threw = false; try { as('dgartland021@c2ken.net', 'queue'); } catch (e) { threw = true; } ok(threw, 'staff cannot open the queue');
threw = false; try { as('fmcalinden045@c2ken.net', 'myDays'); } catch (e) { threw = true; } ok(threw, 'the Principal has no My days: approver cannot use staff calls');
threw = false; try { as('fmcalinden045@c2ken.net', 'submitClaim', { reason: 'x', workDays: [{ date: TODAY, portion: 'full' }] }); } catch (e) { threw = true; } ok(threw, 'approver cannot claim');
threw = false; try { as('nobody@c2ken.net', 'setMyName', 'X'); call('nope'); } catch (e) { threw = true; } ok(threw, 'unknown call name throws');
ok(JSON.stringify(as('fmcalinden045@c2ken.net', 'decided')).indexOf('_row') < 0, 'sheet row numbers never leave the server');

// 12. display names from the directory; the name door only when it has none
directory.names['newhire400@c2ken.net'] = 'C Hughes';
me = as('newhire400@c2ken.net', 'whoami');
eq([me.role, me.name, me.autoName, me.needName], ['staff', 'C Hughes', 'C Hughes', false], 'name obtained: newcomer registered with it, no name door');
eq(rows('Staff').filter(r => r[0] === 'newhire400@c2ken.net')[0][1], 'C Hughes', 'and the name is on the Staff sheet');
me = as('knew400@c2ken.net', 'whoami');
eq([me.name, me.needName], ['', true], 'lookup empty: the name door asks');
book.sheets.Staff.appendRow(['blank400@c2ken.net', '', 'staff', 'yes']); directory.names['blank400@c2ken.net'] = 'B Lank';
me = as('blank400@c2ken.net', 'whoami');
eq([me.name, me.needName, rows('Staff').filter(r => r[0] === 'blank400@c2ken.net')[0][1]], ['B Lank', false, 'B Lank'], 'blank known row is filled from the directory');
directory.names['newhire400@c2ken.net'] = 'Someone Else'; as('newhire400@c2ken.net', 'whoami');
eq(rows('Staff').filter(r => r[0] === 'newhire400@c2ken.net')[0][1], 'C Hughes', 'a name already on the sheet is never overwritten');
directory.names['nb400@c2ken.net'] = 'nb400'; eq(as('nb400@c2ken.net', 'whoami').needName, true, 'a "name" that is only the username is not a name');
directory.refuse['refused400@c2ken.net'] = true; directory.names['later400@c2ken.net'] = 'L Ater';
eq(as('refused400@c2ken.net', 'whoami').needName, true, 'directory refuses (as C2k does): the name door asks');
let before = directory.calls; me = as('later400@c2ken.net', 'whoami');
eq([directory.calls - before, me.needName], [0, true], 'after a refusal the lookup rests: no call, the door asks');
directory.names['admin@c2ken.net'] = 'A Dmin'; before = directory.calls;
eq([vm.runInContext("displayName('admin@c2ken.net')", ctx), directory.calls - before], ['A Dmin', 1], 'the owner is still looked up while it rests');

// 13. the name check hands in the visitor's own Google token; the name comes from Google's answer, never from the caller
const handed = [];   // every email handed to a send page, for the reserved-parameter check at the end
const post = (body) => { const r = JSON.parse(vm.runInContext('doPost', ctx)({ postData: { contents: JSON.stringify(body) } }).text); if (r && r.mails) handed.push(...r.mails); return r; };
book.sheets.Staff.appendRow(['newstaff500@c2ken.net', '', 'staff', 'yes']);
tokens.T500 = { email: 'newstaff500@c2ken.net', name: 'N Staff', given_name: 'N', family_name: 'Staff' };
viewer = 'newstaff500@c2ken.net'; eq(call('myName').name, '', 'before the check: no name');
eq(post({ token: 'T500' }), { ok: true, name: 'N Staff' }, 'hand-in: token read by Google, name returned');
eq(rows('Staff').filter(r => r[0] === 'newstaff500@c2ken.net')[0][1], 'N Staff', 'hand-in fills the blank Staff name');
eq(call('myName').name, 'N Staff', 'the waiting page sees the name');
tokens.T500b = { email: 'newstaff500@c2ken.net', name: 'Someone Else' };
eq(post({ token: 'T500b' }).name, 'N Staff', 'hand-in never overwrites a name already there');
eq(post({ token: 'forged', email: 'fmcalinden045@c2ken.net', name: 'Hacker' }).ok, false, 'a token Google does not know is refused, whatever the body claims');
tokens.T501 = { email: 'outsider@gmail.com', name: 'Out Sider' };
eq(post({ token: 'T501' }).ok, false, 'an account outside c2ken is refused');
const rowsBefore = rows('Staff').length; tokens.T502 = { email: 'notlisted502@c2ken.net', name: 'Not Listed' };
eq([post({ token: 'T502' }).code, rows('Staff').length], ['not_on_list', rowsBefore], 'hand-in never adds a row');
tokens.T503 = { email: 'fmcalinden045@ourladysgrammar.newry.ni.sch.uk', given_name: 'F', family_name: 'McAlinden' };
const pRow = book.sheets.Staff.rows.find(r => r[0] === 'fmcalinden045@c2ken.net'); const pWas = pRow[1]; pRow[1] = '';
eq(post({ token: 'T503' }).name, 'F McAlinden', 'school-domain token folds to the Principal\'s row; given + family used when no full name');
pRow[1] = pWas;
eq(post({}).ok, false, 'no token: refused');
book.sheets.Config.rows.push(['nameUrl', 'https://script.google.com/a/macros/c2ken.net/s/NAME/exec', '']);
eq(as('knew400@c2ken.net', 'whoami').nameUrl, 'https://script.google.com/a/macros/c2ken.net/s/NAME/exec', 'whoami hands the page the name check link');
// A Sheet made before claimsFrom existed has no row for it: the built-in default still applies.
book.sheets.Config.rows = book.sheets.Config.rows.filter(r => r[0] !== 'claimsFrom');
eq(as('knew400@c2ken.net', 'whoami').claimWindow.from, D.claimWindow(year, { claimsFrom: '2026-07-01' }).from, 'no claimsFrom row in Config: the default 2026-07-01 applies');
book.sheets.Config.rows.push(['claimsFrom', '', '']);
eq(as('knew400@c2ken.net', 'whoami').claimWindow.start, year.start, 'claimsFrom cleared in Config: claims start with the year');

// 14. Every email is from the person it is about. No send link: the app sends it at once, their name on it, replies to them.
book.sheets.Staff.appendRow(['mailer600@c2ken.net', 'M Teacher', 'staff', 'yes']);
const fRow = book.sheets.Staff.rows.find(r => r[0] === 'fmcalinden045@c2ken.net'); fRow[1] = 'F McAlinden';
const mailsIn = () => Object.keys(props).filter(k => k.startsWith('mail:')).map(k => JSON.parse(props[k]));
const cfgRow = book.sheets.Config.rows.find(r => r[0] === 'sendUrl'); cfgRow[1] = '';
viewer = 'mailer600@c2ken.net'; mails = [];
let k6r = call('submitClaim', { reason: 'Open night', workDays: [{ date: TODAY, portion: 'full' }] }), k6 = k6r.claim;
eq([k6r.mail, lastMail().name, lastMail().replyTo, lastMail().to], ['', 'M Teacher · Days in Lieu', 'mailer600@c2ken.net', 'admin@c2ken.net,fmcalinden045@c2ken.net'], 'no send link: a new claim is emailed at once, the teacher by name, replies to the teacher');
ok(/Open night/.test(lastMail().body), 'no send link: the full email as before', lastMail().subject);
call('withdrawClaim', k6.claimId);
eq([lastMail().name, lastMail().replyTo], ['M Teacher · Days in Lieu', 'mailer600@c2ken.net'], 'a withdrawn claim: the same');
viewer = 'mailer600@c2ken.net'; k6 = call('submitClaim', { reason: 'Open night', workDays: [{ date: TODAY, portion: 'full' }] }).claim;
viewer = 'fmcalinden045@c2ken.net'; mails = [];
let d6 = call('decideClaim', k6.claimId, { approve: true, note: '' });
eq([d6.ok, d6.mail, mails.length, lastMail().to, lastMail().name, lastMail().replyTo], [true, '', 1, 'mailer600@c2ken.net', 'F McAlinden · Days in Lieu', 'fmcalinden045@c2ken.net'], 'no send link: the decision is emailed at once, F McAlinden by name, replies to her');
eq(as('fmcalinden045@c2ken.net', 'whoami').sendUrl, '', 'no send link: whoami gives none');
// With the send link: every email waits for its sender's own address, and the app itself never sends one (29 Sep 2026: the
// Principal's decision went from the owner's address after ten minutes; his ruling, nothing is ever sent in anyone's place).
cfgRow[1] = 'https://script.google.com/a/macros/c2ken.net/s/SEND/exec'; const appSentBefore = allMail.length;
const age = (id, ms, field) => { const m = JSON.parse(props['mail:' + id]); m[field || 'at'] -= ms; props['mail:' + id] = JSON.stringify(m); };
eq([as('fmcalinden045@c2ken.net', 'whoami').sendUrl, as('mailer600@c2ken.net', 'whoami').sendUrl], [cfgRow[1], cfgRow[1]], 'whoami gives the send link to everyone');
tokens.TF = { email: 'fmcalinden045@c2ken.net', name: 'F McAlinden' }; tokens.TA = { email: 'admin@c2ken.net', name: 'A Admin' }; tokens.TX = { email: 'someone@gmail.com', name: 'Some One' };
tokens.TM = { email: 'mailer600@c2ken.net', name: 'M Teacher' };
// A teacher's claim: waits for the teacher's own address, to every approver; nobody else can collect it.
viewer = 'mailer600@c2ken.net'; mails = [];
let s1 = call('submitClaim', { reason: 'Open night again', workDays: [{ date: TODAY, portion: 'full' }] }), ws1 = mailsIn().find(m => m.id === s1.mail);
eq([s1.ok, mails.length, ws1 && ws1.state, ws1 && ws1.from, ws1 && ws1.to, ws1 && ws1.kind], [true, 0, 'waiting', 'mailer600@c2ken.net', 'admin@c2ken.net,fmcalinden045@c2ken.net', 'newClaim'], 'send link set: a new claim waits for the teacher\'s own address, to every approver');
eq(post({ token: 'TF', action: 'outbox' }).mails.filter(m => m.id === s1.mail).length, 0, 'the Principal\'s token cannot collect the teacher\'s email');
eq(as('fmcalinden045@c2ken.net', 'mailState', [s1.mail]).states[s1.mail], 'gone', 'nor see it'); viewer = 'mailer600@c2ken.net';
let obm = post({ token: 'TM', action: 'outbox' });
ok(obm.ok && obm.mails.length === 1 && obm.mails[0].id === s1.mail && /Open night again/.test(obm.mails[0].text), 'the teacher\'s own token: the full claim email, ready to send', obm.mails.map(m => m.subject));
post({ token: 'TM', action: 'sent', ids: [s1.mail] });
eq([call('mailState', [s1.mail]).states[s1.mail], mails.length], ['own', 0], 'reported sent: from the teacher\'s own address, nothing from the app');
// The teacher's page could not send it: it is not sent at all, never from the app; their page tells them to pass it on.
let s2 = call('withdrawClaim', s1.claim.claimId);
eq([s2.ok, (mailsIn().find(m => m.id === s2.mail) || {}).kind], [true, 'claimWithdrawn'], 'a withdrawal waits too');
post({ token: 'TM', action: 'outbox' }); mails = [];
post({ token: 'TM', action: 'sent', ids: [], failed: [s2.mail] });
eq([call('mailState', [s2.mail]).states[s2.mail], mails.length], ['failed', 0], 'the teacher\'s page could not send it: failed, nothing from the app');
eq([post({ token: 'TM', action: 'outbox' }).mails.length, post({ token: 'TM', action: 'sent', ids: [s2.mail] }).ok, call('mailState', [s2.mail]).states[s2.mail]], [0, true, 'failed'], 'a failed email is never handed over again, and stays failed');
// A claim withdrawn while its email still waits: the approvers never heard of it, so neither email goes.
viewer = 'mailer600@c2ken.net'; let s3 = call('submitClaim', { reason: 'Sports day', workDays: [{ date: TODAY, portion: 'full' }] });
let s3w = call('withdrawClaim', s3.claim.claimId);
eq([s3.ok, s3w.ok, s3w.mail, mailsIn().some(m => m.id === s3.mail), mailsIn().some(m => m.ref === s3.claim.claimId)], [true, true, '', false, false], 'withdrawn before its email went: nothing waits about it');
// A decision: waits for her own address.
const claimFor = () => { viewer = 'mailer600@c2ken.net'; return call('submitClaim', { reason: 'Parents evening', workDays: [{ date: TODAY, portion: 'half' }] }).claim; };
let k7 = claimFor(); viewer = 'fmcalinden045@c2ken.net'; mails = [];
let d7 = call('decideClaim', k7.claimId, { approve: true, note: '' });
let w7 = mailsIn().find(m => m.id === d7.mail);
eq([d7.ok, mails.length, !!w7, w7 && w7.state, w7 && w7.from, w7 && w7.to, w7 && w7.kind], [true, 0, true, 'waiting', 'fmcalinden045@c2ken.net', 'mailer600@c2ken.net', 'claimDecision'], 'send link set: the decision waits, from her, to the teacher');
eq(rows('Claims').find(r => r[0] === k7.claimId)[8], 'approved', 'the decision is saved while its email waits');
eq(call('mailState', [d7.mail]).states[d7.mail], 'waiting', 'the page sees it waiting');
eq(as('admin@c2ken.net', 'mailState', [d7.mail]).states[d7.mail], 'gone', 'another approver cannot see her emails'); viewer = 'fmcalinden045@c2ken.net';
eq(post({ token: 'TA', action: 'outbox' }), { ok: true, mails: [] }, 'another approver\'s token gets none of her emails');
eq(post({ token: 'TX', action: 'outbox' }).ok, false, 'an account outside c2ken gets nothing');
eq(post({ token: 'nope', action: 'outbox' }).ok, false, 'a token Google does not know gets nothing');
let ob = post({ token: 'TF', action: 'outbox' });
eq([ob.ok, ob.mails.length, ob.mails[0].id, ob.mails[0].to], [true, 1, d7.mail, 'mailer600@c2ken.net'], 'her own token: her waiting email only, ready to send');
ok(/Your claim for ½ day: approved/.test(ob.mails[0].subject) && /Parents evening/.test(ob.mails[0].text) && /<p/.test(ob.mails[0].html), 'rendered subject, text and html', ob.mails[0].subject);
eq([mailsIn().find(m => m.id === d7.mail).state, post({ token: 'TF', action: 'outbox' }).mails.length], ['sending', 0], 'handed over once only');
eq(post({ token: 'TA', action: 'sent', ids: [d7.mail] }), { ok: true }, 'another approver reporting it sent...');
eq(mailsIn().find(m => m.id === d7.mail).state, 'sending', '...changes nothing');
eq([post({ token: 'TF', action: 'sent', ids: [d7.mail], failed: [] }).ok, call('mailState', [d7.mail]).states[d7.mail], mails.length], [true, 'own', 0], 'reported sent: from her own address, nothing from the app');
// Her page could not send it: not sent at all; her page tells her to pass it on.
let k8 = claimFor(); viewer = 'fmcalinden045@c2ken.net'; let d8 = call('decideClaim', k8.claimId, { approve: false, note: 'Covered by TOIL already.' });
post({ token: 'TF', action: 'outbox' }); mails = [];
post({ token: 'TF', action: 'sent', ids: [], failed: [d8.mail] });
eq([call('mailState', [d8.mail]).states[d8.mail], mails.length], ['failed', 0], 'her page could not send it: failed, nothing from the app');
// Her page's send never ran (Google refused the call): handed straight back, so she can try again at once.
let k8b = claimFor(); viewer = 'fmcalinden045@c2ken.net'; let d8b = call('decideClaim', k8b.claimId, { approve: true, note: '' });
eq(post({ token: 'TF', action: 'outbox' }).mails.map(m => m.id), [d8b.mail], 'handed to her page');
eq([post({ token: 'TA', action: 'sent', back: [d8b.mail] }).ok, mailsIn().find(m => m.id === d8b.mail).state], [true, 'sending'], 'another approver handing it back changes nothing');
post({ token: 'TF', action: 'sent', back: [d8b.mail] });
eq([call('mailState', [d8b.mail]).states[d8b.mail], post({ token: 'TF', action: 'outbox' }).mails.map(m => m.id)], ['waiting', [d8b.mail]], 'the send never ran: waiting again at once, and handed over again');
post({ token: 'TF', action: 'sent', ids: [d8b.mail] }); eq([call('mailState', [d8b.mail]).states[d8b.mail], mails.length], ['own', 0], 'then sent from her own address');
// Nothing is ever sent in her place: eleven minutes (the old stand-in time) and thirteen days on, it still waits for her own
// address; after fourteen days it is dropped, still unsent by the app.
let k9 = claimFor(); viewer = 'fmcalinden045@c2ken.net'; let d9 = call('decideClaim', k9.claimId, { approve: true, note: '' }); mails = [];
age(d9.mail, 11 * 60000); as('mailer600@c2ken.net', 'myName');
eq([mails.length, as('fmcalinden045@c2ken.net', 'mailState', [d9.mail]).states[d9.mail]], [0, 'waiting'], 'eleven minutes: still waiting for her address, nothing from the app');
age(d9.mail, 13 * 864e5); as('mailer600@c2ken.net', 'myName');
eq([mails.length, as('fmcalinden045@c2ken.net', 'mailState', [d9.mail]).states[d9.mail]], [0, 'waiting'], 'thirteen days: still waiting, nothing from the app');
age(d9.mail, 864e5); as('mailer600@c2ken.net', 'myName');
eq([mails.length, as('fmcalinden045@c2ken.net', 'mailState', [d9.mail]).states[d9.mail]], [0, 'gone'], 'fourteen days: dropped, never sent by the app');
// Handed to her page and never reported: after five minutes it waits again; a late report from her page still counts.
let k10 = claimFor(); viewer = 'fmcalinden045@c2ken.net'; let d10 = call('decideClaim', k10.claimId, { approve: true, note: '' });
post({ token: 'TF', action: 'outbox' }); age(d10.mail, 4 * 60000, 'claimedAt'); call('myName');
eq(mailsIn().find(m => m.id === d10.mail).state, 'sending', 'handed over four minutes ago: still with her page');
age(d10.mail, 2 * 60000, 'claimedAt'); call('myName');
eq([mailsIn().find(m => m.id === d10.mail).state, mails.length], ['waiting', 0], 'no word from her page for five minutes: waiting again, nothing from the app');
post({ token: 'TF', action: 'sent', ids: [d10.mail] }); eq(call('mailState', [d10.mail]).states[d10.mail], 'own', 'a late report from her page still counts');
// whoami carries her waiting emails, so a fresh visit carries on with them, and whether her send page has ever run.
let k13 = claimFor(); viewer = 'fmcalinden045@c2ken.net'; let d13 = call('decideClaim', k13.claimId, { approve: true, note: '' });
let wh = call('whoami');
ok(wh.mailWaiting.length === 1 && wh.mailWaiting[0].id === d13.mail && wh.mailWaiting[0].first === 'M Teacher' && wh.ownSend === true, 'whoami: her waiting email, the teacher greeted by name, her send page has run', wh.mailWaiting);
eq([as('newstaff500@c2ken.net', 'whoami').ownSend, as('newstaff500@c2ken.net', 'whoami').mailWaiting], [false, []], 'someone whose send page never ran: nothing waiting, ownSend false');
viewer = 'fmcalinden045@c2ken.net'; post({ token: 'TF', action: 'outbox' }); post({ token: 'TF', action: 'sent', ids: [d13.mail] });
// A claim decided while the teacher's email still waits: the approvers' copy is stale and dropped; a changed decision replaces
// the one still waiting.
viewer = 'mailer600@c2ken.net'; let k14 = call('submitClaim', { reason: 'Trip', workDays: [{ date: TODAY, portion: 'full' }] });
viewer = 'fmcalinden045@c2ken.net'; let d14 = call('decideClaim', k14.claim.claimId, { approve: false, note: 'Not a school day.' });
eq([d14.ok, mailsIn().some(m => m.id === k14.mail), (mailsIn().find(m => m.id === d14.mail) || {}).state], [true, false, 'waiting'], 'decided before the teacher\'s email went: it is dropped, the decision waits');
let d14b = call('decideClaim', k14.claim.claimId, { approve: true, note: '' }, true);
eq([d14b.ok, mailsIn().some(m => m.id === d14.mail), (mailsIn().find(m => m.id === d14b.mail) || {}).state], [true, false, 'waiting'], 'a changed decision replaces the one still waiting');
post({ token: 'TF', action: 'outbox' }); post({ token: 'TF', action: 'sent', ids: [d14b.mail] });
// Too long to wait in one property: a short note waits instead, still from the sender's own address.
const bigId = vm.runInContext('personMail', ctx)(vm.runInContext('loadStore', ctx)(), 'mailer600@c2ken.net', 'fmcalinden045@c2ken.net', 'newClaim', { staffName: 'M Teacher', amount: 1, reason: 'x'.repeat(9000), workDays: [], url: 'https://x/exec?claim=CLM-X' }, 'CLM-X');
let wbig = mailsIn().find(m => m.id === bigId), obig = post({ token: 'TM', action: 'outbox' }).mails.find(m => m.id === bigId);
ok(wbig && wbig.brief && wbig.from === 'mailer600@c2ken.net' && wbig.state === 'waiting' && obig && /^Days in lieu: /.test(obig.subject) && !/xxxx/.test(obig.text + obig.html) && mails.length === 0, 'too long to wait: a short note waits instead, from the teacher\'s own address', obig && obig.subject);
post({ token: 'TM', action: 'sent', ids: [bigId] });
// Bookings: the request waits for the teacher's address, the decision for hers.
viewer = 'mailer600@c2ken.net'; let b11 = call('submit', { days: [{ date: weekday(12), portion: 'full', reason: '' }], sharedReason: 'Appointment' });
if (!b11.ok) b11 = call('submit', { days: [{ date: weekday(13), portion: 'half', reason: '' }], sharedReason: 'Appointment' });
ok(b11.ok, 'a booking to decide', b11);
let wr = mailsIn().find(m => m.id === b11.mail);
eq([wr && wr.kind, wr && wr.from, wr && wr.to, wr && wr.state], ['newRequest', 'mailer600@c2ken.net', 'admin@c2ken.net,fmcalinden045@c2ken.net', 'waiting'], 'a booking waits for the teacher\'s own address');
viewer = 'fmcalinden045@c2ken.net'; mails = [];
let bd = call('decide', b11.request.id, Object.fromEntries(b11.request.days.map(d => [d.dayId, 'approved'])), { general: '', days: {} });
let wb = mailsIn().find(m => m.id === bd.mail);
eq([bd.ok, mails.length, wb && wb.kind, wb && wb.state], [true, 0, 'decision', 'waiting'], 'a booking decision waits for her address too');
ob = post({ token: 'TF', action: 'outbox' }); ok(ob.mails.length === 1 && /Appointment|approved/i.test(ob.mails[0].subject + ob.mails[0].text), 'and renders for her page', ob.mails[0] && ob.mails[0].subject);
post({ token: 'TF', action: 'sent', ids: [bd.mail] });
viewer = 'mailer600@c2ken.net'; let cd = call('cancelDay', b11.request.days[0].dayId);
eq([cd.ok, (mailsIn().find(m => m.id === cd.mail) || {}).kind], [true, 'cancelled'], 'cancelling a booked day waits for the teacher\'s address too');
let b12 = call('submit', { days: [{ date: weekday(14), portion: 'full', reason: '' }], sharedReason: 'Course' });
ok(b12.ok, 'a booking to withdraw', b12);
post({ token: 'TM', action: 'outbox' }); post({ token: 'TM', action: 'sent', ids: [b12.mail] });
let wd = call('withdraw', b12.request.id); eq([wd.ok, (mailsIn().find(m => m.id === wd.mail) || {}).kind], [true, 'withdrawn'], 'withdrawing a booking the approvers were told of: that email waits too');
let b15 = call('submit', { days: [{ date: weekday(15), portion: 'full', reason: '' }], sharedReason: 'Course' }), wd15 = b15.ok && call('withdraw', b15.request.id);
eq([b15.ok, wd15 && wd15.mail, mailsIn().some(m => m.ref === (b15.request && b15.request.id))], [true, '', false], 'withdrawn before its email went: nothing waits about it');
// Every kind has a short note that names no reason, date or amount.
['newClaim', 'claimWithdrawn', 'newRequest', 'withdrawn', 'cancelled', 'claimDecision', 'decision'].forEach(kind => {
  const t = vm.runInContext('S', ctx).email.brief(kind, { staffName: 'M Teacher', principalName: 'the Principal', first: 'M', url: 'https://x/exec' });
  ok(/^Days in lieu: /.test(t.subject) && /https:\/\/x\/exec/.test(t.text) && !/undefined/.test(t.subject + t.text + t.html), 'short note for ' + kind, t.subject);
});
// Finished entries are cleared after a day.
const old = mailsIn().find(m => m.id === d7.mail); old.doneAt -= 864e5 + 1000; props['mail:' + d7.mail] = JSON.stringify(old);
call('whoami'); eq([('mail:' + d7.mail) in props, call('mailState', [d7.mail]).states[d7.mail]], [false, 'gone'], 'a day after: cleared');
// The Sheet fails after the email was queued: the waiting email is dropped with it.
let k12 = claimFor(); viewer = 'fmcalinden045@c2ken.net'; const mailsBefore = mailsIn().length;
const realSave = vm.runInContext('saveRow', ctx); vm.runInContext('saveRow = function () { throw new Error("sheet busy"); }', ctx);
threw = false; try { call('decideClaim', k12.claimId, { approve: true, note: '' }); } catch (e) { threw = true; }
ctx.__real = realSave; vm.runInContext('saveRow = __real', ctx);
eq([threw, mailsIn().filter(m => m.state === 'waiting' && m.from === 'fmcalinden045@c2ken.net').length, mailsIn().length], [true, 0, mailsBefore], 'the Sheet failed: no email left waiting about a decision that was not saved');
eq(allMail.length - appSentBefore, 0, 'with the send link set, the app itself sent no email at all (the first part of this section shows it would have)');
// A greeting never stops at an initial: staff Google names are "D Gartland" (the Principal's email said "Hello D").
const fN = vm.runInContext('DIL', ctx).firstName;
eq(['D Gartland', 'Mrs F McAlinden', 'Mrs Claire Hughes', 'Fiona McAlinden', 'Dr. A. Byrne', 'Siobhán', ''].map(fN), ['D Gartland', 'F McAlinden', 'Claire', 'Fiona', 'A. Byrne', 'Siobhán', ''], 'first names: an initial keeps the surname with it');

// Google reserves the link parameters c and sid: a web-app link carrying either is refused before doGet runs
// ("Sorry, unable to open the file at present", the Principal's first claim link, 29 Sep 2026). No email may carry one.
const reservedParam = (s) => /\/exec\?(?:[^\s"'<>]*?(?:&amp;|&|;))?(?:c|sid)=/.test(String(s));
ok(reservedParam('https://x/exec?c=CLM-1') && reservedParam('https://x/exec?a=1&amp;sid=2') && !reservedParam('https://x/exec?claim=CLM-1'), 'control: the reserved-parameter check bites');
const everyMail = allMail.map(m => [m.htmlBody, m.body].join(' ')).concat(handed.map(m => [m.html, m.text].join(' ')));
ok(everyMail.length > 5 && everyMail.some(t => /exec\?claim=/.test(t)) && !everyMail.some(reservedParam), 'no email links with a parameter Google reserves (c, sid)', everyMail.filter(reservedParam).slice(0, 1));
console.log(fails ? `\n${fails} of ${n} FAILED` : `\nall ${n} passed`); process.exit(fails ? 1 : 0);
