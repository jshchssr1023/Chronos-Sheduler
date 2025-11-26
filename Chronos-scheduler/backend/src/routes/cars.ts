import { Router, Request, Response } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import prisma from '../utils/prisma';
import { createError } from '../middleware/errorHandler';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

/**
 * GET /api/cars
 * Get all cars with filters
 * Query params: customer, leaseNumber, type, priority, status, reason, demandType, commodity, page, limit
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      customer,
      leaseNumber,
      type,
      priority,
      status,
      reason,
      demandType,      // NEW Phase 1
      commodity,       // NEW Phase 1
      archived,        // NEW Phase 1
      page = '1',
      limit = '100'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    // Existing filters
    if (customer) where.customer = { contains: customer as string, mode: 'insensitive' };
    if (leaseNumber) where.leaseNumber = { contains: leaseNumber as string, mode: 'insensitive' };
    if (type) where.type = { contains: type as string, mode: 'insensitive' };
    if (priority) where.priority = priority as string;
    if (status) where.status = status as string;
    if (reason) where.reason = { contains: reason as string, mode: 'insensitive' };
    
    // NEW Phase 1 filters
    if (demandType) where.demandType = demandType as string;
    if (commodity) where.commodity = { contains: commodity as string, mode: 'insensitive' };
    
    // Handle archived filter (default: show non-archived)
    if (archived === 'true') {
      where.archived = true;
    } else if (archived === 'all') {
      // Show all
    } else {
      where.archived = false;
    }

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where,
        include: {
          assignments: {
            include: {
              shop: true
            }
          }
        },
        orderBy: [
          { priority: 'asc' },
          { qualDue: 'asc' }
        ],
        skip,
        take: limitNum
      }),
      prisma.car.count({ where })
    ]);

    res.json({
      success: true,
      data: cars,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * GET /api/cars/:id
 * Get a single car
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const carId = parseInt(req.params.id);

    const car = await prisma.car.findUnique({
      where: { id: carId },
      include: {
        assignments: {
          include: {
            shop: true
          },
          orderBy: { month: 'asc' }
        }
      }
    });

    if (!car) {
      throw createError('Car not found', 404);
    }

    res.json({
      success: true,
      data: car
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/cars
 * Create a new car
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      // Existing required fields
      mark,
      customer,
      leaseNumber,
      type,
      level2Type,
      qualDue,
      priority,
      status,
      reason,
      // NEW Phase 1 optional fields
      demandType,
      commodity,
      estimatedDurationDays,
      targetCostPerCar,
      owner,
      fleetId,
      lastShopDate,
      workScope,
      regulatoryCycleYears
    } = req.body;

    // Validate required fields
    if (!mark || !customer || !leaseNumber || !type || !level2Type || !qualDue || !priority) {
      throw createError('Required fields: mark, customer, leaseNumber, type, level2Type, qualDue, priority', 400);
    }

    // Check for duplicate mark
    const existing = await prisma.car.findUnique({ where: { mark } });
    if (existing) {
      throw createError('Car mark already exists', 400);
    }

    const car = await prisma.car.create({
      data: {
        // Existing fields
        mark,
        customer,
        leaseNumber,
        type,
        level2Type,
        qualDue: new Date(qualDue),
        priority,
        status: status || 'unscheduled',
        reason: reason || null,
        // NEW Phase 1 fields
        demandType: demandType || 'Maintenance Cycle',
        commodity: commodity || null,
        estimatedDurationDays: estimatedDurationDays ? parseInt(estimatedDurationDays) : 14,
        targetCostPerCar: targetCostPerCar ? parseFloat(targetCostPerCar) : null,
        owner: owner || null,
        fleetId: fleetId || null,
        lastShopDate: lastShopDate ? new Date(lastShopDate) : null,
        workScope: workScope || null,
        regulatoryCycleYears: regulatoryCycleYears ? parseInt(regulatoryCycleYears) : null,
        archived: false
      }
    });

    res.status(201).json({
      success: true,
      data: car
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * PUT /api/cars/:id
 * Update a car
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const carId = parseInt(req.params.id);
    const {
      // Existing fields
      mark,
      customer,
      leaseNumber,
      type,
      level2Type,
      qualDue,
      priority,
      status,
      reason,
      // NEW Phase 1 fields
      demandType,
      commodity,
      estimatedDurationDays,
      targetCostPerCar,
      owner,
      fleetId,
      lastShopDate,
      workScope,
      regulatoryCycleYears,
      archived
    } = req.body;

    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw createError('Car not found', 404);
    }

    // If mark is being changed, check for duplicates
    if (mark && mark !== car.mark) {
      const existing = await prisma.car.findUnique({ where: { mark } });
      if (existing) {
        throw createError('Car mark already exists', 400);
      }
    }

    const updated = await prisma.car.update({
      where: { id: carId },
      data: {
        // Existing fields
        ...(mark && { mark }),
        ...(customer && { customer }),
        ...(leaseNumber && { leaseNumber }),
        ...(type && { type }),
        ...(level2Type && { level2Type }),
        ...(qualDue && { qualDue: new Date(qualDue) }),
        ...(priority && { priority }),
        ...(status && { status }),
        ...(reason !== undefined && { reason }),
        // NEW Phase 1 fields
        ...(demandType !== undefined && { demandType }),
        ...(commodity !== undefined && { commodity }),
        ...(estimatedDurationDays !== undefined && { estimatedDurationDays: parseInt(estimatedDurationDays) }),
        ...(targetCostPerCar !== undefined && { targetCostPerCar: targetCostPerCar ? parseFloat(targetCostPerCar) : null }),
        ...(owner !== undefined && { owner }),
        ...(fleetId !== undefined && { fleetId }),
        ...(lastShopDate !== undefined && { lastShopDate: lastShopDate ? new Date(lastShopDate) : null }),
        ...(workScope !== undefined && { workScope }),
        ...(regulatoryCycleYears !== undefined && { regulatoryCycleYears: regulatoryCycleYears ? parseInt(regulatoryCycleYears) : null }),
        ...(archived !== undefined && { archived: Boolean(archived) })
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
 * DELETE /api/cars/:id
 * Delete a car (soft delete by default, hard delete with ?hard=true)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const carId = parseInt(req.params.id);
    const hardDelete = req.query.hard === 'true';

    const car = await prisma.car.findUnique({
      where: { id: carId },
      include: { _count: { select: { assignments: true } } }
    });

    if (!car) {
      throw createError('Car not found', 404);
    }

    if (hardDelete) {
      // Hard delete - remove from database
      await prisma.car.delete({ where: { id: carId } });
      res.json({
        success: true,
        message: `Car permanently deleted${car._count.assignments > 0 ? ` (${car._count.assignments} assignments removed)` : ''}`
      });
    } else {
      // Soft delete - archive the car
      await prisma.car.update({
        where: { id: carId },
        data: { archived: true }
      });
      res.json({
        success: true,
        message: 'Car archived successfully'
      });
    }
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/cars/:id/restore
 * Restore an archived car
 */
