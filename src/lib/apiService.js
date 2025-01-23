// const dev = import.meta.env.MODE == "development" ? "-dev" : ""
const dev = '';

const { asyncBufferFromUrl, parquetRead } = await import('hyparquet');

export const apiService = {
  getScope: async (userId, datasetId, scopeId) => {
    // return fetch(`https://enjalot--latent-scope-api-app-scope-meta${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}`).then((response) =>
    return fetch(
      `https://storage.googleapis.com/fun-data/latent-scope/demos/${userId}/${datasetId}/${scopeId}.json`
    ).then((response) => response.json());
  },
  getRowsByIndices: async (userId, datasetId, scopeId, indices) => {
    return fetch(
      `https://enjalot--latent-scope-api-app-rows-by-index${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&indices=${indices.toString()}`
    ).then((response) => response.json());
  },
  getHoverText: async (userId, datasetId, scopeId, index) => {
    const ranges = `bytes=${index * 1000}-${(index + 1) * 1000 - 1}`;
    return fetch(
      `https://storage.googleapis.com/fun-data/latent-scope/demos/${userId}/${datasetId}/${scopeId}.bin`,
      {
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
  getScopeRows: async (userId, datasetId, scopeId) => {
    const url = `https://storage.googleapis.com/fun-data/latent-scope/demos/${userId}/${datasetId}/${scopeId}.parquet`;
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
          });
          resolve(data);
        },
      });
    });
  },
  getSaeFeatures: async (saeMeta, callback) => {
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
          };
        });
        callback(fts);
      },
    });
  },
  columnFilter: async (userId, datasetId, scopeId, query) => {
    return fetch(
      `https://enjalot--latent-scope-api-app-column-filter${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&query=${JSON.stringify(query)}`
    ).then((response) => response.json());
  },
  searchNearestNeighbors: async (userId, datasetId, scope, query) => {
    const scopeId = scope.id;
    // TODO: this should be a util function? converting the model to the HF name
    const modelId = scope.embedding?.model_id.replace('___', '/').split('-').slice(1).join('-');
    return fetch(
      `https://enjalot--latent-scope-api-app-nn${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&model=${modelId}&query=${query}`
    )
      .then((response) => response.json())
      .then((data) => {
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
};
