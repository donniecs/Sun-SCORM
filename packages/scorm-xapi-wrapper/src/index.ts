/**
 * SCORM-to-xAPI Wrapper - Phase 2 Implementation
 * 
 * STRATEGIC DECISION: Forking adlnet/SCORM-to-xAPI-Wrapper
 * 
 * By forking and internalizing the wrapper, we gain full control over its lifecycle.
 * This not only allows for dynamic configuration but also empowers us to:
 * - Patch security vulnerabilities independently
 * - Extend mappings for custom tracking needs
 * - Ensure long-term stability without being dependent on the original repository's maintenance schedule
 * 
 * This frames the fork not just as a technical necessity but as a strategic move 
 * for product resilience and future-proofing.
 */

export interface XAPIConfig {
  lrsEndpoint: string;
  auth: {
    username: string;
    password: string;
  };
  actor: {
    name: string;
    mbox: string;
    account?: {
      homePage: string;
      name: string;
    };
  };
  courseId: string;
  activityId: string;
  dispatchId: string;
  tenantId: string;
}

export interface SCORMToXAPIWrapper {
  initialize(config: XAPIConfig): void;
  LMSInitialize(param: string): string;
  LMSSetValue(element: string, value: string): string;
  LMSGetValue(element: string): string;
  LMSCommit(param: string): string;
  LMSFinish(param: string): string;
  LMSGetLastError(): string;
  LMSGetErrorString(errorCode: string): string;
  LMSGetDiagnostic(errorCode: string): string;
}

export default class SCORMToXAPIWrapperImpl implements SCORMToXAPIWrapper {
  private config: XAPIConfig | null = null;
  private initialized = false;
  private data: { [key: string]: string } = {};
  private errorCode = "0";
  
  constructor() {
    this.setupPostMessageListener();
  }

  /**
   * PHASE 2 ENHANCEMENT: Dynamic Configuration via postMessage
   * 
   * This replaces the hardcoded config approach with secure runtime injection
   * from the parent iframe, enabling tenant-safe multi-user SCORM launches
   * without hardcoding secrets.
   */
  private setupPostMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Validate origin for security
      const allowedOrigins = [
        'http://localhost:3001', // Development
        'https://sun-scorm.com', // Production
        process.env.ALLOWED_ORIGIN || 'http://localhost:3001'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('SCORM-to-xAPI: Invalid origin:', event.origin);
        return;
      }
      
