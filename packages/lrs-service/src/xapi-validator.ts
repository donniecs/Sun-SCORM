/**
 * @file xAPI Statement Validator - LRS Service
 * @description Validates xAPI statements against the xAPI specification
 * @version 1.0.0
 * 
 * This module handles:
 * - xAPI statement structure validation
 * - Required field validation
 * - Data type validation  
 * - Format validation (IRI, timestamp, etc.)
 * - Actor, verb, and object validation
 * - Result and context validation
 * 
 * Implementation follows xAPI 1.0.3 specification.
 */

import { v4 as uuidv4, validate as isValidUUID } from 'uuid';

// =============================================================================
// XAPI INTERFACES
// =============================================================================

export interface XAPIStatement {
  id?: string;
  actor: XAPIActor;
  verb: XAPIVerb;
  object: XAPIObject;
  result?: XAPIResult;
  context?: XAPIContext;
  timestamp?: string;
  stored?: string;
  authority?: XAPIActor;
  version?: string;
  attachments?: XAPIAttachment[];
}

export interface XAPIActor {
  objectType?: 'Agent' | 'Group';
  name?: string;
  mbox?: string;
  mbox_sha1sum?: string;
  openid?: string;
  account?: {
    homePage: string;
    name: string;
  };
  member?: XAPIActor[];
}

export interface XAPIVerb {
  id: string;
  display?: { [language: string]: string };
}

export interface XAPIObject {
  objectType?: 'Activity' | 'Agent' | 'Group' | 'SubStatement' | 'StatementRef';
  id?: string;
  definition?: XAPIActivityDefinition;
  // For Agent/Group objects
  name?: string;
  mbox?: string;
  mbox_sha1sum?: string;
  openid?: string;
  account?: {
    homePage: string;
    name: string;
  };
  member?: XAPIActor[];
  // For SubStatement objects
  actor?: XAPIActor;
  verb?: XAPIVerb;
  object?: XAPIObject;
  // For StatementRef objects
  // id is used for StatementRef
}

export interface XAPIActivityDefinition {
  name?: { [language: string]: string };
  description?: { [language: string]: string };
  type?: string;
  moreInfo?: string;
  extensions?: { [key: string]: any };
  interactionType?: string;
  correctResponsesPattern?: string[];
  choices?: XAPIInteractionComponent[];
  scale?: XAPIInteractionComponent[];
  source?: XAPIInteractionComponent[];
  target?: XAPIInteractionComponent[];
  steps?: XAPIInteractionComponent[];
}

export interface XAPIInteractionComponent {
  id: string;
  description?: { [language: string]: string };
}

export interface XAPIResult {
  score?: {
    scaled?: number;
    raw?: number;
    min?: number;
    max?: number;
  };
  success?: boolean;
  completion?: boolean;
  response?: string;
  duration?: string;
  extensions?: { [key: string]: any };
}

export interface XAPIContext {
  registration?: string;
  instructor?: XAPIActor;
  team?: XAPIActor;
  contextActivities?: {
    parent?: XAPIObject[];
    grouping?: XAPIObject[];
    category?: XAPIObject[];
    other?: XAPIObject[];
  };
  revision?: string;
  platform?: string;
  language?: string;
  statement?: XAPIStatementRef;
  extensions?: { [key: string]: any };
}

export interface XAPIStatementRef {
  objectType: 'StatementRef';
  id: string;
}

export interface XAPIAttachment {
  usageType: string;
  display: { [language: string]: string };
  description?: { [language: string]: string };
  contentType: string;
  length: number;
  sha2: string;
  fileUrl?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// XAPI VALIDATOR CLASS
// =============================================================================

export class XAPIValidator {
  private static readonly XAPI_VERSION = '1.0.3';
  private static readonly IRI_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
  private static readonly EMAIL_REGEX = /^mailto:.+@.+\..+$/;
  private static readonly DURATION_REGEX = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
  private static readonly TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/;

  /**
   * Validate xAPI statement
   */
  validateStatement(statement: any): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // Check if statement is an object
      if (!statement || typeof statement !== 'object') {
        result.errors.push('Statement must be an object');
        result.valid = false;
        return result;
      }

      // Validate required fields
      this.validateRequiredFields(statement, result);

      // Validate optional fields
      this.validateOptionalFields(statement, result);

      // Validate actor
      this.validateActor(statement.actor, result, 'actor');

      // Validate verb
      this.validateVerb(statement.verb, result);

      // Validate object
      this.validateObject(statement.object, result);

      // Validate result if present
      if (statement.result) {
        this.validateResult(statement.result, result);
      }

      // Validate context if present
      if (statement.context) {
        this.validateContext(statement.context, result);
      }

      // Validate timestamp if present
      if (statement.timestamp) {
        this.validateTimestamp(statement.timestamp, result);
      }

