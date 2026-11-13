import React, { useState, useEffect, useRef } from 'react';
import { Film, Tv, X } from 'lucide-react';
import { searchUsers } from '../api/social';

export function useReviewFormState(resetTrigger) {
  const [modalRating, setModalRating] = useState(5.0);
  const [hoverRating, setHoverRating] = useState(null);
  const [modalComment, setModalComment] = useState('');
  const [modalSpoilers, setModalSpoilers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailed, setIsDetailed] = useState(false);
  const [customRating, setCustomRating] = useState('');
  const [watchedWith, setWatchedWith] = useState([]);
  const [venue, setVenue] = useState('');

  useEffect(() => {
    if (!resetTrigger) return;
    const initialRating =
      typeof resetTrigger.rating === 'number'
        ? resetTrigger.rating
        : typeof resetTrigger.user_rating === 'number' && resetTrigger.user_rating > 0
        ? resetTrigger.user_rating
        : 5.0;
    const initialComment = resetTrigger.comment || resetTrigger.user_comment || '';
    const initialSpoilers = Boolean(resetTrigger.contains_spoilers);
    const initialCustom = resetTrigger.custom_rating ? String(resetTrigger.custom_rating) : '';
    let initialWatchedWith = [];
    if (Array.isArray(resetTrigger.watched_with)) {
      initialWatchedWith = resetTrigger.watched_with;
    } else if (typeof resetTrigger.watched_with === 'string' && resetTrigger.watched_with.trim()) {
      initialWatchedWith = resetTrigger.watched_with.split(',').map((s) => s.trim()).filter(Boolean);
    }
    const initialVenue = resetTrigger.viewing_venue || resetTrigger.venue || '';

    setModalRating(initialRating);
    setHoverRating(null);
    setModalComment(initialComment);
    setModalSpoilers(initialSpoilers);
    setIsDetailed(Boolean(initialCustom || initialWatchedWith.length > 0 || initialVenue));
    setCustomRating(initialCustom);
    setWatchedWith(initialWatchedWith);
    setVenue(initialVenue);
  }, [resetTrigger]);

  return {
    modalRating,
    setModalRating,
    hoverRating,
    setHoverRating,
    displayedRating: hoverRating !== null ? hoverRating : modalRating,
    modalComment,
    setModalComment,
    modalSpoilers,
    setModalSpoilers,
    isSubmitting,
    setIsSubmitting,
    isDetailed,
    setIsDetailed,
    customRating,
    setCustomRating,
    watchedWith,
    setWatchedWith,
    venue,
    setVenue,
  };
}

export function StarRatingSplitSection({
  modalRating,
  setModalRating,
  displayedRating,
  setHoverRating,
  isDetailed,
  customRating,
  setCustomRating,
}) {
  const resolveStarScore = (e, starIdx) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    return isLeftHalf ? starIdx - 0.5 : starIdx;
  };

  return (
    <div className="v1-rating-split">
      <div>
        <label className="v1-field-label">SUA CLASSIFICAÇÃO (0.5 A 5.0 ESTRELAS)</label>
        <div className="v1-rating-row">
          <div className="stars-flex" onMouseLeave={() => setHoverRating(null)}>
            {[1, 2, 3, 4, 5].map((starIdx) => {
              const isFull = displayedRating >= starIdx;
              const isHalf = !isFull && displayedRating >= starIdx - 0.5;
              const starClass = isFull ? 'star-glyph full' : isHalf ? 'star-glyph half' : 'star-glyph';

              return (
                <span
                  key={starIdx}
                  className={starClass}
                  onClick={(e) => setModalRating(resolveStarScore(e, starIdx))}
                  onMouseMove={(e) => setHoverRating(resolveStarScore(e, starIdx))}
                >
                  <svg viewBox="0 0 24 24">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
              );
            })}
          </div>
          <span className="v1-score-badge">{modalRating.toFixed(1)}</span>
        </div>
      </div>

      <CustomRatingField
        isDetailed={isDetailed}
        customRating={customRating}
        setCustomRating={setCustomRating}
      />
    </div>
  );
}

export function ReviewModalActionsRow({
  modalSpoilers,
  setModalSpoilers,
  isDetailed,
  setIsDetailed,
  isSubmitting,
  onSubmit,
}) {
  return (
    <div className="v1-actions-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <label className="v1-spoiler-wrap">
          <input
            type="checkbox"
            checked={modalSpoilers}
            onChange={(e) => setModalSpoilers(e.target.checked)}
          />
          <span className="v1-custom-checkbox"></span>
          <span>Contém spoilers</span>
        </label>

        <DetailedReviewToggle isDetailed={isDetailed} setIsDetailed={setIsDetailed} />
      </div>

      <button className="v1-submit-btn" disabled={isSubmitting} onClick={onSubmit}>
        {isSubmitting ? 'PUBLICANDO...' : 'PUBLICAR AVALIAÇÃO'}
      </button>
    </div>
  );
}

