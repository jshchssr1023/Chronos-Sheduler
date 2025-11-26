// =============================================================================
// Dashboard Page - Overview with KPIs and recent activity
// =============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  Building2,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import KPICard from '../components/KPICard';
import PriorityBadge from '../components/PriorityBadge';
import { analyticsApi } from '../services/api';
import type { DashboardData, Priority } from '../types';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const dashboardData = await analyticsApi.getDashboard();
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <XCircle className="text-red-500 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-red-800">Error loading dashboard</h3>
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <button
          onClick={loadDashboard}
          className="ml-auto px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, carsByPriority, recentActivity } = data;

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Cars"
          value={kpis.totalCars}
          subtitle={`${kpis.unscheduledCars} unscheduled`}
          icon={<Car size={24} />}
          color="blue"
        />
        <KPICard
          title="Total Shops"
          value={kpis.totalShops}
          subtitle={`${kpis.totalCapacity} total capacity`}
          icon={<Building2 size={24} />}
          color="purple"
        />
        <KPICard
          title="Assignments"
          value={kpis.totalAssignments}
          subtitle={`${kpis.utilizationPercent.toFixed(1)}% utilization`}
          icon={<Calendar size={24} />}
          color="green"
        />
        <KPICard
          title="Upcoming Quals"
          value={kpis.upcomingQuals}
          subtitle="Next 30 days"
          icon={<AlertTriangle size={24} />}
          color={kpis.upcomingQuals > 10 ? 'red' : 'yellow'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Distribution */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Priority Distribution</h3>
          <div className="space-y-3">
            {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((priority) => {
              const count = carsByPriority[priority] || 0;
              const percentage = kpis.totalCars > 0 ? (count / kpis.totalCars) * 100 : 0;

              return (
                <div key={priority} className="flex items-center gap-3">
                  <PriorityBadge priority={priority} size="sm" />
                  <div className="flex-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          priority === 'Critical'
                            ? 'bg-red-500'
                            : priority === 'High'
                            ? 'bg-orange-500'
                            : priority === 'Medium'
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-600 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Scheduled</span>
              <span className="font-medium text-gray-900">{kpis.scheduledCars}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500">Unscheduled</span>
              <span className="font-medium text-gray-900">{kpis.unscheduledCars}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            <Link
              to="/scheduler"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No recent activity</p>
              <Link
                to="/scheduler"
                className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-700"
              >
                Start scheduling →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.carMark}
                    </p>
                    <p className="text-xs text-gray-500">
                      Assigned to {activity.shopName} for {activity.month}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/scheduler"
            className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Schedule Cars</p>
              <p className="text-xs text-gray-500">{kpis.unscheduledCars} pending</p>
            </div>
          </Link>

          <Link
            to="/cars"
            className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200">
              <Car className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Manage Cars</p>
              <p className="text-xs text-gray-500">{kpis.totalCars} total</p>
            </div>
          </Link>

          <Link
            to="/scenarios"
            className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Plan Scenarios</p>
              <p className="text-xs text-gray-500">What-if analysis</p>
            </div>
          </Link>

          <Link
            to="/analytics"
            className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200">
              <Building2 className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">View Analytics</p>
              <p className="text-xs text-gray-500">Performance insights</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
