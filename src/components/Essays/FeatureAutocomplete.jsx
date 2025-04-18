import React, { useState, useMemo, useRef, useEffect } from 'react';
import styles from './FeatureAutocomplete.module.scss';
import FeaturePill from './FeaturePill';

const FeatureAutocomplete = ({ currentFeature, features, onSelect, placeholder }) => {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredFeatures = useMemo(() => {
    if (!search && !showDropdown) return [];
    if (!search) return features.slice(0, 10);
    return features
      .filter(
        (f) =>
          f.label.toLowerCase().includes(search.toLowerCase()) ||
          f.feature.toString().includes(search)
      )
      .slice(0, 10);
  }, [search, features, showDropdown]);

  useEffect(() => {
    if (showDropdown && inputRef.current && dropdownRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      let w = rect.width;
      if (w < 300) {
        w = 300;
      }
      dropdownRef.current.style.top = `${rect.bottom}px`;
      dropdownRef.current.style.left = `${rect.left}px`;
      dropdownRef.current.style.width = `${w}px`;
    }
  }, [showDropdown, filteredFeatures]);

  return (
    <div className={styles.featureSelector}>
      <div className={styles.editablelabelContainer}>
        {currentFeature && <FeaturePill feature={currentFeature} />}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(true);
          }}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={currentFeature ? currentFeature.label : placeholder || 'Search features...'}
          className={styles.featureSearch}
        />
      </div>
      {showDropdown && filteredFeatures.length > 0 && (
        <div ref={dropdownRef} className={styles.featureDropdown}>
          {filteredFeatures.map((feature) => (
            <div
              key={feature.feature}
              className={styles.featureOption}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(feature);
                setSearch('');
                setShowDropdown(false);
              }}
            >
              <FeaturePill feature={feature} />
              <span className={styles.featureLabel}>{feature.label}</span>
              <span className={styles.featureCount}>{feature.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeatureAutocomplete;
