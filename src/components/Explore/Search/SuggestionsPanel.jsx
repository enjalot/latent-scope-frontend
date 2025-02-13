// SuggestionsPanel.jsx
import React from 'react';

/*
 * SuggestionsPanel displays a list of suggestions when there is no active search query.
 * Each suggestion is clickable, triggering the onSelect callback to update the query.
 */
const SuggestionsPanel = ({ suggestions, onSelect }) => (
  <div className="suggestions-panel">
    {suggestions.map((suggestion, idx) => (
      <div key={idx} onClick={() => onSelect(suggestion)}>
        {suggestion}
      </div>
    ))}
  </div>
);

export default SuggestionsPanel;
