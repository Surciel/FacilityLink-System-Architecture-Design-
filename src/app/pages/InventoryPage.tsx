import { useState } from "react";
import { 
  PackageOpen,
  Package,
  Search, 
  Plus, 
  Calendar,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  X,
  LayoutDashboard,
  Inbox,
  BarChart3,
  LogOut
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

// Inventory management page component
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  lastRestocked: string;
  nextResupply: string;
  pricePerUnit: number;
}

// ============================================================================
// DATABASE INTEGRATION: PostgreSQL - Inventory Management
// ============================================================================
// TODO: Replace this empty array with actual database query
//
// SUGGESTED TABLE SCHEMA:
// Table: inventory
// - id (VARCHAR/UUID PRIMARY KEY)
// - name (VARCHAR)
// - category (VARCHAR)
// - current_stock (INTEGER)
// - minimum_stock (INTEGER)
// - unit (VARCHAR) -- e.g., 'pcs', 'reams', 'bottles'
// - last_restocked (DATE)
// - next_resupply (DATE)
// - price_per_unit (DECIMAL/NUMERIC)
// - created_at (TIMESTAMP)
// - updated_at (TIMESTAMP)
//
// EXAMPLE QUERY:
// const mockInventory = await db.query(`
//   SELECT id, name, category, current_stock as "currentStock", 
//          minimum_stock as "minimumStock", unit, 
//          last_restocked as "lastRestocked", 
//          next_resupply as "nextResupply", 
//          price_per_unit as "pricePerUnit"
//   FROM inventory
//   ORDER BY name ASC
// `);
//
// RESTOCK UPDATE QUERY:
// await db.query(`
//   UPDATE inventory 
//   SET current_stock = current_stock + $1, 
//       last_restocked = CURRENT_DATE,
//       next_resupply = $2,
//       updated_at = CURRENT_TIMESTAMP
//   WHERE id = $3
// `, [restockAmount, nextResupplyDate, itemId]);
// ============================================================================

const mockInventory: InventoryItem[] = [];

export function InventoryPage() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockAmount, setRestockAmount] = useState("");
  const [resupplyDate, setResupplyDate] = useState("");
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

  const categories = Array.from(new Set(inventory.map(item => item.category)));

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    
    const matchesStock = 
      stockFilter === "all" ||
      (stockFilter === "low" && item.currentStock < item.minimumStock) ||
      (stockFilter === "adequate" && item.currentStock >= item.minimumStock);

    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleRestock = () => {
    if (!selectedItem || !restockAmount) {
      toast.error("Please enter a valid restock amount");
      return;
    }

    const amount = parseInt(restockAmount);
    if (amount <= 0) {
      toast.error("Restock amount must be greater than 0");
      return;
    }

    setInventory(inventory.map(item =>
      item.id === selectedItem.id
        ? { 
            ...item, 
            currentStock: item.currentStock + amount,
            lastRestocked: new Date().toISOString().split('T')[0],
            nextResupply: resupplyDate || item.nextResupply
          }
        : item
    ));

    toast.success(`Successfully restocked ${amount} ${selectedItem.unit} of ${selectedItem.name}`);
    setShowRestockModal(false);
    setSelectedItem(null);
    setRestockAmount("");
    setResupplyDate("");
  };

  const openRestockModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setRestockAmount("");
    setResupplyDate(item.nextResupply);
    setShowRestockModal(true);
  };

  const getStockStatus = (item: InventoryItem) => {
    const percentage = (item.currentStock / item.minimumStock) * 100;
    if (percentage < 30) return { label: "Critical", color: "text-red-600 bg-red-50", icon: AlertTriangle };
    if (percentage < 60) return { label: "Low", color: "text-orange-600 bg-orange-50", icon: TrendingDown };
    return { label: "Adequate", color: "text-green-600 bg-green-50", icon: TrendingUp };
  };

  const totalItems = inventory.reduce((sum, item) => sum + item.currentStock, 0);
  const lowStockCount = inventory.filter(item => item.currentStock < item.minimumStock).length;
  const totalValue = inventory.reduce((sum, item) => sum + (item.currentStock * item.pricePerUnit), 0);

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
            const active = item.path === "/admin/inventory";
            
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
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-gray-600 mt-1">Track and manage your stock levels</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalItems}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{lowStockCount}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₱{totalValue.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by item name or ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stock Level</label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
            >
              <option value="all">All Levels</option>
              <option value="low">Low Stock</option>
              <option value="adequate">Adequate Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Restocked
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Resupply
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInventory.map((item) => {
                const status = getStockStatus(item);
                const StatusIcon = status.icon;
                const percentage = (item.currentStock / item.minimumStock) * 100;

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{item.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {item.currentStock} {item.unit}
                        </div>
                        <div className="text-xs text-gray-500">Min: {item.minimumStock}</div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              percentage < 30 ? "bg-red-600" : 
                              percentage < 60 ? "bg-orange-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {item.lastRestocked}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-700">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {item.nextResupply}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openRestockModal(item)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#4A89B0] text-white text-sm rounded-lg hover:bg-[#3776A0] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Restock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredInventory.length === 0 && (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No items found matching your filters</p>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Restock Item</h3>
                <button
                  onClick={() => setShowRestockModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Item</div>
                <div className="font-semibold text-gray-900">{selectedItem.name}</div>
                <div className="text-sm text-gray-600 mt-2">Current Stock</div>
                <div className="text-2xl font-bold text-gray-900">
                  {selectedItem.currentStock} {selectedItem.unit}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Restock Amount *
                </label>
                <input
                  type="number"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  placeholder="Enter quantity to add"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Next Resupply Date
                </label>
                <input
                  type="date"
                  value={resupplyDate}
                  onChange={(e) => setResupplyDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                />
              </div>

              {restockAmount && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-800">
                    New stock level will be: <span className="font-bold">
                      {selectedItem.currentStock + parseInt(restockAmount)} {selectedItem.unit}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowRestockModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                className="flex-1 px-4 py-2 bg-[#4A89B0] text-white rounded-lg hover:bg-[#3776A0] transition-colors"
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}
          </div>
        </div>
      </main>
    </div>
  );
}