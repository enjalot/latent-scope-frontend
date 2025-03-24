import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import styles from './SearchResults.module.scss';

const ResultRow = memo(
  ({
    result,
    isHighlighted,
    isSelected,
    onHover,
    onSelect,
    index,
    dataset,
    showIndex = true,
    showDistance = true,
    selectable = false,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const expand = useCallback(() => setIsExpanded(!isExpanded), [isExpanded]);

    const handleClick = useCallback(() => {
      if (selectable) {
        onSelect(result);
      } else {
        expand();
      }
    }, [selectable, onSelect, result, expand]);

    return (
      <div
        className={`${styles.resultCard} ${isHighlighted ? styles.highlighted : ''} ${isExpanded ? styles.expanded : ''} ${isSelected ? styles.selected : ''} ${selectable ? styles.selectable : ''}`}
        onMouseEnter={() => onHover(result.id || index)}
        onMouseLeave={() => onHover(null)}
        onClick={handleClick}
      >
        {showIndex && <div className={styles.indexBadge}>{index + 1}</div>}
        <div className={`${styles.cardContent}`}>
          <div
            className={`${styles.cardText} ${showDistance ? styles.showDistance : ''} ${showIndex ? styles.showIndex : ''} ${isExpanded ? styles.expandedText : ''}`}
          >
            {result[dataset.text_column]}
          </div>
          {showDistance && (
            <div className={styles.distance}>{(1 - result.ls_distance)?.toFixed(2)}</div>
          )}
        </div>
      </div>
    );
  }
);

function SearchResults({
  dataset,
  results = [],
  numToShow = 10,
  showIndex = true,
  showDistance = true,
  loading = false,
  onHover = () => {},
  onSelect = () => {},
  selectedResult = null,
  initialSelectedIndex = null,
  selectable = false,
}) {
  // State to track the selected result
  const [selected, setSelected] = useState(null);

  // Initialize with the initial selected index if provided
  useEffect(() => {
    if (selectable) {
      if (initialSelectedIndex !== null && results.length > initialSelectedIndex) {
        setSelected(results[initialSelectedIndex]);
        onSelect(results[initialSelectedIndex]);
      } else if (selectedResult) {
        setSelected(selectedResult);
      }
    }
  }, [initialSelectedIndex, results, selectedResult, onSelect, selectable]);

  // Handle row selection
  const handleSelect = useCallback(
    (result) => {
      if (selectable) {
        setSelected(result);
        onSelect(result);
      }
    },
    [onSelect, selectable]
  );

  if (loading) {
    return (
      <div className={styles.searchResults}>
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <div>Loading results...</div>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return <div className={styles.noResults}>No matching results found.</div>;
  }
  // console.log('=== Search Results ===');
  // console.log(results.slice(0, numToShow));
  // console.log(selected);

  return (
    <div className={styles.searchResults}>
      <div className={styles.resultsContainer}>
        {results.slice(0, numToShow).map((result, index) => (
          <ResultRow
            key={result.id || index}
            index={result.index}
            result={result}
            isHighlighted={false}
            isSelected={selected && selected.index === result.index && result.index !== undefined}
            showIndex={showIndex}
            showDistance={showDistance}
            onHover={onHover}
            onSelect={handleSelect}
            dataset={dataset}
            selectable={selectable}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(SearchResults);
