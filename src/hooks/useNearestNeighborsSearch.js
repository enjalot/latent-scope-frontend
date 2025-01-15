import { useState, useCallback, useEffect } from 'react';
import { apiUrl, apiService } from '../lib/apiService';

export default function useNearestNeighborsSearch({
  datasetId,
  scope,
  onSearchEmbedding,
  deletedIndices,
  searchText,
  setSearchText,
}) {
  const [searchIndices, setSearchIndices] = useState([]);
  const [distances, setDistances] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(
    async (query) => {
      const emb = scope?.embedding
      const embeddingDimensions = emb?.dimensions;

      const searchParams = new URLSearchParams({
        dataset: datasetId,
        query,
        embedding_id: scope.embedding_id,
        ...(embeddingDimensions !== undefined ? { dimensions: embeddingDimensions } : {}),
      });

      setIsLoading(true);
      try {
        const response = await fetch(`${apiUrl}/search/nn?${searchParams.toString()}`);
        const data = await response.json();

        let dists = [];
        let inds = data.indices
          .map((idx, i) => {
            dists[idx] = data.distances[i];
            return idx;
          })
          .filter((idx) => !deletedIndices.includes(idx));
        // TODO: handle deleted indices

        setDistances(dists);
        const limit = 20;
        // TODO: make the # of results configurable
        setSearchIndices(inds.slice(0, limit));
        onSearchEmbedding?.(data.search_embedding[0]);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl, datasetId, scope, onSearchEmbedding]
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
