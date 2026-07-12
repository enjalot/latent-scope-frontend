import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'react-tooltip';
import { useFilter } from '../contexts/FilterContext';
import { useScope } from '../contexts/ScopeContext';
import { tokenSnippet, cleanTokenString, DEFAULT_SNIPPET_WINDOW } from '../lib/tokenSnippet';
// import DataTable from './DataTable';
import 'react-data-grid/lib/styles.css';

import DataGrid, { Row } from 'react-data-grid';
import FeaturePlot from './FeaturePlot';

import { apiService } from '../lib/apiService';

import styles from './FilterDataTable.module.css';

FilterDataTable.propTypes = {
  height: PropTypes.string,
  dataset: PropTypes.object.isRequired,
  distances: PropTypes.array,
  clusterMap: PropTypes.object,
  onHover: PropTypes.func,
  onClick: PropTypes.func,
};

// Token-scope text cell: window the parent document's text around the token's
// character span and highlight the token in place (built from substring
// slices — no innerHTML). Tokens without a surface form (CLS/SEP/markers,
// char_start === -1) fall back to the plain truncated text plus a muted note.
function TokenSnippetCell({ row, column }) {
  const text = row[column];
  const snippet = tokenSnippet(text, row.char_start, row.char_end, DEFAULT_SNIPPET_WINDOW);
  if (!snippet) {
    const plain = typeof text === 'string' ? text : '';
    return (
      <span title={plain}>
        <span className={styles.tokenSpecialNote}>{row.token_str} (special token) </span>
        {plain.length > 2 * DEFAULT_SNIPPET_WINDOW
          ? `${plain.slice(0, 2 * DEFAULT_SNIPPET_WINDOW)}…`
          : plain}
      </span>
    );
  }
  // Three-segment flex so the highlighted token stays visible regardless of
  // cell width: the before-context clips from the LEFT (dir="rtl" on the
  // clipping span puts the ellipsis on the left; the inner <bdi dir="ltr">
  // isolates the text so its rendering order is unaffected), the
  // after-context clips from the right, and the token itself never shrinks.
  return (
    <span className={styles.tokenSnippetCell} title={text}>
      <span className={styles.tokenSnippetBefore} dir="rtl">
        <bdi dir="ltr">{snippet.before}</bdi>
      </span>
      <span className={styles.tokenHighlight}>{snippet.match}</span>
      <span className={styles.tokenSnippetAfter}>{snippet.after}</span>
    </span>
  );
}

function RowWithHover({ props, onHover }) {
  const { row } = props;
  const { ls_index } = row;
  return (
    <Row
      key={ls_index}
      {...props}
      onMouseEnter={() => {
        onHover(ls_index);
      }}
      onMouseLeave={() => {
        onHover(null);
      }}
    />
  );
}

