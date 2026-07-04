"""Modal API for the hosted latent.estate frontend.

Recreation of github.com/enjalot/latent-scope-modal api/app.py (the deployed
`latent-scope-api` app), ported to the Modal 1.x SDK and extended for image
scopes (binary columns are excluded from JSON responses — see
pipeline/FORMAT.md §3/§4.4).

The app/class/method names are load-bearing: deployed URLs are
    https://enjalot--latent-scope-api-app-{fn}.modal.run
(`{app}-{class}-{method}` with underscores -> hyphens). `modal serve` publishes
the same labels with a `-dev` suffix, which is what `test_parity.py` targets.

Endpoints: nn, rows-by-index, feature, column-filter, calc-embedding, calc-sae.
Backing store: LanceDB on the Modal volume `lancedb` at /lancedb/{user}/{dataset},
table name = scope id (built by latent-scope `export_lance()` and uploaded with
pipeline/upload.sh).

Dev test:   modal serve pipeline/modal_api.py
            uv run pipeline/test_parity.py
Deploy:     modal deploy pipeline/modal_api.py   (only when ready!)
"""

import modal

BIG_LIMIT = 10000000

volume = modal.Volume.from_name("lancedb", create_if_missing=False)
hf_model_cache = modal.Volume.from_name("hf_model_cache", create_if_missing=True)

st_image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "torch==2.1.2",
        "numpy<2",  # torch 2.1 is ABI-incompatible with numpy 2.x
        "pyarrow",
        "sentence-transformers==3.2.0",
        "transformers",
        "huggingface_hub==0.23.2",
        "latentsae==0.1.3",
        "einops==0.7.0",
        "hf-transfer==0.1.6",
        # Pinned to match the writer (local latent-scope env): unpinned pip
        # resolves ancient lance packages under the numpy<2 constraint, and
        # those can't see tables written with V2 manifest paths ("Table 'X'
        # was not found"). Both still read the older V1-manifest tables.
        "lancedb==0.30.1",
        "pylance==0.39.0",  # lancedb's table.to_lance() needs the lance package
        "fastapi[standard]",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    .env({"HF_HOME": "/hf_cache"})
    .env({"SAE_DISABLE_TRITON": "1"})
)

with st_image.imports():
    import json

    import numpy as np
    import pyarrow.types as pa_types
    import torch
    import lancedb
    from sentence_transformers import SentenceTransformer

app = modal.App("latent-scope-api")


def _type_has_binary(dtype):
    """True if an Arrow type is or contains binary data (e.g. the HF-style
    image struct<bytes: binary, path: string>)."""
    if pa_types.is_binary(dtype) or pa_types.is_large_binary(dtype) or pa_types.is_fixed_size_binary(dtype):
        return True
    for i in range(dtype.num_fields):
        if _type_has_binary(dtype.field(i).type):
            return True
    return False


