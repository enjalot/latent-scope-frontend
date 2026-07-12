# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pandas",
#   "pyarrow",
#   "numpy",
#   "matplotlib",
#   "pillow",
# ]
# ///
"""Export a local latent-scope scope into the hosted latent.estate demos format.

Produces the exact static file set served from
gs://fun-data/latent-scope/demos/{user}/{dataset}/ (see pipeline/FORMAT.md):

    {scope}.json                     scope metadata (verbatim + optional images block)
    {scope}.parquet                  per-row map data (verbatim copy, validated)
    {scope}.bin                      hover text, fixed 1000 bytes/row
    {scope}.png                      home-page thumbnail
    {sae_id}_features.parquet        if the scope has an SAE
    {scope}/atlas/{column}/...       image scopes: sprite-atlas pyramid (copied)
    {scope}/thumbs/{column}/{i}.webp image scopes: per-row thumbnails

Usage:
    uv run pipeline/export_scope.py /data/latent-scope/marqo-ge-sample scopes-001 \
        --user enjalot --out pipeline/out

Then publish with pipeline/upload.sh.
"""

import argparse
import io
import json
import os
import shutil
import sys

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

BIN_ROW_BYTES = 1000
THUMB_BG = "#fafafa"


def log(msg):
    print(msg, flush=True)


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# scope.json


