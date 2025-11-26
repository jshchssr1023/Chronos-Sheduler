import { Router, Request, Response } from 'express';
import XLSX from 'xlsx';
import prisma from '../utils/prisma';
import { createError } from '../middleware/errorHandler';

const router = Router();

interface ScenarioAssignment {
  carId: number;
  shopId: number;
  month: string;
}

interface FitResult {
  shopId: number;
  shopName: string;
  capacity: number;
  currentAssigned: number;
  scenarioAssigned: number;
  totalAssigned: number;
  utilizationPercent: number;
  status: 'green' | 'yellow' | 'red';
  overload: number;
  earliestSlot: string | null;
}

/**
 * GET /api/scenarios
 * Get all scenarios
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const scenarios = await prisma.scenario.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: scenarios,
      count: scenarios.length
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * GET /api/scenarios/:id
 * Get a single scenario
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const scenarioId = parseInt(req.params.id);

    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId }
    });

    if (!scenario) {
      throw createError('Scenario not found', 404);
    }

    res.json({
      success: true,
      data: scenario
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/scenarios
 * Create a new scenario
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, data } = req.body;

    if (!name) {
      throw createError('name is required', 400);
    }

    const scenario = await prisma.scenario.create({
      data: {
        name,
        data: data || {}
      }
    });

    res.status(201).json({
      success: true,
      data: scenario
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * PUT /api/scenarios/:id
 * Update a scenario
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const scenarioId = parseInt(req.params.id);
    const { name, data } = req.body;

    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId }
    });

    if (!scenario) {
      throw createError('Scenario not found', 404);
    }

    const updated = await prisma.scenario.update({
      where: { id: scenarioId },
      data: {
        ...(name && { name }),
        ...(data && { data })
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
 * DELETE /api/scenarios/:id
 * Delete a scenario
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const scenarioId = parseInt(req.params.id);

    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId }
    });

    if (!scenario) {
      throw createError('Scenario not found', 404);
    }

    await prisma.scenario.delete({ where: { id: scenarioId } });

    res.json({
      success: true,
      message: 'Scenario deleted successfully'
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/scenarios/evaluate
 * Evaluate scenario fit against current schedule
 * Body: { assignments: [{ carId, shopId, month }] }
 */
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { assignments } = req.body as { assignments: ScenarioAssignment[] };

    if (!assignments || !Array.isArray(assignments)) {
      throw createError('assignments array is required', 400);
    }

    // Get all shops
    const shops = await prisma.shop.findMany();

    // Get current assignments
    const currentAssignments = await prisma.assignment.findMany({
      include: {
        shop: true
      }
    });

    // Calculate fit for each shop
    const fitResults: FitResult[] = [];

    for (const shop of shops) {
      // Group assignments by month
      const monthlyData = new Map<string, { current: number; scenario: number }>();

      // Add current assignments
      currentAssignments
        .filter(a => a.shopId === shop.id)
        .forEach(a => {
          const monthKey = a.month.toISOString().substring(0, 7);
          const existing = monthlyData.get(monthKey) || { current: 0, scenario: 0 };
          existing.current++;
          monthlyData.set(monthKey, existing);
        });

      // Add scenario assignments
      assignments
        .filter(a => a.shopId === shop.id)
        .forEach(a => {
          const monthKey = a.month.substring(0, 7);
          const existing = monthlyData.get(monthKey) || { current: 0, scenario: 0 };
          existing.scenario++;
          monthlyData.set(monthKey, existing);
        });

      // Find max utilization and overload
      let maxTotal = 0;
      let maxOverload = 0;
      let earliestSlot: string | null = null;

      for (const [month, counts] of monthlyData.entries()) {
        const total = counts.current + counts.scenario;
        if (total > maxTotal) {
          maxTotal = total;
        }
        if (total > shop.capacity) {
          const overload = total - shop.capacity;
          if (overload > maxOverload) {
            maxOverload = overload;
          }
        }
        // Find earliest month with available capacity
        if (total < shop.capacity && !earliestSlot) {
          earliestSlot = month;
        }
      }

      // If no slot found in existing months, suggest next month
      if (!earliestSlot) {
        const now = new Date();
        earliestSlot = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          .toISOString()
          .substring(0, 7);
      }

      const currentTotal = currentAssignments.filter(a => a.shopId === shop.id).length;
      const scenarioTotal = assignments.filter(a => a.shopId === shop.id).length;
      const utilizationPercent = (maxTotal / shop.capacity) * 100;

      // Determine status
      let status: 'green' | 'yellow' | 'red';
      if (maxTotal > shop.capacity) {
        status = 'red';
      } else if (utilizationPercent >= 80) {
        status = 'yellow';
      } else {
        status = 'green';
      }

      fitResults.push({
        shopId: shop.id,
        shopName: shop.name,
        capacity: shop.capacity,
        currentAssigned: currentTotal,
        scenarioAssigned: scenarioTotal,
        totalAssigned: maxTotal,
        utilizationPercent: Math.round(utilizationPercent * 100) / 100,
        status,
        overload: maxOverload,
        earliestSlot
      });
    }

    // Calculate overall fit score
    const greenCount = fitResults.filter(r => r.status === 'green').length;
    const fitScore = shops.length > 0 ? (greenCount / shops.length) * 100 : 0;
    const totalOverload = fitResults.reduce((sum, r) => sum + r.overload, 0);

    res.json({
      success: true,
      data: {
        fitScore: Math.round(fitScore * 100) / 100,
        totalOverload,
        shops: fitResults,
        summary: {
          green: greenCount,
          yellow: fitResults.filter(r => r.status === 'yellow').length,
          red: fitResults.filter(r => r.status === 'red').length
        }
      }
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/scenarios/:id/apply
 * Apply scenario to actual schedule
 */
router.post('/:id/apply', async (req: Request, res: Response) => {
  try {
    const scenarioId = parseInt(req.params.id);

    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId }
    });

    if (!scenario) {
      throw createError('Scenario not found', 404);
    }

    const scenarioData = scenario.data as any;
    const assignments = scenarioData.assignments as ScenarioAssignment[];

    if (!assignments || !Array.isArray(assignments)) {
      throw createError('Invalid scenario data', 400);
    }

    // Apply assignments in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const created: any[] = [];

      for (const assignment of assignments) {
        const { carId, shopId, month } = assignment;

        // Check if assignment already exists
        const existing = await tx.assignment.findUnique({
          where: {
            carId_month: { carId, month: new Date(month) }
          }
        });

        if (!existing) {
          const newAssignment = await tx.assignment.create({
            data: {
              carId,
              shopId,
              month: new Date(month)
            },
            include: {
              car: true,
              shop: true
            }
          });
          created.push(newAssignment);

          // Update car status
          await tx.car.update({
            where: { id: carId },
            data: { status: 'scheduled' }
          });
        }
      }

      return created;
    });

    res.json({
      success: true,
      message: `Applied ${result.length} assignments from scenario`,
      data: result
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/scenarios/export
 * Export scenario to XLSX
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { scenarioId, fitResults } = req.body;

    let scenario = null;
    if (scenarioId) {
      scenario = await prisma.scenario.findUnique({
        where: { id: scenarioId }
      });
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Fit Results
    if (fitResults && fitResults.shops) {
      const fitData = fitResults.shops.map((shop: FitResult) => ({
        'Shop Name': shop.shopName,
        'Capacity': shop.capacity,
        'Current Assigned': shop.currentAssigned,
        'Scenario Assigned': shop.scenarioAssigned,
        'Total Assigned': shop.totalAssigned,
        'Utilization %': shop.utilizationPercent,
        'Status': shop.status.toUpperCase(),
        'Overload': shop.overload,
        'Earliest Slot': shop.earliestSlot || 'N/A'
      }));

      const fitSheet = XLSX.utils.json_to_sheet(fitData);
      XLSX.utils.book_append_sheet(workbook, fitSheet, 'Fit Analysis');
    }

    // Sheet 2: Scenario Assignments
    if (scenario) {
      const scenarioData = scenario.data as any;
      const assignments = scenarioData.assignments as ScenarioAssignment[];

      if (assignments && assignments.length > 0) {
        // Fetch car and shop details
        const carIds = assignments.map((a: ScenarioAssignment) => a.carId);
        const shopIds = assignments.map((a: ScenarioAssignment) => a.shopId);

        const [cars, shops] = await Promise.all([
          prisma.car.findMany({
            where: { id: { in: carIds } }
          }),
          prisma.shop.findMany({
            where: { id: { in: shopIds } }
          })
        ]);

        const carMap = new Map(cars.map(c => [c.id, c]));
        const shopMap = new Map(shops.map(s => [s.id, s]));

        const assignmentData = assignments.map((a: ScenarioAssignment) => {
          const car = carMap.get(a.carId);
          const shop = shopMap.get(a.shopId);

          return {
            'Car Mark': car?.mark || 'Unknown',
            'Customer': car?.customer || '',
            'Shop': shop?.name || 'Unknown',
            'Month': a.month,
            'Priority': car?.priority || ''
          };
        });

        const assignmentSheet = XLSX.utils.json_to_sheet(assignmentData);
        XLSX.utils.book_append_sheet(workbook, assignmentSheet, 'Assignments');
      }
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = scenario
      ? `scenario_${scenario.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.xlsx`
      : `scenario_export_${Date.now()}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

export default router;
