/**
 * CHANGE LOG - 2025-07-14 19:58
 * =========================
 * WHAT: Updated course viewer with functional launch button
 * WHY: Phase 6 requirement to enable SCORM course launching
 * IMPACT: Users can now launch courses and start SCORM runtime sessions
 * NOTES FOR CHATGPT: Launch button now calls API endpoint and opens new tab
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';
import { Course, CourseResponse } from '@rustici-killer/types';

interface Registration {
  sessionId: string;
  completion_status: string;
  score: number;
  startedAt: string;
  status: string;
  progress: number;
  progressData: any;
}

// =============================================================================
// SEQUENCING SESSION STATE - PHASE 9 ADDITION
// =============================================================================

interface SequencingSessionState {
  sessionId: string;
  currentActivity?: string;
  nextActivity?: string;
  previousActivity?: string;
  navigationState: 'created' | 'active' | 'completed' | 'suspended';
  availableNavigation: {
    previous: boolean;
    next: boolean;
    choice: string[];
    exit: boolean;
  };
}

const CourseViewer: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [course, setCourse] = useState<Course | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [sequencingState, setSequencingState] = useState<SequencingSessionState | null>(null);
  const [progressPollingInterval, setProgressPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch course when ID is available
  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchCourse(id);
      fetchRegistrations(id);
    }
  }, [id]);

  /**
   * Fetches the course details for a given course ID.
   * @example
   * sync("12345")
   * // Retrieves details for course with ID "12345"
   * @param {string} courseId - The ID of the course to fetch.
   * @returns {void} No return value.
   * @description
   *   - Sets the loading state to true at the start and false when completed.
   *   - Handles errors for course not found (404) and access denied (403).
   *   - Logs an error message to the console if fetching fails.
   */
  const fetchCourse = async (courseId: string) => {
    try {
      setCourseLoading(true);
      setError(null);

      const response = await fetch(`/api/courses/${courseId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Course not found');
        }
        if (response.status === 403) {
          throw new Error('Access denied - you do not own this course');
        }
        throw new Error(`Failed to fetch course: ${response.status}`);
      }

      const data: CourseResponse = await response.json();
      
      if (data.success) {
        setCourse(data.course);
      } else {
        throw new Error('Failed to fetch course');
      }
    } catch (err) {
      console.error('Error fetching course:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch course');
    } finally {
      setCourseLoading(false);
    }
  };

  /**
  * Fetches and sets registration data for a specific course by course ID.
  * @example
  * sync('course123')
  * // Sets registrations state with fetched data for course 'course123'
  * @param {string} courseId - The ID of the course for which registrations are being fetched.
  * @returns {void} The function does not return a value; it updates the state instead.
  * @description
  *   - Sets registrations loading state during the fetch process.
  *   - Handles exceptions by logging errors without affecting the state.
  */
  const fetchRegistrations = async (courseId: string) => {
    try {
      setRegistrationsLoading(true);
      
      const response = await fetch(`/api/courses/${courseId}/registrations`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRegistrations(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching registrations:', err);
      // Don't set error state for registrations, just log it
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  /**
  * Launch the course and handle the sequencing session.
  * @example
  * sync(courseId)
  * Opens the course in a new tab and refreshes registrations.
  * @param {string} id - The course identifier for launching.
  * @returns {Promise<void>} Resolves after course launch or throws an error.
  * @description
  *   - Sends a POST request to launch the course and create a sequencing session.
  *   - Opens the course runtime in a new browser tab.
  *   - Sends xAPI statements for course activity tracking.
  *   - Handles error setting and console logging on launch failure.
  */
  const handleLaunchCourse = async () => {
    try {
      setError(null);
      
      const response = await fetch(`/api/courses/${id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to launch course: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Create sequencing session for this course launch
        const sessionState = await createSequencingSession(
          id as string, 
          data.registrationId || 'default-registration'
        );
        
        if (sessionState) {
          console.log('[CourseViewer] Sequencing session created for course launch:', sessionState);
          
          // Send xAPI statement for course launch
          await sendCourseProgressStatement('launched');
        }
        
        // Open SCORM runtime in new tab
        window.open(data.launchUrl, '_blank', 'noopener,noreferrer');
        
        // Refresh registrations to show the new launch
        if (id && typeof id === 'string') {
          fetchRegistrations(id);
        }
      } else {
        throw new Error(data.error?.message || 'Failed to launch course');
      }
    } catch (err) {
      console.error('Error launching course:', err);
      setError(err instanceof Error ? err.message : 'Failed to launch course');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // =============================================================================
  // SEQUENCING ENGINE INTEGRATION - PHASE 9 ADDITION
  // =============================================================================

  /**
   * Create a new sequencing session with the sequencing engine
   */
  const createSequencingSession = async (courseId: string, registrationId: string) => {
    try {
      const response = await fetch('http://localhost:3004/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationId,
          courseId,
          learnerId: user?.id || 'anonymous'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create sequencing session: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const sessionState: SequencingSessionState = {
          sessionId: data.data.sessionId,
          currentActivity: data.data.currentActivity,
          navigationState: data.data.navigationState,
          availableNavigation: data.data.availableNavigation
        };
        
        setSequencingState(sessionState);
        console.log('[CourseViewer] Created sequencing session:', sessionState);
        
        // Start polling for session updates
        startProgressPolling(sessionState.sessionId);
        
        return sessionState;
      } else {
        throw new Error('Failed to create sequencing session');
      }
    } catch (error) {
      console.error('Error creating sequencing session:', error);
      setError(error instanceof Error ? error.message : 'Failed to create sequencing session');
      return null;
    }
  };

  /**
   * Get current sequencing session state
   */
  const getSequencingSession = async (sessionId: string) => {
    try {
      const response = await fetch(`http://localhost:3004/sessions/${sessionId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get sequencing session: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const sessionState: SequencingSessionState = {
          sessionId: data.data.sessionId,
          currentActivity: data.data.currentActivity,
          navigationState: data.data.navigationState,
          availableNavigation: data.data.availableNavigation
        };
        
        setSequencingState(sessionState);
        console.log('[CourseViewer] Updated sequencing session:', sessionState);
        
        return sessionState;
      } else {
        throw new Error('Failed to get sequencing session');
      }
    } catch (error) {
      console.error('Error getting sequencing session:', error);
      return null;
    }
  };

  /**
   * Process navigation request
   */
  const processNavigation = async (sessionId: string, navigationRequest: string, targetActivityId?: string) => {
    try {
      const response = await fetch(`http://localhost:3004/sessions/${sessionId}/navigate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          navigationRequest,
          targetActivityId,
          userId: user?.id || 'anonymous',
          courseId: id
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to process navigation: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const sessionState: SequencingSessionState = {
          sessionId: data.data.sessionId,
          currentActivity: data.data.currentActivity,
          nextActivity: data.data.nextActivity,
          previousActivity: data.data.previousActivity,
          navigationState: 'active',
          availableNavigation: data.data.availableNavigation
        };
        
        setSequencingState(sessionState);
        console.log('[CourseViewer] Navigation processed:', sessionState);
        
        // Send xAPI statement for navigation
        await sendCourseProgressStatement('progressed', {
          completion: !!sessionState.currentActivity,
          extensions: {
            'http://example.com/sequencing/currentActivity': sessionState.currentActivity,
            'http://example.com/sequencing/navigationRequest': navigationRequest
          }
        });
        
        return sessionState;
      } else {
        throw new Error('Failed to process navigation');
      }
    } catch (error) {
      console.error('Error processing navigation:', error);
      return null;
    }
  };

  /**
   * Start polling for progress updates
   */
  const startProgressPolling = (sessionId: string) => {
    if (progressPollingInterval) {
      clearInterval(progressPollingInterval);
    }
    
    const interval = setInterval(async () => {
      await getSequencingSession(sessionId);
    }, 5000); // Poll every 5 seconds
    
    setProgressPollingInterval(interval);
  };

  /**
   * Stop polling for progress updates
   */
  const stopProgressPolling = () => {
    if (progressPollingInterval) {
      clearInterval(progressPollingInterval);
      setProgressPollingInterval(null);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopProgressPolling();
    };
  }, []);

  // =============================================================================
  // XAPI INTEGRATION - PHASE 9 ADDITION
  // =============================================================================

  /**
   * Send xAPI statement to LRS
   */
  const sendXAPIStatement = async (statement: any) => {
    try {
      const response = await fetch('http://localhost:3005/xapi/statements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(statement),
      });

      if (!response.ok) {
        throw new Error(`Failed to send xAPI statement: ${response.status}`);
      }

      const data = await response.json();
      console.log('[CourseViewer] xAPI statement sent:', data);
      return data;
    } catch (error) {
      console.error('Error sending xAPI statement:', error);
      return null;
    }
  };

  /**
   * Send a course launch xAPI statement
   */
  const sendCourseProgressStatement = async (verb: string, result?: any) => {
    if (!course || !user) return;

    const statement = {
      actor: {
        name: user.email.split('@')[0], // Use email username as name
        mbox: `mailto:${user.email}`
      },
      verb: {
        id: `http://adlnet.gov/expapi/verbs/${verb}`,
        display: { "en-US": verb }
      },
      object: {
        id: `http://example.com/courses/${course.id}`,
        definition: {
          name: { "en-US": course.title }
        }
      },
      result: result || undefined,
      timestamp: new Date().toISOString()
    };

    await sendXAPIStatement(statement);
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
        <title>{course ? course.title : 'Course'} - Rustici Killer</title>
        <meta name="description" content="Course Viewer - Rustici Killer" />
      </Head>

      <Navbar />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
          </div>

          {courseLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading course...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 text-lg mb-4">Error Loading Course</div>
              <p className="text-gray-600 mb-6">{error}</p>
              <div className="space-x-4">
                <button 
                  onClick={() => fetchCourse(id as string)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                <button 
                  onClick={handleBackToDashboard}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : course ? (
            <div className="space-y-6">
              {/* Course Header */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {course.title}
                    </h1>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Version {course.version}</span>
                      <span>•</span>
                      <span>{course.fileCount} files</span>
                      <span>•</span>
                      <span>Uploaded {formatDate(course.createdAt.toString())}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleLaunchCourse}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />
                    </svg>
                    Launch Course
                  </button>
                </div>
              </div>

              {/* Course Structure */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Course Structure
                </h2>
                <div className="space-y-2">
                  {course.structure.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center p-3 bg-gray-50 rounded-lg"
                    >
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Course Details */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Course Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Course ID</h3>
                    <p className="text-gray-900 font-mono text-sm">{course.id}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Version</h3>
                    <p className="text-gray-900">{course.version}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">File Count</h3>
                    <p className="text-gray-900">{course.fileCount}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Structure Items</h3>
                    <p className="text-gray-900">{course.structure.length}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Created</h3>
                    <p className="text-gray-900">{formatDate(course.createdAt.toString())}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Last Updated</h3>
                    <p className="text-gray-900">{formatDate(course.updatedAt.toString())}</p>
                  </div>
                </div>
              </div>

              {/* Phase 9: Sequencing Progress View */}
              {sequencingState && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    📊 Sequencing Progress
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Session ID</h3>
                        <p className="text-gray-900 font-mono text-sm">{sequencingState.sessionId}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Navigation State</h3>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          sequencingState.navigationState === 'active' ? 'bg-green-100 text-green-800' :
                          sequencingState.navigationState === 'created' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {sequencingState.navigationState}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Current Activity</h3>
                        <p className="text-gray-900">{sequencingState.currentActivity || 'None'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Next Activity</h3>
                        <p className="text-gray-900">{sequencingState.nextActivity || 'None'}</p>
                      </div>
                    </div>
                    
                    {/* Navigation Controls */}
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Navigation Controls</h3>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => processNavigation(sequencingState.sessionId, 'continue')}
                          disabled={!sequencingState.availableNavigation.next}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Continue
                        </button>
                        <button
                          onClick={() => processNavigation(sequencingState.sessionId, 'previous')}
                          disabled={!sequencingState.availableNavigation.previous}
                          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => processNavigation(sequencingState.sessionId, 'exit')}
                          disabled={!sequencingState.availableNavigation.exit}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Exit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 7: Launch History */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Launch History
                </h2>
                {registrationsLoading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-600">Loading launch history...</div>
                  </div>
                ) : registrations.length > 0 ? (
                  <div className="space-y-4">
                    {registrations.map((registration) => (
                      <div
                        key={registration.sessionId}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className={`w-3 h-3 rounded-full ${
                                registration.completion_status === 'completed' ? 'bg-green-500' :
                                registration.status === 'in-progress' ? 'bg-blue-500' :
                                'bg-gray-400'
                              }`}></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  Session {registration.sessionId.slice(-8)}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  registration.completion_status === 'completed' ? 'bg-green-100 text-green-800' :
                                  registration.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {registration.completion_status === 'completed' ? 'Completed' :
                                   registration.status === 'in-progress' ? 'In Progress' :
                                   'Not Started'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span>Started: {formatDate(registration.startedAt)}</span>
                                {registration.score > 0 && (
                                  <span>Score: {registration.score}%</span>
                                )}
                                {registration.progress > 0 && (
                                  <span>Progress: {Math.round(registration.progress * 100)}%</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => window.open(`http://localhost:3001/runtime/${registration.sessionId}`, '_blank')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Resume
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-600">No launch sessions yet</div>
                    <p className="text-sm text-gray-500 mt-2">
                      Click "Launch Course" to start your first session
                    </p>
                  </div>
                )}
              </div>

              {/* Phase 7 Complete */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  ✅ Phase 7 Complete - File Extraction, Content Serving, and SCORM API Wiring
                </h3>
                <p className="text-green-700 text-sm">
                  Phase 7 is now complete! Course content is extracted during upload, served from persistent storage, 
                  and the SCORM API saves progress to the database. Launch history shows all your sessions with 
                  completion status and scores.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CourseViewer;
