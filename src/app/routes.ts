import { createBrowserRouter } from "react-router";
import { UserRequestPage } from "./pages/UserRequestPage";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminLayout } from "./pages/AdminLayout";
import { Dashboard } from "./pages/Dashboard";
import { InboxPage } from "./pages/InboxPage";
import { InventoryPage } from "./pages/InventoryPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: UserRequestPage,
  },
  {
    path: "/admin",
    Component: AdminLogin,
  },
  {
    path: "/admin/dashboard",
    Component: Dashboard,
  },
  {
    path: "/admin/inbox",
    Component: InboxPage,
  },
  {
    path: "/admin/inventory",
    Component: InventoryPage,
  },
  {
    path: "/admin/analytics",
    Component: AnalyticsPage,
  },
]);
