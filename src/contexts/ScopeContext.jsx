import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
const { asyncBufferFromUrl, parquetRead } = await import('hyparquet');

import { apiService } from '../lib/apiService';
import { saeAvailable } from '../lib/SAE';

const ScopeContext = createContext(null);

export function ScopeProvider({ children }) {
  const { user: userId, dataset: datasetId, scope: scopeId } = useParams();

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
    });
  }, [userId, datasetId, scopeId]);

  const [features, setFeatures] = useState([]);

  // TODO: this should be in API service?
  useEffect(() => {
    const asyncRead = async (meta) => {
      if (!meta) return;
      const buffer = await asyncBufferFromUrl(meta.url);
      parquetRead({
        file: buffer,
        onComplete: (data) => {
          // let pts = []
          // console.log("DATA", data)
          let fts = data.map((f) => {
            // pts.push([f[2], f[3], parseInt(f[5])])
            return {
              feature: parseInt(f[0]),
              max_activation: f[1],
              label: f[6],
              order: f[7],
            };
          });
          // .filter(d => d.label.indexOf("linear") >= 0)
          // .sort((a,b) => a.order - b.order)
          setFeatures(fts);
        },
      });
    };
    if (scope?.sae_id) {
      // console.log("SAE ID", scope.sae_id, saeAvailable[scope.sae_id])
      asyncRead(saeAvailable[scope.embedding?.model_id]);
    }
  }, [scope]);

  const [clusterMap, setClusterMap] = useState({});
  const [clusterIndices, setClusterIndices] = useState([]);
  const [clusterLabels, setClusterLabels] = useState([]);

  const [scopeRows, setScopeRows] = useState([]);

  const [deletedIndices, setDeletedIndices] = useState([]);

  const fetchScopeRows = useCallback(() => {
    apiService
      .getScopeRows(userId, datasetId, scope.id)
      .then((scopeRows) => {
        scopeRows.forEach((row) => {
          row.ls_index = row.index;
        });
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