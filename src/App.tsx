import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { initFrontendLogger } from "./lib/frontend-logger";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EventProvider } from "./contexts/EventContext";

// Immediate load for the primary landing page
import LandingPage from "./pages/LandingPage";

// Lazy-loaded routes for performance & code-splitting
const AboutPage = lazy(() => import("./pages/AboutPage"));
const UserEventPage = lazy(() => import("./pages/UserEventPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const CreateEventPage = lazy(() => import("./pages/CreateEventPage"));
const EventPage = lazy(() => import("./pages/EventPage"));
const SupportTicketPage = lazy(() => import("./pages/SupportTicketPage"));
const CheckTicketPage = lazy(() => import("./pages/CheckTicketPage"));
const RpcPage = lazy(() => import("./pages/RpcPage"));
const ParticipantResultPage = lazy(() => import("./pages/ParticipantResultPage"));
const VerifyPage = lazy(() => import("./pages/VerifyPage"));
const DevicePage = lazy(() => import("./pages/DevicePage"));
const MonitoringPage = lazy(() => import("./pages/monitoring/MonitoringPage"));

// Lazy-loaded Admin and Checkpoint modules
const CheckpointLayout = lazy(() => import("./components/checkpoint/CheckpointLayout"));
const CheckpointDashboard = lazy(() => import("./pages/checkpoint/CheckpointDashboard"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const OverviewPageWrapper = lazy(() => import("./components/admin/wrappers").then(m => ({ default: m.OverviewPageWrapper })));
const EventsPageWrapper = lazy(() => import("./components/admin/wrappers").then(m => ({ default: m.EventsPageWrapper })));
const BannersPageWrapper = lazy(() => import("./components/admin/wrappers").then(m => ({ default: m.BannersPageWrapper })));
const PaymentsPage = lazy(() => import("./components/admin/pages/PaymentsPage"));
const ActivityLogsPage = lazy(() => import("./components/admin/pages/ActivityLogsPage"));
const TicketsPage = lazy(() => import("./components/admin/pages/TicketsPage"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Loading...</span>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    initFrontendLogger();
  }, []);

  return (
    <ErrorBoundary>
      <EventProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/verify/:id" element={<VerifyPage />} />
            <Route path="/device/:slug" element={<DevicePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/leaderboard" element={<UserEventPage />} />
            <Route path="/event" element={<UserEventPage />} />
            <Route path="/bantuan" element={<SupportTicketPage />} />
            <Route path="/cek-tiket" element={<CheckTicketPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />

            <Route path="/admin/home" element={<HomePage />} />
            <Route path="/admin/create-event" element={<CreateEventPage />} />
            <Route path="/event/:slug" element={<EventPage />} />
            <Route path="/event/:slug/participant/:epc" element={<ParticipantResultPage />} />
            <Route path="/rpc/:slug" element={<RpcPage />} />

            {/* Admin Routes with Layout */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="events" replace />} />
              <Route path="overview" element={<OverviewPageWrapper />} />
              <Route path="events" element={<EventsPageWrapper />} />
              <Route path="banners" element={<BannersPageWrapper />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="activity-logs" element={<ActivityLogsPage />} />
            </Route>

            {/* Checkpoint Routes */}
            <Route path="/manualtiming" element={<CheckpointLayout />}>
              <Route index element={<CheckpointDashboard />} />
            </Route>
          </Routes>
        </Suspense>
      </EventProvider>
    </ErrorBoundary>
  );
}
