import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../lib/apiService';

export default function useNearestNeighborsSearch({
  userId,
  datasetId,
  scope,
  deletedIndices,
  urlParams,
  scopeLoaded,
  setFilteredIndices,
}) {
  const [searchText, setSearchText] = useState('');
  const [distances, setDistances] = useState([]);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (query) => {
      setLoading(true);
      apiService.searchNearestNeighbors(userId, datasetId, scope, query).then((data) => {
        const inds = data.indices.filter((d) => {
          return !deletedIndices.includes(d);
        });
        setDistances(data.distances);
        const limit = 20;
        // TODO: make the # of results configurable
        setFilteredIndices(inds.slice(0, limit));
        setLoading(false);
        // onSearchEmbedding?.(data.search_embedding[0]);
      });
    },
    [datasetId, scope]
  );

  const clearSearch = useCallback(() => {
    setSearchText('');
    setFilteredIndices([]);
    setDistances([]);
    setActive(false);
  }, []);

  // Trigger search when searchText changes
  useEffect(() => {
    if (searchText) {
      search(searchText);
      setActive(true);
    } else {
      setActive(false);
    }
  }, [searchText, search]);

  // Initialize search from URL params
  useEffect(() => {
    if (scopeLoaded && urlParams.has('search')) {
      const searchParam = urlParams.get('search');
      setSearchText(searchParam);
    }
  }, [scopeLoaded, urlParams]);

  return {
    searchText,
    setSearchText,
    distances,
    clearSearch,
    active,
    loading,
  };
}
