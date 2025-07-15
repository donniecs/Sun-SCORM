/**
 * @file Sequencing Engine Service - RUSTICI KILLER
 * @description Handles SCORM sequencing and navigation logic
 * @version 0.1.0
 * 
 * The Sequencing Engine Service is responsible for:
 * - Implementing SCORM 2004 sequencing and navigation
 * - Managing activity trees and sequencing rules
 * - Handling navigation requests (previous, next, choice, etc.)
 * - Tracking completion and satisfaction status
 * - Managing objective and rule evaluation
 * - Providing rollup and progression logic
 * 
 * This service implements the complex SCORM 2004 sequencing
 * specification to provide accurate navigation and progression
 * through learning activities.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { navigationEngine } from './navigation-engine';

// =============================================================================
// DATABASE SETUP - PHASE 9 ADDITION
// =============================================================================

// TODO: Enable database persistence when Prisma is properly configured
// const prisma = new PrismaClient();

// =============================================================================
// SEQUENCING SESSION PERSISTENCE - PHASE 9 ADDITION
// =============================================================================

/**
 * Save sequencing session to database
 * Converts in-memory session to database format
 */
async function saveSessionToDatabase(session: any) {
  try {
    // TODO: Implement database persistence
    console.log(`[SequencingEngine] Session ${session.id} saved to database (simulated)`);
  } catch (error) {
    console.error(`[SequencingEngine] Failed to save session ${session.id}:`, error);
  }
}

/**
 * Load sequencing session from database
 * Converts database format back to in-memory session
 */
async function loadSessionFromDatabase(sessionId: string) {
  try {
    // TODO: Implement database persistence
    console.log(`[SequencingEngine] Session ${sessionId} loaded from database (simulated)`);
    return null;
  } catch (error) {
    console.error(`[SequencingEngine] Failed to load session ${sessionId}:`, error);
    return null;
  }
}

// TODO: Import shared types in future phases
// import { 
//   SequencingSession, 
//   ActivityTree, 
//   SequencingRule, 
//   NavigationRequest,
//   TenantContext 
// } from '@rustici-killer/types';

const app = express();
const PORT = process.env.PORT || 3004;

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// SEQUENCING SESSION ENDPOINTS
// =============================================================================

/**
 * POST /sessions
 * Create a new sequencing session
 */
app.post('/sessions', async (req, res) => {
  try {
    const { registrationId, courseId, learnerId } = req.body;
    
    if (!registrationId || !courseId || !learnerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: registrationId, courseId, learnerId'
        }
      });
    }
    
    console.log(`[SequencingEngine] Creating session for learner ${learnerId}, course ${courseId}`);
    
    // TODO: Load actual activity tree from course manifest
    // For now, create a simple mock activity tree
    const mockActivityTree = {
      id: uuidv4(),
      title: 'Course Activity Tree',
      courseId,
      rootActivity: {
        id: 'root',
        title: 'Root Activity',
        type: 'cluster',
        children: [
          {
            id: 'lesson1',
            title: 'Lesson 1',
            type: 'leaf',
            href: '/content/lesson1.html',
            children: [],
            controlMode: { choice: true, flow: true },
            deliveryControls: { tracked: true }
          },
          {
            id: 'lesson2',
            title: 'Lesson 2',
            type: 'leaf',
            href: '/content/lesson2.html',
            children: [],
            controlMode: { choice: true, flow: true },
            deliveryControls: { tracked: true }
          }
        ],
        controlMode: { choice: true, flow: true }
      }
    };
    
    // Create sequencing session
    const session = await navigationEngine.createSession(learnerId, courseId, mockActivityTree);
    
    // Save session to database
    await saveSessionToDatabase(session);
    
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        registrationId,
        currentActivity: session.currentActivity,
        navigationState: 'created',
        availableNavigation: {
          previous: false,
          next: true,
          choice: [],
          exit: true
        }
      }
    });
  } catch (error) {
    console.error('Session creation error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_CREATE_FAILED',
        message: 'Failed to create sequencing session'
      }
    });
  }
});

/**
 * GET /sessions/:id
 * Get sequencing session state
 */
