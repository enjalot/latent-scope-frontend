import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../lib/apiService';

export default function useNearestNeighborsSearch({
  userId,
  datasetId,
  scope,
  // onSearchEmbedding,
  deletedIndices,
  searchText,
  setSearchText,
}) {
  const [searchIndices, setSearchIndices] = useState([]);
  const [distances, setDistances] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(
    async (query) => {
      setIsLoading(true);
      apiService.searchNearestNeighbors(userId, datasetId, scope, query).then((data) => {
        const inds = data.indices.filter((d) => {
          return !deletedIndices.includes(d)
        })
        setDistances(data.distances);
        const limit = 20;
        // TODO: make the # of results configurable
        setSearchIndices(inds.slice(0, limit));
        setIsLoading(false)
        // onSearchEmbedding?.(data.search_embedding[0]);
      })
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

  return {
    setSearchIndices,
    searchIndices,
    distances,
    isLoading,
    search,
    clearSearch,
  };
}
