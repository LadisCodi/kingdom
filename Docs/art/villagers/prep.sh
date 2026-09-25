#!/usr/bin/env bash
here="$(cd "$(dirname "$0")" && pwd)"; rm -f "$here/_marker"; touch "$here/_marker"; echo "  marked"