app.get('/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    console.log(`[SequencingEngine] Getting session ${sessionId}`);
    
    // Get session from navigation engine
    const session = navigationEngine.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Sequencing session not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        currentActivity: session.currentActivity,
        navigationState: session.sequencingControlFlow.flowSubProcess,
        activityTree: session.activityTree,
        globalState: session.globalStateInformation,
        availableNavigation: {
          previous: !!session.currentActivity,
          next: !!session.currentActivity,
          choice: session.globalStateInformation.availableChildren,
          exit: true
        }
      }
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_RETRIEVAL_FAILED',
        message: 'Failed to retrieve sequencing session'
      }
    });
  }
});

/**
 * POST /sessions/:id/navigate
 * Handle navigation request
 */
app.post('/sessions/:id/navigate', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { navigationRequest, userId, courseId, targetActivityId } = req.body;
    
    if (!navigationRequest || !userId || !courseId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: navigationRequest, userId, courseId'
        }
      });
    }
    
    console.log(`[SequencingEngine] Processing navigation ${navigationRequest} for session ${sessionId}`);
    
    // Create navigation request
    const navRequest = {
      type: navigationRequest,
      targetActivityId,
      sessionId,
      userId,
      courseId
    };
    
    // Process navigation using navigation engine
    const result = await navigationEngine.processNavigation(navRequest);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NAVIGATION_FAILED',
          message: result.error || 'Navigation request failed'
        }
      });
    }
    
    // Save updated session state to database
    const session = navigationEngine.getSession(sessionId);
    if (session) {
      await saveSessionToDatabase(session);
    }
    
    res.json({
      success: true,
      data: {
        navigationResult: 'success',
        sessionId: result.sessionId,
        currentActivity: result.currentActivity,
        nextActivity: result.nextActivity,
        previousActivity: result.previousActivity,
        deliveryRequest: result.deliveryRequest,
        terminationRequest: result.terminationRequest,
        availableNavigation: {
          previous: !!result.previousActivity,
          next: !!result.nextActivity,
          choice: [],
          exit: true
        }
      }
    });
  } catch (error) {
    console.error('Navigation error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'NAVIGATION_ERROR',
        message: 'Internal navigation error'
      }
    });
  }
});

/**
 * POST /sessions/:id/activities/:activityId/terminate
 * Terminate activity and process sequencing
 */
app.post('/sessions/:id/activities/:activityId/terminate', async (req, res) => {
  try {
    const { terminationRequest, runtimeData } = req.body;
    
    // TODO: Implement activity termination logic
    // - Process runtime data changes
    // - Apply sequencing rules
    // - Update activity status
    // - Perform rollup processing
    // - Determine next activity or session end
    
    console.log('TERMINATE ACTIVITY:', req.params.activityId, 'in session:', req.params.id);
    
    res.json({
      success: true,
      data: {
        terminationResult: 'success',
        sequencingResult: null,
        nextActivity: null,
        sessionComplete: false
      }
    });
  } catch (error) {
    console.error('Activity termination error:', error);
    
    res.status(400).json({
      success: false,
      error: {
        code: 'TERMINATION_FAILED',
        message: 'Activity termination failed'
      }
    });
  }
});

// =============================================================================
// ACTIVITY TREE ENDPOINTS
// =============================================================================

/**
 * GET /courses/:id/activity-tree
 * Get course activity tree structure
 */
app.get('/courses/:id/activity-tree', async (req, res) => {
  try {
    // TODO: Implement activity tree retrieval
    // - Load course structure from database
    // - Build activity tree with sequencing rules
    // - Include navigation controls and constraints
    
    console.log('GET ACTIVITY TREE for course:', req.params.id);
    
    res.json({
      success: true,
      data: {
        courseId: req.params.id,
        rootActivity: {
          id: 'root',
          title: 'Course Root',
          children: [],
          sequencingRules: {},
          navigationControls: {}
        }
      }
    });
  } catch (error) {
    console.error('Activity tree retrieval error:', error);
    
    res.status(404).json({
      success: false,
      error: {
        code: 'ACTIVITY_TREE_NOT_FOUND',
        message: 'Activity tree not found'
      }
    });
  }
});

/**
 * GET /sessions/:id/activity-tree
 * Get session-specific activity tree with progress
 */
