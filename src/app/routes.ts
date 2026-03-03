import { createBrowserRouter } from "react-router";
import Upload from "./pages/Upload";
import Processing from "./pages/Processing";
import Dashboard from "./pages/Dashboard";
import DashboardWithChat from "./pages/DashboardWithChat";
import Emergency from "./pages/Emergency";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Upload,
  },
  {
    path: "/processing",
    Component: Processing,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
  {
    path: "/chat",
    Component: DashboardWithChat,
  },
  {
    path: "/emergency",
    Component: Emergency,
  },
]);
