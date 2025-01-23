import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import scopes from '../lib/scopes.js';

import styles from './Home.module.css';

function Home() {
  const [datasets, setDatasets] = useState([]);

  // useEffect(() => {
  //   apiService.fetchDatasets().then(setDatasets);
  // }, []);

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <p>
          <a href="https://github.com/enjalot/latent-scope">Latent Scope</a> is an open source tool
          for finding structure in unstructured data. This page allows you to interactively explore
          the output of Latent Scope on a number of different datasets.
        </p>
        <p>
          If you want to explore your own data in this way, just{' '}
          <a href="https://enjalot.github.io/latent-scope/install-and-config">
            pip install latentscope
          </a>{' '}
          and make your first Scope!
        </p>
      </div>
      <div className={`${styles.section}`}>
        <h2>Scopes</h2>
        <div className={styles.scopes}>
          {scopes.map((scope) => (
            <div className={styles.scope} key={scope.id}>
              <div className={styles.scopeImage}>
                <Link to={`/scope/${scope.id}`}>
                  <img
                    src={`https://storage.googleapis.com/fun-data/latent-scope/demos/${scope.id}.png`}
                    alt="Explore"
                  />
                </Link>
              </div>
              <div className={styles.scopeDescription}>
                <span className={styles.scopeLabel}>
                  <Link to={`/scope/${scope.id}`}>{scope.label}</Link>
                </span>
                {scope.description}
                <br />
                <br />
                {scope.dataUrl && (
                  <a className={styles.dataUrl} href={scope.dataUrl} target="_blank">
                    Dataset details
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`${styles.section}`}>
        <h2>Technical notes</h2>
        <p>
          These demos were prepared using the Latent Scope tool on an M2 Mac. After scopes were
          created locally they are converted to{' '}
          <a href="https://lancedb.com/">LanceDB and uploaded</a>. The API powering the nearest
          neighbor search is hosted on <a href="https://modal.com">Modal</a>, embedding queries via
          Sentence Transformers and querying the LanceDB vector search.
        </p>
        <p>
          The frontend code for these demos lives in{' '}
          <a href="https://github.com/enjalot/latent-scope-frontend">latent-scope-frontend</a>. The
          backend is powered by a simple set of endpoints on Modal in{' '}
          <a href="https://github.com/enjalot/latent-scope-modal">latent-scope-modal</a>.
        </p>
      </div>
      <div className={styles.section}>
        <p>
          Latent Scope is brought to you by <a href="https://latentui.com">Latent Interfaces</a>, an
          applied research lab for advanced data visualization.
        </p>
      </div>
    </div>
  );
}

export default Home;
