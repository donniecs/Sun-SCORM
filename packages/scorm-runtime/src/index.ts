/**
 * @file SCORM Runtime Service - RUSTICI KILLER
 * @description Handles SCORM course playback and session management
 * @version 0.1.0
 * 
 * The SCORM Runtime Service is responsible for:
 * - Managing active SCORM sessions (CMI data model in Redis)
 * - Handling SCORM API calls (LMSInitialize, LMSGetValue, LMSSetValue, etc.)
 * - Processing SCORM 1.2 and SCORM 2004 RTE communication
 * - Managing registration lifecycle and state persistence
 * - Coordinating with the Sequencing Engine for SCORM 2004 navigation
 * 
 * This service maintains the stateful core of the SCORM player,
 * ensuring reliable tracking and state management for all SCORM content.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

// TODO: Import shared types in future phases
// import { 
//   Registration, 
//   SessionState, 
//   CMIDataModel, 
//   APICall,
//   TenantContext 
// } from '@rustici-killer/types';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
    methods: ['GET', 'POST']
  }
});
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// PHASE 7: STATIC FILE SERVING FOR SCORM CONTENT
// =============================================================================

/**
 * Serve static SCORM content files from extracted course packages
 * Route: /content/:registrationId/*
 */
app.use('/content/:registrationId', async (req: any, res: any, next: any) => {
  try {
    const { registrationId } = req.params;
    
    // Get registration and course data
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { course: true }
    });
    
    if (!registration) {
      return res.status(404).send('Registration not found');
    }
    
    // Construct path to extracted course content
    const coursePath = path.join(process.cwd(), 'scorm-packages', registration.course.id);
    
    // Check if course directory exists
    if (!fs.existsSync(coursePath)) {
      return res.status(404).send('Course content not found');
    }
    
    // Serve static files from the course directory
    express.static(coursePath)(req, res, next);
    
  } catch (error) {
    console.error('Static file serving error:', error);
    res.status(500).send('Error serving content');
  }
});

// =============================================================================
// PHASE 7: SCORM API ENDPOINTS
// =============================================================================

/**
 * POST /api/scorm/:registrationId
 * Handle SCORM API calls and persist CMI data
 */
app.post('/api/scorm/:registrationId', async (req: any, res: any) => {
  try {
    const { registrationId } = req.params;
    const { cmiData } = req.body;
    
    // Validate registration exists
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { course: true, user: true }
    });
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: { code: 'REGISTRATION_NOT_FOUND', message: 'Registration not found' }
      });
    }
    
    // Update registration with CMI data
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        progressData: cmiData,
        status: cmiData.completion_status === 'completed' ? 'completed' : 'in-progress',
        progress: cmiData.score ? parseFloat(cmiData.score) / 100 : null,
        scoreRaw: cmiData.score ? parseFloat(cmiData.score) : null,
        completionStatus: cmiData.completion_status || 'incomplete',
        successStatus: cmiData.success_status || 'unknown',
        updatedAt: new Date()
      }
    });
    
    console.log(`📊 SCORM API: Updated progress for registration ${registrationId}`);
    
    res.json({
      success: true,
      data: {
        message: 'Progress saved successfully',
        registrationId: registrationId
      }
    });
    
  } catch (error) {
    console.error('SCORM API error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SCORM_API_ERROR', message: 'Failed to save progress' }
    });
  }
});

// =============================================================================
// REGISTRATION MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * POST /registrations
 * Create a new registration for a learner and course
 */
app.post('/registrations', async (req, res) => {
  try {
    // TODO: Implement registration creation logic
    // - Validate course exists
    // - Create registration record in database
    // - Initialize empty session state
    // - Return registration object
    
    console.log('CREATE REGISTRATION: Logic placeholder');
    
    res.json({
      success: true,
      data: {
        id: 'reg_' + Date.now(),
        message: 'Registration created successfully (placeholder)'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create registration'
      }
    });
  }
});

/**
 * GET /registrations
 * List registrations with filtering and pagination
 */
