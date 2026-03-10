import { createBrowserRouter, Navigate } from "react-router";
import Upload from "./pages/Upload";
import Processing from "./pages/Processing";
import Dashboard from "./pages/Dashboard";
import SchedulePage from "./pages/SchedulePage";
import SurgEyePage from "./pages/SurgEye";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/schedule" replace />,
  },
  {
    path: "/upload",
    Component: Upload,
  },
  {
    path: "/processing",
    Component: Processing,
  },
  {
    path: "/dashboard",
    Component: SchedulePage,
  },
  {
    path: "/schedule",
    Component: SchedulePage,
  },
  {
    path: "/surgeye",
    Component: SurgEyePage,
  },
]);
