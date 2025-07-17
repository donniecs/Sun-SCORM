/**
 * @file Dispatch ZIP Export Utility - Phase 14
 * @description Creates LMS-compatible SCORM packages that redirect to Sun-SCORM launch tokens
 * @version 1.0.0
 * @lastUpdated 2025-07-15
 * @status PHASE_14_IMPLEMENTATION
 */

import archiver from 'archiver';

interface DispatchZipOptions {
  dispatchId: string;
  courseId: string;
  courseTitle: string;
  launchToken: string;
  platformUrl: string;
}

/**
 * Creates a minimal SCORM 1.2 manifest for LMS compatibility
 * @param courseTitle - Title of the course
 * @param launchToken - Launch token for authentication
 * @param platformUrl - Base URL of the Sun-SCORM platform
 * @returns XML string for imsmanifest.xml
 */
export function createManifest(courseTitle: string, launchToken: string, platformUrl: string): string {
  const manifestId = `SUNSCORM_${Date.now()}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${manifestId}" version="1.0" 
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                             http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
    <adlcp:location>adlcp_rootv1p2.xsd</adlcp:location>
  </metadata>
  
  <organizations default="SunSCORM_ORG">
    <organization identifier="SunSCORM_ORG">
      <title>${courseTitle}</title>
      <item identifier="ITEM_1" identifierref="RESOURCE_1" isvisible="true">
        <title>${courseTitle}</title>
        <adlcp:prerequisites type="aicc_script"></adlcp:prerequisites>
        <adlcp:maxtimeallowed></adlcp:maxtimeallowed>
        <adlcp:timelimitaction></adlcp:timelimitaction>
        <adlcp:datafromlms></adlcp:datafromlms>
        <adlcp:masteryscore></adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  
  <resources>
    <resource identifier="RESOURCE_1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <dependency identifierref="COMMON_FILES"/>
    </resource>
    <resource identifier="COMMON_FILES" type="webcontent">
      <file href="shared/scormdriver/scormdriver.js"/>
    </resource>
  </resources>
  
</manifest>`;
}

/**
 * Creates an HTML launcher with embedded SCORM-to-xAPI wrapper
 * @param courseTitle - Title of the course
 * @param dispatchId - Dispatch ID for tracking
 * @param courseId - Course ID for tracking
 * @param platformUrl - Base URL of the Sun-SCORM platform
 * @returns HTML string for index.html
 */
