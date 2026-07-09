import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
  ReferenceLine,
  ComposedChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import {
  computeInventoryStats,
  buildProcurementRows,
} from "../../lib/forecastUtils";
import {
  Download,
  Calendar,
  PackageOpen,
  LogOut,
  LayoutDashboard,
  Inbox,
  Package,
  AlertCircle,
  BarChart3,
} from "lucide-react";

import { useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const getLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthNameToIndex: { [key: string]: number } = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

type MonthOption = {
  value: string;
  label: string;
};

// ── Custom tooltip for forecast charts ──────────────────────────────────────
const ForecastTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const itemName = payload[0]?.payload?.name;
  const monthLabel = payload[0]?.payload?.fullMonthLabel;
  const displayLabel = itemName
    ? `${itemName} (${monthLabel || label})`
    : monthLabel || label;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <div className="mb-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          {displayLabel}
        </p>
      </div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium text-gray-900">{p.value}</span>
          {typeof p.name === "string" &&
            p.name.toLowerCase().includes("forecast") && (
              <span className="text-purple-500 italic">(forecast)</span>
            )}
        </div>
      ))}
    </div>
  );
};

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [reportType, setReportType] = useState<string>("weekly");
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
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedCategoryDetail, setSelectedCategoryDetail] =
    useState<any>(null);
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [trendLoaded, setTrendLoaded] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendFilter, setTrendFilter] = useState<
    "all" | "consumable" | "borrowable"
  >("all");
  const [topRequestedItems, setTopRequestedItems] = useState<any[]>([]);
  const [trendPage, setTrendPage] = useState(1);
  const [trendPageSize, setTrendPageSize] = useState<5 | 10 | 20>(5);
  const [trendSearch, setTrendSearch] = useState<string>("");
  const [trendTotalPages, setTrendTotalPages] = useState(1);
  const [departmentActivity, setDepartmentActivity] = useState<any[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<
    "all" | "colleges" | "offices"
  >("all");
  const [totalRequestsWeek, setTotalRequestsWeek] = useState(0);
  const [itemsNeedRestock, setItemsNeedRestock] = useState(0);

  const [consumableBurnRate, setConsumableBurnRate] = useState<any[]>([]);
  const [borrowableUtilization, setBorrowableUtilization] = useState<any[]>([]);
  const [procurementPage, setProcurementPage] = useState(1);
  const [procurementTotalPages, setProcurementTotalPages] = useState(1);
  const [allRequestedItems, setAllRequestedItems] = useState<any[]>([]);

  const [inventoryStats, setInventoryStats] = useState<any>(null);
  const [totalOutOfStock, setTotalOutOfStock] = useState(0);

  // Fast-Moving Items
  const [velocityData, setVelocityData] = useState<any[]>([]);
  const [velocityCategory, setVelocityCategory] = useState<
    "all" | "consumable" | "borrowable"
  >("all");
  const [velocityPage, setVelocityPage] = useState(1);
  const [velocityPageInput, setVelocityPageInput] = useState<string>("1");
  const [velocityTotalPages, setVelocityTotalPages] = useState(1);
  const [velocityLoading, setVelocityLoading] = useState(false);
  const [isVelocityTableCollapsed, setIsVelocityTableCollapsed] =
    useState(false);

  // Velocity forecast (computed from velocity data)
  const [velocityForecast, setVelocityForecast] = useState<{
    [key: string]: number;
  } | null>(null);

  const [reportFacility, setReportFacility] = useState<"JMS" | "GYM">("JMS");

  const shortenItemName = (name: string, maxLength: number = 20): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + "...";
  };

  const categorizeDepartment = (dept: string): "college" | "office" | null => {
    const lower = dept.toLowerCase();
    if (lower.includes("college")) return "college";
    if (
      lower.includes("office") ||
      lower.includes("services") ||
      lower.includes("registrar") ||
      lower.includes("administration") ||
      lower.includes("library") ||
      lower.includes("counseling") ||
      lower.includes("research") ||
      lower.includes("guidance") ||
      lower.includes("maintenance") ||
      lower.includes("management") ||
      lower.includes("division") ||
      lower.includes("affairs") ||
      lower.includes("department") ||
      lower.includes("marketing") ||
      lower.includes("finance") ||
      lower.includes("operations") ||
      lower.includes("human resources") ||
      lower.includes("hr") ||
      lower.includes("it")
    )
      return "office";
    return null;
  };

  const fullMonths = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  // Canonical department lists for Colleges and Offices (used for consistent ordering/display)
  const collegesList = [
    "College of Engineering",
    "College of Science",
    "College of Humanities and Social Science",
    "College of Business Administration",
    "College of Education",
    "College of Nursing",
    "College of Information Systems and Technology Management",
  ];

  const officesList = [
    "IT Department",
    "HR Department",
    "Finance Department",
    "Operations Department",
    "Marketing Department",
    "Academic Affairs",
    "Administration",
    "Library Services",
    "Student Affairs",
    "Research and Development",
    "Utility worker",
  ];
  const now = new Date();
  const currentMonth = fullMonths[now.getMonth()];
  const currentYearStr = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const currentLastDay = new Date(currentYearStr, currentMonthIndex + 1, 0);
  const defaultMonthOption = `${currentMonth} 1 - ${currentMonth} ${currentLastDay.getDate()}, ${currentYearStr}`;
  const [ssmiMonthOption, setSsmiMonthOption] =
    useState<string>(defaultMonthOption);

  const [risReportFacility, setRisReportFacility] = useState<"JMS" | "GYM">(
    "JMS",
  );
  const [risMonthOption, setRisMonthOption] =
    useState<string>(defaultMonthOption);
  const [risWeekOption, setRisWeekOption] = useState<string>("week1");
  const [risDayOption, setRisDayOption] = useState<string>(
    getLocalISODate(new Date()),
  );
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const getDepartmentMonthLabel = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return `${fullMonths[month]} 1-${lastDay}, ${year}`;
  };

  const procurementRows = useMemo(
    () => buildProcurementRows(consumableBurnRate),
    [consumableBurnRate],
  );

  // ── Velocity chart data with forecast appended ───────────────────────────
  const velocityChartData = useMemo(() => {
    if (!velocityData.length) return [];

    const computeLinearTrendForecast = (values: number[]) => {
      const points = values.map((value, index) => ({ x: index + 1, y: value }));
      const n = points.length;
      if (n === 0) return 0;
      if (n === 1) return points[0].y;

      const sumX = points.reduce((sum, p) => sum + p.x, 0);
      const sumY = points.reduce((sum, p) => sum + p.y, 0);
      const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
      const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
      const denominator = n * sumX2 - sumX * sumX;
      if (denominator === 0) return points[n - 1].y;

      const b = (n * sumXY - sumX * sumY) / denominator;
      const a = (sumY - b * sumX) / n;
      const nextX = n + 1;
      return Math.max(0, Math.round(a + b * nextX));
    };

    return velocityData.map((item) => {
      const twoMoAgo = item.twoMonthsAgo ?? 0;
      const oneMoAgo = item.oneMonthAgo ?? 0;
      const curr = item.currentMonth ?? 0;
      const nextMonthForecast = computeLinearTrendForecast([
        twoMoAgo,
        oneMoAgo,
        curr,
      ]);
      return { ...item, nextMonthForecast };
    });
  }, [velocityData]);

  // ── Top items forecast (for Item Trend Analysis) ─────────────────────────
  const topItemsWithForecast = useMemo(() => {
    return topRequestedItems.map((item) => {
      const predicted =
        item.trend > 0
          ? Math.round(item.requests * (1 + item.trend / 100))
          : Math.round(item.requests * 0.95);
      return { ...item, predicted };
    });
  }, [topRequestedItems]);

  const filteredTrendItems = useMemo(() => {
    const query = trendSearch.trim().toLowerCase();
    if (!query) return topRequestedItems;
    return topRequestedItems.filter((item) =>
      item.name.toLowerCase().includes(query),
    );
  }, [topRequestedItems, trendSearch]);

  const paginatedTrendItems = useMemo(() => {
    const start = (trendPage - 1) * trendPageSize;
    return filteredTrendItems.slice(start, start + trendPageSize);
  }, [filteredTrendItems, trendPage, trendPageSize]);

  // ── Department activity with simple forecast + filtering ───────────────────
  const deptData = useMemo(() => {
    if (!departmentActivity.length) return [];

    // Build quick lookup of requests by department name
    const reqMap: Record<string, number> = {};
    departmentActivity.forEach((d) => {
      reqMap[d.dept] = Number(d.requests) || 0;
    });

    if (departmentFilter === "colleges") {
      // Show canonical colleges list (always show, even if zero)
      return collegesList.map((name) => ({
        dept: name,
        requests: reqMap[name] || 0,
      }));
    }

    if (departmentFilter === "offices") {
      // Show canonical offices list (always show, even if zero)
      return officesList.map((name) => ({
        dept: name,
        requests: reqMap[name] || 0,
      }));
    }

    // departmentFilter === 'all'
    // Show only canonical departments that have requests > 0 in the current month.
    const union = [...collegesList, ...officesList];
    const filtered = union
      .filter((name) => (reqMap[name] || 0) > 0)
      .map((name) => ({ dept: name, requests: reqMap[name] || 0 }));

    // Sort by requests descending for All view
    return filtered.sort((a, b) => b.requests - a.requests);
  }, [departmentActivity, departmentFilter]);

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
    fetchAllData();
    fetchDepartmentActivity();
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarExpanded", JSON.stringify(isSidebarExpanded));
  }, [isSidebarExpanded]);

  useEffect(() => {
    localStorage.setItem("sidebarPinned", JSON.stringify(isSidebarPinned));
  }, [isSidebarPinned]);

  useEffect(() => {
    fetchVelocityDataWithFilters(velocityCategory, velocityPage);
  }, [velocityCategory, velocityPage]);

  useEffect(() => {
    setVelocityPageInput(String(velocityPage));
  }, [velocityPage]);

  useEffect(() => {
    const pages = Math.max(
      1,
      Math.ceil(filteredTrendItems.length / trendPageSize),
    );
    setTrendTotalPages(pages);
    if (trendPage > pages) setTrendPage(pages);
  }, [filteredTrendItems, trendPageSize, trendPage]);

  useEffect(() => {
    // Update procurement table data when page changes
    if (allRequestedItems.length > 0) {
      const start = (procurementPage - 1) * 10;
      const end = start + 10;
      const pageData = allRequestedItems.slice(start, end);
      setConsumableBurnRate(pageData);
    }
  }, [procurementPage, allRequestedItems]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWeeklyRequests(),
        fetchTopRequestedItems(),
        fetchSummaryStats(),
        fetchAvailableMonths(),
        fetchCategorizedAssetAnalytics(),
        fetchVelocityDataWithFilters("all", 1),
      ]);
    } catch (error) {
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyRequests = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count } = await supabase
      .from("requests")
      .select("created_at", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString());
    setTotalRequestsWeek(count || 0);
  };

  const fetchMonthlyTrend = async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const shortMonths = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // 1. Pre-build the 13 monthly buckets (prevents missing months if there's no data)
    const trendByMonth: Record<
      string,
      {
        consumables: number;
        borrowables: number;
        isCurrent: boolean;
        fullMonthLabel: string;
      }
    > = {};
    const monthOrder: string[] = [];

    for (let i = 0; i < 13; i++) {
      const date = new Date(currentYear, currentMonthIndex - i, 1);
      const mIndex = date.getMonth();
      const year = date.getFullYear();
      const isCurrent = i === 0;
      const displayKey = `${shortMonths[mIndex]}${isCurrent ? " (Current)" : ""}`;
      const fullMonthLabel = `${fullMonths[mIndex]} ${year}${isCurrent ? " (Current)" : ""}`;

      monthOrder.push(displayKey);
      trendByMonth[displayKey] = {
        consumables: 0,
        borrowables: 0,
        isCurrent,
        fullMonthLabel,
      };
    }

    const { data: historyRows, error } = await supabase
      .from("inventory_history")
      .select("total_qty_issued, snapshot_date, period_label, item_type");

    if (error) {
      console.error("Failed to load monthly trend history:", error);
      return;
    }

    const parsePeriodLabel = (label: string) => {
      const monthMatch = label.match(
        /^(January|February|March|April|May|June|July|August|September|October|November|December)/i,
      );
      const yearMatch = label.match(/(\d{4})$/);
      if (!monthMatch || !yearMatch) return null;
      const monthName = monthMatch[1];
      const monthIndex = monthNameToIndex[monthName];
      const year = Number(yearMatch[1]);
      const isCurrent =
        monthIndex === currentMonthIndex && year === currentYear;
      return `${shortMonths[monthIndex]}${isCurrent ? " (Current)" : ""}`;
    };

    const withinWindow = (date: Date) => {
      const startDate = new Date(currentYear, currentMonthIndex - 12, 1);
      const endDate = new Date(
        currentYear,
        currentMonthIndex + 1,
        0,
        23,
        59,
        59,
        999,
      );
      return date >= startDate && date <= endDate;
    };

    (historyRows || []).forEach((row: any) => {
      let displayKey: string | null = null;

      if (row.snapshot_date) {
        const rowDate = new Date(row.snapshot_date);
        if (!Number.isNaN(rowDate.getTime()) && withinWindow(rowDate)) {
          const rowMonth = rowDate.getMonth();
          const rowYear = rowDate.getFullYear();
          const isCurrent =
            rowMonth === currentMonthIndex && rowYear === currentYear;
          displayKey = `${shortMonths[rowMonth]}${isCurrent ? " (Current)" : ""}`;
        }
      }

      if (!displayKey && row.period_label) {
        displayKey = parsePeriodLabel(row.period_label);
      }

      if (!displayKey || !trendByMonth[displayKey]) return;

      const quantity = Number(row.total_qty_issued) || 0;
      const itemType = row.item_type;

      if (itemType === "borrowable") {
        trendByMonth[displayKey].borrowables += quantity;
      } else {
        trendByMonth[displayKey].consumables += quantity;
      }
    });

    const trendData = monthOrder.reverse().map((key) => ({
      month: key,
      fullMonthLabel: trendByMonth[key].fullMonthLabel,
      consumables: trendByMonth[key].consumables,
      borrowables: trendByMonth[key].borrowables,
      isCurrent: trendByMonth[key].isCurrent,
    }));

    setMonthlyTrendData(trendData);
  };

  const loadMonthlyTrend = async () => {
    setTrendLoading(true);
    try {
      await fetchMonthlyTrend();
      setTrendLoaded(true);
    } catch (error) {
      console.error("Failed to load 13-month trend:", error);
      toast.error("Failed to load 13-month trend data.");
    } finally {
      setTrendLoading(false);
    }
  };

  const fetchTopRequestedItems = async () => {
    // 1. Calculate the start of last month to prevent pulling years of dead data
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const { data, error } = await supabase
      .from("requests")
      .select(
        "item_no, quantity_requested, created_at, inventory(description, unit_id, units(name))",
      )
      .gte("created_at", startOfLastMonth.toISOString());

    if (error) {
      toast.error("Failed to load request analytics data.");
      return;
    }

    // We removed the duplicate 'const now = new Date();' here since it's already declared above
    const thisMonth = now.getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const itemStats: Record<
      string,
      { name: string; thisMonth: number; lastMonth: number }
    > = {};

    (data || []).forEach((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const quantity = Number(row.quantity_requested) || 0;
      if (quantity === 0) return;
      const month = createdAt.getMonth();
      const rowAny = row as any;
      const itemNo = rowAny.item_no || "Unknown";
      const inventoryDescription = Array.isArray(rowAny.inventory)
        ? rowAny.inventory[0]?.description
        : rowAny.inventory?.description;
      const name = inventoryDescription || itemNo || "Unknown Item";

      if (!itemStats[itemNo]) {
        itemStats[itemNo] = { name, thisMonth: 0, lastMonth: 0 };
      }

      if (month === thisMonth) {
        itemStats[itemNo].thisMonth += quantity;
      }
      if (month === lastMonth) {
        itemStats[itemNo].lastMonth += quantity;
      }
    });

    const positiveThisMonthCounts = Object.entries(itemStats)
      .filter(([, stats]) => stats.thisMonth > 0)
      .sort(([, a], [, b]) => b.thisMonth - a.thisMonth);

    setTopRequestedItems(
      positiveThisMonthCounts.map(([item_no, stats]) => {
        const requests = stats.thisMonth;
        const previousMonthRequests = stats.lastMonth;
        const trendValue =
          previousMonthRequests > 0
            ? Math.round(
                ((requests - previousMonthRequests) / previousMonthRequests) *
                  100,
              )
            : 0;
        const isNew = previousMonthRequests === 0;
        const isHighVolume = requests >= 10;
        return {
          item_no,
          name: stats.name,
          requests,
          previousMonthRequests,
          trend: trendValue,
          isNew,
          trendLabel: isNew
            ? "New"
            : `${trendValue > 0 ? "+" : ""}${trendValue}%`,
          advice: isNew
            ? "New request item this month"
            : trendValue > 0
              ? isHighVolume
                ? "Consider increasing stock"
                : "Demand rising, monitor inventory"
              : "Demand stable or decreasing",
          adviceType: isNew
            ? "new"
            : trendValue > 0
              ? isHighVolume
                ? "increase"
                : "monitor"
              : "stable",
        };
      }),
    );

    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
    ];
    const topSix = Object.entries(positiveThisMonthCounts)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6);
  };

  const fetchDepartmentActivity = async () => {
    // Sum approved quantities per department for the current month only.
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      // Get all known departments (distinct) from requests table
      const { data: allDeptRows, error: allDeptError } = await supabase
        .from("requests")
        .select("department")
        .not("department", "is", null);

      if (allDeptError) {
        console.error("Error fetching all departments:", allDeptError);
      }

      const allDepartments = Array.from(
        new Set(
          (allDeptRows || []).map((r: any) => r.department).filter(Boolean),
        ),
      );

      // Fetch all request rows for the selected month.
      const { data: currentRows, error: curErr } = await supabase
        .from("requests")
        .select("department, quantity_requested")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      if (curErr) {
        console.error("Error fetching department monthly rows:", curErr);
      }

      const mapRows = (rows: any) => {
        const m: Record<string, number> = {};
        (rows || []).forEach((r: any) => {
          const dept = r.department || "Unknown";
          m[dept] = (m[dept] || 0) + 1; // count rows per department
        });
        return m;
      };

      const currentMap = mapRows(currentRows);

      const results: { dept: string; requests: number }[] = [];

      allDepartments.forEach((d) => {
        const c = currentMap[d] || 0;
        results.push({ dept: d, requests: c });
      });

      // Include any departments that appeared in the currentMap but weren't in allDepartments
      Object.keys(currentMap).forEach((d) => {
        if (!allDepartments.includes(d)) {
          const c = currentMap[d] || 0;
          results.push({ dept: d, requests: c });
        }
      });

      setDepartmentActivity(
        results
          .sort((a, b) => b.requests - a.requests)
          .map((r) => ({
            dept: r.dept,
            requests: r.requests,
          })),
      );
    } catch (err) {
      console.error("Error in fetchDepartmentActivity:", err);
    }
  };

  const fetchSummaryStats = async () => {
    const { data } = await supabase
      .from("inventory")
      .select("remaining_stock, critical_stock");
    const outOfStockCount = (data || []).filter(
      (item) => item.remaining_stock <= 0,
    ).length;
    setItemsNeedRestock(outOfStockCount);
    setTotalOutOfStock(outOfStockCount); // ← add this
  };

  const parsePeriodLabelToMonthYear = (label: string) => {
    const rangeRegex = new RegExp(
      "^(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2}\\s*-\\s*(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},\\s*(\\d{4})$",
      "i",
    );
    const monthYearRegex = new RegExp(
      "^(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{4})$",
      "i",
    );
    const rangeMatch = label.match(rangeRegex);
    if (rangeMatch) {
      const monthName =
        rangeMatch[1][0].toUpperCase() + rangeMatch[1].slice(1).toLowerCase();
      const monthIndex = monthNameToIndex[monthName];
      const year = Number(rangeMatch[3]);
      return { monthIndex, year, isRange: true };
    }
    const monthYearMatch = label.match(monthYearRegex);
    if (monthYearMatch) {
      const monthName =
        monthYearMatch[1][0].toUpperCase() + monthYearMatch[1].slice(1).toLowerCase();
      const monthIndex = monthNameToIndex[monthName];
      const year = Number(monthYearMatch[2]);
      return { monthIndex, year, isRange: false };
    }
    return null;
  };

  const isRangePeriodLabel = (label: string) => {
    return parsePeriodLabelToMonthYear(label)?.isRange === true;
  };

  const canonicalMonthRangeLabel = (monthIndex: number, year: number) => {
    const monthName = fullMonths[monthIndex];
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return `${monthName} 1 - ${monthName} ${lastDay}, ${year}`;
  };

  const fetchAvailableMonths = async () => {
    const { data } = await supabase
      .from("inventory_history")
      .select("period_label")
      .not("period_label", "is", null);

    const monthMap = new Map<
      string,
      {
        value: string;
        displayLabel: string;
        isRange: boolean;
        year: number;
        monthIndex: number;
      }
    >();

    (data || []).forEach((row: any) => {
      const label = String(row.period_label || "").trim();
      if (!label) return;

      const parsed = parsePeriodLabelToMonthYear(label);
      if (!parsed) return;

      const key = `${parsed.year}-${parsed.monthIndex}`;
      const displayLabel = parsed.isRange
        ? label
        : canonicalMonthRangeLabel(parsed.monthIndex, parsed.year);
      const existing = monthMap.get(key);
      if (!existing || (!existing.isRange && parsed.isRange)) {
        monthMap.set(key, {
          value: label,
          displayLabel,
          isRange: parsed.isRange,
          year: parsed.year,
          monthIndex: parsed.monthIndex,
        });
      }
    });

    const monthOptions = Array.from(monthMap.values()).sort((a, b) => {
      const yearDiff = b.year - a.year;
      if (yearDiff !== 0) return yearDiff;
      return b.monthIndex - a.monthIndex;
    });

    setAvailableMonths(
      monthOptions.map((entry) => ({ value: entry.value, label: entry.displayLabel })),
    );

    if (monthOptions.length > 0) {
      if (!monthOptions.some((opt) => opt.value === risMonthOption))
        setRisMonthOption(monthOptions[0].value);
      if (!monthOptions.some((opt) => opt.value === ssmiMonthOption))
        setSsmiMonthOption(monthOptions[0].value);
    }
  };

  const fetchCategorizedAssetAnalytics = async () => {
    try {
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select("item_no, description, remaining_stock, item_type");

      if (inventoryError) {
        console.error("Error fetching inventory data:", inventoryError);
        return;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const daysInCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();

      const { data: currentRequests, error: requestsError } = await supabase
        .from("requests")
        .select("item_no, quantity_requested")
        .eq("status", "approved")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      if (requestsError) {
        console.error(
          "Error fetching current month approved requests:",
          requestsError,
        );
        return;
      }

      const requestsByItem: Record<
        string,
        Array<{ quantity_requested: number }>
      > = {};
      (currentRequests || []).forEach((req) => {
        const quantity = Number(req.quantity_requested) || 0;
        requestsByItem[req.item_no] = requestsByItem[req.item_no] || [];
        requestsByItem[req.item_no].push({ quantity_requested: quantity });
      });

      const consumableMetrics: any[] = [];
      const borrowableMetrics: any[] = [];

      (inventoryData || []).forEach((item) => {
        const itemType = item.item_type || "consumable";
        const itemRequests = requestsByItem[item.item_no] || [];

        if (itemType === "consumable") {
          const totalUsed = itemRequests.reduce(
            (sum, req) => sum + (Number(req.quantity_requested) || 0),
            0,
          );
          const weeklyBurnRate = parseFloat((totalUsed / 4.33).toFixed(2));
          const weeksUntilStockout =
            weeklyBurnRate > 0
              ? Math.ceil(item.remaining_stock / weeklyBurnRate)
              : null;
          const recommendation =
            weeksUntilStockout !== null && weeksUntilStockout <= 2
              ? "Critical: Reorder immediately"
              : weeksUntilStockout !== null && weeksUntilStockout <= 4
                ? "Plan procurement"
                : "Monitor usage";

          consumableMetrics.push({
            item_no: item.item_no,
            description: item.description,
            currentStock: item.remaining_stock,
            totalUsed,
            weeklyBurnRate,
            weeksUntilStockout,
            recommendation,
          });
        } else {
          const totalRequests = itemRequests.length;
          const utilizationPercentage = parseFloat(
            ((totalRequests / daysInCurrentMonth) * 100).toFixed(1),
          );
          const recommendation =
            utilizationPercentage < 5
              ? "Low utilization - do not restock"
              : utilizationPercentage <= 20
                ? "Healthy utilization"
                : "High utilization - monitor availability";

          borrowableMetrics.push({
            item_no: item.item_no,
            description: item.description,
            currentStock: item.remaining_stock,
            totalRequests,
            utilizationPercentage,
            recommendation,
          });
        }
      });

      const sortedConsumables = consumableMetrics.sort(
        (a, b) => b.weeklyBurnRate - a.weeklyBurnRate,
      );
      const sortedBorrowables = borrowableMetrics.sort(
        (a, b) => b.utilizationPercentage - a.utilizationPercentage,
      );

      setAllRequestedItems(sortedConsumables);
      setProcurementTotalPages(Math.ceil(sortedConsumables.length / 10));
      setProcurementPage(1);
      setConsumableBurnRate(sortedConsumables.slice(0, 10));

      setBorrowableUtilization(sortedBorrowables.slice(0, 5));

      const burnRateValues = sortedConsumables.map(
        (item) => item.weeklyBurnRate,
      );
      const stockValues = sortedConsumables.map((item) => item.currentStock);
      setInventoryStats(computeInventoryStats(burnRateValues, stockValues));
    } catch (error) {
      console.error("Error fetching categorized asset analytics:", error);
    }
  };

  const fetchVelocityDataWithFilters = async (
    category: "all" | "consumable" | "borrowable" = "all",
    page: number = 1,
  ) => {
    try {
      setVelocityLoading(true);
      const now = new Date();
      const currentMonthIndex = now.getMonth();
      const currentYear = now.getFullYear();

      const prevDate = new Date(currentYear, currentMonthIndex - 1, 1);
      const prevMonthIndex = prevDate.getMonth();
      const prevYear = prevDate.getFullYear();
      const twoMonthsAgoDate = new Date(currentYear, currentMonthIndex - 2, 1);
      const twoMonthsAgoIndex = twoMonthsAgoDate.getMonth();
      const twoMonthsAgoYear = twoMonthsAgoDate.getFullYear();

      const currentMonthStart = new Date(currentYear, currentMonthIndex, 1);
      const currentMonthEnd = new Date(
        currentYear,
        currentMonthIndex + 1,
        0,
        23,
        59,
        59,
      );
      const prevMonthStart = new Date(prevYear, prevMonthIndex, 1);
      const prevMonthEnd = new Date(
        prevYear,
        prevMonthIndex + 1,
        0,
        23,
        59,
        59,
      );
      const twoMonthsAgoStart = new Date(
        twoMonthsAgoYear,
        twoMonthsAgoIndex,
        1,
      );
      const twoMonthsAgoEnd = new Date(
        twoMonthsAgoYear,
        twoMonthsAgoIndex + 1,
        0,
        23,
        59,
        59,
      );

      const { data: currentMonthRequests } = await supabase
        .from("requests")
        .select(
          "item_no, quantity_requested, inventory(description, item_type)",
        )
        .gte("created_at", currentMonthStart.toISOString())
        .lte("created_at", currentMonthEnd.toISOString());
      const { data: prevMonthRequests } = await supabase
        .from("requests")
        .select(
          "item_no, quantity_requested, inventory(description, item_type)",
        )
        .gte("created_at", prevMonthStart.toISOString())
        .lte("created_at", prevMonthEnd.toISOString());
      const { data: twoMonthsAgoRequests } = await supabase
        .from("requests")
        .select(
          "item_no, quantity_requested, inventory(description, item_type)",
        )
        .gte("created_at", twoMonthsAgoStart.toISOString())
        .lte("created_at", twoMonthsAgoEnd.toISOString());

      const velocityMap: Record<
        string,
        {
          item_no: string;
          name: string;
          twoMonthsAgo: number;
          oneMonthAgo: number;
          currentMonth: number;
          itemType: string;
        }
      > = {};

      const processReqs = (
        reqs: any[],
        field: "twoMonthsAgo" | "oneMonthAgo" | "currentMonth",
      ) => {
        (reqs || []).forEach((req: any) => {
          if (!req.item_no) return;
          const itemType = Array.isArray(req.inventory)
            ? req.inventory[0]?.item_type
            : req.inventory?.item_type;
          if (category !== "all" && itemType !== category) return;
          const description = Array.isArray(req.inventory)
            ? req.inventory[0]?.description
            : req.inventory?.description;
          const itemName = description || req.item_no;
          if (!velocityMap[req.item_no]) {
            velocityMap[req.item_no] = {
              item_no: req.item_no,
              name: itemName,
              twoMonthsAgo: 0,
              oneMonthAgo: 0,
              currentMonth: 0,
              itemType: itemType || "unknown",
            };
          }
          velocityMap[req.item_no][field] +=
            Number(req.quantity_requested) || 0;
        });
      };

      processReqs(twoMonthsAgoRequests || [], "twoMonthsAgo");
      processReqs(prevMonthRequests || [], "oneMonthAgo");
      processReqs(currentMonthRequests || [], "currentMonth");

      const sortedVelocity = Object.values(velocityMap)
        .filter(
          (item) =>
            item.twoMonthsAgo > 0 ||
            item.oneMonthAgo > 0 ||
            item.currentMonth > 0,
        )
        .sort(
          (a, b) =>
            b.twoMonthsAgo +
            b.oneMonthAgo +
            b.currentMonth -
            (a.twoMonthsAgo + a.oneMonthAgo + a.currentMonth),
        );

      const itemsPerPage = 10;
      const startIndex = (page - 1) * itemsPerPage;
      const paginatedVelocity = sortedVelocity
        .slice(startIndex, startIndex + itemsPerPage)
        .map((item, index) => ({
          ...item,
          index: index + 1,
          displayName: `#${index + 1}`,
        }));

      const calculatedTotalPages = Math.ceil(
        sortedVelocity.length / itemsPerPage,
      );
      setVelocityTotalPages(calculatedTotalPages);
      setVelocityData(paginatedVelocity);

      // Reset to page 1 if current page exceeds total pages
      if (page > calculatedTotalPages && calculatedTotalPages > 0) {
        setVelocityPage(1);
      }
    } catch (error) {
      console.error("Error fetching velocity data:", error);
    } finally {
      setVelocityLoading(false);
    }
  };

  // ── PRINT PROCUREMENT SUMMARY PDF ────────────────────────────────────────
  const printProcurementSummary = async () => {
    setGenerating("Procurement");
    try {
      const doc = new jsPDF("portrait");
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const now = new Date();
      const monthName = fullMonths[now.getMonth()];
      const year = now.getFullYear();
      const margin = 14;

      const { data: inventoryRows, error } = await supabase
        .from("inventory")
        .select(
          "item_no, description, remaining_stock, critical_stock, item_type",
        );

      if (error) {
        console.error("Failed to load critical inventory items:", error);
      }

      const criticalStockItems = (inventoryRows || []).filter(
        (item: any) =>
          item.critical_stock !== null &&
          item.critical_stock !== undefined &&
          Number(item.remaining_stock) <= Number(item.critical_stock),
      );

      // Use RIS-style header but replace RIS title with Procurement Decision Summary
      doc.setFontSize(9).setFont("times");
      doc.text("Republic of the Philippines", pageWidth / 2, 15, {
        align: "center",
      });
      doc.setFont("times", "bold").setFontSize(10);
      doc.text("PAMANTASAN NG LUNGSOD NG MAYNILA", pageWidth / 2, 20, {
        align: "center",
      });
      doc.setFont("times", "normal").setFontSize(9);
      doc.text(
        "(University of the City of Manila)\nIntramuros, Manila",
        pageWidth / 2,
        24,
        {
          align: "center",
        },
      );
      doc.setFont("times", "bold");
      doc.text("GYMNASIUM MANAGEMENT SECTION", pageWidth / 2, 34, {
        align: "center",
      });
      doc
        .setFontSize(14)
        .text("PROCUREMENT DECISION SUMMARY", pageWidth / 2, 42, {
          align: "center",
        });

      doc.setFont("times", "normal").setFontSize(10);
      doc.text(`Reporting Period: ${monthName} ${year}`, margin, 52);
      doc.text(
        `Generated: ${now.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        pageWidth - margin,
        52,
        { align: "right" },
      );

      // Center the critical stock title
      doc.setFont("times", "bold").setFontSize(12);
      doc.text(
        "CRITICAL STOCK ITEMS — STOCK AT OR BELOW CRITICAL LEVEL",
        pageWidth / 2,
        62,
        { align: "center" },
      );

      // Sort: GYM items first (ascending), then JMS items (ascending), then others
      const sortedCritical = (criticalStockItems || [])
        .slice()
        .sort((a: any, b: any) => {
          const aNo = (a.item_no || "").toString().toUpperCase();
          const bNo = (b.item_no || "").toString().toUpperCase();
          const rank = (no: string) => {
            if (no.startsWith("GYM")) return "0" + no;
            if (no.startsWith("JMS")) return "1" + no;
            return "2" + no;
          };
          return rank(aNo).localeCompare(rank(bNo));
        });

      const bodyData = sortedCritical.map((item: any) => [
        item.item_no || "",
        item.description || item.item_no || "Unknown item",
        String(item.remaining_stock ?? ""),
        String(item.stock_threshold ?? item.critical_stock ?? ""),
      ]);

      // Compute column widths to fit within page margins and center the table
      const availableWidth = pageWidth - margin * 2;
      // Allocate widths (adjustable): Item No 12%, Description 58%, Current Stock 15%, Threshold 15%
      const col0 = Math.round(availableWidth * 0.12);
      const col1 = Math.round(availableWidth * 0.58);
      const col2 = Math.round(availableWidth * 0.15);
      const col3 = availableWidth - (col0 + col1 + col2);
      const tableTotalWidth = col0 + col1 + col2 + col3;
      const marginLeft = Math.max(
        margin,
        Math.round((pageWidth - tableTotalWidth) / 2),
      );

      autoTable(doc, {
        startY: 68,
        margin: { left: marginLeft, right: margin },
        tableWidth: tableTotalWidth,
        head: [
          [
            { content: "Item No.", styles: { halign: "center" as const } },
            {
              content: "Item Description",
              styles: { halign: "left" as const },
            },
            { content: "Current Stock", styles: { halign: "center" as const } },
            {
              content: "Item Threshold",
              styles: { halign: "center" as const },
            },
          ],
        ],
        body:
          bodyData.length > 0
            ? bodyData
            : [["No critical stock items found", "", "", ""]],
        theme: "grid",
        styles: {
          font: "times",
          fontSize: 9,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineColor: [0, 0, 0],
        },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
          0: { cellWidth: col0, halign: "center" as const },
          1: { cellWidth: col1 },
          2: { cellWidth: col2, halign: "center" as const },
          3: { cellWidth: col3, halign: "center" as const },
        },
      });

      const totalPages = (doc as any).internal.pages.length - 1;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("times", "normal");
        doc.setFontSize(8);
        doc.text(
          `Page ${p} of ${totalPages}`,
          pageWidth - margin,
          pageHeight - 8,
          {
            align: "right",
          },
        );
        doc.text(`${monthName} ${year}`, margin, pageHeight - 8);
      }

      doc.save(`Procurement_Critical_Stock_${monthName}_${year}.pdf`);
      toast.success("Procurement Summary Downloaded!");
    } catch (err) {
      toast.error("Failed to generate procurement summary.");
      console.error(err);
    } finally {
      setGenerating(null);
    }
  };

  const handleCaptureSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const now = new Date();
      const monthName = fullMonths[now.getMonth()];
      const year = now.getFullYear();
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const periodLabel = `${monthName} 1 - ${monthName} ${lastDay}, ${year}`;

      const { data: currentInventory, error: fetchError } = await supabase
        .from("inventory")
        .select("item_no, remaining_stock, description, unit_cost");
      if (fetchError || !currentInventory) throw fetchError;

      const snapshotData = currentInventory.map((item) => ({
        item_no: item.item_no,
        period_label: periodLabel,
        stock_on_hand: item.remaining_stock,
        balance_on_hand: item.remaining_stock,
        unit_cost: item.unit_cost || 0,
        total_cost: 0,
        delivery: 0,
        total_qty_issued: 0,
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0,
        item_type: (item as any).item_type || "consumable",
      }));

      const { error: insertError } = await supabase
        .from("inventory_history")
        .upsert(snapshotData, { onConflict: "item_no,period_label" });
      if (insertError) throw new Error("Failed to save snapshot.");

      toast.success(
        `Opening balance for ${monthName} has been securely locked!`,
      );
      fetchAvailableMonths();
    } catch (error: any) {
      toast.error(error.message || "Failed to capture inventory snapshot.");
    } finally {
      setSnapshotLoading(false);
    }
  };

  // ── SSMI PDF (unchanged) ────────────────────────────────────────────────
  const generateSSMIPDF = async () => {
    setGenerating("SSMI");
    const prefix = reportFacility === "JMS" ? "JMS" : "GYM-S";
    try {
      const isHistoricalMonth = availableMonths.some(
        (option) => option.value === ssmiMonthOption,
      );
      if (isHistoricalMonth) {
        const { data: historyItems, error: historyError } = await supabase
          .from("inventory_history")
          .select(
            "item_no, stock_on_hand, total_qty_issued, unit_cost, week1, week2, week3, week4",
          )
          .ilike("item_no", `${prefix}%`)
          .eq("period_label", ssmiMonthOption)
          .order("item_no", { ascending: true });
        if (historyError) {
          console.error("Failed to load SSMI history items:", historyError);
          toast.error(`Failed to load SSMI data for ${ssmiMonthOption}`);
          setGenerating(null);
          return;
        }
        if (!historyItems || historyItems.length === 0) {
          toast.error(`No data found for ${ssmiMonthOption}`);
          setGenerating(null);
          return;
        }

        const itemNos = historyItems
          .map((item) => item.item_no)
          .filter(Boolean);
        const { data: inventoryDescData, error: invError } = await supabase
          .from("inventory")
          .select("item_no, description")
          .in("item_no", itemNos);
        if (invError) {
          console.error("Failed to load inventory descriptions:", invError);
        }
        const descriptionMap: Record<string, string> = {};
        (inventoryDescData || []).forEach((inv) => {
          descriptionMap[inv.item_no] = inv.description || "";
        });

        const parts = ssmiMonthOption.split(" ");
        const monthName = parts[0];
        const yearStr = parts[parts.length - 1];
        const monthIndex = monthNameToIndex[monthName];
        const year = parseInt(yearStr);
        const lastDay = new Date(year, monthIndex + 1, 0);

        const bodyData = historyItems.map((item) => {
          const w1 = item.week1 || 0,
            w2 = item.week2 || 0,
            w3 = item.week3 || 0,
            w4 = item.week4 || 0;
          const totalQty = item.total_qty_issued || 0,
            stockOnHand = item.stock_on_hand || 0;
          const unitCost = item.unit_cost || 0,
            totalCost = totalQty * unitCost;
          const balanceOnHand = stockOnHand - totalQty;
          const description = descriptionMap[item.item_no] || "";
          return [
            item.item_no || "",
            description,
            stockOnHand,
            w1 || "",
            w2 || "",
            w3 || "",
            w4 || "",
            "",
            totalQty || 0,
            unitCost > 0 ? unitCost.toFixed(2) : "",
            totalCost > 0 ? totalCost.toFixed(2) : "",
            balanceOnHand,
          ];
        });

        const doc = new jsPDF("landscape");
        doc.setFont("times");
        const pageWidth = doc.internal.pageSize.width;
        const fetchStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
        const fetchEnd = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${lastDay.getDate()}`;

        doc
          .setFontSize(12)
          .text("Pamantasan ng Lungsod ng Maynila", pageWidth / 2, 12, {
            align: "center",
          });
        doc
          .setFont("times", "bold")
          .setFontSize(11)
          .text("SUMMARY OF SUPPLIES AND MATERIALS ISSUED", pageWidth / 2, 18, {
            align: "center",
          });
        doc
          .setFont("times", "normal")
          .text("General Services Office", pageWidth / 2, 24, {
            align: "center",
          });
        doc
          .setFontSize(10)
          .text(`For the Period: ${fetchStart} to ${fetchEnd}`, 15, 32);
        doc.text(`No. GS0${prefix}-${year}-02`, pageWidth - 15, 32, {
          align: "right",
        });

        const m = lastDay
          .toLocaleString("default", { month: "short" })
          .toUpperCase();

        autoTable(doc, {
          head: [
            [
              {
                content: "Item No.",
                rowSpan: 3,
                styles: { valign: "middle", halign: "center" },
              },
              {
                content: "Item Description",
                rowSpan: 3,
                styles: { valign: "middle", halign: "center" },
              },
              {
                content: "Stock Hand",
                rowSpan: 3,
                styles: { valign: "middle", halign: "center" },
              },
              {
                content:
                  "Requisition and Issue Slip Numbers Used for Other Supplies Quantity Issued",
                colSpan: 5,
                styles: { halign: "center", fontStyle: "bold" },
              },
              {
                content: "Total Qty Issued",
                rowSpan: 3,
                styles: { valign: "middle", halign: "center" },
              },
              {
                content: "Unit Cost\n(PhP)",
                rowSpan: 3,
                styles: { valign: "middle", halign: "center" },
              },
              {
                content: "Total Cost\n(PhP)",
                rowSpan: 3,
                styles: { valign: "middle", halign: "center" },
              },
              {
                content: "Balance on\nHand",
                rowSpan: 3,
                styles: { valign: "middle", halign: "center" },
              },
            ],
            [
              { content: `1-8 ${m}`, styles: { halign: "center" } },
              { content: `9-15 ${m}`, styles: { halign: "center" } },
              { content: `16-22 ${m}`, styles: { halign: "center" } },
              {
                content: `23-${lastDay.getDate()} ${m}`,
                styles: { halign: "center" },
              },
              {
                content: "DELIVERY",
                rowSpan: 2,
                styles: { halign: "center", valign: "middle" },
              },
            ],
            [
              { content: "1", styles: { halign: "center", fontStyle: "bold" } },
              { content: "2", styles: { halign: "center", fontStyle: "bold" } },
              { content: "3", styles: { halign: "center", fontStyle: "bold" } },
              { content: "4", styles: { halign: "center", fontStyle: "bold" } },
            ],
          ],
          body: bodyData,
          foot: [
            [
              {
                content: `TOTAL AMOUNT ${" . ".repeat(180)}`,
                colSpan: 12,
                styles: {
                  halign: "left",
                  fontStyle: "bold",
                  overflow: "hidden",
                  fillColor: [255, 255, 255],
                  textColor: [0, 0, 0],
                  lineWidth: 0.1,
                  lineColor: [0, 0, 0],
                },
              },
            ],
          ],
          showFoot: "lastPage",
          startY: 36,
          theme: "grid",
          styles: {
            fontSize: 8,
            font: "times",
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 },
          },
          headStyles: {
            fillColor: [255, 255, 255],
            halign: "center",
            valign: "middle",
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 24, halign: "center" },
            1: { cellWidth: 70 },
            2: { halign: "center" },
            3: { halign: "center" },
            4: { halign: "center" },
            5: { halign: "center" },
            6: { halign: "center" },
            7: { halign: "center" },
            8: { halign: "center" },
            9: { halign: "right" },
            10: { halign: "right" },
            11: { cellWidth: 25, halign: "center" },
          },
        });

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY,
          theme: "grid",
          styles: {
            fontSize: 9,
            font: "times",
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            cellPadding: 4,
          },
          body: [
            [
              {
                content:
                  "Prepared by:\n\n\nGRACIANO B. MONTIADORA\nStore keeper I",
                styles: { halign: "left" },
              },
              {
                content: "Noted by:\n\n\nEMILY E. ESPERO\nChief, GSO",
                styles: { halign: "left" },
              },
              {
                content:
                  "Posted in the SLC by:\n\n\nMA. ELVIRA B. SALAMAT\nAdministrative Assistant I",
                styles: { halign: "left" },
              },
            ],
          ],
        });

        doc.save(
          `SSMI_${reportFacility}_${ssmiMonthOption.replace(" ", "_")}.pdf`,
        );
        toast.success("SSMI Report Downloaded!");
      } else {
        toast.error(`Month ${ssmiMonthOption} not found in inventory history.`);
      }
    } catch (err) {
      toast.error("Failed to generate report.");
    } finally {
      setGenerating(null);
    }
  };

  // ── RIS WEEKLY PDF (unchanged) ──────────────────────────────────────────
  const generateRISWeeklyPDF = async () => {
    setGenerating("Weekly");
    try {
      const prefix = risReportFacility === "JMS" ? "JMS" : "GYM-S";
      const parts = risMonthOption.split(" ");
      const monthName = parts[0];
      const yearStr = parts[parts.length - 1];
      const monthIndex = monthNameToIndex[monthName];
      const year = parseInt(yearStr);
      const weekRanges: { [key: string]: [number, number] } = {
        week1: [1, 8],
        week2: [9, 15],
        week3: [16, 22],
        week4: [23, 31],
      };
      const [startDay, endDay] = weekRanges[risWeekOption] || [1, 8];

      let historyData: any[] = [];
      const { data: historicalData } = await supabase
        .from("inventory_history")
        .select("item_no, item_description, week1, week2, week3, week4")
        .ilike("item_no", `${prefix}%`)
        .eq("period_label", risMonthOption);

      if (historicalData && historicalData.length > 0) {
        historyData = historicalData;
      } else {
        const isCurrentMonth =
          monthName === currentMonth && year === new Date().getFullYear();
        if (isCurrentMonth) {
          const firstDay = new Date(year, monthIndex, startDay);
          const lastDay = new Date(year, monthIndex, endDay);
          const { data: requestsData } = await supabase
            .from("requests")
            .select("item_no, quantity_requested, inventory(description)")
            .gte("created_at", firstDay.toISOString())
            .lte("created_at", lastDay.toISOString());
          if (requestsData && requestsData.length > 0) {
            historyData = requestsData.map((req: any) => ({
              item_no: req.item_no || "",
              description: req.inventory?.description || "",
              [`week${risWeekOption.replace("week", "")}`]:
                req.quantity_requested || 0,
            }));
          }
        }
      }

      if (!historyData || historyData.length === 0) {
        toast.error(`No data found for ${risMonthOption} (${prefix})`);
        setGenerating(null);
        return;
      }

      const itemNos = historyData.map((item) => item.item_no).filter(Boolean);
      const { data: inventoryDescData } = await supabase
        .from("inventory")
        .select("item_no, description")
        .in("item_no", itemNos);
      const descriptionMap: Record<string, string> = {};
      (inventoryDescData || []).forEach((inv) => {
        descriptionMap[inv.item_no] = inv.description || "";
      });

      const doc = new jsPDF("portrait");
      doc.setFont("times");
      const pageWidth = doc.internal.pageSize.width;

      doc
        .setFontSize(9)
        .text("Republic of the Philippines", pageWidth / 2, 15, {
          align: "center",
        });
      doc
        .setFont("times", "bold")
        .setFontSize(10)
        .text("PAMANTASAN NG LUNGSOD NG MAYNILA", pageWidth / 2, 20, {
          align: "center",
        });
      doc
        .setFont("times", "normal")
        .setFontSize(9)
        .text(
          "(University of the City of Manila)\nIntramuros, Manila",
          pageWidth / 2,
          24,
          { align: "center" },
        );
      doc
        .setFont("times", "bold")
        .text("GYMNASIUM MANAGEMENT SECTION", pageWidth / 2, 34, {
          align: "center",
        });
      doc
        .setFontSize(14)
        .text("REQUISITION AND ISSUE SLIP", pageWidth / 2, 42, {
          align: "center",
        });

      const weekLabel = risWeekOption.replace("week", "Week ");
      autoTable(doc, {
        body: [
          [
            "Division :",
            "Responsibility Center",
            `RIS No.: ${year}-${String(monthIndex + 1).padStart(2, "0")}-001`,
            monthName.toUpperCase(),
          ],
          [
            "Office : GSO",
            "Code",
            "SAI No.:",
            `${weekLabel} (${startDay}-${endDay})`,
          ],
        ],
        startY: 48,
        theme: "plain",
        styles: {
          fontSize: 9,
          font: "times",
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          fontStyle: "bold",
          cellPadding: 1.5,
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 50 },
          3: { cellWidth: 30, halign: "center", fontStyle: "normal" },
        },
      });

      const bodyData = historyData
        .sort((a, b) => (a.item_no || "").localeCompare(b.item_no || ""))
        .map((item) => {
          const weekKey = `week${risWeekOption.replace("week", "")}`;
          const quantity = item[weekKey] || 0;
          const description =
            descriptionMap[item.item_no] ||
            item.description ||
            item.item_description ||
            "";
          return [item.item_no || "", description, quantity, quantity, ""];
        })
        .filter(
          (row) => row[2] !== null && row[2] !== 0 && row[2] !== undefined,
        );

      while (bodyData.length < 15) bodyData.push(["", "", "", "", ""]);

      autoTable(doc, {
        head: [
          [
            {
              content: "Stock No.",
              rowSpan: 2,
              styles: { halign: "center", valign: "middle" },
            },
            {
              content: "Requisition",
              colSpan: 2,
              styles: { halign: "center" },
            },
            { content: "Issuance", colSpan: 2, styles: { halign: "center" } },
          ],
          [
            { content: "Description", styles: { halign: "center" } },
            { content: "Quantity", styles: { halign: "center" } },
            { content: "Quantity", styles: { halign: "center" } },
            { content: "Remarks", styles: { halign: "center" } },
          ],
        ],
        body: bodyData,
        startY: (doc as any).lastAutoTable.finalY,
        theme: "grid",
        styles: {
          fontSize: 8,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          cellPadding: 1.5,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 25, halign: "center" },
          1: { cellWidth: 80 },
          2: { halign: "center" },
          3: { halign: "center" },
        },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY,
        theme: "grid",
        styles: {
          fontSize: 8,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          cellPadding: 1.5,
          textColor: [0, 0, 0],
        },
        body: [
          ["", "Requested by:", "Approved by:", "Issued by:", "Received by:"],
          ["Signature:", "", "", "", ""],
          [
            "Printed Name:",
            "UTILITY WORKERS",
            "EMILY E. ESPERO",
            "GRACIANO MONTIADORA",
            "UTILITY WORKERS",
          ],
          ["Designation:", "GSO", "Chief, GSO", "STOREKEEPER", "GSO"],
          ["Date:", "", "", "", ""],
        ],
        columnStyles: { 0: { fontStyle: "italic", cellWidth: 25 } },
      });

      doc.save(
        `RIS_${risReportFacility}_${risMonthOption.replace(" ", "_")}_${risWeekOption}.pdf`,
      );
      toast.success("RIS Report Downloaded!");
    } catch (err) {
      toast.error("Failed to generate report.");
    } finally {
      setGenerating(null);
    }
  };

  // ── RIS DAILY PDF (unchanged) ──────────────────────────────────────────
  const generateRISDailyPDF = async () => {
    setGenerating("Daily");
    try {
      const prefix = risReportFacility === "JMS" ? "JMS" : "GYM-S";
      const selectedDate = new Date(risDayOption);
      if (Number.isNaN(selectedDate.getTime())) {
        toast.error("Select a valid date.");
        setGenerating(null);
        return;
      }

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: requestsData } = await supabase
        .from("requests")
        .select(
          "item_no, quantity_requested, requested_by, inventory(description, unit_id, units(name))",
        )
        .ilike("item_no", `${prefix}%`)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString());

      if (!requestsData || requestsData.length === 0) {
        toast.error(`No data found for ${risDayOption} (${prefix})`);
        setGenerating(null);
        return;
      }

      const aggregated: Record<
        string,
        {
          item_no: string;
          description: string;
          requested_by: string;
          quantity: number;
        }
      > = {};
      (requestsData || []).forEach((req: any) => {
        const key = `${req.item_no}::${req.requested_by || ""}`;
        if (!aggregated[key])
          aggregated[key] = {
            item_no: req.item_no || "",
            description: req.inventory?.description || "",
            requested_by: req.requested_by || "",
            quantity: 0,
          };
        aggregated[key].quantity += Number(req.quantity_requested) || 0;
        if (!aggregated[key].description && req.inventory?.description)
          aggregated[key].description = req.inventory.description;
      });

      const historyData = Object.values(aggregated).sort((a, b) =>
        a.item_no.localeCompare(b.item_no),
      );
      const doc = new jsPDF("portrait");
      doc.setFont("times");
      const pageWidth = doc.internal.pageSize.width;
      const monthName = fullMonths[selectedDate.getMonth()];
      const year = selectedDate.getFullYear();

      doc
        .setFontSize(9)
        .text("Republic of the Philippines", pageWidth / 2, 15, {
          align: "center",
        });
      doc
        .setFont("times", "bold")
        .setFontSize(10)
        .text("PAMANTASAN NG LUNGSOD NG MAYNILA", pageWidth / 2, 20, {
          align: "center",
        });
      doc
        .setFont("times", "normal")
        .setFontSize(9)
        .text(
          "(University of the City of Manila)\nIntramuros, Manila",
          pageWidth / 2,
          24,
          { align: "center" },
        );
      doc
        .setFont("times", "bold")
        .text("GYMNASIUM MANAGEMENT SECTION", pageWidth / 2, 34, {
          align: "center",
        });
      doc
        .setFontSize(14)
        .text("REQUISITION AND ISSUE SLIP", pageWidth / 2, 42, {
          align: "center",
        });

      autoTable(doc, {
        body: [
          [
            "Division :",
            "Responsibility Center",
            `RIS No.: ${year}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-001`,
            monthName.toUpperCase(),
          ],
          ["Office : GSO", "Code", "SAI No.:", `Date: ${risDayOption}`],
        ],
        startY: 48,
        theme: "plain",
        styles: {
          fontSize: 9,
          font: "times",
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          fontStyle: "bold",
          cellPadding: 1.5,
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 50 },
          3: { cellWidth: 30, halign: "center", fontStyle: "normal" },
        },
      });

      const bodyData = historyData
        .map((item) => [
          item.item_no || "",
          item.description || "",
          item.quantity,
          item.quantity,
          item.requested_by || "",
          "",
        ])
        .filter(
          (row) => row[2] !== null && row[2] !== 0 && row[2] !== undefined,
        );
      while (bodyData.length < 15) bodyData.push(["", "", "", "", "", ""]);

      autoTable(doc, {
        head: [
          [
            {
              content: "Stock No.",
              rowSpan: 2,
              styles: { halign: "center", valign: "middle" },
            },
            {
              content: "Requisition",
              colSpan: 2,
              styles: { halign: "center" },
            },
            { content: "Issuance", colSpan: 3, styles: { halign: "center" } },
          ],
          [
            { content: "Description", styles: { halign: "center" } },
            { content: "Qty", styles: { halign: "center" } },
            { content: "Qty", styles: { halign: "center" } },
            { content: "Name", styles: { halign: "center" } },
            { content: "Remarks", styles: { halign: "center" } },
          ],
        ],
        body: bodyData,
        startY: (doc as any).lastAutoTable.finalY,
        margin: { left: 14, right: 14 },
        tableWidth: 182,
        theme: "grid",
        styles: {
          fontSize: 8,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          cellPadding: 1.5,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },
          1: { cellWidth: 68 },
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 14, halign: "center" },
          4: { cellWidth: 28, halign: "center" },
          5: { cellWidth: 40, halign: "center" },
        },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY,
        theme: "grid",
        styles: {
          fontSize: 8,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          cellPadding: 1.5,
          textColor: [0, 0, 0],
        },
        body: [
          ["", "Requested by:", "Approved by:", "Issued by:", "Received by:"],
          ["Signature:", "", "", "", ""],
          [
            "Printed Name:",
            "UTILITY WORKERS",
            "EMILY E. ESPERO",
            "GRACIANO MONTIADORA",
            "UTILITY WORKERS",
          ],
          ["Designation:", "GSO", "Chief, GSO", "STOREKEEPER", "GSO"],
          ["Date:", "", "", "", ""],
        ],
        columnStyles: { 0: { fontStyle: "italic", cellWidth: 25 } },
      });

      doc.save(`RIS_${risReportFacility}_${risDayOption}.pdf`);
      toast.success("Daily RIS Report Downloaded!");
    } catch (err) {
      toast.error("Failed to generate report.");
    } finally {
      setGenerating(null);
    }
  };

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

  const consumableOpacity = trendFilter === "borrowable" ? 0.5 : 1;
  const borrowableOpacity = trendFilter === "consumable" ? 0.5 : 1;

  // ── Build extended trend chart with 3-month forecast appended ─────────
  const trendChartData = useMemo(() => {
    return monthlyTrendData;
  }, [monthlyTrendData]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="bg-[#4A89B0] p-2 rounded-lg">
              <PackageOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-bold text-gray-900 hidden sm:block">
              FacilityLink: Centralized Inventory System
            </h1>
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

      <aside
        className={`fixed top-16 left-0 bottom-0 bg-white shadow-lg transition-all duration-300 z-20 ${isSidebarExpanded || isSidebarPinned ? "w-64" : "w-20"}`}
        onMouseEnter={() => !isSidebarPinned && setIsSidebarExpanded(true)}
        onMouseLeave={() => {
          setIsSidebarExpanded(false);
          setIsSidebarPinned(false);
        }}
      >
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === "/admin/analytics";
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

      <main
        className={`pt-16 transition-all duration-300 ${isSidebarExpanded || isSidebarPinned ? "pl-64" : "pl-20"}`}
      >
        <div className="p-4 lg:p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Analytics & Reports
            </h1>
            <p className="text-gray-600 mt-1">
              Insights and trends from your inventory data
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-600 rounded-xl p-6 text-white shadow-md">
              <Package className="w-8 h-8 mb-2 opacity-80" />
              <div className="text-3xl font-bold">{totalRequestsWeek}</div>
              <div className="text-sm">Total Requests this week</div>
            </div>
            <div className="bg-orange-600 rounded-xl p-6 text-white shadow-md">
              <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
              <div className="text-3xl font-bold">{itemsNeedRestock}</div>
              <div className="text-sm">Items Out of Stock</div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Item Trend Analysis */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">
                Item Trend Analysis
              </h3>
              <p className="text-sm text-gray-600 mt-1 mb-4">
                Top requested items with trend analysis
              </p>
              {topRequestedItems.length > 0 ? (
                <>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
                    <div className="text-sm text-gray-500">
                      Showing {paginatedTrendItems.length} of{" "}
                      {topRequestedItems.length} items
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="text-sm text-gray-600">Search:</label>
                        <input
                          type="text"
                          placeholder="Search item"
                          value={trendSearch}
                          onChange={(e) => {
                            setTrendSearch(e.target.value);
                            setTrendPage(1);
                          }}
                          className="w-72 min-w-[260px] px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="text-sm text-gray-600">Show:</label>
                        <select
                          value={trendPageSize}
                          onChange={(e) => {
                            setTrendPageSize(
                              Number(e.target.value) as 5 | 10 | 20,
                            );
                            setTrendPage(1);
                          }}
                          className="px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 outline-none"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                        </select>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <button
                          type="button"
                          onClick={() =>
                            setTrendPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={trendPage === 1}
                          className="px-3 py-2 rounded-lg border bg-white disabled:opacity-50"
                        >
                          ←
                        </button>
                        <span>
                          Page {trendPage} of {trendTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setTrendPage((prev) =>
                              Math.min(trendTotalPages, prev + 1),
                            )
                          }
                          disabled={trendPage === trendTotalPages}
                          className="px-3 py-2 rounded-lg border bg-white disabled:opacity-50"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {paginatedTrendItems.map((item, index) => {
                      const statusColor = item.isNew
                        ? "blue"
                        : item.adviceType === "increase"
                          ? "orange"
                          : item.trend > 0
                            ? "green"
                            : "gray";
                      const statusBgColor = {
                        blue: "bg-blue-50 border-blue-200",
                        orange: "bg-orange-50 border-orange-200",
                        green: "bg-green-50 border-green-200",
                        gray: "bg-gray-50 border-gray-200",
                      }[statusColor];
                      const trendBadgeColor = {
                        blue: "bg-blue-100 text-blue-700",
                        orange: "bg-orange-100 text-orange-700",
                        green: "bg-green-100 text-green-700",
                        gray: "bg-gray-100 text-gray-700",
                      }[statusColor];

                      return (
                        <div
                          key={index}
                          className={`p-5 border rounded-lg transition-all hover:shadow-md ${statusBgColor}`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                {item.item_no}
                              </p>
                              <h4 className="font-bold text-gray-900 text-sm leading-tight truncate">
                                {item.name}
                              </h4>
                              <div className="text-xl font-bold text-[#4A89B0] mt-1">
                                {item.requests}
                                <span className="text-xs font-normal text-gray-600 ml-1">
                                  this month
                                </span>
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                Last month: {item.previousMonthRequests}
                              </div>
                            </div>
                            <div
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap flex-shrink-0 ${trendBadgeColor}`}
                            >
                              {item.trendLabel}
                            </div>
                          </div>
                          <div
                            className={`mt-4 p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                              item.adviceType === "new"
                                ? "bg-blue-100 text-blue-800"
                                : item.adviceType === "increase"
                                  ? "bg-orange-100 text-orange-800"
                                  : item.adviceType === "monitor"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            <span className="text-base flex-shrink-0 leading-none mt-0.5">
                              {item.adviceType === "increase"
                                ? "⚠️"
                                : item.adviceType === "new"
                                  ? "✨"
                                  : item.adviceType === "monitor"
                                    ? "👁️"
                                    : "✓"}
                            </span>
                            <span className="leading-snug">{item.advice}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="py-12 flex items-center justify-center text-gray-400">
                  No trend data available
                </div>
              )}
            </div>

            {/* Fast-Moving Items Chart — WITH FORECAST BAR */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Fast-Moving Items
                    {velocityCategory !== "all" &&
                      ` - ${velocityCategory.charAt(0).toUpperCase() + velocityCategory.slice(1)}s`}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Velocity comparison + next month forecast
                    <span className="ml-2 text-xs text-purple-600 border border-purple-200 bg-purple-50 px-2 py-0.5 rounded-full">
                      dashed = predicted
                    </span>
                  </p>
                </div>
                <select
                  value={velocityCategory}
                  onChange={(e) => {
                    setVelocityCategory(e.target.value as any);
                    setVelocityPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Items</option>
                  <option value="consumable">Consumables</option>
                  <option value="borrowable">Borrowables</option>
                </select>
              </div>
              {velocityChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={370}>
                    <ComposedChart
                      data={velocityChartData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="displayName" />
                      <YAxis />
                      <Tooltip
                        content={<ForecastTooltip />}
                        labelFormatter={(label) => {
                          const item = velocityChartData.find(
                            (d: any) => d.displayName === label,
                          );
                          return item ? item.name : label;
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="twoMonthsAgo"
                        fill="#cbd5e1"
                        name="2 Months Ago"
                      />
                      <Bar
                        dataKey="oneMonthAgo"
                        fill="#7dd3fc"
                        name="1 Month Ago"
                      />
                      <Bar
                        dataKey="currentMonth"
                        fill="#0369a1"
                        name="Current Month"
                      />
                      <Line
                        type="monotone"
                        dataKey="nextMonthForecast"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={{
                          r: 5,
                          fill: "#a855f7",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        name="Next Month (forecast)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Items Detail Table */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>Page</span>
                        <input
                          type="number"
                          min="1"
                          max={velocityTotalPages}
                          value={velocityPageInput}
                          onChange={(e) => setVelocityPageInput(e.target.value)}
                          onBlur={() => {
                            const p = Math.max(
                              1,
                              Math.min(
                                velocityTotalPages,
                                parseInt(velocityPageInput) || 1,
                              ),
                            );
                            setVelocityPage(p);
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const p = Math.max(
                                1,
                                Math.min(
                                  velocityTotalPages,
                                  parseInt(velocityPageInput) || 1,
                                ),
                              );
                              setVelocityPage(p);
                              e.currentTarget.blur();
                            }
                          }}
                          disabled={velocityLoading}
                          className="w-12 px-2 py-1 border border-gray-300 rounded-lg text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span>of {velocityTotalPages}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setVelocityPage(Math.max(1, velocityPage - 1))
                          }
                          disabled={velocityPage === 1 || velocityLoading}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() =>
                            setVelocityPage(
                              Math.min(velocityTotalPages, velocityPage + 1),
                            )
                          }
                          disabled={
                            velocityPage === velocityTotalPages ||
                            velocityLoading
                          }
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setIsVelocityTableCollapsed(!isVelocityTableCollapsed)
                      }
                      className="flex items-center gap-2 px-4 py-2 mb-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <span className="font-semibold text-gray-700">
                        {isVelocityTableCollapsed ? "▶" : "▼"} Details Table
                      </span>
                    </button>
                    {!isVelocityTableCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700">
                                #
                              </th>
                              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">
                                Item No
                              </th>
                              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">
                                Item Name
                              </th>
                              <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700">
                                2 Months Ago
                              </th>
                              <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700">
                                1 Month Ago
                              </th>
                              <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700">
                                Current Month
                              </th>
                              <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-purple-600">
                                Next Month (forecast)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {velocityChartData.map((item: any) => (
                              <tr
                                key={item.index}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-600">
                                  {item.index}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-left text-gray-700">
                                  {item.item_no}
                                </td>
                                <td
                                  className="border border-gray-300 px-3 py-2 text-gray-700"
                                  title={item.name}
                                >
                                  {item.name}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center text-gray-500">
                                  {item.twoMonthsAgo}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">
                                  {item.oneMonthAgo}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-semibold text-blue-700">
                                  {item.currentMonth}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-semibold text-purple-600">
                                  {item.nextMonthForecast}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-gray-400">
                  No velocity data available
                </div>
              )}
            </div>

            {/* Department Activity — WITH FORECAST */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-start mb-6 gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    Department Activity
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Requests Per Department
                    <span className="ml-2 text-xs text-slate-600 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-full">
                      {getDepartmentMonthLabel()}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end items-center">
                  {(["all", "colleges", "offices"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setDepartmentFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        departmentFilter === filter
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {filter === "all"
                        ? "All"
                        : filter === "colleges"
                          ? "Colleges"
                          : "Offices"}
                    </button>
                  ))}
                </div>
              </div>
              {deptData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(450, deptData.length * 42)}
                >
                  <BarChart
                    data={deptData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => Number(value).toFixed(0)}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="dept"
                      type="category"
                      width={200}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<ForecastTooltip />} />
                    <Legend />
                    <Bar dataKey="requests" fill="#8b5cf6" name="This Month" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* 13-Month Trend Analysis — WITH FORECAST EXTENSION */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {/* 13-Month Trend Analysis */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  13-Month Trend Analysis
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Actual history of items distributed over time
                </p>
              </div>
              <div className="flex gap-2">
                {(["all", "consumable", "borrowable"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTrendFilter(f)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      trendFilter === f
                        ? f === "all"
                          ? "bg-blue-500 text-white"
                          : f === "consumable"
                            ? "bg-green-500 text-white"
                            : "bg-purple-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {f === "all"
                      ? "All Items"
                      : f === "consumable"
                        ? "JMS Items"
                        : "GYM Items"}
                  </button>
                ))}
              </div>
            </div>
            {!trendLoaded ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-gray-600 gap-4">
                <p className="text-sm text-gray-500 text-center max-w-xl">
                  Click here to view the 13-Month Trend. This will load the trend
                  data only when you need it, reducing Supabase memory usage.
                </p>
                <button
                  onClick={loadMonthlyTrend}
                  disabled={trendLoading}
                  className="px-5 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {trendLoading
                    ? "Loading 13-month trend..."
                    : "Click here to view the 13-Month Trend"}
                </button>
              </div>
            ) : trendChartData.length > 0 ? (
              <div style={{ width: "100%", position: "relative" }}>
                <svg width="0" height="0" style={{ position: "absolute" }}>
                  <defs>
                    <linearGradient
                      id="consumablesGradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop
                        offset="100%"
                        stopColor="#10b981"
                        stopOpacity="0.01"
                      />
                    </linearGradient>
                    <linearGradient
                      id="borrowablesGradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                      <stop
                        offset="100%"
                        stopColor="#a855f7"
                        stopOpacity="0.01"
                      />
                    </linearGradient>
                  </defs>
                </svg>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis>
                      <Label
                        value="Number of Items"
                        angle={-90}
                        position="insideLeft"
                        style={{ textAnchor: "middle" }}
                      />
                    </YAxis>
                    <Tooltip content={<ForecastTooltip />} />
                    <Legend />
                    {(trendFilter === "all" ||
                      trendFilter === "consumable") && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="consumables"
                          stroke="#10b981"
                          fill="url(#consumablesGradient)"
                          strokeWidth={2}
                          name="JMS Items"
                          opacity={consumableOpacity}
                          isAnimationActive
                          animationDuration={500}
                          dot={false}
                        />
                      </>
                    )}
                    {(trendFilter === "all" ||
                      trendFilter === "borrowable") && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="borrowables"
                          stroke="#a855f7"
                          fill="url(#borrowablesGradient)"
                          strokeWidth={2}
                          name="GYM Items"
                          opacity={borrowableOpacity}
                          isAnimationActive
                          animationDuration={500}
                          dot={false}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>

          {/* Report Generation */}
          <div className="bg-gradient-to-br from-[#5891B8] to-[#3776A0] rounded-xl shadow-lg p-8 text-white">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Download className="w-6 h-6" /> Generate Reports
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* RIS Report */}
              <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-6 flex flex-col h-full shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold text-xl text-white">
                    RIS Report Options
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">
                      Facility Equipment
                    </label>
                    <select
                      value={risReportFacility}
                      onChange={(e) =>
                        setRisReportFacility(e.target.value as "JMS" | "GYM")
                      }
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm outline-none"
                    >
                      <option value="JMS">JMS Equipments</option>
                      <option value="GYM">GYM Equipments</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">
                      Month Target
                    </label>
                    <select
                      value={risMonthOption}
                      onChange={(e) => setRisMonthOption(e.target.value)}
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm outline-none"
                    >
                      {availableMonths.length > 0 ? (
                        availableMonths.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))
                      ) : (
                        <option>No data available</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">
                      Week
                    </label>
                    <select
                      value={risWeekOption}
                      onChange={(e) => setRisWeekOption(e.target.value)}
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm outline-none"
                    >
                      <option value="week1">Week 1 (1-8)</option>
                      <option value="week2">Week 2 (9-15)</option>
                      <option value="week3">Week 3 (16-22)</option>
                      <option value="week4">Week 4 (23+)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">
                      Daily Date
                    </label>
                    <input
                      type="date"
                      value={risDayOption}
                      onChange={(e) => setRisDayOption(e.target.value)}
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={generateRISDailyPDF}
                  disabled={generating !== null}
                  className="w-full flex items-center justify-center gap-2 bg-white text-[#3776A0] py-2.5 rounded font-bold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {generating === "Daily"
                    ? "Generating..."
                    : "Download Daily RIS"}
                </button>
                <button
                  onClick={generateRISWeeklyPDF}
                  disabled={generating !== null}
                  className="w-full flex items-center justify-center gap-2 bg-white text-[#3776A0] py-2.5 rounded font-bold hover:bg-gray-50 transition-colors mt-3 shadow-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {generating === "Weekly"
                    ? "Generating..."
                    : "Download Weekly RIS"}
                </button>
                <button
                  onClick={printProcurementSummary}
                  disabled={generating !== null}
                  className="w-full flex items-center justify-center gap-2 bg-white text-[#3776A0] py-2.5 rounded font-bold hover:bg-gray-50 transition-colors mt-3 shadow-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {generating === "Procurement"
                    ? "Generating..."
                    : "Print Procurement Summary"}
                </button>
              </div>

              {/* SSMI Report */}
              <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-6 flex flex-col h-full shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold text-xl text-white">
                    SSMI & Monthly Snapshots
                  </div>
                </div>
                <div className="mb-6 p-4 bg-white/10 rounded-lg border border-white/20">
                  <h3 className="text-sm font-semibold mb-1 text-white">
                    1. Lock Opening Balance
                  </h3>
                  <p className="text-xs text-white/80 mb-3">
                    Run this on the 1st of every month to freeze the starting
                    stock for your reports.
                  </p>
                  <button
                    onClick={() => setShowSnapshotModal(true)}
                    disabled={snapshotLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#F59E0B] text-white py-2 rounded font-bold hover:bg-[#D97706] transition-colors shadow-sm disabled:opacity-50"
                  >
                    {snapshotLoading
                      ? "Locking Baseline..."
                      : "Capture Monthly Snapshot"}
                  </button>
                </div>
                <div className="pt-4 border-t border-white/20">
                  <h3 className="text-sm font-semibold mb-3 text-white">
                    2. Generate Report
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1.5">
                        Facility Equipment
                      </label>
                      <select
                        value={reportFacility}
                        onChange={(e) =>
                          setReportFacility(e.target.value as "JMS" | "GYM")
                        }
                        className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm outline-none"
                      >
                        <option value="JMS">JMS Equipments</option>
                        <option value="GYM">GYM Equipments</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1.5">
                        Month Target
                      </label>
                      <select
                        value={ssmiMonthOption}
                        onChange={(e) => setSsmiMonthOption(e.target.value)}
                        className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm outline-none"
                      >
                        {availableMonths.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={generateSSMIPDF}
                    disabled={generating !== null}
                    className="w-full flex items-center justify-center gap-2 bg-white text-[#3776A0] py-2.5 rounded font-bold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {generating === "SSMI" ? "Generating..." : "Download PDF"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Snapshot Confirmation Modal */}
        {showSnapshotModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-full">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Confirm Snapshot Overwrite
                </h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  You are about to capture your current live inventory as the
                  starting baseline for this month's reports.
                </p>
                <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                  <strong>Warning:</strong> If you have already captured a
                  snapshot this month, continuing will overwrite your opening
                  balance and RESET all weekly issuance data for the current
                  month back to zero.
                </p>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end bg-gray-50">
                <button
                  onClick={() => setShowSnapshotModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSnapshotModal(false);
                    handleCaptureSnapshot();
                  }}
                  className="px-4 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#D97706] transition-colors font-medium shadow-sm"
                >
                  Confirm & Overwrite
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
