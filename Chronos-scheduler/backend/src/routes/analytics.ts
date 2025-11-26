import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/analytics/utilization
 * Get shop utilization over time
 * Query params: startMonth, endMonth, shopId
 */
router.get('/utilization', async (req: Request, res: Response) => {
  try {
    const { startMonth, endMonth, shopId } = req.query;

    if (!startMonth || !endMonth) {
      throw createError('startMonth and endMonth are required', 400);
    }

    const start = new Date(startMonth as string);
    const end = new Date(endMonth as string);

    const where: any = {
      month: {
        gte: start,
        lte: end
      }
    };

    if (shopId) {
      where.shopId = parseInt(shopId as string);
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        shop: true
      }
    });

    const shops = await prisma.shop.findMany({
      ...(shopId && { where: { id: parseInt(shopId as string) } })
    });

    // Group by shop and month
    const utilizationMap = new Map<string, Map<string, number>>();

    shops.forEach(shop => {
      utilizationMap.set(shop.name, new Map());
    });

    assignments.forEach(assignment => {
      const monthKey = assignment.month.toISOString().substring(0, 7);
      const shopName = assignment.shop.name;

      const shopMap = utilizationMap.get(shopName);
      if (shopMap) {
        shopMap.set(monthKey, (shopMap.get(monthKey) || 0) + 1);
      }
    });

    // Convert to time series
    const series: any[] = [];

    utilizationMap.forEach((monthMap, shopName) => {
      const shop = shops.find(s => s.name === shopName)!;
      const data: any[] = [];

      let current = new Date(start);
      while (current <= end) {
        const monthKey = current.toISOString().substring(0, 7);
        const assigned = monthMap.get(monthKey) || 0;
        const utilizationPercent = (assigned / shop.capacity) * 100;

        data.push({
          month: monthKey,
          assigned,
          capacity: shop.capacity,
          utilizationPercent: Math.round(utilizationPercent * 100) / 100
        });

        current.setMonth(current.getMonth() + 1);
      }

      series.push({
        shopName,
        shopId: shop.id,
        data
      });
    });

    res.json({
      success: true,
      data: series
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * GET /api/analytics/shop-performance
 * Get performance metrics for all shops
 */
router.get('/shop-performance', async (req: Request, res: Response) => {
  try {
    const shops = await prisma.shop.findMany({
      include: {
        assignments: {
          include: {
            car: true
          }
        }
      }
    });

    const performance = shops.map(shop => {
      const assignments = shop.assignments;
      const totalAssigned = assignments.length;
      const avgUtilization = (totalAssigned / shop.capacity) * 100;

      // Group by priority
      const priorityBreakdown: any = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
      };

      assignments.forEach(a => {
        if (priorityBreakdown[a.car.priority] !== undefined) {
          priorityBreakdown[a.car.priority]++;
        }
      });

      // Calculate month-by-month utilization
      const monthlyUtil = new Map<string, number>();
      assignments.forEach(a => {
        const monthKey = a.month.toISOString().substring(0, 7);
        monthlyUtil.set(monthKey, (monthlyUtil.get(monthKey) || 0) + 1);
      });

      const utilizationData = Array.from(monthlyUtil.entries()).map(([month, count]) => ({
        month,
        count,
        percent: (count / shop.capacity) * 100
      }));

      return {
        shopId: shop.id,
        shopName: shop.name,
        city: shop.city,
        capacity: shop.capacity,
        totalAssigned,
        avgUtilization: Math.round(avgUtilization * 100) / 100,
        priorityBreakdown,
        monthlyUtilization: utilizationData.sort((a, b) => a.month.localeCompare(b.month))
      };
    });

    res.json({
      success: true,
      data: performance
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * GET /api/analytics/forecast
 * Get forecast data based on current trends
 * Query params: months (number of months to forecast, default 6)
 */
router.get('/forecast', async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 6;

    // Get historical data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const historicalAssignments = await prisma.assignment.findMany({
      where: {
        month: {
          gte: sixMonthsAgo
        }
      },
      include: {
        shop: true,
        car: true
      }
    });

    const shops = await prisma.shop.findMany();

    // Calculate average monthly assignments per shop
    const shopStats = new Map<number, { total: number; months: Set<string> }>();

    historicalAssignments.forEach(a => {
      const monthKey = a.month.toISOString().substring(0, 7);
      const stats = shopStats.get(a.shopId) || { total: 0, months: new Set() };
      stats.total++;
      stats.months.add(monthKey);
      shopStats.set(a.shopId, stats);
    });

    // Generate forecast
    const forecast: any[] = [];

    shops.forEach(shop => {
      const stats = shopStats.get(shop.id) || { total: 0, months: new Set([]) };
      const avgPerMonth = stats.months.size > 0 ? stats.total / stats.months.size : 0;

      const forecastData: any[] = [];
      let current = new Date();

      for (let i = 0; i < months; i++) {
        current.setMonth(current.getMonth() + 1);
        const monthKey = current.toISOString().substring(0, 7);
        const projected = Math.round(avgPerMonth);
        const utilizationPercent = (projected / shop.capacity) * 100;

        forecastData.push({
          month: monthKey,
          projected,
          capacity: shop.capacity,
          utilizationPercent: Math.round(utilizationPercent * 100) / 100,
          status: projected > shop.capacity ? 'over' : projected >= shop.capacity * 0.8 ? 'near' : 'good'
        });
      }

      forecast.push({
        shopId: shop.id,
        shopName: shop.name,
        avgMonthlyAssignments: Math.round(avgPerMonth * 100) / 100,
        forecast: forecastData
      });
    });

    res.json({
      success: true,
      data: forecast
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * GET /api/analytics/dashboard
 * Get dashboard KPIs
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      totalCars,
      totalShops,
      totalAssignments,
      unscheduledCars,
      scheduledCars,
      carsByPriority,
      shopCapacityTotal,
      recentAssignments
    ] = await Promise.all([
      prisma.car.count(),
      prisma.shop.count(),
      prisma.assignment.count(),
      prisma.car.count({ where: { status: 'unscheduled' } }),
      prisma.car.count({ where: { status: 'scheduled' } }),
      prisma.car.groupBy({
        by: ['priority'],
        _count: true
      }),
      prisma.shop.aggregate({
        _sum: { capacity: true }
      }),
      prisma.assignment.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          car: true,
          shop: true
        }
      })
    ]);

    const utilizationPercent = shopCapacityTotal._sum.capacity
      ? (totalAssignments / shopCapacityTotal._sum.capacity) * 100
      : 0;

    // Get upcoming qualifications (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingQuals = await prisma.car.count({
      where: {
        qualDue: {
          lte: thirtyDaysFromNow
        },
        status: 'unscheduled'
      }
    });

    res.json({
      success: true,
      data: {
        kpis: {
          totalCars,
          totalShops,
          totalAssignments,
          unscheduledCars,
          scheduledCars,
          totalCapacity: shopCapacityTotal._sum.capacity || 0,
          utilizationPercent: Math.round(utilizationPercent * 100) / 100,
          upcomingQuals
        },
        carsByPriority: carsByPriority.reduce((acc: any, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {}),
        recentActivity: recentAssignments.map(a => ({
          id: a.id,
          carMark: a.car.mark,
          shopName: a.shop.name,
          month: a.month.toISOString().substring(0, 7),
          createdAt: a.createdAt
        }))
      }
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * GET /api/analytics/priority-distribution
 * Get priority distribution by shop
 */
router.get('/priority-distribution', async (req: Request, res: Response) => {
  try {
    const shops = await prisma.shop.findMany({
      include: {
        assignments: {
          include: {
            car: true
          }
        }
      }
    });

    const distribution = shops.map(shop => {
      const priorityCounts: any = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
      };

      shop.assignments.forEach(a => {
        if (priorityCounts[a.car.priority] !== undefined) {
          priorityCounts[a.car.priority]++;
        }
      });

      return {
        shopId: shop.id,
        shopName: shop.name,
        priorities: priorityCounts
      };
    });

    res.json({
      success: true,
      data: distribution
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

export default router;
