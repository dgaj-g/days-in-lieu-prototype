# Days in Lieu — finish the build and deploy it (session on the Mac, Opus 5.5, high effort)

You are continuing the Days in Lieu project for Our Lady's Grammar School, Newry. A cloud session has already
written the Google Apps Script build; your job is to verify one thing it could not, finish it, deploy it from
this Mac (you have Chrome and the school Google account here), and prove it works on a phone. UK English throughout.

## Where things are

- **Source of truth is GitHub `main`**: https://github.com/dgaj-g/days-in-lieu-prototype. Pull it first. If the
  clone on this Mac is the one `publish_demo.sh` pushes to, use that; otherwise clone it beside the Desktop folder
  `~/Desktop/Claude Work/Days In Lieu/`. The Desktop folder's `prototype/` and `logic/` are now BEHIND the repo
  (calendar claim picker, several days per claim each Full/Half day, half-day auto-add on bookings, new wording,
  phone tap targets). Copy the repo's `prototype/` and `logic/` OVER the Desktop copies before you ever run
  `publish_demo.sh` again, never the other way round.
- `build/README.md` — what the build is and the deployment steps. Read it before anything else.
- `build/src/Code.gs` — the server. `build/make.sh` assembles `build/dist/` (the ten Apps Script files) from
  `build/src/` plus the prototype. `build/test/harness.js` runs `dist/Code.gs` in Node against fake Sheets and
  Mail: 67 checks, all passing now. `./build/make.sh && node build/test/harness.js` is the gate; keep it green.
- The live demo (prototype, mock data) is https://dgaj-g.github.io/days-in-lieu-prototype/ — the build must look
  and behave exactly like it.

## 1. Verify display names from the sign-in (do this FIRST, before touching the build)

The claim: when a member of staff opens the web app signed in with their C2k Google account, the server can obtain
their display name from the authentication/directory, in C2k's format of **first initial + surname** (e.g.
`D Gartland`), not just their email. This was found to work in earlier builds on this Mac (Maths Shelf, and the
recent A2 SSD app). The cloud build did NOT implement it: `API.whoami` in `build/src/Code.gs` currently passes `''`
as the name to `DIL.registerVisitor`, so every newcomer is asked to type their name. That is wrong and must change.

Do it properly:
1. Look at how Maths Shelf and the A2 SSD app obtain the name — find their `Code.gs` (search `~/Desktop/Claude Work`
   for `getActiveUser`, `AdminDirectory`, `People.People`, `userinfo.profile`). Reuse the method that is known to
   work in the c2ken.net domain rather than inventing one.
2. Prove it against the real domain before building on it: a throwaway Apps Script web app (execute as the deploying
   account, access "Anyone within c2ken.net") whose `doGet` prints, for the visiting account, the email and the name
   the method returns. Open it as Damien's account and, if possible, a second staff account. Confirm the format
   (`D Gartland`), and note whether it needs an advanced service (Admin SDK Directory, People) and which OAuth scope.
   Note the constraint: the web app runs as the deploying account, so a "me" lookup returns the deployer — the
   method must look up the VISITOR by email (e.g. Directory `Users.get(email, {viewType:'domain_public'})`).
3. Write the finding (method, scopes, service, the exact string returned, any failure mode) into `build/README.md`.

## 2. Finish the build

- Implement `displayName(email)` in `build/src/Code.gs` using the verified method, and use it in `API.whoami`:
  a newcomer is registered with that name; a known row with a blank name is filled in from it; the "add your name"
  door remains ONLY as the fallback when the lookup returns nothing. Add the service and scope to
  `build/src/appsscript.json`. Add a stub to `build/test/harness.js` and checks for: name obtained → `needName`
  false; lookup empty → `needName` true; blank known row filled. Rerun `./build/make.sh && node build/test/harness.js`.
- Keep the contract of `prototype/mock-api.js` exactly; `app.js`, `strings.js`, `style.css`, `logic.js` stay unchanged
  unless a bug forces it, in which case fix the prototype, rerun `make.sh`, and republish the demo.

## 3. Deploy

Follow `build/README.md` step by step, signed in Chrome as the account that should own the Sheet and send the
emails (the Principal's, or the school admin account — confirm with Damien which). `clasp` route first; paste-by-hand
if C2k blocks the clasp sign-in. Run `setup`, grant the permissions, fill the Staff tab (Principal as `approver`),
Config (`principalName`, `quickReasons`), Closures (this year's holidays, `YYYY-MM-DD`). Deploy as Web app,
Execute as Me, access Anyone within c2ken.net. Send a real claim as Damien, approve it as the Principal, book a day,
decide it; check every email arrives and reads correctly.

## 4. Mobile

The actual app must be phone-friendly. On the DEPLOYED URL (not the prototype): Chrome DevTools at iPhone SE and
iPhone 15 widths, and a real phone if one is to hand. Check the viewport is honoured inside Apps Script's frame
(`doGet` uses `addMetaTag('viewport', …)` for this — verify it took), no horizontal scroll on any screen, calendars
usable with a thumb, nothing tappable under 40px, the sticky summary not hiding the keyboard's target, decide cards
usable. Screenshot each screen as staff and as the Principal. Fix anything in the prototype, `make.sh`, push a new
deployment version (same URL).

## 5. Bring the documents up to date

`DIL_SPEC.md` and `DIL_ACCEPTANCE_TESTS.md` in the Desktop folder still describe a single work date and a typed
amount. Update them: a claim is `workDays` = a list of `{date, portion: full|half}`, picked on a calendar, any days
of the academic year including weekends and closures, not necessarily consecutive, stored in one Sheet cell as
`2026-09-19:half,2026-09-26`; `amountClaimed` is always the sum; on the booking page a day that only fits as a half
is added as a morning with an explanation; quick reasons are Residential trip, Weekend fixture, SEAG Help; the
display-name finding from step 1. `DIL_BUILD_PROMPT.md` is superseded by `build/` — say so at its top.

## Report back

The display-name method that worked and its exact output; the web app URL; what the phone checks found and fixed;
anything you could not do and why. Commit and push everything to `main`.
