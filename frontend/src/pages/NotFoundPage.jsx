import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Home, Search } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main
      className="not-found-page"
      style={{
        minHeight: 'calc(100vh - 140px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: 'radial-gradient(ellipse at center, rgba(255, 153, 0, 0.06) 0%, rgba(6, 7, 10, 1) 75%)',
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          background: 'var(--bg-card, #0a0c11)',
          border: '1px solid var(--gray-700, #2a2f3d)',
          padding: '48px 36px',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Badge superior */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px',
            background: 'rgba(255, 153, 0, 0.1)',
            border: '1px solid var(--accent-border, rgba(255, 153, 0, 0.25))',
            color: 'var(--accent, #ff9900)',
            fontFamily: "'Space Grotesk', monospace",
            fontSize: '0.78rem',
            fontWeight: '700',
            letterSpacing: '0.12em',
            marginBottom: '20px',
            textTransform: 'uppercase',
          }}
        >
          <Film size={14} />
          <span>Erro 404 • Corte Final</span>
        </div>

        {/* Número 404 */}
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '4.8rem',
            fontWeight: '900',
            color: 'var(--white, #ffffff)',
            lineHeight: '1',
            letterSpacing: '-0.04em',
            margin: '0 0 12px 0',
          }}
        >
          404
        </h1>

        {/* Título */}
        <h2
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.35rem',
            fontWeight: '700',
            color: 'var(--white, #ffffff)',
            margin: '0 0 14px 0',
            letterSpacing: '0.02em',
          }}
        >
          CENA NÃO ENCONTRADA
        </h2>

        {/* Descrição */}
        <p
          style={{
            color: 'var(--gray-400, #9ca3af)',
            fontSize: '0.92rem',
            lineHeight: '1.6',
            margin: '0 auto 32px auto',
            maxWidth: '440px',
          }}
        >
          A fita quebrou ou esta página nunca existiu no catálogo do Criticbox.
          Verifique o link digitado ou volte para o início.
        </p>

        {/* Ações */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 22px',
              background: 'var(--accent, #ff9900)',
              color: '#000000',
              border: 'none',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.85rem',
              fontWeight: '800',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover, #ffaa22)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent, #ff9900)')}
          >
            <Home size={16} />
            VOLTAR AO INÍCIO
          </button>

          <button
            onClick={() => navigate('/search')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 22px',
              background: 'transparent',
              color: 'var(--white, #ffffff)',
              border: '1px solid var(--gray-600, #4b5563)',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.85rem',
              fontWeight: '700',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--white, #ffffff)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--gray-600, #4b5563)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Search size={16} />
            BUSCAR TÍTULOS
          </button>
        </div>
      </div>
    </main>
  );
}
