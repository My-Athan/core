import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { DeviceDetail } from './pages/DeviceDetail';
import { Releases } from './pages/Releases';
import { Groups } from './pages/Groups';
import { Analytics } from './pages/Analytics';
import { Setup } from './pages/Setup';
import { SSOConfig } from './pages/SSOConfig';
import { AppUsers } from './pages/AppUsers';
import { AppUserDetail } from './pages/AppUserDetail';
import { api } from './lib/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'unauth'>('loading');

  useEffect(() => {
    api.me()
      .then(() => setStatus('ok'))
      .catch(() => setStatus('unauth'));
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#1a7a4c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }
  if (status === 'unauth') return <Navigate to="/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><Devices /></ProtectedRoute>} />
        <Route path="/devices/:deviceId" element={<ProtectedRoute><DeviceDetail /></ProtectedRoute>} />
        <Route path="/releases" element={<ProtectedRoute><Releases /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/sso" element={<ProtectedRoute><SSOConfig /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><AppUsers /></ProtectedRoute>} />
        <Route path="/users/:userId" element={<ProtectedRoute><AppUserDetail /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
