
import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import UserEventPage from "./pages/UserEventPage";
import HomePage from "./pages/HomePage";
import CreateEventPage from "./pages/CreateEventPage";
import EventPage from "./pages/EventPage";

import AdminLayout from "./components/admin/AdminLayout";
import {
  OverviewPageWrapper,
  EventsPageWrapper,
  BannersPageWrapper
} from "./components/admin/wrappers";
import PaymentsPage from "./components/admin/pages/PaymentsPage";
import ActivityLogsPage from "./components/admin/pages/ActivityLogsPage";
import { EventProvider } from "./contexts/EventContext";
import SplashScreen from "./components/SplashScreen";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <EventProvider>
      <SplashScreen />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/leaderboard" element={<UserEventPage />} />
        <Route path="/event" element={<UserEventPage />} />

        <Route path="/admin/home" element={<HomePage />} />
        <Route path="/admin/create-event" element={<CreateEventPage />} />
        <Route path="/event/:slug" element={<EventPage />} />

        {/* New Admin Routes with Layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="overview" element={<OverviewPageWrapper />} />
          <Route path="events" element={<EventsPageWrapper />} />
          <Route path="banners" element={<BannersPageWrapper />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="activity-logs" element={<ActivityLogsPage />} />
        </Route>
      </Routes>
    </EventProvider>
  );
}
