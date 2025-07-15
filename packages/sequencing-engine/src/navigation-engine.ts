/**
 * @file Navigation Engine - SCORM 2004 Sequencing Engine
 * @description Implements SCORM 2004 navigation and sequencing logic
 * @version 1.0.0
 * 
 * This module handles:
 * - Navigation processing for SCORM 2004 sequencing
 * - Sequencing rule evaluation
 * - Activity state management
 * - Session progression logic
 * 
 * Implementation follows SCORM 2004 specification for sequencing and navigation.
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// NAVIGATION INTERFACES
// =============================================================================

export interface NavigationRequest {
  type: 'start' | 'resume' | 'continue' | 'previous' | 'choice' | 'exit' | 'exitAll' | 'abandon' | 'abandonAll' | 'suspendAll';
  targetActivityId?: string;
  sessionId: string;
  userId: string;
  courseId: string;
}

export interface NavigationResponse {
  success: boolean;
  sessionId: string;
  currentActivity?: string;
  nextActivity?: string;
  previousActivity?: string;
  deliveryRequest?: DeliveryRequest;
  terminationRequest?: TerminationRequest;
  error?: string;
  sequencingException?: string;
}

export interface DeliveryRequest {
  type: 'start' | 'resume';
  activityId: string;
  href: string;
  parameters?: Record<string, any>;
}

export interface TerminationRequest {
  type: 'exit' | 'exitAll' | 'abandon' | 'abandonAll' | 'suspendAll';
  reason: string;
}

export interface ActivityState {
  id: string;
  active: boolean;
  suspended: boolean;
  completed: boolean;
  progressDetermined: boolean;
  objectiveProgressDetermined: boolean;
  objectiveSatisfied: boolean;
  objectiveNormalizedMeasure?: number;
  attemptCount: number;
  attemptAbsoluteDuration?: number;
  attemptExperiencedDuration?: number;
  activityAbsoluteDuration?: number;
  activityExperiencedDuration?: number;
  suspendData?: any;
  childrenStates: Map<string, ActivityState>;
}

export interface SequencingSession {
  id: string;
  userId: string;
  courseId: string;
  activityTree: any; // Will be populated from activity tree parser
  globalStateInformation: GlobalStateInformation;
  currentActivity?: string;
  suspendedActivity?: string;
  activityStateTree: ActivityState;
  sequencingControlFlow: SequencingControlFlow;
  createdAt: Date;
  updatedAt: Date;
}

export interface GlobalStateInformation {
  currentActivity?: string;
  suspendedActivity?: string;
  learnerPreferences: Record<string, any>;
  availableChildren: string[];
}

export interface SequencingControlFlow {
  flowDirection: 'forward' | 'backward';
  flowSubProcess: 'start' | 'resume' | 'continue' | 'exit';
  considerChildren: boolean;
  considerChoice: boolean;
  targetActivity?: string;
  choiceExit: boolean;
  endSession: boolean;
}

// =============================================================================
// NAVIGATION ENGINE CLASS
// =============================================================================

export class NavigationEngine {
  private sessions: Map<string, SequencingSession> = new Map();

  /**
   * Create new sequencing session
   */
  async createSession(userId: string, courseId: string, activityTree: any): Promise<SequencingSession> {
    const sessionId = uuidv4();
    
    console.log(`[NavigationEngine] Creating session ${sessionId} for user ${userId}, course ${courseId}`);
    
    const session: SequencingSession = {
      id: sessionId,
      userId,
      courseId,
      activityTree,
      globalStateInformation: {
        learnerPreferences: {},
        availableChildren: []
      },
      activityStateTree: this.initializeActivityStateTree(activityTree.rootActivity),
      sequencingControlFlow: {
        flowDirection: 'forward',
        flowSubProcess: 'start',
        considerChildren: true,
        considerChoice: false,
        choiceExit: false,
        endSession: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.sessions.set(sessionId, session);
    
    console.log(`[NavigationEngine] Session ${sessionId} created successfully`);
    
    return session;
  }

  /**
   * Get existing session
   */
  getSession(sessionId: string): SequencingSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Process navigation request
   */
  async processNavigation(request: NavigationRequest): Promise<NavigationResponse> {
    try {
      console.log(`[NavigationEngine] Processing navigation request: ${JSON.stringify(request)}`);
      
      const session = this.getSession(request.sessionId);
      if (!session) {
        return {
          success: false,
          sessionId: request.sessionId,
          error: 'Session not found'
        };
      }

      // Update session timestamp
      session.updatedAt = new Date();

      // Process navigation based on type
      switch (request.type) {
        case 'start':
          return await this.processStartNavigation(session, request);
        case 'resume':
          return await this.processResumeNavigation(session, request);
        case 'continue':
          return await this.processContinueNavigation(session, request);
        case 'previous':
          return await this.processPreviousNavigation(session, request);
        case 'choice':
          return await this.processChoiceNavigation(session, request);
        case 'exit':
          return await this.processExitNavigation(session, request);
        case 'exitAll':
          return await this.processExitAllNavigation(session, request);
        case 'abandon':
          return await this.processAbandonNavigation(session, request);
        case 'abandonAll':
          return await this.processAbandonAllNavigation(session, request);
        case 'suspendAll':
          return await this.processSuspendAllNavigation(session, request);
        default:
          return {
            success: false,
            sessionId: request.sessionId,
            error: `Unknown navigation type: ${request.type}`
          };
      }
    } catch (error) {
      console.error(`[NavigationEngine] Error processing navigation:`, error);
      return {
        success: false,
        sessionId: request.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process start navigation
   */
  private async processStartNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing start navigation for session ${session.id}`);

    // Set up sequencing control flow for start
    session.sequencingControlFlow = {
      flowDirection: 'forward',
      flowSubProcess: 'start',
      considerChildren: true,
      considerChoice: false,
      choiceExit: false,
      endSession: false
    };

    // Find first activity to deliver
    const firstActivity = this.findFirstActivity(session);
    if (!firstActivity) {
      return {
        success: false,
        sessionId: session.id,
        error: 'No deliverable activity found'
      };
    }

    // Create delivery request
    const deliveryRequest: DeliveryRequest = {
      type: 'start',
      activityId: firstActivity.id,
      href: firstActivity.href || '',
      parameters: {}
    };

    // Update session state
    session.currentActivity = firstActivity.id;
    session.globalStateInformation.currentActivity = firstActivity.id;

    // Mark activity as active
    const activityState = this.findActivityState(session.activityStateTree, firstActivity.id);
    if (activityState) {
      activityState.active = true;
      activityState.attemptCount += 1;
    }

    return {
      success: true,
      sessionId: session.id,
      currentActivity: firstActivity.id,
      deliveryRequest
    };
  }

  /**
   * Process resume navigation
   */
  private async processResumeNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing resume navigation for session ${session.id}`);

    // Check if there's a suspended activity
    const suspendedActivity = session.suspendedActivity;
    if (!suspendedActivity) {
      // No suspended activity, start from beginning
      return await this.processStartNavigation(session, request);
    }

    // Find suspended activity
    const activity = this.findActivityById(session.activityTree.rootActivity, suspendedActivity);
    if (!activity) {
      return {
        success: false,
        sessionId: session.id,
        error: 'Suspended activity not found'
      };
    }

    // Create delivery request
    const deliveryRequest: DeliveryRequest = {
      type: 'resume',
      activityId: activity.id,
      href: activity.href || '',
      parameters: {}
    };

    // Update session state
    session.currentActivity = activity.id;
    session.suspendedActivity = undefined;
    session.globalStateInformation.currentActivity = activity.id;

    // Mark activity as active
    const activityState = this.findActivityState(session.activityStateTree, activity.id);
    if (activityState) {
      activityState.active = true;
      activityState.suspended = false;
    }

    return {
      success: true,
      sessionId: session.id,
      currentActivity: activity.id,
      deliveryRequest
    };
  }

  /**
   * Process continue navigation
   */
  private async processContinueNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing continue navigation for session ${session.id}`);

    const currentActivity = session.currentActivity;
    if (!currentActivity) {
      return {
        success: false,
        sessionId: session.id,
        error: 'No current activity'
      };
    }

    // Find next activity using sequencing rules
    const nextActivity = this.findNextActivity(session, currentActivity);
    if (!nextActivity) {
      // No more activities, end session
      return {
        success: true,
        sessionId: session.id,
        terminationRequest: {
          type: 'exit',
          reason: 'No more activities'
        }
      };
    }

    // Create delivery request
    const deliveryRequest: DeliveryRequest = {
      type: 'start',
      activityId: nextActivity.id,
      href: nextActivity.href || '',
      parameters: {}
    };

    // Update session state
    session.currentActivity = nextActivity.id;
    session.globalStateInformation.currentActivity = nextActivity.id;

    // Mark new activity as active and old as inactive
    const oldActivityState = this.findActivityState(session.activityStateTree, currentActivity);
    if (oldActivityState) {
      oldActivityState.active = false;
    }

    const newActivityState = this.findActivityState(session.activityStateTree, nextActivity.id);
    if (newActivityState) {
      newActivityState.active = true;
      newActivityState.attemptCount += 1;
    }

    return {
      success: true,
      sessionId: session.id,
      currentActivity: nextActivity.id,
      nextActivity: nextActivity.id,
      deliveryRequest
    };
  }

  /**
   * Process previous navigation
   */
  private async processPreviousNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing previous navigation for session ${session.id}`);

    const currentActivity = session.currentActivity;
    if (!currentActivity) {
      return {
        success: false,
        sessionId: session.id,
        error: 'No current activity'
      };
    }

    // Find previous activity
    const previousActivity = this.findPreviousActivity(session, currentActivity);
    if (!previousActivity) {
      return {
        success: false,
        sessionId: session.id,
        error: 'No previous activity available'
      };
    }

    // Create delivery request
    const deliveryRequest: DeliveryRequest = {
      type: 'start',
      activityId: previousActivity.id,
      href: previousActivity.href || '',
      parameters: {}
    };

    // Update session state
    session.currentActivity = previousActivity.id;
    session.globalStateInformation.currentActivity = previousActivity.id;

    // Mark new activity as active and old as inactive
    const oldActivityState = this.findActivityState(session.activityStateTree, currentActivity);
    if (oldActivityState) {
      oldActivityState.active = false;
    }

    const newActivityState = this.findActivityState(session.activityStateTree, previousActivity.id);
    if (newActivityState) {
      newActivityState.active = true;
      newActivityState.attemptCount += 1;
    }

    return {
      success: true,
      sessionId: session.id,
      currentActivity: previousActivity.id,
      previousActivity: previousActivity.id,
      deliveryRequest
    };
  }

  /**
   * Process choice navigation
   */
  private async processChoiceNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing choice navigation for session ${session.id}`);

    if (!request.targetActivityId) {
      return {
        success: false,
        sessionId: session.id,
        error: 'Target activity ID required for choice navigation'
      };
    }

    // Find target activity
    const targetActivity = this.findActivityById(session.activityTree.rootActivity, request.targetActivityId);
    if (!targetActivity) {
      return {
        success: false,
        sessionId: session.id,
        error: 'Target activity not found'
      };
    }

    // Check if choice is allowed
    if (!this.isChoiceAllowed(session, targetActivity)) {
      return {
        success: false,
        sessionId: session.id,
        error: 'Choice navigation not allowed for target activity'
      };
    }

    // Create delivery request
    const deliveryRequest: DeliveryRequest = {
      type: 'start',
      activityId: targetActivity.id,
      href: targetActivity.href || '',
      parameters: {}
    };

    // Update session state
    const currentActivity = session.currentActivity;
    session.currentActivity = targetActivity.id;
    session.globalStateInformation.currentActivity = targetActivity.id;

    // Mark new activity as active and old as inactive
    if (currentActivity) {
      const oldActivityState = this.findActivityState(session.activityStateTree, currentActivity);
      if (oldActivityState) {
        oldActivityState.active = false;
      }
    }

    const newActivityState = this.findActivityState(session.activityStateTree, targetActivity.id);
    if (newActivityState) {
      newActivityState.active = true;
      newActivityState.attemptCount += 1;
    }

    return {
      success: true,
      sessionId: session.id,
      currentActivity: targetActivity.id,
      deliveryRequest
    };
  }

  /**
   * Process exit navigation
   */
  private async processExitNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing exit navigation for session ${session.id}`);

    const currentActivity = session.currentActivity;
    if (currentActivity) {
      // Mark current activity as inactive
      const activityState = this.findActivityState(session.activityStateTree, currentActivity);
      if (activityState) {
        activityState.active = false;
      }
    }

    // End session
    session.sequencingControlFlow.endSession = true;

    return {
      success: true,
      sessionId: session.id,
      terminationRequest: {
        type: 'exit',
        reason: 'Exit requested'
      }
    };
  }

  /**
   * Process exit all navigation
   */
  private async processExitAllNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing exit all navigation for session ${session.id}`);

    // Mark all activities as inactive
    this.markAllActivitiesInactive(session.activityStateTree);

    // End session
    session.sequencingControlFlow.endSession = true;

    return {
      success: true,
      sessionId: session.id,
      terminationRequest: {
        type: 'exitAll',
        reason: 'Exit all requested'
      }
    };
  }

  /**
   * Process abandon navigation
   */
  private async processAbandonNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing abandon navigation for session ${session.id}`);

    const currentActivity = session.currentActivity;
    if (currentActivity) {
      // Mark current activity as inactive and reset state
      const activityState = this.findActivityState(session.activityStateTree, currentActivity);
      if (activityState) {
        activityState.active = false;
        activityState.completed = false;
        activityState.progressDetermined = false;
      }
    }

    return {
      success: true,
      sessionId: session.id,
      terminationRequest: {
        type: 'abandon',
        reason: 'Abandon requested'
      }
    };
  }

  /**
   * Process abandon all navigation
   */
  private async processAbandonAllNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing abandon all navigation for session ${session.id}`);

    // Reset all activity states
    this.resetAllActivityStates(session.activityStateTree);

    // End session
    session.sequencingControlFlow.endSession = true;

    return {
      success: true,
      sessionId: session.id,
      terminationRequest: {
        type: 'abandonAll',
        reason: 'Abandon all requested'
      }
    };
  }

  /**
   * Process suspend all navigation
   */
  private async processSuspendAllNavigation(session: SequencingSession, request: NavigationRequest): Promise<NavigationResponse> {
    console.log(`[NavigationEngine] Processing suspend all navigation for session ${session.id}`);

    const currentActivity = session.currentActivity;
    if (currentActivity) {
      // Mark current activity as suspended
      const activityState = this.findActivityState(session.activityStateTree, currentActivity);
      if (activityState) {
        activityState.suspended = true;
        activityState.active = false;
      }
      
      session.suspendedActivity = currentActivity;
      session.globalStateInformation.suspendedActivity = currentActivity;
    }

    return {
      success: true,
      sessionId: session.id,
      terminationRequest: {
        type: 'suspendAll',
        reason: 'Suspend all requested'
      }
    };
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Initialize activity state tree
   */
  private initializeActivityStateTree(activityNode: any): ActivityState {
    const state: ActivityState = {
      id: activityNode.id,
      active: false,
      suspended: false,
      completed: false,
      progressDetermined: false,
      objectiveProgressDetermined: false,
      objectiveSatisfied: false,
      attemptCount: 0,
      childrenStates: new Map()
    };

    // Initialize child states
    for (const child of activityNode.children || []) {
      const childState = this.initializeActivityStateTree(child);
      state.childrenStates.set(child.id, childState);
    }

    return state;
  }

  /**
   * Find first deliverable activity
   */
  private findFirstActivity(session: SequencingSession): any {
    return this.findFirstLeafActivity(session.activityTree.rootActivity);
  }

  /**
   * Find first leaf activity
   */
  private findFirstLeafActivity(activity: any): any {
    if (activity.type === 'leaf') {
      return activity;
    }
    
    for (const child of activity.children || []) {
      const leafActivity = this.findFirstLeafActivity(child);
      if (leafActivity) {
        return leafActivity;
      }
    }
    
    return null;
  }

  /**
   * Find activity by ID
   */
  private findActivityById(activity: any, id: string): any {
    if (activity.id === id) {
      return activity;
    }
    
    for (const child of activity.children || []) {
      const found = this.findActivityById(child, id);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Find activity state by ID
   */
  private findActivityState(stateTree: ActivityState, id: string): ActivityState | null {
    if (stateTree.id === id) {
      return stateTree;
    }
    
    for (const childState of stateTree.childrenStates.values()) {
      const found = this.findActivityState(childState, id);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Find next activity using sequencing rules
   */
  private findNextActivity(session: SequencingSession, currentActivityId: string): any {
    const currentActivity = this.findActivityById(session.activityTree.rootActivity, currentActivityId);
    if (!currentActivity) {
      return null;
    }

    // Simple next activity logic - find next sibling or parent's next sibling
    const parent = this.findParentActivity(session.activityTree.rootActivity, currentActivityId);
    if (!parent) {
      return null;
    }

    const siblings = parent.children || [];
    const currentIndex = siblings.findIndex((child: any) => child.id === currentActivityId);
    
    if (currentIndex >= 0 && currentIndex < siblings.length - 1) {
      return this.findFirstLeafActivity(siblings[currentIndex + 1]);
    }

    // No next sibling, move up to parent's next activity
    return this.findNextActivity(session, parent.id);
  }

  /**
   * Find previous activity
   */
  private findPreviousActivity(session: SequencingSession, currentActivityId: string): any {
    const currentActivity = this.findActivityById(session.activityTree.rootActivity, currentActivityId);
    if (!currentActivity) {
      return null;
    }

    // Simple previous activity logic - find previous sibling or parent's previous sibling
    const parent = this.findParentActivity(session.activityTree.rootActivity, currentActivityId);
    if (!parent) {
      return null;
    }

    const siblings = parent.children || [];
    const currentIndex = siblings.findIndex((child: any) => child.id === currentActivityId);
    
    if (currentIndex > 0) {
      return this.findLastLeafActivity(siblings[currentIndex - 1]);
    }

    // No previous sibling, return parent if it's a leaf
    if (parent.type === 'leaf') {
      return parent;
    }

    return null;
  }

  /**
   * Find last leaf activity
   */
  private findLastLeafActivity(activity: any): any {
    if (activity.type === 'leaf') {
      return activity;
    }
    
    const children = activity.children || [];
    for (let i = children.length - 1; i >= 0; i--) {
      const leafActivity = this.findLastLeafActivity(children[i]);
      if (leafActivity) {
        return leafActivity;
      }
    }
    
    return null;
  }

  /**
   * Find parent activity
   */
  private findParentActivity(rootActivity: any, childId: string): any {
    for (const child of rootActivity.children || []) {
      if (child.id === childId) {
        return rootActivity;
      }
      
      const found = this.findParentActivity(child, childId);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Check if choice navigation is allowed
   */
  private isChoiceAllowed(session: SequencingSession, targetActivity: any): boolean {
    // Simple choice validation - check if activity allows choice
    return targetActivity.controlMode?.choice !== false;
  }

  /**
   * Mark all activities as inactive
   */
  private markAllActivitiesInactive(stateTree: ActivityState): void {
    stateTree.active = false;
    
    for (const childState of stateTree.childrenStates.values()) {
      this.markAllActivitiesInactive(childState);
    }
  }

  /**
   * Reset all activity states
   */
  private resetAllActivityStates(stateTree: ActivityState): void {
    stateTree.active = false;
    stateTree.suspended = false;
    stateTree.completed = false;
    stateTree.progressDetermined = false;
    stateTree.objectiveProgressDetermined = false;
    stateTree.objectiveSatisfied = false;
    stateTree.attemptCount = 0;
    
    for (const childState of stateTree.childrenStates.values()) {
      this.resetAllActivityStates(childState);
    }
  }
}

// =============================================================================
// EXPORT NAVIGATION ENGINE INSTANCE
// =============================================================================

export const navigationEngine = new NavigationEngine();
