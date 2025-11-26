/**
 * Cars API Routes - Multi-Tenant Enforced
 * 
 * CRITICAL: All queries MUST filter by company_id from JWT token
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  authenticate, 
  requireCompanyId, 
  requireScheduler, 
  auditLog, 
  getCompanyId, 
  getUser 
} from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireCompanyId);

/**
 * GET /api/cars
 * List all cars for the authenticated user's company
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);  // CRITICAL: From JWT, not request
    const db = req.app.locals.db;

    const { 
      status, 
      priority, 
      demand_type, 
      commodity,
      assigned_shop_id,
      search, 
      archived,
      date_from,
      date_to,
      limit = '50',
      offset = '0',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Build query with MANDATORY company_id filter
    let query = db('cars')
      .where('cars.company_id', companyId);  // CRITICAL: Filter by company

    // Apply filters
    if (archived === 'true') {
      query = query.where('cars.archived', true);
    } else if (archived !== 'all') {
      query = query.where('cars.archived', false);
    }

    if (status) query = query.where('cars.status', status);
    if (priority) query = query.where('cars.priority', priority);
    if (demand_type) query = query.where('cars.demand_type', demand_type);
    if (commodity) query = query.where('cars.commodity', commodity);
    if (assigned_shop_id) query = query.where('cars.assigned_shop_id', assigned_shop_id);

    if (search) {
      query = query.where((builder: any) => {
        builder
          .whereILike('cars.car_mark', `%${search}%`)
          .orWhereILike('cars.customer', `%${search}%`)
          .orWhereILike('cars.owner', `%${search}%`);
      });
    }

    if (date_from) {
      query = query.where('cars.qual_date', '>=', date_from);
    }
    if (date_to) {
      query = query.where('cars.qual_date', '<=', date_to);
    }

    // Get total count for pagination
    const countResult = await query.clone().count('* as total').first();
    const total = parseInt((countResult as any)?.total || '0');

    // Apply sorting and pagination
    const validSortColumns = ['created_at', 'car_mark', 'priority', 'status', 'qual_date', 'demand_type'];
    const sortColumn = validSortColumns.includes(sort_by as string) ? sort_by : 'created_at';
    const sortDir = sort_order === 'asc' ? 'asc' : 'desc';

    const cars = await query
      .select(
        'cars.*',
        'shops.name as shop_name',
        'shops.location as shop_location',
        'shops.ownership as shop_ownership'
      )
      .leftJoin('shops', 'cars.assigned_shop_id', 'shops.id')
      .orderBy(`cars.${sortColumn}`, sortDir)
      .limit(Math.min(parseInt(limit as string) || 50, 100))
      .offset(parseInt(offset as string) || 0);

    // Format response
    const result = cars.map((car: any) => ({
      ...car,
      shop: car.assigned_shop_id ? {
        id: car.assigned_shop_id,
        name: car.shop_name,
        location: car.shop_location,
        ownership: car.shop_ownership
      } : undefined,
      // Remove joined columns from root
      shop_name: undefined,
      shop_location: undefined,
      shop_ownership: undefined
    }));

    res.json({ 
      success: true, 
      data: result,
      pagination: {
        total,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0
      }
    });

  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cars' });
  }
});

/**
 * GET /api/cars/stats/summary
 * Get car statistics for dashboard
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    // Status counts
    const statusCounts = await db('cars')
      .select('status')
      .count('* as count')
      .where('company_id', companyId)
      .where('archived', false)
      .groupBy('status');

    // Priority counts
    const priorityCounts = await db('cars')
      .select('priority')
      .count('* as count')
      .where('company_id', companyId)
      .where('archived', false)
      .groupBy('priority');

    // Demand type counts
    const demandTypeCounts = await db('cars')
      .select('demand_type')
      .count('* as count')
      .where('company_id', companyId)
      .where('archived', false)
      .groupBy('demand_type');

    res.json({
      success: true,
      data: {
        by_status: Object.fromEntries(statusCounts.map((r: any) => [r.status, parseInt(r.count)])),
        by_priority: Object.fromEntries(priorityCounts.map((r: any) => [r.priority, parseInt(r.count)])),
        by_demand_type: Object.fromEntries(demandTypeCounts.map((r: any) => [r.demand_type, parseInt(r.count)]))
      }
    });

  } catch (error) {
    console.error('Error fetching car stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/cars/:id
 * Get single car by ID (must belong to user's company)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    const car = await db('cars')
      .select(
        'cars.*',
        'shops.name as shop_name',
        'shops.location as shop_location'
      )
      .leftJoin('shops', 'cars.assigned_shop_id', 'shops.id')
      .where('cars.id', req.params.id)
      .where('cars.company_id', companyId)  // CRITICAL: Company filter
      .first();

    if (!car) {
      res.status(404).json({ success: false, error: 'Car not found' });
      return;
    }

    res.json({ 
      success: true, 
      data: {
        ...car,
        shop: car.assigned_shop_id ? {
          id: car.assigned_shop_id,
          name: car.shop_name,
          location: car.shop_location
        } : undefined
      }
    });

  } catch (error) {
    console.error('Error fetching car:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch car' });
  }
});

/**
 * POST /api/cars
 * Create new car (scheduler+ role required)
 */
