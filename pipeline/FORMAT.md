# latent.estate hosted scope format

Authoritative spec for the data the hosted frontend (this repo) consumes.
Recreated 2026-07-03 from the consumer code (`src/lib/apiService.js`,
`src/lib/scopes.js`, `src/lib/SAE.js`), the live GCS/Modal artifacts, and the
recovered original tooling (`github.com/enjalot/latent-scope-modal` —
`api/app.py`, `scripts/prep.py`, `scripts/upload.py`).

A "scope" is identified by the triple `{user}/{dataset}/{scope}`, e.g.
`enjalot/ls-dadabase/scopes-001` (see `src/lib/scopes.js`). Data comes from two
places:

1. **Static files** on GCS, publicly readable:
   `https://storage.googleapis.com/fun-data/latent-scope/demos/{user}/{dataset}/…`
2. **Modal API**, one URL per function:
   `https://enjalot--latent-scope-api-app-{fn}.modal.run` backed by LanceDB
   tables on the Modal volume `lancedb` at `/lancedb/{user}/{dataset}`, table
   name = `{scope}`.

Everything is produced from a local latent-scope dataset directory
(`$LATENT_SCOPE_DATA/{dataset}/`) by `pipeline/export_scope.py`.

---

## 1. Static GCS files

Base: `gs://fun-data/latent-scope/demos/{user}/{dataset}/` (served from
`https://storage.googleapis.com/fun-data/latent-scope/demos/{user}/{dataset}/`).

| file | purpose |
| --- | --- |
| `{scope}.json` | scope metadata (merged latent-scope scope json) |
| `{scope}.parquet` | one row per point: x/y, cluster, label, tile indices |
| `{scope}.bin` | hover text, fixed 1000 bytes per row, HTTP Range fetched |
| `{scope}.png` | home-page thumbnail |
| `{sae_id}_features.parquet` | per-dataset SAE feature stats (only if scope has an SAE) |
| `{scope}/atlas/{column}/…` | image scopes only: sprite-atlas pyramid (§4) |
| `{scope}/thumbs/{column}/{i}.webp` | image scopes only: per-row thumbnails (§4) |

### 1.1 `{scope}.json`

Consumed by `apiService.getScope()`. This is the **verbatim** scope json
written by latent-scope ≥ 0.6 (`latentscope/scripts/scope.py`) — a merged
document with the sub-step metadata embedded. Top-level keys (from the live
`enjalot/ls-dadabase/scopes-001.json` and a local 0.6 build — identical key
sets):

```
ls_version, id, embedding_id, umap_id, cluster_id, cluster_labels_id,
label, description, sae_id?, dataset, embedding, sae?, umap, cluster,
cluster_labels, cluster_labels_lookup, rows, columns, size, timestamp
```

Key sub-objects the frontend reads:

- `dataset`: `{ id, length, columns: [...], text_column, column_metadata: {col:
  { type: "string"|"number"|"image", unique_values_count, extent?, categories?,
  counts?, url?, image? }}, ls_version }`
- `embedding`: `{ id, model_id, text_column, dimensions, prefix, … }`.
  `model_id` looks like `🤗-nomic-ai___nomic-embed-text-v1.5`. The frontend
  derives the HF model name for the `nn` endpoint via
  `model_id.replace('___','/').split('-').slice(1).join('-')` →
  `nomic-ai/nomic-embed-text-v1.5`. (Image scopes:
  `clip-openai___clip-vit-base-patch32` → `openai/clip-vit-base-patch32`.)
- `sae` (optional): `{ id, model_id, k_expansion, num_features, … }` —
  `model_id`/`k_expansion` select the entry in `src/lib/SAE.js`
  (`enjalot/sae-nomic-text-v1.5-FineWeb-edu-100BT`, `64_32`).
- `cluster_labels_lookup`: array (index == cluster id) of
  `{ label, description, hull: [ls_index,…], cluster }`.
- `rows`: number of rows in `{scope}.parquet` **and** in `{scope}.bin`
  (`size_bytes(bin) == rows * 1000`).

The exporter copies `scopes/{scope}.json` as-is (plus the optional `images`
block for image scopes, §4.3). `label`/`description` should already be set on
the scope; `--label/--description` flags can override them at export time.

### 1.2 `{scope}.parquet`

Consumed by `apiService.getScopeRows()` via **hyparquet** (so: plain parquet,
no fancy logical types; snappy or uncompressed; pandas metadata is fine).
This is the verbatim `scopes/{scope}.parquet` written by latent-scope.
Live schema (dadabase):

