import React, { useState, useCallback, memo, useRef, useEffect, useMemo } from 'react';
import styles from './SearchResults.module.scss';
import { rgb } from 'd3-color';
import LoadingSpinner from '../LoadingSpinner';
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
    showFeatureActivation = false,
    feature = null,
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

    // Find feature activation value if needed
    let activationValue = null;
    if (showFeatureActivation && feature && result.sae_indices && result.sae_acts) {
      const featureIndex = result.sae_indices.indexOf(feature.feature);
      if (featureIndex !== -1) {
        activationValue = result.sae_acts[featureIndex];
      }
    }
    const colorString = useMemo(() => {
      let c = rgb(feature?.color);
      c.opacity = 0.55;
      return c.toString();
    }, [feature]);

    // Determine if we should show distance or activation
    const showDistanceElement = showDistance && !showFeatureActivation;

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
            className={`${styles.cardText} 
              ${showDistanceElement || (showFeatureActivation && activationValue !== null) ? styles.showDistance : ''} 
              ${showIndex ? styles.showIndex : ''} 
              ${isExpanded ? styles.expandedText : ''}`}
          >
            {result[dataset.text_column]}
          </div>
          {showDistanceElement && (
            <div className={styles.distance}>{(1 - result.ls_distance)?.toFixed(2)}</div>
          )}
          {showFeatureActivation && activationValue !== null && (
            <div
              className={styles.featureActivation}
              style={{
                backgroundColor: colorString || 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <span className={styles.activationValue}>{activationValue.toFixed(2)}</span>
            </div>
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
  showFeatureActivation = false,
  feature = null,
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

  if (results?.length === 0) {
    return <div className={styles.noResults}>No matching results found.</div>;
  }

  return (
    <div className={styles.searchResults}>
      <div className={styles.resultsContainer}>
        {results?.length &&
          results
            .slice(0, numToShow)
            .map((result, index) => (
              <ResultRow
                key={(result.id || '') + (result.index || '') + (index || '')}
                index={result.index}
                result={result}
                isHighlighted={false}
                isSelected={
                  selected &&
                  ((selected.index === result.index && result.index !== undefined) ||
                    (selected.id === result.id &&
                      result[dataset.text_column] === selected[dataset.text_column]))
                }
                showIndex={showIndex}
                showDistance={showDistance}
                onHover={onHover}
                onSelect={handleSelect}
                dataset={dataset}
                selectable={selectable}
                showFeatureActivation={showFeatureActivation}
                feature={feature}
              />
            ))}
      </div>
      {loading && <LoadingSpinner message="Loading results..." />}
    </div>
  );
}

export default memo(SearchResults);
