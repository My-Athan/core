import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { Releases } from './pages/Releases';
import { Groups } from './pages/Groups';
import { Analytics } from './pages/Analytics';
import { Map } from './pages/Map';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><Map /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><Devices /></ProtectedRoute>} />
        <Route path="/releases" element={<ProtectedRoute><Releases /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
