// const dev = import.meta.env.MODE == "development" ? "-dev" : ""
const dev = '';

// Base URL for the static scope assets ({scope}.json/.parquet/.bin, atlas
// pyramid, thumbs). Layout under the base is `{user}/{dataset}/...`, matching
// the GCS tree at `demos/`. Override with VITE_STATIC_BASE to test against a
// locally served export (e.g. `VITE_STATIC_BASE=http://localhost:8787/` with
// `npx serve --cors pipeline/out -l 8787` — note the exporter's out/ tree has
// no `demos/` prefix, so the override base points directly at out/), or to
// re-host the data elsewhere. Defaults to the production GCS bucket.
const DEFAULT_STATIC_BASE = 'https://storage.googleapis.com/fun-data/latent-scope/demos/';
const rawStaticBase = import.meta.env.VITE_STATIC_BASE || DEFAULT_STATIC_BASE;
export const STATIC_BASE = rawStaticBase.endsWith('/') ? rawStaticBase : rawStaticBase + '/';

// URL for a static asset that lives under a scope's dataset directory,
// `relPath` being relative to `{user}/{dataset}/` (e.g. the atlas manifest
// and thumb paths in a scope.json `images` block).
export const scopeAssetUrl = (userId, datasetId, relPath) =>
  `${STATIC_BASE}${userId}/${datasetId}/${relPath}`;

const { asyncBufferFromUrl, parquetRead } = await import('hyparquet');

// Add a cache object at the module level
const saeFeatureCache = {};

