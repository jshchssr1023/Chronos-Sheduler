/**
 * Authentication Middleware with Multi-Tenant Enforcement
 * 
 * CRITICAL SECURITY RULES:
 * 1. company_id MUST come from JWT token, NEVER from request body/params
 * 2. All database queries MUST filter by company_id from token
 * 3. Never trust user input for tenant identification
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export type UserRole = 'super_admin' | 'company_admin' | 'scheduler' | 'shop_manager' | 'viewer';

export interface JWTPayload {
  userId: string;
  companyId: string;
  email: string;
  role: UserRole;
  shopId?: string | null;
  iat?: number;
  exp?: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      companyId?: string;
    }
  }
}

/**
 * Generate a JWT token with user and company information
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/**
 * Main authentication middleware
 * Extracts user info from JWT and sets req.user and req.companyId
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ success: false, error: 'Authorization header missing' });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({ success: false, error: 'Invalid authorization format. Use: Bearer <token>' });
      return;
    }

    const token = parts[1];
    const decoded = verifyToken(token);

    // Validate required fields in token
    if (!decoded.userId || !decoded.companyId || !decoded.email || !decoded.role) {
      res.status(401).json({ success: false, error: 'Invalid token payload' });
      return;
    }

    // Set user and companyId on request
    req.user = decoded;
    req.companyId = decoded.companyId; // CRITICAL: This is the ONLY source of company_id
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

/**
 * Optional authentication - doesn't fail if no token present
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const decoded = verifyToken(parts[1]);
      req.user = decoded;
      req.companyId = decoded.companyId;
    }
    
    next();
  } catch {
    // Token invalid but optional, continue without auth
    next();
  }
}

/**
 * Role-based access control middleware factory
 */
export function requireRoles(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
      });
      return;
    }

    next();
  };
}

// Pre-configured role middlewares
export const requireAdmin = requireRoles(['super_admin', 'company_admin']);
export const requireScheduler = requireRoles(['super_admin', 'company_admin', 'scheduler']);
export const requireShopAccess = requireRoles(['super_admin', 'company_admin', 'scheduler', 'shop_manager']);

/**
 * Restrict shop managers to their own shop
 */
export function restrictToOwnShop(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // Admins and schedulers can access all shops
  if (['super_admin', 'company_admin', 'scheduler'].includes(req.user.role)) {
    next();
    return;
  }

  // Shop managers can only access their assigned shop
  if (req.user.role === 'shop_manager') {
    const shopId = req.params.shopId || req.params.id;
    if (shopId && req.user.shopId && shopId !== req.user.shopId) {
      res.status(403).json({ success: false, error: 'Access denied to this shop' });
      return;
    }
  }

  next();
}

/**
 * Ensure company_id is present (use after authenticate)
 */
export function requireCompanyId(req: Request, res: Response, next: NextFunction): void {
  if (!req.companyId) {
    res.status(400).json({ 
      success: false, 
      error: 'Company context required. Please re-authenticate.' 
    });
    return;
  }
  next();
}

/**
 * Helper to get company ID from request (throws if not present)
 */
export function getCompanyId(req: Request): string {
  if (!req.companyId) {
    throw new Error('Company ID not found in request. Ensure authenticate middleware is applied.');
  }
  return req.companyId;
}

/**
 * Helper to get user from request (throws if not present)
 */
export function getUser(req: Request): JWTPayload {
  if (!req.user) {
    throw new Error('User not found in request. Ensure authenticate middleware is applied.');
  }
  return req.user;
}

/**
 * Simple rate limiting per company
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 1000; // requests per minute
const RATE_WINDOW = 60000; // 1 minute in ms

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  if (!req.companyId) {
    next();
    return;
  }

  const now = Date.now();
  const key = req.companyId;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    next();
    return;
  }

  if (record.count >= RATE_LIMIT) {
    res.status(429).json({ 
      success: false, 
      error: 'Rate limit exceeded. Please try again later.' 
    });
    return;
  }

  record.count++;
  next();
}

/**
 * Audit logging middleware factory
 */
export function auditLog(resourceType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);
    
    res.json = (body: unknown) => {
      // Log after response is sent
      if (req.user && req.companyId) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          userId: req.user.userId,
          companyId: req.companyId,
          email: req.user.email,
          method: req.method,
          path: req.path,
          resourceType,
          resourceId: req.params.id || null,
          success: (body as any)?.success || false
        };
        
        // In production, send to audit log service/database
        console.log('[AUDIT]', JSON.stringify(logEntry));
      }
      
      return originalJson(body);
    };
    
    next();
  };
}

// Middleware chains for common patterns
export const protectedRoute = [authenticate, requireCompanyId];
export const adminRoute = [authenticate, requireCompanyId, requireAdmin];
export const schedulerRoute = [authenticate, requireCompanyId, requireScheduler];
