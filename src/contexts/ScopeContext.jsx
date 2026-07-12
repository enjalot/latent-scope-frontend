import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { apiService, scopeAssetUrl } from '../lib/apiService';
import {
  maybeCachedGetDatasetFeatures,
  maybeCachedGetScopeRows,
} from '../lib/cachedApiService';
import { getLabelSourceForScope } from '../lib/SAE';

const ScopeContext = createContext(null);

export function ScopeProvider({ children, userParam, datasetParam, scopeParam }) {
  const { user: userFromParams, dataset: datasetFromParams, scope: scopeFromParams } = useParams();

  // Use provided params if available, otherwise use params from router
  const userId = userParam || userFromParams;
  const datasetId = datasetParam || datasetFromParams;
  const scopeId = scopeParam || scopeFromParams;

  // Core scope data
  const [scope, setScope] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [sae, setSae] = useState(null);

  const [scopeLoaded, setScopeLoaded] = useState(false);

  useEffect(() => {
    apiService.getScope(userId, datasetId, scopeId).then((scope) => {
      // Enable the SAE feature surface (per-row/per-token plots, feature modal,
      // feature search + filtering) whenever we can resolve a label source
      // (either the embedding-model registry or the scope's own SAE model repo)
      // OR the scope declares its own sae_id. Token scopes (granularity:
      // "tokens") now have a LanceDB table behind the Modal feature +
      // rows-by-index endpoints, so they qualify too. NN + column filters stay
      // disabled for token scopes (still no backing table for those).
      if (getLabelSourceForScope(scope) || scope.sae_id) {
        setSae(scope.sae);
      } else {
        delete scope.sae;
        delete scope.sae_id;
      }
      setScope(scope);
      setDataset(scope.dataset);
      console.log('=== Scope ===', scope);
    });
  }, [userId, datasetId, scopeId]);

  // ==== Image scopes ====
  // scope.json for image scopes carries an `images` block describing where the
  // static atlas pyramid + per-row thumbnails live (paths relative to
  // {user}/{dataset}/ on the static base). See pipeline/FORMAT.md §4.
  const scopeImages = scope?.images || null;
  // first image column drives the map atlas + hover/table thumbnails
  const imageColumn = scopeImages?.columns?.[0] || null;

  // Build the per-row thumbnail URL from the thumbs template ({index} = row
  // position in {scope}.parquet, == ls_index).
  const thumbUrl = useCallback(
    (index, column = imageColumn) => {
      const template = scopeImages?.thumbs?.[column]?.template;
      if (!template || index === null || index === undefined) return null;
      return scopeAssetUrl(userId, datasetId, template.replace('{index}', index));
    },
    [scopeImages, imageColumn, userId, datasetId]
  );

  // Atlas manifest (grid geometry + which tiles exist) for the image column.
  const [atlasManifest, setAtlasManifest] = useState(null);
  useEffect(() => {
    setAtlasManifest(null);
    const manifestPath = scopeImages?.atlas?.[imageColumn]?.manifest;
    if (!manifestPath) return;
    let cancelled = false;
    fetch(scopeAssetUrl(userId, datasetId, manifestPath))
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest) => {
        if (!cancelled) setAtlasManifest(manifest);
      })
      .catch((e) => {
        console.error('Failed to load atlas manifest', e);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeImages, imageColumn, userId, datasetId]);

  const isImageScope = useMemo(
    () => !!(scopeImages && imageColumn),
    [scopeImages, imageColumn]
  );

  const [features, setFeatures] = useState([]);

  useEffect(() => {
    if (scope?.sae_id) {
      // Resolve the label parquet from EITHER the embedding-model registry or
      // the scope's own SAE model repo (token scopes: jina-colbert-v2 has no
      // registry entry, but its SAE model repo maps to the COLBERT label set).
      const saeEntry = getLabelSourceForScope(scope);
      if (!saeEntry) return;
      // Join labels to the per-dataset stats BY FEATURE ID, not positionally:
      // label parquets can omit dead features (e.g. MINILM_STAGEJ_49K has
      // 45,059 labeled rows for 49,152 features), so row i is not feature i.
      // Missing labels fall back to a generic "Feature N".
      const labelsPromise = apiService.getFeatures(saeEntry.url).catch((err) => {
        console.warn(
          `SAE label parquet unavailable (${saeEntry.url}): ${err}; ` +
            'falling back to generic feature labels'
        );
        return null;
      });
      Promise.all([
        labelsPromise,
        maybeCachedGetDatasetFeatures(userId, datasetId, scope.sae_id),
      ]).then(([labeled, dsfts]) => {
        const byFeature = new Map((labeled || []).map((f) => [f.feature, f]));
        setFeatures(
          dsfts.map((ft, i) => {
            const featureId = ft.feature_id ?? i;
            const lf = byFeature.get(featureId);
            return {
              feature: featureId,
              label: lf?.label || `Feature ${featureId}`,
              max_activation: lf?.max_activation ?? ft.max_activation,
              order: lf?.order ?? featureId,
              dataset_max: ft.max_activation,
              dataset_avg: ft.avg_activation,
              dataset_count: ft.count,
            };
          })
        );
      });
    }
  }, [scope, userId, datasetId]);

  const [clusterMap, setClusterMap] = useState({});
  const [clusterIndices, setClusterIndices] = useState([]);
  const [clusterLabels, setClusterLabels] = useState([]);

  const [scopeRows, setScopeRows] = useState([]);

  const [deletedIndices, setDeletedIndices] = useState([]);

  const fetchScopeRows = useCallback(() => {
    // Token scopes have 100-300x the points of a row scope (1.77M for the
    // dadabase token map); decode only the columns the Explore view reads.
    const tokenColumns =
      scope?.granularity === 'tokens'
        ? [
            'ls_index',
            'x',
            'y',
            'cluster',
            'tile_index_64',
            'deleted',
            'parent_index',
            'token_str',
            'char_start',
            'char_end',
          ]
        : undefined;
    maybeCachedGetScopeRows(userId, datasetId, scope.id, tokenColumns)
      .then((scopeRows) => {
        setScopeRows(scopeRows);
        let clusterMap = {};
        let nonDeletedClusters = new Set();

        // Reset all counts in cluster_labels_lookup first
        // to avoid overcounting clusters counts.
        // this is happening because fetchScopeRows is being called multiple times
        // and the cluster_labels_lookup is being mutated
        // TODO: fix this -> use a new object for cluster_labels_lookup
        if (scope.cluster_labels_lookup) {
          scope.cluster_labels_lookup.forEach((cluster) => {
            cluster.count = 0;
          });
        }

        scopeRows.forEach((d) => {
          const cluster = scope.cluster_labels_lookup?.[d.cluster];
          cluster.count += 1;

          clusterMap[d.ls_index] = cluster;
          //   clusterMap[d.ls_index] = { cluster: d.cluster, label: d.label };
          if (!d.deleted) {
            nonDeletedClusters.add(d.cluster);
          }
        });
        // only take the labels of clusters that belong to rows that are not deleted
        const labelsData =
          scope.cluster_labels_lookup.filter((l) => nonDeletedClusters.has(l.cluster)) || [];

        setClusterLabels(labelsData);
        setClusterIndices(scopeRows.map((d) => d.cluster));

        setClusterMap(clusterMap);

        setDeletedIndices(scopeRows.filter((d) => d.deleted).map((d) => d.ls_index));
        setScopeLoaded(true);
      })
      .catch((error) => console.error('Fetching data failed', error));
  }, [userId, datasetId, scope]);

  useEffect(() => {
    if (scope) fetchScopeRows();
  }, [scope, fetchScopeRows]);

  // Token scopes (granularity: "tokens") map one point per token of a
  // late-interaction embedding instead of one per dataset row. Each scope row
  // carries parent_index (the parent document's row in the .bin/dataset) and
  // token_str/char_start/char_end (the token's surface form + span in the
  // parent text).
  const isTokenScope = scope?.granularity === 'tokens';

  const value = {
    userId,
    datasetId,
    scopeId,
    dataset,
    scope,
    sae,
    isTokenScope,
    scopeLoaded,
    clusterMap,
    clusterLabels,
    scopeRows,
    deletedIndices,
    features,
    setFeatures,
    // image-scope support
    scopeImages,
    imageColumn,
    isImageScope,
    thumbUrl,
    atlasManifest,
  };

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const context = useContext(ScopeContext);
  if (!context) {
    throw new Error('useScope must be used within a ScopeProvider');
  }
  return context;
}
