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
  const [episodeModalData, setEpisodeModalData] = useState(null);
  const [onSuccessCallback, setOnSuccessCallback] = useState(null);
  const [reviewRevision, setReviewRevision] = useState(0);

  const openReviewModal = (movie, onSuccess = null) => {
    if (!isLoggedIn) {
      showToast('Faça login para avaliar.', true);
      openAuth('login');
      return;
    }

    if (isUnreleased(movie?.release_date)) {
      showToast('Este título ainda não estreou e não está disponível para avaliação.', true);
      return;
    }

    setReviewModalMovie(movie);
    setOnSuccessCallback(() => onSuccess);
  };

  const openEpisodeReviewModal = (movie, episode, season, onSuccess = null, userReviews = null) => {
    if (!isLoggedIn) {
      showToast('Faça login para avaliar.', true);
      openAuth('login');
      return;
    }

    if (episode?.air_date && isUnreleased(episode.air_date)) {
      showToast('Este episódio ainda não estreou e não está disponível para avaliação.', true);
      return;
    }

    if (
      userReviews &&
      userReviews.some(
        (r) =>
          Number(r.season_number) === Number(season) &&
          Number(r.episode_number) === Number(episode?.episode_number)
      )
    ) {
      showToast(`Você já avaliou o Episódio ${episode?.episode_number} da Temporada ${season}.`, true);
      return;
    }

    setEpisodeModalData({ movie, episode, season });
    setOnSuccessCallback(() => onSuccess);
  };

  const closeReviewModal = () => {
    setReviewModalMovie(null);
    setOnSuccessCallback(null);
  };

  const closeEpisodeReviewModal = () => {
    setEpisodeModalData(null);
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

  const onEpisodeReviewSuccess = (rating, movie, episode, season) => {
    try {
      sessionStorage.removeItem(CACHE_KEY_REVIEWS);
      sessionStorage.removeItem(CACHE_KEY_TRENDING);
    } catch (e) {}

    setReviewRevision((prev) => prev + 1);

    const epTitle = episode?.name ? ` - "${episode.name}"` : '';
    showToast(
      `[${movie?.title || 'Série'} - T${season}E${episode?.episode_number}${epTitle}] Crítica publicada com nota ${rating.toFixed(1)}!`,
      false
    );

    if (onSuccessCallback) {
      onSuccessCallback();
    }

    closeEpisodeReviewModal();
  };

  const value = {
    reviewModalMovie,
    episodeModalData,
    reviewRevision,
    openReviewModal,
    closeReviewModal,
    openEpisodeReviewModal,
    closeEpisodeReviewModal,
    onReviewSuccess,
    onEpisodeReviewSuccess,
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
