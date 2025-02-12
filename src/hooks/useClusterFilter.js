import { useState, useEffect } from 'react';

export default function useClusterFilter({ scopeRows, scope, scopeLoaded, urlParams }) {
  const [cluster, setCluster] = useState(null);
  const [clusterIndices, setClusterIndices] = useState([]);
  const [active, setActive] = useState(false); // true if a cluster filter is active
  const [loading, setLoading] = useState(false);
  // Initialize cluster from URL params
  useEffect(() => {
    if (scopeLoaded && urlParams.has('cluster')) {
      setActive(true);
      const clusterParam = parseInt(urlParams.get('cluster'));
      const clusterFromParam = scope?.cluster_labels_lookup?.[clusterParam];
      if (clusterFromParam) {
        setCluster(clusterFromParam);
      }
    }
  }, [scopeLoaded, urlParams, scope]);

  // Update cluster indices when cluster changes
  useEffect(() => {
    if (cluster) {
      setLoading(true);
      const annots = scopeRows.filter((d) => d.cluster === cluster.cluster);
      const indices = annots.map((d) => d.ls_index);
      setClusterIndices(indices);
      setActive(true);
      setLoading(false);
    } else {
      setClusterIndices([]);
      setActive(false);
    }
  }, [cluster, scopeRows, scopeLoaded]);

  return {
    cluster,
    setCluster,
    clusterIndices,
    setClusterIndices,
    active,
    loading,
  };
}
