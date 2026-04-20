import React from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayPage } from './pages/OverlayPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OverlayPage />
  </React.StrictMode>,
);

