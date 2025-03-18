import { useCallback, useState, useEffect } from 'react';
import { useSearch } from '../../contexts/SearchContext';
import Search from './Search';
import SearchResults from './SearchResults';
import Examples from './Examples';

function SearchInline({
  defaultQuery = 'cows',
  examples = ['cows', 'feline stuff', 'Will Smith', 'winter holidays'],
}) {
  const { query, results, loading, handleSearch, setQuery, dataset, scope } = useSearch();
  const [initialSearchDone, setInitialSearchDone] = useState(false);

  // Run initial search only once
  useEffect(() => {
    if (!initialSearchDone && scope) {
      setQuery(defaultQuery);
      handleSearch(defaultQuery);
      setInitialSearchDone(true);
    }
  }, [handleSearch, setQuery, initialSearchDone, scope, defaultQuery]);

  const handleExampleClick = useCallback(
    (example) => {
      setQuery(example);
      handleSearch(example);
    },
    [handleSearch, setQuery]
  );

  return (
    <>
      <Examples examples={examples} onSelectExample={handleExampleClick} />
      <Search defaultQuery={query} onSearch={handleSearch} value={query} onChange={setQuery} />
      <SearchResults
        results={results}
        loading={loading}
        dataset={dataset}
        numToShow={10}
        showIndex={false}
      />
    </>
  );
}

export default SearchInline;
