/**
 * Authentication Routes
 * Handles login, logout, profile, and token refresh
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken, authenticate, getUser, getCompanyId } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token with company_id
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const db = req.app.locals.db;
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
      return;
    }

    // Find user by email (case-insensitive)
    const user = await db('users')
      .whereRaw('LOWER(email) = LOWER(?)', [email])
      .where('active', true)
      .first();

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Check company is active
    const company = await db('companies')
      .where('id', user.company_id)
      .where('active', true)
      .first();

    if (!company) {
      res.status(403).json({ 
        success: false, 
        error: 'Your company account is inactive. Please contact support.' 
      });
      return;
    }

    // Generate JWT with company_id
    const token = generateToken({
      userId: user.id,
      companyId: user.company_id,  // CRITICAL: company_id in token
      email: user.email,
      role: user.role,
      shopId: user.shop_id
    });

    // Update last login timestamp
    await db('users')
      .where('id', user.id)
      .update({ last_login_at: new Date() });

    // Log audit event
    console.log(`[AUTH] Login success: ${user.email} (company: ${user.company_id})`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          company_id: user.company_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          shop_id: user.shop_id
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /api/auth/logout
 * Log out user (audit trail)
 */
router.post('/logout', authenticate, (req: Request, res: Response) => {
  const user = getUser(req);
  console.log(`[AUTH] Logout: ${user.email} (company: ${user.companyId})`);
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const db = req.app.locals.db;

    const fullUser = await db('users')
      .select(
        'users.id',
        'users.company_id',
        'users.email',
        'users.first_name',
        'users.last_name',
        'users.role',
        'users.shop_id',
        'users.last_login_at',
        'users.created_at',
        'companies.name as company_name',
        'shops.name as shop_name'
      )
      .leftJoin('companies', 'users.company_id', 'companies.id')
      .leftJoin('shops', 'users.shop_id', 'shops.id')
      .where('users.id', user.userId)
      .first();

    if (!fullUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: fullUser.id,
        company_id: fullUser.company_id,
        company_name: fullUser.company_name,
        email: fullUser.email,
        first_name: fullUser.first_name,
        last_name: fullUser.last_name,
        role: fullUser.role,
        shop_id: fullUser.shop_id,
        shop_name: fullUser.shop_name,
        last_login_at: fullUser.last_login_at,
        created_at: fullUser.created_at
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/auth/password
 * Change user password
 */
router.put('/password', authenticate, async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const db = req.app.locals.db;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      res.status(400).json({ 
        success: false, 
        error: 'Current password and new password are required' 
      });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 8 characters' 
      });
      return;
    }

    // Get current user with password hash
    const dbUser = await db('users')
      .where('id', user.userId)
      .first();

    if (!dbUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(current_password, dbUser.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    // Hash and update new password
    const newHash = await bcrypt.hash(new_password, 10);
    await db('users')
      .where('id', user.userId)
      .update({ 
        password_hash: newHash,
        updated_at: new Date()
      });

    console.log(`[AUTH] Password changed: ${user.email}`);

    res.json({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticate, async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const db = req.app.locals.db;

    // Verify user still exists and is active
    const dbUser = await db('users')
      .where('id', user.userId)
      .where('active', true)
      .first();

    if (!dbUser) {
      res.status(401).json({ success: false, error: 'User account inactive' });
      return;
    }

    // Verify company still active
    const company = await db('companies')
      .where('id', user.companyId)
      .where('active', true)
      .first();

    if (!company) {
      res.status(401).json({ success: false, error: 'Company account inactive' });
      return;
    }

    // Generate new token
    const token = generateToken({
      userId: dbUser.id,
      companyId: dbUser.company_id,
      email: dbUser.email,
      role: dbUser.role,
      shopId: dbUser.shop_id
    });

    res.json({
      success: true,
      data: { token }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});

export default router;
