import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Setup } from './pages/Setup';
import { PrayerTimes } from './pages/PrayerTimes';
import { AudioSettings } from './pages/AudioSettings';
import { RamadanSettings } from './pages/RamadanSettings';
import { MultiRoom } from './pages/MultiRoom';
import { DeviceSettings } from './pages/DeviceSettings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForceChangePassword } from './pages/ForceChangePassword';
import { Profile } from './pages/Profile';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes — no Layout wrapper */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/change-password" element={
              <PrivateRoute><ForceChangePassword /></PrivateRoute>
            } />

            {/* Protected routes — inside Layout */}
            <Route path="/" element={
              <PrivateRoute>
                <Layout><Home /></Layout>
              </PrivateRoute>
            } />
            <Route path="/setup" element={
              <PrivateRoute>
                <Layout><Setup /></Layout>
              </PrivateRoute>
            } />
            <Route path="/prayers" element={
              <PrivateRoute>
                <Layout><PrayerTimes /></Layout>
              </PrivateRoute>
            } />
            <Route path="/audio" element={
              <PrivateRoute>
                <Layout><AudioSettings /></Layout>
              </PrivateRoute>
            } />
            <Route path="/ramadan" element={
              <PrivateRoute>
                <Layout><RamadanSettings /></Layout>
              </PrivateRoute>
            } />
            <Route path="/multi-room" element={
              <PrivateRoute>
                <Layout><MultiRoom /></Layout>
              </PrivateRoute>
            } />
            <Route path="/settings" element={
              <PrivateRoute>
                <Layout><DeviceSettings /></Layout>
              </PrivateRoute>
            } />
            <Route path="/profile" element={
              <PrivateRoute>
                <Layout><Profile /></Layout>
              </PrivateRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
