/**
 * @file Activity Tree Parser - SCORM 2004 Sequencing Engine
 * @description Parses imsmanifest.xml to extract sequencing rules and build activity tree
 * @version 1.0.0
 * 
 * This module handles:
 * - Parsing imsmanifest.xml files for SCORM 2004 sequencing information
 * - Building activity trees with proper hierarchy and navigation rules
 * - Extracting sequencing rules, conditions, and actions
 * - Processing learning objectives and rollup rules
 * - Validating sequencing data integrity
 * 
 * Implementation follows SCORM 2004 specification for sequencing and navigation.
 */

import { DOMParser } from 'xmldom';
import { v4 as uuidv4 } from 'uuid';

// Type casting helpers for xmldom
const getElement = (node: any): Element => node as Element;
const getAttribute = (element: any, name: string): string | null => element.getAttribute(name);
const getElementsByTagName = (element: any, tagName: string): any[] => {
  const collection = element.getElementsByTagName(tagName);
  return Array.from({ length: collection.length }, (_, i) => collection[i]);
};
const getTextContent = (element: any): string | null => element.textContent;

// =============================================================================
// ACTIVITY TREE INTERFACES
// =============================================================================

export interface SequencingRule {
  id: string;
  type: 'pre' | 'post' | 'exit';
  conditions: SequencingCondition[];
  action: SequencingAction;
}

export interface SequencingCondition {
  type: 'satisfied' | 'objective_status_known' | 'objective_measure_known' | 'completed' | 'activity_progress_known' | 'attempted' | 'attempt_limit_exceeded' | 'time_limit_exceeded' | 'outside_available_time_range';
  referencedObjective?: string;
  operator?: 'not' | 'no_op';
  measureThreshold?: number;
}

export interface SequencingAction {
  type: 'skip' | 'disabled' | 'hidden_from_choice' | 'stop_forward_traversal' | 'exit_parent' | 'exit_all' | 'retry' | 'retry_all' | 'continue' | 'previous';
}

export interface LearningObjective {
  id: string;
  primary: boolean;
  satisfiedByMeasure: boolean;
  minNormalizedMeasure: number;
  objectiveID?: string;
  mapInfo?: {
    targetObjectiveID: string;
    readSatisfiedStatus: boolean;
    readNormalizedMeasure: boolean;
    writeSatisfiedStatus: boolean;
    writeNormalizedMeasure: boolean;
  }[];
}

export interface RollupRule {
  id: string;
  childActivitySet: 'all' | 'any' | 'none' | 'at_least_count' | 'at_least_percent';
  minimumCount?: number;
  minimumPercent?: number;
  conditions: RollupCondition[];
  action: RollupAction;
}

export interface RollupCondition {
  type: 'satisfied' | 'objective_status_known' | 'objective_measure_known' | 'completed' | 'activity_progress_known' | 'attempted' | 'attempt_limit_exceeded' | 'time_limit_exceeded';
  operator?: 'not' | 'no_op';
}

export interface RollupAction {
  type: 'satisfied' | 'not_satisfied' | 'completed' | 'incomplete';
}

export interface ActivityNode {
  id: string;
  title: string;
  type: 'cluster' | 'leaf';
  identifierref?: string;
  href?: string;
  children: ActivityNode[];
  parent?: ActivityNode;
  
  // Sequencing properties
  sequencingRules: SequencingRule[];
  learningObjectives: LearningObjective[];
  rollupRules: RollupRule[];
  
  // Control properties
  controlMode: {
    choice: boolean;
    choiceExit: boolean;
    flow: boolean;
    forwardOnly: boolean;
  };
  
  // Delivery properties
  deliveryControls: {
    tracked: boolean;
    completionSetByContent: boolean;
    objectiveSetByContent: boolean;
  };
  
  // Constraints
  constraints: {
    preventActivation: boolean;
    constrainChoice: boolean;
    rollupProgressCompletion: boolean;
    rollupObjectiveSatisfied: boolean;
    measureSatisfactionIfActive: boolean;
  };
  
  // Limits
  limitConditions: {
    attemptLimit?: number;
    attemptAbsoluteDurationLimit?: string;
    attemptExperiencedDurationLimit?: string;
    activityAbsoluteDurationLimit?: string;
    activityExperiencedDurationLimit?: string;
    beginTimeLimit?: string;
    endTimeLimit?: string;
  };
  
