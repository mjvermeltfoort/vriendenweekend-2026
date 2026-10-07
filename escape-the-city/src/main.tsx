import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './app/App';
import { Providers } from './app/providers';
import { registerServiceWorker } from './features/pwa/registerServiceWorker';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/global.css';

// Build bump to force a new hashed bundle for deployment/SW cache refresh
const BUILD_ID = '2026-10-07-02';
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-ec-build', BUILD_ID);
  // Log for diagnostics (harmless in production)
  console.info('Escape-the-City build', BUILD_ID);
}

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <HashRouter>
        <App />
      </HashRouter>
    </Providers>
  </React.StrictMode>
);