| column | type | notes |
| --- | --- | --- |
| `x`, `y` | float32 | UMAP position, **normalized to [-1, 1]** |
| `tile_index_32` | int64 | legacy; newer scopes only have 64/128 (frontend `parseInt` → NaN tolerated) |
| `tile_index_64` | int64 | flat heatmap-grid cell index, `row*R + col` over [-1,1], see `make_tiles` in latent-scope `scope.py` |
| `tile_index_128` | int64 | 〃 |
| `cluster` | int64 | cluster id after noise-assignment (indexes `cluster_labels_lookup`) |
| `raw_cluster` | int64 | original cluster id, −1 = noise |
| `label` | string | cluster label text |
| `deleted` | bool | row curation flag |
| `ls_index` | int64 | original dataset row index. NOTE: the frontend **overwrites** `ls_index` with the row position `i`, so row order is the contract; hover/thumb index = position |

Row `i` of this parquet ↔ bytes `[i*1000, (i+1)*1000)` of `{scope}.bin` ↔
`thumbs/{column}/{i}.webp`. All published scopes have
`ls_index == range(rows)`; the exporter asserts this and refuses to export
otherwise (deleted-row scopes would break the positional contract).

### 1.3 `{scope}.bin`

Consumed by `apiService.getHoverText(index)` with
`Range: bytes=i*1000-(i+1)*1000-1`. Format (byte-identical to the original
`scripts/prep.py` output — verified against the live file):

- exactly **1000 bytes per row**, row order = parquet row order;
- content = the scope's text column (`embedding.text_column`; for image
  embeddings where that is the image column, fall back to
  `dataset.text_column`, e.g. `title`), UTF-8 encoded;
- `None` → empty string;
- **truncated at `encoded[:1000]`** — may split a multi-byte character; the
  frontend's `TextDecoder` renders U+FFFD, which is accepted/legacy behavior;
- padded with ASCII spaces (`0x20`) to 1000 bytes (frontend trims).

### 1.4 `{scope}.png`

Home-page thumbnail. Live example: 256×249 RGBA PNG, background `#fafafa`,
single-hue tan/copper dots with alpha, no axes/margins. The exporter renders a
you-are-here style matplotlib scatter: square ~256 px, `#fafafa` background,
small dots colored by `cluster` (muted categorical colors at low alpha so the
overall vibe matches the existing monochrome thumbs), axes off.

### 1.5 `{sae_id}_features.parquet` (per-dataset SAE stats)

Uploaded when the scope json has `sae_id` (source:
`{dataset}/saes/{sae_id}_features.parquet`). Consumed by
`apiService.getDatasetFeatures()` (hyparquet, rowFormat object). Schema:

| column | type |
| --- | --- |
| `feature_id` | int64 |
| `max_activation` | float32 |
| `count` | int64 |
| `avg_activation` | float64 |

(One row per SAE feature, e.g. 24576.)

---

## 2. Shared SAE model assets (documented; NOT produced by exporter v1)

`src/lib/SAE.js` points at `gs://fun-data/latent-scope/sae/{MODEL_LABEL}/`
(e.g. `NOMIC_FWEDU_25k`) — these are per-SAE-model, shared across datasets:

- `features.parquet` — consumed **positionally** by
  `apiService.getSaeFeatures()` (hyparquet default array rows):
  col 0 `feature` (int), col 1 `max_activation`, col 6 `label`, col 7 `order`,
  col 8 `grid_x`, col 9 `grid_y`. (Same layout as
  latent-taxonomy `models/{label}/features.parquet`.)
- `samples/chunk_mapping.json` — `{ "feature_id": chunk_number, … }` mapping
  each feature to the chunk file that holds its top samples.
- `samples/chunk_{N}.parquet` — top-activating samples; consumed with
  rowFormat object, must include a `feature` column (int; the consumer filters
  rows by it) plus the sample display columns (text, activation, id, …).
- `wikipedia_samples/` — same layout, alternate corpus (keyed by
  `saeMeta[sample]` where `sample` ∈ {`samples`,`wikipedia_samples`}).

These come from the latent-taxonomy pipeline; exporter v1 does not build them.

---

## 3. Modal API contract

