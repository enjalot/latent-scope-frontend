import React, { useState, useRef, useEffect } from 'react';
import { useFilter } from '../../contexts/FilterContext';
import styles from './ClusterFilterV2.module.scss';

export default function ClusterFilterV2({ clusterLabels }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { clusterFilter, setUrlParams, setActiveFilterTab, filterConstants } = useFilter();
  const { cluster, setCluster, clusterIndices } = clusterFilter;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    // Add event listener when dropdown is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup listener when component unmounts or dropdown closes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClear = () => {
    setCluster(null);
    setUrlParams((prev) => {
      prev.delete('cluster');
      return prev;
    });
  };

  const handleDone = () => {
    setIsOpen(false);
  };

  return (
    <div className={styles.filterContainer} ref={dropdownRef}>
      <button className={styles.filterButton} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.filterButtonContent}>
          {cluster && (
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
          {cluster ? cluster.label : 'Clusters'}{' '}
          {clusterIndices?.length ? `(${clusterIndices.length})` : ''}▼
        </div>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {clusterLabels?.map((cl) => (
            <label key={cl.cluster} className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={cluster?.cluster === cl.cluster}
                onChange={() => {
                  if (cluster?.cluster === cl.cluster) {
                    handleClear();
                  } else {
                    setCluster(cl);
                    setActiveFilterTab(filterConstants.CLUSTER);
                    setUrlParams((prev) => {
                      prev.set('cluster', cl.cluster);
                      return prev;
                    });
                  }
                  setIsOpen(false);
                }}
              />
              <span>
                {cl.label} ({cl.count})
              </span>
            </label>
          ))}

          <div className={styles.actions}>
            <button onClick={handleClear}>Clear</button>
            <button onClick={handleDone}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
