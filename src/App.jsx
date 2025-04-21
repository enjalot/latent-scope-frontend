import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ReactGA from 'react-ga4';
import Home from './pages/Home';
import FullScreenExplore from './pages/FullScreenExplore';
import Nav from './components/Nav';
import './App.css';

import { MDXWrapper } from './components/MDXProvider';

import NavBySim from './essays/nav-by-sim';
import TouchTokens from './essays/touch-tokens';
import LatentScope from './essays/latent-scope.mdx';

import 'react-element-forge/dist/style.css';
import './latentscope--brand-theme.scss';

const env = import.meta.env;
console.log('ENV', env);

// Initialize GA4 with your measurement ID
ReactGA.initialize('G-MZZYR36WFH'); // Replace with your GA4 measurement ID

function App() {
  return (
    <Router basename={env.BASE_NAME}>
      <Nav />
      <div className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scope/:user/:dataset/:scope" element={<FullScreenExplore />} />

          <Route path="/essays/nav-by-sim" element={<NavBySim />} />
          <Route path="/essays/touch-tokens" element={<TouchTokens />} />
          <Route
            path="/essays/latent-scope"
            element={
              <MDXWrapper>
                <LatentScope />
              </MDXWrapper>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
