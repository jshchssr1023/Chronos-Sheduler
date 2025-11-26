// =============================================================================
// Scheduler Page - Main scheduling interface for car assignments
// =============================================================================

import { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  AlertTriangle,
  CheckCircle2,
  X,
  Building2,
  Car as CarIcon,
} from 'lucide-react';
import { scheduleApi, shopsApi } from '../services/api';
import PriorityBadge, { PriorityDot } from '../components/PriorityBadge';
import type { Car, Shop, Assignment, ShopUtilization, HistoryState } from '../types';

export default function Scheduler() {
  // State
  const [unassignedCars, setUnassignedCars] = useState<Car[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [utilization, setUtilization] = useState<ShopUtilization[]>([]);
  const [history, setHistory] = useState<HistoryState>({ undoStackSize: 0, redoStackSize: 0, canUndo: false, canRedo: false });
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Format month for display and API
  const monthString = useMemo(() => {
    return currentMonth.toISOString().substring(0, 7);
  }, [currentMonth]);

  const monthDisplay = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  // Load data
  useEffect(() => {
    loadData();
  }, [monthString]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [unassigned, allAssignments, allShops, util, hist] = await Promise.all([
        scheduleApi.getUnassigned(),
        scheduleApi.getAssignments(monthString),
        shopsApi.getAll(),
        scheduleApi.getUtilization(monthString),
        scheduleApi.getHistory(),
      ]);

      setUnassignedCars(unassigned);
      setAssignments(allAssignments);
      setShops(allShops);
      setUtilization(util);
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Assignment actions
  const handleAssign = async (shopId: number) => {
    if (!selectedCar) return;

    try {
      setActionLoading(true);
      setError(null);

      await scheduleApi.assign({
        carId: selectedCar.id,
        shopId,
        month: monthString,
      });

      setSuccessMessage(`${selectedCar.mark} assigned successfully!`);
      setSelectedCar(null);
      await loadData();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign car');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassign = async (assignmentId: number) => {
    if (!confirm('Are you sure you want to unassign this car?')) return;

    try {
      setActionLoading(true);
      setError(null);

      await scheduleApi.unassign(assignmentId);
      setSuccessMessage('Car unassigned successfully!');
      await loadData();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unassign car');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndo = async () => {
    try {
      setActionLoading(true);
      await scheduleApi.undo();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRedo = async () => {
    try {
      setActionLoading(true);
      await scheduleApi.redo();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redo');
    } finally {
      setActionLoading(false);
    }
  };

  // Get shop utilization data
  const getShopUtilization = (shopId: number) => {
    return utilization.find((u) => u.shopId === shopId);
  };

  // Get assignments for a shop
  const getShopAssignments = (shopId: number) => {
    return assignments.filter((a) => a.shopId === shopId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="px-3 py-1 font-medium text-gray-900 min-w-[160px] text-center">
              {monthDisplay}
            </span>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={!history.canUndo || actionLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Undo2 size={16} />
            Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!history.canRedo || actionLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Redo2 size={16} />
            Redo
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={16} className="text-red-500" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unassigned Cars Panel */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <CarIcon size={18} />
              Unassigned Cars
              <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                {unassignedCars.length}
              </span>
            </h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {unassignedCars.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-300 mb-3" />
                <p className="font-medium">All cars scheduled!</p>
                <p className="text-sm mt-1">No unassigned cars remaining.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {unassignedCars.map((car) => (
                  <button
                    key={car.id}
                    onClick={() => setSelectedCar(selectedCar?.id === car.id ? null : car)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedCar?.id === car.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{car.mark}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{car.customer}</p>
                      </div>
                      <PriorityBadge priority={car.priority} size="sm" />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>{car.type}</span>
                      <span>Due: {new Date(car.qualDue).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shops Grid */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCar && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Selected for assignment:</p>
                  <p className="font-medium text-blue-900">
                    {selectedCar.mark} - {selectedCar.customer}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCar(null)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shops.map((shop) => {
              const util = getShopUtilization(shop.id);
              const shopAssignments = getShopAssignments(shop.id);
              const utilizationPercent = util?.utilizationPercent || 0;
              const isOverCapacity = util?.isOverCapacity || false;

              return (
                <div
                  key={shop.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{shop.name}</h3>
                        <p className="text-sm text-gray-500">{shop.city}</p>
                      </div>
                      {selectedCar && (
                        <button
                          onClick={() => handleAssign(shop.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Assign
                        </button>
                      )}
                    </div>

                    {/* Utilization Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">
                          {util?.assigned || 0} / {shop.capacity}
                        </span>
                        <span
                          className={`font-medium ${
                            isOverCapacity
                              ? 'text-red-600'
                              : utilizationPercent >= 80
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {utilizationPercent.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOverCapacity
                              ? 'bg-red-500'
                              : utilizationPercent >= 80
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Assigned Cars */}
                  <div className="max-h-[200px] overflow-y-auto">
                    {shopAssignments.length === 0 ? (
                      <div className="p-4 text-center text-gray-400 text-sm">
                        No assignments this month
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {shopAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="p-3 flex items-center justify-between hover:bg-gray-50 group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <PriorityDot priority={assignment.car?.priority || 'Medium'} />
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {assignment.car?.mark}
                              </span>
                            </div>
                            <button
                              onClick={() => handleUnassign(assignment.id)}
                              className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Unassign"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {shops.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No shops configured</p>
              <p className="text-sm text-gray-500 mt-1">
                Add shops to start scheduling cars.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