app.get('/registrations', async (req, res) => {
  try {
    // TODO: Implement registration listing logic
    // - Apply tenant filtering
    // - Handle pagination parameters
    // - Support filtering by course, learner, status
    // - Return paginated results
    
    console.log('LIST REGISTRATIONS: Logic placeholder');
    
    res.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list registrations'
      }
    });
  }
});

/**
 * GET /registrations/:id
 * Get registration details and current state
 */
app.get('/registrations/:id', async (req, res) => {
  try {
    // TODO: Implement registration retrieval logic
    // - Validate registration exists and belongs to tenant
    // - Return registration with current state
    // - Include CMI data model if session is active
    
    console.log('GET REGISTRATION: Logic placeholder for ID:', req.params.id);
    
    res.json({
      success: true,
      data: {
        id: req.params.id,
        message: 'Registration retrieved successfully (placeholder)'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve registration'
      }
    });
  }
});

/**
 * GET /registrations/:id/launch_url
 * Generate secure launch URL for course playback
 */
app.get('/registrations/:id/launch_url', async (req, res) => {
  try {
    // TODO: Implement launch URL generation logic
    // - Validate registration exists and is active
    // - Generate secure, time-limited launch token
    // - Return launch URL with embedded token
    // - Set up session tracking
    
    console.log('GENERATE LAUNCH URL: Logic placeholder for ID:', req.params.id);
    
    res.json({
      success: true,
      data: {
        launch_url: `http://localhost:3001/player/${req.params.id}?token=placeholder_token`,
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate launch URL'
      }
    });
  }
});

/**
 * GET /registrations/:id/results
 * Get detailed registration results and transcript
 */
app.get('/registrations/:id/results', async (req, res) => {
  try {
    // TODO: Implement results retrieval logic
    // - Return completion status, score, time spent
    // - Include detailed interaction transcript
    // - Provide CMI data model snapshot
    // - Support different result formats (summary vs detailed)
    
    console.log('GET RESULTS: Logic placeholder for ID:', req.params.id);
    
    res.json({
      success: true,
      data: {
        registration_id: req.params.id,
        completion_status: 'incomplete',
        success_status: 'unknown',
        score: null,
        total_time: 0,
        interactions: [],
        cmi_data: {}
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve results'
      }
    });
  }
});

/**
 * DELETE /registrations/:id
 * Delete registration and associated data
 */
app.delete('/registrations/:id', async (req, res) => {
  try {
    // TODO: Implement registration deletion logic
    // - Validate registration exists and belongs to tenant
    // - Clean up active sessions
    // - Remove from database
    // - Clean up any associated assets
    
    console.log('DELETE REGISTRATION: Logic placeholder for ID:', req.params.id);
    
    res.json({
      success: true,
      data: {
        message: 'Registration deleted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete registration'
      }
    });
  }
});

// =============================================================================
// SCORM RTE API ENDPOINTS
// =============================================================================

/**
 * POST /scorm/api/:registrationId
 * Handle SCORM API calls and persist progress data
 */
app.post('/scorm/api/:registrationId', async (req: Request, res: Response) => {
  try {
    const { registrationId } = req.params;
    const { element, value, action } = req.body;
    
    // Validate registration exists
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { course: true }
    });
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: { code: 'REGISTRATION_NOT_FOUND', message: 'Registration not found' }
      });
    }
    
    // Get current progress data or initialize empty
    let progressData = (registration.progressData as any) || {};
    
    // Handle different SCORM API actions
    if (action === 'SetValue') {
      progressData[element] = value;
      
      // Update registration with new progress data
      await prisma.registration.update({
        where: { id: registrationId },
        data: {
          progressData: progressData,
          updatedAt: new Date()
        }
      });
      
      return res.json({
        success: true,
        data: { result: 'true' }
      });
    } else if (action === 'GetValue') {
      const result = progressData[element] || '';
      return res.json({
        success: true,
        data: { result }
      });
    } else if (action === 'Commit') {
      // Force save current progress data
      await prisma.registration.update({
        where: { id: registrationId },
        data: {
          progressData: progressData,
          updatedAt: new Date()
        }
      });
      
      return res.json({
        success: true,
        data: { result: 'true' }
      });
    }
    
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ACTION', message: 'Invalid SCORM API action' }
    });
    
  } catch (error) {
    console.error('SCORM API error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SCORM_API_ERROR', message: 'Failed to process SCORM API call' }
    });
  }
});

