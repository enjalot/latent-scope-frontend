import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../lib/apiService';

const useColumnFilter = (userId, datasetId, scope) => {
  const [columnFiltersActive, setColumnFiltersActive] = useState({});
  const [columnIndices, setColumnIndices] = useState([]);
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
      .filter((d) => d.counts);
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
        setColumnIndices(indices.map((d) => d.index));
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
    } else if (setColumnIndices) {
      setColumnIndices([]);
      setActive(false);
    }
  }, [columnFiltersActive, columnQuery, setColumnIndices]);

  return {
    columnFiltersActive,
    setColumnFiltersActive,
    columnFilters,
    columnIndices,
    setColumnIndices,
    active,
    loading,
  };
};

export default useColumnFilter;
