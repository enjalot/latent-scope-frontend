import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../lib/apiService';

const useColumnFilter = (userId, datasetId, scope) => {
  const [columnToValue, setColumnToValue] = useState({});

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

  const filter = async (filters) => {
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
    return apiService.columnFilter(userId, datasetId, scope?.id, query);
  };

  return {
    columnToValue,
    columnFilters,
    filter,
  };
};

export default useColumnFilter;