// =============================================================================
// WEBSOCKET CONNECTIONS FOR REAL-TIME UPDATES
// =============================================================================

io.on('connection', (socket) => {
  console.log('SCORM player connected:', socket.id);
  
  // Join registration-specific room for targeted updates
  socket.on('join_registration', (registrationId) => {
    socket.join(`registration_${registrationId}`);
    console.log(`Socket ${socket.id} joined registration ${registrationId}`);
  });
  
  // Handle SCORM API calls via WebSocket
  socket.on('scorm_api_call', async (data) => {
    try {
      // TODO: Implement real-time SCORM API handling
      // - Process API call immediately
      // - Update session state in Redis
      // - Broadcast state changes to other connected clients
      // - Handle connection drops gracefully
      
      console.log('WebSocket SCORM API call:', data);
      
      socket.emit('scorm_api_response', {
        success: true,
        return_value: 'true',
        error_code: '0'
      });
    } catch (error) {
      socket.emit('scorm_api_response', {
        success: false,
        error_code: '101',
        message: 'General exception'
      });
    }
  });
  
  // Handle session heartbeat
  socket.on('heartbeat', (registrationId) => {
    // TODO: Update session last activity timestamp
    console.log('Heartbeat received for registration:', registrationId);
  });
  
  socket.on('disconnect', () => {
    console.log('SCORM player disconnected:', socket.id);
    // TODO: Handle session cleanup on disconnect
  });
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'scorm-runtime',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    dependencies: {
      redis: { status: 'healthy' }, // TODO: Actual Redis health check
      database: { status: 'healthy' }, // TODO: Actual database health check
      'sequencing-engine': { status: 'healthy' } // TODO: Actual service health check
    }
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'SCORM Runtime endpoint not found'
    }
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('SCORM Runtime Service error:', err);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'SCORM Runtime Service error'
    }
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🎮 SCORM Runtime Service listening on port ${PORT}`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔌 WebSocket endpoint ready for SCORM player connections`);
  });
}

/**
 * CHANGE LOG - 2025-07-14 20:10 - PHASE 6 RUNTIME ENDPOINT
 * ========================================================
 * WHAT: Added runtime endpoint to serve SCORM content from launch sessions
 * WHY: Phase 6 requirement to display SCORM courses in browser
 * IMPACT: Users can now view and interact with SCORM content
 * NOTES FOR CHATGPT: This endpoint serves HTML container with SCORM iframe
 */

/**
 * GET /runtime/:registrationId
 * Serve SCORM runtime container for a specific registration session
 * PHASE 7 UPDATE: Now serves actual extracted course content
 */
