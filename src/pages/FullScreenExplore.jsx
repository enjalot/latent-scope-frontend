import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import "./Explore.css";
import useCurrentScope from "../hooks/useCurrentScope";
import useNearestNeighborsSearch from "../hooks/useNearestNeighborsSearch";
import useScopeData from "../hooks/useScopeData";
import { saeAvailable } from "../lib/SAE";
import { apiService } from "../lib/apiService";

import FilterActions from "../components/Explore/FilterActions";
import SubNav from "../components/SubNav";
import LeftPane from "../components/Explore/LeftPane";
import VisualizationPane from "../components/Explore/VisualizationPane";
import FilterDataTable from "../components/FilterDataTable";

import { ScopeProvider } from "../contexts/ScopeContext";
import { FilterProvider } from "../contexts/FilterContext";
import { useScope } from "../contexts/ScopeContext";
import { useFilter } from "../contexts/FilterContext";

function parseParams(searchParams) {
    let cluster = null;
    let search = null;
    let feature = null;

    if (searchParams.has("cluster")) {
        cluster = parseInt(searchParams.get("cluster"));
    }

    if (searchParams.has("search")) {
        search = searchParams.get("search");
    }

    if (searchParams.has("feature")) {
        feature = parseInt(searchParams.get("feature"));
    }

    return { cluster, search, feature };
}

