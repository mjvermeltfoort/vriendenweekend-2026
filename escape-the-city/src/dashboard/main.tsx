import React from 'react';
import ReactDOM from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DashboardApp } from './DashboardApp';
import './dashboard.css';

ReactDOM.createRoot(document.getElementById('dashboard-root')!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>
);
