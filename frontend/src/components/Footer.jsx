import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">CRITICBOX</span>
          <span className="footer-copy">© 2026 Criticbox — Sua caixa de críticas e catálogo de cinema.</span>
        </div>
        <ul className="footer-links">
          <li>
            <Link to="/">Início</Link>
          </li>
          <li>
            <Link to="/search">Buscar Títulos</Link>
          </li>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Voltar ao Topo
            </a>
          </li>
        </ul>
        <span className="footer-tech">built for movie & series lovers</span>
      </div>
    </footer>
  );
}
