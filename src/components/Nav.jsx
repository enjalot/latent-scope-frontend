import { useState } from 'react';
import { Link } from 'react-router-dom';
import SubNav from './SubNav';
import './Nav.css';

const Nav = () => {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <>
      <nav>
        <ul>
          <li>
            <Link to="/">Latent Scope Demo</Link>
          </li>
          <li className="settings">
            {/* TODO: github link */}
          </li>
        </ul>
      </nav>
    </>
  );
};

export default Nav;
