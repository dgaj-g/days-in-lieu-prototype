#!/bin/zsh
# Puts each file on the clipboard in turn, for pasting into the Apps Script editor by hand (there is no clasp on this Mac).
#   zsh build/paste_update.sh           the main project (bound to the Days in Lieu Sheet): every file the app's code lives in
#   zsh build/paste_update.sh signin    the staff sign-in project ("Days in Lieu · name check"): its one file
# Run ./build/make.sh first. appsscript.json and index.html are left out: they change rarely; paste them by hand when they do.
cd "${0:A:h}" || exit 1
if [[ "$1" == signin ]]; then files=(companion/Code.gs); where="the staff sign-in project"
else files=(dist/Code.gs dist/Logic.gs dist/Strings.gs dist/api-gas.js.html dist/app.js.html dist/logic.js.html dist/strings.js.html dist/style.css.html); where="the main Days in Lieu project"; fi
print "Pasting into $where: ${#files} file(s).\n"
i=0
for f in $files; do
  (( i++ )); LC_CTYPE=en_US.UTF-8 pbcopy < "$f"
  print "[$i/${#files}] ${f:t} is on your clipboard."
  print "      In the editor: click ${f:t} in the list on the left, click anywhere in its code, press Cmd+A, then Cmd+V."
  if [[ -t 0 ]]; then read -r "?      Press Return here for the next file. " _; print; else print "      (Not a terminal: stopping after this one.)"; break; fi
done
print "Done. Press Cmd+S in the editor to save, then deploy (build/README.md, \"The live deployment\")."
