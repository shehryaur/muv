import WebApp from '@twa-dev/sdk';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react';
import './index.css'
import App from './App.jsx'

if (WebApp && typeof WebApp.ready === 'function') {
  WebApp.ready();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
