/**
 * Configuration Validation Utility
 * Validates critical environment variables and configurations on startup
 */

import { Client } from 'pg';
import jwt from 'jsonwebtoken';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment: string;
  timestamp: string;
}

export interface RequiredConfig {
  name: string;
  value: string | undefined;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
}

/**
 * Validates all critical configuration variables
 */
export async function validateConfig(): Promise<ConfigValidationResult> {
  const result: ConfigValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };

  console.log('🔍 Starting configuration validation...');

  // Define required configuration variables
  const requiredConfigs: RequiredConfig[] = [
    {
      name: 'DATABASE_URL',
      value: process.env.DATABASE_URL,
      required: true,
      description: 'PostgreSQL database connection string'
    },
    {
      name: 'JWT_SECRET',
      value: process.env.JWT_SECRET,
      required: true,
      description: 'Secret key for JWT token signing',
      validator: (value: string) => value.length >= 32
    },
    {
      name: 'PORT',
      value: process.env.PORT,
      required: false,
      description: 'API server port',
      validator: (value: string) => {
        const port = parseInt(value, 10);
        return !isNaN(port) && port > 0 && port < 65536;
      }
    },
    {
      name: 'CORS_ORIGIN',
      value: process.env.CORS_ORIGIN,
      required: false,
      description: 'CORS allowed origins'
    },
    {
      name: 'NODE_ENV',
      value: process.env.NODE_ENV,
      required: true,
      description: 'Node.js environment (development/staging/production)'
    },
    {
      name: 'LOG_LEVEL',
      value: process.env.LOG_LEVEL,
      required: false,
      description: 'Application logging level'
    },
    {
      name: 'FILE_UPLOAD_PATH',
      value: process.env.FILE_UPLOAD_PATH,
      required: false,
      description: 'Directory for uploaded course files'
    },
    {
      name: 'MAX_FILE_SIZE',
      value: process.env.MAX_FILE_SIZE,
      required: false,
      description: 'Maximum file upload size in bytes',
      validator: (value: string) => {
        const size = parseInt(value, 10);
        return !isNaN(size) && size > 0;
      }
    }
  ];

  // Staging-specific configurations
  if (process.env.NODE_ENV === 'staging') {
    requiredConfigs.push(
      {
        name: 'ENABLE_UAT_DASHBOARD',
        value: process.env.ENABLE_UAT_DASHBOARD,
        required: false,
        description: 'Enable UAT testing dashboard'
      },
      {
        name: 'STAGING_BANNER',
        value: process.env.STAGING_BANNER,
        required: false,
        description: 'Staging environment banner text'
      },
      {
        name: 'BASIC_AUTH_USERNAME',
        value: process.env.BASIC_AUTH_USERNAME,
        required: false,
        description: 'Basic auth username for staging'
      },
      {
        name: 'BASIC_AUTH_PASSWORD',
        value: process.env.BASIC_AUTH_PASSWORD,
        required: false,
        description: 'Basic auth password for staging'
      }
    );
  }

  // Production-specific configurations
  if (process.env.NODE_ENV === 'production') {
    requiredConfigs.push(
      {
        name: 'REDIS_URL',
        value: process.env.REDIS_URL,
        required: false,
        description: 'Redis connection string for session storage'
      },
      {
        name: 'SENTRY_DSN',
        value: process.env.SENTRY_DSN,
        required: false,
        description: 'Sentry error tracking DSN'
      }
    );
  }

  // Validate each configuration
  for (const config of requiredConfigs) {
    if (config.required && !config.value) {
      result.errors.push(`Missing required configuration: ${config.name} - ${config.description}`);
      result.isValid = false;
    } else if (config.value && config.validator && !config.validator(config.value)) {
      result.errors.push(`Invalid configuration: ${config.name} - ${config.description}`);
      result.isValid = false;
    } else if (!config.required && !config.value) {
      result.warnings.push(`Optional configuration not set: ${config.name} - ${config.description}`);
    }
  }

  // Validate database connection
  const dbValidation = await validateDatabaseConnection();
  if (!dbValidation.isValid) {
    result.errors.push(...dbValidation.errors);
    result.isValid = false;
  }

  // Validate JWT secret
  const jwtValidation = validateJWTSecret();
  if (!jwtValidation.isValid) {
    result.errors.push(...jwtValidation.errors);
    result.isValid = false;
  }

  // Log validation results
  if (result.isValid) {
    console.log('✅ Configuration validation passed');
    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
  } else {
    console.error('❌ Configuration validation failed');
    result.errors.forEach(error => console.error(`   - ${error}`));
  }

  return result;
}

