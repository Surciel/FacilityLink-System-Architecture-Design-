import { useState, useEffect, useRef } from "react";
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
  ArrowUpDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router";
import { supabase } from "../../supabaseClient";

interface Request {
  pkid: string;
  requested_by: string;
  department: string;
  item_no: string;
  quantity_requested: number;
  created_at: string;
  request_group_id: string | null;
  requester_type?: "student" | "faculty" | null;
  requester_info?: string | null;
  status?: string;
}

interface GroupedRequest {
  group_id: string;
  requested_by: string;
  department: string;
  created_at: string;
  requester_type?: "student" | "faculty" | null;
  requester_info?: string | null;
  items: Request[];
  status?: string;
}

export function InboxPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [groupedRequests, setGroupedRequests] = useState<GroupedRequest[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupedRequest | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<
    | "date-newest"
    | "date-oldest"
    | "requester-az"
    | "requester-za"
    | "department-az"
    | "department-za"
    | "items-most"
    | "items-few"
  >("date-newest");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("sidebarExpanded");
    return stored ? JSON.parse(stored) : false;
  });
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("sidebarPinned");
    return stored ? JSON.parse(stored) : false;
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Authentication and session check
  useEffect(() => {
    const checkAuth = async () => {
      const role = localStorage.getItem("facility_link_role");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (role !== "admin" || !session) {
        toast.error("Unauthorized access. Please login as admin.");
        navigate("/admin/login");
      }
    };

    checkAuth();
  }, [navigate]);

  const fetchRequestsRealtime = async () => {
    const { data, error } = await supabase
      .from("requests")
      .select(
        "pkid, requested_by, department, item_no, quantity_requested, created_at, request_group_id, requester_type, requester_info, status, inventory(description, unit_id, units(name))",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load requests:", error);
      return;
    }

    const groups: Record<string, GroupedRequest> = {};

    (data || []).forEach((req: any) => {
      const groupKey = req.request_group_id || req.pkid;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          group_id: groupKey,
          requested_by: req.requested_by,
          department: req.department,
          created_at: req.created_at,
          requester_type: req.requester_type,
          requester_info: req.requester_info,
          status: req.status || "pending",
          items: [],
        };
      }
      const requestItem: Request = {
        ...req,
      };
      groups[groupKey].items.push(requestItem);
    });

    const sorted = Object.values(groups).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    setGroupedRequests(sorted);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    // Clean up any previous timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Unsubscribe from previous subscription if it exists
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Set up real-time subscription for requests table
    const subscription = supabase
      .channel("requests-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requests",
        },
        (payload) => {
          // Debounce the refresh to avoid multiple updates in quick succession
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
          }

          refreshTimeoutRef.current = setTimeout(() => {
            fetchRequestsRealtime();
          }, 500);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Inbox real-time subscription active");
        }
      });

    subscriptionRef.current = subscription;

    // Cleanup subscription on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!loading && groupedRequests.length > 0) {
      const state = location.state as { selectedGroupKey?: string } | null;
      if (state?.selectedGroupKey) {
        const matchingGroup = groupedRequests.find(
          (group) => group.group_id === state.selectedGroupKey,
        );
        if (matchingGroup) {
          setSelectedGroup(matchingGroup);
          // Scroll to the selected group
          const selectedKey = state.selectedGroupKey;
          setTimeout(() => {
            const groupElement = groupRefs.current[selectedKey];
            if (groupElement) {
              groupElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }, 0);
        }
      }
    }
  }, [loading, groupedRequests, location.state]);

  useEffect(() => {
    localStorage.setItem("sidebarExpanded", JSON.stringify(isSidebarExpanded));
  }, [isSidebarExpanded]);

  useEffect(() => {
    localStorage.setItem("sidebarPinned", JSON.stringify(isSidebarPinned));
  }, [isSidebarPinned]);

  // Reset to first page when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption]);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("requests")
      .select(
        "pkid, requested_by, department, item_no, quantity_requested, created_at, request_group_id, requester_type, requester_info, status, inventory(description, unit_id, units(name))",
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load requests");
      console.error(error);
      setLoading(false);
      return;
    }

    const groups: Record<string, GroupedRequest> = {};

    (data || []).forEach((req: any) => {
      const groupKey = req.request_group_id || req.pkid;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          group_id: groupKey,
          requested_by: req.requested_by,
          department: req.department,
          created_at: req.created_at,
          requester_type: req.requester_type,
          requester_info: req.requester_info,
          status: req.status || "pending",
          items: [],
        };
      }
      // Add inventory data to request object
      const requestItem: Request = {
        ...req,
      };
      groups[groupKey].items.push(requestItem);
    });

    const sorted = Object.values(groups).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    setGroupedRequests(sorted);
    setLoading(false);
  };

  const handleApproveRequest = async (group: GroupedRequest) => {
    setLoading(true);
    try {
      const itemIds = group.items.map(i => i.item_no);
      const { data: inventoryItems, error: fetchError } = await supabase
        .from("inventory")
        .select("item_no, remaining_stock")
        .in("item_no", itemIds);

      if (fetchError || !inventoryItems) throw fetchError;

      for (const item of group.items) {
        const invItem = inventoryItems.find(i => i.item_no === item.item_no);
        if (!invItem || invItem.remaining_stock < item.quantity_requested) {
          toast.error(`Insufficient stock for ${(item as any).inventory?.description}. Cannot approve.`);
          setLoading(false); return;
        }
      }

      await Promise.all(group.items.map(async (item) => {
        const invItem = inventoryItems.find(i => i.item_no === item.item_no)!;
        return supabase.from("inventory")
          .update({ remaining_stock: invItem.remaining_stock - item.quantity_requested })
          .eq("item_no", item.item_no);
      }));

      const pkidList = group.items.map(i => i.pkid);
      await supabase.from("requests").update({ status: 'approved' }).in("pkid", pkidList);

      toast.success("Request approved and stock updated!");
      fetchRequests();
    } catch (err) {
      toast.error("Error approving request.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (group: GroupedRequest) => {
    setLoading(true);
    try {
      const pkidList = group.items.map(i => i.pkid);
      await supabase.from("requests").update({ status: 'rejected' }).in("pkid", pkidList);
      
      toast.success("Request rejected.");
      fetchRequests();
    } catch (err) {
      toast.error("Error rejecting request.");
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groupedRequests.filter(
    (group) =>
      (group.requested_by?.toLowerCase() || "").includes(
        searchQuery.toLowerCase(),
      ) ||
      (group.department?.toLowerCase() || "").includes(
        searchQuery.toLowerCase(),
      ) ||
      group.items.some((i) =>
        ((i as any).inventory?.description?.toLowerCase() || "").includes(
          searchQuery.toLowerCase(),
        ),
      ),
  );

  const menuItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/inbox", icon: Inbox, label: "Inbox" },
    { path: "/admin/inventory", icon: PackageOpen, label: "Inventory" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics Report" },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("facility_link_role");
    localStorage.removeItem("facility_link_user");
    toast.success("Logged out successfully");
    navigate("/admin/login");
  };

  const getSortedGroups = (groups: GroupedRequest[]) => {
    const sorted = [...groups];

    switch (sortOption) {
      case "date-newest":
        return sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "date-oldest":
        return sorted.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      case "requester-az":
        return sorted.sort((a, b) =>
          (a.requested_by || "").localeCompare(b.requested_by || ""),
        );
      case "requester-za":
        return sorted.sort((a, b) =>
          (b.requested_by || "").localeCompare(a.requested_by || ""),
        );
      case "department-az":
        return sorted.sort((a, b) =>
          (a.department || "").localeCompare(b.department || ""),
        );
      case "department-za":
        return sorted.sort((a, b) =>
          (b.department || "").localeCompare(a.department || ""),
        );
      case "items-most":
        return sorted.sort((a, b) => b.items.length - a.items.length);
      case "items-few":
        return sorted.sort((a, b) => a.items.length - b.items.length);
      default:
        return sorted;
    }
  };

  // Pagination calculations
  const sortedAndFilteredGroups = getSortedGroups(filteredGroups);
  const totalPages = Math.ceil(sortedAndFilteredGroups.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = sortedAndFilteredGroups.slice(startIndex, endIndex);

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
              <h1 className="font-bold text-gray-900">
                FacilityLink: Centralized Inventory System
              </h1>
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
        onMouseLeave={() => {
          setIsSidebarExpanded(false);
          setIsSidebarPinned(false);
        }}
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
                <span
                  className={`font-medium whitespace-nowrap transition-opacity duration-300 ${
                    isSidebarExpanded || isSidebarPinned
                      ? "opacity-100"
                      : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={`pt-16 transition-all duration-300 ${
          isSidebarExpanded || isSidebarPinned ? "pl-64" : "pl-20"
        }`}
      >
        <div className="p-4 lg:p-8">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Requests</h1>
              <p className="text-gray-600 mt-1">View all inventory requests</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    value={sortOption}
                    onChange={(e) =>
                      setSortOption(
                        e.target.value as
                          | "date-newest"
                          | "date-oldest"
                          | "requester-az"
                          | "requester-za"
                          | "department-az"
                          | "department-za"
                          | "items-most"
                          | "items-few",
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                  >
                    <option value="date-newest">Date (Newest First)</option>
                    <option value="date-oldest">Date (Oldest First)</option>
                    <option value="requester-az">Requester Name (A-Z)</option>
                    <option value="requester-za">Requester Name (Z-A)</option>
                    <option value="department-az">Department (A-Z)</option>
                    <option value="department-za">Department (Z-A)</option>
                    <option value="items-most">
                      Number of Items (Most to Few)
                    </option>
                    <option value="items-few">
                      Number of Items (Few to Most)
                    </option>
                  </select>
                </div>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Filter className="w-4 h-4" />
                  <span>
                    Showing {startIndex + 1}-
                    {Math.min(endIndex, sortedAndFilteredGroups.length)} of{" "}
                    {sortedAndFilteredGroups.length} requests
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Items per page selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Show:</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Pagination buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ←
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-600">Page</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={currentPage}
                        onChange={(e) => {
                          const inputValue = e.target.value.replace(/\D/g, "");
                          if (inputValue === "") {
                            setCurrentPage(1);
                          } else {
                            const pageNum = Math.max(
                              1,
                              Math.min(Number(inputValue), totalPages),
                            );
                            setCurrentPage(pageNum);
                          }
                        }}
                        onFocus={(e) => {
                          e.currentTarget.select();
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.select();
                        }}
                        style={{
                          MozAppearance: "textfield",
                        }}
                        className="w-12 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-gray-600">
                        of {Math.max(1, totalPages)}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      →
                    </button>
                  </div>
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
                ) : filteredGroups.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No requests found</p>
                  </div>
                ) : (
                  paginatedGroups.map((group) => {
                    const isPending = group.status === "pending";
                    const isApproved = group.status === "approved";
                    const isRejected = group.status === "rejected";
                    
                    const cardTheme = isPending ? "border-yellow-300 bg-yellow-50" : 
                                      isApproved ? "border-green-300 bg-green-50" : 
                                      isRejected ? "border-red-300 bg-red-50" : "border-gray-200 bg-white";

                    return (
                    <div
                      key={group.group_id}
                      ref={(el) => { if (el) groupRefs.current[group.group_id] = el; }}
                      onClick={() => setSelectedGroup(group)}
                      className={`rounded-lg shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${cardTheme} ${
                        selectedGroup?.group_id === group.group_id ? "ring-2 ring-offset-2 ring-[#4A89B0]" : ""
                      }`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-900 text-lg">
                                {group.requested_by}
                              </h3>
                              <span className="text-sm text-gray-600">
                                ({group.department})
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                {new Date(group.created_at).toLocaleDateString()}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                                isPending ? "bg-yellow-200 text-yellow-800" :
                                isApproved ? "bg-green-200 text-green-800" :
                                "bg-red-200 text-red-800"
                              }`}>
                                {group.status || "Pending"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span className="text-sm font-medium text-gray-600">
                              {group.items.length} item{group.items.length > 1 ? "s" : ""}
                            </span>
                            
                            {isPending && (
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApproveRequest(group);
                                  }}
                                  className="flex items-center gap-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors border border-green-300 font-semibold"
                                >
                                  <Check className="w-4 h-4" /> Approve
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectRequest(group);
                                  }}
                                  className="flex items-center gap-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors border border-red-300 font-semibold"
                                >
                                  <X className="w-4 h-4" /> Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="bg-white/60 rounded-lg p-3 space-y-2 mt-2">
                          <div className="text-sm font-medium text-gray-700">
                            Requested Items:
                          </div>
                          {group.items.map((item, idx) => {
                            const inventory = (item as any).inventory;
                            return (
                              <div key={idx} className="flex items-center justify-between text-sm py-1">
                                <span className="text-gray-800 font-medium">
                                  {inventory?.description || "Unknown Item"}
                                </span>
                                <span className="bg-[#4A89B0] text-white px-3 py-1 rounded text-xs font-bold shadow-sm">
                                  × {item.quantity_requested} {inventory?.units?.name || ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )})
                )}
              </div>

              {/* Detail View */}
              <div className="lg:col-span-1">
                {selectedGroup ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      Request Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Requested By
                        </label>
                        <div className="text-sm mt-1">
                          {selectedGroup.requested_by}
                        </div>
                      </div>

                      {/* Conditionally show Student Number or Phone Number */}
                      {selectedGroup.requester_info && (
                        <div>
                          <label className="text-xs font-medium text-gray-500">
                            {selectedGroup.requester_type === "student"
                              ? "Student Number"
                              : "Contact Number"}
                          </label>
                          <div className="text-sm mt-1">
                            {selectedGroup.requester_info}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Department / College
                        </label>
                        <div className="text-sm mt-1">
                          {selectedGroup.department}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Date Submitted
                        </label>
                        <div className="text-sm mt-1">
                          {new Date(selectedGroup.created_at).toLocaleString()}
                        </div>
                      </div>

                      {/* Items List */}
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Items Requested
                        </label>
                        <div className="mt-2 space-y-2">
                          {selectedGroup.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-50 rounded-lg p-3"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {(item as any).inventory?.description ||
                                    "Unknown Item"}
                                </span>
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-medium">
                                  # {item.item_no}
                                </span>
                                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-medium">
                                  Qty: {item.quantity_requested}{" "}
                                  {(item as any).inventory?.units?.name || ""}
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
                    <p className="text-gray-600">
                      Select a request to view details
                    </p>
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
