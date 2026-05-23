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
    path: "/admin/login",
    Component: AdminLogin,
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "inbox", Component: InboxPage },
      { path: "inventory", Component: InventoryPage },
      { path: "analytics", Component: AnalyticsPage },
    ],
  },
]);
