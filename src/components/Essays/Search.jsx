import React, { useState, useEffect } from 'react';
import { Button } from 'react-element-forge';
import styles from './Search.module.scss';

function Search({ defaultQuery = '', onSearch, value, onChange }) {
  const [localQuery, setLocalQuery] = useState(defaultQuery);

  // Use the controlled value if provided
  const query = value !== undefined ? value : localQuery;
  const setQuery = onChange || setLocalQuery;

  // Set initial query from prop
  useEffect(() => {
    if (defaultQuery && !value) {
      setLocalQuery(defaultQuery);
      // Trigger search with the default query on component mount
      if (onSearch) onSearch(defaultQuery);
    }
  }, [defaultQuery, onSearch, value]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
    // If no onSearch prop, the parent SearchContext will handle it
  };

  return (
    <div className={styles.searchContainer}>
      <form onSubmit={handleSearch}>
        <div className={styles.searchBar}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dad jokes..."
            className={styles.searchInput}
          />
          <Button type="submit" size="medium" className={styles.searchButton} icon="search" />
        </div>
      </form>
    </div>
  );
}

export default Search;