app.get('/runtime/:registrationId', async (req: Request, res: Response) => {
  try {
    const { registrationId } = req.params;
    
    // Get registration and course data from database
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { 
        course: true,
        user: true 
      }
    });
    
    if (!registration) {
      return res.status(404).send(`
        <html>
          <head><title>Registration Not Found</title></head>
          <body>
            <h1>Registration Not Found</h1>
            <p>The registration session could not be found.</p>
            <p>Registration ID: ${registrationId}</p>
          </body>
        </html>
      `);
    }
    
    // Update registration status to in-progress
    await prisma.registration.update({
      where: { id: registrationId },
      data: { status: 'in-progress' }
    });
    
    // Parse course structure to find entry point
    const courseStructure = JSON.parse(registration.course.structure);
    let entryPoint = 'index.html';
    
    // Look for common SCORM entry points
    for (const file of courseStructure) {
      if (file.toLowerCase().includes('index.html') || 
          file.toLowerCase().includes('default.html') || 
          file.toLowerCase().includes('launch.html')) {
        entryPoint = file;
        break;
      }
    }
    
    // Generate SCORM runtime HTML container
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCORM Runtime - ${registration.course.title}</title>
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .header { background: #2563eb; color: white; padding: 1rem; display: flex; justify-content: space-between; align-items: center; }
        .course-title { font-size: 1.2rem; font-weight: bold; }
        .status { font-size: 0.9rem; }
        .runtime-container { height: calc(100vh - 80px); }
        .scorm-iframe { width: 100%; height: 100%; border: none; }
        .error { padding: 2rem; text-align: center; color: #dc2626; }
        .loading { padding: 2rem; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <div class="course-title">📚 ${registration.course.title}</div>
        <div class="status">Status: <span id="status">Loading...</span></div>
    </div>
    
    <div class="runtime-container">
        <div class="loading" id="loading">
            <h2>Loading SCORM Content...</h2>
            <p>Please wait while the course loads.</p>
        </div>
        
        <iframe 
            id="scorm-content" 
            class="scorm-iframe" 
            src="/content/${registrationId}/${entryPoint}" 
            style="display: none;"
            onload="onContentLoad()"
            onerror="onContentError()">
        </iframe>
    </div>
    
    <script>
        // Update status display
        document.getElementById('status').textContent = 'Loading';
        
        // Handle successful content load
        function onContentLoad() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('scorm-content').style.display = 'block';
            document.getElementById('status').textContent = 'Running';
        }
        
        // Handle content load error
        function onContentError() {
            document.getElementById('loading').innerHTML = 
                '<div class="error"><h2>Error Loading Content</h2><p>The SCORM content could not be loaded.</p></div>';
            document.getElementById('status').textContent = 'Error';
        }
        
        // Enhanced SCORM API with database persistence (Phase 7)
        window.API = {
            LMSInitialize: function(param) {
                console.log('SCORM API: LMSInitialize called');
                return 'true';
            },
            LMSGetValue: function(element) {
                console.log('SCORM API: LMSGetValue called for', element);
                if (element === 'cmi.core.lesson_status') return 'not attempted';
                if (element === 'cmi.core.student_id') return '${registration.userId}';
                if (element === 'cmi.core.student_name') return '${registration.user.firstName} ${registration.user.lastName}';
                return '';
            },
            LMSSetValue: function(element, value) {
                console.log('SCORM API: LMSSetValue called for', element, '=', value);
                
                // Phase 7: Save to database via API
                if (element === 'cmi.core.lesson_status' || element === 'cmi.core.score.raw') {
                    fetch('/api/scorm/${registrationId}', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            cmiData: {
                                completion_status: element === 'cmi.core.lesson_status' ? value : undefined,
                                score: element === 'cmi.core.score.raw' ? value : undefined,
                                session_time: new Date().toISOString()
                            }
                        })
                    }).then(response => response.json())
                    .then(data => console.log('Progress saved:', data))
                    .catch(error => console.error('Error saving progress:', error));
                }
                
                return 'true';
            },
            LMSCommit: function(param) {
                console.log('SCORM API: LMSCommit called');
                return 'true';
            },
            LMSFinish: function(param) {
                console.log('SCORM API: LMSFinish called');
                document.getElementById('status').textContent = 'Completed';
                return 'true';
            },
            LMSGetLastError: function() {
                return '0';
            },
            LMSGetErrorString: function(errorCode) {
                return 'No error';
            },
            LMSGetDiagnostic: function(errorCode) {
                return 'No diagnostic';
            }
        };
        
        // Make API available to iframe content
        window.parent.API = window.API;
    </script>
</body>
</html>
    `;
    
    console.log('RUNTIME: Serving SCORM content for registration', registrationId, 'course', registration.course.title);
    res.send(htmlContent);
    
  } catch (error) {
    console.error('Runtime error:', error);
    res.status(500).send(`
      <html>
        <head><title>Runtime Error</title></head>
        <body>
          <h1>Runtime Error</h1>
          <p>An error occurred while loading the SCORM content.</p>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body>
      </html>
    `);
  }
});

export { app, server };