function FilterDataTable({
  handleFeatureClick,
  dataset,
  distances = [],
  clusterMap = {},
  sae_id = null,
  feature = -1,
  features = [],
  onHover = () => {},
}) {
  const { dataTableRows, page, setPage, totalPages, filterConfig, filterActive, loading } =
    useFilter();

  // Image scopes: binary image columns are excluded from rows-by-index
  // responses, so their cells are rendered from the static per-row thumbnails.
  // Token scopes: rows are tokens; the text column shows the parent document
  // with the token's span highlighted, plus a compact token column.
  const { isImageScope, scopeImages, thumbUrl, isTokenScope, scope } = useScope();

  // Track expanded rows by index
  const [expandedRows, setExpandedRows] = useState({});

  // feature tooltip content
  const [featureTooltipContent, setFeatureTooltipContent] = useState(null);

  // Toggle row expansion
  const handleRowExpand = useCallback((index) => {
    setExpandedRows((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const formattedColumns = useMemo(() => {
    // Add index circle column as the first column
    const indexColumn = {
      key: 'index-circle',
      name: '', // Empty header
      width: 50,
      renderCell: IndexCircleCell,
      frozen: true, // Optional: keeps it visible during horizontal scroll
    };

    const ls_features_column = 'ls_features';
    const ls_token_column = 'ls_token';
    // Token scopes window the text column the embedding was computed over.
    const textColumn = (isTokenScope && scope?.embedding?.text_column) || dataset.text_column;
    let columns = ['ls_index'];
    if (isTokenScope) columns.push(ls_token_column);
    // Text column is always the first column (after index)

    columns.push(textColumn);

    // Image scopes: surface the image column(s) right after the text column
    // so the thumbnails are visible without horizontal scrolling.
    if (scopeImages?.columns?.length) {
      columns = columns.concat(scopeImages.columns.filter((c) => dataset.columns.includes(c)));
    }

    if (distances && distances.length) columns.push('ls_similarity');
    if (sae_id) columns.push(ls_features_column);
    if (clusterMap && Object.keys(clusterMap).length) columns.push('ls_cluster');
    // if (tagset && Object.keys(tagset).length) columns.push('tags');

    // Token-scope rows are synthesized from the scope parquet + .bin text, so
    // the parent dataset's other columns (author, score, ...) aren't available.
    if (!isTokenScope) {
      columns = columns.concat(
        dataset.columns.filter((d) => d !== textColumn && !columns.includes(d))
      );
    }

    function renderUrl(text) {
      const key = 'http';
      let urls = text.split(key).filter((url) => !!url);
      console.log('==== urls ==== ', urls);
      const output = (
        <div className={styles.urlContainer}>
          {urls.map((url, idx) => (
            <a key={'url ' + idx} href={`${key}${url}`} target="_blank" rel="noreferrer">
              url
            </a>
          ))}
        </div>
      );
      console.log('==== output ==== ', output);
      return output;
    }

    let columnDefs = columns.map((col) => {
      const metadata = dataset.column_metadata ? dataset.column_metadata[col] : null;
      console.log('==== metadata ==== ', col, metadata);

      const baseCol = {
        key: col,
        name: col,
        resizable: true,
        className: styles.filterDataTableRow,
      };

      // dropping tag support for now.
      // if (col === 'tags') {
      //   return {
      //     ...baseCol,
      //     width: 100,
      //     renderCell: ({ row }) => renderTags(tags, row, tagset, handleTagClick),
      //   };
      // }

      if (metadata?.image) {
        // Binary image columns (scope.images) never arrive in row data —
        // render the static thumbnail by row index instead.
        if (scopeImages?.columns?.includes(col)) {
          return {
            ...baseCol,
            width: 100,
            renderCell: ({ row }) => <ThumbCell src={thumbUrl(row.ls_index, col)} />,
          };
        }
        // legacy path: image columns whose value is a URL string
        return {
          ...baseCol,
          renderCell: ({ row }) => (
            <a href={row[col]} target="_blank" rel="noreferrer">
              <img src={row[col]} alt="" style={{ height: '100px' }} />
            </a>
          ),
        };
      } else if (metadata?.url) {
        return {
          ...baseCol,
          renderCell: ({ row }) => {
            let text = row[col];
            return renderUrl(text);
          },
        };
      } else if (metadata?.type === 'array') {
        return {
          ...baseCol,
          renderCell: ({ row }) => <span>{`[${row[col].length}]`}</span>,
        };
      }

      if (col === ls_token_column) {
        // Compact token column (frozen, so react-data-grid keeps it up front
        // near the index column) showing the cleaned surface string.
        return {
          ...baseCol,
          name: 'token',
          width: 90,
          frozen: true,
          renderCell: ({ row }) => (
            <span className={styles.tokenCell} title={row.token_str}>
              {cleanTokenString(row.token_str)}
            </span>
          ),
        };
      }

      if (col === 'ls_cluster') {
        return {
          ...baseCol,
          width: 200,
          renderCell({ row }) {
            const cluster = clusterMap[row.ls_index];
            return cluster ? <span>{cluster.label}</span> : null;
          },
        };
      }

      if (col === textColumn) {
        return {
          ...baseCol,
          width: 500,
          renderHeaderCell: () => <div className={styles.textColumn}>{textColumn}</div>,
          renderCell: ({ row }) => {
            if (isTokenScope) {
              return <TokenSnippetCell row={row} column={col} />;
            }
            const isExpanded = expandedRows[row.ls_index];
            return (
              <div
                className={`${styles.textCell} ${isExpanded ? styles.expanded : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowExpand(row.ls_index);
                }}
                title={isExpanded ? '' : row[col]}
              >
                {row[col]}
              </div>
            );
          },
        };
      }

      if (col === ls_features_column) {
        const baseWidth = 200;

        return {
          ...baseCol,
          width: baseWidth,
          renderHeaderCell: () => (
            <div className={styles.featureColumnHeader} style={{ position: 'relative' }}>
              <span>{ls_features_column}</span>
              <span
                data-tooltip-id="feature-column-info-tooltip"
                className={styles.featureColumnInfoTooltipIcon}
              >
                🤔
              </span>
            </div>
          ),
          renderCell: ({ row }) =>
            row.sae_indices && (
              <FeaturePlot
                width={baseWidth}
                row={row}
                feature={feature}
                features={features}
                handleFeatureClick={handleFeatureClick}
                setFeatureTooltipContent={setFeatureTooltipContent}
              />
            ),
        };
      }

      const renderCell = ({ row }) => {
        if (typeof row[col] === 'object') {
          return <span>{JSON.stringify(row[col])}</span>;
        }
        if (col === 'ls_similarity') {
          // console.log('==== ls_similarity ==== ', row.ls_index, distances[row.ls_index], distances);
          // use the row index to get the distance
          return <span>{parseFloat(1 - distances[row.idx]).toFixed(4)}</span>;
        }
        if (typeof row[col] === 'string') {
          if (row[col].startsWith('http')) {
            return renderUrl(row[col]);
          }
        }

        return <span title={row[col]}>{row[col]}</span>;
      };

      return {
        ...baseCol,
        width: col == 'ls_index' ? 60 : 150,
        renderCell,
      };
    });

    // Add index column as first column
    return [indexColumn, ...columnDefs];
    // return columnDefs;
  }, [
    dataset,
    clusterMap,
    distances,
    features,
    feature,
    sae_id,
    expandedRows,
    handleRowExpand,
    scopeImages,
    thumbUrl,
    isTokenScope,
    scope,
  ]);

  // Row height calculation
  const getRowHeight = useCallback(
    (row) => {
      if (expandedRows[row.ls_index]) {
        // TODO: a more sophisticated way to do this would be better (measuring text content in DOM)
        const text = row[dataset.text_column] || '';
        // Use the text length to determine a reasonable height
        if (text.length > 1000) return 400;
        if (text.length > 500) return 300;
        if (text.length > 200) return 200;
        if (text.length > 100) return 100;
        if (text.length > 50) return 60;
      }
      // image scopes get taller rows so the thumbnails aren't clipped
      if (isImageScope) return 96;
      return sae_id ? 50 : 35;
    },
    [expandedRows, sae_id, dataset.text_column, isImageScope]
  );

  const renderRowWithHover = useCallback(
    (key, props) => {
      return <RowWithHover key={key} props={props} onHover={onHover} />;
    },
    [onHover]
  );

  return (
    <div
      className={`${styles.filterDataTable} ${loading ? styles.loading : ''}`}
      // style={{ visibility: indices.length ? 'visible' : 'hidden' }}
    >
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <div>Loading</div>
          </div>
        </div>
      )}
      <div className={`${styles.filterTableScrollableBody} ${styles.tableBody}`}>
        <Tooltip
          id="feature-tooltip"
          place="bottom"
          effect="solid"
          content={featureTooltipContent?.content || ''}
          className={styles.featureTooltip}
          float={true}
          isOpen={!!featureTooltipContent}
          // float={true}
          position="fixed"
          style={{
            zIndex: 9999,
            maxWidth: 'none',
            whiteSpace: 'nowrap',
            backgroundColor: '#D3965E',
            position: 'fixed',
            marginTop: 10,
            top: -200,
            // left: featureTooltipContent?.x || 0,
            // top: (featureTooltipContent?.y || 0) - 30,
          }}
        />
        <DataGrid
          rows={dataTableRows}
          columns={formattedColumns}
          rowClass={(row) => (expandedRows[row.ls_index] ? styles.expandedRow : styles.rdgRow)}
          rowGetter={(i) => dataTableRows[i]}
          rowHeight={getRowHeight}
          rowHeightGetter={getRowHeight}
          style={{ height: '100%', color: 'var(--text-color-main-neutral)' }}
          renderers={{ renderRow: renderRowWithHover }}
          className={styles.dataGrid}
        />

        <Tooltip
          id="feature-column-info-tooltip"
          className={styles.featureColumnInfoTooltip}
          place="top"
          effect="solid"
          clickable={true}
          delayHide={500} // give the user a chance to click the tooltip links
        >
          <div onClick={(e) => e.stopPropagation()}>
            The vertical bars represent activations for different{' '}
            <a
              href="https://enjalot.github.io/latent-taxonomy/articles/about"
              target="_blank"
              rel="noreferrer"
            >
              Sparse Autoencoder (SAE)
            </a>{' '}
            features corresponding to each embedding. Higher activations indicate that the feature
            captures an important semantic element of the embedding.
            <br />
            <br />
            Click each cell to see the labels for each feature and to filter rows by a particular
            feature.
          </div>
        </Tooltip>
      </div>
      {page >= 0 && (
        <div className={styles.filterDataTablePageControls}>
          <button onClick={() => setPage(0)} disabled={page === 0}>
            First
          </button>
          <button onClick={() => setPage((old) => Math.max(0, old - 1))} disabled={page === 0}>
            ←
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((old) => Math.min(totalPages - 1, old + 1))}
            disabled={page === totalPages - 1}
          >
            →
          </button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}>
            Last
          </button>
        </div>
      )}
    </div>
  );
}

// Thumbnail cell for binary image columns. Missing thumbs (rows with
// null/undecodable images 404 on GCS/local, 403 on GCS) degrade to an empty
// placeholder rather than a broken-image icon.
const ThumbCell = ({ src }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div
        style={{
          width: 88,
          height: 88,
          margin: '4px 0',
          borderRadius: 4,
          background: 'var(--neutrals-color-neutral-2, #eee)',
        }}
        title="no image"
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      style={{ maxHeight: 88, maxWidth: 88, margin: '4px 0', borderRadius: 4 }}
      onError={() => setFailed(true)}
    />
  );
};

const IndexCircleCell = ({ row }) => {
  return (
    <div className={styles.indexCircleContainer}>
      <div className={styles.indexCircle}>{row.idx + 1}</div>
    </div>
  );
};

export default memo(FilterDataTable);
