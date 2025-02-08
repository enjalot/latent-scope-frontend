import React, { useState, useMemo } from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { useScope } from '../../contexts/ScopeContext';
import styles from './FeatureFilterV2.module.scss';

export default function FeatureFilterV2() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { scope, features } = useScope();
  const { featureFilter, setUrlParams } = useFilter();
  const { feature, featureIndices, setFeature, setFeatureIndices, threshold, setThreshold } =
    featureFilter;

  const items = useMemo(
    () =>
      features
        ?.map((f) => ({
          value: f.feature,
          label: `(${f.feature}) ${f.label}`,
        }))
        .filter((f) => scope?.sae?.max_activations[f.value] !== 0) || [],
    [features, scope]
  );

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter((item) => item.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [items, searchTerm]);

  const selectedFeature = useMemo(() => items.find((f) => f.value === feature), [items, feature]);

  const handleClear = () => {
    setFeature(-1);
    setFeatureIndices([]);
    setUrlParams((prev) => {
      prev.delete('feature');
      return prev;
    });
  };

  return (
    <div className={styles.filterContainer}>
      <button className={styles.filterButton} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.filterButtonContent}>
          {feature >= 0 && (
            <span
              className={styles.clearX}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              ×
            </span>
          )}
          {selectedFeature ? selectedFeature.label : 'Features'}{' '}
          {featureIndices?.length ? `(${featureIndices.length})` : ''}▼
        </div>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="Search features..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {filteredItems.map((item) => (
            <label key={item.value} className={styles.featureRow}>
              <input
                type="radio"
                checked={feature === item.value}
                onChange={() => {
                  setFeature(item.value);
                  setUrlParams((prev) => {
                    prev.set('feature', item.value);
                    return prev;
                  });
                }}
              />
              <span>{item.label}</span>
            </label>
          ))}

          {feature >= 0 && (
            <div className={styles.thresholdContainer}>
              <label>Activation Threshold: {threshold}</label>
              <input
                type="range"
                min={0.01}
                max={scope?.sae?.max_activations[feature] || 0.1}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className={styles.thresholdSlider}
              />
            </div>
          )}

          <div className={styles.actions}>
            <button onClick={handleClear}>Clear</button>
            <button onClick={() => setIsOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
