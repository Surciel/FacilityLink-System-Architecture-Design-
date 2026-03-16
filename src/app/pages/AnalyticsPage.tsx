import { useState } from "react";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Package,
  AlertCircle,
  LayoutDashboard,
  Inbox,
  BarChart3,
  LogOut,
  PackageOpen
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

// ============================================================================
// DATABASE INTEGRATION: PostgreSQL - Analytics & Reports
// ============================================================================
// TODO: Replace these empty arrays with actual database aggregation queries
//
// WEEKLY REQUESTS DATA:
// const weeklyRequestData = await db.query(`
//   SELECT 
//     TO_CHAR(created_at, 'Day') as day,
//     COUNT(*) as requests,
//     COUNT(*) FILTER (WHERE status = 'approved') as approved,
//     COUNT(*) FILTER (WHERE status = 'rejected') as rejected
//   FROM requests
//   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
//   GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
//   ORDER BY EXTRACT(DOW FROM created_at)
// `);
//
// MONTHLY TREND DATA:
// const monthlyTrendData = await db.query(`
//   SELECT 
//     TO_CHAR(created_at, 'Mon') as month,
//     COUNT(DISTINCT ri.id) as items,
//     SUM(i.price_per_unit * ri.quantity) as value
//   FROM requests r
//   JOIN request_items ri ON r.id = ri.request_id
//   JOIN inventory i ON ri.item_name = i.name
//   WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
//   GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
//   ORDER BY EXTRACT(MONTH FROM created_at)
// `);
//
// CATEGORY DISTRIBUTION:
// const categoryDistribution = await db.query(`
//   SELECT 
//     ri.category as name,
//     COUNT(*) as value
//   FROM request_items ri
//   GROUP BY ri.category
//   ORDER BY value DESC
// `);
//
// TOP REQUESTED ITEMS:
// const topRequestedItems = await db.query(`
//   SELECT 
//     item_name as name,
//     COUNT(*) as requests,
//     ((COUNT(*) - prev_count)::float / prev_count * 100) as trend
//   FROM request_items
//   GROUP BY item_name
//   ORDER BY requests DESC
//   LIMIT 10
// `);
//
// DEPARTMENT ACTIVITY:
// const departmentActivity = await db.query(`
//   SELECT 
//     department as dept,
//     COUNT(*) as requests
//   FROM requests
//   GROUP BY department
//   ORDER BY requests DESC
// `);
// ============================================================================

