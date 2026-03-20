import { useState, useEffect } from "react";
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
  ResponsiveContainer,
  Label
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
import { supabase } from "../../supabaseClient";

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [reportType, setReportType] = useState<string>("monthly");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [loading, setLoading] = useState(true);

  // Chart data states
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [topRequestedItems, setTopRequestedItems] = useState<any[]>([]);
  const [departmentActivity, setDepartmentActivity] = useState<any[]>([]);

  // Stat card states
  const [totalRequestsWeek, setTotalRequestsWeek] = useState(0);
  const [itemsNeedRestock, setItemsNeedRestock] = useState(0);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWeeklyRequests(),
        fetchMonthlyTrend(),
        fetchTopRequestedItems(),
        fetchDepartmentActivity(),
        fetchSummaryStats(),
      ]);
    } catch (error) {
      toast.error("Failed to load analytics data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyRequests = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from("requests")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString());

    if (error) return console.error(error);
    setTotalRequestsWeek(data?.length || 0);
  };

  const fetchMonthlyTrend = async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data, error } = await supabase
      .from("requests")
      .select("created_at, quantity_requested")
      .gte("created_at", sixMonthsAgo.toISOString());

    if (error) return console.error(error);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const grouped: Record<string, { month: string; items: number }> = {};

    (data || []).forEach((row) => {
      const month = months[new Date(row.created_at).getMonth()];
      if (!grouped[month]) grouped[month] = { month, items: 0 };
      grouped[month].items += row.quantity_requested || 0;
    });

    setMonthlyTrendData(Object.values(grouped));
  };

  const fetchTopRequestedItems = async () => {
    const { data, error } = await supabase
      .from("requests")
      .select("description, quantity_requested, created_at");

    if (error) return console.error(error);

    // Get current month data
    const now = new Date();
    const thisMonth = now.getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;

    const thisMonthCounts: Record<string, number> = {};
    const lastMonthCounts: Record<string, number> = {};

    (data || []).forEach((row) => {
      const month = new Date(row.created_at).getMonth();
      const name = row.description || "Unknown";
      if (month === thisMonth) {
        thisMonthCounts[name] = (thisMonthCounts[name] || 0) + 1;
      }
      if (month === lastMonth) {
        lastMonthCounts[name] = (lastMonthCounts[name] || 0) + 1;
      }
    });

    const result = Object.entries(thisMonthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, requests]) => {
        const prev = lastMonthCounts[name] || 0;
        const trend = prev > 0 ? Math.round(((requests - prev) / prev) * 100) : 0;
        return { name, requests, trend };
      });

    // Category distribution from descriptions
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
    const total = Object.values(thisMonthCounts).reduce((a, b) => a + b, 0);
    const catResult = Object.entries(thisMonthCounts)
      .slice(0, 6)
      .map(([name, count], i) => ({
        name,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
        color: colors[i % colors.length],
      }));

    setTopRequestedItems(result);
    setCategoryDistribution(catResult);
  };

  const fetchDepartmentActivity = async () => {
    const { data, error } = await supabase
      .from("requests")
      .select("department");

    if (error) return console.error(error);

    const grouped: Record<string, number> = {};
    (data || []).forEach((row) => {
      if (row.department) {
        grouped[row.department] = (grouped[row.department] || 0) + 1;
      }
    });

    const result = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([dept, requests]) => ({ dept, requests }));

    setDepartmentActivity(result);
  };

  const fetchSummaryStats = async () => {
    // Items needing restock (remaining_stock = 0)
    const { count } = await supabase
      .from("inventory")
      .select("*", { count: "exact", head: true })
      .eq("remaining_stock", 0);

    setItemsNeedRestock(count || 0);
  };

  const menuItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/inbox", icon: Inbox, label: "Inbox" },
    { path: "/admin/inventory", icon: Package, label: "Inventory" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics Report" },
  ];

  const handleLogout = () => navigate("/admin/login");

  const handleGenerateReport = (type: string) => {
    toast.success(`Generating ${type} report...`);
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
                onClick={() => { setIsSidebarPinned(true); setIsSidebarExpanded(true); navigate(item.path); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active ? "bg-[#4A89B0] text-white shadow-md" : "text-gray-700 hover:bg-gray-100"
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
      <main className={`pt-16 transition-all duration-300 ${isSidebarExpanded || isSidebarPinned ? "pl-64" : "pl-20"}`}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-8 h-8 opacity-80" />
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="text-3xl font-bold">{loading ? "..." : totalRequestsWeek}</div>
                <div className="text-sm opacity-90 mt-1">Total Requests (Week)</div>
                <div className="text-xs opacity-75 mt-2">{loading ? "Loading..." : "Live data"}</div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-8 h-8 opacity-80" />
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div className="text-3xl font-bold">{loading ? "..." : itemsNeedRestock}</div>
                <div className="text-sm opacity-90 mt-1">Items Need Restock</div>
                <div className="text-xs opacity-75 mt-2">{loading ? "Loading..." : "Items at 0 stock"}</div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Category Distribution</h3>
                    <p className="text-sm text-gray-600 mt-1">Percentage of requests by item</p>
                  </div>
                </div>
                {categoryDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={categoryDistribution} cx="50%" cy="50%" labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`} outerRadius={100} fill="#8884d8" dataKey="value">
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
                      <p className="text-sm">{loading ? "Loading..." : "No data available"}</p>
                      <p className="text-xs">Data will appear once requests are submitted</p>
                    </div>
                  </div>
                )}
              </div>

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
                      <p className="text-sm">{loading ? "Loading..." : "No data available"}</p>
                      <p className="text-xs">Data will appear once requests are submitted</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Charts Row 2 - 6-Month Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">6-Month Trend Analysis</h3>
                  <p className="text-sm text-gray-600 mt-1">Items distributed over time</p>
                </div>
              </div>
              {monthlyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" />
                    <YAxis>
                      <Label value="Number of Items" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="items" stroke="#3b82f6" strokeWidth={2} name="Items Distributed" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{loading ? "Loading..." : "No data available"}</p>
                    <p className="text-xs">Data will appear once requests are submitted</p>
                  </div>
                </div>
              )}
            </div>

            {/* DSS - Top Requested Items */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Decision Support System</h3>
                  <p className="text-sm text-gray-600 mt-1">Top requested items with trend analysis</p>
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
                          item.trend > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
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
                    <p className="text-sm">{loading ? "Loading..." : "No trend data available"}</p>
                    <p className="text-xs">Data will appear once requests are submitted</p>
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
                <button onClick={() => handleGenerateReport("RIS Weekly")} className="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 rounded-lg p-6 text-left transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/20 p-2 rounded-lg"><Calendar className="w-5 h-5" /></div>
                    <div className="font-semibold">RIS Weekly</div>
                  </div>
                  <div className="text-sm text-white/80">Requisition and Issue Slip - Weekly summary</div>
                </button>
                <button onClick={() => handleGenerateReport("Monthly Report")} className="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 rounded-lg p-6 text-left transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/20 p-2 rounded-lg"><BarChart3 className="w-5 h-5" /></div>
                    <div className="font-semibold">Monthly Report</div>
                  </div>
                  <div className="text-sm text-white/80">Comprehensive monthly analytics and insights</div>
                </button>
                <button onClick={() => handleGenerateReport("SSMI Report")} className="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 rounded-lg p-6 text-left transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/20 p-2 rounded-lg"><Package className="w-5 h-5" /></div>
                    <div className="font-semibold">SSMI Report</div>
                  </div>
                  <div className="text-sm text-white/80">Stock Status and Management Inventory</div>
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