router.post('/', requireScheduler, auditLog('car'), async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);  // CRITICAL: From JWT
    const db = req.app.locals.db;
    const body = req.body;

    // Validate required fields
    if (!body.car_mark) {
      res.status(400).json({ success: false, error: 'car_mark is required' });
      return;
    }

    // Check for duplicate car_mark within company
    const existing = await db('cars')
      .where('company_id', companyId)
      .where('car_mark', body.car_mark)
      .where('archived', false)
      .first();

    if (existing) {
      res.status(409).json({ 
        success: false, 
        error: `Car with mark "${body.car_mark}" already exists` 
      });
      return;
    }

    // Build car record - company_id from JWT, NOT from body
    const newCar = {
      id: uuidv4(),
      company_id: companyId,  // CRITICAL: From JWT, ignore body.company_id
      car_mark: body.car_mark,
      car_type: body.car_type || null,
      level2_car_type: body.level2_car_type || null,
      commodity: body.commodity || null,
      demand_type: body.demand_type || 'Maintenance Cycle',
      qual_date: body.qual_date || null,
      lease_expiry_date: body.lease_expiry_date || null,
      regulatory_cycle_years: body.regulatory_cycle_years || null,
      estimated_duration_days: body.estimated_duration_days || 14,
      target_cost_per_car: body.target_cost_per_car || null,
      customer: body.customer || null,
      owner: body.owner || null,
      fleet_id: body.fleet_id || null,
      priority: body.priority || 'Medium',
      work_scope: body.work_scope || null,
      status: 'unscheduled',
      archived: false,
      notes: JSON.stringify(body.notes || []),
      metadata: JSON.stringify(body.metadata || {})
    };

    const [car] = await db('cars').insert(newCar).returning('*');

    res.status(201).json({ success: true, data: car });

  } catch (error) {
    console.error('Error creating car:', error);
    res.status(500).json({ success: false, error: 'Failed to create car' });
  }
});

/**
 * PATCH /api/cars/:id
 * Update car (scheduler+ role required)
 */
router.patch('/:id', requireScheduler, auditLog('car'), async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    // Verify car exists and belongs to company
    const existing = await db('cars')
      .where('id', req.params.id)
      .where('company_id', companyId)  // CRITICAL: Company filter
      .first();

    if (!existing) {
      res.status(404).json({ success: false, error: 'Car not found' });
      return;
    }

    // Check car_mark uniqueness if being changed
    if (req.body.car_mark && req.body.car_mark !== existing.car_mark) {
      const duplicate = await db('cars')
        .where('company_id', companyId)
        .where('car_mark', req.body.car_mark)
        .whereNot('id', req.params.id)
        .where('archived', false)
        .first();

      if (duplicate) {
        res.status(409).json({ 
          success: false, 
          error: `Car with mark "${req.body.car_mark}" already exists` 
        });
        return;
      }
    }

    // Build updates - NEVER allow company_id change
    const updates = { ...req.body, updated_at: new Date() };
    delete updates.id;
    delete updates.company_id;  // CRITICAL: Never update company_id

    // Handle status transitions
    if (updates.assigned_shop_id && existing.status === 'unscheduled') {
      updates.status = 'scheduled';
    }

    const [car] = await db('cars')
      .where('id', req.params.id)
      .where('company_id', companyId)
      .update(updates)
      .returning('*');

    res.json({ success: true, data: car });

  } catch (error) {
    console.error('Error updating car:', error);
    res.status(500).json({ success: false, error: 'Failed to update car' });
  }
});

