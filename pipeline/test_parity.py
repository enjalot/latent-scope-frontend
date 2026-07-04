# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""Parity test: hit the ephemeral (`modal serve pipeline/modal_api.py`) endpoints
and the live production endpoints with identical requests and diff responses.

Usage:
    modal serve pipeline/modal_api.py     # in another terminal, wait for URLs
    uv run pipeline/test_parity.py [--db enjalot/ls-dadabase] [--scope scopes-001]

Production URLs:  https://enjalot--latent-scope-api-app-{fn}.modal.run
Ephemeral URLs:   https://enjalot--latent-scope-api-app-{fn}-dev.modal.run

Notes:
- calc-embedding / calc-sae are BROKEN on current production (it runs an old
  revision without those functions -> "modal-http: invalid function call"),
  so for those we validate the ephemeral response against the spec in
  FORMAT.md instead of diffing against live.
- nn embeds text with a model; distances can differ in low-order bits across
  hardware/library versions, so nn is compared with tolerances + rank overlap.
"""

import argparse
import json
import math
import sys

import requests

BASE = "https://enjalot--latent-scope-api-app-{fn}{suffix}.modal.run"

PASS, FAIL, WARN = "PASS", "FAIL", "WARN"
results = []


def report(name, status, detail=""):
    results.append((name, status, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""), flush=True)


def get(fn, suffix, params=None, timeout=180):
    url = BASE.format(fn=fn, suffix=suffix)
    r = requests.get(url, params=params, timeout=timeout)
    return r


def post(fn, suffix, body, timeout=180):
    url = BASE.format(fn=fn, suffix=suffix)
    return requests.post(url, json=body, timeout=timeout)


def deep_equal(a, b, rel_tol=1e-4, abs_tol=1e-5, path="$"):
    """Deep compare with float tolerance. Returns list of differences."""
    diffs = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                diffs.append(f"{path}.{k}: missing in ephemeral")
            elif k not in b:
                diffs.append(f"{path}.{k}: missing in live")
            else:
                diffs += deep_equal(a[k], b[k], rel_tol, abs_tol, f"{path}.{k}")
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            diffs.append(f"{path}: length {len(a)} != {len(b)}")
        else:
            for i, (x, y) in enumerate(zip(a, b)):
                diffs += deep_equal(x, y, rel_tol, abs_tol, f"{path}[{i}]")
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        if not math.isclose(a, b, rel_tol=rel_tol, abs_tol=abs_tol):
            diffs.append(f"{path}: {a} != {b}")
    elif a != b:
        diffs.append(f"{path}: {a!r} != {b!r}")
    return diffs[:20]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--db", default="enjalot/ls-dadabase")
    p.add_argument("--scope", default="scopes-001")
    p.add_argument("--dev-suffix", default="-dev", help="suffix of the modal serve URLs")
    p.add_argument("--live-suffix", default="", help="suffix of the production URLs")
    args = p.parse_args()
    dev, live = args.dev_suffix, args.live_suffix
    scope_params = {"db": args.db, "scope": args.scope}

    # ---- rows-by-index (exact diff) ----------------------------------------
    params = dict(scope_params, indices="0,1,2,100")
    try:
        r_dev = get("rows-by-index", dev, params)
        r_live = get("rows-by-index", live, params)
        d, l = r_dev.json(), r_live.json()
        diffs = deep_equal(d, l)
        report("rows-by-index", PASS if not diffs else FAIL, "; ".join(diffs))
    except Exception as e:
        report("rows-by-index", FAIL, repr(e))

    # ---- column-filter (exact diff) ----------------------------------------
    q = json.dumps([{"column": "score", "type": "gt", "value": 1000}])
    try:
        r_dev = get("column-filter", dev, dict(scope_params, query=q))
        r_live = get("column-filter", live, dict(scope_params, query=q))
        d, l = r_dev.json(), r_live.json()
        diffs = deep_equal(d, l)
        report("column-filter", PASS if not diffs else FAIL,
               f"{len(d)} rows" if not diffs else "; ".join(diffs))
    except Exception as e:
        report("column-filter", FAIL, repr(e))

    # ---- feature (set diff; order intentionally differs) --------------------
    # The recovered HEAD source sorts results by activation descending;
    # production runs an older revision that returns table order. Membership
    # is the contract (the frontend uses the list as a filter).
    params = dict(scope_params, feature="17469", threshold="0.15")
    try:
        r_dev = get("feature", dev, params)
        r_live = get("feature", live, params)
        d, l = r_dev.json(), r_live.json()
        same_set = set(d) == set(l)
        same_order = d == l
        detail = f"{len(d)} indices, sets equal={same_set}"
        if same_set and not same_order:
            detail += " (order differs: ephemeral sorts by activation per HEAD source)"
        report("feature", PASS if same_set else FAIL, detail)
    except Exception as e:
        report("feature", FAIL, repr(e))

    # ---- nn (tolerant: rank overlap + distance closeness) -------------------
    params = dict(scope_params, model="nomic-ai/nomic-embed-text-v1.5", query="dogs")
    try:
        r_dev = get("nn", dev, params)
        r_live = get("nn", live, params)
        d, l = r_dev.json(), r_live.json()
        ok = isinstance(d, list) and d and set(d[0]) == {"index", "_distance"}
        top_d = [x["index"] for x in d[:20]]
        top_l = [x["index"] for x in l[:20]]
        overlap = len(set(top_d) & set(top_l)) / 20
        dist_close = math.isclose(d[0]["_distance"], l[0]["_distance"], rel_tol=1e-2)
        detail = f"shape ok={ok}, top20 overlap={overlap:.0%}, len dev/live={len(d)}/{len(l)}, top1 dist {d[0]['_distance']:.4f}/{l[0]['_distance']:.4f}"
        status = PASS if (ok and overlap >= 0.8 and dist_close) else (WARN if ok and overlap >= 0.5 else FAIL)
        report("nn", status, detail)
    except Exception as e:
        report("nn", FAIL, repr(e))

    # ---- nn results=true (shape only, both) ---------------------------------
    params = dict(scope_params, model="nomic-ai/nomic-embed-text-v1.5", query="dogs", results="true")
    try:
        r_dev = get("nn", dev, params)
        d = r_dev.json()
        ok = isinstance(d, list) and len(d) == 100 and "index" in d[0] and "_distance" in d[0]
        report("nn?results=true (ephemeral shape)", PASS if ok else FAIL,
               f"{len(d)} rows, keys={sorted(d[0])[:8]}…" if isinstance(d, list) and d else str(d)[:100])
    except Exception as e:
        report("nn?results=true (ephemeral shape)", FAIL, repr(e))

    # ---- calc-embedding (live is broken; validate ephemeral vs spec) --------
    emb = None
    try:
        r_live = get("calc-embedding", live, {"query": "hello"})
        live_note = f"live HTTP {r_live.status_code} ({r_live.text[:40]!r})"
    except Exception as e:
        live_note = f"live error {e!r}"
    try:
        r_dev = get("calc-embedding", dev, {"query": "hello"})
        d = r_dev.json()
        expected = {"text", "token_ids", "tokens", "token_spans", "hidden_states",
                    "attention_mask", "embedding", "embedding_raw"}
        ok = expected <= set(d) and len(d["embedding"]) == 768
        norm = math.sqrt(sum(v * v for v in d["embedding"]))
        report("calc-embedding (ephemeral vs spec)", PASS if ok and abs(norm - 1) < 1e-3 else FAIL,
               f"keys ok={ok}, |embedding|={norm:.4f}; {live_note}")
    except Exception as e:
        report("calc-embedding (ephemeral vs spec)", FAIL, f"{e!r}; {live_note}")
        emb = None
    else:
        emb = d["embedding"] if ok else None

    # ---- calc-sae encode / decode / neighbors (ephemeral vs spec) -----------
    if emb:
        try:
            r = post("calc-sae", dev, {"embedding": emb})
            d = r.json()
            ok = set(d) == {"top_indices", "top_acts"} and len(d["top_indices"]) == len(d["top_acts"]) == 64
            report("calc-sae encode (ephemeral vs spec)", PASS if ok else FAIL,
                   f"64 top features={ok}")
            if ok:
                r2 = post("calc-sae", dev, {"features": d})
                dec = r2.json()
                ok2 = isinstance(dec, list) and len(dec) == 768
                report("calc-sae decode (ephemeral vs spec)", PASS if ok2 else FAIL,
                       f"len={len(dec) if isinstance(dec, list) else dec}")
            r3 = post("calc-sae", dev, {"neighbors": True, "db": args.db,
                                        "scope": args.scope, "embedding": emb})
            nb = r3.json()
            ok3 = isinstance(nb, list) and len(nb) == 100 and "_distance" in nb[0] and "index" in nb[0]
            report("calc-sae neighbors (ephemeral vs spec)", PASS if ok3 else FAIL,
                   f"{len(nb) if isinstance(nb, list) else nb} rows")
        except Exception as e:
            report("calc-sae (ephemeral)", FAIL, repr(e))
    else:
        report("calc-sae", WARN, "skipped (no embedding from calc-embedding)")

    print("\nSummary:")
    for name, status, detail in results:
        print(f"  [{status}] {name}")
    if any(s == FAIL for _, s, _ in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