/**
 * Validates database connection
 */
async function validateDatabaseConnection(): Promise<{ isValid: boolean; errors: string[] }> {
  const result: { isValid: boolean; errors: string[] } = { isValid: true, errors: [] };

  if (!process.env.DATABASE_URL) {
    result.errors.push('DATABASE_URL is not configured');
    result.isValid = false;
    return result;
  }

  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });

    await client.connect();
    
    // Test basic query
    const testResult = await client.query('SELECT NOW() as current_time');
    if (!testResult.rows[0].current_time) {
      throw new Error('Database query test failed');
    }

    // Check if required tables exist
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('tenants', 'users', 'courses', 'registrations', 'xapi_statements')
    `;
    
    const tableResult = await client.query(tableCheckQuery);
    const existingTables = tableResult.rows.map(row => row.table_name);
    
    const requiredTables = ['tenants', 'users', 'courses', 'registrations', 'xapi_statements'];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      result.errors.push(`Missing database tables: ${missingTables.join(', ')}`);
      result.isValid = false;
    }

    await client.end();
    
    console.log('✅ Database connection validated successfully');
  } catch (error) {
    result.errors.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.isValid = false;
    console.error('❌ Database connection validation failed:', error);
  }

  return result;
}

/**
 * Validates JWT secret configuration
 */
function validateJWTSecret(): { isValid: boolean; errors: string[] } {
  const result: { isValid: boolean; errors: string[] } = { isValid: true, errors: [] };

  if (!process.env.JWT_SECRET) {
    result.errors.push('JWT_SECRET is not configured');
    result.isValid = false;
    return result;
  }

  const secret = process.env.JWT_SECRET;

  // Check minimum length
  if (secret.length < 32) {
    result.errors.push('JWT_SECRET must be at least 32 characters long');
    result.isValid = false;
  }

  // Test JWT functionality
  try {
    const testPayload = { test: 'validation', exp: Math.floor(Date.now() / 1000) + 60 };
    const token = jwt.sign(testPayload, secret);
    const decoded = jwt.verify(token, secret) as any;
    
    if (decoded.test !== 'validation') {
      throw new Error('JWT verification failed');
    }
    
    console.log('✅ JWT secret validated successfully');
  } catch (error) {
    result.errors.push(`JWT secret validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.isValid = false;
  }

  return result;
}

/**
 * Validates configuration on startup and exits if critical errors are found
 */
export async function validateConfigOnStartup(): Promise<void> {
  console.log('🚀 Starting Rustici Killer API Gateway...');
  
  const validation = await validateConfig();
  
  if (!validation.isValid) {
    console.error('💥 FATAL: Configuration validation failed. Cannot start application.');
    console.error('Please fix the following issues:');
    validation.errors.forEach(error => console.error(`   ❌ ${error}`));
    process.exit(1);
  }

  console.log(`✅ Configuration validation passed for ${validation.environment} environment`);
  
  if (validation.warnings.length > 0) {
    console.log('⚠️  Configuration warnings:');
    validation.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
}

/**
 * Get configuration status for health checks
 */
export function getConfigStatus(): {
  environment: string;
  timestamp: string;
  database: boolean;
  jwt: boolean;
  features: {
    uatDashboard: boolean;
    stagingBanner: boolean;
    basicAuth: boolean;
  };
} {
  return {
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    database: !!process.env.DATABASE_URL,
    jwt: !!process.env.JWT_SECRET,
    features: {
      uatDashboard: process.env.ENABLE_UAT_DASHBOARD === 'true',
      stagingBanner: !!process.env.STAGING_BANNER,
      basicAuth: !!(process.env.BASIC_AUTH_USERNAME && process.env.BASIC_AUTH_PASSWORD)
    }
  };
}
