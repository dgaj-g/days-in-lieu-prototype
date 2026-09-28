/* Days in Lieu · send from my email — a separate, tiny Apps Script project ("Days in Lieu · send from my email").
   Deployed as a web app that runs as the USER ACCESSING, so MailApp sends from the visitor's own school address and
   ScriptApp.getOAuthToken() is the visitor's own token. The page it serves posts that token to the main project's hand-in
   deployment (doPost in the main Code.gs), which hands back only that person's waiting emails; this project sends them
   and reports which went. The posts are made by the page, not the server, so Google asks the visitor for two things only:
   their name and email, and "Send email as you". Opened hidden inside Days in Lieu after an action that emails someone;
   opened in its own tab when Google first needs the visitor's OK. */
var HAND_IN_URL = 'https://script.google.com/macros/s/AKfycbw1bp3S-nmIm3t0VKjod1vdxsehDv2pIXzSJT_fCDGlVzCa_2mCiEM3S268EuqqtI29/exec';   // the main project's hand-in deployment (Anyone), ends /exec

function doGet(e) {
  var quiet = !!(e && e.parameter && e.parameter.quiet);
  var data = JSON.stringify({ url: HAND_IN_URL, token: ScriptApp.getOAuthToken(), quiet: quiet }).replace(/</g, '\\u003c');
  var html = '<div id="m" style="font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#1a2233;max-width:460px;margin:12vh auto;padding:0 20px">'
    + (quiet ? '' : '<h1>One moment</h1><p>Sending your email from your school address…</p>') + '</div>'
    + '<script>(function () {\n'
    + 'var d = ' + data + ', T = {\n'
    + '  own: ["Done", "Sent from your email. You can close this tab and go back to Days in Lieu."],\n'
    + '  none: ["Nothing waiting", "There is no email waiting to send. You can close this tab and go back to Days in Lieu."],\n'
    + '  app: ["Sent from the app instead", "Your email couldn\\u2019t be sent from your address, so Days in Lieu sent a short one with your name on it. You can close this tab."],\n'
    + '  bad: ["That didn\\u2019t work", "Your school account couldn\\u2019t be checked. Close this tab and go back to Days in Lieu. It sends the email from the app instead."]\n'
    + '};\n'
    + 'function show(k) { if (d.quiet) return; document.getElementById("m").innerHTML = "<h1>" + T[k][0] + "</h1><p>" + T[k][1] + "</p>"; }\n'
    + 'function post(body) { body.token = d.token; return fetch(d.url, { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }\n'
    + 'function report(sent, failed) { var b = { action: "sent", ids: sent, failed: failed }; return post(b).catch(function () { return post(b); }); }\n'
    + 'post({ action: "outbox" }).then(function (out) {\n'
    + '  if (!out || !out.ok) return show("bad");\n'
    + '  var mails = out.mails || [], ids = mails.map(function (m) { return m.id; }); if (!mails.length) return show("none");\n'
    + '  google.script.run\n'
    + '    .withSuccessHandler(function (r) { report(r.sent, r.failed).then(function () { show(r.failed.length ? "app" : "own"); }, function () { show("app"); }); })\n'
    + '    .withFailureHandler(function () { report([], ids).then(function () { show("app"); }, function () { show("app"); }); })\n'
    + '    .sendAll(mails);\n'
    + '}, function () { show("bad"); });\n'
    + '})();</script>';
  return HtmlService.createHtmlOutput(html).setTitle('Days in Lieu').addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
