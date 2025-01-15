import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import FullScreenExplore from './pages/FullScreenExplore';
import Nav from './components/Nav';
import './App.css';

import 'react-element-forge/dist/style.css';
import './latentscope--brand-theme.scss';

const env = import.meta.env;
console.log('ENV', env);

function App() {
  return (
    <Router basename={env.BASE_NAME}>
      <Nav />
      <div className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scope/:user/:dataset/:scope" element={<FullScreenExplore />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