App name **`latent-scope-api`**, single `@app.cls` named **`App`** so deployed
URLs are `https://enjalot--latent-scope-api-app-{fn}.modal.run` (Modal label =
`{app}-{class}-{method}`, underscores → hyphens). `modal serve` adds a `-dev`
suffix (the frontend's `dev` constant in apiService.js).

CORS: Modal's built-in FastAPI wrapper already reflects any `Origin` with
`access-control-allow-origin` and answers OPTIONS preflights (verified against
production — no custom CORS code needed).

Backing store: Modal volume **`lancedb`** mounted at `/lancedb`, database dir
`/lancedb/{user}/{dataset}`, table `{scope}`. Table schema = latent-scope
`export_lance()` output = the dataset's original columns joined with the scope
columns plus:

- `index` (int64, original row index — equals the frontend `ls_index`),
- `x`,`y`,`tile_index_*`,`cluster`,`raw_cluster`,`label`,`deleted`,
- `vector` (FixedSizeList<float32>[dim], cosine; see index note below),
- `sae_indices` (list<int>), `sae_acts` (list<float>) when the scope has an SAE.

**Vector index note:** text-embedding scopes ship with the IVF_PQ index
latent-scope builds. Image scopes (CLIP) must **NOT** — the `nn` endpoint sends
*text* queries against *image* vectors, and across CLIP's modality gap those
queries are out-of-distribution for the PQ codebooks: measured on
marqo-ge-sample, IVF_PQ returned junk at distance ≈1.16 (even with
nprobes=256 + refine_factor=20) where exact search finds matches at 0.72.
Drop the index (`table.drop_index("vector_idx")`) and let LanceDB flat-scan;
20k×512 exact search is ~20 ms. Revisit only past ~1M rows (exact index types
or re-ranking, not PQ).

**Volume freshness:** warm API containers see the volume as of container
start; `get_table` reloads the volume and retries once when a table is
missing, so a freshly uploaded scope is queryable without a redeploy.
(*Replacing* an existing table is different: a warm container's cached handle
survives until it scales down — ≤5 min idle — or the app is redeployed.)

**Lance format compat:** the image pins `lancedb==0.30.1` + `pylance==0.39.0`
to match the local writer. Older unpinned resolutions (forced by `numpy<2`)
cannot even list tables written with V2 manifest paths — the failure mode is
`Table 'X' was not found`, not a format error.

Query params below are query-string unless noted. `db = {user}/{dataset}`.

### 3.1 `GET rows-by-index`
`?db&scope&indices=1,2,3` → JSON array of full row objects (every table column
**except** `vector`, and except binary/image columns — see §4.4), in the order
requested. Example row (dadabase): `{index, author, url, joke, score, date, x,
y, tile_index_32, tile_index_64, tile_index_128, cluster, raw_cluster, label,
deleted, sae_indices: [int…64], sae_acts: [float…64]}`.

### 3.2 `GET nn`
`?db&scope&model={hf_model}&query={text}&results={bool?}` — embeds `query`
with the scope's embedding model (`normalize_embeddings=True`; the model's
query prefix, e.g. nomic `search_query: `, is NOT added — parity with
original), cosine ANN search.
- default: `[{ "index": int, "_distance": float }, …]` (large limit; the ANN
  index effectively caps result count)
- `results=true`: full rows (all columns incl. vector), limit 100.

### 3.3 `GET feature`
`?db&scope&feature={int}&threshold={float}` → JSON array of **row indices**
(ints) whose `sae_indices` contain the feature with activation > threshold,
sorted by activation descending. (The currently-deployed production revision
predates the sort and returns table order; membership is identical and the
frontend consumes the list as a filter.)

### 3.4 `GET column-filter`
`?db&scope&query={urlencoded JSON}` where query is
`[{column, type: eq|gt|lt|gte|lte|in|contains, value}, …]` (ANDed) →
`[{ "index": int }, …]`.

### 3.5 `GET calc-embedding`
`?query={text}` → nomic-embed-text-v1.5 tokenization + embedding:
```
{ text: [q], token_ids: [int], tokens: [str], token_spans: [[s,e],…],
  hidden_states: [[[float]]], attention_mask: [int],
  embedding: [float×768] (L2-normalized), embedding_raw: [float×768] }
```
(NOTE: broken on the currently-deployed production app — returns
`modal-http: invalid function call`; production is running an older revision.
This spec matches the recovered source + `apiService.calcTokenizedEmbeddings`.)

### 3.6 `POST calc-sae`
JSON body, three modes (also broken in current production, same reason):
- `{embedding: [float×768]}` → `{top_indices: [...], top_acts: [...]}` (SAE
  encode, `enjalot/sae-nomic-text-v1.5-FineWeb-edu-100BT` k=64_32)
- `{features: {top_acts, top_indices}}` → `[float×768]` (SAE decode/steering)
- `{neighbors: true, db, scope, embedding}` → full-row ANN results, limit 100
  (frontend maps `_distance` → `ls_distance`).

