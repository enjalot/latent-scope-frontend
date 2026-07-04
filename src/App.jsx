import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ReactGA from 'react-ga4';
import Home from './pages/Home';
import Nav from './components/Nav';
import essays from './essays/manifest';
import './App.css';

import 'react-element-forge/dist/style.css';
import './latentscope--brand-theme.scss';

const env = import.meta.env;
console.log('ENV', env);

// Initialize GA4 with your measurement ID
ReactGA.initialize('G-MZZYR36WFH');

// Route-level code splitting: the Explore app and every essay load on
// demand, keeping the main chunk to the Home page + nav shell.
const FullScreenExplore = lazy(() => import('./pages/FullScreenExplore'));
const essayComponents = Object.fromEntries(essays.map((e) => [e.slug, lazy(e.load)]));

function App() {
  return (
    <Router basename={env.BASE_NAME}>
      <Nav />
      <div className="page">
        <Suspense fallback={<div className="route-loading" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/scope/:user/:dataset/:scope" element={<FullScreenExplore />} />

            {essays.map((essay) => {
              const EssayComponent = essayComponents[essay.slug];
              return (
                <Route key={essay.slug} path={`/essays/${essay.slug}`}>
                  <Route index element={<EssayComponent />} />
                  {(essay.kind === 'moonshine' || essay.kind === 'moonshine-series') && (
                    <Route path=":article" element={<EssayComponent />} />
                  )}
                </Route>
              );
            })}
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