export function CustomRatingField({ isDetailed, customRating, setCustomRating }) {
  const inputRef = useRef(null);
  if (!isDetailed) return null;

  const handleChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      setCustomRating('');
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 9999) {
      setCustomRating(num);
    }
  };

  return (
    <div className="v1-custom-score-block">
      <label className="v1-field-label">SCORE LIVRE</label>
      <div 
        className="v1-custom-score-badge-wrap"
        onClick={() => inputRef.current?.focus()}
        title="Nota numérica pessoal de 0 a 9999"
      >
        <input
          ref={inputRef}
          type="number"
          min="0"
          max="9999"
          step="1"
          placeholder="0"
          value={customRating}
          onChange={handleChange}
          className="v1-custom-score-input"
          aria-label="Nota numérica livre de 0 a 9999"
        />
        <span className="v1-custom-score-denom">/ 9999</span>
      </div>
    </div>
  );
}

const VENUE_OPTIONS = [
  { id: 'Cinema', label: 'Cinema', icon: Film },
  { id: 'Streaming', label: 'Streaming', icon: Tv },
];

export function CoViewingAndVenueFields({
  isDetailed,
  watchedWith = [],
  setWatchedWith,
  venue = '',
  setVenue,
}) {
  const [coviewingInput, setCoviewingInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const query = coviewingInput.trim().replace(/^@/, '');
    if (!query || query.length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(query, 5);
        const list = Array.isArray(results) ? results : (results?.users || []);
        setSuggestions(list);
        setSelectedIndex(0);
        setShowDropdown(list.length > 0);
      } catch (err) {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [coviewingInput]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isDetailed) return null;

  const addPill = (rawName) => {
    const clean = rawName.trim().replace(/,+$/, '');
    if (!clean) return;

    let formatted = clean;
    if (clean.startsWith('@')) {
      const handle = clean.replace(/^@+/, '').trim();
      if (!handle) return;
      formatted = `@${handle}`;
    }

    if (!watchedWith.includes(formatted)) {
      setWatchedWith([...watchedWith, formatted]);
    }
    setCoviewingInput('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removePill = (idxToRemove) => {
    setWatchedWith(watchedWith.filter((_, idx) => idx !== idxToRemove));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      if (showDropdown && suggestions.length > 0 && suggestions[selectedIndex]) {
        addPill(`@${suggestions[selectedIndex].username}`);
      } else if (coviewingInput.trim()) {
        addPill(coviewingInput.trim());
      }
    } else if (e.key === 'ArrowDown') {
      if (showDropdown && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      if (showDropdown && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    } else if (e.key === 'Backspace' && coviewingInput === '' && watchedWith.length > 0) {
      removePill(watchedWith.length - 1);
    }
  };

  const handleBlur = (e) => {
    if (e.relatedTarget && e.relatedTarget.closest('.v1-autocomplete-dropdown')) {
      return;
    }
    if (coviewingInput.trim()) {
      addPill(coviewingInput.trim());
    }
  };

  const handleToggleVenue = (vId) => {
    setVenue(venue === vId ? '' : vId);
  };

  return (
    <div className="v1-detailed-fields">
      {/* SEÇÃO: COM QUEM ASSISTIU */}
      <div className="v1-coviewing-block" ref={containerRef}>
        <label className="v1-field-label">COM QUEM ASSISTIU</label>
        <div className="v1-tag-box" onClick={() => inputRef.current?.focus()}>
          {watchedWith.map((person, idx) => {
            const isUser = person.startsWith('@');
            const cleanName = person.replace(/^@+/, '').trim();
            return (
              <span
                key={idx}
                className={isUser ? 'v1-pill-user' : 'v1-pill-custom'}
              >
                <span className="v1-pill-name">{cleanName}</span>
                <button
                  type="button"
                  className="v1-pill-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePill(idx);
                  }}
                  title={`Remover ${cleanName}`}
                  aria-label={`Remover ${cleanName}`}
                >
                  <X size={10} strokeWidth={2.2} />
                </button>
              </span>
            );
          })}

          <input
            ref={inputRef}
            type="text"
            className="v1-tag-input-field"
            placeholder={
              watchedWith.length === 0
                ? "@amigo ou nome..."
                : "+ outro..."
            }
            value={coviewingInput}
            onChange={(e) => setCoviewingInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </div>

        {/* AUTOCOMPLETE DROPDOWN */}
        {showDropdown && suggestions.length > 0 && (
          <div className="v1-autocomplete-dropdown">
            {suggestions.map((u, idx) => (
              <div
                key={u.user_id || u.username}
                className={`v1-autocomplete-item ${idx === selectedIndex ? 'selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addPill(`@${u.username}`);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="v1-autocomplete-avatar">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username} className="v1-autocomplete-avatar-img" />
                  ) : (
                    <span>{(u.username || 'U')[0].toUpperCase()}</span>
                  )}
                </span>
                <span className="v1-autocomplete-handle">{u.username}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEÇÃO: LOCAL / ONDE ASSISTIU */}
      <div className="v1-venue-block">
        <label className="v1-field-label">LOCAL</label>
        <div className="v1-venue-btns">
          {VENUE_OPTIONS.map((item) => {
            const isSelected = venue === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`v1-venue-btn ${isSelected ? 'active' : ''}`}
                onClick={() => handleToggleVenue(item.id)}
              >
                <Icon size={13} strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DetailedReviewToggle({ isDetailed, setIsDetailed }) {
  return (
    <label className="v1-spoiler-wrap v1-detailed-toggle">
      <input
        type="checkbox"
        checked={isDetailed}
        onChange={(e) => setIsDetailed(e.target.checked)}
      />
      <span className="v1-custom-checkbox"></span>
      <span style={{ fontWeight: 600 }}>Avaliação detalhada</span>
    </label>
  );
}
