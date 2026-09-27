#!/bin/sh
# Builds the Apps Script project in build/dist from the prototype sources.
# The prototype is the single source of truth: never edit dist/ by hand — edit prototype/ or build/src/ and rerun.
set -e
cd "$(dirname "$0")"
ROOT=..; DIST=dist; mkdir -p $DIST; rm -f $DIST/*
cp src/Code.gs src/api-gas.js.html src/index.html src/appsscript.json $DIST/
# Server-side copies of the shared files (Apps Script V8 runs them unchanged; the module.exports line is a no-op there).
cp $ROOT/logic/logic.js $DIST/Logic.gs
cp $ROOT/prototype/strings.js $DIST/Strings.gs
# Browser-side copies, wrapped for HtmlService include(). The crest becomes a data URI: Apps Script serves no static files.
CREST="data:image/png;base64,$(base64 < $ROOT/prototype/assets/crest-160.png | tr -d '\n')"
{ echo '<style>'; cat $ROOT/prototype/style.css; echo '</style>'; } > $DIST/style.css.html
{ echo '<script>'; cat $ROOT/logic/logic.js; echo '</script>'; } > $DIST/logic.js.html
{ echo '<script>'; cat $ROOT/prototype/strings.js; echo '</script>'; } > $DIST/strings.js.html
{ echo '<script>'; sed "s|assets/crest-160.png|$CREST|g" $ROOT/prototype/app.js; echo '</script>'; } > $DIST/app.js.html
grep -q "assets/crest-160.png" $DIST/app.js.html && { echo "crest path not replaced"; exit 1; }
echo "built $DIST:"; ls -1 $DIST | sed 's/^/  /'
