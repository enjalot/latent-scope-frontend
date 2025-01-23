import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import styles from './Home.module.css';

function Home() {
  const [datasets, setDatasets] = useState([]);
  const scopes = [
    {
      id: 'enjalot/ls-dadabase/scopes-001',
      label: 'Dadabase',
      description: '50,000 r/dadjokes, lightly curated',
      dataUrl: 'https://github.com/enjalot/latent-scope/blob/main/notebooks/dadabase.ipynb',
    },
    {
      id: 'enjalot/ls-dataisplural/scopes-001',
      label: 'Data is Plural',
      description: '1,900 datasets from Data is Plural',
      dataUrl: 'https://www.data-is-plural.com/archive/',
    },
    {
      id: 'jzhang621/ls-founders-1/scopes-003',
      label: 'Founders Dataset',
      description: "3,000 excerpts from David Senra's podcast",
      dataUrl: '',
    },
    {
      id: 'enjalot/ls-fineweb-edu-100k/scopes-001',
      label: 'Fineweb Edu 100k',
      description: '100,000 sample of Fineweb Edu',
      dataUrl: 'https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1',
    },
    {
      id: 'enjalot/ls-common-corpus-100k/scopes-001',
      label: 'Common Corpus 100k',
      description: '100,000 sample of Common Corpus',
      dataUrl: 'https://huggingface.co/blog/Pclanglais/common-corpus',
    },
    {
      id: 'enjalot/ls-us-federal-laws/scopes-001',
      label: 'US Federal Laws',
      description: '49,000  US Federal Laws',
      dataUrl: 'https://www.data-is-plural.com/archive/2024-02-28-edition/',
    },
    {
      id: 'enjalot/ls-executive_orders/scopes-001',
      label: 'Executive Orders',
      description: '6,648 Executive Orders from 1937 to 2025 (FDR to Biden)',
      dataUrl: 'https://www.data-is-plural.com/archive/2018-04-18-edition/',
    },
    {
      id: 'enjalot/ls-state-legislators-2024/scopes-001',
      label: 'State Legislators 2024',
      description: 'Biographical information of 7,300+ U.S. State Legislators in 2024.',
      dataUrl: 'https://www.data-is-plural.com/archive/2024-03-20-edition/',
    },
    {
      id: 'enjalot/ls-datavis-misunderstood/scopes-001',
      label: 'Data Visualization Misunderstood',
      description: '700 free responses from a survey about Data Visualization.',
      dataUrl: 'https://enjalot.github.io/latent-scope/datavis-survey',
    },
    {
      id: 'enjalot/ls-squad/scopes-001',
      label: 'SQuAD',
      description: '20,000 answer chunks from the Stanford Question Answering Dataset.',
      dataUrl: 'https://huggingface.co/datasets/rajpurkar/squad',
    },
  ];

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