export const apiService = {
  getScope: async (userId, datasetId, scopeId) => {
    // return fetch(`https://enjalot--latent-scope-api-app-scope-meta${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}`).then((response) =>
    return fetch(`${STATIC_BASE}${userId}/${datasetId}/${scopeId}.json`).then((response) =>
      response.json()
    );
  },
  getRowsByIndices: async (userId, datasetId, scopeId, indices) => {
    return fetch(
      `https://enjalot--latent-scope-api-app-rows-by-index${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&indices=${indices.toString()}`
    ).then((response) => response.json());
  },
  getHoverText: async (userId, datasetId, scopeId, index) => {
    const ranges = `bytes=${index * 1000}-${(index + 1) * 1000 - 1}`;
    return fetch(`${STATIC_BASE}${userId}/${datasetId}/${scopeId}.bin`, {
        headers: {
          Range: ranges,
        },
      }
    ).then(async (response) => {
      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder();
      const text = decoder.decode(buffer);
      return text;
    });
  },
  // Fetch text snippets for a list of row indices. Uses the fixed-1000-byte
  // hover .bin (a ranged fetch per index — exactly what the .bin is for), and
  // falls back to the rows-by-index modal endpoint if a range fetch fails.
  getSnippets: async (userId, datasetId, scopeId, indices) => {
    try {
      return await Promise.all(
        indices.map((i) =>
          apiService.getHoverText(userId, datasetId, scopeId, i).then((t) => t.replace(/\s+$/, ''))
        )
      );
    } catch (e) {
      const rows = await apiService.getRowsByIndices(userId, datasetId, scopeId, indices);
      return rows.map((r) => r?.text ?? '');
    }
  },
  getScopeRows: async (userId, datasetId, scopeId) => {
    const url = `${STATIC_BASE}${userId}/${datasetId}/${scopeId}.parquet`;
    const buffer = await asyncBufferFromUrl(url);
    return new Promise((resolve) => {
      parquetRead({
        file: buffer,
        rowFormat: 'object',
        onComplete: (data) => {
          data.forEach((row, i) => {
            row.ls_index = i;
            row.cluster = parseInt(row.cluster);
            row.raw_cluster = parseInt(row.raw_cluster);
            row.tile_index_32 = parseInt(row.tile_index_32);
            row.tile_index_64 = parseInt(row.tile_index_64);
            row.tile_index_128 = parseInt(row.tile_index_128);
            // 3D scopes carry a z coordinate + voxel bucket indices (int64 in
            // parquet -> may arrive as BigInt from hyparquet). Coerce to Number.
            if (row.z !== undefined && row.z !== null) row.z = Number(row.z);
            if (row.voxel_index_32 !== undefined && row.voxel_index_32 !== null)
              row.voxel_index_32 = Number(row.voxel_index_32);
            if (row.voxel_index_64 !== undefined && row.voxel_index_64 !== null)
              row.voxel_index_64 = Number(row.voxel_index_64);
          });
          resolve(data);
        },
      });
    });
  },
  getDatasetFeatures: async (userId, datasetId, saeId) => {
    const url = `${STATIC_BASE}${userId}/${datasetId}/${saeId}_features.parquet?cachebust=1`;
    const buffer = await asyncBufferFromUrl(url);
    return new Promise((resolve) => {
      parquetRead({
        file: buffer,
        rowFormat: 'object',
        onComplete: (data) => {
          data.forEach((row, i) => {
            row.feature = parseInt(row.feature_id);
            row.feature_id = parseInt(row.feature_id);
            row.max_activation = parseFloat(row.max_activation);
            row.avg_activation = parseFloat(row.avg_activation);
            row.count = parseInt(row.count);
          });
          resolve(data);
        },
      });
    });
  },
  getSaeFeatures: async (saeMeta, callback) => {
    // Check if we have cached features for this model
    if (saeMeta.model_id && saeFeatureCache[saeMeta.model_id]) {
      callback(saeFeatureCache[saeMeta.model_id]);
      return;
    }

    const buffer = await asyncBufferFromUrl(saeMeta.url);
    parquetRead({
      file: buffer,
      onComplete: (data) => {
        let fts = data.map((f) => {
          return {
            feature: parseInt(f[0]),
            max_activation: f[1],
            label: f[6],
            order: f[7],
            grid_x: f[8],
            grid_y: f[9],
          };
        });

        // Store in cache if model_id is available
        if (saeMeta.model_id) {
          saeFeatureCache[saeMeta.model_id] = fts;
        }

        callback(fts);
      },
    });
  },
  getSaeTopSamples: async (saeMeta, sample, feature, callback) => {
    const chunkMappingUrl = saeMeta[sample] + 'chunk_mapping.json';
    const chunkMapping = await fetch(chunkMappingUrl).then((r) => r.json());
    const buffer = await asyncBufferFromUrl(
      saeMeta[sample] + `chunk_${chunkMapping[feature.feature]}.parquet?cachebust=1`
    );
    parquetRead({
      file: buffer,
      rowFormat: 'object',
      onComplete: (data) => {
        let ss = data
          .map((d) => {
            return {
              ...d,
              feature: parseInt(d.feature),
            };
          })
          .filter((d) => d.feature === feature.feature);
        callback(ss);
      },
    });
  },
  columnFilter: async (userId, datasetId, scopeId, query) => {
    return fetch(
      `https://enjalot--latent-scope-api-app-column-filter${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&query=${JSON.stringify(query)}`
    ).then((response) => response.json());
  },
  searchNearestNeighbors: async (userId, datasetId, scope, query, results = false) => {
    const scopeId = scope.id;
    // TODO: this should be a util function? converting the model to the HF name
    const modelId = scope.embedding?.model_id.replace('___', '/').split('-').slice(1).join('-');
    let url = `https://enjalot--latent-scope-api-app-nn${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&model=${modelId}&query=${query}`;
    if (results) {
      url += `&results=${results}`;
    }
    return fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (results) {
          return data;
        }
        let dists = [];
        let inds = data.map((d, i) => {
          dists[i] = d._distance;
          return d.index;
        });
        return {
          distances: dists,
          indices: inds,
        };
      });
  },
  searchSaeFeature: async (userId, datasetId, scopeId, featureId, threshold) => {
    return fetch(
      `https://enjalot--latent-scope-api-app-feature${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&feature=${featureId}&threshold=${threshold}`
    ).then((response) => response.json());
  },
  calcTokenizedEmbeddings: async (query) => {
    return fetch(
      `https://enjalot--latent-scope-api-app-calc-embedding.modal.run?query=${encodeURIComponent(query)}`
    ).then((response) => response.json());
  },
  calcFeatures: async (embedding) => {
    return fetch('https://enjalot--latent-scope-api-app-calc-sae.modal.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embedding: embedding }),
    }).then((response) => response.json());
  },
  calcSteering: async (features) => {
    return fetch('https://enjalot--latent-scope-api-app-calc-sae.modal.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ features: features }),
    }).then((response) => response.json());
  },
  getNNEmbed: async (db, scope, embedding) => {
    return fetch('https://enjalot--latent-scope-api-app-calc-sae.modal.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        neighbors: true,
        db: db,
        scope: scope,
        embedding: embedding,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        data.forEach((d) => {
          d.ls_distance = d._distance;
        });
        return data;
      });
  },
};