const weeklyRequestData: any[] = [];
const monthlyTrendData: any[] = [];
const categoryDistribution: any[] = [];
const topRequestedItems: any[] = [];
const departmentActivity: any[] = [];

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [reportType, setReportType] = useState<string>("monthly");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);

  const menuItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/inbox", icon: Inbox, label: "Inbox" },
    { path: "/admin/inventory", icon: Package, label: "Inventory" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics Report" },
  ];

  const handleLogout = () => {
    navigate("/admin/login");
  };

  const handleGenerateReport = (type: string) => {
    toast.success(`Generating ${type} report...`);
    // In a real application, this would generate and download a PDF/Excel file
    console.log(`Generating ${type} report`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="bg-[#4A89B0] p-2 rounded-lg">
              <PackageOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">FacilityLink: Centralized Inventory System</h1>
              <p className="text-xs text-gray-500">Admin Portal</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        onMouseEnter={() => !isSidebarPinned && setIsSidebarExpanded(true)}
        onMouseLeave={() => !isSidebarPinned && setIsSidebarExpanded(false)}
        className={`fixed top-16 left-0 bottom-0 bg-white shadow-lg transition-all duration-300 z-20 ${
          isSidebarExpanded || isSidebarPinned ? "w-64" : "w-20"
        }`}
      >
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === "/admin/analytics";
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  setIsSidebarPinned(true);
                  setIsSidebarExpanded(true);
                  navigate(item.path);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? "bg-[#4A89B0] text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className={`font-medium whitespace-nowrap transition-opacity duration-300 ${
                  isSidebarExpanded || isSidebarPinned ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={`pt-16 transition-all duration-300 ${
        isSidebarExpanded || isSidebarPinned ? "pl-64" : "pl-20"
      }`}>
        <div className="p-4 lg:p-8">
          <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">Insights and trends from your inventory data</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
          >
            <option value="weekly">Weekly View</option>
            <option value="monthly">Monthly View</option>
            <option value="yearly">Yearly View</option>
          </select>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold">0</div>
          <div className="text-sm opacity-90 mt-1">Total Requests (Week)</div>
          <div className="text-xs opacity-75 mt-2">No data yet</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold">0%</div>
          <div className="text-sm opacity-90 mt-1">Approval Rate</div>
          <div className="text-xs opacity-75 mt-2">No data yet</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 opacity-80" />
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold">0</div>
          <div className="text-sm opacity-90 mt-1">Items Need Restock</div>
          <div className="text-xs opacity-75 mt-2">No data yet</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold">0</div>
          <div className="text-sm opacity-90 mt-1">Avg. Days to Process</div>
          <div className="text-xs opacity-75 mt-2">No data yet</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly Requests Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Weekly Request Overview</h3>
              <p className="text-sm text-gray-600 mt-1">Breakdown of requests by status</p>
            </div>
          </div>
          {weeklyRequestData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyRequestData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" fill="#10b981" name="Approved" />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No data available</p>
                <p className="text-xs">Connect your database to see weekly request data</p>
              </div>
            </div>
          )}
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Category Distribution</h3>
              <p className="text-sm text-gray-600 mt-1">Percentage of requests by category</p>
            </div>
          </div>
          {categoryDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No data available</p>
                <p className="text-xs">Connect your database to see category distribution</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">6-Month Trend Analysis</h3>
              <p className="text-sm text-gray-600 mt-1">Item distribution and value over time</p>
            </div>
          </div>
          {monthlyTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="items" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Items Distributed"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Total Value (₱)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No data available</p>
                <p className="text-xs">Connect your database to see monthly trends</p>
              </div>
            </div>
          )}
        </div>

        {/* Department Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Department Activity</h3>
              <p className="text-sm text-gray-600 mt-1">Requests by department</p>
            </div>
          </div>
          {departmentActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentActivity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" />
                <YAxis dataKey="dept" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="requests" fill="#8b5cf6" name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No data available</p>
                <p className="text-xs">Connect your database to see department activity</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DSS - Top Requested Items */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Decision Support System</h3>
            <p className="text-sm text-gray-600 mt-1">
              Top requested items with trend analysis - Helps identify which materials need increased stock
            </p>
          </div>
        </div>

        {topRequestedItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topRequestedItems.map((item, index) => (
              <div key={index} className="p-4 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                    <div className="text-2xl font-bold text-[#4A89B0] mt-1">{item.requests}</div>
                    <div className="text-xs text-gray-600">requests this month</div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${
                    item.trend > 0 
                      ? "bg-green-100 text-green-700" 
                      : "bg-red-100 text-red-700"
                  }`}>
                    {item.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(item.trend)}%
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-700">
                    {item.trend > 0 ? (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-orange-500" />
                        Consider increasing stock for next restock
                      </span>
                    ) : (
                      <span className="text-gray-500">Demand stable or decreasing</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No trend data available</p>
              <p className="text-xs">Connect your database to see top requested items and trends</p>
            </div>
          </div>
        )}
      </div>

      {/* Report Generation */}
      <div className="bg-gradient-to-br from-[#5891B8] via-[#4A89B0] to-[#3776A0] rounded-xl shadow-sm p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Generate Reports</h3>
            <p className="text-white/80">Download detailed reports in various formats</p>
          </div>
          <Download className="w-12 h-12 opacity-50" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleGenerateReport("RIS Weekly")}
            className="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 rounded-lg p-6 text-left transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="font-semibold">RIS Weekly</div>
            </div>
            <div className="text-sm text-white/80">
              Requisition and Issue Slip - Weekly summary
            </div>
          </button>

          <button
            onClick={() => handleGenerateReport("Monthly Report")}
            className="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 rounded-lg p-6 text-left transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <BarChart className="w-5 h-5" />
              </div>
              <div className="font-semibold">Monthly Report</div>
            </div>
            <div className="text-sm text-white/80">
              Comprehensive monthly analytics and insights
            </div>
          </button>

          <button
            onClick={() => handleGenerateReport("SSMI Report")}
            className="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 rounded-lg p-6 text-left transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Package className="w-5 h-5" />
              </div>
              <div className="font-semibold">SSMI Report</div>
            </div>
            <div className="text-sm text-white/80">
              Stock Status and Management Inventory
            </div>
          </button>
        </div>
      </div>
          </div>
        </div>
      </main>
    </div>
  );
}