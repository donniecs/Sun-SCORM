import { XAPIStatement, XAPIConfig, SCORMData } from './types';

/**
 * SCORM to xAPI Mapping Functions
 * 
 * This module contains the core mapping logic that transforms SCORM data elements
 * into xAPI statements according to the xAPI SCORM Profile specification.
 */

export class SCORMToXAPIMapper {
  private readonly config: XAPIConfig;
  private data: SCORMData;

  constructor(config: XAPIConfig) {
    this.config = config;
    this.data = {};
  }

  updateData(element: string, value: string): void {
    this.data[element] = value;
  }

  /**
   * Map lesson status to xAPI statement
   */
  mapLessonStatus(status: string): XAPIStatement {
    const statusMappings: { [key: string]: { verb: string; result: any } } = {
      'completed': {
        verb: 'http://adlnet.gov/expapi/verbs/completed',
        result: { completion: true }
      },
      'passed': {
        verb: 'http://adlnet.gov/expapi/verbs/passed',
        result: { completion: true, success: true }
      },
      'failed': {
        verb: 'http://adlnet.gov/expapi/verbs/failed',
        result: { completion: true, success: false }
      },
      'incomplete': {
        verb: 'http://adlnet.gov/expapi/verbs/suspended',
        result: { completion: false }
      },
      'browsed': {
        verb: 'http://adlnet.gov/expapi/verbs/experienced',
        result: { completion: false }
      },
      'not attempted': {
        verb: 'http://adlnet.gov/expapi/verbs/initialized',
        result: { completion: false }
      }
    };

    const mapping = statusMappings[status.toLowerCase()];
    if (!mapping) {
      throw new Error(`Unknown lesson status: ${status}`);
    }

    return {
      actor: this.config.actor,
      verb: {
        id: mapping.verb,
        display: { 'en-US': mapping.verb.split('/').pop() || mapping.verb }
      },
      object: {
        id: this.config.activityId,
        definition: {
          type: 'http://adlnet.gov/expapi/activities/lesson'
        }
      },
      result: mapping.result,
      context: this.buildContext(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Map score to xAPI statement
   */
  mapScore(rawScore: string): XAPIStatement {
    const score = parseFloat(rawScore);
    const minScore = parseFloat(this.data['cmi.core.score.min'] || '0');
    const maxScore = parseFloat(this.data['cmi.core.score.max'] || '100');
    
    let scaled: number | undefined;
    if (maxScore > minScore) {
      scaled = (score - minScore) / (maxScore - minScore);
    }

    return {
      actor: this.config.actor,
      verb: {
        id: 'http://adlnet.gov/expapi/verbs/scored',
        display: { 'en-US': 'scored' }
      },
      object: {
        id: this.config.activityId,
        definition: {
          type: 'http://adlnet.gov/expapi/activities/lesson'
        }
      },
      result: {
        score: {
          raw: score,
          min: minScore,
          max: maxScore,
          scaled: scaled
        }
      },
      context: this.buildContext(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Map interaction to xAPI statement
   */
  mapInteraction(interactionId: string, element: string, value: string): XAPIStatement | null {
    const property = element.split('.').pop();
    
    if (property === 'result') {
      const interactionType = this.data[`cmi.interactions.${interactionId}.type`] || 'other';
      const learnerResponse = this.data[`cmi.interactions.${interactionId}.learner_response`] || value;
      const correctResponse = this.data[`cmi.interactions.${interactionId}.correct_responses.0.pattern`];
      
      return {
        actor: this.config.actor,
        verb: {
          id: 'http://adlnet.gov/expapi/verbs/answered',
          display: { 'en-US': 'answered' }
        },
        object: {
          id: `${this.config.activityId}/interaction/${interactionId}`,
          definition: {
            type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
            interactionType: interactionType,
            name: { 'en-US': `Interaction ${interactionId}` }
          }
        },
        result: {
          response: learnerResponse,
          success: correctResponse ? (learnerResponse === correctResponse) : (value === 'correct')
        },
        context: this.buildContext(),
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  }

  /**
   * Map objective to xAPI statement
   */
  mapObjective(objectiveId: string, element: string, value: string): XAPIStatement | null {
    const property = element.split('.').pop();
    
    if (property === 'status') {
      const verb = value === 'passed' ? 'http://adlnet.gov/expapi/verbs/passed' : 'http://adlnet.gov/expapi/verbs/failed';
      
      return {
        actor: this.config.actor,
        verb: {
          id: verb,
          display: { 'en-US': verb.split('/').pop() || verb }
        },
        object: {
          id: `${this.config.activityId}/objective/${objectiveId}`,
          definition: {
            type: 'http://adlnet.gov/expapi/activities/objective',
            name: { 'en-US': `Objective ${objectiveId}` }
          }
        },
        result: {
          success: value === 'passed'
        },
        context: this.buildContext(),
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  }

  /**
   * Map session time to xAPI statement
   */
  mapSessionTime(sessionTime: string): XAPIStatement {
    // Convert SCORM session time format (HH:MM:SS) to ISO 8601 duration
    const duration = this.convertSessionTimeToDuration(sessionTime);
    
    return {
      actor: this.config.actor,
      verb: {
        id: 'http://adlnet.gov/expapi/verbs/experienced',
        display: { 'en-US': 'experienced' }
      },
      object: {
        id: this.config.activityId,
        definition: {
          type: 'http://adlnet.gov/expapi/activities/lesson'
        }
      },
      result: {
        duration: duration
      },
      context: this.buildContext(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Build standard xAPI context
   */
  private buildContext() {
    return {
      registration: this.config.dispatchId,
      contextActivities: {
        parent: [
          {
            id: this.config.courseId,
            definition: {
              type: 'http://adlnet.gov/expapi/activities/course'
            }
          }
        ],
        grouping: [
          {
            id: `tenant:${this.config.tenantId}`,
            definition: {
              type: 'http://adlnet.gov/expapi/activities/profile'
            }
          }
        ]
      }
    };
  }

  /**
   * Convert SCORM session time format to ISO 8601 duration
   */
  private convertSessionTimeToDuration(sessionTime: string): string {
    const timeRegex = /^(\d{2}):(\d{2}):(\d{2})$/;
    const timeMatch = timeRegex.exec(sessionTime);
    if (!timeMatch) {
      return 'PT0S'; // Invalid format, return 0 duration
    }
    
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    
    let duration = 'PT';
    if (hours > 0) duration += `${hours}H`;
    if (minutes > 0) duration += `${minutes}M`;
    if (seconds > 0) duration += `${seconds}S`;
    
    return duration === 'PT' ? 'PT0S' : duration;
  }
}

/**
 * Validation functions for SCORM data
 */
export class SCORMValidator {
  static validateLessonStatus(status: string): boolean {
    const validStatuses = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];
    return validStatuses.includes(status.toLowerCase());
  }

  static validateScore(score: string): boolean {
    const numScore = parseFloat(score);
    return !isNaN(numScore) && numScore >= 0;
  }

  static validateTime(time: string): boolean {
    return /^\d{2}:\d{2}:\d{2}$/.test(time);
  }

  static validateInteractionType(type: string): boolean {
    const validTypes = ['true-false', 'choice', 'fill-in', 'long-fill-in', 'matching', 'performance', 'sequencing', 'likert', 'numeric', 'other'];
    return validTypes.includes(type);
  }
}
