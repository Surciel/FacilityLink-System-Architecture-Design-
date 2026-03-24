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

// Helper to get local date strings to prevent UTC timezone shifts
const getLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Map full month names to their index (0-11)
const monthNameToIndex: { [key: string]: number } = {
  "January": 0, "February": 1, "March": 2, "April": 3, "May": 4, "June": 5,
  "July": 6, "August": 7, "September": 8, "October": 9, "November": 10, "December": 11
};

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [reportType, setReportType] = useState<string>("weekly");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  // Chart data states
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [topRequestedItems, setTopRequestedItems] = useState<any[]>([]);
  const [departmentActivity, setDepartmentActivity] = useState<any[]>([]);

  // Stat card states
  const [totalRequestsWeek, setTotalRequestsWeek] = useState(0);
  const [itemsNeedRestock, setItemsNeedRestock] = useState(0);

  // Simplified SSMI Report Parameters
  const [reportFacility, setReportFacility] = useState<"JMS" | "GYM">("JMS");
  
  const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonth = fullMonths[new Date().getMonth()];
  const currentYearStr = new Date().getFullYear();
  const defaultMonthOption = `${currentMonth} ${currentYearStr}`;
  const [ssmiMonthOption, setSsmiMonthOption] = useState<string>(defaultMonthOption); 

  useEffect(() => {
    fetchAllData();
  }, []);

  // --- Dashboard & Chart Fetchers ---

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWeeklyRequests(),
        fetchMonthlyTrend(),
        fetchTopRequestedItems(),
        fetchDepartmentActivity(),
        fetchSummaryStats(),
      ]);
    } catch (error) {
      toast.error("Failed to load analytics data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyRequests = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data, error } = await supabase
      .from("requests")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString());
    if (error) return console.error(error);
    setTotalRequestsWeek(data?.length || 0);
  };

  const fetchMonthlyTrend = async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data, error } = await supabase
      .from("requests")
      .select("created_at, quantity_requested")
      .gte("created_at", sixMonthsAgo.toISOString());
    if (error) return console.error(error);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const grouped: Record<string, { month: string; items: number }> = {};

    (data || []).forEach((row) => {
      const month = months[new Date(row.created_at).getMonth()];
      if (!grouped[month]) grouped[month] = { month, items: 0 };
      grouped[month].items += row.quantity_requested || 0;
    });
    setMonthlyTrendData(Object.values(grouped));
  };

  const fetchTopRequestedItems = async () => {
    const { data, error } = await supabase.from("requests").select("description, quantity_requested, created_at");
    if (error) return console.error(error);

    const now = new Date();
    const thisMonth = now.getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;

    const thisMonthCounts: Record<string, number> = {};
    const lastMonthCounts: Record<string, number> = {};

    (data || []).forEach((row) => {
      const month = new Date(row.created_at).getMonth();
      const name = row.description || "Unknown";
      if (month === thisMonth) thisMonthCounts[name] = (thisMonthCounts[name] || 0) + 1;
      if (month === lastMonth) lastMonthCounts[name] = (lastMonthCounts[name] || 0) + 1;
    });

    const result = Object.entries(thisMonthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, requests]) => {
        const prev = lastMonthCounts[name] || 0;
        const trend = prev > 0 ? Math.round(((requests - prev) / prev) * 100) : 0;
        return { name, requests, trend };
      });

    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
    const total = Object.values(thisMonthCounts).reduce((a, b) => a + b, 0);
    const catResult = Object.entries(thisMonthCounts)
      .slice(0, 6)
      .map(([name, count], i) => ({
        name,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
        color: colors[i % colors.length],
      }));

    setTopRequestedItems(result);
    setCategoryDistribution(catResult);
  };

  const fetchDepartmentActivity = async () => {
    const { data, error } = await supabase.from("requests").select("department");
    if (error) return console.error(error);

    const grouped: Record<string, number> = {};
    (data || []).forEach((row) => {
      if (row.department) {
        grouped[row.department] = (grouped[row.department] || 0) + 1;
      }
    });

    const result = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([dept, requests]) => ({ dept, requests }));
    setDepartmentActivity(result);
  };

  const fetchSummaryStats = async () => {
    const { count } = await supabase
      .from("inventory")
      .select("*", { count: "exact", head: true })
      .eq("remaining_stock", 0);
    setItemsNeedRestock(count || 0);
  };

  const getMonthOptions = () => {
    const options = [];
    const targetYear = 2026; 
    for (const month of fullMonths) {
      options.push(`${month} ${targetYear}`);
    }
    return options;
  };

  // --- PDF GENERATION FUNCTIONS ---

  const generateRISWeeklyPDF = async () => {
    setGenerating("Weekly");
    try {
      const now = new Date();
      
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + distanceToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const fetchStart = getLocalISODate(monday);
      const fetchEnd = getLocalISODate(sunday);

      const { data: requests, error } = await supabase
        .from("requests")
        .select("*")
        .gte("created_at", `${fetchStart}T00:00:00`)
        .lte("created_at", `${fetchEnd}T23:59:59`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!requests || requests.length === 0) {
        toast.error("No requests found for the current week.");
        setGenerating(null);
        return;
      }

      const doc = new jsPDF("portrait");
      doc.setFont("times"); 
      const pageWidth = doc.internal.pageSize.width;

      doc.setFontSize(9);
      doc.text("Republic of the Philippines", pageWidth / 2, 15, { align: "center" });
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.text("PAMANTASAN NG LUNGSOD NG MAYNILA", pageWidth / 2, 20, { align: "center" });
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      doc.text("(University of the City of Manila)", pageWidth / 2, 24, { align: "center" });
      doc.text("Intramuros, Manila", pageWidth / 2, 28, { align: "center" });
      
      doc.setFont("times", "bold");
      doc.text("GYMNASIUM MANAGEMENT SECTION", pageWidth / 2, 34, { align: "center" });
      
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text("REQUISITION AND ISSUE SLIP", pageWidth / 2, 42, { align: "center" });

      const monthName = monday.toLocaleString('default', { month: 'long' }).toUpperCase();
      const daysStr = `${String(monday.getDate()).padStart(2, '0')} to ${String(sunday.getDate()).padStart(2, '0')}`;
      const risNo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-001`;

      const metaBody = [
        ["Division :", "Responsibility Center", `RIS No.: ${risNo}`, monthName],
        ["Office : GSO", "Code", "SAI No.:", daysStr],
      ];

      autoTable(doc, {
        body: metaBody,
        startY: 48,
        theme: "plain",
        styles: { 
          fontSize: 9, 
          cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, 
          textColor: [0, 0, 0], 
          lineColor: [0, 0, 0], 
          lineWidth: 0.1, 
          fontStyle: "bold", 
          font: "times" 
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 50 },
          2: { cellWidth: 65 },
          3: { cellWidth: 30, halign: "center", fontStyle: "normal" },
        },
      });

      const metaFinalY = (doc as any).lastAutoTable.finalY;

      const tableHeaders: any[] = [
        [
          { content: "Stock\nNo.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
          { content: "Unit", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
          { content: "Requisition", colSpan: 2, styles: { halign: "center" } },
          { content: "Issuance", colSpan: 2, styles: { halign: "center" } },
        ],
        [
          { content: "Description", styles: { halign: "center" } },
          { content: "Quantity", styles: { halign: "center" } },
          { content: "Quantity", styles: { halign: "center" } },
          { content: "Remarks", styles: { halign: "center" } },
        ]
      ];

      const bodyData = (requests || []).map((req) => [
        req.item_no || "",
        req.unit || "",
        req.description || "",
        req.quantity_requested,
        req.quantity_requested, 
        "", 
      ]);

      while (bodyData.length < 18) {
        bodyData.push(["", "", "", "", "", ""]);
      }

      autoTable(doc, {
        head: tableHeaders,
        body: bodyData,
        startY: metaFinalY,
        theme: "grid",
        styles: { 
          fontSize: 8, 
          cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, 
          textColor: [0, 0, 0], 
          lineColor: [0, 0, 0], 
          lineWidth: 0.1, 
          font: "times" 
        },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 25, halign: "center" },
          1: { cellWidth: 15, halign: "center" },
          2: { cellWidth: 70 }, 
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 20, halign: "center" },
          5: { cellWidth: 30 },
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY;

      const footerBody: any[] = [
        [
          { content: "", styles: { lineWidth: 0 } },
          { content: "Requested by:", styles: { fontStyle: "italic", halign: "center", font: "times" } },
          { content: "Approved by:", styles: { fontStyle: "italic", halign: "center", font: "times" } },
          { content: "Issued by:", styles: { fontStyle: "italic", halign: "center", font: "times" } },
          { content: "Received by:", styles: { fontStyle: "italic", halign: "center", font: "times" } }
        ],
        [
          { content: "Signature :", styles: { fontStyle: "italic", font: "times" } }, "", "", "", ""
        ],
        [
          { content: "Printed Name :", styles: { fontStyle: "italic", font: "times" } },
          { content: "UTILITY WORKERS", styles: { halign: "center", fontStyle: "bold", font: "times" } },
          { content: "EMILY E. ESPERO", styles: { halign: "center", fontStyle: "bold", font: "times" } },
          { content: "GRACIANO MONTIADORA", styles: { halign: "center", fontStyle: "bold", font: "times" } },
          { content: "UTILITY WORKERS", styles: { halign: "center", fontStyle: "bold", font: "times" } }
        ],
        [
          { content: "Designation :", styles: { fontStyle: "italic", font: "times" } },
          { content: "GSO", styles: { fontStyle: "italic", halign: "center", font: "times" } },
          { content: "Chief, GSO", styles: { fontStyle: "italic", halign: "center", font: "times" } },
          { content: "STOREKEEPER", styles: { fontStyle: "italic", halign: "center", font: "times" } },
          { content: "GSO", styles: { fontStyle: "italic", halign: "center", font: "times" } }
        ],
        [
          { content: "Date :", styles: { fontStyle: "italic", font: "times" } }, "", "", "", ""
        ]
      ];

      autoTable(doc, {
        body: footerBody,
        startY: finalY,
        theme: "grid",
        styles: { 
          fontSize: 8, 
          cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, 
          textColor: [0, 0, 0], 
          lineColor: [0, 0, 0], 
          lineWidth: 0.1, 
          font: "times" 
        },
        columnStyles: {
          0: { cellWidth: 25 }, 
          1: { cellWidth: 38 },
          2: { cellWidth: 40 },
          3: { cellWidth: 42 },
          4: { cellWidth: 35 },
        },
      });

      doc.save(`RIS_Weekly_${fetchStart}.pdf`);
      toast.success(`Weekly Report Downloaded!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate weekly report.");
    } finally {
      setGenerating(null);
    }
  };

  const generateSSMIPDF = async () => {
    setGenerating("SSMI");
    const prefix = reportFacility === "JMS" ? "JMS" : "GYM-S";
    
    try {
      const [fullMonthName, yearStr] = ssmiMonthOption.split(' ');
      const monthIndex = monthNameToIndex[fullMonthName];
      const yearVal = parseInt(yearStr);

      const firstDayOfMonth = new Date(yearVal, monthIndex, 1);
      const lastDayOfMonth = new Date(yearVal, monthIndex + 1, 0);
      const fetchStart = getLocalISODate(firstDayOfMonth);
      const fetchEnd = getLocalISODate(lastDayOfMonth);

      const { data: allRequests, error: reqError } = await supabase
        .from("requests")
        .select("*")
        .gte("created_at", `${fetchStart}T00:00:00`)
        .lte("created_at", `${fetchEnd}T23:59:59`)
        .ilike("item_no", `${prefix}%`);
        
      if (reqError) throw reqError;

      const { data: inventoryItems, error: invError } = await supabase
        .from("inventory")
        .select("*")
        .ilike("item_no", `${prefix}%`)
        .order('item_no', { ascending: true });
        
      if (invError) throw invError;
      if (!inventoryItems || inventoryItems.length === 0) {
        toast.error(`No inventory items found for ${reportFacility} in ${ssmiMonthOption}`);
        setGenerating(null);
        return;
      }

      const requestStats: Record<string, { w1: number; w2: number; w3: number; w4: number; totalQty: number }> = {};
      
      (allRequests || []).forEach((req) => {
        const reqDate = new Date(req.created_at);
        const day = reqDate.getDate();
        
        if (!requestStats[req.item_no]) {
          requestStats[req.item_no] = { w1: 0, w2: 0, w3: 0, w4: 0, totalQty: 0 };
        }

        if (day <= 8) requestStats[req.item_no].w1 += req.quantity_requested;
        else if (day <= 15) requestStats[req.item_no].w2 += req.quantity_requested;
        else if (day <= 22) requestStats[req.item_no].w3 += req.quantity_requested;
        else requestStats[req.item_no].w4 += req.quantity_requested;

        requestStats[req.item_no].totalQty += req.quantity_requested;
      });

      let grandTotalCost = 0;
      const bodyData = inventoryItems.map((item) => {
        const stats = requestStats[item.item_no] || { w1: 0, w2: 0, w3: 0, w4: 0, totalQty: 0 };
        const unitCost = item.unit_cost || 0; 
        const totalCost = stats.totalQty * unitCost;
        grandTotalCost += totalCost;
        
        const startingStock = item.remaining_stock + stats.totalQty;
        const balanceOnHand = item.remaining_stock; 

        return [
          item.item_no || "",
          item.description || "",
          item.unit || "",
          startingStock,
          stats.w1 > 0 ? stats.w1 : "",
          stats.w2 > 0 ? stats.w2 : "",
          stats.w3 > 0 ? stats.w3 : "",
          stats.w4 > 0 ? stats.w4 : "",
          "", 
          stats.totalQty > 0 ? stats.totalQty : 0,
          unitCost > 0 ? unitCost.toFixed(2) : "",
          balanceOnHand, // Shifted to column index 11 since we dropped Total Cost
        ];
      });

      const doc = new jsPDF("landscape");
      doc.setFont("times"); 
      const pageWidth = doc.internal.pageSize.width;

      doc.setFontSize(12);
      doc.text("Pamantasan ng Lungsod ng Maynila", pageWidth / 2, 12, { align: "center" });
      doc.setFontSize(11);
      doc.setFont("times", "bold");
      doc.text("SUMMARY OF SUPPLIES AND MATERIALS ISSUED", pageWidth / 2, 18, { align: "center" });
      doc.setFont("times", "normal");
      doc.text("General Services Office", pageWidth / 2, 24, { align: "center" });
      
      doc.setFontSize(10);
      doc.text(`For the Period: ${fetchStart} to ${fetchEnd}`, 15, 32);
      doc.text(`No. GS0${prefix}-${yearStr}-02`, pageWidth - 15, 32, { align: "right" });

      const monthAbbr = lastDayOfMonth.toLocaleString('default', { month: 'short' }).toUpperCase();
      const lastDay = lastDayOfMonth.getDate();

      const tableHeaders: any[] = [
        [
          { content: "Item\nNo.", rowSpan: 3, styles: { valign: "middle", halign: "center" } },
          { content: "Item\nDescription", rowSpan: 3, styles: { valign: "middle", halign: "center" } },
          { content: "Unit\nof\nMea.", rowSpan: 3, styles: { valign: "middle", halign: "center" } },
          { content: "Stock on\nHand", rowSpan: 3, styles: { valign: "middle", halign: "center" } },
          {
            content: "Requisition and Issue Slip Numbers Used for Other\nSupplies Quantity Issued",
            colSpan: 5,
            styles: { halign: "center", fontStyle: "bold" },
          },
          { content: "Total Qty\nIssued", rowSpan: 3, styles: { valign: "middle", halign: "center" } },
          { content: "Unit Cost\n(PhP)", rowSpan: 3, styles: { valign: "middle", halign: "center" } },
          { content: "Balance on\nHand", rowSpan: 3, styles: { valign: "middle", halign: "center" } },
        ],
        [
          { content: `1-8 ${monthAbbr}`, styles: { halign: "center" } },
          { content: `9-15 ${monthAbbr}`, styles: { halign: "center" } },
          { content: `16-22 ${monthAbbr}`, styles: { halign: "center" } },
          { content: `23-${lastDay} ${monthAbbr}`, styles: { halign: "center" } },
          { content: "DELIVERY", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        ],
        [
          { content: "1", styles: { halign: "center", fontStyle: "bold" } },
          { content: "2", styles: { halign: "center", fontStyle: "bold" } },
          { content: "3", styles: { halign: "center", fontStyle: "bold" } },
          { content: "4", styles: { halign: "center", fontStyle: "bold" } },
        ]
      ];

      autoTable(doc, {
        head: tableHeaders,
        body: bodyData,
        foot: [
          [
            { 
              content: `TOTAL AMOUNT ${" . ".repeat(120)}`, 
              colSpan: 11, // Spanning Item No to Unit Cost
              styles: { 
                halign: "left", 
                fontStyle: "bold", 
                overflow: "hidden", // Keeps the dots from breaking layout
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
              } 
            },
            {
              content: grandTotalCost.toFixed(2),
              colSpan: 1, // Final column for the Grand Total value
              styles: {
                halign: "center",
                fontStyle: "bold",
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
              }
            }
          ]
        ],
        startY: 36,
        theme: "plain",
        styles: {
          fontSize: 8,
          cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 }, 
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
          textColor: [0, 0, 0],
          font: "times"
        },
        headStyles: {
          fillColor: [255, 255, 255],
          halign: "center",
          valign: "middle",
          fontStyle: "bold",
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
          font: "times",
        },
        columnStyles: {
          0: { cellWidth: 16, halign: "center" }, 
          1: { cellWidth: 90 }, 
          2: { cellWidth: 10, halign: "center" },
          3: { cellWidth: 12, halign: "center" },
          4: { cellWidth: 14, halign: "center" },
          5: { cellWidth: 14, halign: "center" },
          6: { cellWidth: 14, halign: "center" },
          7: { cellWidth: 14, halign: "center" },
          8: { cellWidth: 20, halign: "center" }, 
          9: { cellWidth: 14, halign: "center" },
          10: { cellWidth: 16, halign: "right" },
          11: { cellWidth: 28, halign: "center" }, 
        },
      });

      // ---- Perfectly Aligned Boxed Signatures ----
      const finalY = (doc as any).lastAutoTable.finalY; // NO GAP
      const marginX = 14; // Default autoTable margin is exactly 14mm
      const tableWidth = pageWidth - (marginX * 2);
      const colWidth = tableWidth / 3;

      doc.setFontSize(9);
      
      // Bottom border for the entire signature block
      doc.line(marginX, finalY + 30, pageWidth - marginX, finalY + 30);

      // Vertical lines to create the boxes perfectly aligned with the table margins
      doc.line(marginX, finalY, marginX, finalY + 30); // Left outer
      doc.line(pageWidth - marginX, finalY, pageWidth - marginX, finalY + 30); // Right outer
      doc.line(marginX + colWidth, finalY, marginX + colWidth, finalY + 30); // Inner divider 1
      doc.line(marginX + colWidth * 2, finalY, marginX + colWidth * 2, finalY + 30); // Inner divider 2

      // Left-aligned Labels hugging the walls of their boxes
      const labelPadding = 2;
      doc.text("Prepared by:", marginX + labelPadding, finalY + 5);
      doc.text("Noted by:", marginX + colWidth + labelPadding, finalY + 5);
      doc.text("Posted in the SLC by:", marginX + colWidth * 2 + labelPadding, finalY + 5);

      // Centers calculated for name/designation alignment
      const box1Center = marginX + (colWidth / 2);
      const box2Center = marginX + colWidth + (colWidth / 2);
      const box3Center = marginX + (colWidth * 2) + (colWidth / 2);

      const namePaddingTop = 15;
      const linePaddingTop = 16;
      const lineWidth = 60; // 60mm signature line

      // Box 1 (Prepared by)
      doc.setFont("times", "bold");
      doc.text("GRACIANO B. MONTIADORA", box1Center, finalY + namePaddingTop, { align: "center" });
      doc.setFont("times", "normal");
      doc.line(box1Center - (lineWidth / 2), finalY + linePaddingTop, box1Center + (lineWidth / 2), finalY + linePaddingTop); 
      doc.text("Store keeper I", box1Center, finalY + namePaddingTop + 5, { align: "center" });

      // Box 2 (Noted by)
      doc.setFont("times", "bold");
      doc.text("EMILY E. ESPERO", box2Center, finalY + namePaddingTop, { align: "center" });
      doc.setFont("times", "normal");
      doc.line(box2Center - (lineWidth / 2), finalY + linePaddingTop, box2Center + (lineWidth / 2), finalY + linePaddingTop); 
      doc.text("Chief, GSO", box2Center, finalY + namePaddingTop + 5, { align: "center" });

      // Box 3 (Posted by)
      doc.setFont("times", "bold");
      doc.text("MA.ELVIRA B. SALAMAT", box3Center, finalY + namePaddingTop, { align: "center" });
      doc.setFont("times", "normal");
      doc.line(box3Center - (lineWidth / 2), finalY + linePaddingTop, box3Center + (lineWidth / 2), finalY + linePaddingTop); 
      doc.text("Administrative Assistant I", box3Center, finalY + namePaddingTop + 5, { align: "center" });

      const fetchStartOption = ssmiMonthOption.split(' ').join('_');
      doc.save(`SSMI_${reportFacility}_${fetchStartOption}.pdf`);
      toast.success("SSMI Report Downloaded!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate report.");
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

  const handleLogout = () => navigate("/admin/login");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
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
            const active = item.path === "/admin/analytics";
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
      <main className={`pt-16 transition-all duration-300 ${isSidebarExpanded || isSidebarPinned ? "pl-64" : "pl-20"}`}>
        <div className="p-4 lg:p-8">
          <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
                <p className="text-gray-600 mt-1">Insights and trends from your inventory data</p>
              </div>
            </div>

            {/* Key Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-8 h-8 opacity-80" />
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="text-3xl font-bold">{loading ? "..." : totalRequestsWeek}</div>
                <div className="text-sm opacity-90 mt-1">Total Requests (Week)</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-8 h-8 opacity-80" />
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div className="text-3xl font-bold">{loading ? "..." : itemsNeedRestock}</div>
                <div className="text-sm opacity-90 mt-1">Items Need Restock</div>
              </div>
            </div>

            {/* Pie Chart Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">Category Distribution</h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">Percentage of requests by item</p>
              {categoryDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={categoryDistribution} cx="50%" cy="50%" labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`} outerRadius={100} dataKey="value">
                      {categoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">No data available</div>
              )}
            </div>

            {/* Separated Bar Chart Row */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">Department Activity</h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">Requests by department</p>
              {departmentActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentActivity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" />
                    <YAxis dataKey="dept" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="requests" fill="#8b5cf6" name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">No data available</div>
              )}
            </div>

            {/* Charts Row 2 - 6-Month Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">6-Month Trend Analysis</h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">Items distributed over time</p>
              {monthlyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" />
                    <YAxis>
                      <Label value="Number of Items" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="items" stroke="#3b82f6" strokeWidth={2} name="Items Distributed" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">No data available</div>
              )}
            </div>

            {/* DSS - Top Requested Items */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900">Decision Support System</h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">Top requested items with trend analysis</p>
              {topRequestedItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topRequestedItems.map((item, index) => (
                    <div key={index} className="p-4 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                          <div className="text-2xl font-bold text-[#4A89B0] mt-1">{item.requests}</div>
                          <div className="text-xs text-gray-600">requests this month</div>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${
                          item.trend > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {item.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(item.trend)}%
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-700">
                        {item.trend > 0 ? (
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-orange-500" />
                            Consider increasing stock
                          </span>
                        ) : (
                          <span className="text-gray-500">Demand stable or decreasing</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex items-center justify-center text-gray-400">No trend data available</div>
              )}
            </div>

            {/* Report Generation Section */}
            <div className="bg-gradient-to-br from-[#5891B8] via-[#4A89B0] to-[#3776A0] rounded-xl shadow-sm p-8 text-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Generate Reports</h3>
                  <p className="text-white/80 mb-4">Download your automated inventory reports in PDF format</p>
                </div>
                <Download className="w-16 h-16 opacity-50 hidden md:block" />
              </div>

              {/* Reduced to grid-cols-2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                
                <button 
                  onClick={generateRISWeeklyPDF} 
                  disabled={generating !== null}
                  className="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 rounded-lg p-6 text-left transition-all disabled:opacity-50 flex flex-col h-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg"><Calendar className="w-5 h-5" /></div>
                        <div className="font-semibold text-lg">RIS Weekly</div>
                      </div>
                      {generating === "Weekly" && <span className="text-xs bg-white/30 px-2 py-1 rounded animate-pulse">Loading...</span>}
                    </div>
                    <div className="text-sm text-white/80">Requisition and Issue Slip generated for the current week</div>
                  </div>
                </button>

                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-6 flex flex-col transition-all h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-white/20 p-2 rounded-lg"><Package className="w-5 h-5" /></div>
                    <div className="font-semibold text-lg">SSMI Report Options</div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">Facility Equipment</label>
                      <select
                        value={reportFacility}
                        onChange={(e) => setReportFacility(e.target.value as "JMS" | "GYM")}
                        className="w-full px-3 py-2 border-0 rounded-lg focus:ring-2 focus:ring-white bg-white/90 text-gray-900 text-sm cursor-pointer"
                      >
                        <option value="JMS">JMS Equipments</option>
                        <option value="GYM">GYM Equipments</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">Month Target</label>
                      <select
                        value={ssmiMonthOption}
                        onChange={(e) => setSsmiMonthOption(e.target.value)}
                        className="w-full px-3 py-2 border-0 rounded-lg focus:ring-2 focus:ring-white bg-white/90 text-gray-900 text-sm cursor-pointer"
                      >
                        {getMonthOptions().map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <button 
                    onClick={generateSSMIPDF} 
                    disabled={generating !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#3776A0] font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 mt-auto"
                  >
                    <Download className="w-4 h-4 flex-shrink-0" />
                    {generating === "SSMI" ? "Generating..." : "Download PDF"}
                  </button>
                  <div className="text-xs text-white/80 mt-3">Stock Status and Management Inventory based on selection</div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}