/* Days in Lieu · name check — a separate, tiny Apps Script project ("Days in Lieu · name check").
   Deployed as a web app that runs as the USER ACCESSING, so ScriptApp.getOAuthToken() is the visitor's own token.
   The page it serves posts that token to the main project's hand-in deployment (doPost in the main Code.gs), which asks
   Google whose token it is and puts that person's name on their Staff row. The post is made by the page, not the server,
   so the project needs no "external service" permission: Google asks the visitor only for their name and email.
   Opened hidden inside Days in Lieu when a name is missing; opened in its own tab when Google first needs the visitor's OK. */
var HAND_IN_URL = 'https://script.google.com/macros/s/AKfycbw1bp3S-nmIm3t0VKjod1vdxsehDv2pIXzSJT_fCDGlVzCa_2mCiEM3S268EuqqtI29/exec';   // the main project's "name hand-in" deployment (Anyone), ends /exec — set at deploy

function doGet(e) {
  var quiet = !!(e && e.parameter && e.parameter.quiet);
  var data = JSON.stringify({ url: HAND_IN_URL, token: ScriptApp.getOAuthToken(), quiet: quiet }).replace(/</g, '\\u003c');
  var html = '<div id="m" style="font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#1a2233;max-width:460px;margin:12vh auto;padding:0 20px">'
    + (quiet ? '' : '<h1>One moment</h1><p>Reading your name from your school account…</p>') + '</div>'
    + '<script>(function () {\n'
    + 'var d = ' + data + ';\n'
    + 'function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;" }[c]; }); }\n'
    + 'function show(out) { if (d.quiet) return; document.getElementById("m").innerHTML = out && out.ok\n'
    + '  ? "<h1>Done</h1><p>You appear in Days in Lieu as <b>" + esc(out.name) + "</b>.</p><p>Close this tab and go back to Days in Lieu. It carries on by itself.</p>"\n'
    + '  : "<h1>That didn\\u2019t work</h1><p>Your name couldn\\u2019t be read from your school account. Close this tab and go back to Days in Lieu.</p>"; }\n'
    + 'fetch(d.url, { method: "POST", body: JSON.stringify({ token: d.token }) }).then(function (r) { return r.json(); }).then(show, function () { show(null); });\n'
    + '})();</script>';
  return HtmlService.createHtmlOutput(html).setTitle('Days in Lieu').addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
