export interface XAPIActor {
  name: string;
  mbox: string;
  account?: {
    homePage: string;
    name: string;
  };
}

export interface XAPIVerb {
  id: string;
  display: { [key: string]: string };
}

export interface XAPIObject {
  id: string;
  definition?: {
    type: string;
    name?: { [key: string]: string };
    description?: { [key: string]: string };
    interactionType?: string;
  };
}

export interface XAPIResult {
  completion?: boolean;
  success?: boolean;
  score?: {
    raw?: number;
    min?: number;
    max?: number;
    scaled?: number;
  };
  response?: string;
  duration?: string;
}

export interface XAPIContext {
  registration?: string;
  contextActivities?: {
    parent?: XAPIObject[];
    grouping?: XAPIObject[];
    category?: XAPIObject[];
    other?: XAPIObject[];
  };
  instructor?: XAPIActor;
  team?: XAPIActor;
  platform?: string;
  language?: string;
  statement?: {
    id: string;
  };
}

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
}

export interface XAPIConfig {
  lrsEndpoint: string;
  auth: {
    username: string;
    password: string;
  };
  actor: XAPIActor;
  courseId: string;
  activityId: string;
  dispatchId: string;
  tenantId: string;
}

export interface SCORMData {
  [key: string]: string;
}

export interface SCORMToXAPIMapping {
  scormElement: string;
  xapiVerb: string;
  transform?: (value: string, allData: SCORMData) => Partial<XAPIStatement>;
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

export interface PostMessageConfig {
  type: 'SCORM_XAPI_CONFIG';
  config: XAPIConfig;
}

export interface PostMessageResponse {
  type: 'SCORM_XAPI_RESPONSE';
  success: boolean;
  message?: string;
  data?: any;
}

export interface WrapperOptions {
  enableLogging?: boolean;
  strictMode?: boolean;
  customMappings?: SCORMToXAPIMapping[];
  allowedOrigins?: string[];
}
