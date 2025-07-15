import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../styles/UAT.module.css';

interface User {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  created: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
  status: string;
  uploadDate: string;
  fileSize: number;
}

interface Registration {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  progress: number;
  completedAt?: string;
  lastAccessed: string;
}

interface XAPIStatement {
  id: string;
  actor: string;
  verb: string;
  object: string;
  timestamp: string;
  result?: any;
}

const UATDashboard: NextPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statements, setStatements] = useState<XAPIStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  useEffect(() => {
    loadUserProfile();
    loadCourses();
    loadRegistrations();
    loadXAPIStatements();
  }, []);

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load user profile');
      }

      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user profile');
    }
  };

  const loadCourses = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/courses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load courses');
      }

      const coursesData = await response.json();
      setCourses(coursesData);
    } catch (err) {
      console.error('Error loading courses:', err);
    }
  };

  const loadRegistrations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/registrations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load registrations');
      }

      const registrationsData = await response.json();
      setRegistrations(registrationsData);
    } catch (err) {
      console.error('Error loading registrations:', err);
    }
  };

  const loadXAPIStatements = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/xapi/statements', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load xAPI statements');
      }

      const statementsData = await response.json();
      setStatements(statementsData);
    } catch (err) {
      console.error('Error loading xAPI statements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append('course', uploadFile);

    try {
      setUploadStatus('Uploading...');
      setUploadProgress(0);

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/courses/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadStatus('Upload successful!');
      setUploadFile(null);
      setUploadProgress(100);
      
      // Refresh courses
      loadCourses();
    } catch (err) {
      setUploadStatus('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const launchCourse = async (courseId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/courses/${courseId}/launch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to launch course');
      }

      const launchData = await response.json();
      window.open(launchData.launchUrl, '_blank');
      
      // Refresh registrations and statements
      setTimeout(() => {
        loadRegistrations();
        loadXAPIStatements();
      }, 1000);
    } catch (err) {
      alert('Failed to launch course: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const simulateProgress = async (registrationId: string, progress: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/registrations/${registrationId}/simulate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ progress })
      });

      if (!response.ok) {
        throw new Error('Failed to simulate progress');
      }

      // Refresh data
      loadRegistrations();
      loadXAPIStatements();
    } catch (err) {
      alert('Failed to simulate progress: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <h2>Loading UAT Dashboard...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <h2>Error: {error}</h2>
        <button onClick={() => router.push('/login')}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>UAT Dashboard - Rustici Killer</title>
        <meta name="description" content="User Acceptance Testing Dashboard" />
      </Head>

      <div className={styles.header}>
        <h1>🧪 UAT Testing Dashboard</h1>
        <div className={styles.envBanner}>
          <span>STAGING ENVIRONMENT</span>
        </div>
      </div>

      {/* User Profile Section */}
      <div className={styles.section}>
        <h2>👤 Current User Profile</h2>
        {user && (
          <div className={styles.userProfile}>
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Tenant ID:</strong> {user.tenantId}</p>
            <p><strong>Role:</strong> {user.role}</p>
            <p><strong>Created:</strong> {new Date(user.created).toLocaleString()}</p>
            <p><strong>Auth Token:</strong> {localStorage.getItem('authToken')?.substring(0, 20)}...</p>
          </div>
        )}
      </div>

      {/* Course Upload Section */}
      <div className={styles.section}>
        <h2>📁 Upload SCORM Course</h2>
        <form onSubmit={handleFileUpload} className={styles.uploadForm}>
          <div className={styles.uploadInput}>
            <input
              type="file"
              accept=".zip,.scorm"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              required
            />
            <button type="submit" disabled={!uploadFile}>
              Upload Course
            </button>
          </div>
          {uploadStatus && (
            <div className={styles.uploadStatus}>
              <p>{uploadStatus}</p>
              {uploadProgress > 0 && (
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progress} 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Courses Section */}
      <div className={styles.section}>
        <h2>📚 Available Courses</h2>
        <div className={styles.coursesList}>
          {courses.map(course => (
            <div key={course.id} className={styles.courseCard}>
              <h3>{course.title}</h3>
              <p>{course.description}</p>
              <div className={styles.courseDetails}>
                <span className={styles.status}>Status: {course.status}</span>
                <span className={styles.size}>Size: {(course.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                <span className={styles.date}>Uploaded: {new Date(course.uploadDate).toLocaleDateString()}</span>
              </div>
              <button 
                onClick={() => launchCourse(course.id)}
                className={styles.launchButton}
              >
                🚀 Launch Course
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Registrations Section */}
      <div className={styles.section}>
        <h2>📋 Course Registrations</h2>
        <div className={styles.registrationsList}>
          {registrations.map(registration => (
            <div key={registration.id} className={styles.registrationCard}>
              <h4>Registration ID: {registration.id}</h4>
              <p><strong>Course ID:</strong> {registration.courseId}</p>
              <p><strong>Status:</strong> {registration.status}</p>
              <p><strong>Progress:</strong> {registration.progress}%</p>
              <p><strong>Last Accessed:</strong> {new Date(registration.lastAccessed).toLocaleString()}</p>
              {registration.completedAt && (
                <p><strong>Completed:</strong> {new Date(registration.completedAt).toLocaleString()}</p>
              )}
              
              <div className={styles.simulationButtons}>
                <button onClick={() => simulateProgress(registration.id, 25)}>
                  Simulate 25% Progress
                </button>
                <button onClick={() => simulateProgress(registration.id, 50)}>
                  Simulate 50% Progress
                </button>
                <button onClick={() => simulateProgress(registration.id, 75)}>
                  Simulate 75% Progress
                </button>
                <button onClick={() => simulateProgress(registration.id, 100)}>
                  Simulate Completion
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* xAPI Statements Section */}
      <div className={styles.section}>
        <h2>📊 xAPI Statements</h2>
        <div className={styles.statementsList}>
          {statements.map(statement => (
            <div key={statement.id} className={styles.statementCard}>
              <div className={styles.statementHeader}>
                <span className={styles.verb}>{statement.verb}</span>
                <span className={styles.timestamp}>
                  {new Date(statement.timestamp).toLocaleString()}
                </span>
              </div>
              <p><strong>Actor:</strong> {statement.actor}</p>
              <p><strong>Object:</strong> {statement.object}</p>
              {statement.result && (
                <details className={styles.resultDetails}>
                  <summary>Result Data</summary>
                  <pre>{JSON.stringify(statement.result, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className={styles.navigation}>
        <button onClick={() => router.push('/dashboard')}>
          ← Back to Dashboard
        </button>
        <button onClick={() => router.push('/docs')}>
          📖 View Documentation
        </button>
        <button onClick={() => window.location.reload()}>
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
};

export default UATDashboard;