  // Random properties
  randomizationControls: {
    randomizationTiming: 'never' | 'once' | 'on_each_new_attempt';
    selectCount?: number;
    reorderChildren: boolean;
    selectionTiming: 'never' | 'once' | 'on_each_new_attempt';
  };
}

export interface ActivityTree {
  id: string;
  title: string;
  courseId: string;
  manifestPath: string;
  rootActivity: ActivityNode;
  resources: Map<string, ResourceDefinition>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceDefinition {
  identifier: string;
  type: string;
  href: string;
  files: string[];
  dependencies: string[];
  metadata?: any;
}

// =============================================================================
// ACTIVITY TREE PARSER CLASS
// =============================================================================

export class ActivityTreeParser {
  private parser: DOMParser;
  private currentTree: ActivityTree | null = null;
  
  constructor() {
    this.parser = new DOMParser();
  }
  
  /**
   * Parse imsmanifest.xml and build activity tree
   */
  async parseManifest(manifestXml: string, courseId: string, manifestPath: string): Promise<ActivityTree> {
    try {
      console.log(`[ActivityTreeParser] Starting manifest parsing for course: ${courseId}`);
      
      const doc = this.parser.parseFromString(manifestXml, 'text/xml');
      const manifestNode = doc.getElementsByTagName('manifest')[0];
      
      if (!manifestNode) {
        throw new Error('Invalid manifest: Missing <manifest> root element');
      }
      
      // Initialize activity tree
      this.currentTree = {
        id: uuidv4(),
        title: this.getManifestTitle(manifestNode),
        courseId,
        manifestPath,
        rootActivity: null as any, // Will be set below
        resources: new Map(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Parse resources section
      await this.parseResources(manifestNode);
      
      // Parse organizations and build activity tree
      const organizationsNode = manifestNode.getElementsByTagName('organizations')[0];
      if (!organizationsNode) {
        throw new Error('Invalid manifest: Missing <organizations> element');
      }
      
      const defaultOrg = organizationsNode.getAttribute('default');
      const orgNode = defaultOrg 
        ? this.findElementByAttribute(organizationsNode, 'organization', 'identifier', defaultOrg)
        : organizationsNode.getElementsByTagName('organization')[0];
      
      if (!orgNode) {
        throw new Error('Invalid manifest: No organization found');
      }
      
      this.currentTree.rootActivity = await this.parseActivity(orgNode, null);
      
      console.log(`[ActivityTreeParser] Successfully parsed manifest with ${this.countActivities(this.currentTree.rootActivity)} activities`);
      
      return this.currentTree;
    } catch (error) {
      console.error('[ActivityTreeParser] Error parsing manifest:', error);
      throw error;
    }
  }
  
  /**
   * Parse resources section
   */
  private async parseResources(manifestNode: any): Promise<void> {
    const resourcesNodes = getElementsByTagName(manifestNode, 'resources');
    if (resourcesNodes.length === 0) {
      console.log('[ActivityTreeParser] No resources section found');
      return;
    }
    
    const resourceNodes = getElementsByTagName(resourcesNodes[0], 'resource');
    for (const resourceNode of resourceNodes) {
      const resource = this.parseResource(resourceNode);
      
      if (resource) {
        this.currentTree!.resources.set(resource.identifier, resource);
      }
    }
    
    console.log(`[ActivityTreeParser] Parsed ${this.currentTree!.resources.size} resources`);
  }
  
  /**
   * Parse individual resource
   */
  private parseResource(resourceNode: Element): ResourceDefinition | null {
    const identifier = resourceNode.getAttribute('identifier');
    const type = resourceNode.getAttribute('type');
    const href = resourceNode.getAttribute('href');
    
    if (!identifier) {
      console.warn('[ActivityTreeParser] Resource missing identifier, skipping');
      return null;
    }
    
    // Parse file elements
    const files: string[] = [];
    const fileNodes = resourceNode.getElementsByTagName('file');
    for (let i = 0; i < fileNodes.length; i++) {
      const fileHref = fileNodes[i].getAttribute('href');
      if (fileHref) {
        files.push(fileHref);
      }
    }
    
    // Parse dependency elements
    const dependencies: string[] = [];
    const dependencyNodes = resourceNode.getElementsByTagName('dependency');
    for (let i = 0; i < dependencyNodes.length; i++) {
      const dependencyRef = dependencyNodes[i].getAttribute('identifierref');
      if (dependencyRef) {
        dependencies.push(dependencyRef);
      }
    }
    
    return {
      identifier,
      type: type || 'webcontent',
      href: href || '',
      files,
      dependencies
    };
  }
  
  /**
   * Parse activity node recursively
   */
  private async parseActivity(element: Element, parent: ActivityNode | null): Promise<ActivityNode> {
    const identifier = element.getAttribute('identifier');
    const identifierref = element.getAttribute('identifierref');
    const title = this.getElementTitle(element);
    
    if (!identifier) {
      throw new Error('Activity missing required identifier');
    }
    
    // Determine if this is a leaf or cluster activity
    const itemNodes = element.getElementsByTagName('item');
    const isLeaf = itemNodes.length === 0;
    
    // Get resource href if this is a leaf activity
    let href = '';
    if (isLeaf && identifierref) {
      const resource = this.currentTree!.resources.get(identifierref);
      if (resource) {
        href = resource.href;
      }
    }
    
    // Create activity node
    const activity: ActivityNode = {
      id: identifier,
      title,
      type: isLeaf ? 'leaf' : 'cluster',
      identifierref: identifierref || undefined,
      href,
      children: [],
      parent: parent || undefined,
      sequencingRules: [],
      learningObjectives: [],
      rollupRules: [],
      controlMode: {
        choice: true,
        choiceExit: true,
        flow: false,
        forwardOnly: false
      },
      deliveryControls: {
        tracked: true,
        completionSetByContent: false,
        objectiveSetByContent: false
      },
      constraints: {
        preventActivation: false,
        constrainChoice: false,
        rollupProgressCompletion: true,
        rollupObjectiveSatisfied: true,
        measureSatisfactionIfActive: true
      },
      limitConditions: {},
      randomizationControls: {
        randomizationTiming: 'never',
        reorderChildren: false,
        selectionTiming: 'never'
      }
    };
    
    // Parse sequencing information
    await this.parseSequencingInfo(element, activity);
    
    // Parse child activities
    for (let i = 0; i < itemNodes.length; i++) {
      const childActivity = await this.parseActivity(itemNodes[i], activity);
      activity.children.push(childActivity);
    }
    
    return activity;
  }
  
  /**
   * Parse sequencing information from activity element
   */
  private async parseSequencingInfo(element: Element, activity: ActivityNode): Promise<void> {
    const sequencingNode = this.findChildElement(element, 'sequencing');
    if (!sequencingNode) {
      return;
    }
    
    // Parse control mode
    const controlModeNode = this.findChildElement(sequencingNode, 'controlMode');
    if (controlModeNode) {
      activity.controlMode.choice = this.getBooleanAttribute(controlModeNode, 'choice', true);
      activity.controlMode.choiceExit = this.getBooleanAttribute(controlModeNode, 'choiceExit', true);
      activity.controlMode.flow = this.getBooleanAttribute(controlModeNode, 'flow', false);
      activity.controlMode.forwardOnly = this.getBooleanAttribute(controlModeNode, 'forwardOnly', false);
    }
    
    // Parse delivery controls
    const deliveryControlsNode = this.findChildElement(sequencingNode, 'deliveryControls');
    if (deliveryControlsNode) {
      activity.deliveryControls.tracked = this.getBooleanAttribute(deliveryControlsNode, 'tracked', true);
      activity.deliveryControls.completionSetByContent = this.getBooleanAttribute(deliveryControlsNode, 'completionSetByContent', false);
      activity.deliveryControls.objectiveSetByContent = this.getBooleanAttribute(deliveryControlsNode, 'objectiveSetByContent', false);
    }
    
    // Parse constraints
    const constraintsNode = this.findChildElement(sequencingNode, 'constraints');
    if (constraintsNode) {
      activity.constraints.preventActivation = this.getBooleanAttribute(constraintsNode, 'preventActivation', false);
      activity.constraints.constrainChoice = this.getBooleanAttribute(constraintsNode, 'constrainChoice', false);
      activity.constraints.rollupProgressCompletion = this.getBooleanAttribute(constraintsNode, 'rollupProgressCompletion', true);
      activity.constraints.rollupObjectiveSatisfied = this.getBooleanAttribute(constraintsNode, 'rollupObjectiveSatisfied', true);
      activity.constraints.measureSatisfactionIfActive = this.getBooleanAttribute(constraintsNode, 'measureSatisfactionIfActive', true);
    }
    
    // Parse learning objectives
    const objectivesNode = this.findChildElement(sequencingNode, 'objectives');
    if (objectivesNode) {
      const primaryObjectiveNode = this.findChildElement(objectivesNode, 'primaryObjective');
      if (primaryObjectiveNode) {
        const primaryObjective = this.parseLearningObjective(primaryObjectiveNode, true);
        activity.learningObjectives.push(primaryObjective);
      }
      
      const objectiveNodes = objectivesNode.getElementsByTagName('objective');
      for (let i = 0; i < objectiveNodes.length; i++) {
        const objective = this.parseLearningObjective(objectiveNodes[i], false);
        activity.learningObjectives.push(objective);
      }
    }
    
    // Parse sequencing rules
    const sequencingRulesNode = this.findChildElement(sequencingNode, 'sequencingRules');
    if (sequencingRulesNode) {
      activity.sequencingRules = this.parseSequencingRules(sequencingRulesNode);
    }
    
    // Parse rollup rules
    const rollupRulesNode = this.findChildElement(sequencingNode, 'rollupRules');
    if (rollupRulesNode) {
      activity.rollupRules = this.parseRollupRules(rollupRulesNode);
    }
  }
  
  /**
   * Parse learning objective
   */
  private parseLearningObjective(objectiveNode: Element, isPrimary: boolean): LearningObjective {
    const objectiveID = objectiveNode.getAttribute('objectiveID');
    const satisfiedByMeasure = this.getBooleanAttribute(objectiveNode, 'satisfiedByMeasure', false);
    const minNormalizedMeasure = parseFloat(objectiveNode.getAttribute('minNormalizedMeasure') || '1.0');
    
    return {
      id: uuidv4(),
      primary: isPrimary,
      satisfiedByMeasure,
      minNormalizedMeasure,
      objectiveID: objectiveID || undefined,
      mapInfo: [] // TODO: Parse map info if needed
    };
  }
  
  /**
   * Parse sequencing rules
   */
  private parseSequencingRules(rulesNode: Element): SequencingRule[] {
    const rules: SequencingRule[] = [];
    
    // Parse pre-condition rules
    const preConditionRules = rulesNode.getElementsByTagName('preConditionRule');
    for (let i = 0; i < preConditionRules.length; i++) {
      const rule = this.parseSequencingRule(preConditionRules[i], 'pre');
      if (rule) rules.push(rule);
    }
    
    // Parse post-condition rules
    const postConditionRules = rulesNode.getElementsByTagName('postConditionRule');
    for (let i = 0; i < postConditionRules.length; i++) {
      const rule = this.parseSequencingRule(postConditionRules[i], 'post');
      if (rule) rules.push(rule);
    }
    
    // Parse exit rules
    const exitRules = rulesNode.getElementsByTagName('exitConditionRule');
    for (let i = 0; i < exitRules.length; i++) {
      const rule = this.parseSequencingRule(exitRules[i], 'exit');
      if (rule) rules.push(rule);
    }
    
    return rules;
  }
  
  /**
   * Parse individual sequencing rule
   */
  private parseSequencingRule(ruleNode: Element, type: 'pre' | 'post' | 'exit'): SequencingRule | null {
    const ruleConditionsNode = this.findChildElement(ruleNode, 'ruleConditions');
    const ruleActionNode = this.findChildElement(ruleNode, 'ruleAction');
    
    if (!ruleConditionsNode || !ruleActionNode) {
      return null;
    }
    
    const conditions = this.parseRuleConditions(ruleConditionsNode);
    const action = this.parseRuleAction(ruleActionNode);
    
    return {
      id: uuidv4(),
      type,
      conditions,
      action
    };
  }
  
  /**
   * Parse rule conditions
   */
  private parseRuleConditions(conditionsNode: Element): SequencingCondition[] {
    const conditions: SequencingCondition[] = [];
    const conditionNodes = conditionsNode.getElementsByTagName('ruleCondition');
    
    for (let i = 0; i < conditionNodes.length; i++) {
      const conditionNode = conditionNodes[i];
      const condition = conditionNode.getAttribute('condition');
      const referencedObjective = conditionNode.getAttribute('referencedObjective');
      const operator = conditionNode.getAttribute('operator');
      const measureThreshold = conditionNode.getAttribute('measureThreshold');
      
      if (condition) {
        conditions.push({
          type: condition as any,
          referencedObjective: referencedObjective || undefined,
          operator: operator as any,
          measureThreshold: measureThreshold ? parseFloat(measureThreshold) : undefined
        });
      }
    }
    
    return conditions;
  }
  
  /**
   * Parse rule action
   */
  private parseRuleAction(actionNode: Element): SequencingAction {
    const action = actionNode.getAttribute('action') || 'continue';
    
    return {
      type: action as any
    };
  }
  
  /**
   * Parse rollup rules
   */
  private parseRollupRules(rollupRulesNode: Element): RollupRule[] {
    const rules: RollupRule[] = [];
    const ruleNodes = rollupRulesNode.getElementsByTagName('rollupRule');
    
    for (let i = 0; i < ruleNodes.length; i++) {
      const ruleNode = ruleNodes[i];
      const childActivitySet = ruleNode.getAttribute('childActivitySet') || 'all';
      const minimumCount = ruleNode.getAttribute('minimumCount');
      const minimumPercent = ruleNode.getAttribute('minimumPercent');
      
      const rollupConditionsNode = this.findChildElement(ruleNode, 'rollupConditions');
      const rollupActionNode = this.findChildElement(ruleNode, 'rollupAction');
      
      if (rollupConditionsNode && rollupActionNode) {
        const conditions = this.parseRollupConditions(rollupConditionsNode);
        const action = this.parseRollupAction(rollupActionNode);
        
        rules.push({
          id: uuidv4(),
          childActivitySet: childActivitySet as any,
          minimumCount: minimumCount ? parseInt(minimumCount) : undefined,
          minimumPercent: minimumPercent ? parseFloat(minimumPercent) : undefined,
          conditions,
          action
        });
      }
    }
    
    return rules;
  }
  
  /**
   * Parse rollup conditions
   */
  private parseRollupConditions(conditionsNode: Element): RollupCondition[] {
    const conditions: RollupCondition[] = [];
    const conditionNodes = conditionsNode.getElementsByTagName('rollupCondition');
    
    for (let i = 0; i < conditionNodes.length; i++) {
      const conditionNode = conditionNodes[i];
      const condition = conditionNode.getAttribute('condition');
      const operator = conditionNode.getAttribute('operator');
      
      if (condition) {
        conditions.push({
          type: condition as any,
          operator: operator as any
        });
      }
    }
    
    return conditions;
  }
  
  /**
   * Parse rollup action
   */
  private parseRollupAction(actionNode: Element): RollupAction {
    const action = actionNode.getAttribute('action') || 'satisfied';
    
    return {
      type: action as any
    };
  }
  
  // =============================================================================
  // UTILITY METHODS
  // =============================================================================
  
  /**
   * Get manifest title
   */
  private getManifestTitle(manifestNode: Element): string {
    const titleNode = this.findChildElement(manifestNode, 'title');
    return titleNode?.textContent || 'Untitled Course';
  }
  
  /**
   * Get element title
   */
  private getElementTitle(element: Element): string {
    const titleNode = this.findChildElement(element, 'title');
    return titleNode?.textContent || element.getAttribute('identifier') || 'Untitled Activity';
  }
  
  /**
   * Find child element by tag name
   */
  private findChildElement(parent: Element, tagName: string): Element | null {
    const children = parent.getElementsByTagName(tagName);
    return children.length > 0 ? children[0] : null;
  }
  
  /**
   * Find element by attribute value
   */
  private findElementByAttribute(parent: Element, tagName: string, attributeName: string, attributeValue: string): Element | null {
    const elements = parent.getElementsByTagName(tagName);
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].getAttribute(attributeName) === attributeValue) {
        return elements[i];
      }
    }
    return null;
  }
  
  /**
   * Get boolean attribute value
   */
  private getBooleanAttribute(element: Element, attributeName: string, defaultValue: boolean): boolean {
    const value = element.getAttribute(attributeName);
    if (value === null) return defaultValue;
    return value.toLowerCase() === 'true';
  }
  
  /**
   * Count total activities in tree
   */
  private countActivities(activity: ActivityNode): number {
    let count = 1;
    for (const child of activity.children) {
      count += this.countActivities(child);
    }
    return count;
  }
}

// =============================================================================
// EXPORT PARSER INSTANCE
// =============================================================================

export const activityTreeParser = new ActivityTreeParser();
