import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../lib/apiService';

const useColumnFilter = (userId, datasetId, scope, setAllFilteredIndices) => {
  const [columnFiltersActive, setColumnFiltersActive] = useState({});
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const dataset = useMemo(() => {
    return scope?.dataset;
  }, [scope]);

  const columnFilters = useMemo(() => {
    if (!dataset?.column_metadata) return [];
    return Object.keys(dataset.column_metadata)
      .map((column) => ({
        column: column,
        categories: dataset.column_metadata[column].categories,
        counts: dataset.column_metadata[column].counts,
      }))
      .filter((d) => d.counts && Object.keys(d.counts).length > 1);
  }, [dataset]);

  const columnQuery = useCallback(
    (filters) => {
      setLoading(true);
      let query = [];
      Object.keys(filters).forEach((c) => {
        let f = filters[c];
        if (f) {
          query.push({
            column: c,
            type: 'eq',
            value: f,
          });
        }
      });
      apiService.columnFilter(userId, datasetId, scope?.id, query).then((indices) => {
        setAllFilteredIndices(indices.map((d) => d.index));
        setLoading(false);
      });
    },
    [userId, datasetId, scope]
  );

  useEffect(() => {
    let activeFilters = Object.values(columnFiltersActive).filter((d) => !!d).length;
    // console.log("active filters", activeFilters, columnFiltersActive)
    if (activeFilters > 0) {
      columnQuery(columnFiltersActive);
      setActive(true);
    } else if (setAllFilteredIndices) {
      setAllFilteredIndices([]);
      setActive(false);
    }
  }, [columnFiltersActive, columnQuery, setAllFilteredIndices]);

  return {
    columnFiltersActive,
    setColumnFiltersActive,
    columnFilters,
    active,
    loading,
  };
};

export default useColumnFilter;
