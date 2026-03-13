import { useState } from "react";
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

// ============================================================================
// DATABASE INTEGRATION: PostgreSQL
// ============================================================================
// TODO: Replace these empty arrays with actual database queries
// 
// REQUESTS TABLE SCHEMA SUGGESTION:
// - id (VARCHAR/UUID PRIMARY KEY)
// - requester_name (VARCHAR)
// - email (VARCHAR)
// - department (VARCHAR)
// - items (JSONB or separate items table with foreign key)
// - date (TIMESTAMP)
// - status (VARCHAR: 'pending', 'approved', 'rejected', 'completed')
// - priority (VARCHAR: 'low', 'medium', 'high')
// - read (BOOLEAN)
// - created_at (TIMESTAMP)
//
// EXAMPLE QUERY: 
// const mockRequests = await db.query('SELECT * FROM requests ORDER BY created_at DESC LIMIT 10');
// ============================================================================

const mockRequests: any[] = [];

// ============================================================================
// DATABASE INTEGRATION: PostgreSQL
// ============================================================================
// TODO: Replace this empty array with actual database query for low stock items
//
// INVENTORY TABLE - Low Stock Query:
// const lowStockItems = await db.query(
//   'SELECT name, current_stock as current, minimum_stock as minimum, unit, category 
//    FROM inventory 
//    WHERE current_stock < minimum_stock 
//    ORDER BY (current_stock::float / minimum_stock::float) ASC 
//    LIMIT 5'
// );
// ============================================================================

const lowStockItems: any[] = [];

export function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const menuItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/inbox", icon: Inbox, label: "Inbox" },
    { path: "/admin/inventory", icon: PackageOpen, label: "Inventory" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics Report" },
  ];

  const handleLogout = () => {
    navigate("/admin/login");
  };

  // ============================================================================
  // DATABASE INTEGRATION: Stats calculation from PostgreSQL
  // ============================================================================
  // TODO: Replace these hardcoded values with actual database aggregations
  // EXAMPLE QUERIES:
  // const pendingCount = await db.query('SELECT COUNT(*) FROM requests WHERE status = $1', ['pending']);
  // const totalItems = await db.query('SELECT COUNT(*) FROM inventory');
  // const lowStockCount = await db.query('SELECT COUNT(*) FROM inventory WHERE current_stock < minimum_stock');
  // const completedToday = await db.query('SELECT COUNT(*) FROM requests WHERE status = $1 AND DATE(created_at) = CURRENT_DATE', ['completed']);
  // ============================================================================

  const stats = [
    {
      label: "Pending Requests",
      value: mockRequests.filter(r => r.status === "pending").length || 0,
      icon: Clock,
      color: "bg-orange-500",
      trend: "+0%",
    },
    {
      label: "Total Items",
      value: "0",
      icon: PackageOpen,
      color: "bg-blue-500",
      trend: "+0%",
    },
    {
      label: "Low Stock Items",
      value: lowStockItems.length || 0,
      icon: AlertTriangle,
      color: "bg-red-500",
      trend: "+0%",
    },
    {
      label: "Completed Today",
      value: "0",
      icon: TrendingUp,
      color: "bg-green-500",
      trend: "+0%",
    },
  ];

  const filteredRequests = mockRequests.filter(req =>
    req.requester.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.department.toLowerCase().includes(searchQuery.toLowerCase())
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
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className={`fixed top-16 left-0 bottom-0 bg-white shadow-lg transition-all duration-300 z-20 ${
          isSidebarExpanded ? "w-64" : "w-20"
        }`}
      >
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === "/admin";
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? "bg-[#4A89B0] text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className={`font-medium whitespace-nowrap transition-opacity duration-300 ${
                  isSidebarExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
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
        isSidebarExpanded ? "pl-64" : "pl-20"
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
                      <span className="text-sm font-medium text-green-600">{stat.trend}</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Inbox Preview - Gmail-like */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-[#4A89B0]" />
                      <h2 className="text-xl font-bold text-gray-900">Recent Requests</h2>
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {mockRequests.filter(r => !r.read).length} new
                      </span>
                    </div>
                    <button
                      onClick={() => navigate("/admin/inbox")}
                      className="text-[#4A89B0] hover:text-[#3776A0] text-sm font-medium flex items-center gap-1"
                    >
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search */}
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

                {/* Request List */}
                <div className="divide-y divide-gray-100">
                  {filteredRequests.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !request.read ? "bg-blue-50/50" : ""
                      }`}
                      onClick={() => navigate("/admin/inbox")}
                    >
                      <div className="flex items-start gap-4">
                        {/* Status Indicator */}
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          !request.read ? "bg-blue-600" : "bg-gray-300"
                        }`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${!request.read ? "text-gray-900" : "text-gray-700"}`}>
                                {request.requester}
                              </span>
                              <span className="text-xs text-gray-500">({request.department})</span>
                              {request.priority === "high" && (
                                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">
                                  High Priority
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap">{request.date}</span>
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-1">
                            Request ID: <span className="font-mono">{request.id}</span>
                          </div>
                          
                          <div className="text-sm text-gray-700">
                            Items: {request.items.join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority Overview - Low Stock Items */}
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
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">Items with lowest stock levels</p>
                </div>

                <div className="p-4 space-y-3">
                  {lowStockItems.map((item, index) => {
                    const percentage = (item.current / item.minimum) * 100;
                    
                    return (
                      <div key={index} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 text-sm">{item.name}</div>
                            <div className="text-xs text-gray-600">{item.category}</div>
                          </div>
                          <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">
                            {item.current} {item.unit}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
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
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500">
                            Minimum required: {item.minimum} {item.unit}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}