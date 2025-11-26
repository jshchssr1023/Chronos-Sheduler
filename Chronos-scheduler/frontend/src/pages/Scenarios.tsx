// =============================================================================
// Scenarios Page - What-if planning and scenario management
// =============================================================================

import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Play,
  Download,
  X,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Calendar,
  Building2,
  Car,
} from 'lucide-react';
import { scenariosApi, carsApi, shopsApi, downloadBlob } from '../services/api';
import { PageHeader } from '../components/Navigation';
import { FitStatusBadge } from '../components/PriorityBadge';
import type { Scenario, Car as CarType, Shop, EvaluationResult, ScenarioAssignment } from '../types';

export default function Scenarios() {
  // State
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cars, setCars] = useState<CarType[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active scenario
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [draftAssignments, setDraftAssignments] = useState<ScenarioAssignment[]>([]);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [scenariosData, carsData, shopsData] = await Promise.all([
        scenariosApi.getAll(),
        carsApi.getAll({ status: 'unscheduled', limit: 500 }),
        shopsApi.getAll(),
      ]);
      setScenarios(scenariosData);
      setCars(carsData.data);
      setShops(shopsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Create scenario
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;

    try {
      setError(null);
      const scenario = await scenariosApi.create(newScenarioName, {
        description: '',
        assignments: [],
      });
      setSuccessMessage('Scenario created successfully!');
      setShowCreateModal(false);
      setNewScenarioName('');
      setScenarios([scenario, ...scenarios]);
      setActiveScenario(scenario);
      setDraftAssignments([]);
      setEvaluationResult(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
    }
  };

  // Delete scenario
  const handleDelete = async (scenario: Scenario) => {
    if (!confirm(`Delete scenario "${scenario.name}"?`)) return;

    try {
      await scenariosApi.delete(scenario.id);
      setScenarios(scenarios.filter((s) => s.id !== scenario.id));
      if (activeScenario?.id === scenario.id) {
        setActiveScenario(null);
        setDraftAssignments([]);
        setEvaluationResult(null);
      }
      setSuccessMessage('Scenario deleted!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scenario');
    }
  };

  // Select scenario
  const handleSelectScenario = (scenario: Scenario) => {
    setActiveScenario(scenario);
    const data = scenario.data as { assignments?: ScenarioAssignment[] };
    setDraftAssignments(data.assignments || []);
    setEvaluationResult(null);
  };

  // Add assignment to draft
  const handleAddAssignment = (carId: number, shopId: number, month: string) => {
    // Check if already exists
    const exists = draftAssignments.find((a) => a.carId === carId && a.month === month);
    if (exists) return;

    setDraftAssignments([...draftAssignments, { carId, shopId, month }]);
    setEvaluationResult(null);
  };

  // Remove assignment from draft
  const handleRemoveAssignment = (index: number) => {
    setDraftAssignments(draftAssignments.filter((_, i) => i !== index));
    setEvaluationResult(null);
  };

  // Save scenario
  const handleSave = async () => {
    if (!activeScenario) return;

    try {
      setError(null);
      await scenariosApi.update(activeScenario.id, {
        data: {
          ...(activeScenario.data as object),
          assignments: draftAssignments,
        },
      });
      setSuccessMessage('Scenario saved!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scenario');
    }
  };

  // Evaluate scenario
  const handleEvaluate = async () => {
    if (draftAssignments.length === 0) {
      setError('Add some assignments to evaluate');
      return;
    }

    try {
      setError(null);
      const result = await scenariosApi.evaluate(draftAssignments);
      setEvaluationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate scenario');
    }
  };

  // Apply scenario
  const handleApply = async () => {
    if (!activeScenario || draftAssignments.length === 0) return;
    if (!confirm('Apply this scenario to the actual schedule? This cannot be undone.')) return;

    try {
      setError(null);
      // First save
      await handleSave();
      // Then apply
      const result = await scenariosApi.apply(activeScenario.id);
      setSuccessMessage(result.message);
      loadData(); // Reload to reflect changes
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply scenario');
    }
  };

  // Export
  const handleExport = async () => {
    try {
      const blob = await scenariosApi.export(activeScenario?.id, evaluationResult || undefined);
      downloadBlob(blob, `scenario_export_${Date.now()}.xlsx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
    }
  };

  // Get car by ID
  const getCarById = (id: number) => cars.find((c) => c.id === id);
  const getShopById = (id: number) => shops.find((s) => s.id === id);

  // Get next month string
  const getNextMonth = () => {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    return now.toISOString().substring(0, 7);
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
      <PageHeader
        title="Scenarios"
        description="Plan and evaluate what-if scenarios"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            New Scenario
          </button>
        }
      />

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Scenarios List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FlaskConical size={18} />
              Saved Scenarios
            </h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {scenarios.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FlaskConical className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p>No scenarios yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  Create your first →
                </button>
              </div>
            ) : (
              scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    activeScenario?.id === scenario.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => handleSelectScenario(scenario)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{scenario.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {((scenario.data as { assignments?: ScenarioAssignment[] }).assignments || []).length} assignments
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(scenario);
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Scenario Editor */}
        <div className="lg:col-span-3 space-y-4">
          {!activeScenario ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <FlaskConical className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select or Create a Scenario</h3>
              <p className="text-gray-500 mb-4">
                Scenarios let you plan assignments before applying them to the actual schedule.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Create New Scenario
              </button>
            </div>
          ) : (
            <>
              {/* Editor Header */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{activeScenario.name}</h3>
                    <p className="text-sm text-gray-500">
                      {draftAssignments.length} draft assignments
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleEvaluate}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                    >
                      <Play size={16} />
                      Evaluate
                    </button>
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={draftAssignments.length === 0}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Add Assignments */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                      <Car size={16} />
                      Available Cars
                    </h4>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {cars.filter((c) => !draftAssignments.find((a) => a.carId === c.id)).length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <p>All cars assigned or none available</p>
                      </div>
                    ) : (
                      cars
                        .filter((c) => !draftAssignments.find((a) => a.carId === c.id))
                        .slice(0, 20)
                        .map((car) => (
                          <div
                            key={car.id}
                            className="p-3 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">{car.mark}</p>
                              <p className="text-xs text-gray-500">{car.customer}</p>
                            </div>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddAssignment(car.id, parseInt(e.target.value), getNextMonth());
                                  e.target.value = '';
                                }
                              }}
                              className="text-xs px-2 py-1 border border-gray-200 rounded"
                              defaultValue=""
                            >
                              <option value="">Assign to...</option>
                              {shops.map((shop) => (
                                <option key={shop.id} value={shop.id}>
                                  {shop.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Draft Assignments */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                      <Calendar size={16} />
                      Draft Assignments
                    </h4>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {draftAssignments.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>No assignments yet</p>
                        <p className="text-xs mt-1">Select cars to assign</p>
                      </div>
                    ) : (
                      draftAssignments.map((assignment, index) => {
                        const car = getCarById(assignment.carId);
                        const shop = getShopById(assignment.shopId);
                        return (
                          <div
                            key={index}
                            className="p-3 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {car?.mark || `Car #${assignment.carId}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                → {shop?.name || `Shop #${assignment.shopId}`} | {assignment.month}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveAssignment(index)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Evaluation Results */}
              {evaluationResult && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 size={18} />
                    Evaluation Results
                    <span className="ml-auto text-lg font-bold text-blue-600">
                      Fit Score: {evaluationResult.fitScore.toFixed(0)}%
                    </span>
                  </h4>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{evaluationResult.summary.green}</p>
                      <p className="text-xs text-green-700">Good</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{evaluationResult.summary.yellow}</p>
                      <p className="text-xs text-yellow-700">Warning</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{evaluationResult.summary.red}</p>
                      <p className="text-xs text-red-700">Over Capacity</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {evaluationResult.shops.map((shop) => (
                      <div
                        key={shop.shopId}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{shop.shopName}</p>
                          <p className="text-xs text-gray-500">
                            {shop.totalAssigned} / {shop.capacity} ({shop.utilizationPercent.toFixed(0)}%)
                          </p>
                        </div>
                        <FitStatusBadge status={shop.status} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Scenario</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scenario Name
                </label>
                <input
                  type="text"
                  required
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Q1 Planning"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
