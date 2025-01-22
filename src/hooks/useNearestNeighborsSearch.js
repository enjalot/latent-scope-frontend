import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../lib/apiService';

export default function useNearestNeighborsSearch({
  userId,
  datasetId,
  scope,
  deletedIndices,
  urlParams,
  scopeLoaded,
}) {
  const [searchText, setSearchText] = useState('');
  const [searchIndices, setSearchIndices] = useState([]);
  const [distances, setDistances] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const search = useCallback(
    async (query) => {
      setSearchLoading(true);
      apiService.searchNearestNeighbors(userId, datasetId, scope, query).then((data) => {
        const inds = data.indices.filter((d) => {
          return !deletedIndices.includes(d);
        });
        setDistances(data.distances);
        const limit = 20;
        // TODO: make the # of results configurable
        setSearchIndices(inds.slice(0, limit));
        setSearchLoading(false);
        // onSearchEmbedding?.(data.search_embedding[0]);
      });
    },
    [datasetId, scope]
  );

  const clearSearch = useCallback(() => {
    setSearchText('');
    setSearchIndices([]);
    setDistances([]);
  }, []);

  // Trigger search when searchText changes
  useEffect(() => {
    if (searchText) {
      search(searchText);
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
    setSearchIndices,
    searchIndices,
    distances,
    searchLoading,
    clearSearch,
  };
}
