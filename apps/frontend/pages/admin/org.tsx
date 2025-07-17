import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../styles/Admin.module.css';

interface OrgUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrgCourse {
  id: string;
  title: string;
  version: string;
  fileCount: number;
  owner: {
    id: string;
    email: string;
    name: string;
  };
  stats: {
    totalRegistrations: number;
    registrationsByStatus?: {
      not_started: number;
      in_progress: number;
      completed: number;
      failed: number;
    };
    completionRate?: number;
    averageProgress?: number;
    activeProgress?: number;
    resumeAvailable?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface XAPIStats {
  summary: {
    totalStatements: number;
    uniqueUsers: number;
    uniqueCourses: number;
    dateRange: {
      from: string | null;
      to: string | null;
    };
  };
  verbStats: Record<string, number>;
  userStats: Array<{
    user: {
      id: string;
      email: string;
      name: string;
    };
    totalStatements: number;
    verbs: Record<string, number>;
  }>;
  courseStats: Array<{
    course: {
      id: string;
      title: string;
    };
    totalStatements: number;
    verbs: Record<string, number>;
  }>;
}

interface TenantMeta {
  tenant: {
    id: string;
    name: string;
    domain: string;
    settings: any;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    users: {
      total: number;
      active: number;
      admins: number;
      learners: number;
    };
    courses: {
      total: number;
    };
    registrations: {
      total: number;
      completed: number;
      completionRate: number;
    };
    xapi: {
      totalStatements: number;
    };
  };
}

/**
 * CHANGE LOG - 2025-07-15 22:20 - PHASE 13A: SUPERIOR TRACKING SYSTEM
 * =====================================================================
 * WHAT: Added helper functions for enhanced progress visualization
 * WHY: Support superior tracking UI components in admin dashboard
 * IMPACT: Provides clean progress bar styling logic
 * NOTES FOR CHATGPT: These helpers support the enhanced tracking system
 */

// Helper function to determine progress bar styling
const getProgressBarClass = (completionRate: number): string => {
  if (completionRate > 80) return styles.progressBarHigh;
  if (completionRate > 50) return styles.progressBarMedium;
  return styles.progressBarLow;
};

const AdminOrganizationDashboard: NextPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'courses' | 'tenants' | 'xapi' | 'meta'>('tenants');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [courses, setCourses] = useState<OrgCourse[]>([]);
  const [xapiStats, setXapiStats] = useState<XAPIStats | null>(null);

  // Filtering
  const [userSearch, setUserSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  // Phase 15: Tenant Management State
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showAssignCourseModal, setShowAssignCourseModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [createTenantForm, setCreateTenantForm] = useState({
    name: '',
    domain: ''
  });
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'learner'
  });
  const [assignCourseForm, setAssignCourseForm] = useState({
    courseId: ''
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    loadData();
  }, [user, router]);

  /**
  * Fetches and sets organization meta, users, courses, and xAPI data, managing loading and error states.
  * @example
  * sync()
  * No return value
  * @returns {void} No return value as it deals with application state updates directly.
  * @description
  *   - Redirects to login page if authentication token is absent.
  *   - Makes concurrent API calls for efficiency.
  *   - Handles fetch errors and updates error state accordingly.
  *   - Involves asynchronous data fetching and state management.
  */
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      // Load all data in parallel
      const [metaResponse, usersResponse, coursesResponse, xapiResponse] = await Promise.all([
        fetch('/api/org/meta', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/org/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/org/courses', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/org/xapi-summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!metaResponse.ok || !usersResponse.ok || !coursesResponse.ok || !xapiResponse.ok) {
        throw new Error('Failed to load organization data');
      }

      const [metaData, usersData, coursesData, xapiData] = await Promise.all([
        metaResponse.json(),
        usersResponse.json(),
        coursesResponse.json(),
        xapiResponse.json()
      ]);

      setTenantMeta(metaData.data);
      setUsers(usersData.data.users);
      setCourses(coursesData.data.courses);
      setXapiStats(xapiData.data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  /**
  * Updates the user's role in the organization.
  * @example
  * sync('12345', 'admin')
  * undefined
  * @param {string} userId - The id of the user whose role is being changed.
  * @param {string} newRole - The new role to assign to the user.
  * @returns {void} This function does not return a value.
  * @description
  *   - Requires that a valid authToken is stored in localStorage.
  *   - Throws an error if the fetch request fails.
  *   - Updates the local user state with the new role.
  *   - Handles errors by updating the error state with a descriptive message.
  */
  const handleUserRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/org/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        throw new Error('Failed to change user role');
      }

      await response.json();
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change user role');
    }
  };

