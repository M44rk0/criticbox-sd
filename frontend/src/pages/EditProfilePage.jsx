import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Trash2,
  Check,
  Film,
  Heart,
  Eye,
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getUserProfile, updateUserProfile } from '../api/social';
import { getUserWatched, getUserFavorites } from '../api/activity';
import { getUserReviews } from '../api/reviews';
import './EditProfilePage.css';

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { isLoggedIn, username: authUsername, openAuth, updateUserAvatar } = useAuth();
  const cleanUsername = (authUsername || '').replace(/^@+/, '').trim();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [pillars, setPillars] = useState([]);

  const [favorites, setFavorites] = useState([]);
  const [watched, setWatched] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [pickerTab, setPickerTab] = useState('favorites');
  const [pickerSearch, setPickerSearch] = useState('');

  // Se não estiver logado, redireciona ou pede login
  useEffect(() => {
    if (!isLoggedIn) {
      openAuth('login');
      navigate('/');
    }
  }, [isLoggedIn]);

  // Carrega dados iniciais do perfil e do acervo do usuário (sem flick de desmontagem)
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!cleanUsername) return;
      if (!profile) setLoading(true);
      try {
        const [profData, favData, watchData, revData] = await Promise.all([
          getUserProfile(cleanUsername).catch(() => null),
          getUserFavorites(cleanUsername).catch(() => []),
          getUserWatched(cleanUsername).catch(() => []),
          getUserReviews(cleanUsername).catch(() => []),
        ]);

        if (isMounted) {
          setProfile(profData);
          setAvatarUrl(profData?.avatar_url || '');

          // Inicializa os 4 pilares a partir dos salvos pelo usuário
          let initialPillars = [];
          if (profData?.four_pillars) {
            try {
              const parsed = JSON.parse(profData.four_pillars);
              if (Array.isArray(parsed)) {
                initialPillars = parsed.slice(0, 4);
              }
            } catch (e) { }
          }

          setPillars(initialPillars);
          setFavorites(Array.isArray(favData) ? favData : []);
          setWatched(Array.isArray(watchData) ? watchData : []);
          setReviews(Array.isArray(revData) ? revData : []);
        }
      } catch (err) {
        if (isMounted) {
          showToast('Erro ao carregar dados de configuração.', true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [cleanUsername]);

  // Pool de títulos para o seletor com filtro de busca
  const availablePool = useMemo(() => {
    const map = new Map();

    const addItems = (list) => {
      list.forEach((item) => {
        if (!item || !item.tmdb_id) return;
        const key = String(item.tmdb_id);
        if (!map.has(key)) {
          map.set(key, {
            tmdb_id: item.tmdb_id,
            title: item.movie_title || item.title,
            poster_url: item.poster_url,
            media_type: item.media_type || 'movie',
            release_date: item.release_date || '',
          });
        }
      });
    };

    if (pickerTab === 'favorites') {
      addItems(favorites);
    } else if (pickerTab === 'watched') {
      addItems(watched);
    } else {
      addItems(reviews);
    }

    const items = Array.from(map.values());
    if (!pickerSearch.trim()) return items;

    const q = pickerSearch.trim().toLowerCase();
    return items.filter((item) => (item.title || '').toLowerCase().includes(q));
  }, [pickerTab, favorites, watched, reviews, pickerSearch]);

  const assignedIds = useMemo(() => {
    return new Set(pillars.map((p) => String(p.tmdb_id)));
  }, [pillars]);

  // Processamento e compressão automática de imagem via Canvas para perfil quadrado ultra-leve
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).', true);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      showToast('Erro ao ler arquivo do computador.', true);
    };
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        showToast('Não foi possível carregar a imagem selecionada.', true);
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 300;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // Crop centralizado mantendo proporção quadrada
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          setAvatarUrl(optimizedDataUrl);
          showToast('Foto selecionada e otimizada com sucesso!');
        } catch (err) {
          setAvatarUrl(event.target.result);
          showToast('Foto carregada do computador!');
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectPillar = (item) => {
    if (assignedIds.has(String(item.tmdb_id))) {
      setPillars((prev) => prev.filter((p) => String(p.tmdb_id) !== String(item.tmdb_id)));
      return;
    }

    if (pillars.length >= 4) {
      setPillars((prev) => [...prev.slice(0, 3), item]);
    } else {
      setPillars((prev) => [...prev, item]);
    }
  };

  const handleRemovePillar = (idx, e) => {
    e.stopPropagation();
    setPillars((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        avatar_url: avatarUrl.trim(),
        four_pillars: JSON.stringify(pillars),
      };

      await updateUserProfile(payload);
      if (updateUserAvatar) {
        updateUserAvatar(avatarUrl.trim());
      }
      showToast('Perfil atualizado com sucesso!');
      navigate(`/user/${cleanUsername}`);
    } catch (err) {
      showToast(err.message || 'Erro ao salvar alterações do perfil.', true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-profile-page">
        <div className="my-box-loading">
          <span className="my-box-loading-indicator" />
          <span>Acessando dados de configuração do perfil...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-page">
      {/* 1. TOP BAR / NAVEGAÇÃO DE RETORNO */}
      <div className="edit-profile-top-bar">
        <button
          type="button"
          className="edit-profile-back-link"
          onClick={() => navigate(`/user/${cleanUsername}`)}
        >
          <ArrowLeft size={13} />
          <span>VOLTAR AO MEU PERFIL</span>
        </button>
      </div>

      {/* 2. CABEÇALHO DA PÁGINA */}
      <header className="edit-profile-page-header">
        <h1 className="edit-profile-page-title">CONFIGURAÇÃO DO PERFIL</h1>
        <p className="edit-profile-page-subtitle">
          Personalize sua identidade pública no Criticbox e selecione as quatro obras pilares que definem seu gosto cinematográfico.
        </p>
      </header>

      {/* 3. SEÇÃO 1: FOTO DE PERFIL / AVATAR */}
      <section className="edit-page-card">
        <div className="edit-page-card-header">
          <div className="edit-page-card-title">
            <span style={{ color: 'var(--accent)' }}>■</span>
            <span>FOTO DE PERFIL</span>
          </div>
        </div>

        <div className="edit-page-avatar-row">
          <div
            className="edit-page-avatar-preview"
            onClick={() => fileInputRef.current?.click()}
            title="Clique para escolher uma imagem do seu computador"
            role="button"
            tabIndex={0}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar Preview" />
            ) : (
              (cleanUsername || 'U')[0].toUpperCase()
            )}
          </div>

          <div className="edit-page-avatar-controls">
            <p className="edit-page-avatar-hint">
              Selecione uma imagem do seu computador (JPG, PNG ou WebP).
            </p>

            <div className="edit-page-avatar-actions">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="nav-btn nav-btn-accent"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} style={{ marginRight: '8px' }} />
                {avatarUrl ? 'SUBSTITUIR FOTO DO COMPUTADOR' : 'SELECIONAR FOTO DO COMPUTADOR'}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  className="nav-btn nav-btn-ghost"
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  onClick={() => setAvatarUrl('')}
                >
                  <Trash2 size={14} style={{ marginRight: '8px' }} />
                  REMOVER FOTO
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. SEÇÃO 2: OS QUATRO PILARES DA CURADORIA */}
      <section className="edit-page-card">
        <div className="edit-page-card-header">
          <div className="edit-page-card-title">
            <span style={{ color: 'var(--accent)' }}>■</span>
            <span>OS QUATRO PILARES DA CURADORIA ({pillars.length}/4)</span>
          </div>
          <span className="edit-page-card-desc">EXIBIÇÃO PRINCIPAL NO SEU DOSSIÊ PÚBLICO</span>
        </div>

        <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '0.84rem', color: 'var(--gray-400)', margin: '0 0 12px 0' }}>
          Selecione as 4 obras mais representativas do seu acervo cinematográfico. Elas ocuparão os pilares com destaque no topo do seu perfil.
        </p>

        {/* 4 SLOTS PRINCIPAIS */}
        <div className="edit-page-pillars-slots">
          {[0, 1, 2, 3].map((idx) => {
            const item = pillars[idx];
            return (
              <div
                key={idx}
                className={`edit-page-slot-card ${item ? 'filled' : ''}`}
                title={item ? item.title : `Slot #${idx + 1} Vago`}
              >
                <span className="edit-page-slot-badge">#{String(idx + 1).padStart(2, '0')}</span>
                {item ? (
                  <>
                    <img
                      src={item.poster_url || 'https://via.placeholder.com/300x450?text=Poster'}
                      alt={item.title}
                    />
                    <button
                      type="button"
                      className="edit-page-slot-remove"
                      onClick={(e) => handleRemovePillar(idx, e)}
                      title="Remover deste pilar"
                      aria-label="Remover deste pilar"
                    >
                      <X size={14} />
                    </button>
                    <div className="edit-page-slot-meta">
                      <span className="edit-page-slot-meta-title">{item.title}</span>
                    </div>
                  </>
                ) : (
                  <div className="edit-page-slot-empty-content">
                    <span style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 800 }}>+</span>
                    <span className="edit-page-slot-empty-title">PILAR #{idx + 1}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontFamily: 'Space Grotesk' }}>
                      ESCOLHA ABAIXO
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CATÁLOGO DE SELEÇÃO RÁPIDA */}
        <div className="edit-page-picker-box">
          <div className="edit-page-picker-toolbar">
            <div className="edit-page-picker-tabs">
              <button
                type="button"
                className={`edit-page-picker-tab ${pickerTab === 'favorites' ? 'active' : ''}`}
                onClick={() => setPickerTab('favorites')}
              >
                <Heart size={13} />
                <span>Favoritos ({favorites.length})</span>
              </button>
              <button
                type="button"
                className={`edit-page-picker-tab ${pickerTab === 'watched' ? 'active' : ''}`}
                onClick={() => setPickerTab('watched')}
              >
                <Eye size={13} />
                <span>Assistidos ({watched.length})</span>
              </button>
              <button
                type="button"
                className={`edit-page-picker-tab ${pickerTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setPickerTab('reviews')}
              >
                <Film size={13} />
                <span>Avaliados ({reviews.length})</span>
              </button>
            </div>

            <div className="edit-page-picker-search">
              <Search size={14} style={{ color: 'var(--gray-500)' }} />
              <input
                type="text"
                placeholder="Filtrar catálogo..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
              {pickerSearch && (
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--gray-400)', cursor: 'pointer' }}
                  onClick={() => setPickerSearch('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {availablePool.length === 0 ? (
            <p style={{ fontFamily: 'Space Grotesk', fontSize: '0.78rem', color: 'var(--gray-500)', margin: '24px 0', textAlign: 'center' }}>
              Nenhuma obra encontrada nesta categoria ou termo pesquisado.
            </p>
          ) : (
            <div className="edit-page-picker-grid">
              {availablePool.map((item) => {
                const isSelected = assignedIds.has(String(item.tmdb_id));
                return (
                  <div
                    key={item.tmdb_id}
                    className={`edit-page-picker-item ${isSelected ? 'selected-in-slot' : ''}`}
                    onClick={() => handleSelectPillar(item)}
                    title={item.title}
                  >
                    <img
                      src={item.poster_url || 'https://via.placeholder.com/200x300?text=Sem+Poster'}
                      alt={item.title}
                      loading="lazy"
                    />
                    <span className="edit-page-picker-item-label">{item.title}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 5. BARRA DE AÇÕES INFERIOR */}
      <div className="edit-page-actions-bar">
        <button
          type="button"
          className="nav-btn nav-btn-ghost"
          onClick={() => navigate(`/user/${cleanUsername}`)}
          disabled={saving}
        >
          DESCARTAR ALTERAÇÕES
        </button>
        <button
          type="button"
          className="nav-btn nav-btn-accent"
          onClick={handleSave}
          disabled={saving}
        >
          <Check size={14} style={{ marginRight: '6px' }} />
          {saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
        </button>
      </div>
    </div>
  );
}
