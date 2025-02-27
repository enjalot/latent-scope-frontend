import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Nav.css';

const Nav = () => {
  return (
    <>
      <nav>
        <ul>
          <li>
            <Link to="/">Latent Scope Demo</Link>
          </li>
          <li className="settings">
            {/* TODO: github link */}
            <a href="https://github.com/enjalot/latent-scope" target="_blank">
              <img src="https://img.shields.io/github/stars/enjalot/latent-scope" />
            </a>{' '}
            <a href="https://discord.gg/x7NvpnM4pY" target="_blank">
              {/* <img src="https://dcbadge.vercel.app/api/server/x7NvpnM4pY?style=flat" /> */}
              <img src="https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white" />
            </a>
          </li>
        </ul>
      </nav>
    </>
  );
};

export default Nav;
