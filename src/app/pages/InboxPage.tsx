import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Clock,
  AlertCircle,
  Calendar,
  PackageOpen,
  LayoutDashboard,
  Inbox,
  BarChart3,
  LogOut,
  Package
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { supabase } from "../../supabaseClient";

interface Request {
  pkid: string;
  requested_by: string;
  department: string;
  item_no: string;
  description: string;
  unit: string;
  quantity_requested: number;
  created_at: string;
}

export function InboxPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load requests");
      console.error(error);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch =
      (request.requested_by?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (request.pkid?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (request.department?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (request.description?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const menuItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/inbox", icon: Inbox, label: "Inbox" },
    { path: "/admin/inventory", icon: PackageOpen, label: "Inventory" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics Report" },
  ];

  const handleLogout = () => navigate("/admin/login");

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
              <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
              <p className="text-gray-600 mt-1">View all inventory requests</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
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
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span>Showing {filteredRequests.length} of {requests.length} requests</span>
                </div>
              </div>
            </div>

            {/* Request List + Detail */}
            <div className="grid lg:grid-cols-3 gap-6">

              {/* List */}
              <div className="lg:col-span-2 space-y-3">
                {loading ? (
                  <div className="bg-white rounded-lg p-12 text-center text-gray-400">
                    Loading requests...
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No requests found</p>
                  </div>
                ) : (
                  filteredRequests.map((request) => (
                    <div
                      key={request.pkid}
                      onClick={() => setSelectedRequest(request)}
                      className={`bg-white rounded-lg shadow-sm border border-gray-200 cursor-pointer transition-all hover:shadow-md ${selectedRequest?.pkid === request.pkid ? "ring-2 ring-[#4A89B0]" : ""}`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{request.requested_by}</h3>
                              <span className="text-xs text-gray-500">({request.department})</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(request.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-sm font-medium text-gray-700 mb-1">Requested Item:</div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{request.description}</span>
                            <span className="bg-white px-2 py-0.5 rounded text-gray-900 font-medium border">
                              × {request.quantity_requested} {request.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
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
                        <div className="font-mono text-sm mt-1">{selectedRequest.pkid}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Requested By</label>
                        <div className="text-sm mt-1">{selectedRequest.requested_by}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Department</label>
                        <div className="text-sm mt-1">{selectedRequest.department}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Item</label>
                        <div className="text-sm mt-1">{selectedRequest.description}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Item No.</label>
                        <div className="text-sm font-mono mt-1">{selectedRequest.item_no}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Quantity Requested</label>
                        <div className="text-sm mt-1">{selectedRequest.quantity_requested} {selectedRequest.unit}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Date Submitted</label>
                        <div className="text-sm mt-1">{new Date(selectedRequest.created_at).toLocaleString()}</div>
                      </div>
                    </div>
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
