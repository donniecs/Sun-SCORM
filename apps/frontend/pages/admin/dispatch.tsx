/**
 * @file Admin Dispatch Management Page
 * @description SCORM Course Licensing System - Phase 13B
 * @version 1.0.0
 * @lastUpdated 2025-07-15
 * @status PHASE_13B_IMPLEMENTATION
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/Admin.module.css';

interface Course {
  id: string;
  title: string;
  version: string;
}

interface Tenant {
  id: string;
  name: string;
  domain: string;
}

interface DispatchUser {
  id: string;
  email: string;
  launchToken: string;
  launchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Dispatch {
  id: string;
  courseId: string;
  tenantId: string;
  mode: 'capped' | 'unlimited' | 'time-bound';
  maxUsers: number | null;
  expiresAt: string | null;
  allowAnalytics: boolean;
  createdAt: string;
  course: Course;
  tenant: Tenant;
  users: DispatchUser[];
  stats: {
    totalUsers: number;
    launchedUsers: number;
    completedUsers: number;
    usageRate: string;
    remainingUsers: number | null;
    remainingDays: number | null;
    isExpired: boolean;
    isAtCapacity: boolean;
    completionRate?: number;
  };
}

interface CreateDispatchForm {
  courseId: string;
  tenantId: string;
  mode: 'capped' | 'unlimited' | 'time-bound';
  maxUsers: number | null;
  expiresAt: string;
  allowAnalytics: boolean;
}

const AdminDispatchPage: React.FC = () => {
  const router = useRouter();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [newLaunchEmail, setNewLaunchEmail] = useState('');
  const [createForm, setCreateForm] = useState<CreateDispatchForm>({
    courseId: '',
    tenantId: '',
    mode: 'capped',
    maxUsers: 10,
    expiresAt: '',
    allowAnalytics: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  /**
   * Syncs dispatches, courses, and tenants data with the frontend application.
   * @example
   * sync()
   * undefined
   * @returns {undefined} No return value, function performs side effects.
   * @description
   *   - Ensures the user is authenticated by checking for a valid token in local storage.
   *   - Navigates to the login page if the token is missing, preventing further function execution.
   *   - Sets loading state to true at the start and false at the end to manage UI state.
   *   - Handles errors by setting an error message state when fetch operations fail.
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Fetch dispatches
      const dispatchResponse = await fetch('/api/dispatch', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!dispatchResponse.ok) {
        throw new Error('Failed to fetch dispatches');
      }

      const dispatchData = await dispatchResponse.json();
      setDispatches(dispatchData.data);

      // Fetch courses for dropdown
      const courseResponse = await fetch('/api/courses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (courseResponse.ok) {
        const courseData = await courseResponse.json();
        setCourses(courseData.data);
      }

      // Fetch tenants for dropdown (we'll need this endpoint)
      const tenantResponse = await fetch('/api/org/tenants', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (tenantResponse.ok) {
        const tenantData = await tenantResponse.json();
        setTenants(tenantData.data);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles form submission for creating dispatch and updates state accordingly
   * @example
   * sync(event)
   * No return value is expected; updates the state and handles errors internally.
   * @param {React.FormEvent} e - Event object from the form submission.
   * @returns {void} No value is returned from this function.
   * @description
   *   - Prevents the default form submission behavior to handle logic in the function.
   *   - Retrieves the authentication token from local storage to authorize API requests.
   *   - Resets the form state upon successful dispatch creation.
   *   - If an error occurs during the API call, sets an error message to be displayed.
   */
  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...createForm,
          expiresAt: createForm.expiresAt || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create dispatch');
      }

      setShowCreateModal(false);
      setCreateForm({
        courseId: '',
        tenantId: '',
        mode: 'capped',
        maxUsers: 10,
        expiresAt: '',
        allowAnalytics: true
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dispatch');
    }
  };

  /**
  * Initiates a dispatch launch process by creating a launch token and alerts the launch URL.
  * @example
  * sync('12345-abcde')
  * Launch URL created: http://example.com/launch/abcde
  * @param {string} dispatchId - The unique identifier for the dispatch.
  * @returns {void} No return value.
  * @description
  *   - Checks for a token in localStorage to authorize the request.
  *   - Sends a POST request to the server with the dispatch ID and user email.
  *   - Alerts the user with the launch URL upon successful token creation.
  *   - Resets the email input field and fetches updated data on success.
  */
  const handleCreateLaunchToken = async (dispatchId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/dispatch/${dispatchId}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newLaunchEmail
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create launch token');
      }

      const data = await response.json();
      alert(`Launch URL created: ${data.data.launchUrl}`);
      setNewLaunchEmail('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create launch token');
    }
  };

  /**
   * Deletes a dispatch from the server after user confirmation
   * @example
   * sync('12345')
   * undefined
   * @param {string} dispatchId - The ID of the dispatch to be deleted.
   * @returns {void} No return value.
   * @description
   *   - Utilizes token stored in localStorage to authorize the delete action.
   *   - Handles errors by setting an error message when dispatch deletion fails.
   *   - Invokes fetchData() to refresh or update data after successful deletion.
   */
  const handleDeleteDispatch = async (dispatchId: string) => {
    if (!confirm('Are you sure you want to delete this dispatch?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/dispatch/${dispatchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete dispatch');
      }

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dispatch');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusText = (dispatch: Dispatch) => {
    if (dispatch.stats.isExpired) return 'Expired';
    if (dispatch.stats.isAtCapacity) return 'At Capacity';
    return 'Active';
  };

  /**
   * Determines the appropriate color code based on dispatch conditions.
   * @example
   * dispatchColorCode(dispatch);
   * // Returns a color code like '#dc3545' (Red), '#ffc107' (Yellow), or '#28a745' (Green) based on dispatch properties.
   * @param {Dispatch} dispatch - Dispatch object containing stats and constraints.
   * @returns {string} Hex color code representing the status of the dispatch.
   * @description
   *   - Returns red if dispatch is expired or at capacity.
   *   - Returns yellow if user usage is at or above 80% and when expiration is within 7 days.
   *   - Defaults to green when none of the conditions for red or yellow are met.
   */
  const getStatusColor = (dispatch: Dispatch) => {
    if (dispatch.stats.isExpired) return '#dc3545'; // Red
    if (dispatch.stats.isAtCapacity) return '#dc3545'; // Red
    
    // Calculate usage percentage for warning colors
    if (dispatch.maxUsers) {
      const usagePercentage = (dispatch.stats.totalUsers / dispatch.maxUsers) * 100;
      if (usagePercentage >= 80) return '#ffc107'; // Yellow warning
    }
    
    // Check expiration warning
    if (dispatch.expiresAt) {
      const daysRemaining = Math.floor((new Date(dispatch.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) return '#ffc107'; // Yellow warning
    }
    
    return '#28a745'; // Green
  };

  const getRemainingDays = (expiresAt: string | null): number | null => {
    if (!expiresAt) return null;
    const remaining = Math.floor((new Date(expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return remaining > 0 ? remaining : 0;
  };

  const formatRemainingTime = (expiresAt: string | null): string => {
    if (!expiresAt) return 'Never';
    const remaining = getRemainingDays(expiresAt);
    if (remaining === null) return 'Never';
    if (remaining === 0) return 'Today';
    if (remaining === 1) return '1 day';
    if (remaining <= 7) return `${remaining} days`;
    return formatDate(expiresAt);
  };

  /**
   * Downloads a dispatch package and triggers the download in the browser.
   * @example
   * sync('abc123', 'Course Title')
   * Alerts 'Dispatch package downloaded successfully!' after download.
   * @param {string} dispatchId - The unique identifier for the dispatch package.
   * @param {string} courseTitle - The title of the course used for naming the download file.
   * @returns {void} No value is returned from this function.
   * @description
   *   - Retrieves the user authentication token from local storage.
   *   - Constructs a filename by formatting courseTitle and dispatchId.
   *   - Alerts the user when the download is complete and provides instructions.
   *   - Handles errors by setting an error message state when the download fails.
   */
  const handleDownloadDispatch = async (dispatchId: string, courseTitle: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Set loading state
      setError(null);
      
      // Use the new download endpoint
      const response = await fetch(`/api/v1/dispatches/${dispatchId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download dispatch package');
      }

      // Get the ZIP file as a blob
      const blob = await response.blob();
      
      // Create a filename
      const filename = `${courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}_dispatch_${dispatchId.substring(0, 8)}.zip`;

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('Dispatch package downloaded successfully! Upload this ZIP file to your LMS to deploy the course.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download dispatch package');
    }
  };

  const getUserStatus = (user: DispatchUser) => {
    if (user.completedAt) return 'Completed';
    if (user.launchedAt) return 'In Progress';
    return 'Not Started';
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dispatches...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Course Dispatches</h1>
        <p className={styles.subtitle}>Manage SCORM course licensing to external organizations. Export dispatches as LMS-compatible ZIP files for upload to any SCORM-compliant LMS.</p>
        <button 
          className={styles.primaryButton}
          onClick={() => setShowCreateModal(true)}
        >
          Create New Dispatch
        </button>
      </div>

      {/* Dispatches Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Course</th>
              <th>Organization</th>
              <th>Mode</th>
              <th>Usage</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.map(dispatch => (
              <tr key={dispatch.id}>
                <td>
                  <div className={styles.courseInfo}>
                    <strong>{dispatch.course.title}</strong>
                    <span className={styles.version}>v{dispatch.course.version}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.tenantInfo}>
                    <strong>{dispatch.tenant.name}</strong>
                    <span className={styles.domain}>{dispatch.tenant.domain}</span>
                  </div>
                </td>
                <td>
                  <span className={styles.modeBadge}>
                    {dispatch.mode.replace('-', ' ').toUpperCase()}
                  </span>
                </td>
                <td>
                  <div className={styles.usageInfo}>
                    <span className={styles.usageNumbers}>
                      {dispatch.stats.totalUsers}
                      {dispatch.maxUsers && ` / ${dispatch.maxUsers}`}
                    </span>
                    <span className={styles.usageRate}>
                      {dispatch.stats.usageRate}
                    </span>
                    {dispatch.maxUsers && (
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill}
                          style={{ 
                            width: `${(dispatch.stats.totalUsers / dispatch.maxUsers) * 100}%`,
                            backgroundColor: getStatusColor(dispatch)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className={styles.progressInfo}>
                    <span className={styles.progressNumbers}>
                      {dispatch.stats.launchedUsers} launched, {dispatch.stats.completedUsers} completed
                    </span>
                    {dispatch.stats.completionRate !== undefined && (
                      <span className={styles.completionRate}>
                        {dispatch.stats.completionRate.toFixed(1)}% completion
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span 
                    className={styles.statusBadge}
                    style={{ color: getStatusColor(dispatch) }}
                  >
                    {getStatusText(dispatch)}
                  </span>
                </td>
                <td>
                  <span className={styles.expirationText}>
                    {formatRemainingTime(dispatch.expiresAt)}
                  </span>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button 
                      className={styles.secondaryButton}
                      onClick={() => setSelectedDispatch(dispatch)}
                    >
                      📊 Manage
                    </button>
                    <button 
                      className={styles.primaryButton}
                      onClick={() => handleDownloadDispatch(dispatch.id, dispatch.course.title)}
                      title="Download SCORM-compatible dispatch package"
                    >
                      📦 Download Dispatch
                    </button>
                    <button 
                      className={styles.dangerButton}
                      onClick={() => handleDeleteDispatch(dispatch.id)}
                      title="Delete this dispatch"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {dispatches.length === 0 && (
          <div className={styles.emptyState}>
            <p>No dispatches found. Create your first dispatch to get started.</p>
          </div>
        )}
      </div>

      {/* Create Dispatch Modal */}
      {showCreateModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Create New Dispatch</h2>
            <form onSubmit={handleCreateDispatch}>
              <div className={styles.formGroup}>
                <label htmlFor="courseId">Course</label>
                <select 
                  id="courseId"
                  value={createForm.courseId}
                  onChange={(e) => setCreateForm({...createForm, courseId: e.target.value})}
                  required
                >
                  <option value="">Select a course...</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.title} (v{course.version})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="tenantId">Target Organization</label>
                <select 
                  id="tenantId"
                  value={createForm.tenantId}
                  onChange={(e) => setCreateForm({...createForm, tenantId: e.target.value})}
                  required
                >
                  <option value="">Select an organization...</option>
                  {tenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.domain})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="mode">Access Mode</label>
                <select 
                  id="mode"
                  value={createForm.mode}
                  onChange={(e) => setCreateForm({...createForm, mode: e.target.value as any})}
                  required
                >
                  <option value="capped">Capped (Limited Users)</option>
                  <option value="unlimited">Unlimited Users</option>
                  <option value="time-bound">Time-Bound Access</option>
                </select>
              </div>

              {createForm.mode === 'capped' && (
                <div className={styles.formGroup}>
                  <label htmlFor="maxUsers">Maximum Users</label>
                  <input 
                    type="number"
                    id="maxUsers"
                    value={createForm.maxUsers || ''}
                    onChange={(e) => setCreateForm({...createForm, maxUsers: parseInt(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="expiresAt">Expiration Date (Optional)</label>
                <input 
                  type="date"
                  id="expiresAt"
                  value={createForm.expiresAt}
                  onChange={(e) => setCreateForm({...createForm, expiresAt: e.target.value})}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={createForm.allowAnalytics}
                    onChange={(e) => setCreateForm({...createForm, allowAnalytics: e.target.checked})}
                  />
                  Allow Analytics Collection
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton}>
                  Create Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Details Modal */}
      {selectedDispatch && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Manage Dispatch: {selectedDispatch.course.title}</h2>
            
            <div className={styles.dispatchStats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Total Users:</span>
                <span className={styles.statValue}>{selectedDispatch.stats.totalUsers}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Launched:</span>
                <span className={styles.statValue}>{selectedDispatch.stats.launchedUsers}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Completed:</span>
                <span className={styles.statValue}>{selectedDispatch.stats.completedUsers}</span>
              </div>
              {selectedDispatch.stats.completionRate !== undefined && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Completion Rate:</span>
                  <span className={styles.statValue}>{selectedDispatch.stats.completionRate.toFixed(1)}%</span>
                </div>
              )}
            </div>

            <div className={styles.createLaunchSection}>
              <h3>Create Launch Token</h3>
              <div className={styles.formGroup}>
                <input 
                  type="email"
                  placeholder="Enter email address (optional)"
                  value={newLaunchEmail}
                  onChange={(e) => setNewLaunchEmail(e.target.value)}
                />
                <button 
                  className={styles.primaryButton}
                  onClick={() => handleCreateLaunchToken(selectedDispatch.id)}
                  disabled={selectedDispatch.stats.isExpired || selectedDispatch.stats.isAtCapacity}
                >
                  Generate Launch URL
                </button>
              </div>
            </div>

            <div className={styles.launchHistory}>
              <h3>Launch History</h3>
              {selectedDispatch.users.length === 0 ? (
                <p>No launches yet.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Created</th>
                      <th>Launched</th>
                      <th>Completed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDispatch.users.map(user => (
                      <tr key={user.id}>
                        <td>{user.email || 'Anonymous'}</td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>{formatDate(user.launchedAt)}</td>
                        <td>{formatDate(user.completedAt)}</td>
                        <td>
                          <span className={styles.statusBadge}>
                            {getUserStatus(user)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => setSelectedDispatch(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDispatchPage;