app.get('/sessions/:id/activity-tree', async (req, res) => {
  try {
    // TODO: Implement session activity tree retrieval
    // - Load session state
    // - Build activity tree with current progress
    // - Include completion and satisfaction status
    
    console.log('GET SESSION ACTIVITY TREE:', req.params.id);
    
    res.json({
      success: true,
      data: {
        sessionId: req.params.id,
        activityTree: {
          id: 'root',
          title: 'Course Root',
          children: [],
          progress: {
            completed: false,
            satisfied: false,
            attemptCount: 0
          }
        }
      }
    });
  } catch (error) {
    console.error('Session activity tree error:', error);
    
    res.status(404).json({
      success: false,
      error: {
        code: 'SESSION_ACTIVITY_TREE_NOT_FOUND',
        message: 'Session activity tree not found'
      }
    });
  }
});

// =============================================================================
// SEQUENCING RULES ENDPOINTS
// =============================================================================

/**
 * GET /courses/:id/sequencing-rules
 * Get sequencing rules for a course
 */
app.get('/courses/:id/sequencing-rules', async (req, res) => {
  try {
    // TODO: Implement sequencing rules retrieval
    // - Load sequencing rules from course manifest
    // - Return rules in structured format
    // - Include pre/post conditions and rule actions
    
    console.log('GET SEQUENCING RULES for course:', req.params.id);
    
    res.json({
      success: true,
      data: {
        courseId: req.params.id,
        sequencingRules: {
          preConditionRules: [],
          postConditionRules: [],
          exitConditionRules: [],
          rollupRules: []
        }
      }
    });
  } catch (error) {
    console.error('Sequencing rules retrieval error:', error);
    
    res.status(404).json({
      success: false,
      error: {
        code: 'SEQUENCING_RULES_NOT_FOUND',
        message: 'Sequencing rules not found'
      }
    });
  }
});

/**
 * POST /sessions/:id/evaluate-rules
 * Evaluate sequencing rules for current session state
 */
app.post('/sessions/:id/evaluate-rules', async (req, res) => {
  try {
    const { ruleType, activityId, runtimeData } = req.body;
    
    // TODO: Implement rule evaluation logic
    // - Load current session state
    // - Apply specified rule type
    // - Return evaluation results
    // - Include any rule actions to execute
    
    console.log('EVALUATE RULES:', ruleType, 'for session:', req.params.id);
    
    res.json({
      success: true,
      data: {
        ruleType,
        evaluationResult: 'unknown',
        ruleActions: [],
        continueSequencing: true
      }
    });
  } catch (error) {
    console.error('Rule evaluation error:', error);
    
    res.status(400).json({
      success: false,
      error: {
        code: 'RULE_EVALUATION_FAILED',
        message: 'Rule evaluation failed'
      }
    });
  }
});

// =============================================================================
// ROLLUP PROCESSING ENDPOINTS
// =============================================================================

/**
 * POST /sessions/:id/rollup
 * Process rollup for activity completion and satisfaction
 */
app.post('/sessions/:id/rollup', async (req, res) => {
  try {
    const { activityId, childResults } = req.body;
    
    // TODO: Implement rollup processing logic
    // - Load activity and its children
    // - Apply rollup rules
    // - Calculate completion and satisfaction
    // - Update parent activity status
    // - Propagate rollup up the tree
    
    console.log('ROLLUP PROCESSING for activity:', activityId, 'in session:', req.params.id);
    
    res.json({
      success: true,
      data: {
        activityId,
        rollupResult: {
          completionStatus: 'unknown',
          satisfactionStatus: 'unknown',
          measureStatus: false,
          normalizedMeasure: 0
        },
        propagateRollup: false
      }
    });
  } catch (error) {
    console.error('Rollup processing error:', error);
    
    res.status(400).json({
      success: false,
      error: {
        code: 'ROLLUP_FAILED',
        message: 'Rollup processing failed'
      }
    });
  }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sequencing-engine',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    scormVersion: '2004',
    dependencies: {
      database: { status: 'healthy' }, // TODO: Actual database health check
      cache: { status: 'healthy' } // TODO: Actual cache health check
    }
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Sequencing Engine endpoint not found'
    }
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Sequencing Engine error:', err);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Sequencing Engine error'
    }
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`⚡ Sequencing Engine listening on port ${PORT}`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    console.log(`🎯 SCORM 2004 Sequencing & Navigation`);
  });
}

export { app };