      // Validate authority if present
      if (statement.authority) {
        this.validateActor(statement.authority, result, 'authority');
      }

      // Validate version if present
      if (statement.version && statement.version !== XAPIValidator.XAPI_VERSION) {
        result.warnings.push(`Version ${statement.version} may not be fully supported. Recommended: ${XAPIValidator.XAPI_VERSION}`);
      }

      // Validate attachments if present
      if (statement.attachments) {
        this.validateAttachments(statement.attachments, result);
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.valid = false;
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(statement: any, result: ValidationResult): void {
    if (!statement.actor) {
      result.errors.push('Statement must have an actor');
    }

    if (!statement.verb) {
      result.errors.push('Statement must have a verb');
    }

    if (!statement.object) {
      result.errors.push('Statement must have an object');
    }
  }

  /**
   * Validate optional fields
   */
  private validateOptionalFields(statement: any, result: ValidationResult): void {
    // Validate ID if present
    if (statement.id && !isValidUUID(statement.id)) {
      result.errors.push('Statement ID must be a valid UUID');
    }

    // Check for unexpected fields
    const validFields = ['id', 'actor', 'verb', 'object', 'result', 'context', 'timestamp', 'stored', 'authority', 'version', 'attachments'];
    const statementFields = Object.keys(statement);
    
    for (const field of statementFields) {
      if (!validFields.includes(field)) {
        result.warnings.push(`Unexpected field: ${field}`);
      }
    }
  }

  /**
   * Validate actor
   */
  private validateActor(actor: any, result: ValidationResult, fieldName: string): void {
    if (!actor || typeof actor !== 'object') {
      result.errors.push(`${fieldName} must be an object`);
      return;
    }

    // Check object type
    if (actor.objectType && !['Agent', 'Group'].includes(actor.objectType)) {
      result.errors.push(`${fieldName} objectType must be 'Agent' or 'Group'`);
    }

    // Validate identification
    const identifiers = ['mbox', 'mbox_sha1sum', 'openid', 'account'];
    const presentIdentifiers = identifiers.filter(id => actor[id]);

    if (presentIdentifiers.length === 0) {
      result.errors.push(`${fieldName} must have exactly one identifier (mbox, mbox_sha1sum, openid, or account)`);
    } else if (presentIdentifiers.length > 1) {
      result.errors.push(`${fieldName} must have exactly one identifier, found: ${presentIdentifiers.join(', ')}`);
    }

    // Validate mbox format
    if (actor.mbox && !XAPIValidator.EMAIL_REGEX.test(actor.mbox)) {
      result.errors.push(`${fieldName} mbox must be a valid mailto IRI`);
    }

    // Validate account
    if (actor.account) {
      if (!actor.account.homePage || !actor.account.name) {
        result.errors.push(`${fieldName} account must have homePage and name`);
      }
      if (actor.account.homePage && !XAPIValidator.IRI_REGEX.test(actor.account.homePage)) {
        result.errors.push(`${fieldName} account homePage must be a valid IRI`);
      }
    }

    // Validate Group members
    if (actor.objectType === 'Group' && actor.member) {
      if (!Array.isArray(actor.member)) {
        result.errors.push(`${fieldName} Group member must be an array`);
      } else {
        actor.member.forEach((member: any, index: number) => {
          this.validateActor(member, result, `${fieldName}.member[${index}]`);
        });
      }
    }
  }

  /**
   * Validate verb
   */
  private validateVerb(verb: any, result: ValidationResult): void {
    if (!verb || typeof verb !== 'object') {
      result.errors.push('verb must be an object');
      return;
    }

    if (!verb.id) {
      result.errors.push('verb must have an id');
    } else if (!XAPIValidator.IRI_REGEX.test(verb.id)) {
      result.errors.push('verb id must be a valid IRI');
    }

    if (verb.display) {
      if (typeof verb.display !== 'object') {
        result.errors.push('verb display must be an object');
      } else {
        Object.keys(verb.display).forEach(lang => {
          if (typeof verb.display[lang] !== 'string') {
            result.errors.push(`verb display[${lang}] must be a string`);
          }
        });
      }
    }
  }

  /**
   * Validate object
   */
  private validateObject(object: any, result: ValidationResult): void {
    if (!object || typeof object !== 'object') {
      result.errors.push('object must be an object');
      return;
    }

    const objectType = object.objectType || 'Activity';

    switch (objectType) {
      case 'Activity':
        this.validateActivity(object, result);
        break;
      case 'Agent':
      case 'Group':
        this.validateActor(object, result, 'object');
        break;
      case 'SubStatement':
        this.validateSubStatement(object, result);
        break;
      case 'StatementRef':
        this.validateStatementRef(object, result);
        break;
      default:
        result.errors.push(`object objectType must be 'Activity', 'Agent', 'Group', 'SubStatement', or 'StatementRef'`);
    }
  }

  /**
   * Validate activity
   */
  private validateActivity(activity: any, result: ValidationResult): void {
    if (!activity.id) {
      result.errors.push('Activity must have an id');
    } else if (!XAPIValidator.IRI_REGEX.test(activity.id)) {
      result.errors.push('Activity id must be a valid IRI');
    }

    if (activity.definition) {
      this.validateActivityDefinition(activity.definition, result);
    }
  }

  /**
   * Validate activity definition
   */
  private validateActivityDefinition(definition: any, result: ValidationResult): void {
    if (typeof definition !== 'object') {
      result.errors.push('Activity definition must be an object');
      return;
    }

    // Validate language maps
    ['name', 'description'].forEach(field => {
      if (definition[field]) {
        this.validateLanguageMap(definition[field], result, `definition.${field}`);
      }
    });

    // Validate type
    if (definition.type && !XAPIValidator.IRI_REGEX.test(definition.type)) {
      result.errors.push('Activity definition type must be a valid IRI');
    }

    // Validate moreInfo
    if (definition.moreInfo && !XAPIValidator.IRI_REGEX.test(definition.moreInfo)) {
      result.errors.push('Activity definition moreInfo must be a valid IRI');
    }

    // Validate interaction components
    ['choices', 'scale', 'source', 'target', 'steps'].forEach(field => {
      if (definition[field]) {
        this.validateInteractionComponents(definition[field], result, `definition.${field}`);
      }
    });
  }

  /**
   * Validate language map
   */
  private validateLanguageMap(languageMap: any, result: ValidationResult, fieldName: string): void {
    if (typeof languageMap !== 'object') {
      result.errors.push(`${fieldName} must be an object`);
      return;
    }

    Object.keys(languageMap).forEach(lang => {
      if (typeof languageMap[lang] !== 'string') {
        result.errors.push(`${fieldName}[${lang}] must be a string`);
      }
    });
  }

  /**
   * Validate interaction components
   */
  private validateInteractionComponents(components: any, result: ValidationResult, fieldName: string): void {
    if (!Array.isArray(components)) {
      result.errors.push(`${fieldName} must be an array`);
      return;
    }

    components.forEach((component: any, index: number) => {
      if (!component || typeof component !== 'object') {
        result.errors.push(`${fieldName}[${index}] must be an object`);
        return;
      }

      if (!component.id) {
        result.errors.push(`${fieldName}[${index}] must have an id`);
      }

      if (component.description) {
        this.validateLanguageMap(component.description, result, `${fieldName}[${index}].description`);
      }
    });
  }

  /**
   * Validate sub-statement
   */
  private validateSubStatement(subStatement: any, result: ValidationResult): void {
    if (!subStatement.actor) {
      result.errors.push('SubStatement must have an actor');
    } else {
      this.validateActor(subStatement.actor, result, 'subStatement.actor');
    }

    if (!subStatement.verb) {
      result.errors.push('SubStatement must have a verb');
    } else {
      this.validateVerb(subStatement.verb, result);
    }

    if (!subStatement.object) {
      result.errors.push('SubStatement must have an object');
    } else {
      // SubStatement object cannot be another SubStatement
      if (subStatement.object.objectType === 'SubStatement') {
        result.errors.push('SubStatement object cannot be another SubStatement');
      } else {
        this.validateObject(subStatement.object, result);
      }
    }
  }

  /**
   * Validate statement reference
   */
  private validateStatementRef(statementRef: any, result: ValidationResult): void {
    if (!statementRef.id) {
      result.errors.push('StatementRef must have an id');
    } else if (!isValidUUID(statementRef.id)) {
      result.errors.push('StatementRef id must be a valid UUID');
    }
  }

  /**
   * Validate result
   */
  private validateResult(resultObj: any, result: ValidationResult): void {
    if (typeof resultObj !== 'object') {
      result.errors.push('result must be an object');
      return;
    }

    // Validate score
    if (resultObj.score) {
      this.validateScore(resultObj.score, result);
    }

    // Validate duration
    if (resultObj.duration && !XAPIValidator.DURATION_REGEX.test(resultObj.duration)) {
      result.errors.push('result duration must be in ISO 8601 duration format');
    }

    // Validate boolean fields
    ['success', 'completion'].forEach(field => {
      if (resultObj[field] !== undefined && typeof resultObj[field] !== 'boolean') {
        result.errors.push(`result.${field} must be a boolean`);
      }
    });

    // Validate response
    if (resultObj.response !== undefined && typeof resultObj.response !== 'string') {
      result.errors.push('result.response must be a string');
    }
  }

  /**
   * Validate score
   */
  private validateScore(score: any, result: ValidationResult): void {
    if (typeof score !== 'object') {
      result.errors.push('result.score must be an object');
      return;
    }

    ['scaled', 'raw', 'min', 'max'].forEach(field => {
      if (score[field] !== undefined && typeof score[field] !== 'number') {
        result.errors.push(`result.score.${field} must be a number`);
      }
    });

    // Validate scaled score range
    if (score.scaled !== undefined && (score.scaled < -1 || score.scaled > 1)) {
      result.errors.push('result.score.scaled must be between -1 and 1');
    }

    // Validate raw score range
    if (score.raw !== undefined && score.min !== undefined && score.max !== undefined) {
      if (score.raw < score.min || score.raw > score.max) {
        result.errors.push('result.score.raw must be between min and max');
      }
    }
  }

  /**
   * Validate context
   */
  private validateContext(context: any, result: ValidationResult): void {
    if (typeof context !== 'object') {
      result.errors.push('context must be an object');
      return;
    }

    // Validate registration
    if (context.registration && !isValidUUID(context.registration)) {
      result.errors.push('context.registration must be a valid UUID');
    }

    // Validate actors
    ['instructor', 'team'].forEach(field => {
      if (context[field]) {
        this.validateActor(context[field], result, `context.${field}`);
      }
    });

    // Validate context activities
    if (context.contextActivities) {
      this.validateContextActivities(context.contextActivities, result);
    }

    // Validate statement reference
    if (context.statement) {
      this.validateStatementRef(context.statement, result);
    }
  }

  /**
   * Validate context activities
   */
  private validateContextActivities(contextActivities: any, result: ValidationResult): void {
    if (typeof contextActivities !== 'object') {
      result.errors.push('context.contextActivities must be an object');
      return;
    }

    ['parent', 'grouping', 'category', 'other'].forEach(field => {
      if (contextActivities[field]) {
        if (!Array.isArray(contextActivities[field])) {
          result.errors.push(`context.contextActivities.${field} must be an array`);
        } else {
          contextActivities[field].forEach((activity: any, index: number) => {
            this.validateActivity(activity, result);
          });
        }
      }
    });
  }

  /**
   * Validate timestamp
   */
  private validateTimestamp(timestamp: any, result: ValidationResult): void {
    if (typeof timestamp !== 'string') {
      result.errors.push('timestamp must be a string');
      return;
    }

    if (!XAPIValidator.TIMESTAMP_REGEX.test(timestamp)) {
      result.errors.push('timestamp must be in ISO 8601 format');
    }
  }

  /**
   * Validate attachments
   */
  private validateAttachments(attachments: any, result: ValidationResult): void {
    if (!Array.isArray(attachments)) {
      result.errors.push('attachments must be an array');
      return;
    }

    attachments.forEach((attachment: any, index: number) => {
      if (!attachment || typeof attachment !== 'object') {
        result.errors.push(`attachments[${index}] must be an object`);
        return;
      }

      // Validate required fields
      ['usageType', 'display', 'contentType', 'length', 'sha2'].forEach(field => {
        if (!attachment[field]) {
          result.errors.push(`attachments[${index}] must have ${field}`);
        }
      });

      // Validate usage type
      if (attachment.usageType && !XAPIValidator.IRI_REGEX.test(attachment.usageType)) {
        result.errors.push(`attachments[${index}].usageType must be a valid IRI`);
      }

      // Validate display
      if (attachment.display) {
        this.validateLanguageMap(attachment.display, result, `attachments[${index}].display`);
      }

      // Validate description
      if (attachment.description) {
        this.validateLanguageMap(attachment.description, result, `attachments[${index}].description`);
      }

      // Validate length
      if (attachment.length !== undefined && typeof attachment.length !== 'number') {
        result.errors.push(`attachments[${index}].length must be a number`);
      }

      // Validate file URL
      if (attachment.fileUrl && !XAPIValidator.IRI_REGEX.test(attachment.fileUrl)) {
        result.errors.push(`attachments[${index}].fileUrl must be a valid IRI`);
      }
    });
  }

  /**
   * Generate statement ID if not provided
   */
  generateStatementId(): string {
    return uuidv4();
  }

  /**
   * Generate timestamp
   */
  generateTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Normalize statement for storage
   */
  normalizeStatement(statement: any): XAPIStatement {
    const normalized = { ...statement };

    // Add ID if not present
    if (!normalized.id) {
      normalized.id = this.generateStatementId();
    }

    // Add timestamp if not present
    if (!normalized.timestamp) {
      normalized.timestamp = this.generateTimestamp();
    }

    // Add stored timestamp
    normalized.stored = this.generateTimestamp();

    // Set version if not present
    if (!normalized.version) {
      normalized.version = XAPIValidator.XAPI_VERSION;
    }

    return normalized;
  }
}

// =============================================================================
// EXPORT VALIDATOR INSTANCE
// =============================================================================

export const xapiValidator = new XAPIValidator();
