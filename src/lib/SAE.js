export const saeAvailable = {
  '🤗-nomic-ai___nomic-embed-text-v1.5': {
    label: 'NOMIC_FWEDU_25k',
    embedding_model_id: '🤗-nomic-ai___nomic-embed-text-v1.5',
    model_id: 'enjalot/sae-nomic-text-v1.5-FineWeb-edu-100BT',
    k_expansion: '64_32',
    // url: 'https://enjalot.github.io/latent-taxonomy/models/NOMIC_FWEDU_25k/features.parquet?cachebust=1',
    url: 'https://storage.googleapis.com/fun-data/latent-scope/sae/NOMIC_FWEDU_25k/features.parquet?cachebust=2',
    samples: 'https://storage.googleapis.com/fun-data/latent-scope/sae/NOMIC_FWEDU_25k/samples/',
    wikipedia_samples:
      'https://storage.googleapis.com/fun-data/latent-scope/sae/NOMIC_FWEDU_25k/wikipedia_samples/',
  },
  // Matryoshka SAE (nested 512/2048/8192/49152, k=64) over all-MiniLM-L6-v2.
  // The label parquet is served by the latent-taxonomy site (GitHub Pages), so
  // it must be fetched whole — GitHub Pages 416s ranged requests when the
  // client accepts gzip. See apiService.getFeatures.
  '🤗-sentence-transformers___all-MiniLM-L6-v2': {
    label: 'MINILM_STAGEJ_49K',
    embedding_model_id: '🤗-sentence-transformers___all-MiniLM-L6-v2',
    model_id: 'enjalot/sae-all-MiniLM-L6-v2-stagej-49K',
    k_expansion: '64_128',
    url: 'https://enjalot.github.io/latent-taxonomy/models/MINILM_STAGEJ_49K/features.parquet?cachebust=1',
  },
};

// Label parquets keyed by the SAE's OWN model repo (not the embedding model).
// Used for SAEs a scope declares directly — e.g. token-granularity SAEs, whose
// embedding model (jina-colbert-v2) has no saeAvailable entry. Same
// whole-buffer fetch as above (GitHub Pages 416s ranged+gzip requests).
export const saeLabels = {
  'enjalot/sae-jina-colbert-v2-tokens-64K': {
    label: 'COLBERT_JINA_64K',
    url: 'https://enjalot.github.io/latent-taxonomy/models/COLBERT_JINA_64K/features.parquet?cachebust=1',
  },
};

export function getLabelsForSaeModel(saeModelId) {
  return saeLabels[saeModelId] || null;
}

// Strip the provider prefix from an embedding model id so lookups are
// prefix-agnostic: the canonical "huggingface-" and the legacy "🤗-" /
// "transformers-" ids all resolve to the same HF model name.
const stripHFPrefix = (id) => (id || '').replace(/^(huggingface-|🤗-|transformers-)/, '');

// Look up the pretrained SAE for an embedding model id, tolerant of which HF
// prefix the id carries (the SAE map is keyed by the legacy emoji id).
export function getSaeForModel(modelId) {
  const norm = stripHFPrefix(modelId);
  if (!norm) return null;
  for (const [key, sae] of Object.entries(saeAvailable)) {
    if (stripHFPrefix(key) === norm) return sae;
  }
  return null;
}

// Resolve a label parquet source for a scope: either the embedding-model
// registry (getSaeForModel) or the scope's own SAE model repo (saeLabels).
export function getLabelSourceForScope(scope) {
  return (
    getSaeForModel(scope?.embedding?.model_id) || getLabelsForSaeModel(scope?.sae?.model_id) || null
  );
}
