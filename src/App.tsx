import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { initFrontendLogger } from "./lib/frontend-logger";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EventProvider } from "./contexts/EventContext";

// A new deploy renames the hashed chunks; a tab still running the old build
// then fails to lazy-load a route. Reload automatically (throttled to once
// per 30s) so users land on the fresh build instead of a broken page.
const CHUNK_RELOAD_KEY = "lumpat_chunk_reload";
const lazyReload = (loader: () => Promise<{ default: React.ComponentType<any> }>) =>
  lazy(() =>
    loader().catch((err) => {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
      if (Date.now() - last > 30000) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
      throw err;
    })
  );

// Immediate load for the primary landing page
import LandingPage from "./pages/LandingPage";

// Lazy-loaded routes for performance & code-splitting
const AboutPage = lazyReload(() => import("./pages/AboutPage"));
const UserEventPage = lazyReload(() => import("./pages/UserEventPage"));
const HomePage = lazyReload(() => import("./pages/HomePage"));
const CreateEventPage = lazyReload(() => import("./pages/CreateEventPage"));
const EventPage = lazyReload(() => import("./pages/EventPage"));
const SupportTicketPage = lazyReload(() => import("./pages/SupportTicketPage"));
const CheckTicketPage = lazyReload(() => import("./pages/CheckTicketPage"));
const RpcPage = lazyReload(() => import("./pages/RpcPage"));
const ParticipantResultPage = lazyReload(() => import("./pages/ParticipantResultPage"));
const VerifyPage = lazyReload(() => import("./pages/VerifyPage"));
const DevicePage = lazyReload(() => import("./pages/DevicePage"));

// Lazy-loaded Admin and Checkpoint modules
const CheckpointLayout = lazyReload(() => import("./components/checkpoint/CheckpointLayout"));
const CheckpointDashboard = lazyReload(() => import("./pages/checkpoint/CheckpointDashboard"));
const AdminLayout = lazyReload(() => import("./components/admin/AdminLayout"));
const OverviewPageWrapper = lazyReload(() => import("./components/admin/wrappers").then(m => ({ default: m.OverviewPageWrapper })));
const EventsPageWrapper = lazyReload(() => import("./components/admin/wrappers").then(m => ({ default: m.EventsPageWrapper })));
const BannersPageWrapper = lazyReload(() => import("./components/admin/wrappers").then(m => ({ default: m.BannersPageWrapper })));
const PaymentsPage = lazyReload(() => import("./components/admin/pages/PaymentsPage"));
const ActivityLogsPage = lazyReload(() => import("./components/admin/pages/ActivityLogsPage"));
const TicketsPage = lazyReload(() => import("./components/admin/pages/TicketsPage"));

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
