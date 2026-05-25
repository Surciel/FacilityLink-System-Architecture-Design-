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
  buildForecast,
  computeInventoryStats,
  buildProcurementRows,
} from "../../lib/forecastUtils";
import {
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Package,
  AlertCircle,
  LayoutDashboard,
  Inbox,
  BarChart3,
  LogOut,
  PackageOpen,
  Activity,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { supabase } from "../../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InventoryItem {
  item_no: string;
  description: string;
  unit_id: string;
  units?: { name: string };
  remaining_stock: number;
  critical_stock?: number;
  stock_threshold?: number;
  unit_cost?: number;
}

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

// ── Custom tooltip for forecast charts ──────────────────────────────────────
const ForecastTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium text-gray-900">{p.value}</span>
          {p.payload?.isForecast && (
            <span className="text-purple-500 italic">(forecast)</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ── DSS Forecast Chart ───────────────────────────────────────────────────────
const DSS_ForecastChart = ({
  monthlyTrendData,
  consumForecast,
  borrowForecast,
}: {
  monthlyTrendData: any[];
  consumForecast: any;
  borrowForecast: any;
}) => {
  const shortMonths = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  const now = new Date();

  // Build 3-month forecast labels (future months only)
  const forecastMonths = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    return shortMonths[d.getMonth()] + " (pred)";
  });

  // Take last 6 historical months as actuals
  const historicalSlice = monthlyTrendData.slice(-6).map((d) => ({
    month: d.month,          // keeps original label e.g. "May (Current)"
    consumables: d.consumables,
    borrowables: d.borrowables,
    consumablesForecast: null,
    borrowablesForecast: null,
    isForecast: false,
  }));

  // The last actual point — used as the bridge INTO forecast lines
  const lastActual = historicalSlice[historicalSlice.length - 1];

  // Forecast extension points (pure future, no actual values)
  const forecastPoints = forecastMonths.map((m, i) => ({
    month: m,
    consumables: null,
    borrowables: null,
    consumablesForecast: consumForecast?.bestPredicted?.[i] ?? null,
    borrowablesForecast: borrowForecast?.bestPredicted?.[i] ?? null,
    isForecast: true,
  }));

  // Bridge: keep the last historical label but also carry forecast values
  // so the dashed lines start FROM the last real data point visually.
  const bridgePoint = {
    ...lastActual,
    consumablesForecast: consumForecast?.bestPredicted?.[0] ?? null,
    borrowablesForecast: borrowForecast?.bestPredicted?.[0] ?? null,
  };

  // Replace the last item in historicalSlice with the bridge version,
  // then append pure forecast points (skip index 0 since bridge covers it).
  const combined = [
    ...historicalSlice.slice(0, -1),
    bridgePoint,
    ...forecastPoints,
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart
        data={combined}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip content={<ForecastTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* Reference line sits between last actual and first forecast month */}
        <ReferenceLine
          x={forecastMonths[0]}
          stroke="#a855f7"
          strokeDasharray="4 4"
          label={{
            value: "Forecast →",
            position: "top",
            fontSize: 10,
            fill: "#a855f7",
          }}
        />
        <Area
          type="monotone"
          dataKey="consumables"
          stroke="#10b981"
          fill="url(#consumGrad)"
          strokeWidth={2}
          name="Consumables (actual)"
          dot={false}
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="borrowables"
          stroke="#a855f7"
          fill="url(#borrowGrad)"
          strokeWidth={2}
          name="Borrowables (actual)"
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="consumablesForecast"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 4, fill: "#10b981" }}
          name="Consumables (forecast)"
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="borrowablesForecast"
          stroke="#a855f7"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 4, fill: "#a855f7" }}
          name="Borrowables (forecast)"
          connectNulls={false}
        />
        <defs>
          <linearGradient id="consumGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="borrowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.01} />
          </linearGradient>
        </defs>
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// ── DSS Burn Rate Bar Chart ──────────────────────────────────────────────────
const DSS_BurnRateChart = ({ procurementRows }: { procurementRows: any[] }) => {
  const top8 = procurementRows.slice(0, 8).map((r) => ({
    name:
      r.description.length > 18
        ? r.description.slice(0, 18) + "…"
        : r.description,
    burnRate: r.weeklyBurnRate,
    stock: r.currentStock,
    status: r.status,
  }));

  const getBarColor = (status: string) => {
    if (status === "order") return "#ef4444";
    if (status === "watch") return "#f59e0b";
    return "#10b981";
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={top8}
        layout="vertical"
        margin={{ top: 0, right: 30, left: 80, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: 10 }}
          width={80}
        />
        <Tooltip
          formatter={(v: any, name: string) => [
            v,
            name === "burnRate" ? "Burn/wk" : "Stock",
          ]}
          labelFormatter={(l) => l}
        />
        <Bar
          dataKey="burnRate"
          name="Burn rate (units/wk)"
          radius={[0, 4, 4, 0]}
        >
          {top8.map((entry, i) => (
            <Cell key={i} fill={getBarColor(entry.status)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── DSS Stockout Risk Scatter ────────────────────────────────────────────────
const DSS_StockoutRiskChart = ({
  procurementRows,
}: {
  procurementRows: any[];
}) => {
  const data = procurementRows.slice(0, 12).map((r) => ({
    name:
      r.description.length > 16
        ? r.description.slice(0, 16) + "…"
        : r.description,
    x: r.weeklyBurnRate,
    y: r.currentStock,
    weeks: parseFloat(r.weeksLeft) || 0,
    status: r.status,
  }));

  const getColor = (status: string) => {
    if (status === "order") return "#ef4444";
    if (status === "watch") return "#f59e0b";
    return "#10b981";
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="x"
          type="number"
          name="Burn rate"
          label={{
            value: "Weekly burn rate →",
            position: "bottom",
            fontSize: 10,
            fill: "#9ca3af",
          }}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name="Stock"
          label={{
            value: "Current stock",
            angle: -90,
            position: "insideLeft",
            fontSize: 10,
            fill: "#9ca3af",
          }}
          tick={{ fontSize: 10 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs">
                <p className="font-semibold">{d?.name}</p>
                <p>Burn: {d?.x} units/wk</p>
                <p>Stock: {d?.y} units</p>
                <p
                  className={`font-bold ${d?.status === "order" ? "text-red-600" : d?.status === "watch" ? "text-yellow-600" : "text-green-600"}`}
                >
                  {d?.weeks} weeks left
                </p>
              </div>
            );
          }}
        />
        {data.map((d, i) => (
          <Scatter
            key={i}
            data={[d]}
            fill={getColor(d.status)}
            opacity={0.85}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
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
  const [trendFilter, setTrendFilter] = useState<
    "all" | "consumable" | "borrowable"
  >("all");
  const [showTrendAnalysis, setShowTrendAnalysis] = useState(false);
  const [topRequestedItems, setTopRequestedItems] = useState<any[]>([]);
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

  const [consumForecast, setConsumForecast] = useState<any>(null);
  const [borrowForecast, setBorrowForecast] = useState<any>(null);
  const [inventoryStats, setInventoryStats] = useState<any>(null);
  const [groqInsight, setGroqInsight] = useState("");
  const [groqLoading, setGroqLoading] = useState(false);

  // DSS chart tab state
  const [dssChartTab, setDssChartTab] = useState<
    "forecast" | "burnrate" | "risk"
  >("forecast");
  const [dssChartsExpanded, setDssChartsExpanded] = useState(true);
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
      lower.includes("division")
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
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const procurementRows = useMemo(
    () => buildProcurementRows(consumableBurnRate),
    [consumableBurnRate],
  );

  // ── Velocity chart data with forecast appended ───────────────────────────
  const velocityChartData = useMemo(() => {
    if (!velocityData.length) return [];
    return velocityData.map((item) => {
      // Simple linear forecast: extrapolate from last 2 data points.
      // When the current month is zero, fall back to the most recent non-zero month
      // so we do not drop the predicted value to 0 too aggressively.
      const twoMoAgo = item.twoMonthsAgo ?? 0;
      const oneMoAgo = item.oneMonthAgo ?? 0;
      const curr = item.currentMonth ?? 0;
      const delta1 = oneMoAgo - twoMoAgo;
      const delta2 = curr - oneMoAgo;
      const avgDelta = (delta1 + delta2) / 2;
      const lastNonZero = curr > 0 ? curr : oneMoAgo > 0 ? oneMoAgo : twoMoAgo;
      const nextMonthForecast = Math.max(0, Math.round(lastNonZero + avgDelta));
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

  // ── Department activity with simple forecast + filtering ───────────────────
  const deptWithForecast = useMemo(() => {
    if (!departmentActivity.length) return [];

    // Filter departments based on selected category
    let filtered = departmentActivity;
    if (departmentFilter !== "all") {
      filtered = departmentActivity.filter((d) => {
        const category = categorizeDepartment(d.dept);
        return departmentFilter === "colleges"
          ? category === "college"
          : category === "office";
      });
    }

    const total = filtered.reduce((s, d) => s + d.requests, 0);
    return filtered.map((d) => ({
      ...d,
      // Simple forecast: assume 5-15% growth based on share
      predicted: Math.round(d.requests * (1 + (Math.random() * 0.1 + 0.05))),
    }));
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
    if (showTrendAnalysis && monthlyTrendData.length === 0) {
      fetchMonthlyTrend();
    }
  }, [showTrendAnalysis]);

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
        fetchDepartmentActivity(),
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
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();
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
    const trendByMonth: Record<
      string,
      { consumables: number; borrowables: number; isCurrent: boolean }
    > = {};

    for (let i = 0; i < 13; i++) {
      const date = new Date(currentYear, currentMonthIndex, 1);
      date.setMonth(date.getMonth() - i);
      const monthIndex = date.getMonth();
      const year = date.getFullYear();
      const monthShort = shortMonths[monthIndex];
      const firstDay = new Date(year, monthIndex, 1);
      const lastDay = new Date(year, monthIndex + 1, 0);
      const isCurrent = i === 0;
      const displayKey = `${monthShort}${isCurrent ? " (Current)" : ""}`;

      const { data: monthRequests } = await supabase
        .from("requests")
        .select("item_no, quantity_requested, inventory(item_type)")
        .gte("created_at", firstDay.toISOString())
        .lte("created_at", lastDay.toISOString());

      let consumableCount = 0;
      let borrowableCount = 0;

      (monthRequests || []).forEach((req) => {
        const quantity = Number(req.quantity_requested) || 0;
        const reqAny = req as any;
        const itemType = Array.isArray(reqAny.inventory)
          ? reqAny.inventory[0]?.item_type
          : reqAny.inventory?.item_type;
        if (itemType === "consumable") consumableCount += quantity;
        else if (itemType === "borrowable") borrowableCount += quantity;
        else consumableCount += quantity;
      });

      trendByMonth[displayKey] = {
        consumables: consumableCount,
        borrowables: borrowableCount,
        isCurrent,
      };
    }

    const trendData = Object.entries(trendByMonth)
      .reverse()
      .map(([month, data]) => ({
        month,
        consumables: data.consumables,
        borrowables: data.borrowables,
        isCurrent: data.isCurrent,
      }));

    setMonthlyTrendData(trendData);

    const consumSeries = trendData.map((d: any) => d.consumables);
    const borrowSeries = trendData.map((d: any) => d.borrowables);
    setConsumForecast(buildForecast(consumSeries, 3));
    setBorrowForecast(buildForecast(borrowSeries, 3));
  };

  const fetchTopRequestedItems = async () => {
    const { data, error } = await supabase
      .from("requests")
      .select(
        "item_no, quantity_requested, created_at, inventory(description, unit_id, units(name))",
      );
    if (error) {
      toast.error("Failed to load request analytics data.");
      return;
    }

    const now = new Date();
    const thisMonth = now.getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const thisMonthCounts: Record<string, number> = {};
    const lastMonthCounts: Record<string, number> = {};

    (data || []).forEach((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const quantity = Number(row.quantity_requested) || 0;
      if (quantity === 0) return;
      const month = createdAt.getMonth();
      const rowAny = row as any;
      const inventoryDescription = Array.isArray(rowAny.inventory)
        ? rowAny.inventory[0]?.description
        : rowAny.inventory?.description;
      const name = inventoryDescription || rowAny.item_no || "Unknown Item";
      if (month === thisMonth)
        thisMonthCounts[name] = (thisMonthCounts[name] || 0) + quantity;
      if (month === lastMonth)
        lastMonthCounts[name] = (lastMonthCounts[name] || 0) + quantity;
    });

    const positiveThisMonthCounts = Object.fromEntries(
      Object.entries(thisMonthCounts).filter(([, count]) => count > 0),
    );

    setTopRequestedItems(
      Object.entries(positiveThisMonthCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, requests]) => {
          const lastMonthValue = lastMonthCounts[name] || 0;
          const trendValue =
            lastMonthValue > 0
              ? Math.round(((requests - lastMonthValue) / lastMonthValue) * 100)
              : 0;
          const isNew = lastMonthValue === 0;
          const isHighVolume = requests >= 10;
          return {
            name,
            requests,
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
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  };

  const fetchDepartmentActivity = async () => {
    const { data } = await supabase.from("requests").select("department");
    const grouped: Record<string, number> = {};
    (data || []).forEach((row) => {
      if (row.department)
        grouped[row.department] = (grouped[row.department] || 0) + 1;
    });
    setDepartmentActivity(
      Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .map(([dept, requests]) => ({ dept, requests })),
    );
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

  const fetchAvailableMonths = async () => {
    const { data } = await supabase
      .from("inventory_history")
      .select("period_label")
      .not("period_label", "is", null);

    const uniqueMonths = Array.from(
      new Set((data || []).map((row) => row.period_label)),
    ).sort((a, b) => {
      const partsA = a.split(" ");
      const partsB = b.split(" ");
      const yearDiff =
        parseInt(partsB[partsB.length - 1]) -
        parseInt(partsA[partsA.length - 1]);
      if (yearDiff !== 0) return yearDiff;
      return monthNameToIndex[partsB[0]] - monthNameToIndex[partsA[0]];
    });

    if (!uniqueMonths.includes(defaultMonthOption))
      uniqueMonths.unshift(defaultMonthOption);
    setAvailableMonths(uniqueMonths);
    if (uniqueMonths.length > 0) {
      if (!uniqueMonths.includes(risMonthOption))
        setRisMonthOption(uniqueMonths[0]);
      if (!uniqueMonths.includes(ssmiMonthOption))
        setSsmiMonthOption(uniqueMonths[0]);
    }
  };

  const fetchCategorizedAssetAnalytics = async () => {
  try {
    const { data: inventoryData } = await supabase
      .from("inventory")
      .select("item_no, description, remaining_stock, item_type");
 
    // Step 1: get last 3 period labels
    const { data: recentLabels } = await supabase
      .from("inventory_history")
      .select("period_label")
      .order("snapshot_date", { ascending: false })
      .limit(3);
 
    const labels = [
      ...new Set(recentLabels?.map((r) => r.period_label) || []),
    ];
 
    // Step 2: fetch history if available
    const { data: historyData } = labels.length > 0
      ? await supabase
          .from("inventory_history")
          .select("item_no, total_qty_issued, item_type, week1, week2, week3, week4")
          .in("period_label", labels)
      : { data: [] };
 
    // Step 3: current month requests as fallback
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
 
    const { data: currentRequests } = await supabase
      .from("requests")
      .select("item_no, quantity_requested")
      .gte("created_at", monthStart.toISOString())
      .lte("created_at", monthEnd.toISOString());
 
    const currentMonthByItem: Record<string, number> = {};
    (currentRequests || []).forEach((req) => {
      currentMonthByItem[req.item_no] =
        (currentMonthByItem[req.item_no] || 0) +
        (Number(req.quantity_requested) || 0);
    });
 
    const burnRateMap: Record<string, any> = {};
    const utilizationMap: Record<string, any> = {};
 
    (inventoryData || []).forEach((item) => {
      const itemType = item.item_type || "consumable";
 
      if (itemType === "consumable") {
        const itemHistory = (historyData || []).filter(
          (h) => h.item_no === item.item_no,
        );
        const monthsWithData = itemHistory.filter(
          (h) => (h.total_qty_issued || 0) > 0,
        );
 
        let avgMonthlyUsage = 0;
 
        if (monthsWithData.length > 0) {
          avgMonthlyUsage =
            monthsWithData.reduce(
              (sum, h) => sum + (h.total_qty_issued || 0),
              0,
            ) / monthsWithData.length;
        } else if (currentMonthByItem[item.item_no]) {
          avgMonthlyUsage = currentMonthByItem[item.item_no];
        }
 
        const weeklyBurnRate = parseFloat((avgMonthlyUsage / 4.33).toFixed(2));
 
        // KEY FIX: weeks until stockout
        // - 0 stock → 0 weeks (order immediately), regardless of burn rate
        // - has stock + burn rate → normal calculation
        // - has stock, no burn data → Infinity (unknown, not critical)
        const weeksUntilStockout =
          item.remaining_stock <= 0
            ? 0
            : weeklyBurnRate > 0
            ? Math.ceil(item.remaining_stock / weeklyBurnRate)
            : Infinity;
 
        burnRateMap[item.item_no] = {
          description: item.description,
          monthlyUsage: parseFloat(avgMonthlyUsage.toFixed(1)),
          weeklyBurnRate,
          currentStock: item.remaining_stock,
          weeksUntilStockout,
          recommendation:
            item.remaining_stock <= 0
              ? "Out of stock — reorder immediately"
              : weeklyBurnRate > 0
              ? `Reorder in ${Math.ceil(item.remaining_stock / weeklyBurnRate)} weeks`
              : "No usage data — monitor",
        };
      } else {
        // Borrowable
        const itemHistory = (historyData || []).filter(
          (h) => h.item_no === item.item_no,
        );
 
        let avgMonthlyRequests = 0;
 
        if (itemHistory.length > 0) {
          avgMonthlyRequests =
            itemHistory.reduce(
              (sum, h) =>
                sum +
                ((h.week1 || 0) + (h.week2 || 0) + (h.week3 || 0) + (h.week4 || 0)),
              0,
            ) / itemHistory.length;
        } else if (currentMonthByItem[item.item_no]) {
          avgMonthlyRequests = currentMonthByItem[item.item_no];
        }
 
        const utilizationPercentage = parseFloat(
          ((avgMonthlyRequests / 30) * 100).toFixed(1),
        );
 
        utilizationMap[item.item_no] = {
          description: item.description,
          totalRequests: parseFloat(avgMonthlyRequests.toFixed(1)),
          utilizationPercentage,
          currentStock: item.remaining_stock,
          recommendation:
            utilizationPercentage < 5
              ? "Low utilization - consider not restocking"
              : utilizationPercentage > 20
              ? "High utilization - monitor availability"
              : "Healthy utilization rate",
        };
      }
    });
 
    // ── FIXED SORTING: zero-stock items always included ───────────────────────
    const allBurnRates = Object.values(burnRateMap) as any[];
 
    // Filter to only items that have been requested (have usage history or current month requests)
    const requestedItems = allBurnRates.filter(
  (i) => i.currentStock <= 0 || i.weeklyBurnRate > 0 || i.monthlyUsage > 0
);
    
    // Sort: out-of-stock items first, then by weekly burn rate (highest first)
    const sortedByPriority = requestedItems.sort((a, b) => {
  if (a.currentStock <= 0 && b.currentStock > 0) return -1;
  if (a.currentStock > 0 && b.currentStock <= 0) return 1;
  return b.weeklyBurnRate - a.weeklyBurnRate;
});
    setAllRequestedItems(sortedByPriority);
setProcurementTotalPages(Math.ceil(sortedByPriority.length / 10));
setProcurementPage(1);

// Set first page immediately
setConsumableBurnRate(sortedByPriority.slice(0, 10));
    
    // Get current page data
    const start = 0;
    const end = 10;
    const currentPageData = sortedByPriority.slice(start, end);
    setConsumableBurnRate(currentPageData);
 
    // Borrowable utilization — top 5 by utilization rate (unchanged)
    setBorrowableUtilization(
      Object.values(utilizationMap)
        .sort((a: any, b: any) => b.utilizationPercentage - a.utilizationPercentage)
        .slice(0, 5),
    );
 
    // Stats for DSS cards
    const burnRateValues = allBurnRates.map((i: any) => i.weeklyBurnRate);
    const stockValues = allBurnRates.map((i: any) => i.currentStock);
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
  const printProcurementSummary = () => {
  setGenerating("Procurement");
  try {
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const now = new Date();
    const monthName = fullMonths[now.getMonth()];
    const year = now.getFullYear();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
 
    // ── HEADER BAND ───────────────────────────────────────────────────
    doc.setFillColor(74, 137, 176);
    doc.rect(0, 0, pageWidth, 32, "F");
 
    doc.setFillColor(47, 100, 136);
    doc.rect(0, 29, pageWidth, 3, "F");
 
    doc.setFont("times", "bold");
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text("PROCUREMENT DECISION SUMMARY", pageWidth / 2, 11, { align: "center" });
 
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(210, 235, 255);
    doc.text(
      "Pamantasan ng Lungsod ng Maynila  ·  General Services Office",
      pageWidth / 2, 18, { align: "center" }
    );
    doc.text(`Reporting Period: ${monthName} ${year}`, pageWidth / 2, 25, { align: "center" });
 
    doc.setFontSize(7.5);
    doc.setTextColor(180, 215, 245);
    doc.text(
      `Ref. No. GSO-${year}-${String(now.getMonth() + 1).padStart(2, "0")}-PROC`,
      margin, 27
    );
    doc.text(
      `Generated: ${now.toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })}`,
      pageWidth - margin, 27, { align: "right" }
    );
 
    // ── KPI CARDS ─────────────────────────────────────────────────────
    const orderNow  = procurementRows.filter((r) => r.status === "order").length;
    const watchCount = procurementRows.filter((r) => r.status === "watch").length;
    const okCount   = procurementRows.filter((r) => r.status === "ok").length;
    const totalItems = procurementRows.length;
 
    const kpiY = 36;
    const kpiH = 26;
    const kpiW = (contentWidth - 12) / 4;
 
    const kpis: {
      label: string;
      value: string;
      sub: string;
      color: [number, number, number];
      bg: [number, number, number];
    }[] = [
      {
        label: "Order Now",
        value: String(orderNow),
        sub: "Require immediate reorder",
        color: [220, 53, 53],
        bg: [255, 245, 245],
      },
      {
        label: "Watch Items",
        value: String(watchCount),
        sub: "Monitor stock closely",
        color: [217, 119, 6],
        bg: [255, 252, 240],
      },
      {
        label: "OK Items",
        value: String(okCount),
        sub: "Sufficient stock on hand",
        color: [22, 163, 74],
        bg: [240, 255, 244],
      },
      {
        label: "Total Items Tracked",
        value: String(totalItems),
        sub: "In procurement scope",
        color: [74, 137, 176],
        bg: [240, 248, 255],
      },
    ];
 
    kpis.forEach((kpi, i) => {
      const x = margin + i * (kpiW + 3.2);
      doc.setFillColor(...kpi.bg);
      doc.setDrawColor(...kpi.color);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, "FD");
      doc.setFillColor(...kpi.color);
      doc.rect(x, kpiY, kpiW, 3, "F");
      doc.roundedRect(x, kpiY, kpiW, 3, 2, 2, "F");
 
      doc.setFont("times", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(kpi.label, x + kpiW / 2, kpiY + 9.5, { align: "center" });
 
      doc.setFont("times", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...kpi.color);
      doc.text(kpi.value, x + kpiW / 2, kpiY + 19, { align: "center" });
 
      doc.setFont("times", "italic");
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text(kpi.sub, x + kpiW / 2, kpiY + 23.5, { align: "center" });
    });
 
    // ── FORECAST STRIP ─────────────────────────────────────────────────
    const stripY = kpiY + kpiH + 5;
    doc.setFillColor(248, 250, 253);
    doc.setDrawColor(210, 220, 230);
    doc.setLineWidth(0.25);
    doc.rect(margin, stripY, contentWidth, 15, "FD");
 
    doc.setFillColor(232, 242, 250);
    doc.rect(margin, stripY, contentWidth, 5.5, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(8);
    doc.setTextColor(74, 137, 176);
    doc.text("DEMAND FORECAST SUMMARY", margin + 4, stripY + 4);
 
    const forecastItems = [
      { label: "Consumables (next mo.)",      value: `${consumForecast?.bestPredicted?.[0] ?? "--"} units` },
      { label: "Trend direction",              value: consumForecast?.trend ?? "--" },
      { label: "Forecast reliability (R\u00B2)", value: consumForecast?.linear?.rSquared?.toFixed(2) ?? "--" },
      { label: "Monthly slope",               value: `${consumForecast?.linear?.slope?.toFixed(2) ?? "--"}/mo` },
      { label: "Borrowables (next mo.)",       value: `${borrowForecast?.bestPredicted?.[0] ?? "--"} units` },
    ];
 
    const fItemW = contentWidth / forecastItems.length;
    forecastItems.forEach((fi, i) => {
      const fx = margin + i * fItemW + fItemW / 2;
      if (i > 0) {
        doc.setDrawColor(210, 220, 230);
        doc.setLineWidth(0.1);
        doc.line(margin + i * fItemW, stripY + 6, margin + i * fItemW, stripY + 14);
      }
      doc.setFont("times", "normal");
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      doc.text(fi.label, fx, stripY + 9, { align: "center" });
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(55, 118, 160);
      doc.text(fi.value, fx, stripY + 13.5, { align: "center" });
    });
 
    // ── PROCUREMENT TABLE (no cost column) ────────────────────────────
    const tableStartY = stripY + 19;
 
    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(50, 50, 50);
    doc.text("PROCUREMENT ACTION TABLE", margin, tableStartY - 2.5);
 
    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(220, 53, 53);
    doc.text("[!] Order Now", pageWidth - margin - 50, tableStartY - 2);
    doc.setTextColor(217, 119, 6);
    doc.text("[~] Watch", pageWidth - margin - 28, tableStartY - 2);
    doc.setTextColor(22, 163, 74);
    doc.text("[OK]", pageWidth - margin - 8, tableStartY - 2);
 
    const bodyData = procurementRows.map((row) => {
      const weeksNum = parseFloat(row.weeksLeft);
      const weeksColor: [number, number, number] =
        weeksNum < 2 ? [200, 0, 0] : weeksNum < 4 ? [180, 100, 0] : [40, 40, 40];
      const statusLabel =
        row.status === "order" ? "[!] ORDER NOW"
        : row.status === "watch" ? "[~] WATCH"
        : "[OK]";
      const statusColor: [number, number, number] =
        row.status === "order" ? [200, 0, 0]
        : row.status === "watch" ? [180, 100, 0]
        : [22, 163, 74];
 
      return [
        row.description,
        { content: String(row.currentStock),    styles: { halign: "center" as const } },
        { content: String(row.weeklyBurnRate),  styles: { halign: "center" as const } },
        {
          content: `${row.weeksLeft} wks`,
          styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: weeksColor },
        },
        { content: `${row.predDemand} units`,   styles: { halign: "center" as const } },
        {
          content: row.suggestedOrder > 0 ? `${row.suggestedOrder} pcs` : "--",
          styles: {
            halign: "center" as const,
            fontStyle: row.suggestedOrder > 0 ? "bold" as const : "normal" as const,
            textColor: row.suggestedOrder > 0 ? [200, 0, 0] as [number,number,number] : [160, 160, 160] as [number,number,number],
          },
        },
        {
          content: statusLabel,
          styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: statusColor },
        },
      ];
    });
 
    autoTable(doc, {
      startY: tableStartY + 1,
      head: [[
        { content: "Item Description",  styles: { halign: "left"   as const } },
        { content: "Stock",             styles: { halign: "center" as const } },
        { content: "Burn / wk",         styles: { halign: "center" as const } },
        { content: "Weeks Left",        styles: { halign: "center" as const } },
        { content: "Pred. Demand",      styles: { halign: "center" as const } },
        { content: "Suggested Order",   styles: { halign: "center" as const } },
        { content: "Status",            styles: { halign: "center" as const } },
      ]],
      body: bodyData.length > 0
        ? bodyData
        : [["No procurement data available", "", "", "", "", "", ""]],
      theme: "grid",
      styles: {
        fontSize: 8,
        font: "times",
        lineColor: [220, 225, 230],
        lineWidth: 0.15,
        textColor: [40, 40, 40],
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
      headStyles: {
        fillColor: [74, 137, 176],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: [248, 251, 253] },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 18 },
        2: { cellWidth: 18 },
        3: { cellWidth: 22 },
        4: { cellWidth: 24 },
        5: { cellWidth: 28 },
        6: { cellWidth: 28 },
      },
    });
 
    // ── PAGE 2: ANALYSIS & INSIGHTS ───────────────────────────────────
    doc.addPage();
    doc.setFillColor(74, 137, 176);
    doc.rect(0, 0, pageWidth, 12, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("PROCUREMENT ANALYSIS & INSIGHTS", pageWidth / 2, 8, { align: "center" });
 
    let analyticsY = 18;
 
    // ── STATUS OVERVIEW ───────────────────────────────────────────────
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text("PROCUREMENT STATUS OVERVIEW", margin, analyticsY);
 
    const statusBoxY = analyticsY + 4;
    const statusBoxH = 20;
    const statusBoxW = (contentWidth - 8) / 3;
 
    const drawStatusBox = (
      x: number, y: number, w: number,
      label: string, count: number,
      color: [number, number, number]
    ) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...color);
      doc.setLineWidth(0.5);
      doc.rect(x, y, w, statusBoxH, "FD");
      doc.setFillColor(...color);
      doc.rect(x, y, w, 4.5, "F");
      doc.setFont("times", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(label, x + 4, y + 3.5);
      doc.setFont("times", "bold");
      doc.setFontSize(16);
      doc.setTextColor(...color);
      doc.text(String(count), x + w / 2, y + 14.5, { align: "center" });
      doc.setFont("times", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text("item" + (count !== 1 ? "s" : ""), x + w / 2, y + 18.5, { align: "center" });
    };
 
    drawStatusBox(margin,                      statusBoxY, statusBoxW, "CRITICAL \u2014 ORDER NOW",        orderNow,   [220, 53,  53]);
    drawStatusBox(margin + statusBoxW + 4,     statusBoxY, statusBoxW, "WATCH \u2014 MONITOR CLOSELY",   watchCount, [217, 119, 6]);
    drawStatusBox(margin + statusBoxW * 2 + 8, statusBoxY, statusBoxW, "OK \u2014 SUFFICIENT STOCK",     okCount,    [22,  163, 74]);
 
    analyticsY = statusBoxY + statusBoxH + 8;
 
    // ── CRITICAL ITEMS TABLE ──────────────────────────────────────────
    const criticalItems = procurementRows.filter((r) => r.status === "order");
    if (criticalItems.length > 0) {
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text("CRITICAL ITEMS \u2014 IMMEDIATE REORDER REQUIRED", margin, analyticsY);
 
      const criticalTableData = criticalItems.slice(0, 10).map((row) => [
        row.description,
        { content: String(row.currentStock), styles: { halign: "center" as const } },
        {
          content: `${row.weeksLeft} wks`,
          styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: [200, 0, 0] as [number,number,number] },
        },
        { content: String(row.weeklyBurnRate), styles: { halign: "center" as const } },
        {
          content: `${row.suggestedOrder} pcs`,
          styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: [200, 0, 0] as [number,number,number] },
        },
      ]);
 
      autoTable(doc, {
        startY: analyticsY + 4,
        head: [[
          { content: "Item Description",  styles: { halign: "left"   as const } },
          { content: "Stock",             styles: { halign: "center" as const } },
          { content: "Weeks Left",        styles: { halign: "center" as const } },
          { content: "Burn / wk",         styles: { halign: "center" as const } },
          { content: "Suggested Order",   styles: { halign: "center" as const } },
        ]],
        body: criticalTableData,
        theme: "grid",
        styles: {
          fontSize: 8, font: "times",
          lineColor: [220, 225, 230], textColor: [40, 40, 40],
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        },
        headStyles: { fillColor: [220, 53, 53], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [255, 245, 245] },
        columnStyles: {
          0: { cellWidth: 120 }, 1: { cellWidth: 20 },
          2: { cellWidth: 24  }, 3: { cellWidth: 22 }, 4: { cellWidth: 30 },
        },
      });
 
      analyticsY = (doc as any).lastAutoTable.finalY + 7;
    }
 
    // ── WATCH ITEMS TABLE ─────────────────────────────────────────────
    const watchItems = procurementRows.filter((r) => r.status === "watch");
    if (watchItems.length > 0 && analyticsY < pageHeight - 60) {
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text("WATCH ITEMS \u2014 MONITOR CLOSELY", margin, analyticsY);
 
      const watchTableData = watchItems.map((row) => [
        row.description,
        { content: String(row.currentStock), styles: { halign: "center" as const } },
        {
          content: `${row.weeksLeft} wks`,
          styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: [180, 100, 0] as [number,number,number] },
        },
        { content: String(row.weeklyBurnRate), styles: { halign: "center" as const } },
        { content: `${row.predDemand} units`,  styles: { halign: "center" as const } },
      ]);
 
      autoTable(doc, {
        startY: analyticsY + 4,
        head: [[
          { content: "Item Description", styles: { halign: "left"   as const } },
          { content: "Stock",            styles: { halign: "center" as const } },
          { content: "Weeks Left",       styles: { halign: "center" as const } },
          { content: "Burn / wk",        styles: { halign: "center" as const } },
          { content: "Pred. Demand",     styles: { halign: "center" as const } },
        ]],
        body: watchTableData,
        theme: "grid",
        styles: {
          fontSize: 8, font: "times",
          lineColor: [220, 225, 230], textColor: [40, 40, 40],
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        },
        headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [255, 252, 240] },
        columnStyles: {
          0: { cellWidth: 120 }, 1: { cellWidth: 20 },
          2: { cellWidth: 24  }, 3: { cellWidth: 22 }, 4: { cellWidth: 30 },
        },
      });
 
      analyticsY = (doc as any).lastAutoTable.finalY + 7;
    }
 
    // ── FORECAST & INVENTORY SUMMARY ──────────────────────────────────
    if (analyticsY < pageHeight - 50) {
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text("FORECAST & INVENTORY ANALYSIS", margin, analyticsY);
 
      const summaryY = analyticsY + 4;
      const summaryBoxW = (contentWidth - 6) / 2;
      const summaryBoxH = 28;
 
      // Forecast box
      doc.setFillColor(240, 248, 255);
      doc.setDrawColor(74, 137, 176);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, summaryY, summaryBoxW, summaryBoxH, 2, 2, "FD");
      doc.setFillColor(74, 137, 176);
      doc.roundedRect(margin, summaryY, summaryBoxW, 5.5, 2, 2, "F");
      doc.rect(margin, summaryY + 3.5, summaryBoxW, 2, "F");
      doc.setFont("times", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("DEMAND FORECAST (Next Month)", margin + 3, summaryY + 4.5);
      doc.setFont("times", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`Consumables predicted: ${consumForecast?.bestPredicted?.[0] ?? "--"} units`, margin + 3, summaryY + 11);
      doc.text(`Trend: ${consumForecast?.trend ?? "--"}`,                                     margin + 3, summaryY + 16);
      doc.text(`Model reliability (R\u00B2): ${consumForecast?.linear?.rSquared?.toFixed(2) ?? "--"}`, margin + 3, summaryY + 21);
      doc.text(`Borrowables predicted: ${borrowForecast?.bestPredicted?.[0] ?? "--"} units`,  margin + 3, summaryY + 26);
 
      // Inventory stats box
      doc.setFillColor(245, 250, 243);
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin + summaryBoxW + 6, summaryY, summaryBoxW, summaryBoxH, 2, 2, "FD");
      doc.setFillColor(22, 163, 74);
      doc.roundedRect(margin + summaryBoxW + 6, summaryY, summaryBoxW, 5.5, 2, 2, "F");
      doc.rect(margin + summaryBoxW + 6, summaryY + 3.5, summaryBoxW, 2, "F");
      doc.setFont("times", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("INVENTORY METRICS", margin + summaryBoxW + 9, summaryY + 4.5);
      doc.setFont("times", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total items in scope: ${procurementRows.length}`,                                          margin + summaryBoxW + 9, summaryY + 11);
      doc.text(`Mean burn rate: ${inventoryStats?.meanBurnRate?.toFixed(2) ?? "--"} units/wk`,             margin + summaryBoxW + 9, summaryY + 16);
      doc.text(`Burn rate std. deviation: ${inventoryStats?.burnRateStdDev?.toFixed(2) ?? "--"}`,          margin + summaryBoxW + 9, summaryY + 21);
      doc.text(`High-burn outlier items: ${inventoryStats?.highBurnOutliers ?? 0}`,                        margin + summaryBoxW + 9, summaryY + 26);
 
      analyticsY = summaryY + summaryBoxH + 7;
    }
 
    // ── AI INSIGHTS ───────────────────────────────────────────────────
    if (groqInsight) {
      const lines = doc.splitTextToSize(groqInsight, contentWidth - 10);
      const insightBoxH = lines.length * 4.5 + 14;
      const spaceNeeded = insightBoxH + 10 + 5;
      const spaceLeft   = pageHeight - analyticsY;
 
      if (spaceNeeded > spaceLeft) {
        doc.addPage();
        doc.setFillColor(74, 137, 176);
        doc.rect(0, 0, pageWidth, 12, "F");
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("PROCUREMENT DECISION SUMMARY (cont.)", pageWidth / 2, 8, { align: "center" });
        analyticsY = 16;
      }
 
      doc.setFillColor(74, 137, 176);
      doc.setDrawColor(74, 137, 176);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, analyticsY, contentWidth, insightBoxH, 2, 2, "F");
      doc.setFillColor(245, 250, 255);
      doc.roundedRect(margin, analyticsY + 7.5, contentWidth, insightBoxH - 7.5, 0, 0, "F");
      doc.rect(margin, analyticsY + 5.5, contentWidth, 2, "F");
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("AI PROCUREMENT INSIGHTS  \u00B7  Groq llama-3.3-70b", margin + 4, analyticsY + 5.3);
      doc.setFont("times", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text(lines, margin + 5.5, analyticsY + 13);
      doc.setFillColor(0, 0, 0, 0);
      doc.setDrawColor(74, 137, 176);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, analyticsY, contentWidth, insightBoxH, 2, 2, "D");
    }
 
    // ── FOOTER (all pages) ────────────────────────────────────────────
    const totalPages = (doc as any).internal.pages.length - 1;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(47, 100, 136);
      doc.rect(0, pageHeight - 8, pageWidth, 8, "F");
      doc.setFont("times", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(210, 235, 255);
      doc.text(
        "FacilityLink  \u00B7  Centralized Inventory System  \u00B7  PLM General Services Office",
        pageWidth / 2, pageHeight - 2.8, { align: "center" }
      );
      doc.setTextColor(255, 255, 255);
      doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 2.8, { align: "right" });
      doc.text(`${monthName} ${year}`, margin, pageHeight - 2.8);
    }
 
    doc.save(`Procurement_Summary_${monthName}_${year}.pdf`);
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
      const isHistoricalMonth = availableMonths.includes(ssmiMonthOption);
      if (isHistoricalMonth) {
        const { data: historyItems } = await supabase
          .from("inventory_history")
          .select("*")
          .ilike("item_no", `${prefix}%`)
          .eq("period_label", ssmiMonthOption)
          .order("item_no", { ascending: true });
        if (!historyItems || historyItems.length === 0) {
          toast.error(`No data found for ${ssmiMonthOption}`);
          setGenerating(null);
          return;
        }

        const itemNos = historyItems
          .map((item) => item.item_no)
          .filter(Boolean);
        const { data: inventoryDescData } = await supabase
          .from("inventory")
          .select("item_no, description")
          .in("item_no", itemNos);
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
          const description =
            descriptionMap[item.item_no] || item.item_description || "";
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
        .select("*")
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
            .select(
              "item_no, quantity_requested, inventory(description, unit_id, units(name))",
            )
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

  const runGroqInsights = async () => {
  setGroqLoading(true);
  setGroqInsight("");
 
  const criticalItems = procurementRows
    .filter((r) => r.status === "order")
    .map((r) => `${r.description} (${r.weeksLeft} wks left)`)
    .join(", ");
 
  const prompt = `You are a procurement analyst for a Philippine university (PLM) General Services Office.
 
Inventory forecast data (computed via polynomial + linear regression):
- Consumables predicted next month: ${consumForecast?.bestPredicted?.[0] ?? 0} units
- Trend direction: ${consumForecast?.trend ?? "unknown"}
- Forecast reliability (R²): ${consumForecast?.linear?.rSquared?.toFixed(2) ?? "N/A"}
- Borrowables predicted next month: ${borrowForecast?.bestPredicted?.[0] ?? 0} units
- Mean burn rate: ${inventoryStats?.meanBurnRate?.toFixed(2) ?? "N/A"} units/week
- Burn rate std deviation: ${inventoryStats?.burnRateStdDev?.toFixed(2) ?? "N/A"}
- High burn outliers: ${inventoryStats?.highBurnOutliers ?? 0} items
- Stock-to-burnrate correlation: ${inventoryStats?.stockBurnCorrelation ?? "N/A"}
- Critical items needing reorder: ${criticalItems || "none"}
 
In 4 sentences: (1) identify highest stockout risks with urgency, (2) comment on forecast reliability using the R² value, (3) flag any semester-linked demand spike, (4) give one specific procurement action with a suggested date. Be direct. Use Philippine academic calendar context.`;
 
  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 350,
          temperature: 0.4,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `Groq error ${res.status}`);
    }
    const data = await res.json();
    setGroqInsight(data.choices?.[0]?.message?.content || "No response.");
  } catch (e: any) {
    toast.error(`Groq error: ${e.message}`);
    setGroqInsight(`Failed to get insights: ${e.message}`);
  } finally {
    setGroqLoading(false);
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
  if (!monthlyTrendData.length || !consumForecast || !borrowForecast)
    return monthlyTrendData;

  const shortMonths = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  const now = new Date();

  const forecastPoints = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    return {
      month: shortMonths[d.getMonth()] + " (pred)",
      consumables: null,
      borrowables: null,
      consumablesForecast: consumForecast?.bestPredicted?.[i] ?? null,
      borrowablesForecast: borrowForecast?.bestPredicted?.[i] ?? null,
      isForecast: true,
    };
  });

  const last = monthlyTrendData[monthlyTrendData.length - 1];

  // Historical points carry null for forecast keys
  const historical = monthlyTrendData.map((d) => ({
    ...d,
    consumablesForecast: null,
    borrowablesForecast: null,
    isForecast: false,
  }));

  // Bridge: last historical point also carries the first forecast value
  // so dashed lines visually start from the last real dot.
  const bridged = [
    ...historical.slice(0, -1),
    {
      ...historical[historical.length - 1],
      consumablesForecast: consumForecast?.bestPredicted?.[0] ?? null,
      borrowablesForecast: borrowForecast?.bestPredicted?.[0] ?? null,
    },
    // Forecast extension — skip index 0 since bridge already carries it
    ...forecastPoints,
  ];

  return bridged;
}, [monthlyTrendData, consumForecast, borrowForecast]);

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
              <div className="text-sm">Total Requests (Week)</div>
            </div>
            <div className="bg-orange-600 rounded-xl p-6 text-white shadow-md">
              <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
              <div className="text-3xl font-bold">{itemsNeedRestock}</div>
              <div className="text-sm">Items Out of Stock</div>
            </div>
          </div>

          {/* Charts */}
          <div className="space-y-6">
            {/* Categorized Asset Analytics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">
                Categorized Asset Analytics
              </h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">
                Consumables vs Borrowables/Returnables Analysis
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-base flex items-center gap-2 mb-4">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    Consumable Burn Rate
                  </h4>
                  {consumableBurnRate.length > 0 ? (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {consumableBurnRate.slice(0, 5).map((item, index) => (
                        <div
                          key={index}
                          className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900 text-xs">
                                {item.description}
                              </h5>
                              <p className="text-xs text-gray-600 mt-1">
                                Monthly Usage:{" "}
                                <span className="font-bold text-blue-600">
                                  {item.monthlyUsage} units
                                </span>
                              </p>
                            </div>
                            <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />
                          </div>
                          <div className="grid grid-cols-3 gap-1 mt-2">
                            <div className="bg-white rounded p-1.5">
                              <p className="text-xs text-gray-600">
                                Weekly Rate
                              </p>
                              <p className="text-sm font-bold text-blue-600">
                                {item.weeklyBurnRate}
                              </p>
                            </div>
                            <div className="bg-white rounded p-1.5">
                              <p className="text-xs text-gray-600">
                                Current Stock
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {item.currentStock}
                              </p>
                            </div>
                            <div className="bg-white rounded p-1.5">
                              <p className="text-xs text-gray-600">
                                Weeks Left
                              </p>
                              <p className="text-sm font-bold text-orange-600">
                                {item.weeksUntilStockout}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 p-1.5 bg-white rounded text-xs text-gray-700">
                            <strong>Action:</strong> {item.recommendation}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-gray-400">
                      No consumable data available
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-base flex items-center gap-2 mb-4">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    Borrowable Utilization
                  </h4>
                  {borrowableUtilization.length > 0 ? (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {borrowableUtilization.slice(0, 5).map((item, index) => (
                        <div
                          key={index}
                          className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-3 border border-green-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900 text-xs">
                                {item.description}
                              </h5>
                              <p className="text-xs text-gray-600 mt-1">
                                Requests:{" "}
                                <span className="font-bold text-green-600">
                                  {item.totalRequests}
                                </span>
                              </p>
                            </div>
                            <Activity className="w-4 h-4 text-green-600 flex-shrink-0" />
                          </div>
                          <div className="grid grid-cols-3 gap-1 mt-2">
                            <div className="bg-white rounded p-1.5">
                              <p className="text-xs text-gray-600">
                                Utilization %
                              </p>
                              <p className="text-sm font-bold text-green-600">
                                {item.utilizationPercentage}%
                              </p>
                            </div>
                            <div className="bg-white rounded p-1.5">
                              <p className="text-xs text-gray-600">In Stock</p>
                              <p className="text-sm font-bold text-gray-900">
                                {item.currentStock}
                              </p>
                            </div>
                            <div className="bg-white rounded p-1.5">
                              <p className="text-xs text-gray-600">Status</p>
                              <p className="text-xs font-bold text-green-600">
                                {item.utilizationPercentage < 5
                                  ? "Low"
                                  : item.utilizationPercentage > 20
                                    ? "High"
                                    : "Good"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 p-1.5 bg-white rounded text-xs text-gray-700">
                            <strong>Insight:</strong> {item.recommendation}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-gray-400">
                      No borrowable utilization data available
                    </div>
                  )}
                </div>
              </div>
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
                              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">
                                #
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
                    Requests by department + next month forecast
                    <span className="ml-2 text-xs text-purple-600 border border-purple-200 bg-purple-50 px-2 py-0.5 rounded-full">
                      lighter bar = predicted
                    </span>
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
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
              {deptWithForecast.length > 0 ? (
                <ResponsiveContainer width="100%" height={450}>
                  <BarChart
                    data={deptWithForecast}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="dept"
                      type="category"
                      width={200}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<ForecastTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="requests"
                      fill="#8b5cf6"
                      name="Actual Requests"
                    />
                    <Bar
                      dataKey="predicted"
                      fill="#ddd6fe"
                      name="Next Month (forecast)"
                    />
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
            {!showTrendAnalysis ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-4">
                <h3 className="text-xl font-bold text-gray-900">
                  13-Month Trend Analysis
                </h3>
                <p className="text-sm text-gray-600">
                  Items distributed over time
                </p>
                <button
                  onClick={() => setShowTrendAnalysis(true)}
                  className="px-6 py-3 rounded-lg font-medium transition-colors bg-blue-500 text-white hover:bg-blue-600"
                >
                  Click here to show trend analysis
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      13-Month Trend + 3-Month Forecast
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Actual history + predicted next 3 months
                      <span className="ml-2 text-xs text-purple-600 border border-purple-200 bg-purple-50 px-2 py-0.5 rounded-full">
                        dashed = forecast
                      </span>
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
                            ? "Consumables"
                            : "Borrowables"}
                      </button>
                    ))}
                  </div>
                </div>
                {trendChartData.length > 0 ? (
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
                          <stop
                            offset="0%"
                            stopColor="#10b981"
                            stopOpacity="0.3"
                          />
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
                          <stop
                            offset="0%"
                            stopColor="#a855f7"
                            stopOpacity="0.3"
                          />
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
                        {/* Vertical divider at forecast start */}
                        {consumForecast && (
                          <ReferenceLine
                            x={trendChartData.find((d) => d.isForecast)?.month}
                            stroke="#a855f7"
                            strokeDasharray="4 4"
                            label={{
                              value: "Forecast →",
                              position: "top",
                              fontSize: 10,
                              fill: "#a855f7",
                            }}
                          />
                        )}
                        {(trendFilter === "all" ||
                          trendFilter === "consumable") && (
                          <>
                            <Area
                              type="monotone"
                              dataKey="consumables"
                              stroke="#10b981"
                              fill="url(#consumablesGradient)"
                              strokeWidth={2}
                              name="Consumables (actual)"
                              opacity={consumableOpacity}
                              isAnimationActive
                              animationDuration={500}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="consumablesForecast"
                              stroke="#10b981"
                              strokeWidth={2}
                              strokeDasharray="6 3"
                              dot={{ r: 4, fill: "#10b981" }}
                              name="Consumables (forecast)"
                              opacity={consumableOpacity}
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
                              name="Borrowables (actual)"
                              opacity={borrowableOpacity}
                              isAnimationActive
                              animationDuration={500}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="borrowablesForecast"
                              stroke="#a855f7"
                              strokeWidth={2}
                              strokeDasharray="6 3"
                              dot={{ r: 4, fill: "#a855f7" }}
                              name="Borrowables (forecast)"
                              opacity={borrowableOpacity}
                            />
                          </>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    {/* Forecast confidence note */}
                    {consumForecast && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-lg flex items-center gap-3 text-xs text-purple-700">
                        <TrendingUp className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Forecast model:{" "}
                          <strong>polynomial + linear regression</strong> · R²
                          reliability:{" "}
                          <strong>
                            {consumForecast?.linear?.rSquared?.toFixed(2) ??
                              "—"}
                          </strong>{" "}
                          · Trend:{" "}
                          <strong>{consumForecast?.trend ?? "—"}</strong> · Next
                          3 months:{" "}
                          <strong>
                            {consumForecast?.bestPredicted?.join(", ") ?? "—"}
                          </strong>{" "}
                          units
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No data available
                  </div>
                )}
              </>
            )}
          </div>

          {/* Item Trend Analysis — WITH FORECAST BAR */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-xl font-bold text-gray-900">
              Item Trend Analysis
            </h3>
            <p className="text-sm text-gray-600 mt-1 mb-6">
              Top requested items with trend + next month prediction
            </p>
            {topItemsWithForecast.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {topItemsWithForecast.map((item, index) => {
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
                      {/* Header with title, request count, and trend */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm leading-tight truncate">
                            {item.name}
                          </h4>
                          <div className="text-xl font-bold text-[#4A89B0] mt-1">
                            {item.requests}
                            <span className="text-xs font-normal text-gray-600 ml-1">
                              this month
                            </span>
                          </div>
                        </div>
                        <div
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${trendBadgeColor}`}
                        >
                          {item.trend > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {item.trendLabel}
                        </div>
                      </div>

                      {/* Forecast comparison bar */}
                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-5 block">
                          Month comparison
                        </div>

                        {/* Current vs Predicted Comparison */}
                        <div className="space-y-3">
                          {/* Current Bar */}
                          <div className="flex items-center gap-4">
                            <div className="w-12 text-right">
                              <div className="text-xl font-bold text-[#4A89B0]">
                                {item.requests}
                              </div>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <div
                                className="bg-gradient-to-r from-[#4A89B0] to-[#7dd3fc] rounded-lg shadow-md border border-[#4A89B0]/20 transition-all hover:shadow-lg"
                                style={{
                                  width: `${Math.max(20, (item.requests / Math.max(item.requests, item.predicted)) * 250)}px`,
                                  height: "28px",
                                }}
                              />
                              <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                                Current
                              </span>
                            </div>
                          </div>

                          {/* Predicted Bar */}
                          <div className="flex items-center gap-4">
                            <div className="w-12 text-right">
                              <div className="text-xl font-bold text-purple-600">
                                {item.predicted}
                              </div>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-purple-300 rounded-lg shadow-md border border-purple-400/20 transition-all hover:shadow-lg"
                                style={{
                                  width: `${Math.max(20, (item.predicted / Math.max(item.requests, item.predicted)) * 250)}px`,
                                  height: "28px",
                                }}
                              />
                              <span className="text-xs font-semibold text-purple-700 whitespace-nowrap">
                                Predicted
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Prediction value */}
                      <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="text-xs text-purple-700 font-medium">
                          Next month forecast
                        </div>
                        <div className="text-2xl font-bold text-purple-600 mt-2 flex items-baseline gap-1">
                          {item.predicted}
                          <span className="text-xs font-normal text-purple-600">
                            units
                          </span>
                        </div>
                      </div>

                      {/* Status/Advice badge */}
                      <div
                        className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
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
            ) : (
              <div className="py-12 flex items-center justify-center text-gray-400">
                No trend data available
              </div>
            )}
          </div>

          {/* ── DECISION SUPPORT SYSTEM ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-[#4A89B0]" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Decision Support System
                </h3>
                <p className="text-sm text-gray-600">
                  Predictive analytics · simple-statistics + ml-regression
                </p>
              </div>
              <span className="ml-auto px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                R² {consumForecast?.linear?.rSquared?.toFixed(2) ?? "—"}
              </span>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">
                  Predicted demand (next mo.)
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {consumForecast?.bestPredicted?.[0] ?? "—"}
                </p>
                <p className="text-xs text-gray-400">consumable units</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">
                  Borrowable forecast
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {borrowForecast?.bestPredicted?.[0] ?? "—"}
                </p>
                <p className="text-xs text-gray-400">next month</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
  <p className="text-xs text-gray-500 mb-1">Order now</p>
  <p className="text-2xl font-bold text-red-600">
    {totalOutOfStock}
  </p>
  <p className="text-xs text-gray-400">items out of stock</p>
</div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Demand trend</p>
                <p className="text-2xl font-bold text-blue-600">
                  {consumForecast
                    ? `${consumForecast.trend === "rising" ? "↑" : consumForecast.trend === "falling" ? "↓" : "→"} ${consumForecast.trend}`
                    : "—"}
                </p>
                <p className="text-xs text-gray-400">
                  slope: {consumForecast?.linear?.slope?.toFixed(2) ?? "—"}/mo
                </p>
              </div>
            </div>

            {/* DSS VISUALIZATION CHARTS */}
            <div className="border border-gray-200 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#4A89B0]" />
                  <h4 className="font-semibold text-gray-900">
                    Predictive Visualizations
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  {/* Tab buttons */}
                  <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                    <button
                      onClick={() => setDssChartTab("forecast")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dssChartTab === "forecast" ? "bg-white text-[#4A89B0] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                    >
                      📈 Demand Forecast
                    </button>
                    <button
                      onClick={() => setDssChartTab("burnrate")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dssChartTab === "burnrate" ? "bg-white text-[#4A89B0] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                    >
                      🔥 Burn Rates
                    </button>
                    <button
                      onClick={() => setDssChartTab("risk")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dssChartTab === "risk" ? "bg-white text-[#4A89B0] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                    >
                      ⚠ Stockout Risk
                    </button>
                  </div>
                  <button
                    onClick={() => setDssChartsExpanded(!dssChartsExpanded)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {dssChartsExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {dssChartsExpanded && (
                <>
                  {dssChartTab === "forecast" && (
                    <div>
                      <p className="text-xs text-gray-500 mb-3">
                        Last 6 months actual + 3-month prediction (dashed
                        lines). Uses polynomial regression from trend data.
                        {!consumForecast && (
                          <span className="text-orange-500 ml-1">
                            ⚠ Load trend analysis first to see forecast lines.
                          </span>
                        )}
                      </p>
                      {consumForecast && monthlyTrendData.length > 0 ? (
                        <DSS_ForecastChart
                          monthlyTrendData={monthlyTrendData}
                          consumForecast={consumForecast}
                          borrowForecast={borrowForecast}
                        />
                      ) : (
                        <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-50 rounded-lg">
                          <Activity className="w-8 h-8 opacity-40" />
                          <p className="text-sm">
                            Click "Show trend analysis" above to load forecast
                            data
                          </p>
                        </div>
                      )}
                      {consumForecast && (
                        <div className="grid grid-cols-3 gap-3 mt-4">
                          {(consumForecast?.bestPredicted || [])
                            .slice(0, 3)
                            .map((val: number, i: number) => {
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
                              const d = new Date(
                                now.getFullYear(),
                                now.getMonth() + i + 1,
                                1,
                              );
                              return (
                                <div
                                  key={i}
                                  className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100"
                                >
                                  <p className="text-xs text-gray-500">
                                    {shortMonths[d.getMonth()]}{" "}
                                    {d.getFullYear()}
                                  </p>
                                  <p className="text-xl font-bold text-purple-600">
                                    {val}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    predicted units
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {dssChartTab === "burnrate" && (
                    <div>
                      <p className="text-xs text-gray-500 mb-3">
                        Weekly consumption rate per item.{" "}
                        <span className="text-red-500 font-medium">Red</span> =
                        order now,{" "}
                        <span className="text-yellow-500 font-medium">
                          yellow
                        </span>{" "}
                        = watch,{" "}
                        <span className="text-green-500 font-medium">
                          green
                        </span>{" "}
                        = OK.
                      </p>
                      {procurementRows.length > 0 ? (
                        <DSS_BurnRateChart procurementRows={procurementRows} />
                      ) : (
                        <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-50 rounded-lg">
                          <p className="text-sm">No burn rate data available</p>
                        </div>
                      )}
                    </div>
                  )}

                  {dssChartTab === "risk" && (
                    <div>
                      <p className="text-xs text-gray-500 mb-3">
                        Stockout risk matrix: high burn rate + low stock =
                        danger zone (top-right). Each dot is one item.
                      </p>
                      {procurementRows.length > 0 ? (
                        <DSS_StockoutRiskChart
                          procurementRows={procurementRows}
                        />
                      ) : (
                        <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-50 rounded-lg">
                          <p className="text-sm">No risk data available</p>
                        </div>
                      )}
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{" "}
                          Order now
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />{" "}
                          Watch
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{" "}
                          OK
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Procurement table */}
            <div className="flex items-center justify-between mb-3">
  <h4 className="font-semibold text-gray-800">
    Procurement Action Table
  </h4>
  <button
    onClick={printProcurementSummary}
    disabled={generating !== null || procurementRows.length === 0}
    className="flex items-center gap-2 px-4 py-2 bg-[#4A89B0] text-white rounded-lg text-sm font-medium hover:bg-[#3776A0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <Printer className="w-4 h-4" />
    {generating === "Procurement" ? "Generating..." : "Print Procurement Summary"}
  </button>
</div>

<div className="overflow-x-auto mb-6">
  <table className="w-full text-sm border-collapse">
    <thead>
      <tr className="bg-gray-100">
        <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
          Item
        </th>
        <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700">
          Stock
        </th>
        <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700">
          Burn/wk
        </th>
        <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700">
          Weeks left
        </th>
        <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700">
          Predicted demand
        </th>
        <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700">
          Suggested order
        </th>
        <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-700">
          Status
        </th>
      </tr>
    </thead>
    <tbody>
      {procurementRows.length === 0 ? (
        <tr>
          <td colSpan={7} className="text-center text-gray-400 py-8">
            No data — trigger trend analysis first
          </td>
        </tr>
      ) : (
        procurementRows.map((row, i) => (
          <tr key={i} className="hover:bg-gray-50 transition-colors">
            <td className="border border-gray-200 px-3 py-2 font-medium text-gray-900">
              {row.description}
            </td>
            <td className="border border-gray-200 px-3 py-2 text-center">
              {row.currentStock}
            </td>
            <td className="border border-gray-200 px-3 py-2 text-center">
              {row.weeklyBurnRate}
            </td>
            <td
              className={`border border-gray-200 px-3 py-2 text-center font-medium ${
                parseFloat(row.weeksLeft) < 2
                  ? "text-red-600"
                  : parseFloat(row.weeksLeft) < 4
                  ? "text-yellow-600"
                  : "text-gray-700"
              }`}
            >
              {row.weeksLeft} wks
            </td>
            <td className="border border-gray-200 px-3 py-2 text-center">
              {row.predDemand} units
            </td>
            <td className="border border-gray-200 px-3 py-2 text-center font-bold text-red-600">
              {row.suggestedOrder > 0 ? (
                `${row.suggestedOrder} pcs`
              ) : (
                <span className="text-gray-400 font-normal">—</span>
              )}
            </td>
            <td className="border border-gray-200 px-3 py-2 text-center">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  row.status === "order"
                    ? "bg-red-100 text-red-700"
                    : row.status === "watch"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {row.status === "order"
                  ? "⚠ Order now"
                  : row.status === "watch"
                  ? "👁 Watch"
                  : "✓ OK"}
              </span>
            </td>
          </tr>
        ))
      )}
    </tbody>
    {/* tfoot with budget totals is intentionally removed */}
  </table>
</div>

            {/* Procurement pagination controls */}
            {procurementTotalPages > 1 && (
              <div className="flex items-center justify-between mb-6 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-sm text-gray-600">
                  Page {procurementPage} of {procurementTotalPages} ({allRequestedItems.length} total requested items)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProcurementPage(Math.max(1, procurementPage - 1))}
                    disabled={procurementPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setProcurementPage(Math.min(procurementTotalPages, procurementPage + 1))}
                    disabled={procurementPage === procurementTotalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Groq AI Insights */}
            <div className="border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#4A89B0]" />
                  <h4 className="font-semibold text-gray-900">AI Insights</h4>
                  <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                    Groq · llama-3.3-70b
                  </span>
                </div>
                <button
                  onClick={runGroqInsights}
                  disabled={groqLoading || !consumForecast}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4A89B0] text-white rounded-lg text-sm font-medium hover:bg-[#3776A0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Activity className="w-4 h-4" />
                  {groqLoading ? "Analyzing..." : "Run AI Analysis"}
                </button>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {groqInsight
                  ? groqInsight
                  : !consumForecast
                    ? 'Click "Show trend analysis" first to load forecast data, then run AI analysis.'
                    : 'Click "Run AI Analysis" to generate procurement insights from your real inventory data.'}
              </p>
            </div>
          </div>
          {/* ── END DSS ────────────────────────────────────────────────────── */}

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
                          <option key={month} value={month}>
                            {month}
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
                          <option key={opt} value={opt}>
                            {opt}
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
