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
      console.log('userId', userId);
      console.log('datasetId', datasetId);
      console.log('scope', scope);
      return;
    }

    setQuery(searchQuery);
    setLoading(true);
    try {
      // Use the actual API service instead of the mock function
      // if (searchQuery === 'cows') {
      //   setResults(cows);
      //   setLoading(false);
      //   return;
      // }
      const data = await apiService.searchNearestNeighbors(
        userId,
        datasetId,
        scope,
        searchQuery,
        true
      );
      // The nearest-neighbor endpoint only returns { index, _distance } (no text),
      // so hydrate the top matches with getRowsByIndices to pull in the text column.
      const topMatches = (data || []).slice(0, 100);
      const indices = topMatches.map((match) => match.index);
      const rows = indices.length
        ? await apiService.getRowsByIndices(userId, datasetId, scope.id, indices)
        : [];
      const rowByIndex = new Map(rows.map((row) => [row.index, row]));
      const rowsWithIdx = topMatches
        .map((match, idx) => {
          const row = rowByIndex.get(match.index);
          if (!row) return null;
          return {
            ...row,
            idx,
            ls_index: row.index,
            ls_distance: match._distance,
            _distance: match._distance,
          };
        })
        .filter(Boolean);
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
