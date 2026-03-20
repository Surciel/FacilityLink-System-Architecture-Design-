import { useState, useEffect } from "react";
import { 
  PackageOpen, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  ChevronRight,
  Search,
  Bell,
  LayoutDashboard,
  Inbox,
  BarChart3,
  LogOut
} from "lucide-react";
import { useNavigate } from "react-router";
import { supabase } from "../../supabaseClient";

export function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [requests, setRequests] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRequests(),
        fetchLowStockItems(),
        fetchTotalItems(),
        fetchCompletedToday(),
      ]);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return console.error(error);
    setRequests(data || []);
  };

  const fetchLowStockItems = async () => {
    // Items where remaining_stock is 0 or very low (adjust threshold as needed)
    const { data, error } = await supabase
      .from("inventory")
      .select("item_no, description, unit, remaining_stock")
      .lte("remaining_stock", 10)
      .order("remaining_stock", { ascending: true })
      .limit(5);

    if (error) return console.error(error);
    setLowStockItems(data || []);
  };

  const fetchTotalItems = async () => {
    const { count, error } = await supabase
      .from("inventory")
      .select("*", { count: "exact", head: true });

    if (error) return console.error(error);
    setTotalItems(count || 0);
  };

  const fetchCompletedToday = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("created_at", today.toISOString());

    if (error) return console.error(error);
    setCompletedToday(count || 0);
  };

  const menuItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/inbox", icon: Inbox, label: "Inbox" },
    { path: "/admin/inventory", icon: PackageOpen, label: "Inventory" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics Report" },
  ];

  const handleLogout = () => navigate("/admin/login");

  const stats = [
    {
      label: "Total Items",
      value: loading ? "..." : totalItems,
      icon: PackageOpen,
      color: "bg-blue-500",
    },
    {
      label: "Low Stock Items",
      value: loading ? "..." : lowStockItems.length,
      icon: AlertTriangle,
      color: "bg-red-500",
    },
    {
      label: "Requests Today",
      value: loading ? "..." : completedToday,
      icon: TrendingUp,
      color: "bg-green-500",
    },
  ];

  const filteredRequests = requests.filter(req =>
    (req.requested_by?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (req.id?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (req.department?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

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
            const active = item.path === "/admin";
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
      <main className={`pt-16 transition-all duration-300 ${
        isSidebarExpanded || isSidebarPinned ? "pl-64" : "pl-20"
      }`}>
        <div className="p-4 lg:p-8">
          <div className="space-y-6">

            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Overview of your inventory management system</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`${stat.color} p-3 rounded-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6">

              {/* Recent Requests */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-[#4A89B0]" />
                      <h2 className="text-xl font-bold text-gray-900">Recent Requests</h2>
                    </div>
                    <button
                      onClick={() => navigate("/admin/inbox")}
                      className="text-[#4A89B0] hover:text-[#3776A0] text-sm font-medium flex items-center gap-1"
                    >
                      View All <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search requests..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading requests...</div>
                  ) : filteredRequests.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No requests found</div>
                  ) : (
                    filteredRequests.slice(0, 5).map((request) => (
                      <div
                        key={request.pkid}
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => navigate("/admin/inbox")}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-blue-600" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{request.requested_by}</span>
                                <span className="text-xs text-gray-500">({request.department})</span>
                              </div>
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {new Date(request.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              <span className="font-mono">{request.pkid?.slice(0, 8) ?? "N/A"}...</span>
                            </div>
                            <div className="text-sm text-gray-700">
                              Item: {request.description} — Qty: {request.quantity_requested} {request.unit}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Low Stock Items */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <h2 className="text-xl font-bold text-gray-900">Priority Items</h2>
                    </div>
                    <button
                      onClick={() => navigate("/admin/inventory")}
                      className="text-[#4A89B0] hover:text-[#3776A0] text-sm font-medium flex items-center gap-1"
                    >
                      View All <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">Items with lowest stock levels</p>
                </div>

                <div className="p-4 space-y-3">
                  {loading ? (
                    <div className="text-center text-gray-400 py-4">Loading...</div>
                  ) : lowStockItems.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">All items are well stocked!</div>
                  ) : (
                    lowStockItems.map((item, index) => {
                      // Use 10 as the minimum threshold for progress bar
                      const minimum = 10;
                      const percentage = Math.min((item.remaining_stock / minimum) * 100, 100);
                      return (
                        <div key={index} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 text-sm">{item.description}</div>
                              <div className="text-xs text-gray-600">{item.item_no}</div>
                            </div>
                            <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">
                              {item.remaining_stock} {item.unit}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>Stock Level</span>
                              <span>{Math.round(percentage)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  percentage < 30 ? "bg-red-600" : percentage < 60 ? "bg-orange-500" : "bg-green-500"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}