// Create a new component that wraps the main content
function ExploreContent() {
    const navigate = useNavigate();
    const [urlParams, setUrlParams] = useSearchParams();
    const {
        cluster: clusterParam,
        search: searchParam,
        feature: featureParam,
    } = parseParams(urlParams);

    // Get scope-related state from ScopeContext
    const {
        userId,
        datasetId,
        dataset,
        scope,
        scopeLoaded,
        scopeRows,
        deletedIndices,
        clusterMap,
        clusterLabels,
        features,
        sae,
    } = useScope();

    // Get filter-related state from FilterContext
    const {
        activeFilterTab,
        filteredIndices,
        setFilteredIndices,
        defaultIndices,
        columnFilterIndices,
        featureIndices,
        setFeatureIndices,
        searchIndices,
        selectedIndices,
        setSelectedIndices,
        searchText,
        searchLoading,
        feature,
        setFeature,
        threshold,
        setThreshold,
        filterConstants,
        setActiveFilterTab,
        distances,
    } = useFilter();

    // Keep visualization-specific state
    const [scatter, setScatter] = useState({});
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [hovered, setHovered] = useState(null);
    const [hoveredCluster, setHoveredCluster] = useState(null);
    const [hoverAnnotations, setHoverAnnotations] = useState([]);
    const [dataTableRows, setDataTableRows] = useState([]);
    const [selectedAnnotations, setSelectedAnnotations] = useState([]);
    const [page, setPage] = useState(0);

    // Update URL when search text or feature changes
    useEffect(() => {
        setUrlParams((prev) => {
            if (searchText) {
                prev.set("search", searchText);
            } else {
                if (scopeLoaded && searchParam) {
                    prev.delete("search");
                }
            }

            if (feature && feature !== -1) {
                prev.set("feature", feature);
            } else {
                if (scopeLoaded && featureParam) {
                    prev.delete("feature");
                }
            }

            return prev;
        });
    }, [searchText, featureParam, feature, setUrlParams, scopeLoaded, searchParam]);

    // Hover text hydration
    const hydrateHoverText = useCallback(
        (index, setter) => {
            apiService.getHoverText(userId, datasetId, scope?.id, index).then((data) => {
                setter(data);
            });
        },
        [userId, datasetId, scope]
    );

    useEffect(() => {
        if (
            hoveredIndex !== null &&
            hoveredIndex !== undefined &&
            !deletedIndices.includes(hoveredIndex)
        ) {
            hydrateHoverText(hoveredIndex, (text) => {
                setHovered({
                    text: text,
                    index: hoveredIndex,
                    cluster: clusterMap[hoveredIndex],
                });
            });
        } else {
            setHovered(null);
        }
    }, [hoveredIndex, deletedIndices, clusterMap, hydrateHoverText]);

    // Update hover annotations
    useEffect(() => {
        if (hoveredIndex !== null && hoveredIndex !== undefined) {
            let sr = scopeRows[hoveredIndex];
            setHoverAnnotations([[sr.x, sr.y]]);
        } else {
            setHoverAnnotations([]);
        }
    }, [hoveredIndex, scopeRows]);

    // Handlers for responding to individual data points
    const handleClicked = useCallback((index) => {
        console.log("====clicked====", index);
    }, []);

    const handleHover = useCallback((index) => {
        const nonDeletedIndex = deletedIndices.includes(index) ? null : index;
        setHoveredIndex(nonDeletedIndex);
    }, [deletedIndices]);

    const handleSelected = useCallback((indices) => {
        const nonDeletedIndices = indices.filter(index => !deletedIndices.includes(index));
        if (activeFilterTab === filterConstants.CLUSTER) {
            let selected = scopeRows.filter(row => nonDeletedIndices.includes(row.ls_index))?.[0];
            if (selected) {
                const selectedCluster = clusterLabels.find(d => d.cluster === selected.cluster);
                setCluster(selectedCluster);
            }
        } else {
            setSelectedIndices(nonDeletedIndices);
        }
    }, [activeFilterTab, deletedIndices, scopeRows, clusterLabels, setSelectedIndices]);


    // ====================================================================================================
    // Clusters
    // ====================================================================================================
    // indices of items in a chosen slide
    const [cluster, setCluster] = useState(null);

    // ==== CLUSTERS ====

    const [clusterIndices, setClusterIndices] = useState([]);
    useEffect(() => {
        if (cluster && activeFilterTab === filterConstants.CLUSTER) {
            const annots = scopeRows.filter((d) => d.cluster == cluster.cluster);
            const indices = annots.map((d) => d.ls_index);
            setClusterIndices(indices);

            setUrlParams((prev) => {
                prev.set("cluster", cluster.cluster);
                return prev;
            });
        } else {
            setClusterIndices([]);

            // do not delete the cluster param if the scope has not been loaded yet
            if (scopeLoaded && clusterParam && cluster === null) {
                setUrlParams((prev) => {
                    prev.delete("cluster");
                    return prev;
                });
            }
        }
    }, [cluster, scopeRows, setClusterIndices, scopeLoaded]);

    // ==== COLUMNS ====

    useEffect(() => {
        if (featureParam) {
            setFeature(parseInt(featureParam));

            // set the active filter tab to FEATURE
            if (clusterParam === null && searchParam === null) {
                setActiveFilterTab(filterConstants.FEATURE);
            }
        }
    }, [featureParam]);

    useEffect(() => {
        if (feature >= 0 && activeFilterTab === filterConstants.FEATURE) {
            console.log("==== feature ==== ", feature);
            console.log("==== threshold ==== ", threshold);
            apiService
                .searchSaeFeature(userId, datasetId, scope?.id, feature, threshold)
                .then((data) => {
                    console.log("==== feature indices ==== ", data);
                    setFeatureIndices(data);
                });
        } else {
            // The feature filter tab is active, but the feature is no longer set
            // so we should clear the filtered indices
            setFeatureIndices([]);
        }
    }, [userId, datasetId, scope, feature, threshold, setFeatureIndices]);

    const containerRef = useRef(null);
    const filtersContainerRef = useRef(null);

    const [filtersHeight, setFiltersHeight] = useState(250);
    const FILTERS_PADDING = 2;
    const tableHeight = useMemo(
        () => `calc(100% - ${filtersHeight + FILTERS_PADDING}px)`,
        [filtersHeight]
    );

    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { height } = entry.contentRect;
                setFiltersHeight(height);
            }
        });

        let node = filtersContainerRef?.current;
        if (node) {
            resizeObserver.observe(node);
        } else {
            setTimeout(() => {
                node = filtersContainerRef?.current;
                if (node) {
                    resizeObserver.observe(node);
                } else {
                    setFiltersHeight(0);
                }
            }, 100);
        }

        return () => {
            if (node) {
                resizeObserver.unobserve(node);
            }
        };
    }, []);

    // ====================================================================================================
    // Fullscreen related logic
    // ====================================================================================================
    const [size, setSize] = useState([500, 500]);
    const visualizationContainerRef = useRef(null);

    function updateSize() {
        if (visualizationContainerRef.current) {
            const vizRect = visualizationContainerRef.current.getBoundingClientRect();
            setSize([vizRect.width, vizRect.height]);
        }
    }

    // initial size
    useEffect(() => {
        const observer = new MutationObserver((mutations, obs) => {
            updateSize();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        return () => observer.disconnect();
    }, []);

    // let's fill the container and update the width and height if window resizes
    useEffect(() => {
        window.addEventListener("resize", updateSize);
        updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, [visualizationContainerRef, containerRef]);

    const [width, height] = size;

    // ====================================================================================================
    // set the filtered indices based on the active filter tab
    // ====================================================================================================
    useEffect(() => {
        if (activeFilterTab === filterConstants.COLUMN) {
            setFilteredIndices(columnFilterIndices);
        } else if (activeFilterTab === filterConstants.FEATURE) {
            setFilteredIndices(featureIndices);
        } else if (activeFilterTab === filterConstants.CLUSTER) {
            setFilteredIndices(clusterIndices);
        } else if (activeFilterTab === filterConstants.SELECT) {
            setFilteredIndices(selectedIndices);
        } else if (activeFilterTab === filterConstants.SEARCH) {
            setFilteredIndices(searchIndices);
        }
    }, [
        activeFilterTab,
        columnFilterIndices,
        featureIndices,
        clusterIndices,
        selectedIndices,
        searchIndices,
    ]);

    // ====================================================================================================
    // Draggable State
    // ====================================================================================================
    const [gridTemplate, setGridTemplate] = useState("50% 50%");

    const startDragging = (e) => {
        e.preventDefault();
        document.addEventListener("mousemove", onDrag);
        document.addEventListener("mouseup", stopDragging);
    };

    const onDrag = (e) => {
        if (containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            const newTemplate = `${Math.min(Math.max(percentage, 20), 80)}% 1fr`;
            setGridTemplate(newTemplate);
            updateSize();
        }
    };

    const stopDragging = () => {
        document.removeEventListener("mousemove", onDrag);
        document.removeEventListener("mouseup", stopDragging);
    };

    // Add this CSS-in-JS style object near the top of the component
    const styles = {
        dragHandle: {
            position: "absolute",
            right: -15,
            top: 0,
            bottom: 0,
            width: 30,
            cursor: "ew-resize",
            backgroundColor: "transparent",
            transition: "background-color 0.2s",
            "&:hover": {
                backgroundColor: "#e0e0e0",
            },
            zIndex: 10,
        },
    };

    const handleFeatureClick = useCallback(
        (featIdx, activation) => {
            setActiveFilterTab(FEATURE);
            setFeature(featIdx);
            // TODO: for setting the threshold the FeatureFilter component would need to have threshold passed in
            // setThreshold(activation);
        },
        [setActiveFilterTab, setFeature, setThreshold]
    );

    useEffect(() => {
        console.log("scopeLoaded", scopeLoaded);
        console.log("searchLoading", searchLoading);
        console.log("dataset", dataset);
        console.log("scope", scope);
        console.log("filteredIndices", filteredIndices);
        console.log("dataTableRows", dataTableRows);
        console.log("defaultIndices", defaultIndices);
    }, [scopeLoaded, searchLoading, dataset, scope, filteredIndices, dataTableRows, defaultIndices]);

    if (!dataset)
        return (
            <>
                <SubNav user={userId} dataset={dataset} scope={scope} />
                <div>Loading...</div>
            </>
        );

    return (
        <>
            <SubNav user={userId} dataset={dataset} scope={scope} />
            <div style={{ display: "flex", gap: "4px", height: "100%" }}>
                <LeftPane dataset={dataset} scope={scope} deletedIndices={deletedIndices} />
                {/* {(!scopeLoaded || searchLoading) && (
                    <div className="loading-overlay">
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <div>Loading</div>
                        </div>
                    </div>
                )} */}
                <div
                    ref={containerRef}
                    className="full-screen-explore-container"
                    style={{ gridTemplateColumns: gridTemplate }}
                >
                    <div className="filter-table-container" style={{ position: "relative" }}>
                        <div style={styles.dragHandle} onMouseDown={startDragging} />
                            <div ref={filtersContainerRef}>
                                <FilterActions
                                    clusterLabels={clusterLabels}
                                    scatter={scatter}
                                    scope={scope}
                                    dataset={dataset}
                                />
                            </div>
                            <div
                                style={{
                                    height: tableHeight,
                                    overflowY: "auto",
                                    display: "flex",
                                }}
                            >
                                <FilterDataTable
                                    userId={userId}
                                    dataset={dataset}
                                    scope={scope}
                                    filteredIndices={filteredIndices}
                                    defaultIndices={defaultIndices}
                                    deletedIndices={deletedIndices}
                                    distances={activeFilterTab === filterConstants.SEARCH ? distances : []}
                                    clusterMap={clusterMap}
                                    clusterLabels={clusterLabels}
                                    onDataTableRows={setDataTableRows}
                                    sae_id={sae?.id}
                                    feature={feature}
                                    features={features}
                                    onHover={handleHover}
                                    onClick={handleClicked}
                                    page={page}
                                    setPage={setPage}
                                    handleFeatureClick={handleFeatureClick}
                                />
                            </div>
                        </div>
                        <div
                            ref={visualizationContainerRef}
                            className="visualization-pane-container"
                            onMouseLeave={() => {
                                setHoveredIndex(null);
                                setHovered(null);
                            }}
                        >
                            {scopeRows?.length ? (
                                <VisualizationPane
                                    width={width}
                                    height={height}
                                    onScatter={setScatter}
                                    hovered={hovered}
                                    hoveredIndex={hoveredIndex}
                                    onHover={handleHover}
                                    onSelect={handleSelected}
                                    hoverAnnotations={hoverAnnotations}
                                    selectedAnnotations={selectedAnnotations}
                                    hoveredCluster={hoveredCluster}
                                    dataTableRows={dataTableRows}
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            </>
    );
}

// Make the main Explore component just handle the providers
function Explore() {
    return (
        <ScopeProvider>
            <FilterProvider>
                <ExploreContent />
            </FilterProvider>
        </ScopeProvider>
    );
}

export default Explore;
