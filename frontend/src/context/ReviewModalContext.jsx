import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { isUnreleased } from '../utils/date';
import { CACHE_KEY_REVIEWS, CACHE_KEY_TRENDING } from '../utils/constants';

const ReviewModalContext = createContext(null);

export function ReviewModalProvider({ children }) {
  const { isLoggedIn, openAuth } = useAuth();
  const { showToast } = useToast();

  const [reviewModalMovie, setReviewModalMovie] = useState(null);
  const [onSuccessCallback, setOnSuccessCallback] = useState(null);
  const [reviewRevision, setReviewRevision] = useState(0);

  const openReviewModal = (movie, onSuccess = null, prefill = null) => {
    if (!isLoggedIn) {
      showToast('Faça login para avaliar.', true);
      openAuth('login');
      return;
    }

    if (isUnreleased(movie?.release_date)) {
      showToast('Este título ainda não estreou e não está disponível para avaliação.', true);
      return;
    }

    setReviewModalMovie(prefill ? { ...movie, _prefill: prefill } : movie);
    setOnSuccessCallback(() => onSuccess);
  };

  const closeReviewModal = () => {
    setReviewModalMovie(null);
    setOnSuccessCallback(null);
  };

  const onReviewSuccess = (rating, scopeInfo = '') => {
    try {
      sessionStorage.removeItem(CACHE_KEY_REVIEWS);
      sessionStorage.removeItem(CACHE_KEY_TRENDING);
    } catch (e) {}

    setReviewRevision((prev) => prev + 1);

    if (reviewModalMovie) {
      showToast(
        `[${reviewModalMovie.title}${scopeInfo}] Crítica publicada com nota ${rating.toFixed(1)}!`,
        false
      );
    }

    if (onSuccessCallback) {
      onSuccessCallback();
    }

    closeReviewModal();
  };

  const value = {
    reviewModalMovie,
    reviewRevision,
    openReviewModal,
    closeReviewModal,
    onReviewSuccess,
  };

  return <ReviewModalContext.Provider value={value}>{children}</ReviewModalContext.Provider>;
}

export function useReviewModal() {
  const context = useContext(ReviewModalContext);
  if (!context) {
    throw new Error('useReviewModal must be used within a ReviewModalProvider');
  }
  return context;
}
