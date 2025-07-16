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
 * Creates an HTML launcher that redirects to Sun-SCORM platform
 * @param courseTitle - Title of the course
 * @param launchToken - Launch token for authentication
 * @param platformUrl - Base URL of the Sun-SCORM platform
 * @returns HTML string for index.html
 */
export function createLauncherHTML(courseTitle: string, launchToken: string, platformUrl: string): string {
  const launchUrl = `${platformUrl}/launch/${launchToken}`;
  
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
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚀</div>
        <h1 class="title">${courseTitle}</h1>
        <p class="subtitle">Powered by Sun-SCORM Platform</p>
        
        <div id="launch-section">
            <a href="${launchUrl}" class="launch-button" onclick="launchCourse()">
                🎯 Launch Course
            </a>
            <div class="spinner" id="spinner"></div>
            <div class="error" id="error">
                Failed to launch course. Please check your connection and try again.
            </div>
        </div>
        
        <div class="powered-by">
            Delivered by Sun-SCORM Enterprise Platform<br>
            <small>Next-generation SCORM hosting and analytics</small>
        </div>
    </div>

    <script>
        // SCORM API stubs for LMS compatibility
        var API = {
            LMSInitialize: function(param) {
                console.log("SCORM API: LMSInitialize called");
                return "true";
            },
            LMSFinish: function(param) {
                console.log("SCORM API: LMSFinish called");
                return "true";
            },
            LMSGetValue: function(name) {
                console.log("SCORM API: LMSGetValue called with:", name);
                if (name === "cmi.core.student_id") return "scorm_user";
                if (name === "cmi.core.student_name") return "SCORM User";
                return "";
            },
            LMSSetValue: function(name, value) {
                console.log("SCORM API: LMSSetValue called with:", name, value);
                return "true";
            },
            LMSCommit: function(param) {
                console.log("SCORM API: LMSCommit called");
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
        
        // Make API available globally for SCORM content
        window.API = API;
        
        function launchCourse() {
            document.getElementById('spinner').style.display = 'block';
            
            // Auto-redirect after a short delay
            setTimeout(function() {
                window.location.href = '${launchUrl}';
            }, 1000);
        }
        
        // Auto-launch after page loads
        window.addEventListener('load', function() {
            setTimeout(function() {
                launchCourse();
            }, 2000);
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
  const { dispatchId, courseTitle, launchToken, platformUrl } = options;
  
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
    
    // Add launcher HTML
    const launcherHTML = createLauncherHTML(courseTitle, launchToken, platformUrl);
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
