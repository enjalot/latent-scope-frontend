import React from 'react';
import PropTypes from 'prop-types';
import styles from './SearchResults.module.scss';

const SearchResults = ({ query, onSearch }) => {
  const handleSearchClick = () => {
    console.log('Triggering nearest neighbor search for:', query);
    onSearch(query);
  };

  return (
    <div className={styles.resultsList}>
      {/* Nearest Neighbor Search Option */}
      <div className={styles.resultRow} onClick={handleSearchClick}>
        <div className={styles.resultContent}>
          <span className={styles.searchIcon}>🔍</span>
          <span>Search for similar content to: "{query}"</span>
        </div>
      </div>

      {/* Filter Results */}
      <div className={styles.resultRow}>
        <div className={styles.resultContent}>
          <span>Cluster: Result 1</span>
        </div>
      </div>
      <div className={styles.resultRow}>
        <div className={styles.resultContent}>
          <span>Feature: Result 2</span>
        </div>
      </div>
    </div>
  );
};

SearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired,
};

export default SearchResults;
