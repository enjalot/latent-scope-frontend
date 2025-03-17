import React, { createContext, useContext, useState } from 'react';
import { apiService } from '../lib/apiService';
import { useScope } from './ScopeContext';
const SearchContext = createContext();
import cows from '../essays/cached/cows.json';

export function SearchProvider({ children }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [distances, setDistances] = useState([]);
  const [indices, setIndices] = useState([]);

  // We'll need these to make the API call
  const { userId, datasetId, scopeId, scope, dataset } = useScope();

  const handleSearch = async (searchQuery) => {
    if (!userId || !datasetId || !scope) {
      console.error('Search requires userId, datasetId, and scopeId to be set');
      return;
    }

    setQuery(searchQuery);
    setLoading(true);
    try {
      // Use the actual API service instead of the mock function
      if (searchQuery === 'cows') {
        setResults(cows);
        setLoading(false);
        return;
      }
      const data = await apiService.searchNearestNeighbors(userId, datasetId, scope, searchQuery);
      const rows = await apiService.getRowsByIndices(userId, datasetId, scope.id, data.indices);
      // Only update state if this is the latest request.
      const rowsWithIdx = rows.map((row, idx) => ({
        ...row,
        idx,
        ls_index: row.index,
        ls_distance: data.distances[idx],
      }));
      setResults(rowsWithIdx);
    } catch (error) {
      console.error('Error searching nearest neighbors:', error);
      setResults([]);
      setDistances([]);
      setIndices([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SearchContext.Provider
      value={{
        query,
        results,
        loading,
        handleSearch,
        setQuery,
        distances,
        indices,
        userId,
        datasetId,
        scopeId,
        scope,
        dataset,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}
