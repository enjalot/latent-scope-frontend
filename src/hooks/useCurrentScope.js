import { useEffect, useState, useCallback, useMemo } from 'react';
const { asyncBufferFromUrl, parquetRead } = await import("hyparquet");

import { apiService } from '../lib/apiService';
import { saeAvailable } from '../lib/SAE';
const useCurrentScope = (userId, datasetId, scopeId) => {
    const [scope, setScope] = useState(null);
    const [dataset, setDataset] = useState(null);
    const [sae, setSae] = useState(null);

    useEffect(() => {
        apiService.getScope(userId, datasetId, scopeId).then((scope) => {
            console.log("scope", scope)
            if(saeAvailable[scope.embedding?.model_id]) {
                setSae(scope.sae);
            } else {
                delete scope.sae
                delete scope.sae_id
            }
            setScope(scope);
            setDataset(scope.dataset);
        });
    }, [userId, datasetId, scopeId]);

    const [features, setFeatures] = useState([]);

    // TODO: this should be in API service?
    useEffect(() => {
        const asyncRead = async (meta) => {
            console.log("META", meta);
            if (!meta) return;
            const buffer = await asyncBufferFromUrl(meta.url);
            parquetRead({
                file: buffer,
                onComplete: (data) => {
                    // let pts = []
                    // console.log("DATA", data)
                    let fts = data.map((f) => {
                        // pts.push([f[2], f[3], parseInt(f[5])])
                        return {
                            feature: parseInt(f[0]),
                            max_activation: f[1],
                            label: f[6],
                            order: f[7],
                        };
                    });
                    // .filter(d => d.label.indexOf("linear") >= 0)
                    // .sort((a,b) => a.order - b.order)
                    console.log("FEATURES", fts);
                    setFeatures(fts);
                },
            });
        };
        if (scope?.sae_id) {
            // console.log("SAE ID", scope.sae_id, saeAvailable[scope.sae_id])
            asyncRead(saeAvailable[scope.embedding?.model_id]);
        }
    }, [scope]);

    return { dataset, setDataset, scope, setScope, sae, setSae, features, setFeatures };
};

export default useCurrentScope;