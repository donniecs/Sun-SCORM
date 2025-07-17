/**
 * Layout Component - Unified Nexos-style Design
 * 
 * PHASE 4 IMPLEMENTATION: Modern layout component with consistent navigation
 * 
 * Features:
 * - Responsive design with mobile support
 * - Modern Nexos.ai inspired styling
 * - Consistent navigation across all pages
 * - User authentication state handling
 * - Clean and professional appearance
 */

import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  requireAuth?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = 'Sun-SCORM Platform',
  description = 'Modern SCORM content management and delivery platform',
  requireAuth = false
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Handle authentication requirements
  React.useEffect(() => {
    if (!loading && requireAuth && !user) {
      router.push('/login');
    }
  }, [user, loading, requireAuth, router]);

  // Show loading while auth is being checked
  if (loading && requireAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if auth is required but user is not authenticated
  if (requireAuth && !user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <Navbar />

        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-500">
                  © 2024 Sun-SCORM Platform. All rights reserved.
                </p>
              </div>
              <div className="flex items-center space-x-6">
                <a 
                  href="/docs" 
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Documentation
                </a>
                <a 
                  href="https://github.com/donniecs/Sun-SCORM" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Layout;