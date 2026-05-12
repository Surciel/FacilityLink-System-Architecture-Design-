import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
} from "recharts";
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
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { supabase } from "../../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InventoryItem {
  item_no: string;
  description: string;
  unit: string;
  remaining_stock: number;
  minimum_stock?: number;
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

export function AnalyticsPage() {
  const navigate = useNavigate();
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
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [topRequestedItems, setTopRequestedItems] = useState<any[]>([]);
  const [departmentActivity, setDepartmentActivity] = useState<any[]>([]);
  const [totalRequestsWeek, setTotalRequestsWeek] = useState(0);
  const [itemsNeedRestock, setItemsNeedRestock] = useState(0);

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
  const currentMonth = fullMonths[new Date().getMonth()];
  const currentYearStr = new Date().getFullYear();
  const defaultMonthOption = `${currentMonth} ${currentYearStr}`;
  const [ssmiMonthOption, setSsmiMonthOption] =
    useState<string>(defaultMonthOption);

  const [risReportFacility, setRisReportFacility] = useState<"JMS" | "GYM">(
    "JMS",
  );
  const [risMonthOption, setRisMonthOption] =
    useState<string>(defaultMonthOption);
  const [risWeekOption, setRisWeekOption] = useState<string>("week1");
  const [risDayOption, setRisDayOption] = useState<string>(getLocalISODate(new Date()));
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarExpanded", JSON.stringify(isSidebarExpanded));
  }, [isSidebarExpanded]);

  useEffect(() => {
    localStorage.setItem("sidebarPinned", JSON.stringify(isSidebarPinned));
  }, [isSidebarPinned]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWeeklyRequests(),
        fetchMonthlyTrend(),
        fetchTopRequestedItems(),
        fetchDepartmentActivity(),
        fetchSummaryStats(),
        fetchAvailableMonths(),
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
    const { data } = await supabase
      .from("requests")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString());
    setTotalRequestsWeek(data?.length || 0);
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

    const monthlyData: Record<string, number> = {};

    const { data: allHistoryData } = await supabase
      .from("inventory_history")
      .select("*");

    const historyByPeriod: Record<string, number> = {};
    (allHistoryData || []).forEach((row) => {
      const label = row.period_label;
      if (label) {
        historyByPeriod[label] =
          (historyByPeriod[label] || 0) + (row.total_qty_issued || 0);
      }
    });

    for (let i = 0; i < 6; i++) {
      const date = new Date(currentYear, currentMonthIndex, 1);
      date.setMonth(date.getMonth() - i);
      const monthIndex = date.getMonth();
      const year = date.getFullYear();

      if (year < currentYear) break;

      const monthName = fullMonths[monthIndex];
      const displayKey = `${monthName} ${year}`;

      if (monthIndex === currentMonthIndex && year === currentYear) {
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const { data } = await supabase
          .from("requests")
          .select("quantity_requested")
          .gte("created_at", firstDay.toISOString())
          .lte("created_at", lastDay.toISOString());
        const total = (data || []).reduce(
          (sum, row) => sum + (row.quantity_requested || 0),
          0,
        );
        monthlyData[displayKey] = total;
      } else {
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const periodLabel = `${monthName} ${firstDay.getDate()} to ${lastDay.getDate()}, ${year}`;
        monthlyData[displayKey] = historyByPeriod[periodLabel] || 0;
      }
    }

    const trendData = Object.entries(monthlyData)
      .reverse()
      .map(([month]) => {
        const [monthName] = month.split(" ");
        return { month: monthName, items: monthlyData[month] };
      });

    setMonthlyTrendData(trendData);
  };

  const fetchTopRequestedItems = async () => {
    const { data, error } = await supabase
      .from("requests")
      .select("item_no, quantity_requested, created_at, inventory(description)");
    if (error) {
      console.error("Analytics fetchTopRequestedItems error:", error);
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
          const trendValue = lastMonthValue > 0
            ? Math.round(
                ((requests - lastMonthValue) / lastMonthValue) * 100,
              )
            : 0;
          const isNew = lastMonthValue === 0;
          const isHighVolume = requests >= 10;

          return {
            name,
            requests,
            trend: trendValue,
            isNew,
            trendLabel:
              isNew ? "New" : `${trendValue > 0 ? "+" : ""}${trendValue}%`,
            advice:
              isNew
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
        value: topSixTotal > 0 ? parseFloat(((count / topSixTotal) * 100).toFixed(1)) : 0,
        count: count,
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
      .select("remaining_stock, minimum_stock");
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
      const [monthA, yearA] = a.split(" ");
      const [monthB, yearB] = b.split(" ");
      const yearDiff = parseInt(yearB) - parseInt(yearA);
      if (yearDiff !== 0) return yearDiff;
      return monthNameToIndex[monthB] - monthNameToIndex[monthA];
    });

    if (!uniqueMonths.includes(defaultMonthOption)) {
      uniqueMonths.unshift(defaultMonthOption);
    }

    setAvailableMonths(uniqueMonths);
    if (uniqueMonths.length > 0) {
      if (!uniqueMonths.includes(risMonthOption))
        setRisMonthOption(uniqueMonths[0]);
      if (!uniqueMonths.includes(ssmiMonthOption))
        setSsmiMonthOption(uniqueMonths[0]);
    }
  };

  // ── SSMI PDF ────────────────────────────────────────────────────────────
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

        // ── FETCH descriptions from inventory table ──
        const itemNos = historyItems.map((item) => item.item_no).filter(Boolean);
        const { data: inventoryDescData } = await supabase
          .from("inventory")
          .select("item_no, description")
          .in("item_no", itemNos);

        // Build lookup map: item_no → description
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
          const w1 = item.week1 || 0;
          const w2 = item.week2 || 0;
          const w3 = item.week3 || 0;
          const w4 = item.week4 || 0;
          const totalQty = item.total_qty_issued || 0;
          const stockOnHand = item.stock_on_hand || 0;
          const unitCost = item.unit_cost || 0;
          const totalCost = totalQty * unitCost;
          const balanceOnHand = stockOnHand - totalQty;

          // ── Use description from inventory table, fallback to history field ──
          const description =
            descriptionMap[item.item_no] ||
            item.item_description ||
            "";

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
        toast.error(
          `Month ${ssmiMonthOption} not found in inventory history. Please select a valid month.`,
        );
      }
    } catch (err) {
      toast.error("Failed to generate report.");
      console.error(err);
    } finally {
      setGenerating(null);
    }
  };

  // ── RIS WEEKLY PDF ──────────────────────────────────────────────────────
  const generateRISWeeklyPDF = async () => {
    setGenerating("Weekly");
    try {
      const prefix = risReportFacility === "JMS" ? "JMS" : "GYM-S";
      const [monthName, yearStr] = risMonthOption.split(" ");
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

      // ── FETCH descriptions from inventory table for all item_nos ──
      const itemNos = historyData.map((item) => item.item_no).filter(Boolean);
      const { data: inventoryDescData } = await supabase
        .from("inventory")
        .select("item_no, description")
        .in("item_no", itemNos);

      // Build lookup map: item_no → description
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

          // ── Use description from inventory table, fallback to row fields ──
          const description =
            descriptionMap[item.item_no] ||
            item.description ||
            item.item_description ||
            "";

          return [
            item.item_no || "",
            description,
            quantity,
            quantity,
            "",
          ];
        })
        .filter((row) => {
          const quantity = row[2];
          return quantity !== null && quantity !== 0 && quantity !== undefined;
        });

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
      console.error(err);
    } finally {
      setGenerating(null);
    }
  };

  // ── RIS DAILY PDF ───────────────────────────────────────────────────────
  const generateRISDailyPDF = async () => {
    setGenerating("Daily");
    try {
      const prefix = risReportFacility === "JMS" ? "JMS" : "GYM-S";
      const selectedDate = new Date(risDayOption);
      if (Number.isNaN(selectedDate.getTime())) {
        toast.error("Select a valid date for the daily RIS.");
        setGenerating(null);
        return;
      }

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: requestsData } = await supabase
        .from("requests")
        .select("item_no, quantity_requested, requested_by, inventory(description)")
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
        const itemNo = req.item_no || "";
        const requestedBy = req.requested_by || "";
        const description = req.inventory?.description || "";
        const key = `${itemNo}::${requestedBy}`;

        if (!aggregated[key]) {
          aggregated[key] = {
            item_no: itemNo,
            description,
            requested_by: requestedBy,
            quantity: 0,
          };
        }

        aggregated[key].quantity += Number(req.quantity_requested) || 0;
        if (!aggregated[key].description && description) {
          aggregated[key].description = description;
        }
      });

      const historyData = Object.values(aggregated).sort((a, b) =>
        a.item_no.localeCompare(b.item_no),
      );

      const doc = new jsPDF("portrait");
      doc.setFont("times");
      const pageWidth = doc.internal.pageSize.width;
      const monthName = fullMonths[selectedDate.getMonth()];
      const year = selectedDate.getFullYear();
      const day = selectedDate.getDate();

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
          [
            "Office : GSO",
            "Code",
            "SAI No.:",
            `Date: ${risDayOption}`,
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
        .map((item) => [
          item.item_no || "",
          item.description || "",
          item.quantity,
          item.quantity,
          item.requested_by || "",
          "",
        ])
        .filter((row) => {
          const quantity = row[2];
          return quantity !== null && quantity !== 0 && quantity !== undefined;
        });

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
      console.error(err);
    } finally {
      setGenerating(null);
    }
  };

  // ── TEST CURRENT MONTH DATA ──────────────────────────────────────────────
  const testCurrentMonthData = async () => {
    setGenerating("Test");
    try {
      const prefix = reportFacility === "JMS" ? "JMS" : "GYM-S";
      const now = new Date();
      const monthIndex = now.getMonth();
      const year = now.getFullYear();

      const { data: inventoryData } = await supabase
        .from("inventory")
        .select("item_no, description, unit_cost, remaining_stock")
        .ilike("item_no", `${prefix}%`)
        .order("item_no", { ascending: true });

      const firstDay = new Date(year, monthIndex, 1);
      const lastDay = new Date(year, monthIndex + 1, 0);
      const { data: deliveriesData } = await supabase
        .from("deliveries")
        .select("item_no, quantity_delivered, delivery_date")
        .gte("delivery_date", getLocalISODate(firstDay))
        .lte("delivery_date", getLocalISODate(lastDay));

      const { data: requestsData } = await supabase
        .from("requests")
        .select("item_no, quantity_requested, created_at")
        .gte("created_at", firstDay.toISOString())
        .lte("created_at", lastDay.toISOString());

      const deliveriesByItem: Record<string, number> = {};
      const requestsByItem: Record<string, number> = {};

      (deliveriesData || []).forEach((d) => {
        deliveriesByItem[d.item_no] =
          (deliveriesByItem[d.item_no] || 0) + d.quantity_delivered;
      });

      (requestsData || []).forEach((r) => {
        requestsByItem[r.item_no] =
          (requestsByItem[r.item_no] || 0) + r.quantity_requested;
      });

      const monthName = fullMonths[monthIndex];
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
        .text(
          "CURRENT MONTH TEST DATA - INVENTORY & DELIVERY VERIFICATION",
          pageWidth / 2,
          18,
          { align: "center" },
        );
      doc
        .setFont("times", "normal")
        .text("General Services Office", pageWidth / 2, 24, {
          align: "center",
        });
      doc
        .setFontSize(10)
        .text(`For the Period: ${fetchStart} to ${fetchEnd}`, 15, 32);
      doc.text(
        `Facility: ${reportFacility === "JMS" ? "JMS Equipments" : "GYM Equipments"}`,
        pageWidth - 15,
        32,
        { align: "right" },
      );

      const bodyData = (inventoryData || [])
        .map((item) => {
          const delivered = deliveriesByItem[item.item_no] || 0;
          const requested = requestsByItem[item.item_no] || 0;
          const stockBefore = item.remaining_stock || 0;
          const stockAfterDelivery = stockBefore + delivered;
          const stockAfterRequest = stockAfterDelivery - requested;

          return [
            item.item_no || "",
            item.description || "",
            stockBefore,
            delivered,
            stockAfterDelivery,
            requested,
            stockAfterRequest,
          ];
        })
        .filter((row) => row[3] > 0 || row[5] > 0);

      autoTable(doc, {
        head: [
          [
            {
              content: "Item No.",
              rowSpan: 2,
              styles: { valign: "middle", halign: "center" },
            },
            {
              content: "Description",
              rowSpan: 2,
              styles: { valign: "middle", halign: "center" },
            },
            {
              content: "Inventory Flow Verification",
              colSpan: 5,
              styles: { halign: "center", fontStyle: "bold" },
            },
          ],
          [
            { content: "Stock Before", styles: { halign: "center" } },
            {
              content: "Delivered (+)",
              styles: { halign: "center", fontStyle: "bold" },
            },
            {
              content: "Stock After Delivery",
              styles: { halign: "center", fontStyle: "bold" },
            },
            { content: "Requested (-)", styles: { halign: "center" } },
            { content: "Final Balance", styles: { halign: "center" } },
          ],
        ],
        body:
          bodyData.length > 0
            ? bodyData
            : [["", "No deliveries or requests found", "", "", "", "", ""]],
        startY: 36,
        theme: "grid",
        styles: {
          fontSize: 9,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        },
        headStyles: {
          fillColor: [255, 255, 255],
          halign: "center",
          valign: "middle",
          fontStyle: "bold",
          lineWidth: 0.5,
        },
        columnStyles: {
          0: { cellWidth: 24, halign: "center" },
          1: { cellWidth: 70 },
          2: { halign: "center", fontStyle: "normal" },
          3: {
            halign: "center",
            fontStyle: "bold",
            fillColor: [200, 255, 200],
          },
          4: { halign: "center", fontStyle: "bold", textColor: [0, 100, 0] },
          5: { halign: "center", fontStyle: "normal" },
          6: { halign: "center", fontStyle: "bold" },
        },
      });

      const totalDelivered = Object.values(deliveriesByItem).reduce(
        (a, b) => a + b,
        0,
      );
      const totalRequested = Object.values(requestsByItem).reduce(
        (a, b) => a + b,
        0,
      );

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        theme: "grid",
        styles: {
          fontSize: 9,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          cellPadding: 2,
        },
        body: [
          ["SUMMARY", "", ""],
          [
            "Total Items with Activity",
            Object.keys(deliveriesByItem).length +
              Object.keys(requestsByItem).length,
            "",
          ],
          [
            "Total Quantity Delivered",
            totalDelivered,
            "(Verification Function Working)",
          ],
          ["Total Quantity Requested", totalRequested, "(Deducted from Stock)"],
          ["Net Change", totalDelivered - totalRequested, ""],
        ],
        columnStyles: {
          0: { fontStyle: "bold" },
          1: { halign: "center" },
          2: { halign: "left", fontStyle: "italic" },
        },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        theme: "grid",
        styles: {
          fontSize: 8,
          font: "times",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          cellPadding: 3,
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
                "Verification Purpose:\n\nThis test validates the delivery\nfunction and inventory calculations\nfor the system.",
              styles: { halign: "left", fontStyle: "italic", fontSize: 8 },
            },
          ],
        ],
      });

      doc.save(`TEST_DATA_${reportFacility}_${monthName}_${year}.pdf`);
      toast.success("Test Data PDF Downloaded!");
    } catch (err) {
      toast.error("Failed to generate test data PDF.");
      console.error(err);
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
            onClick={() => navigate("/admin/login")}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
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

      {/* Category Detail Modal */}
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">
                Category Distribution
              </h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">
                Percentage of requests by item (click for details)
              </p>
              {categoryDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={100}
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
                      <Legend verticalAlign="bottom" align="center" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categoryDistribution.map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span>
                          {entry.fullName}: {entry.value}% ({entry.count})
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  No data available
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">
                Department Activity
              </h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">
                Requests by department
              </p>
              {departmentActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={450}>
                  <BarChart
                    data={departmentActivity}
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
                    <Tooltip />
                    <Bar dataKey="requests" fill="#8b5cf6" name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-xl font-bold text-gray-900">
              6-Month Trend Analysis
            </h3>
            <p className="text-sm text-gray-600 mt-1 mb-6">
              Items distributed over time
            </p>
            {monthlyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" />
                  <YAxis>
                    <Label
                      value="Number of Items"
                      angle={-90}
                      position="insideLeft"
                      style={{ textAnchor: "middle" }}
                    />
                  </YAxis>
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="items"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Items Distributed"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-xl font-bold text-gray-900">
              Decision Support System
            </h3>
            <p className="text-sm text-gray-600 mt-1 mb-6">
              Top requested items with trend analysis
            </p>
            {topRequestedItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topRequestedItems.map((item, index) => (
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
                        {item.isNew ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : item.trend > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {item.trendLabel}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-700">
                      <span
                        className={`flex items-center gap-1 ${
                          item.adviceType === "new"
                            ? "text-blue-600"
                            : item.adviceType === "increase"
                            ? "text-orange-600"
                            : "text-gray-500"
                        }`}
                      >
                        {item.adviceType !== "new" && item.adviceType !== "stable" ? (
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
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-white/50 outline-none"
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
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-white/50 outline-none"
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
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-white/50 outline-none"
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
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-white/50 outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={generateRISDailyPDF}
                  disabled={generating !== null}
                  className="w-full flex items-center justify-center gap-2 bg-white text-[#3776A0] py-2.5 rounded font-bold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {generating === "Daily" ? "Generating..." : "Download Daily RIS"}
                </button>
                <button
                  onClick={generateRISWeeklyPDF}
                  disabled={generating !== null}
                  className="w-full flex items-center justify-center gap-2 bg-white text-[#3776A0] py-2.5 rounded font-bold hover:bg-gray-50 transition-colors mt-3 shadow-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {generating === "Weekly" ? "Generating..." : "Download Weekly RIS"}
                </button>
              </div>

              {/* SSMI Report */}
              <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-6 flex flex-col h-full shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold text-xl text-white">
                    SSMI Report Options
                  </div>
                </div>

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
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-white/50 outline-none"
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
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-white/50 outline-none"
                    >
                      {availableMonths.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={testCurrentMonthData}
                    disabled={generating !== null}
                    className="w-full flex items-center justify-center gap-2 bg-white/30 text-white py-2.5 rounded font-bold hover:bg-white/40 transition-colors border border-white/50 text-sm disabled:opacity-50"
                  >
                    <Activity className="w-4 h-4" />
                    {generating === "Test"
                      ? "Testing..."
                      : "Test Current Month"}
                  </button>
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
      </main>
    </div>
  );
}
