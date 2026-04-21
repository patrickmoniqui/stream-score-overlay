import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminPage } from './pages/AdminPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminPage />
  </React.StrictMode>,
);
