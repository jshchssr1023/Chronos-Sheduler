// =============================================================================
// Analytics Page - Charts and performance insights
// =============================================================================

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Building2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { analyticsApi } from '../services/api';
import KPICard from '../components/KPICard';
import { PageHeader } from '../components/Navigation';
import type { ShopPerformance, ForecastData, DashboardData } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function Analytics() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [shopPerformance, setShopPerformance] = useState<ShopPerformance[]>([]);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashboardData, performanceData, forecastData] = await Promise.all([
        analyticsApi.getDashboard(),
        analyticsApi.getShopPerformance(),
        analyticsApi.getForecast(6),
      ]);
      setDashboard(dashboardData);
      setShopPerformance(performanceData);
      setForecast(forecastData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Chart data configurations
  const utilizationChartData = useMemo(() => {
    if (!shopPerformance.length) return null;

    return {
      labels: shopPerformance.map((s) => s.shopName),
      datasets: [
        {
          label: 'Current Utilization %',
          data: shopPerformance.map((s) => s.avgUtilization),
          backgroundColor: shopPerformance.map((s) =>
            s.avgUtilization > 100
              ? 'rgba(239, 68, 68, 0.7)'
              : s.avgUtilization >= 80
              ? 'rgba(245, 158, 11, 0.7)'
              : 'rgba(34, 197, 94, 0.7)'
          ),
          borderColor: shopPerformance.map((s) =>
            s.avgUtilization > 100
              ? 'rgb(239, 68, 68)'
              : s.avgUtilization >= 80
              ? 'rgb(245, 158, 11)'
              : 'rgb(34, 197, 94)'
          ),
          borderWidth: 1,
        },
      ],
    };
  }, [shopPerformance]);

  const priorityChartData = useMemo(() => {
    if (!dashboard) return null;

    const { carsByPriority } = dashboard;
    return {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [
        {
          data: [
            carsByPriority.Critical || 0,
            carsByPriority.High || 0,
            carsByPriority.Medium || 0,
            carsByPriority.Low || 0,
          ],
          backgroundColor: [
            'rgba(239, 68, 68, 0.7)',
            'rgba(249, 115, 22, 0.7)',
            'rgba(234, 179, 8, 0.7)',
            'rgba(34, 197, 94, 0.7)',
          ],
          borderColor: [
            'rgb(239, 68, 68)',
            'rgb(249, 115, 22)',
            'rgb(234, 179, 8)',
            'rgb(34, 197, 94)',
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [dashboard]);

  const forecastChartData = useMemo(() => {
    if (!forecast.length) return null;

    // Get all unique months
    const allMonths = new Set<string>();
    forecast.forEach((f) => f.forecast.forEach((p) => allMonths.add(p.month)));
    const months = Array.from(allMonths).sort();

    // Create datasets for each shop
    const datasets = forecast.slice(0, 5).map((shop, index) => {
      const colors = [
        { bg: 'rgba(59, 130, 246, 0.5)', border: 'rgb(59, 130, 246)' },
        { bg: 'rgba(139, 92, 246, 0.5)', border: 'rgb(139, 92, 246)' },
        { bg: 'rgba(16, 185, 129, 0.5)', border: 'rgb(16, 185, 129)' },
        { bg: 'rgba(245, 158, 11, 0.5)', border: 'rgb(245, 158, 11)' },
        { bg: 'rgba(239, 68, 68, 0.5)', border: 'rgb(239, 68, 68)' },
      ];
      const color = colors[index % colors.length];

      return {
        label: shop.shopName,
        data: months.map((month) => {
          const point = shop.forecast.find((p) => p.month === month);
          return point?.utilizationPercent || 0;
        }),
        borderColor: color.border,
        backgroundColor: color.bg,
        tension: 0.3,
        fill: false,
      };
    });

    return {
      labels: months.map((m) => {
        const date = new Date(m + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }),
      datasets,
    };
  }, [forecast]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
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
        <AlertTriangle className="text-red-500 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-red-800">Error loading analytics</h3>
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <button
          onClick={loadData}
          className="ml-auto px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Performance insights and forecasting"
        actions={
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      {/* Summary KPIs */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Capacity"
            value={dashboard.kpis.totalCapacity}
            subtitle="Across all shops"
            icon={<Building2 size={24} />}
            color="blue"
          />
          <KPICard
            title="Overall Utilization"
            value={`${dashboard.kpis.utilizationPercent.toFixed(1)}%`}
            icon={<BarChart3 size={24} />}
            color={
              dashboard.kpis.utilizationPercent > 100
                ? 'red'
                : dashboard.kpis.utilizationPercent >= 80
                ? 'yellow'
                : 'green'
            }
          />
          <KPICard
            title="Scheduled"
            value={dashboard.kpis.scheduledCars}
            subtitle={`of ${dashboard.kpis.totalCars} cars`}
            icon={<TrendingUp size={24} />}
            color="green"
          />
          <KPICard
            title="Pending Quals"
            value={dashboard.kpis.upcomingQuals}
            subtitle="Next 30 days"
            icon={<AlertTriangle size={24} />}
            color={dashboard.kpis.upcomingQuals > 10 ? 'red' : 'yellow'}
          />
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shop Utilization Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Shop Utilization</h3>
          <div className="h-[300px]">
            {utilizationChartData ? (
              <Bar
                data={utilizationChartData}
                options={{
                  ...chartOptions,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: Math.max(100, ...shopPerformance.map((s) => s.avgUtilization)) + 10,
                      ticks: {
                        callback: (value) => `${value}%`,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Priority Distribution Doughnut */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Priority Distribution</h3>
          <div className="h-[300px] flex items-center justify-center">
            {priorityChartData ? (
              <Doughnut
                data={priorityChartData}
                options={{
                  ...chartOptions,
                  cutout: '60%',
                }}
              />
            ) : (
              <div className="text-gray-500">No data available</div>
            )}
          </div>
        </div>

        {/* Forecast Line Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">6-Month Utilization Forecast</h3>
          <div className="h-[350px]">
            {forecastChartData ? (
              <Line
                data={forecastChartData}
                options={{
                  ...chartOptions,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => `${value}%`,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No forecast data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shop Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Shop Performance Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Shop</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">City</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Capacity</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Assigned</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Utilization</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Critical</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">High</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Medium</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Low</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shopPerformance.map((shop) => (
                <tr key={shop.shopId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{shop.shopName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{shop.city}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{shop.capacity}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{shop.totalAssigned}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        shop.avgUtilization > 100
                          ? 'bg-red-100 text-red-700'
                          : shop.avgUtilization >= 80
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {shop.avgUtilization.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="text-red-600 font-medium">{shop.priorityBreakdown.Critical || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="text-orange-600 font-medium">{shop.priorityBreakdown.High || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="text-yellow-600 font-medium">{shop.priorityBreakdown.Medium || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="text-green-600 font-medium">{shop.priorityBreakdown.Low || 0}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forecast Alerts */}
      {forecast.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Capacity Alerts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forecast
              .filter((shop) => shop.forecast.some((p) => p.status === 'over'))
              .map((shop) => (
                <div
                  key={shop.shopId}
                  className="p-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="font-medium text-red-800">{shop.shopName}</p>
                      <p className="text-sm text-red-600 mt-1">
                        Projected over capacity in{' '}
                        {shop.forecast
                          .filter((p) => p.status === 'over')
                          .map((p) => p.month)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            {forecast.filter((shop) => shop.forecast.some((p) => p.status === 'over')).length === 0 && (
              <div className="col-span-full p-8 text-center text-gray-500">
                <TrendingUp className="mx-auto h-12 w-12 text-green-300 mb-3" />
                <p className="font-medium text-green-700">All shops within capacity</p>
                <p className="text-sm text-gray-500 mt-1">No capacity alerts for the next 6 months</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
