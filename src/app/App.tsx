import { RouterProvider, createBrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { UserRequestPage } from './pages/UserRequestPage';
import { AdminLogin } from './pages/AdminLogin';
import { Dashboard } from './pages/Dashboard';
import { InboxPage } from './pages/InboxPage';
import { InventoryPage } from './pages/InventoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

const router = createBrowserRouter([
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

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
