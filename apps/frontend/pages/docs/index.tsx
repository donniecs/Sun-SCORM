import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../../styles/Docs.module.css';

const DocsPage: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Documentation - Rustici Killer</title>
        <meta name="description" content="Rustici Killer SCORM Platform Documentation" />
      </Head>

      <div className={styles.header}>
        <h1>📖 Rustici Killer Documentation</h1>
        <p className={styles.subtitle}>
          Complete guide to using the SCORM platform for course delivery and tracking
        </p>
      </div>

      <div className={styles.quickNav}>
        <h2>Quick Navigation</h2>
        <div className={styles.navGrid}>
          <a href="#getting-started" className={styles.navCard}>
            <h3>🚀 Getting Started</h3>
            <p>Basic setup and first course upload</p>
          </a>
          <a href="#course-upload" className={styles.navCard}>
            <h3>📁 Course Upload</h3>
            <p>How to upload SCORM packages</p>
          </a>
          <a href="#api-reference" className={styles.navCard}>
            <h3>🔌 API Reference</h3>
            <p>REST API endpoints and examples</p>
          </a>
          <a href="#system-flow" className={styles.navCard}>
            <h3>📊 System Flow</h3>
            <p>Understanding the SCORM workflow</p>
          </a>
        </div>
      </div>

      <div className={styles.content}>
        <section id="getting-started" className={styles.section}>
          <h2>🚀 Getting Started</h2>
          <div className={styles.sectionContent}>
            <h3>What is Rustici Killer?</h3>
            <p>
              Rustici Killer is a comprehensive SCORM platform that provides:
            </p>
            <ul>
              <li>Multi-tenant course hosting and delivery</li>
              <li>xAPI (Tin Can API) statement tracking</li>
              <li>Real-time progress monitoring</li>
              <li>Secure authentication and authorization</li>
              <li>REST API for integration</li>
            </ul>

            <h3>Quick Setup</h3>
            <div className={styles.codeBlock}>
              <h4>1. Create an account</h4>
              <pre>{`POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepassword",
  "tenantId": "your-tenant-id"
}`}</pre>
            </div>

            <div className={styles.codeBlock}>
              <h4>2. Login and get token</h4>
              <pre>{`POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}`}</pre>
            </div>

            <div className={styles.codeBlock}>
              <h4>3. Upload your first course</h4>
              <pre>{`POST /api/courses/upload
Headers:
  Authorization: Bearer YOUR_TOKEN
  Content-Type: multipart/form-data

Body:
  course: [SCORM ZIP FILE]`}</pre>
            </div>
          </div>
        </section>

        <section id="course-upload" className={styles.section}>
          <h2>📁 Course Upload Guide</h2>
          <div className={styles.sectionContent}>
            <h3>Supported Formats</h3>
            <ul>
              <li><strong>SCORM 1.2:</strong> Legacy format, widely supported</li>
              <li><strong>SCORM 2004:</strong> Enhanced sequencing and navigation</li>
              <li><strong>xAPI (Tin Can):</strong> Modern tracking standard</li>
            </ul>

            <h3>File Requirements</h3>
            <div className={styles.infoBox}>
              <h4>📋 Checklist</h4>
              <ul>
                <li>✅ Package must be in ZIP format</li>
                <li>✅ Must contain imsmanifest.xml</li>
                <li>✅ File size limit: 500MB</li>
                <li>✅ Valid SCORM structure</li>
              </ul>
            </div>

            <h3>Upload Process</h3>
            <ol>
              <li>Navigate to the course upload interface</li>
              <li>Select your SCORM ZIP file</li>
              <li>Click "Upload Course"</li>
              <li>Wait for processing to complete</li>
              <li>Course will appear in your course list</li>
            </ol>

            <h3>Common Issues</h3>
            <div className={styles.warningBox}>
              <h4>⚠️ Troubleshooting</h4>
              <ul>
                <li><strong>Invalid manifest:</strong> Check imsmanifest.xml syntax</li>
                <li><strong>Missing files:</strong> Ensure all referenced files are included</li>
                <li><strong>Large files:</strong> Compress images and media</li>
                <li><strong>Path issues:</strong> Use relative paths in manifest</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="api-reference" className={styles.section}>
          <h2>🔌 API Reference</h2>
          <div className={styles.sectionContent}>
            <h3>Authentication</h3>
            <div className={styles.apiEndpoint}>
              <h4>POST /api/auth/login</h4>
              <p>Authenticate user and receive JWT token</p>
              <pre>{`{
  "email": "user@example.com",
  "password": "password"
}`}</pre>
            </div>

            <h3>Courses</h3>
            <div className={styles.apiEndpoint}>
              <h4>GET /api/courses</h4>
              <p>List all courses for authenticated user</p>
              <pre>{`Authorization: Bearer YOUR_TOKEN`}</pre>
            </div>

            <div className={styles.apiEndpoint}>
              <h4>POST /api/courses/upload</h4>
              <p>Upload a new SCORM course</p>
              <pre>{`Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data

Body: course=[ZIP_FILE]`}</pre>
            </div>

            <div className={styles.apiEndpoint}>
              <h4>POST /api/courses/{"{courseId}"}/launch</h4>
              <p>Launch a course for a user</p>
              <pre>{`Authorization: Bearer YOUR_TOKEN

Response:
{
  "launchUrl": "https://example.com/course/launch/...",
  "registrationId": "uuid"
}`}</pre>
            </div>

            <h3>xAPI Statements</h3>
            <div className={styles.apiEndpoint}>
              <h4>GET /api/xapi/statements</h4>
              <p>Retrieve xAPI statements for user</p>
              <pre>{`Authorization: Bearer YOUR_TOKEN

Response:
[
  {
    "id": "uuid",
    "actor": "user@example.com",
    "verb": "experienced",
    "object": "course-name",
    "timestamp": "2023-01-01T00:00:00Z"
  }
]`}</pre>
            </div>
          </div>
        </section>

        <section id="system-flow" className={styles.section}>
          <h2>📊 System Flow Diagram</h2>
          <div className={styles.sectionContent}>
            <h3>SCORM Course Lifecycle</h3>
            <div className={styles.flowDiagram}>
              <div className={styles.flowStep}>
                <h4>1. Course Upload</h4>
                <p>User uploads SCORM ZIP → System validates and extracts</p>
              </div>
              <div className={styles.flowArrow}>⬇️</div>
              <div className={styles.flowStep}>
                <h4>2. Course Processing</h4>
                <p>Parse manifest → Extract metadata → Store files</p>
              </div>
              <div className={styles.flowArrow}>⬇️</div>
              <div className={styles.flowStep}>
                <h4>3. Course Launch</h4>
                <p>User launches course → Create registration → Generate launch URL</p>
              </div>
              <div className={styles.flowArrow}>⬇️</div>
              <div className={styles.flowStep}>
                <h4>4. SCORM Runtime</h4>
                <p>Course loads → SCORM API available → Track interactions</p>
              </div>
              <div className={styles.flowArrow}>⬇️</div>
              <div className={styles.flowStep}>
                <h4>5. xAPI Tracking</h4>
                <p>Convert SCORM data → Generate xAPI statements → Store in database</p>
              </div>
            </div>

            <h3>Data Architecture</h3>
            <div className={styles.infoBox}>
              <h4>Database Tables</h4>
              <ul>
                <li><strong>tenants:</strong> Multi-tenant organization data</li>
                <li><strong>users:</strong> User accounts and authentication</li>
                <li><strong>courses:</strong> Course metadata and file references</li>
                <li><strong>registrations:</strong> User-course enrollment tracking</li>
                <li><strong>xapi_statements:</strong> Learning activity tracking</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <h3>Need Help?</h3>
          <p>
            For technical support or questions about the platform:
          </p>
          <ul>
            <li>📧 Email: support@rustici-killer.com</li>
            <li>📖 Documentation: /docs</li>
            <li>🧪 UAT Testing: <Link href="/admin/uat">UAT Dashboard</Link></li>
            <li>🏠 Main Site: <Link href="/">Home</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
