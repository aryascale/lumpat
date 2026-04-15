
import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import UserEventPage from "./pages/UserEventPage";
import HomePage from "./pages/HomePage";
import CreateEventPage from "./pages/CreateEventPage";
import EventPage from "./pages/EventPage";
import ApayaPage from "./pages/ApayaPage";
import AdminLayout from "./components/admin/AdminLayout";
import {
  OverviewPageWrapper,
  EventsPageWrapper,
  BannersPageWrapper
} from "./components/admin/wrappers";
import { EventProvider } from "./contexts/EventContext";
import SplashScreen from "./components/SplashScreen";

export default function App() {
  return (
    <EventProvider>
      <SplashScreen />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/leaderboard" element={<UserEventPage />} />
        <Route path="/event" element={<UserEventPage />} />
        <Route path="/apaya" element={<ApayaPage />} />
        <Route path="/admin/home" element={<HomePage />} />
        <Route path="/admin/create-event" element={<CreateEventPage />} />
        <Route path="/event/:slug" element={<EventPage />} />

        {/* New Admin Routes with Layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="overview" element={<OverviewPageWrapper />} />
          <Route path="events" element={<EventsPageWrapper />} />
          <Route path="banners" element={<BannersPageWrapper />} />
        </Route>
      </Routes>
    </EventProvider>
  );
}
