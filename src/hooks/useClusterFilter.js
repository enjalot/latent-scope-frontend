import { useState, useEffect } from 'react';

export default function useClusterFilter({
  scopeRows,
  scope,
  scopeLoaded,
  urlParams,
  setUrlParams,
}) {
  const [cluster, setCluster] = useState(null);
  const [clusterIndices, setClusterIndices] = useState([]);

  // Initialize cluster from URL params
  useEffect(() => {
    console.log('scopeLoaded', scopeLoaded, urlParams);
    if (scopeLoaded && urlParams.has('cluster')) {
      const clusterParam = parseInt(urlParams.get('cluster'));
      const clusterFromParam = scope?.cluster_labels_lookup?.[clusterParam];
      console.log('PARAMS', clusterParam);
      console.log('clusterFromParam', clusterFromParam);
      if (clusterFromParam) {
        setCluster(clusterFromParam);
      }
    }
  }, [scopeLoaded, urlParams, scope]);

  // Update cluster indices when cluster changes
  useEffect(() => {
    if (cluster) {
      const annots = scopeRows.filter((d) => d.cluster === cluster.cluster);
      const indices = annots.map((d) => d.ls_index);
      setClusterIndices(indices);

      // Update URL params
      setUrlParams((prev) => {
        prev.set('cluster', cluster.cluster);
        return prev;
      });
    } else {
      setClusterIndices([]);

      // Remove cluster from URL params if scope is loaded
      if (scopeLoaded) {
        setUrlParams((prev) => {
          prev.delete('cluster');
          return prev;
        });
      }
    }
  }, [cluster, scopeRows, scopeLoaded, setUrlParams]);

  return {
    cluster,
    setCluster,
    clusterIndices,
    setClusterIndices,
  };
}
