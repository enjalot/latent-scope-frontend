import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { apiService } from '../lib/apiService';
import styles from './MobileFilterDataTable.module.scss';
import { useFilter } from '../contexts/FilterContext';
import { useScope } from '../contexts/ScopeContext';

const DataRow = memo(({ dataset, row, isHighlighted, onHover, onClick, clusterMap, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`${styles.dataRow} ${isHighlighted ? styles.highlighted : ''}`}
      onMouseEnter={() => onHover(row.ls_index)}
      onMouseLeave={() => onHover(null)}
    >
      <div className={styles.rowIndex}>
        <div className={styles.indexCircle}>{index + 1}</div>
      </div>
      <div className={styles.rowPreview}>
        <div className={styles.rowText}>
          {/* <p className={styles.textPreview}>{row[dataset.text_column]}</p> */}
          {row[dataset.text_column]}
        </div>
        <div className={styles.rowCluster}>
          <p className={styles.textPreview}>{clusterMap[row.ls_index]?.label}</p>
        </div>
      </div>

      {/* {isExpanded && (
        <div className="row-details">
          {row.ls_cluster && (
            <div className="detail-item">
              <p className="detail-label">Cluster</p>
              <p className="detail-value">{row.ls_cluster}</p>
            </div>
          )}
          {row.ls_similarity && (
            <div className="detail-item">
              <p className="detail-label">Similarity</p>
              <p className="detail-value">{parseFloat(1 - row.ls_similarity).toFixed(4)}</p>
            </div>
          )}
          <div className="full-text">
            <p className="detail-label">Full Text</p>
            <p className="detail-value">{row[dataset.text_column].slice(0, 20)}...</p>
          </div>
        </div>
      )} */}
    </div>
  );
});

function MobileFilterDataTable({
  dataset,
  onHover = () => {},
  page,
  setPage,
  filterLoading = false,
  onClick,
}) {
  const { clusterMap } = useScope();

  const { dataTableRows, totalPages, filterConfig, filterActive, loading } = useFilter();

  const DEFAULT_HEIGHT = 150;

  const rowsPerPage = 10;
  const [pageCount, setPageCount] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [containerHeight, setContainerHeight] = useState(DEFAULT_HEIGHT); // Default height
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const containerRef = useRef(null);

  // Calculate page count - moved outside of useEffect
  const calculatePageCount = useCallback(() => {
    return Math.ceil(dataTableRows.length / rowsPerPage);
  }, [dataTableRows.length]);

  // Update page count
  useEffect(() => {
    const newPageCount = calculatePageCount();
    setPageCount(newPageCount);

    // Ensure current page is valid
    if (page >= newPageCount) {
      setPage(Math.max(0, newPageCount - 1));
    }
  }, [calculatePageCount, page, setPage]);

  // Handle touch start
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setStartY(touch.clientY);
    setStartHeight(containerHeight);
    setIsDragging(true);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    const deltaY = startY - touch.clientY;
    const newHeight = Math.max(DEFAULT_HEIGHT, Math.min(800, startHeight + deltaY));
    setContainerHeight(newHeight);
  };

  // Handle touch end
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
          <button onClick={() => setPage(0)} disabled={page === 0}>
            First
          </button>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            ←
          </button>
          <div className={styles.dragPill}></div>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
          >
            →
          </button>
          <button onClick={() => setPage(pageCount - 1)} disabled={page === pageCount - 1}>
            Last
          </button>
        </div>
      </div>

      <div className={styles.filterDataTable}>
        {rowsLoading || filterLoading ? (
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
                index={index}
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
  page: PropTypes.number,
  setPage: PropTypes.func,
  useDefaultIndices: PropTypes.bool,
  filterLoading: PropTypes.bool,
};

export default memo(MobileFilterDataTable);
