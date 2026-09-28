#!/usr/bin/env bash
# Mark the moment a grab begins. `ingest.sh` refuses any download older than
# this, which is what tells a render that landed from one that did not.
here="$(cd "$(dirname "$0")" && pwd)"
rm -f "$here/_marker"; touch "$here/_marker"
echo "  marked"