  /**
  * Deactivates a user based on userId and updates local state accordingly
  * @example
  * sync("12345")
  * undefined
  * @param {string} userId - The ID of the user to be deactivated.
  * @returns {Promise<void>} This function does not return a value.
  * @description
  *   - Retrieves the authentication token from local storage and sends it in the request header.
  *   - Makes a POST request to deactivate the user.
  *   - Throws an error if the deactivation request fails.
  *   - Updates the local state of users by setting the specified user's 'isActive' property to false.
  */
  const handleUserDeactivate = async (userId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/org/users/${userId}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate user');
      }

      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, isActive: false } : u
      ));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate user');
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.firstName.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.lastName.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
    course.owner.name.toLowerCase().includes(courseSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Organization Dashboard - Rustici Killer</title>
        </Head>
        <div className={styles.loading}>Loading organization data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Organization Dashboard - Rustici Killer</title>
        </Head>
        <div className={styles.error}>
          <h2>Error Loading Data</h2>
          <p>{error}</p>
          <button onClick={loadData} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // PHASE 15: Tenant Management Functions - Stub implementations
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement tenant creation
    console.log('Create tenant:', createTenantForm);
    setShowCreateTenantModal(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement user creation
    console.log('Create user:', createUserForm);
    setShowCreateUserModal(false);
  };

  const handleAssignCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement course assignment
    console.log('Assign course:', assignCourseForm);
    setShowAssignCourseModal(false);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Organization Dashboard - Rustici Killer</title>
      </Head>

      <div className={styles.header}>
        <h1>Organization Dashboard</h1>
        <p>Manage your organization's users, courses, and analytics</p>
      </div>

      <div className={styles.tabs}>
        <button 
          className={activeTab === 'tenants' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('tenants')}
        >
          🏢 Organizations ({tenants.length})
        </button>
        <button 
          className={activeTab === 'users' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('users')}
        >
          👥 Users ({tenantMeta?.stats.users.total || 0})
        </button>
        <button 
          className={activeTab === 'courses' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('courses')}
        >
          📚 Courses ({tenantMeta?.stats.courses.total || 0})
        </button>
        <button 
          className={activeTab === 'xapi' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('xapi')}
        >
          📊 Analytics
        </button>
        <button 
          className={activeTab === 'meta' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('meta')}
        >
          ⚙️ Meta
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'tenants' && (
          <div className={styles.tenantsSection}>
            <div className={styles.sectionHeader}>
              <h2>🏢 Organization Management</h2>
              <button 
                onClick={() => setShowCreateTenantModal(true)}
                className={styles.createButton}
              >
                ➕ Create Organization
              </button>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Domain</th>
                    <th>Users</th>
                    <th>Courses</th>
                    <th>Dispatches</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(tenant => (
                    <tr key={tenant.id}>
                      <td>
                        <div className={styles.tenantInfo}>
                          <strong>{tenant.name}</strong>
                        </div>
                      </td>
                      <td>{tenant.domain}</td>
                      <td>
                        <span className={styles.userCount}>
                          {tenant.stats.activeUsers}/{tenant.stats.totalUsers}
                        </span>
                      </td>
                      <td>{tenant.stats.totalCourses}</td>
                      <td>{tenant.stats.totalDispatches}</td>
                      <td>{new Date(tenant.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button 
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setShowCreateUserModal(true);
                            }}
                            className={styles.actionButton}
                          >
                            👤 Add User
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setShowAssignCourseModal(true);
                            }}
                            className={styles.actionButton}
                          >
                            📚 Assign Course
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tenants.length === 0 && (
                <div className={styles.emptyState}>
                  <p>No organizations created yet.</p>
                  <button 
                    onClick={() => setShowCreateTenantModal(true)}
                    className={styles.createButton}
                  >
                    ➕ Create First Organization
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'meta' && tenantMeta && (
          <div className={styles.overview}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <h3>Organization Info</h3>
                <div className={styles.statValue}>{tenantMeta.tenant.name}</div>
                <div className={styles.statLabel}>Created: {new Date(tenantMeta.tenant.createdAt).toLocaleDateString()}</div>
              </div>
              <div className={styles.statCard}>
                <h3>Total Users</h3>
                <div className={styles.statValue}>{tenantMeta.stats.users.total}</div>
                <div className={styles.statLabel}>
                  {tenantMeta.stats.users.active} active • {tenantMeta.stats.users.admins} admins
                </div>
              </div>
              <div className={styles.statCard}>
                <h3>Total Courses</h3>
                <div className={styles.statValue}>{tenantMeta.stats.courses.total}</div>
                <div className={styles.statLabel}>Uploaded by organization members</div>
              </div>
              <div className={styles.statCard}>
                <h3>Completion Rate</h3>
                <div className={styles.statValue}>{tenantMeta.stats.registrations.completionRate}%</div>
                <div className={styles.statLabel}>
                  {tenantMeta.stats.registrations.completed} of {tenantMeta.stats.registrations.total} registrations
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className={styles.usersSection}>
            <div className={styles.sectionHeader}>
              <h2>User Management</h2>
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.firstName} {user.lastName}</td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          value={user.role}
                          onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                          className={styles.roleSelect}
                          title="User Role"
                        >
                          <option value="learner">Learner</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className={user.isActive ? styles.statusActive : styles.statusInactive}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td>
                        {user.isActive && (
                          <button
                            onClick={() => handleUserDeactivate(user.id)}
                            className={styles.deactivateButton}
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'courses' && (
          <div className={styles.coursesSection}>
            <div className={styles.sectionHeader}>
              <h2>Course Overview</h2>
              <input
                type="text"
                placeholder="Search courses..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Course Title</th>
                    <th>Version</th>
                    <th>Owner</th>
                    <th>Files</th>
                    <th>Registrations</th>
                    <th>Completion Rate</th>
                    <th>In Progress</th>
                    <th>Avg Progress</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course) => (
                    <tr key={course.id}>
                      <td>{course.title}</td>
                      <td>{course.version}</td>
                      <td>{course.owner.name}</td>
                      <td>{course.fileCount}</td>
                      <td>
                        <div className={styles.registrationStats}>
                          <span className={styles.totalRegistrations}>
                            {course.stats.totalRegistrations}
                          </span>
                          <div className={styles.registrationBreakdown}>
                            <span className={`${styles.statusBadge} ${styles.statusBadgeCompleted}`}>
                              ✓ {course.stats.registrationsByStatus?.completed || 0}
                            </span>
                            <span className={`${styles.statusBadge} ${styles.statusBadgeInProgress}`}>
                              ⏳ {course.stats.registrationsByStatus?.in_progress || 0}
                            </span>
                            <span className={`${styles.statusBadge} ${styles.statusBadgeNotStarted}`}>
                              ○ {course.stats.registrationsByStatus?.not_started || 0}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.progressIndicator}>
                          <div 
                            className={`${styles.progressBar} ${getProgressBarClass(course.stats.completionRate || 0)}`}
                            style={{ '--progress': `${course.stats.completionRate || 0}%` } as React.CSSProperties}
                          />
                          <span className={styles.progressText}>
                            {course.stats.completionRate || 0}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.inProgressIndicator}>
                          <span className={styles.inProgressCount}>
                            {course.stats.activeProgress || 0}
                          </span>
                          {(course.stats.resumeAvailable || 0) > 0 && (
                            <span className={styles.resumeIndicator} title="Learners can resume">
                              🔄 {course.stats.resumeAvailable}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.avgProgressIndicator}>
                          <div 
                            className={styles.avgProgressBar}
                            style={{ '--progress': `${course.stats.averageProgress || 0}%` } as React.CSSProperties}
                          />
                          <span className={styles.avgProgressText}>
                            {course.stats.averageProgress || 0}%
                          </span>
                        </div>
                      </td>
                      <td>{new Date(course.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'xapi' && xapiStats && (
          <div className={styles.analyticsSection}>
            <h2>Learning Analytics</h2>
            <div className={styles.analyticsGrid}>
              <div className={styles.analyticsCard}>
                <h3>xAPI Summary</h3>
                <div className={styles.analyticsStats}>
                  <div>Total Statements: {xapiStats.summary.totalStatements}</div>
                  <div>Unique Users: {xapiStats.summary.uniqueUsers}</div>
                  <div>Unique Courses: {xapiStats.summary.uniqueCourses}</div>
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <h3>Common Verbs</h3>
                <div className={styles.verbStats}>
                  {Object.entries(xapiStats.verbStats).map(([verb, count]) => (
                    <div key={verb} className={styles.verbStat}>
                      <span>{verb}:</span> <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <h3>Top Active Users</h3>
                <div className={styles.userStats}>
                  {xapiStats.userStats.slice(0, 5).map((userStat) => (
                    <div key={userStat.user.id} className={styles.userStat}>
                      <span>{userStat.user.name}:</span> <span>{userStat.totalStatements} statements</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phase 15: Create Tenant Modal */}
      {showCreateTenantModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Create New Organization</h2>
            <form onSubmit={handleCreateTenant}>
              <div className={styles.formGroup}>
                <label>Organization Name</label>
                <input
                  type="text"
                  value={createTenantForm.name}
                  onChange={(e) => setCreateTenantForm({...createTenantForm, name: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Domain</label>
                <input
                  type="text"
                  value={createTenantForm.domain}
                  onChange={(e) => setCreateTenantForm({...createTenantForm, domain: e.target.value})}
                  placeholder="acme-corp.com"
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowCreateTenantModal(false)}>
                  Cancel
                </button>
                <button type="submit">Create Organization</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 15: Create User Modal */}
      {showCreateUserModal && selectedTenant && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Add User to {selectedTenant.name}</h2>
            <form onSubmit={handleCreateUser}>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  value={createUserForm.email}
                  onChange={(e) => setCreateUserForm({...createUserForm, email: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>First Name</label>
                <input
                  type="text"
                  value={createUserForm.firstName}
                  onChange={(e) => setCreateUserForm({...createUserForm, firstName: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Last Name</label>
                <input
                  type="text"
                  value={createUserForm.lastName}
                  onChange={(e) => setCreateUserForm({...createUserForm, lastName: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Password</label>
                <input
                  type="password"
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm({...createUserForm, password: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Role</label>
                <select
                  value={createUserForm.role}
                  onChange={(e) => setCreateUserForm({...createUserForm, role: e.target.value})}
                >
                  <option value="learner">Learner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => {
                  setShowCreateUserModal(false);
                  setSelectedTenant(null);
                }}>
                  Cancel
                </button>
                <button type="submit">Add User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 15: Assign Course Modal */}
      {showAssignCourseModal && selectedTenant && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Assign Course to {selectedTenant.name}</h2>
            <form onSubmit={handleAssignCourse}>
              <div className={styles.formGroup}>
                <label>Course</label>
                <select
                  value={assignCourseForm.courseId}
                  onChange={(e) => setAssignCourseForm({...assignCourseForm, courseId: e.target.value})}
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
              <div className={styles.modalActions}>
                <button type="button" onClick={() => {
                  setShowAssignCourseModal(false);
                  setSelectedTenant(null);
                }}>
                  Cancel
                </button>
                <button type="submit">Assign Course</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrganizationDashboard;
