import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ReviewModalProvider } from './context/ReviewModalContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import ReviewModal from './components/ReviewModal';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import MovieDetailPage from './pages/MovieDetailPage';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ReviewModalProvider>
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
          </Routes>

          <Footer />

          {/* Global Modals */}
          <AuthModal />
          <ReviewModal />
        </ReviewModalProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
