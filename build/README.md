# Days in Lieu — the build (Google Apps Script)

The real app. It is the prototype's `app.js`, `strings.js`, `style.css` and `logic/logic.js` **unchanged**, served by
Google Apps Script from a Google Sheet, with `Code.gs` in place of `mock-api.js`. Staff sign in with their C2k
Google account; the Principal approves claims and bookings; the Sheet is the record; emails go out on every step.

```
build/
  src/            hand-written: Code.gs (server), api-gas.js.html (browser shim), index.html (page), appsscript.json
  make.sh         builds dist/ from src/ + the prototype sources — run it after ANY change to the prototype
  dist/           the Apps Script project, one file each, ready to push. Never edit by hand.
  test/harness.js runs dist/Code.gs in Node against fake Sheets and Mail: 67 checks through the whole story
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
   see and edit this spreadsheet, send email as you, see your email address. Back in the Sheet, six tabs now exist
   and **Staff** holds the deploying account and the Principal as approvers.
5. **Staff tab**: add any staff you
   want pre-loaded (`Role` = `staff`, `Active` = `yes`). Anyone else with a `@c2ken.net` account is added
   automatically as staff the first time they open the app and is asked for their name.
   Roles are exclusive: an approver sees only the approval side (To decide, Decided, Overview, Staff list) and cannot
   claim or book. The Principal's own days in lieu are handled outside this app.
6. **Config tab**: `principalName` (how sentences refer to the approver, e.g. `Mrs Smith` or `the Principal`),
   `quickReasons` (the quick-fill buttons), the academic year start (1 September by default).
7. **Closures tab**: `From`, `To`, `Label` — one row per holiday or closure, dates as `YYYY-MM-DD`. These grey out
   days on the booking calendar. Add the year's holidays now; add more any time.
8. Deploy ▸ New deployment ▸ type **Web app** ▸ Execute as **Me** ▸ Who has access **Anyone within c2ken.net** ▸ Deploy.
   Copy the web app URL: that is the link for staff. Bookmark it; put it on the staff portal.
9. Open the link on a phone and on a laptop as yourself and as a staff member; send a claim; approve it; book a day.

To update the app later: change the prototype, `./build/make.sh`, `clasp push` (or paste again), then
Deploy ▸ Manage deployments ▸ edit ▸ Version: New ▸ Deploy. The URL does not change.

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
