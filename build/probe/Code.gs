/* Days in Lieu — display-name probe. Web app: Execute as Me, access Anyone within c2ken.net.
   Shows, for the VISITOR, the email Session reports and what each lookup-by-email route returns. Throwaway. */
function doGet(e) {
  var rows = [], email = '', q = (e && e.parameter && e.parameter.q) || '';
  try { email = Session.getActiveUser().getEmail() || ''; rows.push(['Session.getActiveUser().getEmail()', email || '(empty)']); } catch (e) { rows.push(['getActiveUser', 'ERROR ' + e]); }
  try { rows.push(['Session.getEffectiveUser().getEmail() (the deployer)', Session.getEffectiveUser().getEmail()]); } catch (e) { rows.push(['getEffectiveUser', 'ERROR ' + e]); }
  var c2k = String(email).toLowerCase().replace(/@ourladysgrammar\.newry\.ni\.sch\.uk$/, '@c2ken.net');
  // 1. Admin SDK Directory, domain_public view (works for non-admins if the domain shares its directory)
  [email, c2k].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).forEach(function (addr) {
    try { var u = AdminDirectory.Users.get(addr, { viewType: 'domain_public', projection: 'basic' });
      rows.push(['AdminDirectory.Users.get(' + addr + ') fullName', JSON.stringify(u.name) + ' primaryEmail=' + u.primaryEmail]);
    } catch (e) { rows.push(['AdminDirectory.Users.get(' + addr + ')', 'ERROR ' + e]); }
  });
  // 1b. Someone ELSE, by email (?q=a,b)
  q.split(',').filter(String).forEach(function (addr) {
    try { var u = AdminDirectory.Users.get(addr, { viewType: 'domain_public', projection: 'basic' });
      rows.push(['LOOKUP OTHER ' + addr, JSON.stringify(u.name) + ' primaryEmail=' + u.primaryEmail + ' emails=' + JSON.stringify((u.emails || []).map(function (m) { return m.address; }))]);
    } catch (e) { rows.push(['LOOKUP OTHER ' + addr, 'ERROR ' + e]); }
  });
  // 1c. Drive: share a throwaway file with them (no email sent), read the permission's displayName, unshare.
  q.split(',').filter(String).forEach(function (addr) {
    try {
      var fid = PropertiesService.getScriptProperties().getProperty('probeFile');
      if (!fid) { fid = Drive.Files.create({ name: 'DIL name probe (safe to delete)', mimeType: 'text/plain' }).id; PropertiesService.getScriptProperties().setProperty('probeFile', fid); }
      var perm = Drive.Permissions.create({ role: 'reader', type: 'user', emailAddress: addr }, fid, { sendNotificationEmail: false, fields: 'id,displayName,emailAddress' });
      rows.push(['DRIVE ' + addr, 'displayName=' + JSON.stringify(perm.displayName) + ' email=' + perm.emailAddress]);
      try { Drive.Permissions.remove(fid, perm.id); } catch (e2) { rows.push(['DRIVE remove', 'ERROR ' + e2]); }
    } catch (e) { rows.push(['DRIVE ' + addr, 'ERROR ' + e]); }
  });
  try { var l = People.People.listDirectoryPeople({ readMask: 'names', sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'], pageSize: 3 }); rows.push(['People.listDirectoryPeople count', String((l.people || []).length)]); } catch (e) { rows.push(['People.listDirectoryPeople', 'ERROR ' + e]); }
  // 2. People API directory search by the visitor's email
  try { var r = People.People.searchDirectoryPeople({ query: email, readMask: 'names,emailAddresses', sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'] });
    var ps = r.people || []; rows.push(['People.searchDirectoryPeople hits', String(ps.length)]);
    ps.slice(0, 3).forEach(function (p) { rows.push(['  names / emails', JSON.stringify((p.names || []).map(function (n) { return n.displayName + ' | ' + n.givenName + ' | ' + n.familyName; })) + ' ' + JSON.stringify((p.emailAddresses || []).map(function (m) { return m.value; }))]); });
  } catch (e) { rows.push(['People.searchDirectoryPeople', 'ERROR ' + e]); }
  // 3. Control: OpenID userinfo with the script's token = the DEPLOYER under execute-as-Me
  try { var resp = UrlFetchApp.fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    rows.push(['userinfo (token owner, control)', resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 200)]); } catch (e) { rows.push(['userinfo', 'ERROR ' + e]); }
  var html = '<h2>Days in Lieu name probe</h2><table border=1 cellpadding=6 style="font:14px monospace;border-collapse:collapse">' +
    rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td id="' + esc(r[0]).replace(/\W+/g, '_') + '">' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
  return HtmlService.createHtmlOutput(html).setTitle('DIL name probe');
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