def load_scope_meta(dataset_dir, scope_id):
    path = os.path.join(dataset_dir, "scopes", f"{scope_id}.json")
    if not os.path.exists(path):
        fail(f"scope json not found: {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def image_columns(meta):
    """Columns declared as images in the dataset's column_metadata."""
    cm = (meta.get("dataset") or {}).get("column_metadata") or {}
    return [c for c, m in cm.items() if isinstance(m, dict) and m.get("type") == "image"]


def pick_text_column(meta, override=None):
    """The column serialized into {scope}.bin (hover text).

    Original prep.py used embedding.text_column; for image embeddings that is
    the image column, so fall back to dataset.text_column (e.g. 'title').
    """
    if override:
        return override
    img_cols = set(image_columns(meta))
    emb_col = (meta.get("embedding") or {}).get("text_column")
    if emb_col and emb_col not in img_cols:
        return emb_col
    ds_col = (meta.get("dataset") or {}).get("text_column")
    if ds_col and ds_col not in img_cols:
        return ds_col
    fail("could not determine a text column for the .bin (use --text-column)")


# ---------------------------------------------------------------------------
# {scope}.parquet


def export_parquet(dataset_dir, scope_id, out_dir):
    src = os.path.join(dataset_dir, "scopes", f"{scope_id}.parquet")
    if not os.path.exists(src):
        fail(f"scope parquet not found: {src}")
    dst = os.path.join(out_dir, f"{scope_id}.parquet")

    table = pq.read_table(src)
    names = table.column_names
    required = {"x", "y", "cluster", "raw_cluster", "label", "deleted", "ls_index"}
    missing = required - set(names)
    if missing:
        fail(f"{src} is missing required columns: {sorted(missing)}")
    if not any(n.startswith("tile_index_") for n in names):
        log(f"  WARNING: no tile_index_* columns in {src}")

    # Positional contract: row i <-> bin row i <-> thumbs/{i}.webp. The hosted
    # frontend overwrites ls_index with the row position, so exporting a scope
    # where they diverge (deleted/reordered rows) would silently mismatch.
    ls_index = table.column("ls_index").to_numpy()
    if not (ls_index == np.arange(len(ls_index))).all():
        fail(
            "ls_index != row position; hosted format requires ls_index == range(rows) "
            "(scopes with deleted rows are not supported)"
        )

    # Token scopes: join the char spans (highlighting offsets into the parent
    # text) from {scope}-input.parquet — scope.py keeps them out of the scope
    # parquet, but the hosted frontend is static and needs them client-side.
    if {"parent_index", "token_str"} <= set(names) and "char_start" not in names:
        input_src = os.path.join(dataset_dir, "scopes", f"{scope_id}-input.parquet")
        if os.path.exists(input_src):
            spans = pq.read_table(input_src, columns=["char_start", "char_end"])
            if spans.num_rows == table.num_rows:
                table = table.append_column("char_start", spans.column("char_start"))
                table = table.append_column("char_end", spans.column("char_end"))
                pq.write_table(table, dst)
                return table.num_rows, table.column_names
            log(f"  WARNING: {input_src} rows != scope rows; char spans not joined")

    shutil.copyfile(src, dst)
    return table.num_rows, names


# ---------------------------------------------------------------------------
# {scope}.bin


def load_text_series(dataset_dir, scope_id, text_column, expected_rows):
    """Text column in scope-row order. Prefer {scope}-input.parquet (already
    filtered/joined to the scope); fall back to input.parquet."""
    for name in (os.path.join("scopes", f"{scope_id}-input.parquet"), "input.parquet"):
        path = os.path.join(dataset_dir, name)
        if not os.path.exists(path):
            continue
        pf = pq.ParquetFile(path)
        if text_column not in pf.schema_arrow.names:
            continue
        if pf.metadata.num_rows != expected_rows:
            log(
                f"  WARNING: {name} has {pf.metadata.num_rows} rows, scope has "
                f"{expected_rows}; skipping this source"
            )
            continue
        return pf.read(columns=[text_column]).column(text_column).to_pylist()
    fail(f"no parquet with column '{text_column}' and {expected_rows} rows found")


def export_bin(dataset_dir, scope_id, out_dir, text_column, expected_rows):
    """Fixed 1000-byte-per-row UTF-8 text file (byte-compatible with the
    original scripts/prep.py: truncate encoded[:1000], pad with spaces)."""
    values = load_text_series(dataset_dir, scope_id, text_column, expected_rows)
    dst = os.path.join(out_dir, f"{scope_id}.bin")
    with open(dst, "wb") as f:
        for value in values:
            if value is None or (isinstance(value, float) and np.isnan(value)):
                value = ""
            encoded = str(value).encode("utf-8")
            if len(encoded) > BIN_ROW_BYTES:
                encoded = encoded[:BIN_ROW_BYTES]
            else:
                encoded = encoded + b" " * (BIN_ROW_BYTES - len(encoded))
            f.write(encoded)
    size = os.path.getsize(dst)
    assert size == expected_rows * BIN_ROW_BYTES, (size, expected_rows)
    return dst


# ---------------------------------------------------------------------------
# {scope}.png thumbnail


def export_thumbnail(dataset_dir, scope_id, out_dir, px=256):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    src = os.path.join(dataset_dir, "scopes", f"{scope_id}.parquet")
    df = pq.read_table(src, columns=["x", "y", "cluster"]).to_pandas()
    n = len(df)

    # muted categorical colors per cluster; low alpha + small dots to match
    # the vibe of the existing thumbs (white bg, airy scatter)
    cmap = plt.get_cmap("tab20")
    colors = cmap(df["cluster"].to_numpy() % 20)

    dot = max(0.4, min(4.0, 40000.0 / max(n, 1)))
    fig = plt.figure(figsize=(px / 100, px / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor(THUMB_BG)
    fig.patch.set_facecolor(THUMB_BG)
    ax.scatter(df["x"], df["y"], s=dot, c=colors, alpha=0.3, linewidths=0)
    ax.set_xlim(-1.05, 1.05)
    ax.set_ylim(-1.05, 1.05)
    ax.set_aspect("equal")
    ax.axis("off")
    dst = os.path.join(out_dir, f"{scope_id}.png")
    fig.savefig(dst, dpi=100, facecolor=THUMB_BG)
    plt.close(fig)
    return dst


# ---------------------------------------------------------------------------
# SAE features parquet


def export_sae_features(dataset_dir, meta, out_dir):
    sae_id = meta.get("sae_id")
    if not sae_id:
        return None
    src = os.path.join(dataset_dir, "saes", f"{sae_id}_features.parquet")
    if not os.path.exists(src):
        log(f"  WARNING: scope has sae_id={sae_id} but {src} is missing; skipping")
        return None
    dst = os.path.join(out_dir, f"{sae_id}_features.parquet")
    shutil.copyfile(src, dst)
    return dst


# ---------------------------------------------------------------------------
# image scopes: atlas + per-row thumbs


def export_atlas(dataset_dir, scope_id, out_dir, column):
    src = os.path.join(dataset_dir, "scopes", "atlases", scope_id, column)
    manifest = os.path.join(src, "manifest.json")
    if not os.path.exists(manifest):
        log(f"  WARNING: no atlas for column '{column}' at {src}; skipping atlas")
        return None
    dst = os.path.join(out_dir, scope_id, "atlas", column)
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    n = sum(len(files) for _, _, files in os.walk(dst))
    log(f"  atlas: copied {n} files -> {dst}")
    return dst


def _image_bytes(value):
    """HF-style {'bytes': ...} struct, raw bytes, or None."""
    if isinstance(value, dict):
        value = value.get("bytes")
    if isinstance(value, bytearray):
        value = bytes(value)
    if not isinstance(value, bytes) or len(value) == 0:
        return None
    return value


def export_row_thumbs(dataset_dir, scope_id, out_dir, column, expected_rows,
                      size=128, quality=80):
    from PIL import Image

    src = os.path.join(dataset_dir, "scopes", f"{scope_id}-input.parquet")
    if not os.path.exists(src):
        src = os.path.join(dataset_dir, "input.parquet")
    pf = pq.ParquetFile(src)
    if pf.metadata.num_rows != expected_rows:
        fail(
            f"thumb source {src} has {pf.metadata.num_rows} rows, "
            f"scope has {expected_rows}"
        )
    dst_dir = os.path.join(out_dir, scope_id, "thumbs", column)
    os.makedirs(dst_dir, exist_ok=True)

    i = 0
    written = 0
    missing = []
    for batch in pf.iter_batches(batch_size=512, columns=[column]):
        for value in batch.column(0).to_pylist():
            raw = _image_bytes(value)
            img = None
            if raw is not None:
                try:
                    img = Image.open(io.BytesIO(raw)).convert("RGB")
                    img.thumbnail((size, size))
                except Exception:
                    img = None
            if img is None:
                missing.append(i)
            else:
                img.save(os.path.join(dst_dir, f"{i}.webp"), format="WEBP", quality=quality)
                written += 1
            i += 1
    manifest = {
        "column": column,
        "size": size,
        "count": written,
        "total": i,
        "missing": missing,
        "format": "webp",
    }
    with open(os.path.join(dst_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f)
    log(f"  thumbs: {written}/{i} written ({len(missing)} missing) -> {dst_dir}")
    return manifest


def build_images_block(scope_id, columns, atlas_ok, thumbs_meta, size=128):
    block = {"columns": columns, "atlas": {}, "thumbs": {}}
    for col in columns:
        if atlas_ok.get(col):
            block["atlas"][col] = {
                "path": f"{scope_id}/atlas/{col}/",
                "manifest": f"{scope_id}/atlas/{col}/manifest.json",
            }
        if thumbs_meta.get(col):
            block["thumbs"][col] = {
                "template": f"{scope_id}/thumbs/{col}/{{index}}.webp",
                "size": thumbs_meta[col]["size"],
                "format": "webp",
            }
    return block


# ---------------------------------------------------------------------------
# validation


def validate(out_dir, scope_id, meta):
    """Round-trip the exported artifacts and cross-check the contract."""
    problems = []
    json_path = os.path.join(out_dir, f"{scope_id}.json")
    with open(json_path, encoding="utf-8") as f:
        exported = json.load(f)

    table = pq.read_table(os.path.join(out_dir, f"{scope_id}.parquet"))
    rows = table.num_rows
    if exported.get("rows") != rows:
        problems.append(f"json rows={exported.get('rows')} != parquet rows={rows}")

    bin_rows = rows
    if exported.get("granularity") == "tokens":
        # token scopes: .bin covers the parent documents, not the token rows
        bin_rows = int((exported.get("dataset") or {}).get("length") or rows)
    bin_size = os.path.getsize(os.path.join(out_dir, f"{scope_id}.bin"))
    if bin_size != bin_rows * BIN_ROW_BYTES:
        problems.append(f"bin size {bin_size} != rows*1000 ({bin_rows * BIN_ROW_BYTES}")

    # spot-check bin decoding of first/last rows
    with open(os.path.join(out_dir, f"{scope_id}.bin"), "rb") as f:
        for i in (0, bin_rows - 1):
            f.seek(i * BIN_ROW_BYTES)
            chunk = f.read(BIN_ROW_BYTES)
            chunk.decode("utf-8", errors="replace")

    lookup = exported.get("cluster_labels_lookup") or []
    n_clusters = int(table.column("cluster").to_numpy().max()) + 1
    if lookup and len(lookup) < n_clusters:
        problems.append(
            f"cluster_labels_lookup has {len(lookup)} entries < max cluster+1 ({n_clusters})"
        )
    return problems


# ---------------------------------------------------------------------------


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("dataset_dir", help="latent-scope dataset dir, e.g. /data/latent-scope/marqo-ge-sample")
    p.add_argument("scope_id", help="scope id, e.g. scopes-001")
    p.add_argument("--user", default="enjalot", help="username namespace in demos/ (default: enjalot)")
    p.add_argument("--out", default="pipeline/out", help="output root (default: pipeline/out)")
    p.add_argument("--dataset-name", default=None,
                   help="override output dataset name (default: dataset dir basename)")
    p.add_argument("--label", default=None, help="override scope label in exported json")
    p.add_argument("--description", default=None, help="override scope description")
    p.add_argument("--text-column", default=None, help="override .bin text column")
    p.add_argument("--thumb-size", type=int, default=128, help="per-row thumb max px (default 128)")
    p.add_argument("--thumb-quality", type=int, default=80, help="per-row thumb webp quality (default 80)")
    p.add_argument("--skip-thumbs", action="store_true", help="skip per-row image thumbnails")
    p.add_argument("--skip-atlas", action="store_true", help="skip atlas pyramid copy")
    args = p.parse_args()

    dataset_dir = os.path.abspath(args.dataset_dir)
    scope_id = args.scope_id
    dataset_name = args.dataset_name or os.path.basename(dataset_dir.rstrip("/"))
    out_dir = os.path.join(os.path.abspath(args.out), args.user, dataset_name)
    os.makedirs(out_dir, exist_ok=True)

    log(f"Exporting {dataset_dir} / {scope_id} -> {out_dir}")
    meta = load_scope_meta(dataset_dir, scope_id)
    if args.label:
        meta["label"] = args.label
    if args.description:
        meta["description"] = args.description

    rows, columns = export_parquet(dataset_dir, scope_id, out_dir)
    log(f"  parquet: {rows} rows, columns={columns}")

    text_column = pick_text_column(meta, args.text_column)
    # Token scopes (granularity: "tokens") have one parquet row per TOKEN, but
    # hover/snippet text belongs to the parent documents: the .bin is written
    # over the dataset's rows and addressed by the parquet's parent_index.
    bin_rows = rows
    if meta.get("granularity") == "tokens":
        input_pf = pq.ParquetFile(os.path.join(dataset_dir, "input.parquet"))
        bin_rows = input_pf.metadata.num_rows
        log(f"  token scope: .bin over {bin_rows} parent documents (parquet rows are tokens)")
    export_bin(dataset_dir, scope_id, out_dir, text_column, bin_rows)
    log(f"  bin: {bin_rows} rows x {BIN_ROW_BYTES} bytes from column '{text_column}'")

    export_thumbnail(dataset_dir, scope_id, out_dir)
    log(f"  png: {scope_id}.png")

    sae_path = export_sae_features(dataset_dir, meta, out_dir)
    if sae_path:
        log(f"  sae features: {os.path.basename(sae_path)}")

    img_cols = image_columns(meta)
    if img_cols:
        log(f"  image columns: {img_cols}")
        atlas_ok, thumbs_meta = {}, {}
        for col in img_cols:
            if not args.skip_atlas:
                atlas_ok[col] = bool(export_atlas(dataset_dir, scope_id, out_dir, col))
            if not args.skip_thumbs:
                thumbs_meta[col] = export_row_thumbs(
                    dataset_dir, scope_id, out_dir, col, rows,
                    size=args.thumb_size, quality=args.thumb_quality,
                )
        meta["images"] = build_images_block(scope_id, img_cols, atlas_ok, thumbs_meta)

    with open(os.path.join(out_dir, f"{scope_id}.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    log(f"  json: {scope_id}.json")

    problems = validate(out_dir, scope_id, meta)
    if problems:
        for prob in problems:
            log(f"  VALIDATION PROBLEM: {prob}")
        sys.exit(1)
    log("  validation: OK")
    log(f"Done. Publish with: bash pipeline/upload.sh {args.user} {dataset_name} {scope_id}")


if __name__ == "__main__":
    main()
