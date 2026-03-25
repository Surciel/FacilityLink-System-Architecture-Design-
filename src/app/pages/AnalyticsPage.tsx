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

const getLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [topRequestedItems, setTopRequestedItems] = useState<any[]>([]);
  const [departmentActivity, setDepartmentActivity] = useState<any[]>([]);
  const [totalRequestsWeek, setTotalRequestsWeek] = useState(0);
  const [itemsNeedRestock, setItemsNeedRestock] = useState(0);

  const [reportFacility, setReportFacility] = useState<"JMS" | "GYM">("JMS");
  
  const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonth = fullMonths[new Date().getMonth()];
  const currentYearStr = new Date().getFullYear();
  const defaultMonthOption = `${currentMonth} ${currentYearStr}`;
  const [ssmiMonthOption, setSsmiMonthOption] = useState<string>(defaultMonthOption); 

  useEffect(() => {
    fetchAllData();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyRequests = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data } = await supabase.from("requests").select("created_at").gte("created_at", sevenDaysAgo.toISOString());
    setTotalRequestsWeek(data?.length || 0);
  };

  const fetchMonthlyTrend = async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data } = await supabase.from("requests").select("created_at, quantity_requested").gte("created_at", sixMonthsAgo.toISOString());
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const grouped: Record<string, any> = {};
    (data || []).forEach((row) => {
      const month = months[new Date(row.created_at).getMonth()];
      if (!grouped[month]) grouped[month] = { month, items: 0 };
      grouped[month].items += row.quantity_requested || 0;
    });
    setMonthlyTrendData(Object.values(grouped));
  };

  const fetchTopRequestedItems = async () => {
    const { data } = await supabase.from("requests").select("description, quantity_requested, created_at");
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

    setTopRequestedItems(Object.entries(thisMonthCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, requests]) => ({
      name, requests, trend: lastMonthCounts[name] > 0 ? Math.round(((requests - lastMonthCounts[name]) / lastMonthCounts[name]) * 100) : 0
    })));

    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
    const total = Object.values(thisMonthCounts).reduce((a, b) => a + b, 0);
    setCategoryDistribution(Object.entries(thisMonthCounts).slice(0, 6).map(([name, count], i) => ({
      name, value: total > 0 ? Math.round((count / total) * 100) : 0, color: colors[i % colors.length]
    })));
  };

  const fetchDepartmentActivity = async () => {
    const { data } = await supabase.from("requests").select("department");
    const grouped: Record<string, number> = {};
    (data || []).forEach((row) => { if (row.department) grouped[row.department] = (grouped[row.department] || 0) + 1; });
    setDepartmentActivity(Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([dept, requests]) => ({ dept, requests })));
  };

  const fetchSummaryStats = async () => {
    const { count } = await supabase.from("inventory").select("*", { count: "exact", head: true }).eq("remaining_stock", 0);
    setItemsNeedRestock(count || 0);
  };

  const getMonthOptions = () => fullMonths.map(month => `${month} 2026`);

  // --- PDF GENERATION ---

  const generateSSMIPDF = async () => {
    setGenerating("SSMI");
    const prefix = reportFacility === "JMS" ? "JMS" : "GYM-S";
    
    try {
      const [fullMonthName, yearStr] = ssmiMonthOption.split(' ');
      const monthIndex = monthNameToIndex[fullMonthName];
      const yearVal = parseInt(yearStr);
      const firstDay = new Date(yearVal, monthIndex, 1);
      const lastDay = new Date(yearVal, monthIndex + 1, 0);
      const fetchStart = getLocalISODate(firstDay);
      const fetchEnd = getLocalISODate(lastDay);

      const { data: allRequests } = await supabase.from("requests").select("*").gte("created_at", `${fetchStart}T00:00:00`).lte("created_at", `${fetchEnd}T23:59:59`).ilike("item_no", `${prefix}%`);
      const { data: inventoryItems } = await supabase.from("inventory").select("*").ilike("item_no", `${prefix}%`).order('item_no', { ascending: true });
        
      if (!inventoryItems || inventoryItems.length === 0) {
        toast.error(`No items found for ${reportFacility}`);
        setGenerating(null);
        return;
      }

      const requestStats: Record<string, any> = {};
      (allRequests || []).forEach((req) => {
        const d = new Date(req.created_at).getDate();
        if (!requestStats[req.item_no]) requestStats[req.item_no] = { w1: 0, w2: 0, w3: 0, w4: 0, totalQty: 0 };
        if (d <= 8) requestStats[req.item_no].w1 += req.quantity_requested;
        else if (d <= 15) requestStats[req.item_no].w2 += req.quantity_requested;
        else if (d <= 22) requestStats[req.item_no].w3 += req.quantity_requested;
        else requestStats[req.item_no].w4 += req.quantity_requested;
        requestStats[req.item_no].totalQty += req.quantity_requested;
      });

      const bodyData = inventoryItems.map((item) => {
        const stats = requestStats[item.item_no] || { w1: 0, w2: 0, w3: 0, w4: 0, totalQty: 0 };
        const unitCost = item.unit_cost || 0;
        const totalCost = stats.totalQty * unitCost;
        
        return [
          item.item_no || "", 
          item.description || "", 
          item.unit || "", 
          item.remaining_stock + stats.totalQty, 
          stats.w1 || "", 
          stats.w2 || "", 
          stats.w3 || "", 
          stats.w4 || "", 
          "", 
          stats.totalQty || 0, 
          unitCost > 0 ? unitCost.toFixed(2) : "", 
          totalCost > 0 ? totalCost.toFixed(2) : "", 
          item.remaining_stock
        ];
      });

      const doc = new jsPDF("landscape");
      doc.setFont("times");
      const pageWidth = doc.internal.pageSize.width;

      doc.setFontSize(12).text("Pamantasan ng Lungsod ng Maynila", pageWidth / 2, 12, { align: "center" });
      doc.setFont("times", "bold").setFontSize(11).text("SUMMARY OF SUPPLIES AND MATERIALS ISSUED", pageWidth / 2, 18, { align: "center" });
      doc.setFont("times", "normal").text("General Services Office", pageWidth / 2, 24, { align: "center" });
      doc.setFontSize(10).text(`For the Period: ${fetchStart} to ${fetchEnd}`, 15, 32);
      doc.text(`No. GS0${prefix}-${yearStr}-02`, pageWidth - 15, 32, { align: "right" });

      const m = lastDay.toLocaleString('default', { month: 'short' }).toUpperCase();

      // Main Table Config
      autoTable(doc, {
        head: [
          [
            { content: "Item No.", rowSpan: 3 }, 
            { content: "Item Description", rowSpan: 3 }, 
            { content: "Unit", rowSpan: 3 }, 
            { content: "Stock Hand", rowSpan: 3 }, 
            { content: "Requisition and Issue Slip Numbers Used for Other Supplies Quantity Issued", colSpan: 5 }, 
            { content: "Total Qty Issued", rowSpan: 3 }, 
            { content: "Unit Cost\n(PhP)", rowSpan: 3 }, 
            { content: "Total Cost\n(PhP)", rowSpan: 3 }, 
            { content: "Balance on\nHand", rowSpan: 3 }
          ],
          [
            { content: `1-8 ${m}` }, 
            { content: `9-15 ${m}` }, 
            { content: `16-22 ${m}` }, 
            { content: `23-${lastDay.getDate()} ${m}` }, 
            { content: "DELIVERY", rowSpan: 2 }
          ],
          ["1", "2", "3", "4"]
        ],
        body: bodyData,
        // Single unified row for TOTAL AMOUNT
        foot: [
          [
            { 
              content: `TOTAL AMOUNT ${" . ".repeat(180)}`, 
              colSpan: 13, 
              styles: { 
                halign: 'left', 
                fontStyle: 'bold',
                overflow: 'hidden', 
                fillColor: [255, 255, 255], 
                textColor: [0, 0, 0], 
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
              } 
            }
          ]
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
          cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 } 
        },
        headStyles: { fillColor: [255, 255, 255], halign: 'center', valign: 'middle', fontStyle: 'bold' },
        columnStyles: { 
          0: { cellWidth: 24, halign: 'center' }, 
          1: { cellWidth: 62 }, 
          2: { halign: 'center' }, 
          3: { halign: 'center' }, 
          4: { halign: 'center' }, 
          5: { halign: 'center' }, 
          6: { halign: 'center' }, 
          7: { halign: 'center' }, 
          8: { halign: 'center' }, 
          9: { halign: 'center' }, 
          10: { halign: 'right' }, 
          11: { halign: 'right' }, 
          12: { cellWidth: 25, halign: 'center' } 
        }
      });

      // ---- Perfectly Sealed Signature Block ----
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY,
        theme: "grid",
        styles: { 
          fontSize: 9, 
          font: "times", 
          lineColor: [0, 0, 0], 
          lineWidth: 0.1, 
          textColor: [0, 0, 0], 
          cellPadding: 4 
        },
        body: [
          [
            { content: "Prepared by:\n\n\nGRACIANO B. MONTIADORA\nStore keeper I", styles: { halign: 'left' } },
            { content: "Noted by:\n\n\nEMILY E. ESPERO\nChief, GSO", styles: { halign: 'left' } },
            { content: "Posted in the SLC by:\n\n\nMA. ELVIRA B. SALAMAT\nAdministrative Assistant I", styles: { halign: 'left' } }
          ]
        ],
      });

      doc.save(`SSMI_${reportFacility}_${ssmiMonthOption.replace(' ', '_')}.pdf`);
      toast.success("SSMI Report Downloaded!");
    } catch (err) { 
      toast.error("Failed to generate report."); 
    } finally { 
      setGenerating(null); 
    }
  };

  const generateRISWeeklyPDF = async () => {
    setGenerating("Weekly");
    try {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const fetchStart = getLocalISODate(monday);
      const fetchEnd = getLocalISODate(sunday);

      const { data: requests } = await supabase.from("requests").select("*").gte("created_at", `${fetchStart}T00:00:00`).lte("created_at", `${fetchEnd}T23:59:59`);
      if (!requests || requests.length === 0) {
        toast.error("No requests found for the current week.");
        setGenerating(null);
        return;
      }

      const doc = new jsPDF("portrait");
      doc.setFont("times");
      const pageWidth = doc.internal.pageSize.width;

      doc.setFontSize(9).text("Republic of the Philippines", pageWidth / 2, 15, { align: "center" });
      doc.setFont("times", "bold").setFontSize(10).text("PAMANTASAN NG LUNGSOD NG MAYNILA", pageWidth / 2, 20, { align: "center" });
      doc.setFont("times", "normal").setFontSize(9).text("(University of the City of Manila)\nIntramuros, Manila", pageWidth / 2, 24, { align: "center" });
      doc.setFont("times", "bold").text("GYMNASIUM MANAGEMENT SECTION", pageWidth / 2, 34, { align: "center" });
      doc.setFontSize(14).text("REQUISITION AND ISSUE SLIP", pageWidth / 2, 42, { align: "center" });

      autoTable(doc, {
        body: [
          ["Division :", "Responsibility Center", `RIS No.: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-001`, monday.toLocaleString('default', { month: 'long' }).toUpperCase()],
          ["Office : GSO", "Code", "SAI No.:", `${String(monday.getDate()).padStart(2, '0')} to ${String(sunday.getDate()).padStart(2, '0')}`],
        ],
        startY: 48, theme: "plain", styles: { fontSize: 9, font: "times", textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, fontStyle: "bold", cellPadding: 1.5 },
        // Removed the hardcoded width on column 2 (the RIS/SAI col) so it dynamically stretches to align properly
        columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 50 }, 3: { cellWidth: 30, halign: "center", fontStyle: "normal" } },
      });

      const bodyData = requests.map(req => [req.item_no || "", req.unit || "", req.description || "", req.quantity_requested, req.quantity_requested, ""]);
      while (bodyData.length < 15) bodyData.push(["", "", "", "", "", ""]);

      autoTable(doc, {
        head: [[{ content: "Stock No.", rowSpan: 2 }, { content: "Unit", rowSpan: 2 }, { content: "Requisition", colSpan: 2 }, { content: "Issuance", colSpan: 2 }], ["Description", "Quantity", "Quantity", "Remarks"]],
        body: bodyData,
        startY: (doc as any).lastAutoTable.finalY, theme: "grid", styles: { fontSize: 8, font: "times", lineColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 1.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: 'center' },
        columnStyles: { 0: { cellWidth: 25, halign: 'center' }, 1: { cellWidth: 15, halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } }
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY, theme: "grid", styles: { fontSize: 8, font: "times", lineColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 1.5, textColor: [0, 0, 0] },
        body: [
          ["", "Requested by:", "Approved by:", "Issued by:", "Received by:"],
          ["Signature:", "", "", "", ""],
          ["Printed Name:", "UTILITY WORKERS", "EMILY E. ESPERO", "GRACIANO MONTIADORA", "UTILITY WORKERS"],
          ["Designation:", "GSO", "Chief, GSO", "STOREKEEPER", "GSO"],
          ["Date:", "", "", "", ""]
        ],
        columnStyles: { 0: { fontStyle: 'italic', cellWidth: 25 } }
      });

      doc.save(`RIS_Weekly_${fetchStart}.pdf`);
      toast.success("Weekly Report Downloaded!");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="bg-[#4A89B0] p-2 rounded-lg"><PackageOpen className="w-6 h-6 text-white" /></div>
            <h1 className="font-bold text-gray-900 hidden sm:block">FacilityLink: Centralized Inventory System</h1>
          </div>
          <button onClick={() => navigate("/admin/login")} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">
            <LogOut className="w-5 h-5" /><span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <aside className={`fixed top-16 left-0 bottom-0 bg-white shadow-lg transition-all duration-300 z-20 ${isSidebarExpanded || isSidebarPinned ? "w-64" : "w-20"}`}
        onMouseEnter={() => !isSidebarPinned && setIsSidebarExpanded(true)} onMouseLeave={() => !isSidebarPinned && setIsSidebarExpanded(false)}>
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${item.path === "/admin/analytics" ? "bg-[#4A89B0] text-white shadow-md" : "text-gray-700 hover:bg-gray-100"}`}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className={`font-medium whitespace-nowrap transition-opacity ${isSidebarExpanded || isSidebarPinned ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className={`pt-16 transition-all duration-300 ${isSidebarExpanded || isSidebarPinned ? "pl-64" : "pl-20"}`}>
        <div className="p-4 lg:p-8 space-y-6">
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
            <p className="text-gray-600 mt-1">Insights and trends from your inventory data</p>
          </div>

          {/* STAT CARDS */}
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

          {/* STACKED CHARTS (No longer overlapping) */}
          <div className="space-y-6">
             <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-xl font-bold text-gray-900">Category Distribution</h3>
                <p className="text-sm text-gray-600 mt-1 mb-6">Percentage of requests by item</p>
                {categoryDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={categoryDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}%`} outerRadius={100} dataKey="value">
                        {categoryDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-[300px] flex items-center justify-center text-gray-400">No data available</div>}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-xl font-bold text-gray-900">Department Activity</h3>
                <p className="text-sm text-gray-600 mt-1 mb-6">Requests by department</p>
                {departmentActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={departmentActivity} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" />
                      <YAxis dataKey="dept" type="category" width={200} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="requests" fill="#8b5cf6" name="Requests" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[300px] flex items-center justify-center text-gray-400">No data available</div>}
              </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-xl font-bold text-gray-900">6-Month Trend Analysis</h3>
            <p className="text-sm text-gray-600 mt-1 mb-6">Items distributed over time</p>
            {monthlyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" />
                  <YAxis><Label value="Number of Items" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} /></YAxis>
                  <Tooltip /><Legend />
                  <Line type="monotone" dataKey="items" stroke="#3b82f6" strokeWidth={2} name="Items Distributed" />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-[300px] flex items-center justify-center text-gray-400">No data available</div>}
          </div>

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
                      <div className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${item.trend > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {item.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(item.trend)}%
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-700">
                      {item.trend > 0 ? (
                        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-orange-500" /> Consider increasing stock</span>
                      ) : <span className="text-gray-500">Demand stable or decreasing</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="py-12 flex items-center justify-center text-gray-400">No trend data available</div>}
          </div>

          {/* REPORTS EXPORT */}
          <div className="bg-gradient-to-br from-[#5891B8] to-[#3776A0] rounded-xl shadow-lg p-8 text-white">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2"><Download className="w-6 h-6" /> Generate Reports</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <button onClick={generateRISWeeklyPDF} disabled={generating !== null} className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-6 text-left transition-all hover:bg-white/30 flex flex-col h-full shadow-sm justify-start">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold text-xl text-white">RIS Weekly</div>
                </div>
                <div className="text-sm text-white/80">Requisition and Issue Slip generated for the current week</div>
              </button>

              <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-6 flex flex-col h-full shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold text-xl text-white">SSMI Report Options</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">Facility Equipment</label>
                    <select 
                      value={reportFacility} 
                      onChange={(e) => setReportFacility(e.target.value as "JMS" | "GYM")} 
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-white/50 outline-none"
                    >
                      <option value="JMS">JMS Equipments</option>
                      <option value="GYM">GYM Equipments</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">Month Target</label>
                    <select 
                      value={ssmiMonthOption} 
                      onChange={(e) => setSsmiMonthOption(e.target.value)} 
                      className="w-full px-3 py-2 border-0 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-white/50 outline-none"
                    >
                      {getMonthOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
                
                <button 
                  onClick={generateSSMIPDF} 
                  disabled={generating !== null} 
                  className="w-full flex items-center justify-center gap-2 bg-white text-[#3776A0] py-2.5 rounded font-bold hover:bg-gray-50 transition-colors mt-auto shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  {generating === "SSMI" ? "Generating..." : "Download PDF"}
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}