#!/usr/bin/env python3
"""Build the LanceDB table that backs the SAE feature/rows-by-index endpoints
for a TOKEN scope (granularity: "tokens").

latent-scope's `ls-scope` skips `export_lance()` for token scopes (scoped
vector search isn't supported at token granularity), so the hosted Modal API
has no table for them. This builds a minimal one — `index` (the token index,
== the scope parquet's ls_index), `sae_indices`, `sae_acts` — from the token
SAE h5. No `vector` column: token scopes don't do NN search, and 1.77M x 128
vectors would be ~900 MB of dead weight.

The h5 is written in token_index order by `ls-sae --granularity tokens`, so
h5 row i == token index i == scope parquet ls_index i (asserted below).

Usage:
    uv run pipeline/build_token_sae_lance.py \
        /data/latent-scope/dadabase scopes-003 sae-003

Then upload the table with the same step upload.sh uses:
    modal volume put lancedb \
        /data/latent-scope/dadabase/lancedb/scopes-003.lance \
        <user>/<dataset>/scopes-003.lance
"""
import argparse
import os
import shutil
import sys


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("dataset_dir", help="latent-scope dataset dir, e.g. /data/latent-scope/dadabase")
    p.add_argument("scope_id", help="token scope id, e.g. scopes-003")
    p.add_argument("sae_id", help="token SAE id, e.g. sae-003")
    args = p.parse_args()

    import h5py
    import lancedb
    import numpy as np
    import pandas as pd
    import pyarrow as pa

    scope_pq = os.path.join(args.dataset_dir, "scopes", f"{args.scope_id}.parquet")
    sae_h5 = os.path.join(args.dataset_dir, "saes", f"{args.sae_id}.h5")
    lancedb_dir = os.path.join(args.dataset_dir, "lancedb")

    ls_index = pd.read_parquet(scope_pq, columns=["ls_index"])["ls_index"].to_numpy()
    with h5py.File(sae_h5) as f:
        top_idx = f["top_indices"][:].astype(np.int64)   # match row-scope schema (int64)
        top_act = f["top_acts"][:].astype(np.float64)    # match row-scope schema (double)

    n, k = top_idx.shape
    if len(ls_index) != n:
        sys.exit(f"scope has {len(ls_index)} rows but SAE h5 has {n}; mismatched scope/sae")
    if not (ls_index == np.arange(n)).all():
        sys.exit("ls_index != row position; token scope expected ls_index == range(rows)")

    def list_col(flat_2d, pa_type):
        flat = pa.array(flat_2d.reshape(-1), pa_type)
        offsets = pa.array(np.arange(0, (n + 1) * k, k, dtype=np.int32))
        return pa.ListArray.from_arrays(offsets, flat)

    table = pa.table({
        "index": pa.array(np.arange(n, dtype=np.int64)),
        "sae_indices": list_col(top_idx, pa.int64()),
        "sae_acts": list_col(top_act, pa.float64()),
    })

    tbl_path = os.path.join(lancedb_dir, f"{args.scope_id}.lance")
    if os.path.exists(tbl_path):
        shutil.rmtree(tbl_path)
    db = lancedb.connect(lancedb_dir)
    db.create_table(args.scope_id, table)
    print(f"built {args.scope_id}.lance: {n} rows x {k} features -> {tbl_path}")
    print(f"upload: modal volume put lancedb {tbl_path} <user>/<dataset>/{args.scope_id}.lance")


if __name__ == "__main__":
    main()
