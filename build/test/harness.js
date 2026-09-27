// Runs dist/Code.gs in Node against in-memory stand-ins for the Apps Script services, as the people who will use it.
// Proves the Sheet round trip and the API contract without touching Google. Usage: node build/test/harness.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist');
const src = ['Logic.gs', 'Strings.gs', 'Code.gs'].map(f => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n');

/* ---------- stand-ins ---------- */
let viewer = '', TZ = 'Europe/London', mails = [];
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
  Session: { getActiveUser: () => ({ getEmail: () => viewer }), getScriptTimeZone: () => TZ },
  MailApp: { sendEmail: (m) => { if (m.to.indexOf('@bounce.') >= 0) throw new Error('mail refused'); mails.push(m); } },
  HtmlService: { createTemplateFromFile: (n) => ({ evaluate() { return { setTitle() { return this; }, addMetaTag() { return this; }, setFaviconUrl() { return this; }, setXFrameOptionsMode() { return this; } }; } }), createHtmlOutputFromFile: () => ({ getContent: () => '' }), XFrameOptionsMode: { ALLOWALL: 1 } },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
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
viewer = 'admin@c2ken.net'; vm.runInContext("PRINCIPAL_EMAIL = 'principal001@c2ken.net'; setup()", ctx);
eq(Object.keys(book.sheets).sort(), ['Claims', 'Closures', 'Config', 'Days', 'Requests', 'Staff'], 'setup creates the six sheets');
eq(rows('Staff'), [['admin@c2ken.net', '', 'approver', 'yes'], ['principal001@c2ken.net', '', 'approver', 'yes']], 'the deploying account and the Principal are both approvers');
eq(rows('Config').map(r => r[0]), ['yearStartMonth', 'yearStartDay', 'yearOverride', 'nextYearOpens', 'principalName', 'quickReasons'], 'config defaults');
book.sheets.Closures.appendRow([weekday(3), weekday(3), 'Inset day']);
let me = as('principal001@c2ken.net', 'whoami');
eq([me.role, me.needName, me.queueCount, !!me.sheetUrl], ['approver', true, 0, true], 'principal whoami: approver, needs a name, sees the sheet');
eq(me.cfg.quickReasons, ['Residential trip', 'Weekend fixture', 'SEAG Help'], 'quick reasons come from Config as a list');
eq(as('principal001@c2ken.net', 'setMyName', 'The Principal'), { ok: true, name: 'The Principal' }, 'principal names themselves');
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
eq([mails.length, lastMail().to], [1, 'admin@c2ken.net,principal001@c2ken.net'], 'claim email goes to every approver');
ok(/claims/.test(lastMail().subject) && lastMail().htmlBody.indexOf('Open the claim') > 0, 'claim email subject and body', lastMail().subject);
eq(as('dgartland021@c2ken.net', 'submitClaim', { reason: 'Old', workDays: [{ date: D.addDays(year.start, -1), portion: 'full' }] }).code, 'date_outside_year', 'last year refused: no carry-over');
eq(as('dgartland021@c2ken.net', 'submitClaim', { reason: 'Bad', workDays: [{ date: TODAY, portion: 'am' }] }).code, 'bad_portion', 'a booking portion is not a claim portion');

// 4. cannot book before approval
let bk0 = as('dgartland021@c2ken.net', 'submit', { reason: '', days: [{ date: weekday(1), portion: 'full' }] });
eq(bk0.code, 'over_balance', 'booking refused: nothing approved yet');

// 5. Principal approves fewer, with a note
viewer = 'principal001@c2ken.net';
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
let bk1 = call('submit', { reason: 'Long weekend', days: [{ date: weekday(1), portion: 'am' }, { date: weekday(2), portion: 'pm' }] });
eq([bk1.ok, bk1.request.status, bk1.request.total, bk1.balance.left, bk1.balance.pending], [true, 'pending', 1, 0, 1], 'booking of two halves sent; 0 left while awaiting');
eq(rows('Requests').length + rows('Days').length, 3, 'one request row, two day rows');
eq(lastMail().to, 'admin@c2ken.net,principal001@c2ken.net', 'booking email to every approver');
eq(call('submit', { reason: '', days: [{ date: weekday(1), portion: 'pm' }] }).code, 'already_requested', 'same day again refused');

// 7. Principal declines one half with a reason, approves the other
viewer = 'principal001@c2ken.net';
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
eq(call('staffAdd', { email: 'CHughes400@c2ken.net', name: 'Claire Hughes', role: 'staff' }), { ok: true }, 'add staff (email normalised)');
eq(call('staffAdd', { email: 'someone@gmail.com', name: 'X', role: 'staff' }).code, 'bad_email', 'only c2ken addresses');
eq(call('staffAdd', { email: 'chughes400@c2ken.net', name: 'Claire', role: 'staff' }).code, 'duplicate', 'no duplicates');
eq(call('staffRemove', 'principal001@c2ken.net').code, 'not_allowed', 'cannot remove yourself');
eq(call('staffRole', 'chughes400@c2ken.net', 'approver'), { ok: true }, 'promote to approver');
eq(call('staffList').staff.map(s => s.role).sort(), ['approver', 'approver', 'approver', 'staff'], 'staff list shows roles');
eq(call('staffRemove', 'chughes400@c2ken.net'), { ok: true }, 'remove');
eq(as('chughes400@c2ken.net', 'whoami').removed, true, 'a removed account sees the removed door');
eq(rows('Staff').length, 4, 'removed stays on the sheet as inactive');

// 9. withdraw and cancel
viewer = 'dgartland021@c2ken.net';
let c2 = call('submitClaim', { reason: 'Netball final', workDays: [{ date: TODAY, portion: 'full' }] });
eq(call('withdrawClaim', c2.claim.claimId), { ok: true }, 'withdraw a pending claim');
eq(call('withdrawClaim', c2.claim.claimId).code, 'not_pending', 'cannot withdraw twice');
eq(call('myDays').claims.length, 1, 'withdrawn claim hidden from my days');
let up = call('myDays').summary.upcoming; eq(up.length, 1, 'one upcoming approved day');
eq(call('cancelDay', up[0].dayId), { ok: true }, 'cancel an upcoming approved day');
eq(call('myDays').balance.left, 1, 'cancelled day goes back into the balance');
eq(call('cancelDay', up[0].dayId).code, 'not_allowed', 'cannot cancel twice');

// 10. a decision whose email fails is not saved
viewer = 'p2@bounce.c2ken.net'; book.sheets.Staff.appendRow(['p2@bounce.c2ken.net', 'Bounce', 'staff', 'yes']);
let c3 = call('submitClaim', { reason: 'Trip', workDays: [{ date: TODAY, portion: 'full' }] }).claim;
viewer = 'principal001@c2ken.net';
let threw = false; try { call('decideClaim', c3.claimId, { approve: true, note: '' }); } catch (e) { threw = true; }
ok(threw, 'mail failure surfaces as an error to the browser');
eq(rows('Claims').filter(r => r[0] === c3.claimId)[0][8], 'pending', 'and the claim stays pending in the sheet');

// 11. role guards and the JSON wire
threw = false; try { as('dgartland021@c2ken.net', 'queue'); } catch (e) { threw = true; } ok(threw, 'staff cannot open the queue');
threw = false; try { as('principal001@c2ken.net', 'myDays'); } catch (e) { threw = true; } ok(threw, 'the Principal has no My days: approver cannot use staff calls');
threw = false; try { as('principal001@c2ken.net', 'submitClaim', { reason: 'x', workDays: [{ date: TODAY, portion: 'full' }] }); } catch (e) { threw = true; } ok(threw, 'approver cannot claim');
threw = false; try { as('nobody@c2ken.net', 'setMyName', 'X'); call('nope'); } catch (e) { threw = true; } ok(threw, 'unknown call name throws');
ok(JSON.stringify(as('principal001@c2ken.net', 'decided')).indexOf('_row') < 0, 'sheet row numbers never leave the server');

console.log(fails ? `\n${fails} of ${n} FAILED` : `\nall ${n} passed`); process.exit(fails ? 1 : 0);
