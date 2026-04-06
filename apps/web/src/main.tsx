import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Setup } from './pages/Setup';
import { PrayerTimes } from './pages/PrayerTimes';
import { AudioSettings } from './pages/AudioSettings';
import { RamadanSettings } from './pages/RamadanSettings';
import { MultiRoom } from './pages/MultiRoom';
import { DeviceSettings } from './pages/DeviceSettings';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/prayers" element={<PrayerTimes />} />
            <Route path="/audio" element={<AudioSettings />} />
            <Route path="/ramadan" element={<RamadanSettings />} />
            <Route path="/multi-room" element={<MultiRoom />} />
            <Route path="/settings" element={<DeviceSettings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
