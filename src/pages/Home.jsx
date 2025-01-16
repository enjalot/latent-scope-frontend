import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from 'react-element-forge';
import { apiService } from '../lib/apiService';
const readonly = import.meta.env.MODE == 'read_only';

import './Home.css';

function Home() {
  const [datasets, setDatasets] = useState([]);

  // useEffect(() => {
  //   apiService.fetchDatasets().then(setDatasets);
  // }, []);

  const [scopes, setScopes] = useState({});
  return (
    <div className="home">
      
      <div className="section datasets">
        <h3>Datasets</h3>
        <div className="datasets-content">
          {datasets.map((dataset) => (
            <div className="dataset" key={dataset.id}>
              <h3>
                {' '}
                {dataset.id} &nbsp;
                {readonly ? null : <Link to={`/datasets/${dataset.id}/setup`}>Setup</Link>}
              </h3>
              <span>{dataset.length} rows</span>
              <div className="scope-links">
                {scopes[dataset.id] &&
                  scopes[dataset.id].map &&
                  scopes[dataset.id]?.map((scope, i) => (
                    <div className="scope-link" key={i}>
                      <Link to={`/datasets/${dataset.id}/explore/${scope.id}`}>
                        {scope.label || scope.id}
                      </Link>
                      <br />
                      <br />
                      <span className="scope-description">{scope.description}</span>
                      <br />
                      {readonly ? null : (
                        <Link to={`/datasets/${dataset.id}/setup/${scope.id}`}>Configure</Link>
                      )}
                      {readonly ? null : (
                        <>
                          {' '}
                          | <Link to={`/datasets/${dataset.id}/export/${scope.id}`}>
                            Export
                          </Link>{' '}
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