export function createLauncherHTML(courseTitle: string, dispatchId: string, courseId: string, platformUrl: string): string {
  const launchUrl = `${platformUrl}/api/v1/dispatches/${dispatchId}/launch`;
  const lrsEndpoint = `${platformUrl}/api/analytics/statements`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${courseTitle} - Sun-SCORM</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        
        .logo {
            font-size: 3em;
            margin-bottom: 10px;
        }
        
        .title {
            font-size: 1.5em;
            color: #333;
            margin-bottom: 20px;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        
        .launch-button {
            background: linear-gradient(45deg, #3498db, #2980b9);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 1.1em;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            margin-bottom: 20px;
        }
        
        .launch-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(52, 152, 219, 0.3);
        }
        
        .powered-by {
            font-size: 0.9em;
            color: #999;
            margin-top: 20px;
        }
        
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
            display: none;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .error {
            background: #fee;
            color: #c33;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            display: none;
        }
        
        .success {
            background: #efe;
            color: #363;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚀</div>
        <h1 class="title">${courseTitle}</h1>
        <p class="subtitle">Powered by Sun-SCORM Platform</p>
        
        <div id="launch-section">
            <button class="launch-button" onclick="initializeCourse()">
                🎯 Launch Course
            </button>
            <div class="spinner" id="spinner"></div>
            <div class="error" id="error">
                Failed to launch course. Please check your connection and try again.
            </div>
            <div class="success" id="success">
                Course launched successfully! Loading content...
            </div>
        </div>
        
        <div class="powered-by">
            Delivered by Sun-SCORM Enterprise Platform<br>
            <small>Next-generation SCORM hosting and analytics</small>
        </div>
    </div>

    <!-- Critical: Configuration must be injected BEFORE wrapper loads -->
    <script>
        // Sun-SCORM Configuration (injected dynamically)
        const sunScormConfig = {
            dispatchId: "${dispatchId}",
            courseId: "${courseId}",
            lrsEndpoint: "${lrsEndpoint}",
            launchUrl: "${launchUrl}"
        };
        
        // Make configuration available globally
        window.sunScormConfig = sunScormConfig;
        
        // SCORM API Implementation with Sun-SCORM Integration
        let scormInitialized = false;
        let authToken = null;
        
        const API = {
            LMSInitialize: function(param) {
                console.log("Sun-SCORM: LMSInitialize called");
                scormInitialized = true;
                return "true";
            },
            
            LMSFinish: function(param) {
                console.log("Sun-SCORM: LMSFinish called");
                scormInitialized = false;
                return "true";
            },
            
            LMSGetValue: function(element) {
                console.log("Sun-SCORM: LMSGetValue called with:", element);
                
                // Standard SCORM 1.2 elements
                switch(element) {
                    case 'cmi.core.student_id':
                        return 'dispatch_user_' + sunScormConfig.dispatchId;
                    case 'cmi.core.student_name':
                        return 'Dispatch User';
                    case 'cmi.core.lesson_location':
                        return '';
                    case 'cmi.core.lesson_status':
                        return 'incomplete';
                    case 'cmi.core.score.raw':
                        return '';
                    case 'cmi.core.score.max':
                        return '';
                    case 'cmi.core.score.min':
                        return '';
                    case 'cmi.core.total_time':
                        return '0000:00:00';
                    case 'cmi.core.entry':
                        return 'ab-initio';
                    case 'cmi.core.exit':
                        return '';
                    case 'cmi.suspend_data':
                        return '';
                    default:
                        return '';
                }
            },
            
            LMSSetValue: function(element, value) {
                console.log("Sun-SCORM: LMSSetValue called with:", element, "=", value);
                
                // Send xAPI statements for critical interactions
                if (element === 'cmi.core.lesson_status' && value === 'completed') {
                    sendXAPIStatement('completed', { completion: true });
                }
                
                if (element === 'cmi.core.score.raw' && value) {
                    sendXAPIStatement('scored', { score: parseFloat(value) });
                }
                
                return "true";
            },
            
            LMSCommit: function(param) {
                console.log("Sun-SCORM: LMSCommit called");
                return "true";
            },
            
            LMSGetLastError: function() {
                return "0";
            },
            
            LMSGetErrorString: function(errorCode) {
                return "No error";
            },
            
            LMSGetDiagnostic: function(errorCode) {
                return "No error";
            }
        };
        
        // Make API available globally
        window.API = API;
        
        // xAPI Statement Sending
        function sendXAPIStatement(verb, result) {
            if (!authToken) {
                console.log("Sun-SCORM: No auth token, skipping xAPI statement");
                return;
            }
            
            const statement = {
                actor: {
                    name: "Dispatch User",
                    mbox: "mailto:dispatch@sunscorm.com"
                },
                verb: {
                    id: "http://adlnet.gov/expapi/verbs/" + verb,
                    display: { "en-US": verb }
                },
                object: {
                    id: sunScormConfig.courseId,
                    definition: {
                        name: { "en-US": "${courseTitle}" }
                    }
                },
                result: result || {},
                context: {
                    extensions: {
                        "http://sunscorm.com/extensions/dispatch-id": sunScormConfig.dispatchId
                    }
                }
            };
            
            fetch(sunScormConfig.lrsEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + authToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(statement)
            }).catch(error => {
                console.error("Sun-SCORM: Failed to send xAPI statement:", error);
            });
        }
        
        // Course initialization
        async function initializeCourse() {
            const spinner = document.getElementById('spinner');
            const errorDiv = document.getElementById('error');
            const successDiv = document.getElementById('success');
            
            spinner.style.display = 'block';
            errorDiv.style.display = 'none';
            successDiv.style.display = 'none';
            
            try {
                // Request authorization from Sun-SCORM platform
                const response = await fetch(sunScormConfig.launchUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        dispatchId: sunScormConfig.dispatchId,
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString()
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    authToken = data.authToken;
                    
                    // Send launch xAPI statement
                    sendXAPIStatement('launched', { 
                        timestamp: new Date().toISOString() 
                    });
                    
                    successDiv.style.display = 'block';
                    
                    // Initialize SCORM session
                    API.LMSInitialize('');
                    
                    // Redirect to actual course content would go here
                    console.log("Sun-SCORM: Course authorized and ready");
                    
                } else {
                    throw new Error(data.error || 'Authorization failed');
                }
                
            } catch (error) {
                console.error("Sun-SCORM: Launch error:", error);
                errorDiv.textContent = error.message || 'Failed to launch course';
                errorDiv.style.display = 'block';
            } finally {
                spinner.style.display = 'none';
            }
        }
        
        // Auto-initialize on page load
        window.addEventListener('load', function() {
            console.log("Sun-SCORM: Page loaded, configuration:", sunScormConfig);
            // Auto-launch after 2 seconds
            setTimeout(initializeCourse, 2000);
        });
    </script>
</body>
</html>`;
}

/**
 * Creates a minimal SCORM driver for LMS compatibility
 * @returns JavaScript string for scormdriver.js
 */
export function createScormDriver(): string {
  return `/*
 * Sun-SCORM Platform - SCORM Driver
 * Minimal SCORM 1.2 API implementation for LMS compatibility
 */

// SCORM API Implementation
function SCORMDriver() {
    this.initialized = false;
    this.data = {};
    
    // Initialize SCORM session
    this.initialize = function(param) {
        console.log("Sun-SCORM: Initializing SCORM session");
        this.initialized = true;
        return "true";
    };
    
    // Finish SCORM session
    this.finish = function(param) {
        console.log("Sun-SCORM: Finishing SCORM session");
        this.initialized = false;
        return "true";
    };
    
    // Get SCORM data
    this.getValue = function(name) {
        console.log("Sun-SCORM: Getting value for:", name);
        return this.data[name] || "";
    };
    
    // Set SCORM data
    this.setValue = function(name, value) {
        console.log("Sun-SCORM: Setting value:", name, "=", value);
        this.data[name] = value;
        return "true";
    };
    
    // Commit data
    this.commit = function(param) {
        console.log("Sun-SCORM: Committing data");
        return "true";
    };
    
    // Error handling
    this.getLastError = function() {
        return "0";
    };
    
    this.getErrorString = function(errorCode) {
        return "No error";
    };
    
    this.getDiagnostic = function(errorCode) {
        return "No error";
    };
}

// Create global SCORM API
if (typeof window !== 'undefined') {
    window.API = new SCORMDriver();
}`;
}

/**
 * Creates a ZIP file containing LMS-compatible SCORM package
 * @param options - Configuration options for the ZIP creation
 * @returns Promise<Buffer> - ZIP file buffer
 */
export async function createDispatchZip(options: DispatchZipOptions): Promise<Buffer> {
  const { dispatchId, courseId, courseTitle, launchToken, platformUrl } = options;
  
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    const buffers: Buffer[] = [];
    
    // Collect data
    archive.on('data', (chunk) => buffers.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(buffers)));
    archive.on('error', (err) => reject(err));
    
    // Add manifest file
    const manifest = createManifest(courseTitle, launchToken, platformUrl);
    archive.append(manifest, { name: 'imsmanifest.xml' });
    
    // Add launcher HTML with proper config injection
    const launcherHTML = createLauncherHTML(courseTitle, dispatchId, courseId, platformUrl);
    archive.append(launcherHTML, { name: 'index.html' });
    
    // Add SCORM driver
    const scormDriver = createScormDriver();
    archive.append(scormDriver, { name: 'shared/scormdriver/scormdriver.js' });
    
    // Add metadata file
    const metadata = {
      generated: new Date().toISOString(),
      platform: 'Sun-SCORM Enterprise',
      version: '1.0.0',
      dispatchId,
      courseId,
      courseTitle,
      launchToken,
      type: 'lms-compatible-redirect'
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'sunscorm-metadata.json' });
    
    // Finalize the archive
    archive.finalize();
  });
}

/**
 * Generates a filename for the exported ZIP
 * @param courseTitle - Title of the course
 * @param dispatchId - ID of the dispatch
 * @returns Sanitized filename
 */
export function generateZipFilename(courseTitle: string, dispatchId: string): string {
  // Sanitize course title for filename
  const sanitizedTitle = courseTitle
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 30); // Limit length
  
  const shortDispatchId = dispatchId.substring(0, 8);
  
  return `sunscorm_${sanitizedTitle}_${shortDispatchId}.zip`;
}
