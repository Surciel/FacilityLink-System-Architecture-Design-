import { useState } from "react";
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertCircle,
  Calendar,
  PackageOpen,
  LayoutDashboard,
  Inbox,
  BarChart3,
  LogOut
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

interface Request {
  id: string;
  requester: string;
  email: string;
  department: string;
  items: { name: string; quantity: number; category: string }[];
  date: string;
  status: "pending" | "approved" | "rejected" | "completed";
  priority: "low" | "medium" | "high";
  read: boolean;
}

// ============================================================================
// DATABASE INTEGRATION: PostgreSQL - User Requests
// ============================================================================
// TODO: Replace this empty array with actual database query
//
// SUGGESTED TABLE SCHEMA:
// Table: requests
// - id (VARCHAR/UUID PRIMARY KEY)
// - requester_name (VARCHAR)
// - email (VARCHAR)
// - department (VARCHAR)
// - date (TIMESTAMP)
// - status (VARCHAR: 'pending', 'approved', 'rejected', 'completed')
// - priority (VARCHAR: 'low', 'medium', 'high')
// - read (BOOLEAN)
// - created_at (TIMESTAMP)
//
// Table: request_items (related table)
// - id (SERIAL PRIMARY KEY)
// - request_id (VARCHAR/UUID FOREIGN KEY REFERENCES requests(id))
// - item_name (VARCHAR)
// - quantity (INTEGER)
// - category (VARCHAR)
//
// EXAMPLE QUERY:
// const mockRequests = await db.query(`
//   SELECT r.*, 
//          json_agg(json_build_object(
//            'name', ri.item_name, 
//            'quantity', ri.quantity, 
//            'category', ri.category
//          )) as items
//   FROM requests r
//   LEFT JOIN request_items ri ON r.id = ri.request_id
//   GROUP BY r.id
//   ORDER BY r.created_at DESC
// `);
// ============================================================================

const mockRequests: Request[] = [];

export function InboxPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>(mockRequests);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);

  const menuItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/inbox", icon: Inbox, label: "Inbox" },
    { path: "/admin/inventory", icon: PackageOpen, label: "Inventory" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics Report" },
  ];

  const handleLogout = () => {
    navigate("/admin/login");
  };

  // Get unique categories
  const categories = Array.from(
    new Set(requests.flatMap(r => r.items.map(item => item.category)))
  );

  // Filter requests
  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.requester.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || request.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleApprove = (requestId: string) => {
    setRequests(requests.map(r => 
      r.id === requestId ? { ...r, status: "approved" as const } : r
    ));
    toast.success("Request approved successfully");
  };

  const handleReject = (requestId: string) => {
    setRequests(requests.map(r => 
      r.id === requestId ? { ...r, status: "rejected" as const } : r
    ));
    toast.error("Request rejected");
  };

  const handleMarkAsRead = (requestId: string) => {
    setRequests(requests.map(r => 
      r.id === requestId ? { ...r, read: true } : r
    ));
  };

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    handleMarkAsRead(request.id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-orange-100 text-orange-700 border-orange-200";
      case "approved": return "bg-green-100 text-green-700 border-green-200";
      case "rejected": return "bg-red-100 text-red-700 border-red-200";
      case "completed": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700";
      case "medium": return "bg-yellow-100 text-yellow-700";
      case "low": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
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
            const active = item.path === "/admin/inbox";
            
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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
              <p className="text-gray-600 mt-1">Manage all inventory requests</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, ID, department, or item..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span>Showing {filteredRequests.length} of {requests.length} requests</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full" />
                  <span>{requests.filter(r => !r.read).length} unread</span>
                </div>
              </div>
            </div>

            {/* Request List */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* List View */}
              <div className="lg:col-span-2 space-y-3">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => handleRequestClick(request)}
                    className={`bg-white rounded-lg shadow-sm border cursor-pointer transition-all hover:shadow-md ${
                      !request.read 
                        ? "border-blue-300 bg-blue-50/30" 
                        : "border-gray-200"
                    } ${selectedRequest?.id === request.id ? "ring-2 ring-[#4A89B0]" : ""}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          {!request.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                          )}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{request.requester}</h3>
                              <span className="text-xs text-gray-500">({request.department})</span>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              <span className="font-mono">{request.id}</span> · {request.email}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />
                              {request.date}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(request.status)}`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(request.priority)}`}>
                            {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                        <div className="text-sm font-medium text-gray-700 mb-2">Requested Items:</div>
                        {request.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{item.category}</span>
                              <span className="bg-white px-2 py-0.5 rounded text-gray-900 font-medium">
                                × {item.quantity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredRequests.length === 0 && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No requests found matching your filters</p>
                  </div>
                )}
              </div>

              {/* Detail View */}
              <div className="lg:col-span-1">
                {selectedRequest ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Request Details</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Request ID</label>
                        <div className="font-mono text-sm mt-1">{selectedRequest.id}</div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500">Requester</label>
                        <div className="text-sm mt-1">{selectedRequest.requester}</div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500">Department</label>
                        <div className="text-sm mt-1">{selectedRequest.department}</div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500">Email</label>
                        <div className="text-sm mt-1">{selectedRequest.email}</div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500">Date & Time</label>
                        <div className="text-sm mt-1">{selectedRequest.date}</div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500">Status</label>
                        <div className="mt-1">
                          <span className={`text-xs px-2 py-1 rounded border inline-block ${getStatusColor(selectedRequest.status)}`}>
                            {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500">Priority</label>
                        <div className="mt-1">
                          <span className={`text-xs px-2 py-1 rounded inline-block ${getPriorityColor(selectedRequest.priority)}`}>
                            {selectedRequest.priority.charAt(0).toUpperCase() + selectedRequest.priority.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedRequest.status === "pending" && (
                      <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                        <button
                          onClick={() => handleApprove(selectedRequest.id)}
                          className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Approve Request
                        </button>
                        <button
                          onClick={() => handleReject(selectedRequest.id)}
                          className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-5 h-5" />
                          Reject Request
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center sticky top-24">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Select a request to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}