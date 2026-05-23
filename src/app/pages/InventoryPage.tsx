import { useState, useEffect, useRef } from "react";
import {
  PackageOpen,
  Package,
  Search,
  Plus,
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
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { supabase } from "../../supabaseClient";

interface Unit {
  pkid: string; // UUID
  name: string;
}

interface InventoryItem {
  item_no: string;
  description: string;
  unit_id: string; // UUID foreign key
  units?: Unit; // Nested unit object from JOIN
  remaining_stock: number;
  minimum_stock?: number;
}

type EditableInventoryItem = Omit<
  InventoryItem,
  "remaining_stock" | "minimum_stock"
> & {
  remaining_stock: number | "";
  minimum_stock: number | "" | undefined;
};

type NewItemForm = {
  item_no: string;
  description: string;
  unit_id: string; // UUID
  remaining_stock: number | "";
  minimum_stock: number | "";
};

export function InventoryPage() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [prefixFilter, setPrefixFilter] = useState("all");
  const [sortOption, setSortOption] = useState<
    | "name-az"
    | "name-za"
    | "unit-az"
    | "unit-za"
    | "stock-high"
    | "stock-low"
    | "id-az"
    | "id-za"
  >("name-az");
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [restockAmount, setRestockAmount] = useState("");
  const [resupplyDate, setResupplyDate] = useState("");
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
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateMode, setUpdateMode] = useState<"add" | "edit" | "remove">(
    "add",
  );
  const [editingItem, setEditingItem] = useState<EditableInventoryItem | null>(
    null,
  );
  const [editSearchItemNo, setEditSearchItemNo] = useState("");
  const [editSearchDescription, setEditSearchDescription] = useState("");
  const [editOriginalItemNo, setEditOriginalItemNo] = useState("");
  const [removeSearchItemNo, setRemoveSearchItemNo] = useState("");
  const [removeSearchDescription, setRemoveSearchDescription] = useState("");
  const [itemIdPrefix, setItemIdPrefix] = useState<"JMS" | "GYM-S">("JMS");
  const [itemIdNumber, setItemIdNumber] = useState("");
  const [itemIdLetter, setItemIdLetter] = useState("");
  const [itemIdExists, setItemIdExists] = useState(false);
  const [itemNameExists, setItemNameExists] = useState(false);
  const [unitNameExists, setUnitNameExists] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newItem, setNewItem] = useState<NewItemForm>({
    item_no: "",
    description: "",
    unit_id: "",
    remaining_stock: "",
    minimum_stock: "",
  });
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

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

  useEffect(() => {
    fetchInventory();
    fetchAvailableUnits();

    // Unsubscribe from previous subscription if it exists
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Set up real-time subscriptions for inventory, units, and deliveries tables
    const subscription = supabase
      .channel("inventory-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory",
        },
        () => {
          fetchInventory();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "units",
        },
        () => {
          fetchAvailableUnits();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
        },
        () => {
          fetchInventory();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Inventory real-time subscription active");
        }
      });

    subscriptionRef.current = subscription;

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarExpanded", JSON.stringify(isSidebarExpanded));
  }, [isSidebarExpanded]);

  useEffect(() => {
    localStorage.setItem("sidebarPinned", JSON.stringify(isSidebarPinned));
  }, [isSidebarPinned]);

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select(
        "item_no, description, unit_id, remaining_stock, minimum_stock, units!inner(pkid, name)",
      )
      .order("description", { ascending: true });

    if (error) {
      toast.error("Failed to load inventory");
      console.error(error);
    } else {
      const mappedData = (data || []).map((item) => ({
        ...item,
        units: Array.isArray(item.units) ? item.units[0] : item.units,
      }));
      setInventory(mappedData);
    }
    setLoading(false);
  };

  // ── FETCH AVAILABLE UNITS FROM DATABASE ─────────────────────────────────────
  const fetchAvailableUnits = async () => {
    const { data, error } = await supabase
      .from("units")
      .select("pkid, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load units:", error);
      toast.error("Failed to load unit options");
    } else {
      setAvailableUnits(data || []);
    }
  };

  // Fetch units on component mount
  useEffect(() => {
    fetchAvailableUnits();
  }, []);

  // ── HELPERS ───────────────────────────────────────────────────────────────
  const buildItemNo = (
    prefix: "JMS" | "GYM-S",
    number: string,
    letter: string,
  ) => {
    const formattedLetter = letter.toUpperCase();
    return prefix === "JMS"
      ? `JMS${number}${formattedLetter}`
      : `GYM-S-${number}${formattedLetter}`;
  };

  // FIX: correctly parse both JMS and GYM-S- prefixes
  const parseItemNo = (itemNo: string) => {
    if (itemNo.startsWith("GYM-S-")) {
      // GYM-S-010A → prefix=GYM-S, number=010, letter=A
      const rest = itemNo.slice(6); // "010A" or "010"
      const number = rest.slice(0, 3);
      const letter = rest.slice(3).toUpperCase();
      return { prefix: "GYM-S" as "GYM-S", number, letter };
    }

    if (itemNo.startsWith("JMS")) {
      // JMS010A → prefix=JMS, number=010, letter=A
      const rest = itemNo.slice(3); // "010A" or "010"
      const number = rest.slice(0, 3);
      const letter = rest.slice(3).toUpperCase();
      return { prefix: "JMS" as "JMS", number, letter };
    }

    return { prefix: "JMS" as "JMS", number: "", letter: "" };
  };

  // ── ADD ──────────────────────────────────────────────────────────────────
  // ── ADD NEW UNIT ────────────────────────────────────────────────────────────
  const handleAddNewUnit = async () => {
    if (!newUnitName.trim()) {
      toast.error("Please enter a unit name");
      return;
    }

    if (unitNameExists) {
      toast.error(`Unit "${newUnitName}" already exists`);
      return;
    }

    setActionLoading(true);
    const { data, error } = await supabase
      .from("units")
      .insert({ name: newUnitName.trim() })
      .select();

    if (error) {
      toast.error("Failed to add unit");
      console.error(error);
    } else {
      toast.success(`Unit "${newUnitName}" added successfully`);
      setNewUnitName("");
      setUnitNameExists(false);
      setShowAddUnitModal(false);
      fetchAvailableUnits();
      // Auto-select the newly added unit
      if (data && data[0]) {
        setNewItem({ ...newItem, unit_id: data[0].pkid });
      }
    }
    setActionLoading(false);
  };

  const handleAddItem = async () => {
    if (!itemIdNumber || !newItem.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (itemIdNumber.length !== 3) {
      toast.error("Item number must be exactly 3 digits");
      return;
    }

    const finalItemNo = buildItemNo(itemIdPrefix, itemIdNumber, itemIdLetter);

    if (itemIdExists) {
      toast.error(
        `Item ID ${finalItemNo} already exists. Please use a different combination.`,
      );
      return;
    }

    if (itemNameExists) {
      toast.error(
        `An item with the name "${newItem.description}" already exists in inventory.`,
      );
      return;
    }

    setActionLoading(true);
    const { error } = await supabase.from("inventory").insert({
      item_no: finalItemNo,
      description: newItem.description,
      unit_id: newItem.unit_id,
      remaining_stock:
        newItem.remaining_stock === "" ? 0 : newItem.remaining_stock,
      minimum_stock: newItem.minimum_stock === "" ? 0 : newItem.minimum_stock,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Item ID already exists. Please use a unique ID.");
      } else {
        toast.error("Failed to add item");
        console.error(error);
      }
    } else {
      toast.success(`Successfully added ${newItem.description} to inventory`);
      setNewItem({
        item_no: "",
        description: "",
        unit_id: "",
        remaining_stock: "",
        minimum_stock: "",
      });
      setItemIdPrefix("JMS");
      setItemIdNumber("");
      setItemIdLetter("");
      setItemIdExists(false);
      setShowUpdateModal(false);
      fetchInventory();
    }
    setActionLoading(false);
  };

  // ── EDIT (with safe item_no migration) ─────────────────────────────────
  const handleEditItem = async () => {
    if (!editingItem) return;

    if (itemIdNumber.length !== 3) {
      toast.error("Item number must be exactly 3 digits");
      return;
    }

    if (itemIdExists) {
      toast.error("Item ID already exists. Please choose a different one.");
      return;
    }

    const newItemNo = buildItemNo(itemIdPrefix, itemIdNumber, itemIdLetter);
    const oldItemNo = editOriginalItemNo;
    const itemNoChanged = newItemNo !== oldItemNo;

    setActionLoading(true);
    try {
      if (itemNoChanged) {
        // Get the current stock from the original item to calculate delta
        const currentItem = inventory.find((i) => i.item_no === oldItemNo);
        const currentStock = currentItem?.remaining_stock || 0;
        const newStock =
          typeof editingItem.remaining_stock === "string"
            ? parseInt(editingItem.remaining_stock) || 0
            : editingItem.remaining_stock;
        const delta = newStock - currentStock;

        // Create the new inventory row first so child FK updates point to a valid parent.
        const { error: insertError } = await supabase.from("inventory").insert({
          item_no: newItemNo,
          description: editingItem.description,
          unit_id: editingItem.unit_id,
          remaining_stock: newStock,
          minimum_stock:
            typeof editingItem.minimum_stock === "string"
              ? parseInt(editingItem.minimum_stock as string) || 0
              : editingItem.minimum_stock,
        });

        if (insertError) {
          console.error("Failed to create new inventory row:", insertError);
          toast.error("Failed to update item: " + insertError.message);
          return;
        }

        const updateTargets = [
          "requests",
          "deliveries",
          "inventory_history",
        ] as const;
        for (const table of updateTargets) {
          const { error: updateError } = await supabase
            .from(table)
            .update({ item_no: newItemNo })
            .eq("item_no", oldItemNo);

          if (updateError) {
            console.error(`Failed to update ${table}:`, updateError);
            await supabase.from("inventory").delete().eq("item_no", newItemNo);
            toast.error(
              `Failed to update related ${table}: ` + updateError.message,
            );
            return;
          }
        }

        const { error: deleteError } = await supabase
          .from("inventory")
          .delete()
          .eq("item_no", oldItemNo);

        if (deleteError) {
          console.error("Failed to remove old inventory row:", deleteError);
          await supabase.from("inventory").delete().eq("item_no", newItemNo);
          toast.error("Failed to complete item update: " + deleteError.message);
          return;
        }

        // Conditional Delivery Sync: If stock increased, create delivery record
        if (delta > 0) {
          const deliveryDate = new Date().toISOString();

          const { error: deliveryError } = await supabase
            .from("deliveries")
            .insert({
              item_no: newItemNo,
              quantity_delivered: delta,
              delivery_date: deliveryDate,
            });

          if (deliveryError) {
            console.error("Failed to create delivery record:", deliveryError);
            toast.error(
              `Item ID updated but delivery record failed to create: ${deliveryError.message}`,
            );
          } else {
            toast.success(
              `Successfully updated ${editingItem.description}. Delivery record created for ${delta} ${currentItem?.units?.name || "unit"}(s).`,
            );
          }
        } else {
          toast.success(`Successfully updated ${editingItem.description}`);
        }

        setEditingItem(null);
        setEditOriginalItemNo("");
        setShowUpdateModal(false);
        fetchInventory();
        return;
      }

      const newRemainingStock =
        typeof editingItem.remaining_stock === "string"
          ? parseInt(editingItem.remaining_stock) || 0
          : editingItem.remaining_stock;

      // Get the current stock from the original item to calculate delta
      const currentItem = inventory.find((i) => i.item_no === oldItemNo);
      const currentStock = currentItem?.remaining_stock || 0;
      const delta = newRemainingStock - currentStock;

      const { error } = await supabase
        .from("inventory")
        .update({
          description: editingItem.description,
          unit_id: editingItem.unit_id,
          remaining_stock: newRemainingStock,
          minimum_stock:
            typeof editingItem.minimum_stock === "string"
              ? parseInt(editingItem.minimum_stock as string) || 0
              : editingItem.minimum_stock,
        })
        .eq("item_no", oldItemNo);

      if (error) {
        toast.error("Failed to update item: " + error.message);
        console.error(error);
      } else {
        // Conditional Delivery Sync: If stock increased, create delivery record
        if (delta > 0) {
          const deliveryDate = new Date().toISOString();

          const { error: deliveryError } = await supabase
            .from("deliveries")
            .insert({
              item_no: oldItemNo,
              quantity_delivered: delta,
              delivery_date: deliveryDate,
            });

          if (deliveryError) {
            console.error("Failed to create delivery record:", deliveryError);
            toast.error(
              `Item updated but delivery record failed to create: ${deliveryError.message}`,
            );
          } else {
            toast.success(
              `Successfully updated ${editingItem.description}. Delivery record created for ${delta} ${currentItem?.units?.name || "unit"}(s).`,
            );
          }
        } else {
          toast.success(`Successfully updated ${editingItem.description}`);
        }

        setEditingItem(null);
        setEditOriginalItemNo("");
        setShowUpdateModal(false);
        fetchInventory();
      }
    } catch (err) {
      toast.error("An unexpected error occurred while updating");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // ── REMOVE ───────────────────────────────────────────────────────────────
  const handleRemoveItem = async (itemId: string) => {
    const item = inventory.find((i) => i.item_no === itemId);
    if (!item) return;

    setActionLoading(true);
    try {
      // Delete related records first to avoid FK constraint violations
      await supabase.from("requests").delete().eq("item_no", itemId);
      await supabase.from("deliveries").delete().eq("item_no", itemId);
      await supabase.from("inventory_history").delete().eq("item_no", itemId);

      const { error } = await supabase
        .from("inventory")
        .delete()
        .eq("item_no", itemId);

      if (error) {
        toast.error("Failed to remove item: " + error.message);
        console.error(error);
      } else {
        toast.success(
          `Successfully removed ${item.description} from inventory`,
        );
        fetchInventory();
      }
    } catch (err) {
      toast.error("An error occurred while removing the item");
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const requestRemoveItem = (item: InventoryItem) => {
    setDeleteTarget(item);
    setShowDeleteModal(true);
  };

  const confirmRemoveItem = async () => {
    if (!deleteTarget) return;
    setShowDeleteModal(false);
    await handleRemoveItem(deleteTarget.item_no);
    setDeleteTarget(null);
  };

  // ── RESTOCK ──────────────────────────────────────────────────────────────
  const handleRestock = async () => {
    if (!selectedItem || !restockAmount) {
      toast.error("Please enter a valid restock amount");
      return;
    }

    const amount = parseInt(restockAmount);
    if (amount <= 0) {
      toast.error("Restock amount must be greater than 0");
      return;
    }

    setActionLoading(true);

    try {
      const deliveryDate =
        resupplyDate || new Date().toISOString().split("T")[0];
      const { error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          item_no: selectedItem.item_no,
          quantity_delivered: amount,
          delivery_date: deliveryDate,
        });

      if (deliveryError) {
        toast.error(deliveryError.message || "Failed to record delivery");
        console.error("Delivery Error:", deliveryError);
        return;
      }

      const { error: inventoryError } = await supabase
        .from("inventory")
        .update({ remaining_stock: selectedItem.remaining_stock + amount })
        .eq("item_no", selectedItem.item_no);

      if (inventoryError) {
        toast.error(
          inventoryError.message || "Failed to update inventory stock",
        );
        console.error("Inventory Error:", inventoryError);
        return;
      }

      toast.success(
        `Successfully restocked ${amount} ${selectedItem.units?.name || "unit"}(s) of ${selectedItem.description}`,
      );
      setShowRestockModal(false);
      setSelectedItem(null);
      setRestockAmount("");
      setResupplyDate("");
      fetchInventory();
    } finally {
      setActionLoading(false);
    }
  };

  // ── QUICK ADJUST ─────────────────────────────────────────────────────────
  const handleAdjustQuantity = async (
    item: InventoryItem,
    adjustment: number,
  ) => {
    const currentStock = item.remaining_stock;
    const newStock = Math.max(0, currentStock + adjustment);

    // Update inventory
    const { error: inventoryError } = await supabase
      .from("inventory")
      .update({ remaining_stock: newStock })
      .eq("item_no", item.item_no);

    if (inventoryError) {
      toast.error("Failed to adjust quantity");
      console.error(inventoryError);
      return;
    }

    // Conditional Delivery Sync: If stock increased, create delivery record
    if (newStock > currentStock) {
      const delta = newStock - currentStock;
      const deliveryDate = new Date().toISOString();

      const { error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          item_no: item.item_no,
          quantity_delivered: delta,
          delivery_date: deliveryDate,
        });

      if (deliveryError) {
        console.error("Failed to create delivery record:", deliveryError);
        toast.error("Quantity adjusted but delivery record failed to create");
      } else {
        toast.success(
          `Stock adjusted by ${adjustment}. Delivery record created for ${delta} ${item.units?.name || "unit"}(s).`,
        );
      }
    } else {
      toast.success(`Stock adjusted by ${adjustment}.`);
    }

    fetchInventory();
  };

  const openRestockModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setRestockAmount("");
    setShowRestockModal(true);
  };

  const openUpdateModal = (mode: "add" | "edit" | "remove") => {
    setUpdateMode(mode);
    setShowUpdateModal(true);
    if (mode === "add") {
      setNewItem({
        item_no: "",
        description: "",
        unit_id: "",
        remaining_stock: "",
        minimum_stock: "",
      });
      setItemIdPrefix("JMS");
      setItemIdNumber("");
      setItemIdLetter("");
      setItemIdExists(false);
      setItemNameExists(false);
    }
  };

  // Real-time check for duplicate Item ID
  const checkItemIdExists = (
    prefix: "JMS" | "GYM-S",
    number: string,
    letter: string,
    currentItemId = "",
  ) => {
    if (number) {
      const testId = buildItemNo(prefix, number, letter);
      const exists = inventory.some(
        (item) => item.item_no === testId && item.item_no !== currentItemId,
      );
      setItemIdExists(exists);
    } else {
      setItemIdExists(false);
    }
  };

  // Real-time check for duplicate Item Name
  const checkItemNameExists = (description: string, currentItemNo = "") => {
    if (description.trim()) {
      const exists = inventory.some(
        (item) =>
          item.description.toLowerCase() === description.toLowerCase() &&
          item.item_no !== currentItemNo,
      );
      setItemNameExists(exists);
    } else {
      setItemNameExists(false);
    }
  };

  // Real-time check for duplicate Unit Name
  const checkUnitNameExists = (name: string) => {
    if (name.trim()) {
      const exists = availableUnits.some(
        (unit) => unit.name.toLowerCase() === name.toLowerCase(),
      );
      setUnitNameExists(exists);
    } else {
      setUnitNameExists(false);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (!item.minimum_stock)
      return {
        label: "Unknown",
        color: "text-gray-600 bg-gray-50",
        icon: Package,
      };
    const percentage = (item.remaining_stock / item.minimum_stock) * 100;
    if (percentage < 30)
      return {
        label: "Critical",
        color: "text-red-600 bg-red-50",
        icon: AlertTriangle,
      };
    if (percentage < 60)
      return {
        label: "Low",
        color: "text-orange-600 bg-orange-50",
        icon: TrendingDown,
      };
    return {
      label: "Adequate",
      color: "text-green-600 bg-green-50",
      icon: TrendingUp,
    };
  };

  // Extract item prefix for category filtering
  const getItemPrefix = (itemNo: string): string => {
    if (itemNo.startsWith("GYM-S")) return "GYM";
    if (itemNo.startsWith("JMS")) return "JMS";
    return "";
  };

  const categories = Array.from(
    new Set(inventory.map((item) => item.units?.name || "").filter(Boolean)),
  ).sort();

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_no.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUnit =
      categoryFilter === "all" || item.units?.name === categoryFilter;
    const itemPrefix = getItemPrefix(item.item_no);
    const matchesPrefix =
      prefixFilter === "all" ||
      (prefixFilter === "JMS" && itemPrefix === "JMS") ||
      (prefixFilter === "GYM" && itemPrefix === "GYM");
    return matchesSearch && matchesUnit && matchesPrefix;
  });

  const totalItems = inventory.reduce(
    (sum, item) => sum + item.remaining_stock,
    0,
  );
  const lowStockCount = inventory.filter(
    (item) => item.minimum_stock && item.remaining_stock < item.minimum_stock,
  ).length;

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

  const getSortedInventory = (items: InventoryItem[]) => {
    const sorted = [...items];
    switch (sortOption) {
      case "name-az":
        return sorted.sort((a, b) =>
          (a.description || "").localeCompare(b.description || ""),
        );
      case "name-za":
        return sorted.sort((a, b) =>
          (b.description || "").localeCompare(a.description || ""),
        );
      case "unit-az":
        return sorted.sort((a, b) =>
          (a.units?.name || "").localeCompare(b.units?.name || ""),
        );
      case "unit-za":
        return sorted.sort((a, b) =>
          (b.units?.name || "").localeCompare(a.units?.name || ""),
        );
      case "stock-high":
        return sorted.sort((a, b) => b.remaining_stock - a.remaining_stock);
      case "stock-low":
        return sorted.sort((a, b) => a.remaining_stock - b.remaining_stock);
      case "id-az":
        return sorted.sort((a, b) =>
          (a.item_no || "").localeCompare(b.item_no || ""),
        );
      case "id-za":
        return sorted.sort((a, b) =>
          (b.item_no || "").localeCompare(a.item_no || ""),
        );
      default:
        return sorted;
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
        className={`fixed top-16 left-0 bottom-0 bg-white shadow-lg transition-all duration-300 z-20 ${isSidebarExpanded || isSidebarPinned ? "w-64" : "w-20"}`}
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? "bg-[#4A89B0] text-white shadow-md" : "text-gray-700 hover:bg-gray-100"}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`font-medium whitespace-nowrap transition-opacity duration-300 ${isSidebarExpanded || isSidebarPinned ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}
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
        className={`pt-16 transition-all duration-300 ${isSidebarExpanded || isSidebarPinned ? "pl-64" : "pl-20"}`}
      >
        <div className="p-4 lg:p-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Inventory Management
                </h1>
                <p className="text-gray-600 mt-1">
                  Track and manage your stock levels
                </p>
              </div>
              <button
                onClick={() => openUpdateModal("add")}
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
                    <p className="text-sm text-gray-600">
                      Total Items in Stock
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {loading ? "..." : totalItems}
                    </p>
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
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {loading ? "..." : lowStockCount}
                    </p>
                  </div>
                  <div className="bg-red-100 p-3 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by item name or ID..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={prefixFilter}
                    onChange={(e) => setPrefixFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent text-sm"
                  >
                    <option value="all">All Items</option>
                    <option value="JMS">JMS</option>
                    <option value="GYM">GYM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent text-sm"
                  >
                    <option value="all">All Units</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
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
                          | "name-az"
                          | "name-za"
                          | "unit-az"
                          | "unit-za"
                          | "stock-high"
                          | "stock-low"
                          | "id-az"
                          | "id-za",
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent text-sm"
                  >
                    <option value="name-az">Name (A-Z)</option>
                    <option value="name-za">Name (Z-A)</option>
                    <option value="unit-az">Unit (A-Z)</option>
                    <option value="unit-za">Unit (Z-A)</option>
                    <option value="stock-high">Stock (High)</option>
                    <option value="stock-low">Stock (Low)</option>
                    <option value="id-az">Item ID (A-Z)</option>
                    <option value="id-za">Item ID (Z-A)</option>
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
                        Unit
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
                    {loading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-gray-400"
                        >
                          Loading inventory...
                        </td>
                      </tr>
                    ) : filteredInventory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-gray-400"
                        >
                          <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p>No items found</p>
                        </td>
                      </tr>
                    ) : (
                      getSortedInventory(filteredInventory).map((item) => {
                        const percentage = item.minimum_stock
                          ? (item.remaining_stock / item.minimum_stock) * 100
                          : 100;
                        const status = getStockStatus(item);
                        const StatusIcon = status.icon;
                        return (
                          <tr key={item.item_no} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">
                                {item.description}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                {item.item_no}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-700">
                                {item.units?.name || "—"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-semibold text-gray-900">
                                {item.remaining_stock}{" "}
                                {item.units?.name || "unit"}
                              </div>
                              {item.minimum_stock && (
                                <>
                                  <div className="text-xs text-gray-500">
                                    Min: {item.minimum_stock}
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                    <div
                                      className={`h-1.5 rounded-full ${percentage < 30 ? "bg-red-600" : percentage < 60 ? "bg-orange-500" : "bg-green-500"}`}
                                      style={{
                                        width: `${Math.min(percentage, 100)}%`,
                                      }}
                                    />
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
                              >
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Restock Modal */}
            {showRestockModal && selectedItem && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">
                      Restock Item
                    </h3>
                    <button
                      onClick={() => setShowRestockModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">Item</div>
                      <div className="font-semibold text-gray-900">
                        {selectedItem.description}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        Current Stock
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedItem.remaining_stock}{" "}
                        {selectedItem.units?.name || "unit"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Restock Amount *
                      </label>
                      <input
                        type="text"
                        value={restockAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (
                            value === "" ||
                            (/^\d+$/.test(value) && parseInt(value) > 0)
                          ) {
                            setRestockAmount(value);
                          }
                        }}
                        placeholder="Enter quantity to add"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      />
                    </div>
                    {restockAmount && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-sm text-blue-800">
                          New stock level will be:{" "}
                          <span className="font-bold">
                            {selectedItem.remaining_stock +
                              parseInt(restockAmount)}{" "}
                            {selectedItem.units?.name}
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
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2 bg-[#4A89B0] text-white rounded-lg hover:bg-[#3776A0] transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? "Saving..." : "Confirm Restock"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deleteTarget && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">
                      Confirm Delete
                    </h3>
                    <p className="mt-3 text-sm text-gray-600">
                      Are you sure you want to remove "
                      {deleteTarget.description}" from inventory? This will also
                      delete all related requests, deliveries, and history.
                    </p>
                  </div>
                  <div className="p-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeleteTarget(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmRemoveItem}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading ? "Removing..." : "Remove Item"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Update Inventory Modal */}
            {showUpdateModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">
                      Update Inventory
                    </h3>
                    <button
                      onClick={() => setShowUpdateModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="border-b border-gray-200 flex">
                    {(["add", "edit", "remove"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setUpdateMode(mode);
                          setEditSearchItemNo("");
                          setEditSearchDescription("");
                          setRemoveSearchItemNo("");
                          setRemoveSearchDescription("");
                        }}
                        className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                          updateMode === mode
                            ? mode === "remove"
                              ? "border-b-2 border-red-500 text-red-600 bg-red-50"
                              : "border-b-2 border-[#4A89B0] text-[#4A89B0] bg-blue-50"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        {mode === "add" && (
                          <>
                            <Plus className="w-5 h-5" /> Add New Item
                          </>
                        )}
                        {mode === "edit" && (
                          <>
                            <Edit className="w-5 h-5" /> Edit/Adjust Items
                          </>
                        )}
                        {mode === "remove" && (
                          <>
                            <Trash2 className="w-5 h-5" /> Remove Items
                          </>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-y-auto" style={{ height: "500px" }}>
                    {/* ADD TAB */}
                    {updateMode === "add" && (
                      <div className="p-6 space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800">
                            Add a new item to your inventory. Fill in all
                            required fields marked with *.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Item ID *
                            </label>
                            <div className="flex gap-2 items-center">
                              <select
                                value={itemIdPrefix}
                                onChange={(e) => {
                                  const newPrefix = e.target.value as
                                    | "JMS"
                                    | "GYM-S";
                                  setItemIdPrefix(newPrefix);
                                  checkItemIdExists(
                                    newPrefix,
                                    itemIdNumber,
                                    itemIdLetter,
                                  );
                                }}
                                className="px-3 py-1.5 border-2 border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-[#4A89B0] font-semibold text-gray-900 cursor-pointer transition-colors hover:border-gray-400"
                              >
                                <option value="JMS">JMS</option>
                                <option value="GYM-S">GYM-S</option>
                              </select>
                              <input
                                type="text"
                                value={itemIdNumber}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "" || /^\d{0,3}$/.test(value)) {
                                    setItemIdNumber(value);
                                    checkItemIdExists(
                                      itemIdPrefix,
                                      value,
                                      itemIdLetter,
                                    );
                                  }
                                }}
                                placeholder="000"
                                maxLength={3}
                                className="w-20 px-3 py-1.5 border-2 border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-[#4A89B0] text-center font-semibold text-gray-900 transition-colors hover:border-gray-400"
                              />
                              <input
                                type="text"
                                value={itemIdLetter}
                                onChange={(e) => {
                                  const value = e.target.value
                                    .toUpperCase()
                                    .slice(0, 1);
                                  if (value === "" || /^[A-Z]$/.test(value)) {
                                    setItemIdLetter(value);
                                    checkItemIdExists(
                                      itemIdPrefix,
                                      itemIdNumber,
                                      value,
                                    );
                                  }
                                }}
                                placeholder="A"
                                maxLength={1}
                                className="w-12 px-3 py-1.5 border-2 border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-[#4A89B0] text-center font-semibold text-gray-900 transition-colors hover:border-gray-400 uppercase"
                              />
                              <span className="text-sm text-gray-500 font-mono bg-gray-100 px-3 py-1.5 rounded-lg">
                                →{" "}
                                {buildItemNo(
                                  itemIdPrefix,
                                  itemIdNumber,
                                  itemIdLetter,
                                )}
                              </span>
                            </div>
                            {itemIdExists && (
                              <p className="text-xs text-red-600 mt-1 font-medium">
                                ⚠ Item ID{" "}
                                {itemIdPrefix === "JMS"
                                  ? `JMS${itemIdNumber}${itemIdLetter.toUpperCase()}`
                                  : `GYM-S-${itemIdNumber}${itemIdLetter.toUpperCase()}`}{" "}
                                already exists
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Unit *
                            </label>
                            <div className="flex gap-2">
                              <select
                                value={newItem.unit_id}
                                onChange={(e) =>
                                  setNewItem({
                                    ...newItem,
                                    unit_id: e.target.value,
                                  })
                                }
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                              >
                                <option value="">Select a unit...</option>
                                {availableUnits
                                  .filter(
                                    (unit) =>
                                      unit.name.toLowerCase() !== "unit",
                                  )
                                  .map((unit) => (
                                    <option key={unit.pkid} value={unit.pkid}>
                                      {unit.name}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setShowAddUnitModal(true)}
                                className="px-4 py-2 bg-[#4A89B0] text-white rounded-lg hover:bg-[#3776A0] transition-colors flex items-center justify-center"
                                title="Add new unit"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Item Name *
                            </label>
                            <input
                              type="text"
                              value={newItem.description}
                              onChange={(e) => {
                                setNewItem({
                                  ...newItem,
                                  description: e.target.value,
                                });
                                checkItemNameExists(e.target.value);
                              }}
                              placeholder="e.g., Whiteboard Marker"
                              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent ${
                                itemNameExists
                                  ? "border-red-500 focus:ring-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {itemNameExists && (
                              <p className="text-red-500 text-sm mt-1">
                                ⚠ An item with this name already exists
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Initial Stock *
                            </label>
                            <input
                              type="text"
                              value={newItem.remaining_stock}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (
                                  value === "" ||
                                  (/^\d+$/.test(value) && parseInt(value) >= 0)
                                ) {
                                  setNewItem({
                                    ...newItem,
                                    remaining_stock:
                                      value === "" ? "" : parseInt(value),
                                  });
                                }
                              }}
                              placeholder="0"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <span className="flex items-center gap-2">
                                Minimum Stock Level
                                <span title="Alert threshold for low stock warnings">
                                  <Info className="w-4 h-4 text-gray-400" />
                                </span>
                              </span>
                            </label>
                            <input
                              type="text"
                              value={newItem.minimum_stock}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (
                                  value === "" ||
                                  (/^\d+$/.test(value) && parseInt(value) >= 0)
                                ) {
                                  setNewItem({
                                    ...newItem,
                                    minimum_stock:
                                      value === "" ? "" : parseInt(value),
                                  });
                                }
                              }}
                              placeholder="0"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
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
                            disabled={actionLoading}
                            className="px-6 py-2 bg-[#4A89B0] text-white rounded-lg hover:bg-[#3776A0] transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            <Plus className="w-5 h-5" />
                            {actionLoading
                              ? "Adding..."
                              : "Add Item to Inventory"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* EDIT TAB */}
                    {updateMode === "edit" && (
                      <div className="p-6 space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800">
                            Select an item to edit its details or adjust
                            quantity.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Search by Item No
                            </label>
                            <input
                              type="text"
                              value={editSearchItemNo}
                              onChange={(e) =>
                                setEditSearchItemNo(e.target.value)
                              }
                              placeholder="e.g., JMS010"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Search by Description
                            </label>
                            <input
                              type="text"
                              value={editSearchDescription}
                              onChange={(e) =>
                                setEditSearchDescription(e.target.value)
                              }
                              placeholder="e.g., Air Freshener"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                            />
                          </div>
                        </div>
                        {inventory.length === 0 ? (
                          <div className="p-12 text-center">
                            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">
                              No items in inventory yet
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {inventory
                              .filter(
                                (item) =>
                                  (editSearchItemNo === "" ||
                                    item.item_no
                                      .toLowerCase()
                                      .includes(
                                        editSearchItemNo.toLowerCase(),
                                      )) &&
                                  (editSearchDescription === "" ||
                                    item.description
                                      .toLowerCase()
                                      .includes(
                                        editSearchDescription.toLowerCase(),
                                      )),
                              )
                              .map((item) => (
                                <div
                                  key={item.item_no}
                                  className="border border-gray-200 rounded-lg p-4 hover:border-[#4A89B0] transition-colors"
                                >
                                  {editingItem &&
                                  editOriginalItemNo === item.item_no ? (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Item ID *
                                          </label>
                                          <div className="flex gap-2 items-center">
                                            <select
                                              value={itemIdPrefix}
                                              onChange={(e) => {
                                                const newPrefix = e.target
                                                  .value as "JMS" | "GYM-S";
                                                setItemIdPrefix(newPrefix);
                                                checkItemIdExists(
                                                  newPrefix,
                                                  itemIdNumber,
                                                  itemIdLetter,
                                                  editOriginalItemNo,
                                                );
                                              }}
                                              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#4A89B0] focus:border-[#4A89B0] text-sm"
                                            >
                                              <option value="JMS">JMS</option>
                                              <option value="GYM-S">
                                                GYM-S
                                              </option>
                                            </select>
                                            <input
                                              type="text"
                                              value={itemIdNumber}
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                if (
                                                  value === "" ||
                                                  /^\d{0,3}$/.test(value)
                                                ) {
                                                  setItemIdNumber(value);
                                                  checkItemIdExists(
                                                    itemIdPrefix,
                                                    value,
                                                    itemIdLetter,
                                                    editOriginalItemNo,
                                                  );
                                                }
                                              }}
                                              maxLength={3}
                                              placeholder="000"
                                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-[#4A89B0] focus:border-[#4A89B0] text-sm"
                                            />
                                            <input
                                              type="text"
                                              value={itemIdLetter}
                                              onChange={(e) => {
                                                const value = e.target.value
                                                  .toUpperCase()
                                                  .slice(0, 1);
                                                if (
                                                  value === "" ||
                                                  /^[A-Z]$/.test(value)
                                                ) {
                                                  setItemIdLetter(value);
                                                  checkItemIdExists(
                                                    itemIdPrefix,
                                                    itemIdNumber,
                                                    value,
                                                    editOriginalItemNo,
                                                  );
                                                }
                                              }}
                                              maxLength={1}
                                              placeholder="A"
                                              className="w-12 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-[#4A89B0] focus:border-[#4A89B0] text-sm uppercase"
                                            />
                                            <span className="text-sm text-gray-500 font-mono bg-gray-100 px-3 py-2 rounded-lg">
                                              →{" "}
                                              {buildItemNo(
                                                itemIdPrefix,
                                                itemIdNumber,
                                                itemIdLetter,
                                              )}
                                            </span>
                                          </div>
                                          {itemIdExists && (
                                            <p className="text-xs text-red-600 mt-1 font-medium">
                                              ⚠ Item ID{" "}
                                              {buildItemNo(
                                                itemIdPrefix,
                                                itemIdNumber,
                                                itemIdLetter,
                                              )}{" "}
                                              already exists
                                            </p>
                                          )}
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Unit
                                          </label>
                                          <select
                                            value={editingItem.unit_id}
                                            onChange={(e) =>
                                              setEditingItem({
                                                ...editingItem,
                                                unit_id: e.target.value,
                                              })
                                            }
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0]"
                                          >
                                            {availableUnits
                                              .filter(
                                                (unit) =>
                                                  unit.name.toLowerCase() !==
                                                  "unit",
                                              )
                                              .map((unit) => (
                                                <option
                                                  key={unit.pkid}
                                                  value={unit.pkid}
                                                >
                                                  {unit.name}
                                                </option>
                                              ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Current Stock
                                          </label>
                                          <input
                                            type="text"
                                            value={editingItem.remaining_stock}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              if (
                                                value === "" ||
                                                (/^\d+$/.test(value) &&
                                                  parseInt(value) >= 0)
                                              ) {
                                                setEditingItem({
                                                  ...editingItem,
                                                  remaining_stock:
                                                    value === ""
                                                      ? ""
                                                      : parseInt(value),
                                                });
                                              }
                                            }}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0]"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Minimum Stock
                                          </label>
                                          <input
                                            type="text"
                                            value={
                                              editingItem.minimum_stock ?? ""
                                            }
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              if (
                                                value === "" ||
                                                (/^\d+$/.test(value) &&
                                                  parseInt(value) >= 0)
                                              ) {
                                                setEditingItem({
                                                  ...editingItem,
                                                  minimum_stock:
                                                    value === ""
                                                      ? ""
                                                      : parseInt(value),
                                                });
                                              }
                                            }}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0]"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={handleEditItem}
                                          disabled={actionLoading}
                                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                          <Save className="w-4 h-4" />
                                          {actionLoading
                                            ? "Saving..."
                                            : "Save Changes"}
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingItem(null);
                                            setEditOriginalItemNo("");
                                            setItemIdExists(false);
                                          }}
                                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="flex items-start justify-between mb-3">
                                        <div>
                                          <h4 className="font-semibold text-gray-900">
                                            {item.description}
                                          </h4>
                                          <p className="text-sm text-gray-600">
                                            {item.item_no} • {item.units?.name}
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => {
                                            const parsed = parseItemNo(
                                              item.item_no,
                                            );
                                            setItemIdPrefix(parsed.prefix);
                                            setItemIdNumber(parsed.number);
                                            setItemIdLetter(parsed.letter);
                                            setEditOriginalItemNo(item.item_no);
                                            setItemIdExists(false);
                                            setEditingItem({
                                              ...item,
                                              remaining_stock:
                                                item.remaining_stock === 0
                                                  ? ""
                                                  : item.remaining_stock,
                                              minimum_stock:
                                                item.minimum_stock === 0
                                                  ? ""
                                                  : item.minimum_stock,
                                            } as EditableInventoryItem);
                                          }}
                                          className="px-3 py-1 bg-[#4A89B0] text-white text-sm rounded-lg hover:bg-[#3776A0] flex items-center gap-1"
                                        >
                                          <Edit className="w-4 h-4" /> Edit
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 mb-3">
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Current Stock
                                          </p>
                                          <p className="text-sm font-semibold">
                                            {item.remaining_stock}{" "}
                                            {item.units?.name}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">
                                            Minimum Stock
                                          </p>
                                          <p className="text-sm font-semibold">
                                            {item.minimum_stock ?? "—"}{" "}
                                            {item.units?.name}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">
                                          Quick Adjust:
                                        </span>
                                        {[-10, -1, 1, 10].map((adj) => (
                                          <button
                                            key={adj}
                                            onClick={() =>
                                              handleAdjustQuantity(item, adj)
                                            }
                                            className={`px-3 py-1 text-sm rounded ${adj < 0 ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                                          >
                                            {adj > 0 ? `+${adj}` : adj}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* REMOVE TAB */}
                    {updateMode === "remove" && (
                      <div className="p-6 space-y-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-sm text-red-800">
                            <strong>Warning:</strong> Removing items permanently
                            deletes them from your inventory. This cannot be
                            undone.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Search by Item No
                            </label>
                            <input
                              type="text"
                              value={removeSearchItemNo}
                              onChange={(e) =>
                                setRemoveSearchItemNo(e.target.value)
                              }
                              placeholder="e.g., JMS010"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Search by Description
                            </label>
                            <input
                              type="text"
                              value={removeSearchDescription}
                              onChange={(e) =>
                                setRemoveSearchDescription(e.target.value)
                              }
                              placeholder="e.g., Air Freshener"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                            />
                          </div>
                        </div>
                        {inventory.length === 0 ? (
                          <div className="p-12 text-center">
                            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No items to remove</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {inventory
                              .filter(
                                (item) =>
                                  (removeSearchItemNo === "" ||
                                    item.item_no
                                      .toLowerCase()
                                      .includes(
                                        removeSearchItemNo.toLowerCase(),
                                      )) &&
                                  (removeSearchDescription === "" ||
                                    item.description
                                      .toLowerCase()
                                      .includes(
                                        removeSearchDescription.toLowerCase(),
                                      )),
                              )
                              .map((item) => (
                                <div
                                  key={item.item_no}
                                  className="border border-gray-200 rounded-lg p-4 hover:border-red-300 transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <h4 className="font-semibold text-gray-900">
                                      {item.description}
                                    </h4>
                                    <p className="text-xs text-gray-500 font-mono mb-1">
                                      {item.item_no}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {item.units?.name} •{" "}
                                      {item.remaining_stock} in stock
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => requestRemoveItem(item)}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    <Trash2 className="w-4 h-4" /> Remove
                                  </button>
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

            {/* Add New Unit Modal */}
            {showAddUnitModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">
                      Add New Unit
                    </h3>
                    <button
                      onClick={() => {
                        setShowAddUnitModal(false);
                        setNewUnitName("");
                        setUnitNameExists(false);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit Name *
                      </label>
                      <input
                        type="text"
                        value={newUnitName}
                        onChange={(e) => {
                          setNewUnitName(e.target.value);
                          checkUnitNameExists(e.target.value);
                        }}
                        placeholder="e.g., pcs, box, liter, kg"
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !unitNameExists &&
                            newUnitName.trim()
                          ) {
                            handleAddNewUnit();
                          }
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent ${
                          unitNameExists
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-300"
                        }`}
                        autoFocus
                      />
                    </div>
                    {unitNameExists && (
                      <p className="text-red-600 text-sm font-medium">
                        ⚠ Unit "{newUnitName}" already exists
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Enter a short unit name (e.g., pcs for pieces, box, liter,
                      kg)
                    </p>
                  </div>
                  <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button
                      onClick={() => {
                        setShowAddUnitModal(false);
                        setNewUnitName("");
                        setUnitNameExists(false);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNewUnit}
                      disabled={
                        actionLoading || !newUnitName.trim() || unitNameExists
                      }
                      className="flex-1 px-4 py-2 bg-[#4A89B0] text-white rounded-lg hover:bg-[#3776A0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      {actionLoading ? "Adding..." : "Add Unit"}
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
