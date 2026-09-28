/* Days in Lieu · name check — a separate, tiny Apps Script project ("Days in Lieu · name check").
   Deployed as a web app that runs as the USER ACCESSING, so ScriptApp.getOAuthToken() is the visitor's own token.
   It posts that token to the main project's hand-in deployment (doPost in the main Code.gs), which asks Google whose
   token it is and puts that person's name on their Staff row. The token asks only to see the visitor's name and email.
   Opened hidden inside Days in Lieu when a name is missing; opened in its own tab when Google first needs the visitor's OK. */
var HAND_IN_URL = 'https://script.google.com/macros/s/AKfycbw1bp3S-nmIm3t0VKjod1vdxsehDv2pIXzSJT_fCDGlVzCa_2mCiEM3S268EuqqtI29/exec';   // the main project's "name hand-in" deployment (Anyone), ends /exec — set at deploy

function doGet(e) {
  var quiet = !!(e && e.parameter && e.parameter.quiet), out = { ok: false };
  try {
    var r = UrlFetchApp.fetch(HAND_IN_URL, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ token: ScriptApp.getOAuthToken() }), muteHttpExceptions: true, followRedirects: true });
    out = JSON.parse(r.getContentText());
  } catch (err) { out = { ok: false }; }
  var html = quiet ? '<p>' + (out.ok ? 'ok' : 'no') + '</p>' : page(out);
  return HtmlService.createHtmlOutput(html).setTitle('Days in Lieu').addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function page(out) {
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var body = out.ok
    ? '<h1>Done</h1><p>You appear in Days in Lieu as <b>' + esc(out.name) + '</b>.</p><p>Close this tab and go back to Days in Lieu. It carries on by itself.</p>'
    : '<h1>That didn’t work</h1><p>Your name couldn’t be read from your school account. Close this tab and go back to Days in Lieu.</p>';
  return '<div style="font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#1a2233;max-width:460px;margin:12vh auto;padding:0 20px">' + body + '</div>';
}
