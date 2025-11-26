import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { createError } from '../middleware/errorHandler';

const router = Router();

// In-memory undo/redo stack (could be Redis in production)
interface HistoryAction {
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
}

const undoStack: HistoryAction[] = [];
const redoStack: HistoryAction[] = [];
const MAX_HISTORY = 50;

/**
 * Add action to history
 */
const addToHistory = (action: HistoryAction) => {
  undoStack.push(action);
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  redoStack.length = 0; // Clear redo stack on new action
};

/**
 * GET /api/schedule/assignments
 * Get all assignments with shop and car details
 */
router.get('/assignments', async (req: Request, res: Response) => {
  try {
    const { month, shopId } = req.query;

    const where: any = {};
    if (month) {
      const monthDate = new Date(month as string);
      where.month = monthDate;
    }
    if (shopId) {
      where.shopId = parseInt(shopId as string);
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        car: true,
        shop: true
      },
      orderBy: { month: 'asc' }
    });

    res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * GET /api/schedule/unassigned
 * Get all unassigned cars
 */
router.get('/unassigned', async (req: Request, res: Response) => {
  try {
    const cars = await prisma.car.findMany({
      where: {
        status: 'unscheduled',
        assignments: {
          none: {}
        }
      },
      orderBy: [
        { priority: 'asc' },
        { qualDue: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: cars,
      count: cars.length
    });
  } catch (error: any) {
    throw createError(error.message, 500);
  }
});

/**
 * POST /api/schedule/assign
 * Assign a car to a shop for a specific month
 */
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { carId, shopId, month } = req.body;

    if (!carId || !shopId || !month) {
      throw createError('carId, shopId, and month are required', 400);
    }

    const monthDate = new Date(month);

    // Check if car exists
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      throw createError('Car not found', 404);
    }

    // Check if shop exists
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw createError('Shop not found', 404);
    }

    // Check for existing assignment
    const existing = await prisma.assignment.findUnique({
      where: {
        carId_month: { carId, month: monthDate }
      }
    });

    if (existing) {
      throw createError('Car already assigned for this month', 400);
    }

    // Check shop capacity
    const monthAssignments = await prisma.assignment.count({
      where: {
        shopId,
        month: monthDate
      }
    });

    const isOverCapacity = monthAssignments >= shop.capacity;

    // Create assignment
    const assignment = await prisma.assignment.create({
      data: {
        carId,
        shopId,
        month: monthDate
      },
      include: {
        car: true,
        shop: true
      }
    });

    // Update car status
    await prisma.car.update({
      where: { id: carId },
      data: { status: 'scheduled' }
    });

    // Add to history
    addToHistory({
      type: 'create',
      data: { assignment },
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: assignment,
      warning: isOverCapacity ? `Shop ${shop.name} is over capacity for this month` : undefined
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * DELETE /api/schedule/unassign/:id
 * Unassign a car (delete assignment)
 */
router.delete('/unassign/:id', async (req: Request, res: Response) => {
  try {
    const assignmentId = parseInt(req.params.id);

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { car: true }
    });

    if (!assignment) {
      throw createError('Assignment not found', 404);
    }

    // Add to history before deletion
    addToHistory({
      type: 'delete',
      data: { assignment },
      timestamp: new Date()
    });

    // Delete assignment
    await prisma.assignment.delete({
      where: { id: assignmentId }
    });

    // Check if car has any other assignments
    const otherAssignments = await prisma.assignment.count({
      where: { carId: assignment.carId }
    });

    // Update car status if no other assignments
    if (otherAssignments === 0) {
      await prisma.car.update({
        where: { id: assignment.carId },
        data: { status: 'unscheduled' }
      });
    }

    res.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * GET /api/schedule/utilization
 * Get shop utilization for a specific month
 */
router.get('/utilization', async (req: Request, res: Response) => {
  try {
    const { month } = req.query;

    if (!month) {
      throw createError('month parameter is required', 400);
    }

    const monthDate = new Date(month as string);

    const shops = await prisma.shop.findMany({
      include: {
        assignments: {
          where: { month: monthDate }
        }
      }
    });

    const utilization = shops.map(shop => ({
      shopId: shop.id,
      shopName: shop.name,
      capacity: shop.capacity,
      assigned: shop.assignments.length,
      utilizationPercent: (shop.assignments.length / shop.capacity) * 100,
      isOverCapacity: shop.assignments.length > shop.capacity
    }));

    res.json({
      success: true,
      data: utilization,
      month: monthDate.toISOString()
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/schedule/undo
 * Undo last action
 */
router.post('/undo', async (req: Request, res: Response) => {
  try {
    if (undoStack.length === 0) {
      throw createError('Nothing to undo', 400);
    }

    const action = undoStack.pop()!;
    redoStack.push(action);

    // Reverse the action
    if (action.type === 'create') {
      const assignment = action.data.assignment;
      await prisma.assignment.delete({
        where: { id: assignment.id }
      });

      // Check if car has other assignments
      const otherAssignments = await prisma.assignment.count({
        where: { carId: assignment.carId }
      });

      if (otherAssignments === 0) {
        await prisma.car.update({
          where: { id: assignment.carId },
          data: { status: 'unscheduled' }
        });
      }
    } else if (action.type === 'delete') {
      const assignment = action.data.assignment;
      await prisma.assignment.create({
        data: {
          carId: assignment.carId,
          shopId: assignment.shopId,
          month: assignment.month
        }
      });

      await prisma.car.update({
        where: { id: assignment.carId },
        data: { status: 'scheduled' }
      });
    }

    res.json({
      success: true,
      message: 'Action undone',
      undoStackSize: undoStack.length,
      redoStackSize: redoStack.length
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * POST /api/schedule/redo
 * Redo last undone action
 */
router.post('/redo', async (req: Request, res: Response) => {
  try {
    if (redoStack.length === 0) {
      throw createError('Nothing to redo', 400);
    }

    const action = redoStack.pop()!;
    undoStack.push(action);

    // Reapply the action
    if (action.type === 'create') {
      const assignment = action.data.assignment;
      await prisma.assignment.create({
        data: {
          carId: assignment.carId,
          shopId: assignment.shopId,
          month: assignment.month
        }
      });

      await prisma.car.update({
        where: { id: assignment.carId },
        data: { status: 'scheduled' }
      });
    } else if (action.type === 'delete') {
      const assignment = action.data.assignment;
      await prisma.assignment.delete({
        where: { id: assignment.id }
      });

      const otherAssignments = await prisma.assignment.count({
        where: { carId: assignment.carId }
      });

      if (otherAssignments === 0) {
        await prisma.car.update({
          where: { id: assignment.carId },
          data: { status: 'unscheduled' }
        });
      }
    }

    res.json({
      success: true,
      message: 'Action redone',
      undoStackSize: undoStack.length,
      redoStackSize: redoStack.length
    });
  } catch (error: any) {
    throw createError(error.message, error.statusCode || 500);
  }
});

/**
 * GET /api/schedule/history
 * Get undo/redo stack info
 */
router.get('/history', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      undoStackSize: undoStack.length,
      redoStackSize: redoStack.length,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0
    }
  });
});

export default router;
