import { useState, useEffect } from 'react';
import { useEvent } from '../../../contexts/EventContext';
import { DEFAULT_EVENT_TITLE, LS_EVENT_TITLE, LS_DATA_VERSION, getCategoriesForEvent } from '../../../lib/config';

interface OverviewPageProps {
  allRows: any[];
  eventId?: string;
  onConfigChanged: () => void;
}

export default function OverviewPage({ allRows, eventId, onConfigChanged }: OverviewPageProps) {
  const { events } = useEvent();
  const [eventTitle, setEventTitle] = useState<string>(() =>
    localStorage.getItem(LS_EVENT_TITLE) || DEFAULT_EVENT_TITLE
  );
  const [banners, setBanners] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    // Load banners
    const loadBanners = async () => {
      try {
        const res = await fetch('/api/banners');
        if (res.ok) {
          const data = await res.json();
          setBanners(Array.isArray(data) ? data : []);
        } else {
          setBanners([]);
        }
      } catch (error) {
        console.error('Failed to load banners:', error);
        setBanners([]);
      }
    };
    loadBanners();

    // Load categories for this event
    const loadCategories = async () => {
      if (eventId) {
        try {
          const cats = await getCategoriesForEvent(eventId);
          setCategories(cats);
        } catch (error) {
          console.error('Failed to load categories:', error);
        }
      }
    };
    loadCategories();
  }, [eventId]);

  const bumpDataVersion = () => {
    localStorage.setItem(LS_DATA_VERSION, String(Date.now()));
  };

  const saveEventTitle = async () => {
    const t = (eventTitle || "").trim();
    localStorage.setItem(LS_EVENT_TITLE, t || DEFAULT_EVENT_TITLE);
    bumpDataVersion();
    onConfigChanged();
    alert("Judul event berhasil diperbarui");
  };

  return (
    <>
      {/* Stats Cards */}
      <div className="card">
        <div className="header-row">
          <div>
            <h2 className="section-title">Dashboard Overview</h2>
            <div className="subtle">Ringkasan data event dan peserta.</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 md:p-4">
            <div className="label text-xs md:text-sm">Total Events</div>
            <div className="value mono text-xl md:text-2xl">{events.length}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 md:p-4">
            <div className="label text-xs md:text-sm">Total Participants</div>
            <div className="value mono text-xl md:text-2xl">{allRows.length}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 md:p-4">
            <div className="label text-xs md:text-sm">Categories</div>
            <div className="value mono text-xl md:text-2xl">{categories.length}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 md:p-4">
            <div className="label text-xs md:text-sm">Active Banners</div>
            <div className="value mono text-xl md:text-2xl">{banners.filter(b => b.active || b.isActive).length}</div>
          </div>
        </div>
      </div>

      {/* Event Title Settings */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">Event Settings</h2>
            <div className="subtle">Ubah judul event yang tampil di halaman leaderboard.</div>
          </div>
          <button className="btn w-full sm:w-auto" onClick={saveEventTitle}>
            Save Title
          </button>
        </div>

        <div className="admin-cutoff">
          <div className="label">Event Title</div>
          <div className="tools">
            <input
              className="search"
              style={{ width: "100%" }}
              placeholder={DEFAULT_EVENT_TITLE}
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
