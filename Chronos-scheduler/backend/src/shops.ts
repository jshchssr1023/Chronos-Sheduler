/**
 * Shops API Routes - Multi-Tenant Enforced
 * 
 * CRITICAL: All queries MUST filter by company_id from JWT token
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  authenticate, 
  requireCompanyId, 
  requireAdmin, 
  auditLog, 
  getCompanyId 
} from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireCompanyId);

// Default shop capabilities
const DEFAULT_CAPABILITIES = {
  welding: false,
  painting: false,
  wheel_work: false,
  tank_interior: false,
  structural_repair: false,
  regulatory_inspection: false,
  lining: false,
  valve_repair: false,
  cleaning: false,
  stenciling: false
};

/**
 * GET /api/shops
 * List all shops for the authenticated user's company
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);  // CRITICAL: From JWT
    const db = req.app.locals.db;

    const { 
      ownership, 
      shop_type, 
      region,
      active,
      has_capacity,
      capability
    } = req.query;

    // Build query with MANDATORY company_id filter
    let query = db('shops')
      .where('company_id', companyId);  // CRITICAL: Filter by company

    // Filter by active status (default: only active)
    if (active === 'false') {
      query = query.where('active', false);
    } else if (active !== 'all') {
      query = query.where('active', true);
    }

    if (ownership) query = query.where('ownership', ownership);
    if (shop_type) query = query.where('shop_type', shop_type);
    if (region) query = query.where('region', region);

    // Filter by capability (JSONB query)
    if (capability) {
      query = query.whereRaw(`capabilities->>'${capability}' = 'true'`);
    }

    const shops = await query.orderBy('name', 'asc');

    // Get active car counts per shop
    const activeCars = await db('cars')
      .select('assigned_shop_id')
      .count('* as count')
      .where('company_id', companyId)
      .whereNotNull('assigned_shop_id')
      .whereIn('status', ['scheduled', 'in_progress'])
      .groupBy('assigned_shop_id');

    const carCountMap: Record<string, number> = {};
    activeCars.forEach((row: any) => {
      carCountMap[row.assigned_shop_id] = parseInt(row.count);
    });

    // Calculate utilization for each shop
    const result = shops.map((shop: any) => {
      const activeCarsCount = carCountMap[shop.id] || 0;
      const capacity = shop.weekly_capacity || shop.capacity || 10;
      const utilization = capacity > 0 ? (activeCarsCount / capacity) * 100 : 0;

      return {
        ...shop,
        capabilities: typeof shop.capabilities === 'string' 
          ? JSON.parse(shop.capabilities) 
          : shop.capabilities,
        railroad_access: typeof shop.railroad_access === 'string'
          ? JSON.parse(shop.railroad_access)
          : shop.railroad_access,
        preferred_commodities: typeof shop.preferred_commodities === 'string'
          ? JSON.parse(shop.preferred_commodities)
          : shop.preferred_commodities,
        active_cars: activeCarsCount,
        utilization_percentage: Math.round(utilization * 10) / 10,
        available_capacity: Math.max(0, capacity - activeCarsCount)
      };
    });

    // Optional: filter by capacity availability
    const finalResult = has_capacity === 'true' 
      ? result.filter(s => s.available_capacity > 0)
      : result;

    res.json({ success: true, data: finalResult });

  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shops' });
  }
});

/**
 * GET /api/shops/stats/summary
 * Get shop statistics for dashboard
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    // Total shops
    const total = await db('shops')
      .where('company_id', companyId)
      .where('active', true)
      .count('* as count')
      .first();

    // By ownership
    const byOwnership = await db('shops')
      .select('ownership')
      .count('* as count')
      .where('company_id', companyId)
      .where('active', true)
      .groupBy('ownership');

    // By shop type
    const byType = await db('shops')
      .select('shop_type')
      .count('* as count')
      .where('company_id', companyId)
      .where('active', true)
      .groupBy('shop_type');

    // Total capacity
    const capacitySum = await db('shops')
      .where('company_id', companyId)
      .where('active', true)
      .sum('weekly_capacity as total')
      .first();

    // Current load
    const currentLoad = await db('cars')
      .where('company_id', companyId)
      .whereNotNull('assigned_shop_id')
      .whereIn('status', ['scheduled', 'in_progress'])
      .count('* as count')
      .first();

    const totalCapacity = parseFloat((capacitySum as any)?.total || '0');
    const load = parseInt((currentLoad as any)?.count || '0');

    res.json({
      success: true,
      data: {
        total: parseInt((total as any)?.count || '0'),
        active: parseInt((total as any)?.count || '0'),
        by_ownership: Object.fromEntries(
          byOwnership.map((r: any) => [r.ownership, parseInt(r.count)])
        ),
        by_type: Object.fromEntries(
          byType.map((r: any) => [r.shop_type || 'Unknown', parseInt(r.count)])
        ),
        total_capacity: totalCapacity,
        current_load: load,
        overall_utilization: totalCapacity > 0 
          ? Math.round((load / totalCapacity) * 1000) / 10 
          : 0
      }
    });

  } catch (error) {
    console.error('Error fetching shop stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/shops/stats/utilization
 * Get detailed utilization for all shops
 */
