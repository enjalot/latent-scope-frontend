import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../lib/apiService';

const useScopeData = (userId, datasetId, scope, clusterParam, setCluster) => {
    const [clusterMap, setClusterMap] = useState({});
    const [clusterIndices, setClusterIndices] = useState([]);
    const [clusterLabels, setClusterLabels] = useState([]);

    const [scopeRows, setScopeRows] = useState([]);

    const [deletedIndices, setDeletedIndices] = useState([]);

    console.log({ clusterParam });
    const fetchScopeRows = useCallback(() => {
        apiService
            .getScopeRows(userId, datasetId, scope.id)
            .then((scopeRows) => {
                console.log("scopeRows", scopeRows);
                scopeRows.forEach((row) => {
                    row.ls_index = row.index;
                });
                setScopeRows(scopeRows);

                let clusterMap = {};
                let nonDeletedClusters = new Set();

                // Reset all counts in cluster_labels_lookup first
                // to avoid overcounting clusters counts.
                // this is happening because fetchScopeRows is being called multiple times
                // and the cluster_labels_lookup is being mutated
                // TODO: fix this -> use a new object for cluster_labels_lookup
                if (scope.cluster_labels_lookup) {
                    scope.cluster_labels_lookup.forEach((cluster) => {
                        cluster.count = 0;
                    });
                }

                scopeRows.forEach((d) => {
                    const cluster = scope.cluster_labels_lookup?.[d.cluster];
                    cluster.count += 1;

                    clusterMap[d.ls_index] = cluster;
                    //   clusterMap[d.ls_index] = { cluster: d.cluster, label: d.label };
                    if (!d.deleted) {
                        nonDeletedClusters.add(d.cluster);
                    }
                });
                // only take the labels of clusters that belong to rows that are not deleted
                const labelsData =
                    scope.cluster_labels_lookup.filter((l) => nonDeletedClusters.has(l.cluster)) ||
                    [];

                setClusterLabels(labelsData);
                setClusterIndices(scopeRows.map((d) => d.cluster));

                if (clusterParam) {
                    const cluster = scope.cluster_labels_lookup[clusterParam];
                    if (cluster) {
                        setCluster(cluster);
                    }
                }

                setClusterMap(clusterMap);

                setDeletedIndices(scopeRows.filter((d) => d.deleted).map((d) => d.ls_index));
            })
            .catch((error) => console.error("Fetching data failed", error));
    }, [userId, datasetId, scope]);

    return {
        clusterMap,
        clusterIndices,
        clusterLabels,
        scopeRows,
        fetchScopeRows,
        deletedIndices,
    };
};

export default useScopeData;
