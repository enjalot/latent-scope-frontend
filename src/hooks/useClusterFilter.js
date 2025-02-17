import { useState, useEffect } from 'react';

export default function useClusterFilter({
  scopeRows,
  scope,
  scopeLoaded,
  urlParams,
  setFilteredIndices,
}) {
  const [cluster, setCluster] = useState(null);
  // const [clusterIndices, setClusterIndices] = useState([]);
  const [active, setActive] = useState(false); // true if a cluster filter is active
  const [loading, setLoading] = useState(false);

  // Update cluster indices when cluster changes
  useEffect(() => {
    if (cluster) {
      setLoading(true);
      const annots = scopeRows.filter((d) => d.cluster === cluster.cluster);
      const indices = annots.map((d) => d.ls_index);
      // setFilteredIndices(indices);
      setActive(true);
      setLoading(false);
    } else {
      // setFilteredIndices([]);
      setActive(false);
    }
  }, [cluster, scopeRows, scopeLoaded]);

  return {
    cluster,
    setCluster,
    // clusterIndices,
    // setClusterIndices,
    active,
    loading,
  };
}
