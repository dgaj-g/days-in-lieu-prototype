# Days in Lieu — the build (Google Apps Script)

The real app. It is the prototype's `app.js`, `strings.js`, `style.css` and `logic/logic.js` **unchanged**, served by
Google Apps Script from a Google Sheet, with `Code.gs` in place of `mock-api.js`. Staff sign in with their C2k
Google account; the Principal approves claims and bookings; the Sheet is the record; emails go out on every step.

```
build/
  src/            hand-written: Code.gs (server), api-gas.js.html (browser shim), index.html (page), appsscript.json
  make.sh         builds dist/ from src/ + the prototype sources — run it after ANY change to the prototype
  dist/           the Apps Script project, one file each, ready to push. Never edit by hand.
  probe/          the throwaway web app that proved how display names can be read on C2k (see Display names)
  test/harness.js runs dist/Code.gs in Node against fake Sheets and Mail: 85 checks through the whole story
```

Check before deploying:

```
./build/make.sh && node build/test/harness.js
```

## Deploying (needs a browser signed in to the school Google account — do this on the Mac)

Deploy as the account that should **own the Sheet** (the Principal's, or a school admin account). Emails go from
each person's own address through the staff sign-in page (see *Emails from the person's own address*). The web app runs as that account for everyone ("execute as user deploying"), so it can read the Sheet
and send mail while each visitor is identified by their own C2k sign-in.

### Route A — clasp (recommended: pushes all ten files in one command)

```
npm install -g @google/clasp
clasp login                       # opens the browser; sign in as the deploying account
cd build/dist
clasp create --type sheets --title "Days in Lieu"   # makes the Sheet AND its bound script, writes .clasp.json
clasp push                        # uploads dist/ (say yes to overwriting the manifest)
clasp open                        # opens the script editor
```
If `clasp login` is refused ("access blocked"), C2k has not allowed the clasp OAuth app — use Route B.

### Route B — by hand in the Apps Script editor

1. Google Sheets → new blank spreadsheet, name it **Days in Lieu**. Extensions → Apps Script.
2. In the editor, Project settings → tick "Show appsscript.json manifest file in editor".
3. Recreate each file in `dist/` with exactly the same name (the `+` next to Files: Script for `.gs`, HTML for `.html`)
   and paste its contents. `appsscript.json` replaces the manifest. Ten files in all.

### Then, either route

4. `PRINCIPAL_EMAIL` at the top of `Code.gs` is already the Principal's address (`fmcalinden045@c2ken.net`; her
   `@ourladysgrammar.newry.ni.sch.uk` form is the same account and is folded to it). `setup` makes her an approver from
   the start, so the link opens on the approval side for her. Run the function **setup** once (Run ▸ setup). Grant the permissions it asks for:
   see and edit this spreadsheet, send email as you, see your email address, see info about users on your domain
   (the directory lookup for display names). Back in the Sheet, six tabs now exist
   and **Staff** holds the deploying account and the Principal as approvers.
5. **Staff tab**: add any staff you
   want pre-loaded (`Role` = `staff`, `Active` = `yes`). Anyone else with a `@c2ken.net` account is added
   automatically as staff the first time they open the app. Their name comes from the directory when it answers
   (see Display names); on C2k that is only the owner's, so everyone else types their name once.
   Roles are exclusive: an approver sees only the approval side (To decide, Decided, Overview, Staff list) and cannot
   claim or book. The Principal's own days in lieu are handled outside this app.
6. **Config tab**: `principalName` (how sentences refer to the approver, e.g. `Mrs Smith` or `the Principal`),
   `quickReasons` (the quick-fill buttons), the academic year start (1 September by default), `claimsFrom` (the
   earliest day a claim may cover, YYYY-MM-DD; it only reaches back into the year before, so `2026-07-01` lets
   2026–27 take claims for the summer of 2026 and lapses by itself in 2027–28; blank = the year start; a Sheet
   with no `claimsFrom` row uses the built-in 2026-07-01).
   After step 8, paste the web app URL (ends `/exec`) into `appUrl`: every email links there. Left blank, an email
   sent from a call that did not come through the live link (for example a function run in the editor) links to the
   editor's `/dev` address, which staff cannot open.
