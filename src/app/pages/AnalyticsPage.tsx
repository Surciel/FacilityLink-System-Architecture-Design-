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
  const now = new Date();

  // Build 3-month forecast extension
  const forecastMonths = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    return shortMonths[d.getMonth()] + " (pred)";
  });

  const historicalSlice = monthlyTrendData.slice(-6).map((d) => ({
    month: d.month,
    consumables: d.consumables,
    borrowables: d.borrowables,
    isForecast: false,
  }));

  const forecastPoints = forecastMonths.map((m, i) => ({
    month: m,
    consumablesForecast: consumForecast?.bestPredicted?.[i] ?? null,
    borrowablesForecast: borrowForecast?.bestPredicted?.[i] ?? null,
    isForecast: true,
  }));

  const combined = [
    ...historicalSlice,
    // Bridge: last historical + first forecast
    {
      month: forecastMonths[0],
      consumables: historicalSlice[historicalSlice.length - 1]?.consumables,
      borrowables: historicalSlice[historicalSlice.length - 1]?.borrowables,
      consumablesForecast: consumForecast?.bestPredicted?.[0] ?? null,
      borrowablesForecast: borrowForecast?.bestPredicted?.[0] ?? null,
      isForecast: false,
    },
    ...forecastPoints.slice(1),
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
        />
        <Area
          type="monotone"
          dataKey="borrowables"
          stroke="#a855f7"
          fill="url(#borrowGrad)"
          strokeWidth={2}
          name="Borrowables (actual)"
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
        />
        <Line
          type="monotone"
          dataKey="borrowablesForecast"
          stroke="#a855f7"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 4, fill: "#a855f7" }}
          name="Borrowables (forecast)"
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
  const [showCategoryDetailModal, setShowCategoryDetailModal] = useState(false);

  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [trendFilter, setTrendFilter] = useState<
    "all" | "consumable" | "borrowable"
  >("all");
  const [showTrendAnalysis, setShowTrendAnalysis] = useState(false);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [topRequestedItems, setTopRequestedItems] = useState<any[]>([]);
  const [departmentActivity, setDepartmentActivity] = useState<any[]>([]);
  const [totalRequestsWeek, setTotalRequestsWeek] = useState(0);
  const [itemsNeedRestock, setItemsNeedRestock] = useState(0);

  const [consumableBurnRate, setConsumableBurnRate] = useState<any[]>([]);
  const [borrowableUtilization, setBorrowableUtilization] = useState<any[]>([]);

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

  // ── Department activity with simple forecast ─────────────────────────────
  const deptWithForecast = useMemo(() => {
    if (!departmentActivity.length) return [];
    const total = departmentActivity.reduce((s, d) => s + d.requests, 0);
    return departmentActivity.map((d) => ({
      ...d,
      // Simple forecast: assume 5-15% growth based on share
      predicted: Math.round(d.requests * (1 + (Math.random() * 0.1 + 0.05))),
    }));
  }, [departmentActivity]);

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
    const topSixTotal = topSix.reduce((sum, [_, count]) => sum + count, 0);

    setCategoryDistribution(
      topSix.map(([name, count], i) => ({
        fullName: name,
        name: shortenItemName(name, 18),
        value:
          topSixTotal > 0
            ? parseFloat(((count / topSixTotal) * 100).toFixed(1))
            : 0,
        count,
        color: colors[i % colors.length],
      })),
    );
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

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data: requestsData } = await supabase
        .from("requests")
        .select("item_no, quantity_requested, quantity_returned, created_at")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());

      const burnRateMap: Record<string, any> = {};
      const utilizationMap: Record<string, any> = {};
      const requestsByItem: Record<string, any[]> = {};

      (requestsData || []).forEach((req) => {
        if (!requestsByItem[req.item_no]) requestsByItem[req.item_no] = [];
        requestsByItem[req.item_no].push(req);
      });

      (inventoryData || []).forEach((item) => {
        const itemRequests = requestsByItem[item.item_no] || [];
        const itemType = item.item_type || "consumable";

        if (itemType === "consumable") {
          const totalUsed = itemRequests.reduce(
            (sum, req) => sum + (Number(req.quantity_requested) || 0),
            0,
          );
          const weeksInMonth = 4.33;
          const weeklyBurnRate = (totalUsed / weeksInMonth).toFixed(2);
          burnRateMap[item.item_no] = {
            description: item.description,
            monthlyUsage: totalUsed,
            weeklyBurnRate: parseFloat(weeklyBurnRate),
            currentStock: item.remaining_stock,
            weeksUntilStockout:
              item.remaining_stock > 0 && parseFloat(weeklyBurnRate) > 0
                ? Math.ceil(item.remaining_stock / parseFloat(weeklyBurnRate))
                : "∞",
            recommendation:
              parseFloat(weeklyBurnRate) > 0
                ? `Reorder in ${Math.ceil(item.remaining_stock / parseFloat(weeklyBurnRate))} weeks`
                : "Monitor usage",
          };
        } else {
          const totalRequests = itemRequests.length;
          const daysInMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
          ).getDate();
          const utilizationPercentage =
            daysInMonth > 0
              ? ((totalRequests / daysInMonth) * 100).toFixed(1)
              : "0";
          utilizationMap[item.item_no] = {
            description: item.description,
            totalRequests,
            utilizationPercentage: parseFloat(utilizationPercentage),
            currentStock: item.remaining_stock,
            recommendation:
              parseFloat(utilizationPercentage) < 5
                ? "Low utilization - consider not restocking"
                : parseFloat(utilizationPercentage) > 20
                  ? "High utilization - monitor availability"
                  : "Healthy utilization rate",
          };
        }
      });

      setConsumableBurnRate(
        Object.values(burnRateMap)
          .sort((a, b) => b.weeklyBurnRate - a.weeklyBurnRate)
          .slice(0, 5),
      );
      setBorrowableUtilization(
        Object.values(utilizationMap)
          .sort((a, b) => b.utilizationPercentage - a.utilizationPercentage)
          .slice(0, 5),
      );

      const allBurnRates = Object.values(burnRateMap) as any[];
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

      setVelocityData(paginatedVelocity);
      setVelocityTotalPages(Math.ceil(sortedVelocity.length / itemsPerPage));
      setVelocityPage(page);
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
      doc.setFont("times");
      const pageWidth = doc.internal.pageSize.width;
      const now = new Date();
      const monthName = fullMonths[now.getMonth()];
      const year = now.getFullYear();

      // Header
      doc
        .setFontSize(12)
        .text("Pamantasan ng Lungsod ng Maynila", pageWidth / 2, 12, {
          align: "center",
        });
      doc
        .setFont("times", "bold")
        .setFontSize(13)
        .text("PROCUREMENT DECISION SUMMARY", pageWidth / 2, 19, {
          align: "center",
        });
      doc
        .setFont("times", "normal")
        .setFontSize(10)
        .text(
          "General Services Office — Analytics & Decision Support System",
          pageWidth / 2,
          25,
          { align: "center" },
        );
      doc
        .setFontSize(9)
        .text(
          `Generated: ${now.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}`,
          15,
          32,
        );
      doc.text(`Period: ${monthName} ${year}`, pageWidth - 15, 32, {
        align: "right",
      });

      // Summary KPI boxes (text-based)
      const orderNow = procurementRows.filter(
        (r) => r.status === "order",
      ).length;
      const watchCount = procurementRows.filter(
        (r) => r.status === "watch",
      ).length;
      const okCount = procurementRows.filter((r) => r.status === "ok").length;
      const totalBudget = procurementRows.reduce(
        (s, r) => s + r.estimatedCost,
        0,
      );

      autoTable(doc, {
        startY: 36,
        theme: "grid",
        styles: {
          fontSize: 10,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          cellPadding: 4,
        },
        head: [["Metric", "Value", "Metric", "Value"]],
        body: [
          [
            "Order Now (Critical)",
            {
              content: String(orderNow),
              styles: { fontStyle: "bold", textColor: [200, 0, 0] },
            },
            "Watch Items",
            {
              content: String(watchCount),
              styles: { fontStyle: "bold", textColor: [180, 120, 0] },
            },
          ],
          [
            "OK Items",
            {
              content: String(okCount),
              styles: { fontStyle: "bold", textColor: [0, 128, 0] },
            },
            "Est. Budget Needed",
            {
              content: `₱${totalBudget.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
              styles: { fontStyle: "bold" },
            },
          ],
          [
            "Predicted Demand (Consumables, next mo.)",
            {
              content: String(consumForecast?.bestPredicted?.[0] ?? "—"),
              styles: { fontStyle: "bold" },
            },
            "Trend Direction",
            {
              content: consumForecast?.trend ?? "—",
              styles: { fontStyle: "bold" },
            },
          ],
        ],
        headStyles: {
          fillColor: [74, 137, 176],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 30, halign: "center" },
          2: { cellWidth: 70 },
          3: { cellWidth: 30, halign: "center" },
        },
      });

      // Main procurement table
      const bodyData = procurementRows.map((row) => [
        row.description,
        { content: String(row.currentStock), styles: { halign: "center" } },
        { content: String(row.weeklyBurnRate), styles: { halign: "center" } },
        {
          content: `${row.weeksLeft} wks`,
          styles: {
            halign: "center",
            fontStyle: "bold",
            textColor:
              parseFloat(row.weeksLeft) < 2
                ? [200, 0, 0]
                : parseFloat(row.weeksLeft) < 4
                  ? [180, 120, 0]
                  : [0, 0, 0],
          },
        },
        { content: `${row.predDemand} units`, styles: { halign: "center" } },
        {
          content: row.suggestedOrder > 0 ? `${row.suggestedOrder} pcs` : "—",
          styles: {
            halign: "center",
            fontStyle: "bold",
            textColor: row.suggestedOrder > 0 ? [200, 0, 0] : [100, 100, 100],
          },
        },
        {
          content:
            row.estimatedCost > 0
              ? `₱${row.estimatedCost.toLocaleString("en-PH")}`
              : "—",
          styles: { halign: "right" },
        },
        {
          content:
            row.status === "order"
              ? "⚠ ORDER NOW"
              : row.status === "watch"
                ? "👁 WATCH"
                : "✓ OK",
          styles: {
            halign: "center",
            fontStyle: "bold",
            textColor:
              row.status === "order"
                ? [200, 0, 0]
                : row.status === "watch"
                  ? [180, 120, 0]
                  : [0, 128, 0],
          },
        },
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 4,
        head: [
          [
            { content: "Item Description", styles: { halign: "left" } },
            { content: "Current Stock", styles: { halign: "center" } },
            { content: "Burn/wk", styles: { halign: "center" } },
            { content: "Weeks Left", styles: { halign: "center" } },
            { content: "Pred. Demand", styles: { halign: "center" } },
            { content: "Suggested Order", styles: { halign: "center" } },
            { content: "Est. Cost (₱)", styles: { halign: "right" } },
            { content: "Status", styles: { halign: "center" } },
          ],
        ],
        body:
          bodyData.length > 0
            ? bodyData
            : [["No procurement data available", "", "", "", "", "", "", ""]],
        theme: "grid",
        styles: {
          fontSize: 8,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [74, 137, 176],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { cellWidth: 22 },
          5: { cellWidth: 25 },
          6: { cellWidth: 25 },
          7: { cellWidth: 25 },
        },
      });

      // Budget breakdown by status
      const orderBudget = procurementRows
        .filter((r) => r.status === "order")
        .reduce((s, r) => s + r.estimatedCost, 0);
      const watchBudget = procurementRows
        .filter((r) => r.status === "watch")
        .reduce((s, r) => s + r.estimatedCost, 0);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 4,
        theme: "grid",
        styles: {
          fontSize: 9,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          cellPadding: 3,
        },
        head: [["Budget Breakdown", "Items", "Estimated Cost"]],
        body: [
          [
            "⚠ Immediate Orders (Critical)",
            String(orderNow),
            `₱${orderBudget.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
          ],
          [
            "👁 Watch Items (Optional Reorder)",
            String(watchCount),
            `₱${watchBudget.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
          ],
          [
            {
              content: "TOTAL ESTIMATED PROCUREMENT BUDGET",
              styles: { fontStyle: "bold" },
            },
            {
              content: String(orderNow + watchCount),
              styles: { fontStyle: "bold", halign: "center" },
            },
            {
              content: `₱${(orderBudget + watchBudget).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
              styles: { fontStyle: "bold", halign: "right" },
            },
          ],
        ],
        headStyles: {
          fillColor: [74, 137, 176],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 20, halign: "center" },
          2: { halign: "right" },
        },
      });

      // AI insights if available
      if (groqInsight) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 4,
          theme: "grid",
          styles: {
            fontSize: 8,
            font: "times",
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            cellPadding: 3,
          },
          head: [["AI Procurement Insights (Groq · llama-3.3-70b)"]],
          body: [[groqInsight]],
          headStyles: {
            fillColor: [74, 137, 176],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
        });
      }

      // Signature block
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
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
                "Approved by:\n\n\n______________________\nAuthorizing Officer",
              styles: { halign: "left" },
            },
          ],
        ],
      });

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
    const totalBudget = procurementRows
      .reduce((sum, r) => sum + r.estimatedCost, 0)
      .toLocaleString("en-PH", { style: "currency", currency: "PHP" });

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
- Estimated procurement budget: ${totalBudget}

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

    // Bridge last actual into forecast zone
    const last = monthlyTrendData[monthlyTrendData.length - 1];
    const historical = monthlyTrendData.map((d) => ({
      ...d,
      consumablesForecast: null,
      borrowablesForecast: null,
      isForecast: false,
    }));

    return [
      ...historical,
      {
        ...forecastPoints[0],
        consumables: last.consumables,
        borrowables: last.borrowables,
      },
      ...forecastPoints.slice(1),
    ];
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

      {showCategoryDetailModal && selectedCategoryDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCategoryDetail.fullName}
              </h2>
              <p className="text-sm text-gray-600 mt-2">Detailed Analysis</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="text-sm text-gray-600">Percentage</div>
                <div className="text-3xl font-bold text-[#4A89B0]">
                  {selectedCategoryDetail.value}%
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                <div className="text-sm text-gray-600">Total Requests</div>
                <div className="text-3xl font-bold text-purple-600">
                  {selectedCategoryDetail.count}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
                <p className="text-sm text-gray-600">
                  This item represents {selectedCategoryDetail.value}% of all
                  requests this month, with a total of{" "}
                  {selectedCategoryDetail.count} requests.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowCategoryDetailModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* Category Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">
                Category Distribution
              </h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">
                Percentage of requests by item (click for details)
              </p>
              {categoryDistribution.length > 0 ? (
                <div className="flex gap-2 justify-center">
                  <div className="flex-shrink-0">
                    <ResponsiveContainer width={300} height={300}>
                      <PieChart>
                        <Pie
                          data={categoryDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius={90}
                          dataKey="value"
                          isAnimationActive={false}
                          onClick={(entry) => {
                            setSelectedCategoryDetail(entry);
                            setShowCategoryDetailModal(true);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          {categoryDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => `${value}%`}
                          cursor={false}
                          contentStyle={{ pointerEvents: "none" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center">
                    <div className="space-y-2">
                      {categoryDistribution.map((entry, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 text-sm text-gray-700"
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>
                            {entry.fullName}: {entry.value}% ({entry.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  No data available
                </div>
              )}
            </div>

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
                    <div className="space-y-3">
                      {consumableBurnRate.map((item, index) => (
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
                    <div className="space-y-3">
                      {borrowableUtilization.map((item, index) => (
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
              <h3 className="text-xl font-bold text-gray-900">
                Department Activity
              </h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">
                Requests by department + next month forecast
                <span className="ml-2 text-xs text-purple-600 border border-purple-200 bg-purple-50 px-2 py-0.5 rounded-full">
                  lighter bar = predicted
                </span>
              </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topItemsWithForecast.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {item.name}
                        </div>
                        <div className="text-2xl font-bold text-[#4A89B0] mt-1">
                          {item.requests}
                        </div>
                        <div className="text-xs text-gray-600">
                          requests this month
                        </div>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${item.isNew ? "bg-blue-100 text-blue-700" : item.trend > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {item.trend > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {item.trendLabel}
                      </div>
                    </div>
                    {/* Mini forecast bar */}
                    <div className="mt-3 mb-2 flex items-end gap-1 h-10">
                      <div className="flex flex-col items-center gap-0.5 flex-1">
                        <div
                          className="w-full bg-[#7dd3fc] rounded-t"
                          style={{
                            height: `${Math.min(100, (item.requests / Math.max(item.requests, item.predicted)) * 40)}px`,
                          }}
                        />
                        <span className="text-xs text-gray-500">Now</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 flex-1">
                        <div
                          className="w-full bg-purple-300 rounded-t border-2 border-dashed border-purple-400"
                          style={{
                            height: `${Math.min(100, (item.predicted / Math.max(item.requests, item.predicted)) * 40)}px`,
                          }}
                        />
                        <span className="text-xs text-purple-600">Pred.</span>
                      </div>
                    </div>
                    <div className="text-xs text-purple-600 font-medium mb-2">
                      📊 Predicted next month: <strong>{item.predicted}</strong>
                    </div>
                    <div className="pt-2 border-t border-gray-200 text-xs text-gray-700">
                      <span
                        className={`flex items-center gap-1 ${item.adviceType === "new" ? "text-blue-600" : item.adviceType === "increase" ? "text-orange-600" : "text-gray-500"}`}
                      >
                        {item.adviceType !== "new" &&
                        item.adviceType !== "stable" ? (
                          <AlertCircle className="w-3 h-3 text-orange-500" />
                        ) : null}
                        {item.advice}
                      </span>
                    </div>
                  </div>
                ))}
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
                  {procurementRows.filter((r) => r.status === "order").length}
                </p>
                <p className="text-xs text-gray-400">critical items</p>
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
                {generating === "Procurement"
                  ? "Generating..."
                  : "Print Procurement Summary"}
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
                      <td
                        colSpan={7}
                        className="text-center text-gray-400 py-8"
                      >
                        No data — trigger trend analysis first
                      </td>
                    </tr>
                  ) : (
                    procurementRows.map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-gray-50 transition-colors"
                      >
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
                          className={`border border-gray-200 px-3 py-2 text-center font-medium ${parseFloat(row.weeksLeft) < 2 ? "text-red-600" : parseFloat(row.weeksLeft) < 4 ? "text-yellow-600" : "text-gray-700"}`}
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
                          {row.estimatedCost > 0 && (
                            <div className="text-xs font-normal text-gray-400">
                              ₱{row.estimatedCost.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${row.status === "order" ? "bg-red-100 text-red-700" : row.status === "watch" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}
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
                {procurementRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td
                        colSpan={5}
                        className="border border-gray-200 px-3 py-2 text-right text-gray-700"
                      >
                        Estimated total procurement budget:
                      </td>
                      <td
                        colSpan={2}
                        className="border border-gray-200 px-3 py-2 text-center text-red-700 font-bold"
                      >
                        ₱
                        {procurementRows
                          .reduce((s, r) => s + r.estimatedCost, 0)
                          .toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

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
