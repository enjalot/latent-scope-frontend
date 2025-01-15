export const apiUrl = import.meta.env.VITE_API_URL;

export const apiService = {
  getScope: async (userId, datasetId, scopeId) => {
    return fetch(`https://enjalot--latent-scope-api-app-scope-meta-dev.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}`).then((response) =>
      response.json()
    );
  },
  getRowsByIndices: async (userId, datasetId, scopeId, indices) => {
    return fetch(`https://enjalot--latent-scope-api-app-rows-by-index-dev.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&indices=${indices.toString()}`).then((response) =>
      response.json()
    );
  },
  getScopeRows: async (userId, datasetId, scopeId) => {
    return fetch(`https://enjalot--latent-scope-api-app-scope-data-dev.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}`).then((response) =>
      response.json()
    );
  },

  searchNearestNeighbors: async (datasetId, embedding, query) => {
    const embeddingDimensions = embedding?.dimensions;
    const searchParams = new URLSearchParams({
      dataset: datasetId,
      query,
      embedding_id: embedding.id,
      ...(embeddingDimensions !== undefined ? { dimensions: embeddingDimensions } : {}),
    });

    const nearestNeigborsUrl = `${apiUrl}/search/nn?${searchParams.toString()}`;
    return fetch(nearestNeigborsUrl)
      .then((response) => response.json())
      .then((data) => {
        let dists = [];
        let inds = data.indices.map((idx, i) => {
          dists[idx] = data.distances[i];
          return idx;
        });
        return {
          distances: dists,
          indices: inds,
          searchEmbedding: data.search_embedding[0],
        };
      });
  },
  searchSaeFeature: async (datasetId, saeId, featureId, threshold, topN) => {
    const searchParams = new URLSearchParams({
      dataset: datasetId,
      sae_id: saeId,
      feature_id: featureId,
      threshold,
      top_n: topN,
    });
    return fetch(`${apiUrl}/search/feature?${searchParams.toString()}`).then((response) =>
      response.json()
    );
  },
};
