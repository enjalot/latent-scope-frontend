# latent.estate publish pipeline

Tooling to publish a local [latent-scope](https://github.com/enjalot/latent-scope)
scope to the hosted frontend (latent.estate). Recreated 2026-07 from the
consumer contract and live artifacts; the original (partial) tooling survives at
[enjalot/latent-scope-modal](https://github.com/enjalot/latent-scope-modal) and
this pipeline is byte-compatible with it.

**Read `FORMAT.md` first** — it is the authoritative spec for the static file
formats, the Modal API contract, and the image-scope extension.

## Files

| file | what |
| --- | --- |
| `FORMAT.md` | format + API spec (the interface the frontend implements against) |
| `export_scope.py` | build the static demos/ files from a local dataset dir |
| `validate_hyparquet.mjs` | read an exported parquet with the frontend's own reader |
| `modal_api.py` | the `latent-scope-api` Modal app (all 6 endpoints) |
| `test_parity.py` | diff ephemeral (`modal serve`) responses against production |
| `upload.sh` | publish exported files to GCS + LanceDB to the Modal volume |

## 1. Export a scope

Prereq: a finished latent-scope pipeline run (`ls-scope` done) in
`$LATENT_SCOPE_DATA/<dataset>`; for image datasets also `ls-sprite-atlas`.
latent-scope ≥ 0.6 writes the LanceDB table (`<dataset>/lancedb/<scope>.lance`)
during `ls-scope`.

```bash
uv run pipeline/export_scope.py /data/latent-scope/marqo-ge-sample scopes-001 \
    --user enjalot --out pipeline/out
```

Output lands in `pipeline/out/<user>/<dataset>/`:
`{scope}.json`, `{scope}.parquet`, `{scope}.bin`, `{scope}.png`, optional
`{sae}_features.parquet`, and for image datasets
`{scope}/atlas/<col>/…` + `{scope}/thumbs/<col>/{i}.webp`.

Useful flags: `--dataset-name` (rename output dataset, e.g. `ls-…`),
`--label/--description` (override scope json), `--text-column` (hover .bin
source), `--skip-thumbs/--skip-atlas`.

Extra validation with the frontend's parquet reader:

```bash
source ~/.nvm/nvm.sh
node pipeline/validate_hyparquet.mjs pipeline/out/enjalot/marqo-ge-sample/scopes-001.parquet
```

## 2. Test the API (ephemeral, no deploy)

```bash
modal serve pipeline/modal_api.py        # terminal 1 — publishes *-dev URLs
uv run pipeline/test_parity.py           # terminal 2 — diffs -dev vs production
```

`test_parity.py` hits both the ephemeral and live endpoints with identical
dadabase requests. rows-by-index / column-filter / feature are exact diffs;
nn is tolerance-based (model inference); calc-embedding / calc-sae are
validated against the spec because they are broken on the currently-deployed
production revision (it predates those functions).

## 3. Deploy + publish

```bash
# API (only when parity is green — this replaces production):
modal deploy pipeline/modal_api.py

# Static files + LanceDB volume (dry-run by default):
bash pipeline/upload.sh enjalot marqo-ge-sample scopes-001            # dry-run
bash pipeline/upload.sh enjalot marqo-ge-sample scopes-001 --apply    # real
```

`upload.sh` needs `gcloud` auth with write access to `gs://fun-data` and a
logged-in `modal` CLI. It rsyncs the exported dir to
`gs://fun-data/latent-scope/demos/<user>/<dataset>/` and uploads
`<data>/<dataset>/lancedb` to the Modal `lancedb` volume at `<user>/<dataset>`.

## 4. Register the scope in the frontend

Add an entry to `src/lib/scopes.js`:

```js
{
  id: 'enjalot/marqo-ge-sample/scopes-001',
  label: 'Marqo GE Sample',
  description: '20k product images from Marqo/marqo-ge-sample',
  dataUrl: 'https://huggingface.co/datasets/Marqo/marqo-GS-10M',
},
```

The `id` is `{user}/{dataset}/{scope}` and must match both the GCS path and
the LanceDB volume path (`db={user}/{dataset}`, table `{scope}`).

## Notes / gotchas

- The hosted format is positional: parquet row i ↔ `.bin` bytes
  `[i*1000,(i+1)*1000)` ↔ `thumbs/{col}/{i}.webp` ↔ LanceDB `index`.
  `export_scope.py` refuses to export scopes where `ls_index != range(rows)`
  (i.e. scopes with deleted rows).
- Production currently runs an old app revision: `calc-embedding` and
  `calc-sae` return `modal-http: invalid function call`. Deploying
  `modal_api.py` fixes both (frontend features: embedding plot + SAE steering).
- `nn` for image scopes embeds the text query with the CLIP text tower
  (`openai/clip-vit-base-patch32`) — see `ClipTextEncoder` in `modal_api.py`.
- SAE *model* assets (`sae/NOMIC_FWEDU_25k/…` used by `src/lib/SAE.js`) are
  out of scope here; they come from the latent-taxonomy pipeline (FORMAT.md §2).
