#!/usr/bin/env bash
# Publish an exported scope (from export_scope.py) to GCS + the Modal lancedb volume.
#
# Usage:
#   bash pipeline/upload.sh <user> <dataset> <scope_id> [--apply] [--out DIR] [--data DIR]
#
#   <user>      demos namespace, e.g. enjalot
#   <dataset>   dataset name as exported (out/<user>/<dataset>), e.g. marqo-ge-sample
#   <scope_id>  e.g. scopes-001
#   --apply     actually upload; DEFAULT IS DRY-RUN (prints/uses gsutil -n)
#   --out DIR   export root (default: pipeline/out)
#   --data DIR  local latent-scope data dir holding <dataset>/lancedb
#               (default: /data/latent-scope) — used for the Modal volume upload
#
# Requires: gcloud auth with write access to gs://fun-data, modal CLI logged in.
set -euo pipefail

USER_NS="${1:?usage: upload.sh <user> <dataset> <scope_id> [--apply]}"
DATASET="${2:?usage: upload.sh <user> <dataset> <scope_id> [--apply]}"
SCOPE="${3:?usage: upload.sh <user> <dataset> <scope_id> [--apply]}"
shift 3

APPLY=0
OUT_ROOT="pipeline/out"
DATA_ROOT="/data/latent-scope"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --out) OUT_ROOT="$2"; shift ;;
    --data) DATA_ROOT="$2"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

SRC="$OUT_ROOT/$USER_NS/$DATASET"
DST="gs://fun-data/latent-scope/demos/$USER_NS/$DATASET"
[[ -f "$SRC/$SCOPE.json" ]] || { echo "missing $SRC/$SCOPE.json — run export_scope.py first" >&2; exit 1; }

run() {
  # dry-run prints the exact command; --apply executes it.
  # (a plain `gsutil rsync -n` still needs gcloud auth to list the bucket,
  #  so the dry-run is auth-free by design)
  if [[ "$APPLY" -eq 1 ]]; then
    echo "+ $*"
    "$@"
  else
    echo "DRY: $*"
  fi
}

if [[ "$APPLY" -ne 1 ]]; then
  echo "== DRY RUN (pass --apply to upload) =="
fi

# 1) flat scope files ({scope}.json/.parquet/.bin/.png, {sae}_features.parquet).
#    rsync is non-recursive here on purpose: the atlas/thumbs live under
#    $SCOPE/ and are synced separately below. Only this scope's files sync
#    (-x excludes the rest) so unpublished sibling exports in out/ don't
#    upload. Short cache so scope updates propagate through the GCS/CDN
#    edge in minutes.
run gsutil -m -h "Cache-Control:public, max-age=3600" rsync -x "^(?!${SCOPE}\.).*" "$SRC" "$DST"

# 2) image-scope assets (atlas pyramid + per-row thumbs), if exported.
#    These are immutable per-export; give them a long cache.
if [[ -d "$SRC/$SCOPE" ]]; then
  run gsutil -m -h "Cache-Control:public, max-age=86400" rsync -r "$SRC/$SCOPE" "$DST/$SCOPE"
fi

# 3) LanceDB table -> Modal volume (backs the latent-scope-api endpoints).
#    latent-scope >= 0.6 writes {dataset}/lancedb/{scope}.lance via export_lance().
LANCE_SRC="$DATA_ROOT/$DATASET/lancedb"
if [[ -d "$LANCE_SRC/$SCOPE.lance" ]]; then
  # Only this scope's table — the local lancedb dir also holds embedding
  # tables and superseded scopes that would multiply volume storage cost.
  run modal volume rm lancedb "$USER_NS/$DATASET/$SCOPE.lance" -r || true  # ok if absent
  run modal volume put lancedb "$LANCE_SRC/$SCOPE.lance" "$USER_NS/$DATASET/$SCOPE.lance"
else
  echo "NOTE: no LanceDB table at $LANCE_SRC/$SCOPE.lance — API endpoints will 500 for this scope."
  echo "      Run latent-scope's scope export (export_lance) first."
fi

echo "Done. Frontend URL id: $USER_NS/$DATASET/$SCOPE (add to src/lib/scopes.js)"
