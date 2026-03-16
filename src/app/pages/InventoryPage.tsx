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
  LogOut,
  Edit,
  Trash2,
  Save,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

// Inventory management page component
interface InventoryItem {
  item_no: string;           // Item ID (Primary Key)
  description: string;       // Item name/description
  unit: string;              // Unit of measurement
  remaining_stock: number;   // Current/remaining stock
  minimum_stock?: number;    // Optional: for low stock alerts
}

// ============================================================================
// DATABASE INTEGRATION: PostgreSQL - Inventory Management
// ============================================================================
// TODO: Replace this empty array with actual database query
//
// SUGGESTED TABLE SCHEMA (matches your database):
// Table: inventory
// - item_no (VARCHAR PRIMARY KEY)          -- Item ID
// - description (TEXT)                     -- Item name/description
// - unit (VARCHAR)                         -- Unit of measurement (e.g., 'pcs', 'boxes', 'reams')
// - remaining_stock (INTEGER)              -- Current/remaining stock quantity
// - minimum_stock (INTEGER, optional)      -- Minimum stock level for alerts
// - created_at (TIMESTAMP, optional)
// - updated_at (TIMESTAMP, optional)
//
// EXAMPLE QUERY:
// const mockInventory = await db.query(`
//   SELECT item_no, description, unit, remaining_stock, minimum_stock
//   FROM inventory
//   ORDER BY description ASC
// `);
//
// UPDATE STOCK QUERY:
// await db.query(`
//   UPDATE inventory 
//   SET remaining_stock = $1,
//       updated_at = CURRENT_TIMESTAMP
//   WHERE item_no = $2
// `, [newStock, itemNo]);
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
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  
  // New state for Update Inventory modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateMode, setUpdateMode] = useState<'add' | 'edit' | 'remove'>('add');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState({
    item_no: '',
    description: '',
    unit: '',
    remaining_stock: 0,
    minimum_stock: 0
  });

  const menuItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/inbox", icon: Inbox, label: "Inbox" },
    { path: "/admin/inventory", icon: PackageOpen, label: "Inventory" },
    { path: "/admin/analytics", icon: BarChart3, label: "Analytics Report" },
  ];

  const handleLogout = () => {
    navigate("/admin/login");
  };

  const categories = Array.from(new Set(inventory.map(item => item.unit)));

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_no.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.unit === categoryFilter;
    
    const matchesStock = 
      stockFilter === "all" ||
      (stockFilter === "low" && item.minimum_stock && item.remaining_stock < item.minimum_stock) ||
      (stockFilter === "adequate" && item.minimum_stock && item.remaining_stock >= item.minimum_stock);

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
      item.item_no === selectedItem.item_no
        ? { 
            ...item, 
            remaining_stock: item.remaining_stock + amount
          }
        : item
    ));

    toast.success(`Successfully restocked ${amount} ${selectedItem.unit} of ${selectedItem.description}`);
    setShowRestockModal(false);
    setSelectedItem(null);
    setRestockAmount("");
    setResupplyDate("");
  };

  const openRestockModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setRestockAmount("");
    setResupplyDate("");
    setShowRestockModal(true);
  };

  const getStockStatus = (item: InventoryItem) => {
    if (!item.minimum_stock) return { label: "Unknown", color: "text-gray-600 bg-gray-50", icon: Package };
    const percentage = (item.remaining_stock / item.minimum_stock) * 100;
    if (percentage < 30) return { label: "Critical", color: "text-red-600 bg-red-50", icon: AlertTriangle };
    if (percentage < 60) return { label: "Low", color: "text-orange-600 bg-orange-50", icon: TrendingDown };
    return { label: "Adequate", color: "text-green-600 bg-green-50", icon: TrendingUp };
  };

  const totalItems = inventory.reduce((sum, item) => sum + item.remaining_stock, 0);
  const lowStockCount = inventory.filter(item => item.minimum_stock && item.remaining_stock < item.minimum_stock).length;

  // New handlers for Update Inventory modal
  const handleAddItem = () => {
    if (!newItem.item_no || !newItem.description || !newItem.unit) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Check if item_no already exists
    if (inventory.some(item => item.item_no === newItem.item_no)) {
      toast.error("Item ID already exists. Please use a unique ID.");
      return;
    }

    const item: InventoryItem = {
      item_no: newItem.item_no,
      description: newItem.description,
      unit: newItem.unit,
      remaining_stock: newItem.remaining_stock,
      minimum_stock: newItem.minimum_stock
    };

    setInventory([...inventory, item]);
    toast.success(`Successfully added ${item.description} to inventory`);
    setNewItem({
      item_no: '',
      description: '',
      unit: '',
      remaining_stock: 0,
      minimum_stock: 0
    });
    setShowUpdateModal(false);
  };

  const handleEditItem = () => {
    if (!editingItem) return;

    setInventory(inventory.map(item =>
      item.item_no === editingItem.item_no ? editingItem : item
    ));
    toast.success(`Successfully updated ${editingItem.description}`);
    setEditingItem(null);
    setShowUpdateModal(false);
  };

  const handleRemoveItem = (itemId: string) => {
    const item = inventory.find(i => i.item_no === itemId);
    if (!item) return;

    if (confirm(`Are you sure you want to remove "${item.description}" from inventory?`)) {
      setInventory(inventory.filter(i => i.item_no !== itemId));
      toast.success(`Successfully removed ${item.description} from inventory`);
    }
  };

  const openUpdateModal = (mode: 'add' | 'edit' | 'remove') => {
    setUpdateMode(mode);
    setShowUpdateModal(true);
    if (mode === 'add') {
      setNewItem({
        item_no: '',
        description: '',
        unit: '',
        remaining_stock: 0,
        minimum_stock: 0
      });
    }
  };

  const handleAdjustQuantity = (itemId: string, adjustment: number) => {
    setInventory(inventory.map(item => {
      if (item.item_no === itemId) {
        const newStock = Math.max(0, item.remaining_stock + adjustment);
        return {
          ...item,
          remaining_stock: newStock
        };
      }
      return item;
    }));
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
            const active = item.path === "/admin/inventory";
            
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
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track and manage your stock levels</p>
        </div>
        <button
          onClick={() => openUpdateModal('add')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#4A89B0] text-white rounded-lg hover:bg-[#3776A0] transition-colors shadow-md"
        >
          <Edit className="w-5 h-5" />
          Update Inventory
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Items in Stock</p>
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInventory.map((item) => {
                const status = getStockStatus(item);
                const StatusIcon = status.icon;
                const percentage = item.minimum_stock ? (item.remaining_stock / item.minimum_stock) * 100 : 100;

                return (
                  <tr key={item.item_no} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">{item.description}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.item_no}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {item.remaining_stock} {item.unit}
                        </div>
                        {item.minimum_stock && (
                          <>
                            <div className="text-xs text-gray-500">Min: {item.minimum_stock}</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div
                                className={`h-1.5 rounded-full ${
                                  percentage < 30 ? "bg-red-600" : 
                                  percentage < 60 ? "bg-orange-500" : "bg-green-500"
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
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
                <div className="font-semibold text-gray-900">{selectedItem.description}</div>
                <div className="text-sm text-gray-600 mt-2">Current Stock</div>
                <div className="text-2xl font-bold text-gray-900">
                  {selectedItem.remaining_stock} {selectedItem.unit}
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
                      {selectedItem.remaining_stock + parseInt(restockAmount)} {selectedItem.unit}
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

      {/* Update Inventory Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Update Inventory</h3>
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <div className="flex gap-0">
                <button
                  onClick={() => setUpdateMode('add')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${
                    updateMode === 'add'
                      ? 'border-b-2 border-[#4A89B0] text-[#4A89B0] bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add New Item
                  </div>
                </button>
                <button
                  onClick={() => setUpdateMode('edit')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${
                    updateMode === 'edit'
                      ? 'border-b-2 border-[#4A89B0] text-[#4A89B0] bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Edit className="w-5 h-5" />
                    Edit/Adjust Items
                  </div>
                </button>
                <button
                  onClick={() => setUpdateMode('remove')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${
                    updateMode === 'remove'
                      ? 'border-b-2 border-red-500 text-red-600 bg-red-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    Remove Items
                  </div>
                </button>
              </div>
            </div>

            {/* Fixed height content area */}
            <div className="overflow-y-auto" style={{ height: '500px' }}>
              {/* Add New Item Tab */}
              {updateMode === 'add' && (
                <div className="p-6 space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Add a new item to your inventory database. Fill in all required fields marked with *.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item ID *
                      </label>
                      <input
                        type="text"
                        value={newItem.item_no}
                        onChange={(e) => setNewItem({ ...newItem, item_no: e.target.value })}
                        placeholder="e.g., ITEM-12345"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Name *
                      </label>
                      <input
                        type="text"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        placeholder="e.g., Whiteboard Marker"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <input
                        type="text"
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        placeholder="e.g., Office Supplies"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Initial Stock Quantity *
                      </label>
                      <input
                        type="number"
                        value={newItem.remaining_stock}
                        onChange={(e) => setNewItem({ ...newItem, remaining_stock: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                        min="0"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="inline-flex items-center gap-1.5 group relative">
                          Minimum Stock Level *
                          <div className="relative inline-block">
                            <Info className="w-4 h-4 text-gray-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-10 pointer-events-none">
                              Alert threshold: You'll be notified when stock falls below this level
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </span>
                      </label>
                      <input
                        type="number"
                        value={newItem.minimum_stock}
                        onChange={(e) => setNewItem({ ...newItem, minimum_stock: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowUpdateModal(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddItem}
                      className="px-6 py-2 bg-[#4A89B0] text-white rounded-lg hover:bg-[#3776A0] transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Add Item to Inventory
                    </button>
                  </div>
                </div>
              )}

              {/* Edit/Adjust Items Tab */}
              {updateMode === 'edit' && (
                <div className="p-6 space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Select an item to edit its details or adjust its quantity. Changes are saved immediately.
                    </p>
                  </div>

                  {inventory.length === 0 ? (
                    <div className="p-12 text-center">
                      <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No items in inventory yet</p>
                      <button
                        onClick={() => setUpdateMode('add')}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#4A89B0] text-white rounded-lg hover:bg-[#3776A0]"
                      >
                        <Plus className="w-4 h-4" />
                        Add Your First Item
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {inventory.map((item) => (
                        <div key={item.item_no} className="border border-gray-200 rounded-lg p-4 hover:border-[#4A89B0] transition-colors">
                          {editingItem?.item_no === item.item_no ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                  <input
                                    type="text"
                                    value={editingItem.description}
                                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                                  <input
                                    type="text"
                                    value={editingItem.unit}
                                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Current Stock</label>
                                  <input
                                    type="number"
                                    value={editingItem.remaining_stock}
                                    onChange={(e) => setEditingItem({ ...editingItem, remaining_stock: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                                    min="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Minimum Stock</label>
                                  <input
                                    type="number"
                                    value={editingItem.minimum_stock}
                                    onChange={(e) => setEditingItem({ ...editingItem, minimum_stock: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                                    min="0"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleEditItem}
                                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                                >
                                  <Save className="w-4 h-4" />
                                  Save Changes
                                </button>
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900">{item.description}</h4>
                                  <p className="text-sm text-gray-600">{item.unit} • {item.item_no}</p>
                                </div>
                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="px-3 py-1 bg-[#4A89B0] text-white text-sm rounded-lg hover:bg-[#3776A0] flex items-center gap-1"
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                  <p className="text-xs text-gray-500">Current Stock</p>
                                  <p className="text-sm font-semibold text-gray-900">{item.remaining_stock} {item.unit}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Minimum Stock</p>
                                  <p className="text-sm font-semibold text-gray-900">{item.minimum_stock} {item.unit}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Quick Adjust:</span>
                                <button
                                  onClick={() => handleAdjustQuantity(item.item_no, -10)}
                                  className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                                >
                                  -10
                                </button>
                                <button
                                  onClick={() => handleAdjustQuantity(item.item_no, -1)}
                                  className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                                >
                                  -1
                                </button>
                                <button
                                  onClick={() => handleAdjustQuantity(item.item_no, 1)}
                                  className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200"
                                >
                                  +1
                                </button>
                                <button
                                  onClick={() => handleAdjustQuantity(item.item_no, 10)}
                                  className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200"
                                >
                                  +10
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Remove Items Tab */}
              {updateMode === 'remove' && (
                <div className="p-6 space-y-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      <strong>Warning:</strong> Removing items will permanently delete them from your inventory. This action cannot be undone.
                    </p>
                  </div>

                  {inventory.length === 0 ? (
                    <div className="p-12 text-center">
                      <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No items in inventory to remove</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {inventory.map((item) => (
                        <div key={item.item_no} className="border border-gray-200 rounded-lg p-4 hover:border-red-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{item.description}</h4>
                              <p className="text-sm text-gray-600">{item.unit} • {item.remaining_stock} {item.unit} in stock</p>
                              <p className="text-xs text-gray-500 font-mono mt-1">{item.item_no}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.item_no)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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