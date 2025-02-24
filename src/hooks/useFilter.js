import { useState, useEffect } from 'react';
import { apiService } from '../lib/apiService';

export default function useFilter({ scopeRows, scope, scopeLoaded }) {
  const [filterQuery, setFilterQuery] = useState('');
  const [filteredIndices, setFilteredIndices] = useState([]);

  // Active / Loading States
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // ===== Cluster Filter =====
  const [cluster, setCluster] = useState(null);

  useEffect(() => {
    if (cluster) {
      setActive(true);
      setLoading(true);
      const annots = scopeRows.filter((d) => d.cluster === cluster.cluster);
      const indices = annots.map((d) => d.ls_index);
      setFilteredIndices(indices);
      setLoading(false);
    }
  }, [cluster, scopeRows, scopeLoaded]);

  // ===== Column Filter =====
  const [column, setColumn] = useState(null);

  // ===== Feature Filter =====
  const [feature, setFeature] = useState(null);

  // ===== Search Filter =====
  const [searchText, setSearchText] = useState(null);
  const [distances, setDistances] = useState([]);

  const search = useCallback(
    async (query) => {
      setLoading(true);
      apiService.searchNearestNeighbors(userId, datasetId, scope, query).then((data) => {
        const inds = data.indices.filter((d) => {
          return !deletedIndices.includes(d);
        });
        setDistances(data.distances);
        const limit = 20;
        setFilteredIndices(inds.slice(0, limit));
        setLoading(false);
      });
    },
    [datasetId, scope]
  );

  useEffect(() => {
    if (searchText) {
      setActive(true);
      setLoading(true);
      search(searchText);
    }
  }, [search, searchText]);

  return {
    filterQuery,
    setFilterQuery,
    filteredIndices,
    setFilteredIndices,
    active,
    loading,

    // i feel like these should be encapsulated and not returned.
    // if my component logic is correct then these should be internal to the hook.
    // let's see.
    // cluster,
    // setCluster,
    // column,
    // setColumn,
    // feature,
    // setFeature,
    // searchText,
    // setSearchText,
  };
}
