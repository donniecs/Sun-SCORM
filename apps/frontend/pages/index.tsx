/**
 * @file Frontend Home Page - RUSTICI KILLER
 * @description Main landing page with auth redirects
 * @version 0.2.0 - Phase 2: Authentication System
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const HomePage: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Rustici Killer - The Stripe for E-Learning</title>
        <meta name="description" content="Modern SCORM Cloud Alternative - Developer-friendly e-learning platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            🚀 Rustici Killer
          </h1>
          
          <p className="text-2xl text-gray-600 mb-8">
            The Stripe for E-Learning
          </p>
          
          <p className="text-lg text-gray-500 mb-12 max-w-3xl mx-auto">
            A modern, developer-friendly alternative to Rustici SCORM Cloud. 
            Upload courses, track learners, and integrate with your applications 
            using our clean, RESTful API.
          </p>

          <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
            {!user && (
              <>
                <button
                  onClick={() => router.push('/register')}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
                >
                  Get Started Free
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition-colors"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-20">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              ✅ Phase 2 Complete - Authentication System
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  User Authentication
                </h3>
                <p className="text-gray-600">
                  Secure JWT-based authentication with bcrypt password hashing
                </p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-4">🏢</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Multi-Tenant Support
                </h3>
                <p className="text-gray-600">
                  Each organization gets its own tenant with isolated data
                </p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Protected Routes
                </h3>
                <p className="text-gray-600">
                  Frontend routing with authentication guards and redirects
                </p>
              </div>
            </div>

            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                🧪 Try it out:
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>1. Click "Get Started Free" to create an account</p>
                <p>2. Enter your email, password, and organization name</p>
                <p>3. You'll be automatically logged in and redirected to the dashboard</p>
                <p>4. The dashboard shows your account info and tenant details</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500">
            Next: Phase 3 will add database integration and content management
          </p>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