---

## 4. Image-scope extension (new; designed for marqo-ge-sample)

Image datasets (latent-scope `column_metadata[col].type == "image"`, column
stored as HF-style `struct<bytes,path>`) add two static asset sets under the
scope's directory, and one scope.json block. Nothing else changes: the map
parquet, .bin (text column, e.g. `title`) and API behave as for text scopes.

### 4.1 Atlas pyramid

The local build (`latentscope/scripts/sprite_atlas.py`) is uploaded **as-is**
(same relative layout, so local and hosted loaders share code):

```
demos/{user}/{dataset}/{scope}/atlas/{column}/manifest.json
demos/{user}/{dataset}/{scope}/atlas/{column}/r{R}/t{tx}_{ty}/sheet_{k:03}.webp
```

- `manifest.json` = the generator's manifest, verbatim: `{scope_id, column,
  cell_size, samples, tile_px, domain: [-1,1], resolutions: [{num_tiles,
  cell_size, tile_px, tile_cells, tiles_per_axis, full_px, filled_cells,
  tiles: [{tx, ty, filled_cells}]}], input_fingerprint, complete}`.
  Only tiles listed in `resolutions[].tiles` exist — the frontend must not
  request others.
- Grid semantics: resolution `R` is an R×R grid over x,y ∈ [-1,1]
  (`col = ⌊(x+1)/(2/R)⌋`, `row = ⌊(y+1)/(2/R)⌋`, clamped). Sheets are
  image-space: `row_img = R-1-row` (y flipped). A tile covers `tile_cells`
  (= `tile_px // cell_size`, 64 by default) cells per axis;
  `tx = col // tile_cells`, `ty = row_img // tile_cells`; within a sheet the
  cell's pixel origin is `((col % tile_cells) * cell_size,
  (row_img % tile_cells) * cell_size)`. `sheet_{k}` holds the (k+1)-th sample
  image per cell (`samples` sheets total).

### 4.2 Per-row thumbnails

For hover/table/selected-rows UI. Decision: **individual webp files** (not
sprite sheets, not data-URLs in rows): the frontend fetches rows sparsely by
index, files are tiny (~3–6 KB), GCS/CDN handles 20k objects fine, and it keeps
`.bin` text-only and `rows-by-index` JSON-only.

```
demos/{user}/{dataset}/{scope}/thumbs/{column}/{i}.webp
```

- `i` = **row position in `{scope}.parquet`** (== frontend `ls_index`, == the
  `.bin` stride index, == the LanceDB `index` for published scopes; exporter
  enforces the equality, §1.2).
- 128 px max dimension (aspect preserved), WebP quality 80, RGB.
- Rows with null/undecodable images have **no file**; the frontend should
  handle 404/403 (GCS returns 403 for missing objects) with a placeholder.
  The exporter also writes `thumbs/{column}/manifest.json`:
  `{column, size, count, total, missing: [i,…], format: "webp"}`.

### 4.3 scope.json `images` block

The exporter appends this to the copied scope json so the frontend can detect
image scopes without probing:

```json
"images": {
  "columns": ["image"],
  "atlas": {
    "image": { "path": "{scope}/atlas/image/", "manifest": "{scope}/atlas/image/manifest.json" }
  },
  "thumbs": {
    "image": { "template": "{scope}/thumbs/image/{index}.webp", "size": 128, "format": "webp" }
  }
}
```

Paths are **relative to `demos/{user}/{dataset}/`**; `{index}` in the template
is the row position (frontend `ls_index`). Column-level detection stays
`dataset.column_metadata[col].type === "image"` (with `image: true`); the
`images` block says where the assets live.

### 4.4 API behavior for image columns

`rows-by-index` (and `nn?results=true` / `calc-sae neighbors`) must **exclude**
binary columns (any column whose Arrow type is/contains `binary`, e.g. the HF
`struct<bytes,path>` image struct) — raw image bytes are not JSON-serializable
and would bloat responses. The frontend renders the image cell from the thumb
template + `index`. All other columns (`title`, `item_ID`, …) pass through
unchanged.

---

## 5. Naming conventions

- `{user}` — HF-style username (`enjalot`, `jzhang621`).
- `{dataset}` — dataset directory name; hosted demos historically prefix
  `ls-` (`ls-dadabase`). `export_scope.py --dataset-name` overrides the
  directory basename for output naming.
- `{scope}` — latent-scope scope id (`scopes-001`).
- Scope registry: add `{user}/{dataset}/{scope}` to `src/lib/scopes.js` with
  `label`, `description`, `dataUrl`.
