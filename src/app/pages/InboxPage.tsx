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
  Trash2,
  X,
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
  status: string;
  created_at: string;
  request_group_id: string | null;
}

interface GroupedRequest {
  group_id: string;
  requested_by: string;
  department: string;
  created_at: string;
  status: string;
  items: Request[];
}

export function InboxPage() {
  const navigate = useNavigate();
  const [groupedRequests, setGroupedRequests] = useState<GroupedRequest[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupedRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupedRequest | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      setLoading(false);
      return;
    }

    const groups: Record<string, GroupedRequest> = {};

    (data || []).forEach((req: Request) => {
      const groupKey = req.request_group_id || req.pkid;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          group_id: groupKey,
          requested_by: req.requested_by,
          department: req.department,
          created_at: req.created_at,
          status: req.status,
          items: [],
        };
      }
      groups[groupKey].items.push(req);
    });

    const sorted = Object.values(groups).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setGroupedRequests(sorted);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!groupToDelete) return;
    setDeleteLoading(true);

    for (const item of groupToDelete.items) {
      const { data: inventoryItem, error: fetchError } = await supabase
        .from("inventory")
        .select("remaining_stock")
        .eq("item_no", item.item_no)
        .single();

      if (fetchError || !inventoryItem) {
        toast.error(`Could not fetch stock for: ${item.description}`);
        setDeleteLoading(false);
        return;
      }

      const { error: restoreError } = await supabase
        .from("inventory")
        .update({ remaining_stock: inventoryItem.remaining_stock + item.quantity_requested })
        .eq("item_no", item.item_no);

      if (restoreError) {
        toast.error(`Failed to restore stock for: ${item.description}`);
        setDeleteLoading(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("requests")
        .delete()
        .eq("pkid", item.pkid);

      if (deleteError) {
        toast.error(`Failed to delete request for: ${item.description}`);
        setDeleteLoading(false);
        return;
      }
    }

    toast.success("Request deleted and stock restored!");
    setShowDeleteModal(false);
    setGroupToDelete(null);
    setSelectedGroup(null);
    fetchRequests();
    setDeleteLoading(false);
  };

  const filteredGroups = groupedRequests.filter(group =>
    (group.requested_by?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (group.department?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    group.items.some(i => (i.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()))
  );

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
              <h1 className="text-3xl font-bold text-gray-900">Requests</h1>
              <p className="text-gray-600 mt-1">View all inventory requests</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, department, or item..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <Filter className="w-4 h-4" />
                <span>Showing {filteredGroups.length} of {groupedRequests.length} requests</span>
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
                ) : filteredGroups.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No requests found</p>
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div
                      key={group.group_id}
                      onClick={() => setSelectedGroup(group)}
                      className={`bg-white rounded-lg shadow-sm border border-gray-200 cursor-pointer transition-all hover:shadow-md ${
                        selectedGroup?.group_id === group.group_id ? "ring-2 ring-[#4A89B0]" : ""
                      }`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{group.requested_by}</h3>
                              <span className="text-xs text-gray-500">({group.department})</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(group.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs text-gray-500">
                              {group.items.length} item{group.items.length > 1 ? "s" : ""}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setGroupToDelete(group);
                                setShowDeleteModal(true);
                              }}
                              className="flex items-center gap-1 text-xs bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 px-2 py-1 rounded-lg transition-colors border border-red-200"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          <div className="text-sm font-medium text-gray-700">Requested Items:</div>
                          {group.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{item.description}</span>
                              <span className="bg-[#4A89B0] text-white px-2 py-0.5 rounded text-xs font-medium">
                                × {item.quantity_requested} {item.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Detail View */}
              <div className="lg:col-span-1">
                {selectedGroup ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Request Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Requested By</label>
                        <div className="text-sm mt-1">{selectedGroup.requested_by}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Department / College</label>
                        <div className="text-sm mt-1">{selectedGroup.department}</div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Date Submitted</label>
                        <div className="text-sm mt-1">{new Date(selectedGroup.created_at).toLocaleString()}</div>
                      </div>

                      {/* Items List */}
                      <div>
                        <label className="text-xs font-medium text-gray-500">Items Requested</label>
                        <div className="mt-2 space-y-2">
                          {selectedGroup.items.map((item, idx) => (
                            <div key={idx} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">{item.description}</span>
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-medium">
                                  # {item.item_no}
                                </span>
                                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-medium">
                                  Qty: {item.quantity_requested} {item.unit}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
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

        {/* Delete Confirmation Modal */}
        {showDeleteModal && groupToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Delete Request</h3>
                <button
                  onClick={() => { setShowDeleteModal(false); setGroupToDelete(null); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Requested by</div>
                    <div className="font-semibold text-gray-900">{groupToDelete.requested_by}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Items to restore:</div>
                    {groupToDelete.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-700">{item.description}</span>
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-medium">
                          +{item.quantity_requested} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setGroupToDelete(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteLoading ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}