router.get('/stats/utilization', async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    const shops = await db('shops')
      .where('company_id', companyId)
      .where('active', true)
      .select('id', 'name', 'location', 'ownership', 'weekly_capacity', 'capacity');

    const activeCars = await db('cars')
      .select('assigned_shop_id')
      .count('* as count')
      .where('company_id', companyId)
      .whereNotNull('assigned_shop_id')
      .whereIn('status', ['scheduled', 'in_progress'])
      .groupBy('assigned_shop_id');

    const carCountMap: Record<string, number> = {};
    activeCars.forEach((row: any) => {
      carCountMap[row.assigned_shop_id] = parseInt(row.count);
    });

    const utilization = shops.map((shop: any) => {
      const active = carCountMap[shop.id] || 0;
      const capacity = shop.weekly_capacity || shop.capacity || 10;
      const percentage = capacity > 0 ? (active / capacity) * 100 : 0;

      return {
        shop_id: shop.id,
        shop_name: shop.name,
        location: shop.location,
        ownership: shop.ownership,
        capacity,
        active_cars: active,
        available: Math.max(0, capacity - active),
        utilization_percentage: Math.round(percentage * 10) / 10
      };
    });

    // Sort by utilization descending
    utilization.sort((a, b) => b.utilization_percentage - a.utilization_percentage);

    res.json({ success: true, data: utilization });

  } catch (error) {
    console.error('Error fetching utilization:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch utilization' });
  }
});

/**
 * GET /api/shops/:id
 * Get single shop by ID (must belong to user's company)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    const shop = await db('shops')
      .where('id', req.params.id)
      .where('company_id', companyId)  // CRITICAL: Company filter
      .first();

    if (!shop) {
      res.status(404).json({ success: false, error: 'Shop not found' });
      return;
    }

    // Get active cars at this shop
    const activeCars = await db('cars')
      .where('assigned_shop_id', shop.id)
      .where('company_id', companyId)
      .whereIn('status', ['scheduled', 'in_progress'])
      .select('id', 'car_mark', 'priority', 'status', 'start_date', 'end_date');

    res.json({ 
      success: true, 
      data: {
        ...shop,
        capabilities: typeof shop.capabilities === 'string' 
          ? JSON.parse(shop.capabilities) 
          : shop.capabilities,
        active_cars: activeCars,
        active_car_count: activeCars.length
      }
    });

  } catch (error) {
    console.error('Error fetching shop:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shop' });
  }
});

/**
 * GET /api/shops/:id/cars
 * Get all cars at a shop
 */
router.get('/:id/cars', async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    // Verify shop belongs to company
    const shop = await db('shops')
      .where('id', req.params.id)
      .where('company_id', companyId)
      .first();

    if (!shop) {
      res.status(404).json({ success: false, error: 'Shop not found' });
      return;
    }

    const cars = await db('cars')
      .where('assigned_shop_id', req.params.id)
      .where('company_id', companyId)
      .orderBy('priority', 'asc')
      .orderBy('start_date', 'asc');

    res.json({ success: true, data: cars });

  } catch (error) {
    console.error('Error fetching shop cars:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cars' });
  }
});

/**
 * POST /api/shops
 * Create new shop (admin role required)
 */
router.post('/', requireAdmin, auditLog('shop'), async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);  // CRITICAL: From JWT
    const db = req.app.locals.db;
    const body = req.body;

    // Validate required fields
    if (!body.name || !body.location || !body.ownership) {
      res.status(400).json({ 
        success: false, 
        error: 'name, location, and ownership are required' 
      });
      return;
    }

    // Validate ownership enum
    if (!['AITX-Owned', 'Third-Party'].includes(body.ownership)) {
      res.status(400).json({ 
        success: false, 
        error: 'ownership must be "AITX-Owned" or "Third-Party"' 
      });
      return;
    }

    // Check for duplicate name within company
    const existing = await db('shops')
      .where('company_id', companyId)
      .whereILike('name', body.name)
      .where('active', true)
      .first();

    if (existing) {
      res.status(409).json({ 
        success: false, 
        error: `Shop with name "${body.name}" already exists` 
      });
      return;
    }

    // Build shop record - company_id from JWT, NOT from body
    const weeklyCapacity = body.weekly_capacity || body.capacity || 10;
    
    const newShop = {
      id: uuidv4(),
      company_id: companyId,  // CRITICAL: From JWT
      name: body.name,
      location: body.location,
      ownership: body.ownership,
      shop_type: body.shop_type || 'Contracted',
      type: body.ownership,  // Legacy field compatibility
      capacity: weeklyCapacity,
      weekly_capacity: weeklyCapacity,
      monthly_capacity: body.monthly_capacity || weeklyCapacity * 4,
      annual_target: body.annual_target || weeklyCapacity * 52,
      capabilities: JSON.stringify({ 
        ...DEFAULT_CAPABILITIES, 
        ...(body.capabilities || {}) 
      }),
      cost_index: body.cost_index || 1.0,
      booking_lead_time_days: body.booking_lead_time_days || 14,
      contact_name: body.contact_name || null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      quality_rating: body.quality_rating || null,
      avg_turnaround_days: body.avg_turnaround_days || null,
      region: body.region || null,
      railroad_access: JSON.stringify(body.railroad_access || []),
      preferred_commodities: JSON.stringify(body.preferred_commodities || []),
      active: true,
      metadata: JSON.stringify(body.metadata || {})
    };

    const [shop] = await db('shops').insert(newShop).returning('*');

    res.status(201).json({ 
      success: true, 
      data: {
        ...shop,
        capabilities: JSON.parse(shop.capabilities),
        railroad_access: JSON.parse(shop.railroad_access),
        preferred_commodities: JSON.parse(shop.preferred_commodities)
      }
    });

  } catch (error) {
    console.error('Error creating shop:', error);
    res.status(500).json({ success: false, error: 'Failed to create shop' });
  }
});

