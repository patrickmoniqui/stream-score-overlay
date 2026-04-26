import React from 'react';
import ReactDOM from 'react-dom/client';
import { LiveGoalPage } from './pages/LiveGoalPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LiveGoalPage />
  </React.StrictMode>,
);