/**
 * DELETE /api/cars/:id
 * Delete car (soft delete by default, hard delete with ?hard=true)
 */
router.delete('/:id', requireScheduler, auditLog('car'), async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;
    const hardDelete = req.query.hard === 'true';

    // Verify car exists and belongs to company
    const car = await db('cars')
      .where('id', req.params.id)
      .where('company_id', companyId)
      .first();

    if (!car) {
      res.status(404).json({ success: false, error: 'Car not found' });
      return;
    }

    if (hardDelete) {
      // Hard delete - remove from database
      await db('assignments').where('car_id', req.params.id).del();
      await db('cars')
        .where('id', req.params.id)
        .where('company_id', companyId)
        .del();

      res.json({ success: true, message: 'Car permanently deleted' });
    } else {
      // Soft delete - archive
      await db('cars')
        .where('id', req.params.id)
        .where('company_id', companyId)
        .update({ 
          archived: true, 
          assigned_shop_id: null,
          status: 'unscheduled',
          updated_at: new Date() 
        });

      res.json({ success: true, message: 'Car archived' });
    }

  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ success: false, error: 'Failed to delete car' });
  }
});

/**
 * POST /api/cars/:id/assign
 * Assign car to shop
 */
router.post('/:id/assign', requireScheduler, auditLog('assignment'), async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const user = getUser(req);
    const db = req.app.locals.db;
    const { shop_id, start_date, end_date } = req.body;

    if (!shop_id) {
      res.status(400).json({ success: false, error: 'shop_id is required' });
      return;
    }

    // Verify car exists and belongs to company
    const car = await db('cars')
      .where('id', req.params.id)
      .where('company_id', companyId)
      .first();

    if (!car) {
      res.status(404).json({ success: false, error: 'Car not found' });
      return;
    }

    // Verify shop exists and belongs to SAME company
    const shop = await db('shops')
      .where('id', shop_id)
      .where('company_id', companyId)  // CRITICAL: Same company check
      .where('active', true)
      .first();

    if (!shop) {
      res.status(404).json({ success: false, error: 'Shop not found' });
      return;
    }

    // Update car assignment
    await db('cars')
      .where('id', req.params.id)
      .update({
        assigned_shop_id: shop_id,
        start_date: start_date || null,
        end_date: end_date || null,
        status: 'scheduled',
        updated_at: new Date()
      });

    // Create assignment record
    await db('assignments').insert({
      id: uuidv4(),
      company_id: companyId,
      car_id: req.params.id,
      shop_id: shop_id,
      assigned_by: user.userId,
      start_date: start_date || null,
      end_date: end_date || null
    });

    res.json({ success: true, message: 'Car assigned to shop' });

  } catch (error) {
    console.error('Error assigning car:', error);
    res.status(500).json({ success: false, error: 'Failed to assign car' });
  }
});

/**
 * POST /api/cars/:id/unassign
 * Remove car from shop
 */
router.post('/:id/unassign', requireScheduler, auditLog('assignment'), async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    const db = req.app.locals.db;

    // Verify car exists and belongs to company
    const car = await db('cars')
      .where('id', req.params.id)
      .where('company_id', companyId)
      .first();

    if (!car) {
      res.status(404).json({ success: false, error: 'Car not found' });
      return;
    }

    // Update car
    await db('cars')
      .where('id', req.params.id)
      .where('company_id', companyId)
      .update({
        assigned_shop_id: null,
        start_date: null,
        end_date: null,
        status: 'unscheduled',
        updated_at: new Date()
      });

    res.json({ success: true, message: 'Car unassigned from shop' });

  } catch (error) {
    console.error('Error unassigning car:', error);
    res.status(500).json({ success: false, error: 'Failed to unassign car' });
  }
});

export default router;
