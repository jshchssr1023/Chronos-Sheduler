import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { createError } from '../middleware/errorHandler';

const router = Router();

// Default capabilities for new shops
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
 * Get all shops with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      ownership,
      shopType,      // NEW Phase 1
      region,        // NEW Phase 1
      active,        // NEW Phase 1
      hasCapacity    // NEW Phase 1 - filter shops with available capacity
    } = req.query;

    const where: any = {};
    
    if (ownership) where.ownership = ownership as string;
    if (shopType) where.shopType = shopType as string;
    if (region) where.region = { contains: region as string, mode: 'insensitive' };
    
    // Handle active filter (default: show active only)
    if (active === 'false') {
      where.active = false;
    } else if (active === 'all') {
      // Show all
    } else {
      where.active = true;
    }

    const shops = await prisma.shop.findMany({
      where,
      include: {
        _count: {
          select: { assignments: true }
        },
        assignments: {
          where: {
            car: {
              status: { in: ['scheduled', 'in_progress'] }
            }
          },
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Calculate utilization for each shop
    const result = shops.map(shop => {
      const activeAssignments = shop.assignments.length;
      const capacity = (shop as any).weeklyCapacity || shop.capacity || 10;
      const utilization = capacity > 0 ? (activeAssignments / capacity) * 100 : 0;
      const availableCapacity = Math.max(0, capacity - activeAssignments);

      return {
        ...shop,
        activeAssignments,
        utilizationPercentage: Math.round(utilization * 10) / 10,
        availableCapacity,
        // Remove the nested assignments array from response
        assignments: undefined
      };
    });

    // Filter by capacity if requested
    const finalResult = hasCapacity === 'true'
      ? result.filter(s => s.availableCapacity > 0)
      : result;

    res.json({
      success: true,
      data: finalResult
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * GET /api/shops/:id
 * Get a single shop with its cars
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const shopId = parseInt(req.params.id);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        assignments: {
          include: {
            car: true
          },
          orderBy: { month: 'asc' }
        }
      }
    });

    if (!shop) {
      throw createError('Shop not found', 404);
    }

    // Calculate stats
    const activeAssignments = shop.assignments.filter(
      a => a.car.status === 'scheduled' || a.car.status === 'in_progress'
    ).length;
    const capacity = (shop as any).weeklyCapacity || shop.capacity || 10;

    res.json({
      success: true,
      data: {
        ...shop,
        activeAssignments,
        utilizationPercentage: capacity > 0 ? Math.round((activeAssignments / capacity) * 1000) / 10 : 0,
        availableCapacity: Math.max(0, capacity - activeAssignments)
      }
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/shops
 * Create a new shop
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      // Existing required fields
      name,
      location,
      ownership,
      capacity,
      // NEW Phase 1 fields
      shopType,
      capabilities,
      costIndex,
      weeklyCapacity,
      monthlyCapacity,
      annualTarget,
      bookingLeadTimeDays,
      contactName,
      contactEmail,
      contactPhone,
      qualityRating,
      avgTurnaroundDays,
      region,
      railroadAccess,
      preferredCommodities
    } = req.body;

    // Validate required fields
    if (!name || !location || !ownership) {
      throw createError('Required fields: name, location, ownership', 400);
    }

    // Validate ownership
    if (!['AITX-Owned', 'Third-Party'].includes(ownership)) {
      throw createError('ownership must be "AITX-Owned" or "Third-Party"', 400);
    }

    // Check for duplicate name
    const existing = await prisma.shop.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    });
    if (existing) {
      throw createError('Shop with this name already exists', 400);
    }

    const weeklyCapacityValue = weeklyCapacity || capacity || 10;

    const shop = await prisma.shop.create({
      data: {
        // Existing fields
        name,
        location,
        ownership,
        capacity: capacity || 10,
        // NEW Phase 1 fields
        shopType: shopType || 'Contracted',
        capabilities: { ...DEFAULT_CAPABILITIES, ...(capabilities || {}) },
        costIndex: costIndex ? parseFloat(costIndex) : 1.0,
        weeklyCapacity: weeklyCapacityValue,
        monthlyCapacity: monthlyCapacity || weeklyCapacityValue * 4,
        annualTarget: annualTarget || weeklyCapacityValue * 52,
        bookingLeadTimeDays: bookingLeadTimeDays || 14,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        qualityRating: qualityRating ? parseFloat(qualityRating) : null,
        avgTurnaroundDays: avgTurnaroundDays ? parseInt(avgTurnaroundDays) : null,
        region: region || null,
        railroadAccess: railroadAccess || [],
        preferredCommodities: preferredCommodities || [],
        active: true
      }
    });

    res.status(201).json({
      success: true,
      data: shop
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * PUT /api/shops/:id
 * Update a shop
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const shopId = parseInt(req.params.id);
    const {
      // Existing fields
      name,
      location,
      ownership,
      capacity,
      // NEW Phase 1 fields
      shopType,
      capabilities,
      costIndex,
      weeklyCapacity,
      monthlyCapacity,
      annualTarget,
      bookingLeadTimeDays,
      contactName,
      contactEmail,
      contactPhone,
      qualityRating,
      avgTurnaroundDays,
      region,
      railroadAccess,
      preferredCommodities,
      active
    } = req.body;

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw createError('Shop not found', 404);
    }

    // If name is being changed, check for duplicates
    if (name && name.toLowerCase() !== shop.name.toLowerCase()) {
      const existing = await prisma.shop.findFirst({
        where: { 
          name: { equals: name, mode: 'insensitive' },
          id: { not: shopId }
        }
      });
      if (existing) {
        throw createError('Shop with this name already exists', 400);
      }
    }

    // Merge capabilities if provided
    const existingCapabilities = (shop as any).capabilities || DEFAULT_CAPABILITIES;
    const mergedCapabilities = capabilities 
      ? { ...existingCapabilities, ...capabilities }
      : undefined;

    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: {
        // Existing fields
        ...(name && { name }),
        ...(location && { location }),
        ...(ownership && { ownership }),
        ...(capacity !== undefined && { capacity: parseInt(capacity) }),
        // NEW Phase 1 fields
        ...(shopType !== undefined && { shopType }),
        ...(mergedCapabilities && { capabilities: mergedCapabilities }),
        ...(costIndex !== undefined && { costIndex: parseFloat(costIndex) }),
        ...(weeklyCapacity !== undefined && { weeklyCapacity: parseInt(weeklyCapacity) }),
        ...(monthlyCapacity !== undefined && { monthlyCapacity: parseInt(monthlyCapacity) }),
        ...(annualTarget !== undefined && { annualTarget: parseInt(annualTarget) }),
        ...(bookingLeadTimeDays !== undefined && { bookingLeadTimeDays: parseInt(bookingLeadTimeDays) }),
        ...(contactName !== undefined && { contactName }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(qualityRating !== undefined && { qualityRating: qualityRating ? parseFloat(qualityRating) : null }),
        ...(avgTurnaroundDays !== undefined && { avgTurnaroundDays: avgTurnaroundDays ? parseInt(avgTurnaroundDays) : null }),
        ...(region !== undefined && { region }),
        ...(railroadAccess !== undefined && { railroadAccess }),
        ...(preferredCommodities !== undefined && { preferredCommodities }),
        ...(active !== undefined && { active: Boolean(active) })
      }
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * DELETE /api/shops/:id
 * Delete a shop (soft delete by default)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const shopId = parseInt(req.params.id);
    const hardDelete = req.query.hard === 'true';

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        assignments: {
          where: {
            car: {
              status: { in: ['scheduled', 'in_progress'] }
            }
          }
        }
      }
    });

    if (!shop) {
      throw createError('Shop not found', 404);
    }

    // Check for active assignments
    if (shop.assignments.length > 0) {
      throw createError(`Cannot delete shop with ${shop.assignments.length} active assignments. Unassign cars first.`, 400);
    }

    if (hardDelete) {
      // Hard delete
      await prisma.shop.delete({ where: { id: shopId } });
      res.json({
        success: true,
        message: 'Shop permanently deleted'
      });
    } else {
      // Soft delete - deactivate
      await prisma.shop.update({
        where: { id: shopId },
        data: { active: false }
      });
      res.json({
        success: true,
        message: 'Shop deactivated'
      });
    }
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/shops/:id/activate
 * Reactivate a deactivated shop
 */
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const shopId = parseInt(req.params.id);

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw createError('Shop not found', 404);
    }

    if ((shop as any).active) {
      throw createError('Shop is already active', 400);
    }

    const activated = await prisma.shop.update({
      where: { id: shopId },
      data: { active: true }
    });

    res.json({
      success: true,
      data: activated,
      message: 'Shop activated successfully'
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * GET /api/shops/stats/summary
 * Get shop statistics
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const [
      total,
      active,
      byOwnership,
      byShopType,    // NEW Phase 1
      byRegion       // NEW Phase 1
    ] = await Promise.all([
      prisma.shop.count(),
      prisma.shop.count({ where: { active: true } }),
      prisma.shop.groupBy({
        by: ['ownership'],
        where: { active: true },
        _count: true
      }),
      // NEW Phase 1
      prisma.shop.groupBy({
        by: ['shopType'],
        where: { active: true },
        _count: true
      }),
      // NEW Phase 1
      prisma.shop.groupBy({
        by: ['region'],
        where: { active: true },
        _count: true
      })
    ]);

    // Get total capacity
    const capacityData = await prisma.shop.aggregate({
      where: { active: true },
      _sum: {
        capacity: true,
        weeklyCapacity: true
      }
    });

    // Get current load (active assignments)
    const activeAssignments = await prisma.assignment.count({
      where: {
        car: {
          status: { in: ['scheduled', 'in_progress'] }
        }
      }
    });

    const totalCapacity = capacityData._sum.weeklyCapacity || capacityData._sum.capacity || 0;

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        byOwnership: byOwnership.reduce((acc: any, item) => {
          acc[item.ownership] = item._count;
          return acc;
        }, {}),
        // NEW Phase 1
        byShopType: byShopType.reduce((acc: any, item) => {
          acc[item.shopType || 'Unknown'] = item._count;
          return acc;
        }, {}),
        byRegion: byRegion.reduce((acc: any, item) => {
          acc[item.region || 'Unassigned'] = item._count;
          return acc;
        }, {}),
        capacity: {
          total: totalCapacity,
          currentLoad: activeAssignments,
          utilizationPercentage: totalCapacity > 0 
            ? Math.round((activeAssignments / totalCapacity) * 1000) / 10 
            : 0
        }
      }
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * GET /api/shops/stats/utilization
 * Get detailed utilization for all active shops
 */
router.get('/stats/utilization', async (req: Request, res: Response) => {
  try {
    const shops = await prisma.shop.findMany({
      where: { active: true },
      include: {
        assignments: {
          where: {
            car: {
              status: { in: ['scheduled', 'in_progress'] }
            }
          },
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const utilization = shops.map(shop => {
      const activeCount = shop.assignments.length;
      const capacity = (shop as any).weeklyCapacity || shop.capacity || 10;
      const percentage = capacity > 0 ? (activeCount / capacity) * 100 : 0;

      return {
        shopId: shop.id,
        shopName: shop.name,
        location: shop.location,
        ownership: shop.ownership,
        shopType: (shop as any).shopType,
        capacity,
        activeAssignments: activeCount,
        availableCapacity: Math.max(0, capacity - activeCount),
        utilizationPercentage: Math.round(percentage * 10) / 10
      };
    });

    // Sort by utilization descending
    utilization.sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);

    res.json({
      success: true,
      data: utilization
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

export default router;
