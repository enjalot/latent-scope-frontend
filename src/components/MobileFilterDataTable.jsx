import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { apiService } from '../lib/apiService';
// import './FilterDataTable.css';
import './MobileFilterDataTable.css';

const DataRow = memo(({ dataset, row, isHighlighted, onHover, onClick, clusterMap, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // debugger;

  return (
    <div
      className={`data-row ${isHighlighted ? 'highlighted' : ''}`}
      onMouseEnter={() => onHover(row.ls_index)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="row-index">
        <div className="index-circle">{index + 1}</div>
      </div>
      <div className="row-preview">
        <div className="row-text">
          <p className="text-preview">{row[dataset.text_column]}</p>
        </div>
        <div className="row-cluster">
          <p className="text-preview">{clusterMap[row.ls_index]?.label}</p>
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
  handleFeatureClick,
  dataset,
  scope,
  userId,
  filteredIndices = [],
  distances = [],
  clusterMap = {},
  onDataTableRows,
  showNavigation = true,
  sae_id = null,
  feature = -1,
  features = [],
  onHover = () => {},
  deletedIndices = [],
  page,
  setPage,
  useDefaultIndices = false,
  filterLoading = false,
  onClick,
}) {
  const DEFAULT_HEIGHT = 100;

  const [rows, setRows] = useState([]);
  // const [defaultRows, setDefaultRows] = useState([]);
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
    return Math.ceil(filteredIndices.length / rowsPerPage);
  }, [filteredIndices.length]);

  // Update page count
  useEffect(() => {
    const newPageCount = calculatePageCount();
    setPageCount(newPageCount);

    // Ensure current page is valid
    if (page >= newPageCount) {
      setPage(Math.max(0, newPageCount - 1));
    }
  }, [calculatePageCount, page, setPage]);

  // Hydrate rows with data
  const hydrateIndices = useCallback(
    (indices, setRowsTarget) => {
      if (dataset && scope && indices.length) {
        setRowsLoading(true);
        let paged = indices.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

        if (paged.length) {
          apiService.getRowsByIndices(userId, dataset.id, scope.id, paged).then((rows) => {
            console.log({ rows });
            const rowsWithIdx = rows.map((row, idx) => ({
              ...row,
              idx,
              ls_index: row.index,
              // text_column: dataset.text_column,
              // ls_cluster: clusterMap[row.index]?.label,
              // ls_similarity: distances[idx],
            }));
            console.log({
              rowsWithIdx,
            });
            setRowsTarget(rowsWithIdx);
            onDataTableRows(rowsWithIdx);
            setRowsLoading(false);
          });
        } else {
          setRowsTarget([]);
          onDataTableRows && onDataTableRows([]);
          setRowsLoading(false);
        }
      } else {
        setRowsTarget([]);
        onDataTableRows && onDataTableRows([]);
        setRowsLoading(false);
      }
    },
    [dataset, page, sae_id, setRowsLoading]
  );

  // useEffect(() => {
  //   hydrateIndices(defaultIndices, setDefaultRows);
  // }, [defaultIndices, hydrateIndices]);

  useEffect(() => {
    // if (!useDefaultIndices) {
    const filteredWithoutDeleted = filteredIndices.filter((i) => !deletedIndices.includes(i));
    hydrateIndices(filteredWithoutDeleted, setRows);
    // }
  }, [filteredIndices, deletedIndices, page, hydrateIndices]);

  const displayRows = useMemo(() => {
    return rows;
  }, [rows]);

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

  if (filteredIndices.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`mobile-filter-data-table ${isDragging ? 'dragging' : ''}`}
      style={{ height: containerHeight }}
    >
      {/* Drag handle at the top */}
      <div
        className="drag-handle"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="drag-indicator">
          <button onClick={() => setPage(0)} disabled={page === 0}>
            First
          </button>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            ←
          </button>
          <div className="drag-pill" />
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

      <div className={`filter-data-table ${rowsLoading || filterLoading ? 'loading' : ''}`}>
        {rowsLoading || filterLoading ? (
          <div className="loading-overlay">
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <div>Loading</div>
            </div>
          </div>
        ) : (
          <div className="rows-container">
            {displayRows.map((row, index) => (
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
  filteredIndices: PropTypes.array.isRequired,
  defaultIndices: PropTypes.array.isRequired,
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
