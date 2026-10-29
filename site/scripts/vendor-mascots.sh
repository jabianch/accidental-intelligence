#!/usr/bin/env bash
# The site draws Shubby and Shoggy with the plugin's own code, copied here from
# github.com/jabianch/apocalypse-mascots at a tag or commit: bash site/scripts/vendor-mascots.sh v0.4.0
set -euo pipefail
ref="${1:?a tag or commit of jabianch/apocalypse-mascots}"
dir="$(dirname "$0")/../src/vendor/apocalypse-mascots"
for f in hooks/figures.ts types/index.d.ts; do
  curl -fsSL "https://raw.githubusercontent.com/jabianch/apocalypse-mascots/$ref/plugins/apocalypse-mascots/$f" -o "$dir/$f"
done
echo "$ref" > "$dir/REF"
