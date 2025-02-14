// SuggestionsPanel.jsx
import React from 'react';
import PropTypes from 'prop-types';
import styles from './SuggestionsPanel.module.scss';

/*
 * SuggestionsPanel displays a list of suggestions when there is no active search query.
 * Each suggestion is clickable, triggering the onSelect callback to update the query.
 */
const SuggestionsPanel = ({ onSelect }) => {
  const suggestions = [
    'Search for points by cluster',
    'Search for points by feature',
    'Search for points by column',
    'Or, start typing to search for points using a nearest neighbors query',
  ];

  return (
    <div className={styles.suggestionsList}>
      {suggestions.map((suggestion, index) => (
        <div key={index} className={styles.suggestionRow} onClick={() => onSelect(suggestion)}>
          <div className={styles.suggestionContent}>
            <span>{suggestion}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

SuggestionsPanel.propTypes = {
  onSelect: PropTypes.func.isRequired,
};

export default SuggestionsPanel;
