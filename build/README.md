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

Deploy as the account that should **own the Sheet and send the emails** (the Principal's, or a school admin
account). The web app runs as that account for everyone ("execute as user deploying"), so it can read the Sheet
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
   `quickReasons` (the quick-fill buttons), the academic year start (1 September by default).
   After step 8, paste the web app URL (ends `/exec`) into `appUrl`: every email links there. Left blank, an email
   sent from a call that did not come through the live link (for example a function run in the editor) links to the
   editor's `/dev` address, which staff cannot open.
7. **Closures tab**: `From`, `To`, `Label` — one row per holiday or closure, dates as `YYYY-MM-DD`. These grey out
   days on the booking calendar. Add the year's holidays now; add more any time.
8. Deploy ▸ New deployment ▸ type **Web app** ▸ Execute as **Me** ▸ Who has access **Anyone within c2ken.net** ▸ Deploy.
   Copy the web app URL: that is the link for staff. Bookmark it; put it on the staff portal.
9. Open the link on a phone and on a laptop as yourself and as a staff member; send a claim; approve it; book a day.

To update the app later: change the prototype, `./build/make.sh`, `clasp push` (or paste again), then
Deploy ▸ Manage deployments ▸ edit ▸ Version: New ▸ Deploy. The URL does not change.

## The live deployment (27 Sep 2026)

- Web app, Version 4 from 28 Sep 2026 (the URL never changes on a redeploy):
  https://script.google.com/a/macros/c2ken.net/s/AKfycby5o-MkQ7R0w-LTalT7fj3uUdTKWkWXocBy9D9mgy0iLTM3730r9BapfjsJ0ucUV7ez/exec
- The Sheet (dgartland021's C2k Drive; the script is bound to it):
  https://docs.google.com/spreadsheets/d/1mlAvXuCuH5tkB4udW1HSDN2f7neqlXHXjaWdcDxfOFA/edit
- Execute as Me (dgartland021@c2ken.net), Anyone within c2ken. Staff tab: dgartland021 and fmcalinden045, both
  approvers. Config `appUrl` = the link above. Closures filled from the school calendar for 2026–27.
- **Name hand-in** (28 Sep 2026): a second deployment of the SAME project, Execute as Me, access **Anyone** (a
  domain-only deployment answers 401 to a server-to-server call). Only its `doPost` matters:
  https://script.google.com/macros/s/AKfycbw1bp3S-nmIm3t0VKjod1vdxsehDv2pIXzSJT_fCDGlVzCa_2mCiEM3S268EuqqtI29/exec
  On every redeploy of the main link, move this deployment to the same new version too.
- **Name check** — the separate project "Days in Lieu · name check" (`build/companion/`, owner dgartland021), Execute
  as **user accessing**, Anyone within c2ken, scopes email + profile ONLY (Version 2). Its page, not its server, posts
  the visitor's token to the hand-in. Never add "external requests" to it: Google then shows an unticked "Connect to an
  external service" box, and anyone who skips it fails:
  https://script.google.com/a/macros/c2ken.net/s/AKfycbwZOmDNY6pul_FnRfkqufqhEVKwTra-Dd0IpFq0KhV_E0Z7jHvjf40XgfVqUl-_fQlIzg/exec
  Config `nameUrl` = this link. Its `HAND_IN_URL` = the hand-in link above.
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
The first time, Google needs that person's Allow, which cannot show in a frame: after 9 s the page shows *One
step before you start* with a *Confirm with Google* button that opens the name check in a new tab; the person
presses Allow there and comes back, and the page carries on by itself (it watches for 15 minutes). Staff names
arrive as initial + surname, e.g. *F McAlinden*. A small *Google not working? Type your name instead* link keeps
the old door as a last resort, and a blank `nameUrl` puts the old door back.

The owner is still named by the directory (`displayName`, Admin SDK) with no Google step at all.

The Allow screen says "unverified app" until C2k central marks school-built apps as trusted (request text:
`Claude Work/_probes/c2k_trust_apps_request.txt`); after that it disappears with no change here.

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
* A decision emails the person **before** it is written: if the email fails, nothing is saved and the Principal
  sees "That didn't go through" and can try again.
* The browser only ever calls `api(name, args)`; the server checks the caller's role on every call.
