/* Days in Lieu · staff sign-in — a separate, tiny Apps Script project (made as "Days in Lieu · name check").
   Deployed as a web app that runs as the USER ACCESSING, so ScriptApp.getOAuthToken() is the visitor's own token and
   MailApp sends from the visitor's own school address. It does two jobs, both asked for on ONE Google screen at first open:
   1. The name. The page posts the token to the main project's hand-in deployment (doPost in the main Code.gs), which asks
      Google whose token it is and puts that person's name on their Staff row if it is blank.
   2. The emails. When "Send email as you" is granted, the page asks the hand-in for that person's waiting emails, sends
      them from their own address and reports which went.
   The posts are made by the page, not the server, so Google asks for three things only: name, email, "Send email as you".
   Google lets a visitor untick "Send email as you". The name still goes through; the emails wait, and Days in Lieu offers
   this page again (?send=1, which asks Google for just that one permission) or sends a short note from the app instead.
   Opened hidden inside Days in Lieu (?quiet=1); opened in its own tab when Google first needs the visitor's OK. */
var HAND_IN_URL = 'https://script.google.com/macros/s/AKfycbw1bp3S-nmIm3t0VKjod1vdxsehDv2pIXzSJT_fCDGlVzCa_2mCiEM3S268EuqqtI29/exec';   // the main project's hand-in deployment (Anyone), ends /exec — set at deploy
var SEND_SCOPE = 'https://www.googleapis.com/auth/script.send_mail';

function doGet(e) {
  var p = (e && e.parameter) || {}, quiet = !!p.quiet, canSend = sendGranted();
  if (!canSend && p.send && !quiet) ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [SEND_SCOPE]);   // ends here and shows Google's screen for that one permission
  var data = JSON.stringify({ url: HAND_IN_URL, token: ScriptApp.getOAuthToken(), quiet: quiet, send: canSend }).replace(/</g, '\\u003c');
  var html = '<div id="m" style="font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#1a2233;max-width:460px;margin:12vh auto;padding:0 20px">'
    + (quiet ? '' : '<h1>One moment</h1><p>Checking your school account…</p>') + '</div>'
    + '<script>(function () {\n'
    + 'var d = ' + data + ';\n'
    + 'function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;" }[c]; }); }\n'
    + 'function post(body) { body.token = d.token; return fetch(d.url, { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }\n'
    + 'function report(sent, failed) { var b = { action: "sent", ids: sent, failed: failed }; return post(b).catch(function () { return post(b); }); }\n'
    // mail: "" nothing tried or nothing waiting, "own" all sent from their address, "app" some went from the app, "bad" the waiting emails couldn't be fetched
    + 'function mail() {\n'
    + '  if (!d.send) return Promise.resolve("");\n'
    + '  return post({ action: "outbox" }).then(function (out) {\n'
    + '    if (!out || !out.ok) return "bad";\n'
    + '    var mails = out.mails || [], ids = mails.map(function (m) { return m.id; }); if (!mails.length) return "";\n'
    + '    return new Promise(function (done) {\n'
    + '      google.script.run\n'
    + '        .withSuccessHandler(function (r) { report(r.sent, r.failed).then(function () { done(r.failed.length ? "app" : "own"); }, function () { done("app"); }); })\n'
    + '        .withFailureHandler(function () { report([], ids).then(function () { done("app"); }, function () { done("app"); }); })\n'
    + '        .sendAll(mails);\n'
    + '    });\n'
    + '  }, function () { return "bad"; });\n'
    + '}\n'
    + 'var name = post({}).then(function (out) { return out && out.ok ? out.name : ""; }, function () { return ""; });\n'
    + 'Promise.all([name, mail()]).then(function (r) {\n'
    + '  if (d.quiet) return;\n'
    + '  var n = r[0], k = r[1], lines = [];\n'
    + '  if (n) lines.push("You appear in Days in Lieu as <b>" + esc(n) + "</b>.");\n'
    + '  if (k === "own") lines.push("Your email was sent from your own school address.");\n'
    + '  if (k === "app") lines.push("An email couldn\\u2019t be sent from your address, so Days in Lieu sent a short one with your name on it.");\n'
    + '  if (k === "bad") lines.push("Your email couldn\\u2019t be sent from here, so Days in Lieu sends a short one from the app instead.");\n'
    + '  if (!lines.length) lines.push("Your school account couldn\\u2019t be checked.");\n'
    + '  lines.push("Close this tab and go back to Days in Lieu. It carries on by itself.");\n'
    + '  document.getElementById("m").innerHTML = "<h1>" + (n || k === "own" ? "Done" : "That didn\\u2019t work") + "</h1><p>" + lines.join("</p><p>") + "</p>";\n'
    + '});\n'
    + '})();</script>';
  return HtmlService.createHtmlOutput(html).setTitle('Days in Lieu').addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Has this visitor let Days in Lieu send email as them? (They may have unticked it on Google's screen.)
function sendGranted() {
  try { return ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL, [SEND_SCOPE]).getAuthorizationStatus() === ScriptApp.AuthorizationStatus.NOT_REQUIRED; }
  catch (err) { console.error('sendGranted: ' + err); return true; }   // can't tell: try, and anything that fails goes from the app
}

// Sends each email from the visitor's own address. School addresses only, at most 20 at a time.
function sendAll(mails) {
  var sent = [], failed = [];
  [].concat(mails || []).slice(0, 20).forEach(function (m) {
    var to = String(m && m.to || '').split(',').map(function (a) { return a.trim(); }).filter(Boolean);
    var school = to.length && to.every(function (a) { return /^[^@\s]+@c2ken\.net$/i.test(a); });
    if (!school) { if (m && m.id) failed.push(String(m.id)); return; }
    try { MailApp.sendEmail({ to: to.join(','), subject: String(m.subject), body: String(m.text), htmlBody: String(m.html) }); sent.push(String(m.id)); }
    catch (err) { console.error('send ' + m.id + ': ' + err); failed.push(String(m.id)); }
  });
  return { sent: sent, failed: failed };
}
