/**
 * Token Helper Utilities
 * 
 * PHASE 1.5 CLEANUP: Centralized token generation and management
 * 
 * WHY: Eliminates redundant token generation logic across endpoints
 * IMPACT: Single source of truth for all token-related operations
 * 
 * Based on Gemini's recommendation to:
 * - Centralize JWT signing logic
 * - Implement consistent token expiration
 * - Prepare for future JWT blacklist implementation
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_DISPATCH_SECRET = process.env.JWT_DISPATCH_SECRET || 'your-super-secret-dispatch-jwt-key-change-in-production';

// Token payload interfaces
export interface AuthTokenPayload {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface DispatchTokenPayload {
  dispatchId: string;
  userId: string;
  tenantId: string;
  jti: string; // JWT ID for blacklist capability
  iat?: number;
  exp?: number;
}

/**
 * Generate authentication token for user login
 * Used by: /auth/login, /auth/register
 */
export function generateAuthToken(payload: Omit<AuthTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '24h',
    issuer: 'sun-scorm-platform',
    audience: 'sun-scorm-web'
  });
}

/**
 * Generate dispatch launch token for secure content access
 * Used by: /dispatch/:id/launch
 * 
 * Features:
 * - Short-lived (2 hours) for security
 * - Includes jti for blacklist capability
 * - Dedicated secret for dispatch tokens
 */
export function generateDispatchToken(payload: Omit<DispatchTokenPayload, 'jti' | 'iat' | 'exp'>): string {
  const tokenPayload: DispatchTokenPayload = {
    ...payload,
    jti: uuidv4() // Unique JWT ID for blacklist tracking
  };

  return jwt.sign(tokenPayload, JWT_DISPATCH_SECRET, { 
    expiresIn: '2h', // Short-lived for content access
    issuer: 'sun-scorm-platform',
    audience: 'sun-scorm-content'
  });
}

/**
 * Generate simple launch token (UUID-based)
 * Used by: /dispatch/:id/launch (current implementation)
 * 
 * NOTE: This is the current UUID-based system
 * Future versions will migrate to JWT-based tokens
 */
export function generateLaunchToken(): string {
  return uuidv4();
}

/**
 * Verify authentication token
 * Used by: requireAuth middleware
 */
export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

/**
 * Verify dispatch token
 * Used by: future dispatch runtime endpoints
 */
export function verifyDispatchToken(token: string): DispatchTokenPayload {
  return jwt.verify(token, JWT_DISPATCH_SECRET) as DispatchTokenPayload;
}

/**
 * Token blacklist utilities
 * 
 * Future implementation for:
 * - Immediate token revocation
 * - License breach response
 * - User access revocation
 */
export interface TokenBlacklistService {
  addToBlacklist(jti: string, exp: number): Promise<void>;
  isBlacklisted(jti: string): Promise<boolean>;
  pruneExpired(): Promise<void>;
}

/**
 * Placeholder for future Redis-based blacklist implementation
 * As recommended by Gemini's competitive analysis
 */
export class InMemoryTokenBlacklist implements TokenBlacklistService {
  private blacklist = new Map<string, number>();

  async addToBlacklist(jti: string, exp: number): Promise<void> {
    this.blacklist.set(jti, exp);
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return this.blacklist.has(jti);
  }

  async pruneExpired(): Promise<void> {
    const now = Date.now() / 1000;
    for (const [jti, exp] of this.blacklist.entries()) {
      if (exp < now) {
        this.blacklist.delete(jti);
      }
    }
  }
}

// Export singleton instance
export const tokenBlacklist = new InMemoryTokenBlacklist();