      if (event.data.type === 'SCORM_XAPI_CONFIG') {
        this.initialize(event.data.config);
      }
    });
  }

  /**
   * Initialize wrapper with configuration from parent
   */
  initialize(config: XAPIConfig): void {
    this.config = config;
    this.initialized = true;
    console.log('SCORM-to-xAPI Wrapper initialized with config:', {
      lrsEndpoint: config.lrsEndpoint,
      actorName: config.actor.name,
      courseId: config.courseId,
      activityId: config.activityId
    });
  }

  /**
   * SCORM 1.2 API Implementation
   */
  LMSInitialize(param: string): string {
    if (!this.initialized) {
      this.errorCode = "101"; // General initialization failure
      return "false";
    }
    
    this.sendXAPIStatement({
      verb: "http://adlnet.gov/expapi/verbs/initialized",
      object: {
        id: this.config!.activityId,
        definition: {
          type: "http://adlnet.gov/expapi/activities/lesson"
        }
      }
    });
    
    this.errorCode = "0";
    return "true";
  }

  /**
   * GEMINI'S ENHANCEMENT: Critical Completion/Status Logic
   * 
   * Pay special attention to the logic governing cmi.core.lesson_status.
   * This is the most critical mapping for accurate reporting.
   * Ensure correct handling of SCORM states (passed, completed, failed, incomplete, browsed, not attempted)
   * to their corresponding xAPI verbs (e.g., Passed, Completed, Failed) and result objects.
   */
  LMSSetValue(element: string, value: string): string {
    if (!this.initialized) {
      this.errorCode = "101";
      return "false";
    }
    
    this.data[element] = value;
    
    // Handle critical completion/status logic
    if (element === "cmi.core.lesson_status") {
      this.handleLessonStatusChange(value);
    } else if (element === "cmi.core.score.raw") {
      this.handleScoreChange(value);
    } else if (element.startsWith("cmi.interactions.")) {
      this.handleInteractionData(element, value);
    } else if (element.startsWith("cmi.objectives.")) {
      this.handleObjectiveData(element, value);
    }
    
    this.errorCode = "0";
    return "true";
  }

  /**
   * Critical lesson status mapping - the most important for reporting
   */
  private handleLessonStatusChange(status: string): void {
    const statusMappings: { [key: string]: { verb: string; result?: any } } = {
      "completed": {
        verb: "http://adlnet.gov/expapi/verbs/completed",
        result: { completion: true }
      },
      "passed": {
        verb: "http://adlnet.gov/expapi/verbs/passed",
        result: { completion: true, success: true }
      },
      "failed": {
        verb: "http://adlnet.gov/expapi/verbs/failed",
        result: { completion: true, success: false }
      },
      "incomplete": {
        verb: "http://adlnet.gov/expapi/verbs/suspended",
        result: { completion: false }
      },
      "browsed": {
        verb: "http://adlnet.gov/expapi/verbs/experienced",
        result: { completion: false }
      },
      "not attempted": {
        verb: "http://adlnet.gov/expapi/verbs/initialized",
        result: { completion: false }
      }
    };
    
    const mapping = statusMappings[status.toLowerCase()];
    if (mapping) {
      this.sendXAPIStatement({
        verb: mapping.verb,
        object: {
          id: this.config!.activityId,
          definition: {
            type: "http://adlnet.gov/expapi/activities/lesson"
          }
        },
        result: mapping.result
      });
    }
  }

  /**
   * Handle score changes
   */
  private handleScoreChange(rawScore: string): void {
    const score = parseFloat(rawScore);
    if (!isNaN(score)) {
      this.sendXAPIStatement({
        verb: "http://adlnet.gov/expapi/verbs/scored",
        object: {
          id: this.config!.activityId,
          definition: {
            type: "http://adlnet.gov/expapi/activities/lesson"
          }
        },
        result: {
          score: {
            raw: score,
            min: parseFloat(this.data["cmi.core.score.min"] || "0"),
            max: parseFloat(this.data["cmi.core.score.max"] || "100")
          }
        }
      });
    }
  }

  /**
   * Handle interaction data (quiz questions, etc.)
   */
  private handleInteractionData(element: string, value: string): void {
    const interactionRegex = /cmi\.interactions\.(\d+)\.(.+)/;
    const interactionMatch = interactionRegex.exec(element);
    if (interactionMatch) {
      const interactionId = interactionMatch[1];
      const property = interactionMatch[2];
      
      if (property === "result") {
        this.sendXAPIStatement({
          verb: "http://adlnet.gov/expapi/verbs/answered",
          object: {
            id: `${this.config!.activityId}/interaction/${interactionId}`,
            definition: {
              type: "http://adlnet.gov/expapi/activities/cmi.interaction",
              interactionType: this.data[`cmi.interactions.${interactionId}.type`] || "other"
            }
          },
          result: {
            response: this.data[`cmi.interactions.${interactionId}.learner_response`] || value,
            success: value === "correct"
          }
        });
      }
    }
  }

  /**
   * Handle objective data
   */
  private handleObjectiveData(element: string, value: string): void {
    const objectiveRegex = /cmi\.objectives\.(\d+)\.(.+)/;
    const objectiveMatch = objectiveRegex.exec(element);
    if (objectiveMatch) {
      const objectiveId = objectiveMatch[1];
      const property = objectiveMatch[2];
      
      if (property === "status") {
        this.sendXAPIStatement({
          verb: value === "passed" ? "http://adlnet.gov/expapi/verbs/passed" : "http://adlnet.gov/expapi/verbs/failed",
          object: {
            id: `${this.config!.activityId}/objective/${objectiveId}`,
            definition: {
              type: "http://adlnet.gov/expapi/activities/objective"
            }
          },
          result: {
            success: value === "passed"
          }
        });
      }
    }
  }

  LMSGetValue(element: string): string {
    if (!this.initialized) {
      this.errorCode = "101";
      return "";
    }
    
    this.errorCode = "0";
    return this.data[element] || "";
  }

  LMSCommit(param: string): string {
    if (!this.initialized) {
      this.errorCode = "101";
      return "false";
    }
    
    // Send a progress statement
    this.sendXAPIStatement({
      verb: "http://adlnet.gov/expapi/verbs/progressed",
      object: {
        id: this.config!.activityId,
        definition: {
          type: "http://adlnet.gov/expapi/activities/lesson"
        }
      }
    });
    
    this.errorCode = "0";
    return "true";
  }

  LMSFinish(param: string): string {
    if (!this.initialized) {
      this.errorCode = "101";
      return "false";
    }
    
    // Send termination statement
    this.sendXAPIStatement({
      verb: "http://adlnet.gov/expapi/verbs/terminated",
      object: {
        id: this.config!.activityId,
        definition: {
          type: "http://adlnet.gov/expapi/activities/lesson"
        }
      }
    });
    
    this.errorCode = "0";
    return "true";
  }

  LMSGetLastError(): string {
    return this.errorCode;
  }

  LMSGetErrorString(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      "0": "No error",
      "101": "General initialization failure",
      "201": "Invalid argument error",
      "202": "Element cannot have children",
      "203": "Element not an array - cannot have count",
      "301": "Not initialized",
      "401": "Not implemented error",
      "402": "Invalid set value, element is a keyword",
      "403": "Element is read only",
      "404": "Element is write only",
      "405": "Incorrect data type"
    };
    
    return errorMessages[errorCode] || "Unknown error";
  }

  LMSGetDiagnostic(errorCode: string): string {
    return this.LMSGetErrorString(errorCode);
  }

  /**
   * Send xAPI statement to LRS
   */
  private sendXAPIStatement(statement: any): void {
    if (!this.config) return;
    
    const fullStatement = {
      actor: this.config.actor,
      verb: {
        id: statement.verb,
        display: { "en-US": statement.verb.split('/').pop() || statement.verb }
      },
      object: statement.object,
      result: statement.result,
      context: {
        registration: this.config.dispatchId,
        contextActivities: {
          parent: [
            {
              id: this.config.courseId,
              definition: {
                type: "http://adlnet.gov/expapi/activities/course"
              }
            }
          ],
          grouping: [
            {
              id: `tenant:${this.config.tenantId}`,
              definition: {
                type: "http://adlnet.gov/expapi/activities/profile"
              }
            }
          ]
        }
      },
      timestamp: new Date().toISOString()
    };
    
    const authString = `${this.config.auth.username}:${this.config.auth.password}`;
    
    // Send to LRS
    fetch(`${this.config.lrsEndpoint}/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(authString)}`,
        'X-Experience-API-Version': '1.0.3'
      },
      body: JSON.stringify(fullStatement)
    }).then(response => {
      if (!response.ok) {
        console.error('xAPI Statement failed:', response.status, response.statusText);
      } else {
        console.log('xAPI Statement sent successfully');
      }
    }).catch(error => {
      console.error('xAPI Statement error:', error);
    });
  }
}

// Global API exposure for SCORM content
declare global {
  interface Window {
    API: SCORMToXAPIWrapper;
  }
}

// Initialize and expose the API
const scormWrapper = new SCORMToXAPIWrapperImpl();
window.API = scormWrapper;
