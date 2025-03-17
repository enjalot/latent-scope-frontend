import React, { useState, useCallback, memo, useRef } from 'react';
import styles from './SearchResults.module.scss';

const ResultRow = memo(
  ({ result, isHighlighted, onHover, index, dataset, showIndex = true, showDistance = true }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const expand = useCallback(() => setIsExpanded(!isExpanded), [isExpanded]);

    return (
      <div
        className={`${styles.resultCard} ${isHighlighted ? styles.highlighted : ''} ${isExpanded ? styles.expanded : ''}`}
        onMouseEnter={() => onHover(result.id || index)}
        onMouseLeave={() => onHover(null)}
        // onClick={expand}
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
  onClick = () => {},
}) {
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
  console.log(results.slice(0, numToShow));

  return (
    <div className={styles.searchResults}>
      <div className={styles.resultsContainer}>
        {results.slice(0, numToShow).map((result, index) => (
          <ResultRow
            key={result.id || index}
            index={result.index}
            result={result}
            isHighlighted={false}
            showIndex={showIndex}
            showDistance={showDistance}
            onHover={onHover}
            onClick={onClick}
            dataset={dataset}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(SearchResults);
