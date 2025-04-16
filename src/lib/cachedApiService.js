import { apiService } from './apiService';

// Import cached responses if they exist
let cachedResponses = {};
let keepCaching = true;
try {
  cachedResponses = await import('../essays/cached/initial.json').then((module) => module.default);
  keepCaching = false;
} catch (error) {
  console.log('No cache file found or unable to load cache');
  cachedResponses = {};
}

// Create a function to generate cache keys from API parameters
const generateCacheKey = (method, params) => {
  try {
    return `${method}:${JSON.stringify(params)}`;
  } catch (error) {
    console.warn('Could not generate cache key for', method, params);
    return null;
  }
};

// Generic wrapper for any API call that adds caching
const withCache = async (method, params, apiCall) => {
  const cacheKey = generateCacheKey(method, params);

  if (cacheKey && cachedResponses[cacheKey]) {
    // console.log(`Using cached response for ${method}`);
    return cachedResponses[cacheKey];
  }

  // console.log('uncached call to', method, params);
  const response = await apiCall();

  if (cacheKey && keepCaching) {
    cachedResponses[cacheKey] = response;
    // console.log(`Cached new response for ${method}`);
  }

  return response;
};

// Create cached versions of each API endpoint
export const maybeCachedGetScope = async (userId, datasetId, scopeId) => {
  return withCache('getScope', { userId, datasetId, scopeId }, () =>
    apiService.getScope(userId, datasetId, scopeId)
  );
};

export const maybeCachedGetRowsByIndices = async (userId, datasetId, scopeId, indices) => {
  return withCache('getRowsByIndices', { userId, datasetId, scopeId, indices }, () =>
    apiService.getRowsByIndices(userId, datasetId, scopeId, indices)
  );
};

export const maybeCachedGetHoverText = async (userId, datasetId, scopeId, index) => {
  return withCache('getHoverText', { userId, datasetId, scopeId, index }, () =>
    apiService.getHoverText(userId, datasetId, scopeId, index)
  );
};

export const maybeCachedGetScopeRows = async (userId, datasetId, scopeId) => {
  return withCache('getScopeRows', { userId, datasetId, scopeId }, () =>
    apiService.getScopeRows(userId, datasetId, scopeId)
  );
};

export const maybeCachedGetDatasetFeatures = async (userId, datasetId, saeId) => {
  return withCache('getDatasetFeatures', { userId, datasetId, saeId }, () =>
    apiService.getDatasetFeatures(userId, datasetId, saeId)
  );
};

export const maybeCachedGetSaeFeatures = async (saeMeta, callback) => {
  // Special handling for callback-based API
  return withCache(
    'getSaeFeatures',
    { saeMeta: JSON.stringify(saeMeta).slice(0, 100) }, // Use part of saeMeta as cache key
    async () => {
      return new Promise((resolve) => {
        apiService.getSaeFeatures(saeMeta, (data) => {
          resolve(data);
          callback(data);
        });
      });
    }
  ).then((data) => data); // The callback is still called via the withCache function
};

export const maybeCachedGetSaeTopSamples = async (saeMeta, sample, feature, callback) => {
  // Similar special handling for callback API
  return withCache(
    'getSaeTopSamples',
    {
      saeMeta: JSON.stringify(saeMeta).slice(0, 100),
      sample,
      feature: feature.feature,
    },
    async () => {
      return new Promise((resolve) => {
        apiService.getSaeTopSamples(saeMeta, sample, feature, (data) => {
          resolve(data);
          callback(data);
        });
      });
    }
  ).then((data) => data);
};

export const maybeCachedColumnFilter = async (userId, datasetId, scopeId, query) => {
  return withCache('columnFilter', { userId, datasetId, scopeId, query }, () =>
    apiService.columnFilter(userId, datasetId, scopeId, query)
  );
};

export const maybeCachedSearchNearestNeighbors = async (
  userId,
  datasetId,
  scope,
  query,
  results = false
) => {
  return withCache(
    'searchNearestNeighbors',
    { userId, datasetId, scopeId: scope.id, query, results },
    () => apiService.searchNearestNeighbors(userId, datasetId, scope, query, results)
  );
};

export const maybeCachedSearchSaeFeature = async (
  userId,
  datasetId,
  scopeId,
  featureId,
  threshold
) => {
  return withCache('searchSaeFeature', { userId, datasetId, scopeId, featureId, threshold }, () =>
    apiService.searchSaeFeature(userId, datasetId, scopeId, featureId, threshold)
  );
};

export const maybeCachedCalcTokenizedEmbeddings = async (query) => {
  return withCache('calcTokenizedEmbeddings', { query }, () =>
    apiService.calcTokenizedEmbeddings(query)
  );
};

export const maybeCachedCalcFeatures = async (embedding) => {
  return withCache(
    'calcFeatures',
    // For large arrays like embeddings, use hash of first few elements
    { embeddingFirstFew: embedding.slice(0, 5).join(',') },
    () => apiService.calcFeatures(embedding)
  );
};

export const maybeCachedCalcSteering = async (features) => {
  return withCache(
    'calcSteering',
    {
      topIndices: features.top_indices.slice(0, 5).join(','),
      topActs: features.top_acts.slice(0, 5).join(','),
    },
    () => apiService.calcSteering(features)
  );
};

export const maybeCachedGetNNEmbed = async (db, scope, embedding) => {
  return withCache(
    'getNNEmbed',
    {
      db,
      scope,
      embeddingFirstFew: embedding.slice(0, 5).join(','),
    },
    () => apiService.getNNEmbed(db, scope, embedding)
  );
};

// Function to save current cache to console for extraction
export const saveCurrentCacheToConsole = () => {
  console.log('cachedResponses', cachedResponses);
  // console.log(JSON.stringify(cachedResponses, null, 2));
  return 'Cache logged to console. Copy this output to create your cache file.';
};
