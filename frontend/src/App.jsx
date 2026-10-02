import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ReviewModalProvider } from './context/ReviewModalContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import ReviewModal from './components/ReviewModal';
import EpisodeReviewModal from './components/EpisodeReviewModal';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import MovieDetailPage from './pages/MovieDetailPage';

function AuthRouteWatcher() {
  const location = useLocation();
  const { openAuth } = useAuth();

  useEffect(() => {
    if (location.pathname === '/login') {
      openAuth('login');
    } else if (location.pathname === '/register') {
      openAuth('register');
    }
  }, [location.pathname, openAuth]);

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ReviewModalProvider>
          <AuthRouteWatcher />
          {/* Hidden SVG for half-star gradient */}
          <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
            <defs>
              <linearGradient id="halfGrad">
                <stop offset="50%" stopColor="#ff9900" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
              </linearGradient>
            </defs>
          </svg>

          <Navbar />

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/movie/:id" element={<MovieDetailPage />} />
            <Route path="/movies/:id" element={<MovieDetailPage />} />
            <Route path="/login" element={<HomePage />} />
            <Route path="/register" element={<HomePage />} />
            <Route path="/auth" element={<HomePage />} />
          </Routes>

          <Footer />

          {/* Global Modals */}
          <AuthModal />
          <ReviewModal />
          <EpisodeReviewModal />
        </ReviewModalProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
