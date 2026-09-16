#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -n "${BLENDER_BIN:-}" ]]; then
  exec "$BLENDER_BIN" --factory-startup --disable-autoexec --python-exit-code 1 "$@"
fi
TOOLS="$PROJECT/../.tools/blender"
if [[ -x "$TOOLS/blender-4.5.13-linux-x64/blender" ]]; then
  export LD_LIBRARY_PATH="$TOOLS/libs/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  exec "$TOOLS/blender-4.5.13-linux-x64/blender" --factory-startup --disable-autoexec --python-exit-code 1 "$@"
fi
exec blender --factory-startup --disable-autoexec --python-exit-code 1 "$@"
