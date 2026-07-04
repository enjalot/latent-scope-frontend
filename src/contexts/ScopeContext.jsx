import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { apiService, scopeAssetUrl } from '../lib/apiService';
import {
  maybeCachedGetSaeFeatures,
  maybeCachedGetDatasetFeatures,
  maybeCachedGetScopeRows,
} from '../lib/cachedApiService';
import { saeAvailable } from '../lib/SAE';

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
      if (saeAvailable[scope.embedding?.model_id]) {
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
      // apiService.getSaeFeatures(saeAvailable[scope.embedding?.model_id], (fts) => {
      //   apiService.getDatasetFeatures(userId, datasetId, scope.sae_id).then((dsfts) => {
      maybeCachedGetSaeFeatures(saeAvailable[scope.embedding?.model_id], (fts) => {
        maybeCachedGetDatasetFeatures(userId, datasetId, scope.sae_id).then((dsfts) => {
          dsfts.forEach((ft, i) => {
            fts[i].dataset_max = ft.max_activation;
            fts[i].dataset_avg = ft.avg_activation;
            fts[i].dataset_count = ft.count;
          });
          setFeatures(fts);
        });
      });
    }
  }, [scope]);

  const [clusterMap, setClusterMap] = useState({});
  const [clusterIndices, setClusterIndices] = useState([]);
  const [clusterLabels, setClusterLabels] = useState([]);

  const [scopeRows, setScopeRows] = useState([]);

  const [deletedIndices, setDeletedIndices] = useState([]);

  const fetchScopeRows = useCallback(() => {
    // apiService
    //   .getScopeRows(userId, datasetId, scope.id)
    maybeCachedGetScopeRows(userId, datasetId, scope.id)
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

  const value = {
    userId,
    datasetId,
    scopeId,
    dataset,
    scope,
    sae,
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