router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const carId = parseInt(req.params.id);

    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw createError('Car not found', 404);
    }

    if (!car.archived) {
      throw createError('Car is not archived', 400);
    }

    const restored = await prisma.car.update({
      where: { id: carId },
      data: { archived: false }
    });

    res.json({
      success: true,
      data: restored,
      message: 'Car restored successfully'
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/cars/bulk-import
 * Import cars from CSV/XLSX
 * Expected columns: mark, customer, leaseNumber, type, level2Type, qualDue, priority, status, reason
 * Optional columns: demandType, commodity, estimatedDurationDays, targetCostPerCar, owner, fleetId, workScope
 */
router.post('/bulk-import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw createError('No file uploaded', 400);
    }

    let workbook: XLSX.WorkBook;

    if (req.file.mimetype === 'text/csv') {
      const csvData = req.file.buffer.toString('utf-8');
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      throw createError('File is empty', 400);
    }

    // Validate data structure (required fields only)
    const requiredFields = ['mark', 'customer', 'leaseNumber', 'type', 'level2Type', 'qualDue', 'priority'];
    const firstRow: any = data[0];
    const missingFields = requiredFields.filter(field => !(field in firstRow));

    if (missingFields.length > 0) {
      throw createError(`Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    // Check for duplicate marks in upload
    const marks = data.map((row: any) => row.mark);
    const duplicateMarks = marks.filter((mark, index) => marks.indexOf(mark) !== index);
    if (duplicateMarks.length > 0) {
      throw createError(`Duplicate car marks in file: ${[...new Set(duplicateMarks)].join(', ')}`, 400);
    }

    // Check for existing marks in database
    const existingCars = await prisma.car.findMany({
      where: {
        mark: { in: marks }
      },
      select: { mark: true }
    });

    if (existingCars.length > 0) {
      const existingMarks = existingCars.map(c => c.mark);
      throw createError(`Cars with these marks already exist: ${existingMarks.join(', ')}`, 400);
    }

    // Validate and transform data
    const cars = data.map((row: any, index: number) => {
      const qualDue = new Date(row.qualDue);
      if (isNaN(qualDue.getTime())) {
        throw createError(`Invalid qualDue at row ${index + 2}: ${row.qualDue}`, 400);
      }

      return {
        // Required fields
        mark: String(row.mark).trim(),
        customer: String(row.customer).trim(),
        leaseNumber: String(row.leaseNumber).trim(),
        type: String(row.type).trim(),
        level2Type: String(row.level2Type).trim(),
        qualDue,
        priority: String(row.priority).trim(),
        status: row.status ? String(row.status).trim() : 'unscheduled',
        reason: row.reason ? String(row.reason).trim() : null,
        // NEW Phase 1 optional fields
        demandType: row.demandType ? String(row.demandType).trim() : 'Maintenance Cycle',
        commodity: row.commodity ? String(row.commodity).trim() : null,
        estimatedDurationDays: row.estimatedDurationDays ? parseInt(row.estimatedDurationDays) : 14,
        targetCostPerCar: row.targetCostPerCar ? parseFloat(row.targetCostPerCar) : null,
        owner: row.owner ? String(row.owner).trim() : null,
        fleetId: row.fleetId ? String(row.fleetId).trim() : null,
        workScope: row.workScope ? String(row.workScope).trim() : null,
        archived: false
      };
    });

    // Bulk create
    const result = await prisma.car.createMany({
      data: cars
    });

    res.json({
      success: true,
      message: `Successfully imported ${result.count} cars`,
      count: result.count
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * GET /api/cars/export/xlsx
 * Export all cars to XLSX
 */
router.get('/export/xlsx', async (req: Request, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    
    const where: any = {};
    if (!includeArchived) {
      where.archived = false;
    }

    const cars = await prisma.car.findMany({
      where,
      include: {
        assignments: {
          include: {
            shop: true
          }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { qualDue: 'asc' }
      ]
    });

    const exportData = cars.map(car => ({
      // Existing fields
      mark: car.mark,
      customer: car.customer,
      leaseNumber: car.leaseNumber,
      type: car.type,
      level2Type: car.level2Type,
      qualDue: car.qualDue.toISOString().split('T')[0],
      priority: car.priority,
      status: car.status,
      reason: car.reason || '',
      // NEW Phase 1 fields
      demandType: (car as any).demandType || '',
      commodity: (car as any).commodity || '',
      estimatedDurationDays: (car as any).estimatedDurationDays || '',
      targetCostPerCar: (car as any).targetCostPerCar || '',
      owner: (car as any).owner || '',
      fleetId: (car as any).fleetId || '',
      workScope: (car as any).workScope || '',
      archived: (car as any).archived ? 'Yes' : 'No',
      // Assignment info
      assignmentCount: car.assignments.length,
      shops: car.assignments.map(a => a.shop.name).join(', ')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cars');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=cars_export_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * GET /api/cars/template/download
 * Download a CSV template for car import (updated with Phase 1 fields)
 */
router.get('/template/download', (req: Request, res: Response) => {
  const template = [
    {
      mark: 'CAR-001',
      customer: 'Customer A',
      leaseNumber: 'LSE-12345',
      type: 'Tank Car',
      level2Type: 'DOT-111',
      qualDue: '2024-12-31',
      priority: 'High',
      status: 'unscheduled',
      reason: '',
      // NEW Phase 1 fields
      demandType: 'Maintenance Cycle',
      commodity: 'Crude Oil',
      estimatedDurationDays: 14,
      targetCostPerCar: 25000,
      owner: 'AITX',
      fleetId: 'FLT-001',
      workScope: 'Full inspection and wheel work'
    },
    {
      mark: 'CAR-002',
      customer: 'Customer B',
      leaseNumber: 'LSE-12346',
      type: 'Covered Hopper',
      level2Type: 'Standard',
      qualDue: '2024-11-30',
      priority: 'Medium',
      status: 'unscheduled',
      reason: '',
      // NEW Phase 1 fields
      demandType: 'Regulatory',
      commodity: 'Grain',
      estimatedDurationDays: 7,
      targetCostPerCar: 15000,
      owner: 'Customer B',
      fleetId: 'FLT-002',
      workScope: 'Regulatory inspection'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cars');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=cars_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

/**
 * GET /api/cars/stats/summary
 * Get car statistics (updated with Phase 1 fields)
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const [
      total,
      unscheduled,
      scheduled,
      archived,
      byPriority,
      byStatus,
      byDemandType  // NEW Phase 1
    ] = await Promise.all([
      prisma.car.count({ where: { archived: false } }),
      prisma.car.count({ where: { status: 'unscheduled', archived: false } }),
      prisma.car.count({ where: { status: 'scheduled', archived: false } }),
      prisma.car.count({ where: { archived: true } }),
      prisma.car.groupBy({
        by: ['priority'],
        where: { archived: false },
        _count: true
      }),
      prisma.car.groupBy({
        by: ['status'],
        where: { archived: false },
        _count: true
      }),
      // NEW Phase 1 - Group by demand type
      prisma.car.groupBy({
        by: ['demandType'],
        where: { archived: false },
        _count: true
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        unscheduled,
        scheduled,
        archived,
        byPriority: byPriority.reduce((acc: any, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {}),
        byStatus: byStatus.reduce((acc: any, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        // NEW Phase 1
        byDemandType: byDemandType.reduce((acc: any, item) => {
          acc[item.demandType || 'Unknown'] = item._count;
          return acc;
        }, {})
      }
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

export default router;
