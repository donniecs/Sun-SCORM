/**
 * CHANGE LOG - 2025-07-14 19:08
 * =========================
 * WHAT: Updated dashboard.tsx with Phase 5 course listing functionality
 * WHY: Users need to view and manage their uploaded courses
 * IMPACT: Dashboard now displays course cards with navigation to individual courses
 * NOTES FOR CHATGPT: Added course fetching, state management, and course grid display
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { Course, CourseListResponse } from '../../../packages/types/src/Course';

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch courses when user is available
  useEffect(() => {
    if (user) {
      fetchCourses();
    }
  }, [user]);

  const fetchCourses = async () => {
    try {
      setCoursesLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/courses', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch courses: ${response.status}`);
      }

      const data: CourseListResponse = await response.json();
      
      if (data.success) {
        setCourses(data.courses);
      } else {
        throw new Error('Failed to fetch courses');
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch courses');
    } finally {
      setCoursesLoading(false);
    }
  };

  const handleCourseClick = (courseId: string) => {
    router.push(`/courses/${courseId}`);
  };

  const handleUploadClick = () => {
    router.push('/upload');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Dashboard - Rustici Killer</title>
        <meta name="description" content="Rustici Killer Dashboard" />
      </Head>

      <Navbar />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  My Courses
                </h1>
                <p className="text-xl text-gray-600">
                  Welcome back, {user.email}! Manage your SCORM courses below.
                </p>
              </div>
              <button 
                onClick={handleUploadClick}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload New Course
              </button>
            </div>
          </div>

          {coursesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading your courses...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 text-lg mb-4">Error Loading Courses</div>
              <p className="text-gray-600 mb-6">{error}</p>
              <button 
                onClick={fetchCourses}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">�</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">No courses yet</h2>
              <p className="text-gray-600 mb-6">Upload your first SCORM course to get started!</p>
              <button 
                onClick={handleUploadClick}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {course.title}
                    </h3>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      v{course.version}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Files:</span>
                      <span className="text-gray-900">{course.fileCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Structure:</span>
                      <span className="text-gray-900">{course.structure.length} items</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        Uploaded: {formatDate(course.createdAt.toString())}
                      </span>
                      <button
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCourseClick(course.id);
                        }}
                      >
                        View Course
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              ✅ Phase 5 Complete - Course Persistence & Dashboard
            </h3>
            <p className="text-green-700 text-sm">
              Course persistence is now fully functional! You can upload courses, view them in the dashboard, and navigate to individual course pages.
              Phase 6 will add course viewer functionality and content delivery features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
