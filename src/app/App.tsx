import { useCallback, type MouseEvent } from "react";
import { RouterProvider, createBrowserRouter } from "react-router";
import { Toaster, toast, useSonner } from "sonner";
import { UserRequestPage } from "./pages/UserRequestPage";
import { AdminLogin } from "./pages/AdminLogin";
import { Dashboard } from "./pages/Dashboard";
import { InboxPage } from "./pages/InboxPage";
import { InventoryPage } from "./pages/InventoryPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

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
  const { toasts } = useSonner();

  const handleToastClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;

      const clickedToast = target.closest(
        "[data-sonner-toast]",
      ) as HTMLElement | null;
      if (!clickedToast) return;

      if (
        target.closest(
          "[data-close-button], [data-button], [data-action], [data-cancel], button",
        )
      ) {
        return;
      }

      const index = clickedToast.dataset.index;
      if (typeof index === "undefined") return;
      const toastIndex = Number(index);
      if (!Number.isFinite(toastIndex)) return;

      const toaster = clickedToast.closest("[data-sonner-toaster]");
      const position =
        toaster instanceof HTMLElement
          ? `${toaster.dataset.yPosition || "top"}-${toaster.dataset.xPosition || "right"}`
          : undefined;

      const activeToasts = position
        ? toasts.filter(
            (toastItem) => (toastItem.position ?? "top-right") === position,
          )
        : toasts;

      const toastItem = activeToasts[toastIndex];
      if (!toastItem) return;

      toast.dismiss(toastItem.id);
    },
    [toasts],
  );

  return (
    <>
      <RouterProvider router={router} />
      <div onClick={handleToastClick}>
        <Toaster position="top-right" richColors />
      </div>
    </>
  );
}

export default App;
