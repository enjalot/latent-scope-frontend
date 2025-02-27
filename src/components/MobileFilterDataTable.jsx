import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { apiService } from '../lib/apiService';
import styles from './MobileFilterDataTable.module.scss';
import { useFilter } from '../contexts/FilterContext';
import { useScope } from '../contexts/ScopeContext';
import ClusterIcon from './Explore/Search/ClusterIcon';

const DataRow = memo(({ dataset, row, isHighlighted, onHover, onClick, clusterMap, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const expand = useCallback(() => setIsExpanded(!isExpanded), [isExpanded]);

  return (
    <div
      className={`${styles.dataRow} ${isHighlighted ? styles.highlighted : ''} ${isExpanded ? styles.expanded : ''}`}
      onMouseEnter={() => onHover(row.ls_index)}
      onMouseLeave={() => onHover(null)}
      onClick={expand}
    >
      <div className={styles.rowIndex}>
        <div className={styles.indexCircle}>{index + 1}</div>
      </div>
      <div className={styles.rowPreview}>
        <div className={`${styles.rowText} ${isExpanded ? styles.expandedText : ''}`}>
          {row[dataset.text_column]}
        </div>
        <div className={styles.rowCluster}>
          <p className={styles.textPreview}>
            <ClusterIcon cluster={row.ls_cluster} />
            {clusterMap[row.ls_index]?.label}
          </p>
        </div>
      </div>
    </div>
  );
});

function MobileFilterDataTable({ dataset, onHover = () => {}, filterLoading = false, onClick }) {
  const { clusterMap } = useScope();
  const { dataTableRows, totalPages, page, setPage, loading } = useFilter();

  const DEFAULT_HEIGHT = 150;
  const [containerHeight, setContainerHeight] = useState(DEFAULT_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const containerRef = useRef(null);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setStartY(touch.clientY);
    setStartHeight(containerHeight);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaY = startY - touch.clientY;
    const newHeight = Math.max(DEFAULT_HEIGHT, Math.min(800, startHeight + deltaY));
    setContainerHeight(newHeight);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (dataTableRows.length === 0) {
    return null;
  }

  return (
    <div className={styles.mobileFilterDataTable} style={{ height: containerHeight }}>
      <div
        className={styles.dragHandle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.dragIndicator}>
          <button
            onClick={() => setPage((prevPage) => Math.max(0, prevPage - 1))}
            disabled={page === 0}
          >
            ← {page - 1 >= 0 ? page : ''}
          </button>
          <div className={styles.dragPill}></div>
          <button
            onClick={() => setPage((prevPage) => Math.min(totalPages - 1, prevPage + 1))}
            disabled={page === totalPages - 1}
          >
            → {page + 1 < totalPages ? page + 2 : ''}
          </button>
        </div>
      </div>

      <div className={styles.filterDataTable}>
        {loading || filterLoading ? (
          <div className="loading-overlay">
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <div>Loading</div>
            </div>
          </div>
        ) : (
          <div className={styles.rowsContainer}>
            {dataTableRows.map((row, index) => (
              <DataRow
                key={row.ls_index}
                index={row.idx || index}
                row={row}
                isHighlighted={false}
                onHover={onHover}
                onClick={onClick}
                dataset={dataset}
                clusterMap={clusterMap}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

MobileFilterDataTable.propTypes = {
  dataset: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  scope: PropTypes.object,
  distances: PropTypes.array,
  clusterMap: PropTypes.object,
  onDataTableRows: PropTypes.func,
  showNavigation: PropTypes.bool,
  onHover: PropTypes.func,
  onClick: PropTypes.func,
  deletedIndices: PropTypes.array,
  useDefaultIndices: PropTypes.bool,
  filterLoading: PropTypes.bool,
};

export default memo(MobileFilterDataTable);
