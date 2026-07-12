import { apiService } from './apiService';

// Pre-baked responses (essays/cached/initial.json, ~4.4MB) are loaded
// lazily so they stay out of the main bundle and are only fetched when a
// cached-service consumer (an essay) actually makes a request. The promise
// is memoized so the JSON is imported at most once; every maybeCached*
// wrapper awaits it before resolving, preserving the old top-level-await
// behavior where the cache is seeded before any request resolves.
let cachedResponses = {};
let keepCaching = true;
let cachePromise = null;

const ensureCache = () => {
  if (!cachePromise) {
    cachePromise = import('../essays/cached/initial.json')
      .then((module) => {
        cachedResponses = module.default;
        keepCaching = false;
      })
      .catch(() => {
        console.log('No cache file found or unable to load cache');
        cachedResponses = {};
      });
  }
  return cachePromise;
};

// Create a function to generate cache keys from API parameters
const generateCacheKey = (method, params) => {
  try {
    return `${method}:${JSON.stringify(params)}`;
  } catch (error) {
    console.warn('Could not generate cache key for', method, params);
    return null;
  }
};

// Track pending parquet requests to deduplicate concurrent requests
const pendingParquetRequests = new Map();

// Generic wrapper for any API call that adds caching
const withCache = async (method, params, apiCall) => {
  await ensureCache();
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

// Special wrapper for parquet fetch operations that deduplicates in-flight requests
const withParquetRequestDeduplication = async (method, key, fetchFn) => {
  const requestKey = `${method}:${key}`;

  // Check if this request is already in progress
  if (pendingParquetRequests.has(requestKey)) {
    // Wait for the existing request to complete
    return pendingParquetRequests.get(requestKey);
  }

  // Create a new promise for this request
  const requestPromise = fetchFn();

  // Store the promise so other requests can wait on it
  pendingParquetRequests.set(requestKey, requestPromise);

  try {
    // Wait for the request to complete
    const result = await requestPromise;
    return result;
  } finally {
    // Clean up the pending request entry
    pendingParquetRequests.delete(requestKey);
  }
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

export const maybeCachedGetScopeRows = async (userId, datasetId, scopeId, columns) => {
  const requestKey = `${userId}/${datasetId}/${scopeId}:${columns ? columns.join(',') : 'all'}`;

  return withParquetRequestDeduplication('getScopeRows', requestKey, async () => {
    // Still use the regular cache for persistence across page loads
    // (JSON.stringify drops an undefined `columns`, so full-read cache keys —
    // including the pre-baked essay cache — are unchanged.)
    return withCache('getScopeRows', { userId, datasetId, scopeId, columns }, () =>
      apiService.getScopeRows(userId, datasetId, scopeId, columns)
    );
  });
};

export const maybeCachedGetDatasetFeatures = async (userId, datasetId, saeId) => {
  const requestKey = `${userId}/${datasetId}/${saeId}`;

  return withParquetRequestDeduplication('getDatasetFeatures', requestKey, async () => {
    return withCache('getDatasetFeatures', { userId, datasetId, saeId }, () =>
      apiService.getDatasetFeatures(userId, datasetId, saeId)
    );
  });
};

export const maybeCachedGetSaeFeatures = async (saeMeta, callback) => {
  const requestKey = saeMeta.model_id;

  // For callback-based API with request deduplication
  const result = await withParquetRequestDeduplication('getSaeFeatures', requestKey, async () => {
    return withCache('getSaeFeatures', { saeMetaId: saeMeta.model_id }, async () => {
      return new Promise((resolve) => {
        apiService.getSaeFeatures(saeMeta, (data) => {
          resolve(data);
        });
      });
    });
  });

  // Always call the callback with the result
  callback(result);
  return result;
};

export const maybeCachedGetSaeTopSamples = async (saeMeta, sample, feature, callback) => {
  const requestKey = `${saeMeta.model_id}_${sample}_${feature.feature}`;

  const result = await withParquetRequestDeduplication('getSaeTopSamples', requestKey, async () => {
    return withCache(
      'getSaeTopSamples',
      {
        saeMetaId: saeMeta.model_id,
        sample,
        feature: feature.feature,
      },
      async () => {
        return new Promise((resolve) => {
          apiService.getSaeTopSamples(saeMeta, sample, feature, (data) => {
            resolve(data);
          });
        });
      }
    );
  });

  // Always call the callback with the result
  callback(result);
  return result;
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
  if (!features) return null;
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
  if (!embedding) return null;
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
