/**
 * @file Frontend App Wrapper - RUSTICI KILLER
 * @description Main application wrapper with authentication context
 * @version 0.2.0 - Phase 2: Authentication System
 */

import React from 'react';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import '../styles/globals.css';

/**
 * Main App Component - wraps all pages with authentication context
 */
const App = ({ Component, pageProps }: AppProps) => {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
};

export default App;