/**
 * PATCH /api/shops/:id
 * Update shop (admin role required)
 */
router.patch('/:id', requireAdmin, auditLog('shop'), async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    // Verify shop exists and belongs to company
    const existing = await db('shops')
      .where('id', req.params.id)
      .where('company_id', companyId)  // CRITICAL: Company filter
      .first();

    if (!existing) {
      res.status(404).json({ success: false, error: 'Shop not found' });
      return;
    }

    // Check name uniqueness if being changed
    if (req.body.name && req.body.name !== existing.name) {
      const duplicate = await db('shops')
        .where('company_id', companyId)
        .whereILike('name', req.body.name)
        .whereNot('id', req.params.id)
        .where('active', true)
        .first();

      if (duplicate) {
        res.status(409).json({ 
          success: false, 
          error: `Shop with name "${req.body.name}" already exists` 
        });
        return;
      }
    }

    // Build updates - NEVER allow company_id change
    const updates = { ...req.body, updated_at: new Date() };
    delete updates.id;
    delete updates.company_id;  // CRITICAL: Never update company_id

    // Handle JSONB fields
    if (updates.capabilities) {
      const existingCaps = typeof existing.capabilities === 'string'
        ? JSON.parse(existing.capabilities)
        : existing.capabilities;
      updates.capabilities = JSON.stringify({ 
        ...existingCaps, 
        ...updates.capabilities 
      });
    }
    if (updates.railroad_access) {
      updates.railroad_access = JSON.stringify(updates.railroad_access);
    }
    if (updates.preferred_commodities) {
      updates.preferred_commodities = JSON.stringify(updates.preferred_commodities);
    }

    const [shop] = await db('shops')
      .where('id', req.params.id)
      .where('company_id', companyId)
      .update(updates)
      .returning('*');

    res.json({ 
      success: true, 
      data: {
        ...shop,
        capabilities: typeof shop.capabilities === 'string'
          ? JSON.parse(shop.capabilities)
          : shop.capabilities
      }
    });

  } catch (error) {
    console.error('Error updating shop:', error);
    res.status(500).json({ success: false, error: 'Failed to update shop' });
  }
});

/**
 * DELETE /api/shops/:id
 * Delete shop (soft delete - deactivate)
 */
router.delete('/:id', requireAdmin, auditLog('shop'), async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;
    const hardDelete = req.query.hard === 'true';

    // Verify shop exists and belongs to company
    const shop = await db('shops')
      .where('id', req.params.id)
      .where('company_id', companyId)
      .first();

    if (!shop) {
      res.status(404).json({ success: false, error: 'Shop not found' });
      return;
    }

    // Check for assigned cars
    const assignedCars = await db('cars')
      .where('assigned_shop_id', req.params.id)
      .whereIn('status', ['scheduled', 'in_progress'])
      .count('* as count')
      .first();

    if (parseInt((assignedCars as any).count) > 0) {
      res.status(400).json({ 
        success: false, 
        error: `Cannot delete shop with ${(assignedCars as any).count} assigned cars. Unassign cars first.` 
      });
      return;
    }

    if (hardDelete) {
      // Hard delete
      await db('assignments').where('shop_id', req.params.id).del();
      await db('shops')
        .where('id', req.params.id)
        .where('company_id', companyId)
        .del();

      res.json({ success: true, message: 'Shop permanently deleted' });
    } else {
      // Soft delete - deactivate
      await db('shops')
        .where('id', req.params.id)
        .where('company_id', companyId)
        .update({ 
          active: false, 
          updated_at: new Date() 
        });

      res.json({ success: true, message: 'Shop deactivated' });
    }

  } catch (error) {
    console.error('Error deleting shop:', error);
    res.status(500).json({ success: false, error: 'Failed to delete shop' });
  }
});

export default router;