7. **Closures tab**: `From`, `To`, `Label` — one row per holiday or closure, dates as `YYYY-MM-DD`. These grey out
   days on the booking calendar. Add the year's holidays now; add more any time.
8. Deploy ▸ New deployment ▸ type **Web app** ▸ Execute as **Me** ▸ Who has access **Anyone within c2ken.net** ▸ Deploy.
   Copy the web app URL: that is the link for staff. Bookmark it; put it on the staff portal.
9. Open the link on a phone and on a laptop as yourself and as a staff member; send a claim; approve it; book a day.

To update the app later: change the prototype, `./build/make.sh`, `clasp push` (or paste again), then
Deploy ▸ Manage deployments ▸ edit ▸ Version: New ▸ Deploy. The URL does not change. There is no clasp on this Mac:
`zsh build/paste_update.sh` puts each file on the clipboard in turn (`signin` for the sign-in project's one file).

## The live deployment (27 Sep 2026)

- Web app, Version 13 since 29 Sep 2026 19:41 (commit 26105ea: nothing is ever sent in anyone's place; hand-in link also Version 13, sign-in project Version 4) — one Google screen for name and email (the URL never changes on a redeploy):
  https://script.google.com/a/macros/c2ken.net/s/AKfycby5o-MkQ7R0w-LTalT7fj3uUdTKWkWXocBy9D9mgy0iLTM3730r9BapfjsJ0ucUV7ez/exec
- The Sheet (dgartland021's C2k Drive; the script is bound to it):
  https://docs.google.com/spreadsheets/d/1mlAvXuCuH5tkB4udW1HSDN2f7neqlXHXjaWdcDxfOFA/edit
- Execute as Me (dgartland021@c2ken.net), Anyone within c2ken. Staff tab: dgartland021 and fmcalinden045, both
  approvers. Config `appUrl` = the link above. Config has no `sendUrl` or `claimsFrom` row: the built-in defaults apply. Closures filled from the school calendar for 2026–27.
- **Name hand-in** (28 Sep 2026): a second deployment of the SAME project, Execute as Me, access **Anyone** (a
  domain-only deployment answers 401 to a server-to-server call). Only its `doPost` matters:
  https://script.google.com/macros/s/AKfycbw1bp3S-nmIm3t0VKjod1vdxsehDv2pIXzSJT_fCDGlVzCa_2mCiEM3S268EuqqtI29/exec
  On every redeploy of the main link, move this deployment to the same new version too (it also takes the send
  page's `outbox` and `sent` posts). Version 12 since 29 Sep 2026 (moved with the main link).
- **Staff sign-in** — the separate project first made as "Days in Lieu · name check" (`build/companion/`, owner
  dgartland021), Execute as **user accessing**, Anyone within c2ken, scopes email + profile + send mail ONLY. One page,
  two jobs: it hands in the visitor's name, and sends their waiting emails from their own address. Its page, not its
  server, posts the visitor's token to the hand-in. Never add "external requests" to it: Google then shows an unticked
  "Connect to an external service" box, and anyone who skips it fails. Config `nameUrl` AND `sendUrl` = this link
  (`sendUrl` is also the built-in default):
  https://script.google.com/a/macros/c2ken.net/s/AKfycbwZOmDNY6pul_FnRfkqufqhEVKwTra-Dd0IpFq0KhV_E0Z7jHvjf40XgfVqUl-_fQlIzg/exec
  Version 3 since 28 Sep 2026 19:47 ("Staff sign-in: name + send email as you"). Its `HAND_IN_URL` = the hand-in link above. Send mail merged in 28 Sep 2026 (his ruling: one Google screen at first
  open, not a second one later). The old separate send project "Days in Lieu · send from my email" (`build/sender/`,
  script 1jM6Eje68wd0DQ6w4jSwcAewtBmUh-Q4fCvGr0PnyhuY8dpAcwaena4C9) is no longer used; it was never granted by anyone.
- Tested live: a claim sent, approved, a day booked and approved; the staff emails arrived with the note and the
  balance and link to /exec. Claims, Requests and Days were emptied afterwards.
- Phones checked at 375 and 393 wide as staff and as the Principal; screenshots in
  `/Users/damiengartland/Desktop/Claude Work/Days In Lieu/phone-checks/`.

## Display names

Proved on the real domain on 27 Sep 2026 with the throwaway web app in `probe/` (Execute as Me, Anyone within
c2ken.net), deployed and visited by `dgartland021@c2ken.net`:

| What was tried | Exact result |
|---|---|
| `Session.getActiveUser().getEmail()` | `dgartland021@c2ken.net` — always the c2ken.net form, lower case |
| `Session.getEffectiveUser().getEmail()` | `dgartland021@c2ken.net` (the deployer) |
| `AdminDirectory.Users.get(<own email>, {viewType:'domain_public', projection:'basic'})` | `name.fullName` = `D Gartland` (`givenName` `D`, `familyName` `Gartland`) |
| the same for another member of staff (`fmcalinden045@c2ken.net`) | error `Not Authorized to access this resource/api` |
| the same with the school-domain form (`…@ourladysgrammar.newry.ni.sch.uk`) | error `Resource Not Found: userKey` — not a directory key; fold to c2ken.net first |
| the same for an address with no account | error `Resource Not Found: userKey` |
| People API `listDirectoryPeople` / `searchDirectoryPeople` (scope `directory.readonly`) | 0 people, no error |
| Drive: share a file with the address (no email), read the permission's `displayName` | `fmcalinden045` — the username, not a name |
| OpenID `userinfo` with `ScriptApp.getOAuthToken()` | the token owner only: `"name": "D Gartland"` |

**What the app does (28 Sep 2026, his ruling: nobody is asked their name).** A member of staff whose Staff row
has no name is never shown the name door. The page loads the name check (Config `nameUrl`) in a hidden frame; it
runs as that person, takes their own token and posts it to the hand-in (`doPost` in `Code.gs`), which asks Google
whose token it is (`userinfo`), requires an `@c2ken.net` address already on the Staff tab, and fills a BLANK name
only (never overwrites, never adds a row). The page watches `myName` and carries on the moment the name lands.
The first time, Google needs that person's OK, which cannot show in a frame: after 9 s the page shows *One
step before you start* with a *Confirm with Google* button that opens the name check in a new tab; the person
presses Review permissions, ticks *Send email as you* if Google shows a box for it, then Continue, and comes back, and the page carries on by itself (it watches for 15 minutes). Staff names
arrive as initial + surname, e.g. *F McAlinden*. There is no typing route (his ruling, 28 Sep 2026): the
*Type your name instead* link and the *Change* name button are gone; only a blank `nameUrl` brings the old typed door back.

The owner is still named by the directory (`displayName`, Admin SDK) with no Google step at all.

The OWNER must also have granted the main project `script.external_request` (doPost calls `UrlFetchApp`): run any
function that uses UrlFetch once in the editor and approve. Without it every hand-in answers `failed` with
"You do not have permission to call UrlFetchApp.fetch" in `why`. Granted 28 Sep 2026.

Link parameters: claim emails link with `?claim=`, bookings with `?r=`. Never `?c=` or `?sid=`: Google reserves both and refuses the link ("Sorry, unable to open the file at present") before doGet runs — the Principal's first claim link, 29 Sep 2026. Fix commit 96ca6e0; live on Version 12 (both links) since 29 Sep 2026, checked 09:46: a `?claim=` link ran Version 12. Version 12 was typed in the editor as the ONE claim-link line on top of Version 11, so live doGet still reads `p.c || p.r` where the repo reads `p.claim || p.r`: no difference in behaviour (approvers open on "To decide" either way); it rides with the next deploy from the repo. Links already sent with `?c=` stay refused by Google: send the plain link instead.

Deployments (Manage deployments): the main staff link AKfycby5o… is labelled "Main staff link - emails from your
own address" (Version 12); the hand-in AKfycbw1bp3S… (access Anyone) is labelled "Hand-in link - names and emails"
(Version 12). Same code for doPost in both. Older labels sit under Archived: those are past versions, not lost links.

The Review permissions screen says "Unverified" until C2k central marks school-built apps as trusted (request text:
`Claude Work/_probes/c2k_trust_apps_request.txt`); after that it disappears with no change here.

## Emails from the person's own address (28 Sep 2026, his ruling; nothing sent in anyone's place since 29 Sep 2026)

Every email a person causes goes from **their own** school address, so nobody's request sits in the owner's Sent
box: a claim, a booking, a withdrawal or a cancellation goes from the member of staff to the approvers; a decision
goes from the Principal to the member of staff.

* The action writes the Sheet and puts the email in a waiting list (ScriptProperties `mail:<id>`, one per email) and
  returns its id. The page loads the staff sign-in page (Config `sendUrl`) in a hidden frame. It runs as the person, asks the
  hand-in for their own waiting emails (`outbox`, checked against Google's `userinfo`, so nobody gets anyone
  else's), sends them with `MailApp` as themselves, and reports back (`sent`). Only `@c2ken.net` addresses are sent.
* **Nothing is ever sent in anyone's place** (his ruling, 29 Sep 2026). Until then the app sent a short note from the
  owner's address after 10 minutes: the Principal's first decision reached a teacher that way, "from" Damien, because
  her name was already on file, so she never passed the sign-in page and never gave Google her OK to send. Now an
  email waits for its sender's own address however long it takes, and one never collected is dropped after 14 days
  (the decision or claim itself is saved and shows in the app).
* Google cannot ask for its OK inside the hidden frame, so a box in the middle of the screen asks: **Continue with
  Google** (the sign-in page in its own tab with `send=1`, which calls `ScriptApp.requireScopes` for send mail only) or
  **Later** (the email keeps waiting). It comes 4 s after an email starts waiting for anyone whose send page has never
  run (property `sendok:<email>`, set at their first `outbox`), 9 s for anyone else, and again every time they open
  Days in Lieu while an email waits (whoami `mailWaiting`). Tab stays inside it; Escape is Later.
* A send that failed is marked *failed* and both pages say so ("let them know yourself"); a send that never ran is
  handed straight back (`back`) to be tried again; a hand-over the page never reports waits again after 5 minutes (a
  lost report can mean an email goes twice, never that it goes nowhere). Finished entries are cleared after a day.
* Stale emails are dropped, never sent: a claim or booking withdrawn before its email went sends nothing at all; a
  decision drops the teacher's waiting "new claim" email; a changed decision replaces the one still waiting.
* An email too long for one property (9 KB) waits as a short note instead (who and what, with the link), still from
  the person's own address.
* Blank `sendUrl` = the owner's switch: every email goes in full from the app at once, the person's name on it,
  replies to them.
* Google delivers these emails, not Outlook (C2k mail is Microsoft 365): they carry Outlook's EXTERNAL banner and do not
  appear in the sender's Outlook Sent Items. The From address is truly the sender's own.

## How the Sheet holds things

| Tab | One row per | Notes |
|---|---|---|
| Staff | person | `Email`, `Name`, `Role` (`staff`/`approver`), `Active` (`yes`/`no`). Removing someone sets `no`; their history stays. |
| Config | setting | `Key`, `Value`, and a note column explaining each. |
| Closures | closure | `From`, `To`, `Label`. |
| Claims | claim | `WorkDays` is the days of the work in one cell: `2026-09-19:half,2026-09-26` (a half day carries `:half`). `AmountClaimed` is always their sum. |
| Requests | booking | one booking = one email = one decision. `ReplacesId`/`ReplacesDates` link a "book a different day instead". |
| Days | day off | one row per date in a booking, each with its own status and, if declined, its own reason. |

All dates are ISO text (`YYYY-MM-DD`); the sheets are formatted as plain text so Google never turns them into dates.
Edit the Sheet by hand only for Staff, Config and Closures; the app writes the other three.

## What the server guarantees

* Every rule is the same code the prototype runs (`Logic.gs` = `logic/logic.js`): no carry-over between years,
  no booking beyond approved days, a claim's amount is the sum of its days, fewer-than-claimed and declines need a note.
* Writes take a script lock, and each write re-reads the Sheet first, so two people acting at once cannot cross.
* A decision's email is made **before** the Sheet is written: sent from the app, if it fails nothing is saved and
  the Principal sees "That didn't go through"; waiting for her sign-in page, it is dropped if the Sheet write fails.
* The browser only ever calls `api(name, args)`; the server checks the caller's role on every call.
