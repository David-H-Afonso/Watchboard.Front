import React from 'react';
import ReactDOM from 'react-dom/client';
import './fonts.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
