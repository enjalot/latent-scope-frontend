// const dev = import.meta.env.MODE == "development" ? "-dev" : ""
const dev = ""

export const apiService = {
  getScope: async (userId, datasetId, scopeId) => {
    // return fetch(`https://enjalot--latent-scope-api-app-scope-meta${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}`).then((response) =>
    return fetch(`https://storage.googleapis.com/fun-data/latent-scope/demos/${userId}/${datasetId}/${scopeId}.json`).then((response) =>
      response.json()
    );
  },
  getRowsByIndices: async (userId, datasetId, scopeId, indices) => {
    return fetch(`https://enjalot--latent-scope-api-app-rows-by-index${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&indices=${indices.toString()}`).then((response) =>
      response.json()
    );
  },
  getHoverText: async (userId, datasetId, scopeId, index) => {
    const ranges = `bytes=${index*1000}-${(index+1)*1000-1}`;
    return fetch(`https://storage.googleapis.com/fun-data/latent-scope/demos/${userId}/${datasetId}/${scopeId}.bin`, {
      headers: {
        'Range': ranges
      }
    }).then(async response => {
      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder();
      const text = decoder.decode(buffer);
      return text;
    });
  },
  getScopeRows: async (userId, datasetId, scopeId) => {
    return fetch(`https://enjalot--latent-scope-api-app-scope-data${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}`).then((response) =>
      response.json()
    );
  },
  columnFilter: async (userId, datasetId, scopeId, query) => {
    return fetch(`https://enjalot--latent-scope-api-app-column-filter${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&query=${JSON.stringify(query)}`).then((response) =>
      response.json()
    );
  },
  searchNearestNeighbors: async (userId, datasetId, scope, query) => {
    const scopeId = scope.id
    // TODO: this should be a util function? converting the model to the HF name
    const modelId = scope.embedding?.model_id.replace("___", "/").split("-").slice(1).join("-")
    console.log("MODEL ID", modelId)
    return fetch(`https://enjalot--latent-scope-api-app-nn${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&model=${modelId}&query=${query}`)
      .then((response) => response.json())
      .then((data) => {
        let dists = [];
        let inds = data
          .map((d, i) => {
            dists[i] = d._distance
            return d.index
          })
        return {
          distances: dists,
          indices: inds,
        };
      });
  },
  searchSaeFeature: async (userId, datasetId, scopeId, featureId, threshold) => {
    return fetch(`https://enjalot--latent-scope-api-app-feature${dev}.modal.run/?db=${userId}/${datasetId}&scope=${scopeId}&feature=${featureId}&threshold=${threshold}`).then((response) =>
      response.json()
    );
  },
};