class ClipTextEncoder:
    """Minimal SentenceTransformer-compatible text encoder for CLIP models
    (e.g. openai/clip-vit-base-patch32, used by image scopes)."""

    def __init__(self, model_name, device):
        from transformers import CLIPModel, CLIPTokenizerFast

        self.tokenizer = CLIPTokenizerFast.from_pretrained(model_name)
        self.model = CLIPModel.from_pretrained(model_name).to(device)
        self.device = device

    def encode(self, query, normalize_embeddings=True):
        inputs = self.tokenizer([query], return_tensors="pt", padding=True, truncation=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            feats = self.model.get_text_features(**inputs)
        if not torch.is_tensor(feats):
            # transformers >= 5 returns an output object; pooler_output is the
            # projected text feature (verified equal to text_projection(pooled))
            feats = feats.pooler_output
        if normalize_embeddings:
            feats = torch.nn.functional.normalize(feats, p=2, dim=1)
        return feats.cpu().numpy()[0]


@app.cls(
    cpu=1,
    # Cost: scale to zero when idle (an always-warm 1-CPU container is ~$35/mo).
    # First request after idle pays a cold start (image boot + lazy model load);
    # acceptable for a demo site. 5-min scaledown keeps a browsing session warm.
    min_containers=0,
    max_containers=4,
    timeout=60 * 10,
    scaledown_window=60 * 5,
    image=st_image,
    volumes={"/lancedb": volume, "/hf_cache": hf_model_cache},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
@modal.concurrent(max_inputs=100)
class App:
    @modal.enter()
    def start_engine(self):
        self.device = torch.device("cpu")
        self.models = {}
        self.db_connections = {}
        self.table_connections = {}
        self.sae_models = {}
        self.transformer_models = {}

    # -- caches -------------------------------------------------------------

    def get_model(self, model_name):
        if model_name not in self.models:
            if "clip" in model_name.lower():
                self.models[model_name] = ClipTextEncoder(model_name, self.device)
            else:
                self.models[model_name] = SentenceTransformer(
                    model_name, trust_remote_code=True, device=self.device
                )
        return self.models[model_name]

    def get_db_connection(self, db_name):
        if db_name not in self.db_connections:
            self.db_connections[db_name] = lancedb.connect(f"/lancedb/{db_name}")
        return self.db_connections[db_name]

    def get_table(self, db_name, scope):
        cache_key = f"{db_name}/{scope}"
        if cache_key not in self.table_connections:
            try:
                db = self.get_db_connection(db_name)
                self.table_connections[cache_key] = db.open_table(scope)
            except Exception:
                # A warm container sees the volume as of its start time; a
                # scope published since then (upload.sh) needs a reload.
                self.db_connections.clear()
                volume.reload()
                db = self.get_db_connection(db_name)
                self.table_connections[cache_key] = db.open_table(scope)
        return self.table_connections[cache_key]

    def get_sae(self, model_name, k_expansion):
        model_id = f"{model_name}-{k_expansion}"
        if model_id not in self.sae_models:
            from latentsae.sae import Sae

            self.sae_models[model_id] = Sae.load_from_hub(model_name, k_expansion)
        return self.sae_models[model_id]

    def get_transformer(self, model_name):
        if model_name not in self.transformer_models:
            from transformers import AutoModel, AutoTokenizer

            self.transformer_models[model_name] = {
                "tokenizer": AutoTokenizer.from_pretrained(model_name),
                "model": AutoModel.from_pretrained(model_name, trust_remote_code=True),
            }
        return self.transformer_models[model_name]

    def json_safe_columns(self, table, include_vector=False):
        """All columns representable in a JSON response (no raw binary; the
        frontend loads image cells from the exported thumbs instead)."""
        return [
            field.name
            for field in table.schema
            if (include_vector or field.name != "vector") and not _type_has_binary(field.type)
        ]

    # -- endpoints ------------------------------------------------------------

    @modal.fastapi_endpoint(method="GET")
    def nn(self, query: str, model: str, db: str, scope: str, results: bool = False):
        model = self.get_model(model)
        table = self.get_table(db, scope)
        print(db, scope, "🔍 query", query)
        embeddings = model.encode(query, normalize_embeddings=True)
        limit = 100 if results else BIG_LIMIT
        res = table.search(embeddings).metric("cosine").limit(limit)
        if results:
            return res.select(self.json_safe_columns(table, include_vector=True)).to_list()
        else:
            return res.select(["index"]).to_list()

    @modal.fastapi_endpoint(method="GET")
    def rows_by_index(self, db: str, scope: str, indices: str):
        table = self.get_table(db, scope)
        print(db, scope, "🚣 rows_by_index", indices)
        indices = [int(i) for i in indices.split(",")]
        columns = self.json_safe_columns(table)
        return table.to_lance().take(indices=indices, columns=columns).to_pylist()

    @modal.fastapi_endpoint(method="GET")
    def feature(self, db: str, scope: str, feature: str, threshold: float):
        table = self.get_table(db, scope)
        print(db, scope, "📌 feature", feature, threshold)
        where = (
            f"array_has(sae_indices, {feature}) AND "
            f"array_element(sae_acts, cast(array_position(sae_indices, {feature}) as int))"
            f" > {threshold}"
        )
        columns = ["index", "sae_indices", "sae_acts"]
        rows = table.search().where(where).select(columns).limit(BIG_LIMIT).to_list()
        # sort by that feature's activation, descending
        rows = sorted(
            rows,
            key=lambda x: x["sae_acts"][x["sae_indices"].index(int(feature))],
            reverse=True,
        )
        return [d["index"] for d in rows]

    @modal.fastapi_endpoint(method="GET")
    def column_filter(self, db: str, scope: str, query: str):
        table = self.get_table(db, scope)
        print(db, scope, "🔍 column_filter", query)
        filters = json.loads(query)
        where_clauses = []
        for f in filters:
            column_name = f'`{f["column"]}`'
            if f["type"] == "eq":
                where_clauses.append(f"{column_name} = '{f['value']}'")
            elif f["type"] == "gt":
                where_clauses.append(f"{column_name} > {f['value']}")
            elif f["type"] == "lt":
                where_clauses.append(f"{column_name} < {f['value']}")
            elif f["type"] == "gte":
                where_clauses.append(f"{column_name} >= {f['value']}")
            elif f["type"] == "lte":
                where_clauses.append(f"{column_name} <= {f['value']}")
            elif f["type"] == "in":
                values = [f"'{v}'" if isinstance(v, str) else str(v) for v in f["value"]]
                where_clauses.append(f"{column_name} IN ({','.join(values)})")
            elif f["type"] == "contains":
                where_clauses.append(f"{column_name} LIKE '%{f['value']}%'")

        where_clause = " AND ".join(where_clauses)
        print("where_clause", where_clause)
        return table.search().where(where_clause).select(["index"]).limit(BIG_LIMIT).to_list()

    @modal.fastapi_endpoint(method="GET")
    def calc_embedding(self, query: str):
        model_name = "nomic-ai/nomic-embed-text-v1.5"
        model = self.get_transformer(model_name)
        tokenizer = model["tokenizer"]
        model = model["model"]

        def mean_pooling(token_embeddings, attention_mask):
            input_mask_expanded = (
                attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
            )
            return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(
                input_mask_expanded.sum(1), min=1e-9
            )

        text = [query]
        inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
        tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
        encoding = tokenizer(text, return_offsets_mapping=True)
        token_spans = encoding.offset_mapping

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = model(**inputs)

        embedding = mean_pooling(outputs[0], inputs["attention_mask"])
        normalized_embeddings = torch.nn.functional.normalize(embedding, p=2, dim=1)
        return {
            "text": text,
            "token_ids": inputs["input_ids"].cpu().numpy().tolist()[0],
            "tokens": tokens,
            "token_spans": token_spans,
            "hidden_states": outputs[0].cpu().numpy().tolist(),
            "attention_mask": inputs["attention_mask"].cpu().numpy().tolist()[0],
            "embedding": normalized_embeddings.cpu().numpy().tolist()[0],
            "embedding_raw": embedding.cpu().numpy().tolist()[0],
        }

    @modal.fastapi_endpoint(method="POST")
    def calc_sae(self, item: dict):
        print("calc_sae", item.keys())

        # extra mode ("ran out of endpoints" in the original): ANN by embedding
        if "neighbors" in item:
            table = self.get_table(item["db"], item["scope"])
            columns = self.json_safe_columns(table, include_vector=True)
            return (
                table.search(item["embedding"])
                .metric("cosine")
                .limit(100)
                .select(columns)
                .to_list()
            )

        model_name = "enjalot/sae-nomic-text-v1.5-FineWeb-edu-100BT"
        k_expansion = "64_32"
        sae = self.get_sae(model_name, k_expansion)
        if "embedding" in item:
            embedding = np.array(item["embedding"])
            embedding_tensor = torch.from_numpy(embedding).float().to(self.device)
            features = sae.encode(embedding_tensor)
            return {
                "top_indices": features.top_indices.tolist(),
                "top_acts": features.top_acts.tolist(),
            }
        if "features" in item:
            top_acts = np.array(item["features"]["top_acts"])
            top_indices = np.array(item["features"]["top_indices"])
            top_acts_tensor = torch.from_numpy(top_acts).float().to(self.device)
            top_indices_tensor = torch.from_numpy(top_indices).long().to(self.device)
            embedding = sae.decode(top_acts=top_acts_tensor, top_indices=top_indices_tensor)
            return embedding.tolist()
