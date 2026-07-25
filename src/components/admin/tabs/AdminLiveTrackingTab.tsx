import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeaderboardData } from '../../../hooks/useLeaderboardData';
import { useEvent } from '../../../contexts/EventContext';
import LeaderboardTable from '../../LeaderboardTable';

interface AdminLiveTrackingTabProps {
  eventId: string;
}

export default function AdminLiveTrackingTab({ eventId }: AdminLiveTrackingTabProps) {
  const { state, overall, byCategory, eventCategories, forceRecalc } = useLeaderboardData(eventId);
  const { events } = useEvent();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<string>("Overall");

  if (state.status === 'loading') {
    return (
      <div className="card p-8 flex flex-col items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent"></div>
        <p className="mt-4 text-stone-600">{state.msg}</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="card p-8 bg-red-50 text-red-600">
        <h3 className="font-bold mb-2">Error Loading Data</h3>
        <p>{state.msg}</p>
        <button className="btn secondary mt-4" onClick={forceRecalc}>Retry</button>
      </div>
    );
  }

  const rowsToDisplay = activeTab === "Overall" ? overall : (byCategory[activeTab] || []);

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="section-title">Current Data (Live)</h2>
          <div className="subtle text-sm">
            Memantau data realtime dari sensor dan master data untuk event ini.
          </div>
        </div>
        <button className="btn secondary flex items-center gap-2" onClick={forceRecalc}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 border-b-2 border-stone-100 no-scrollbar">
        <button
          className={`px-4 py-2 whitespace-nowrap font-bold text-sm rounded-t-lg transition-colors border-b-4 ${
            activeTab === "Overall" ? "text-red-600 border-red-600 bg-red-50" : "text-stone-500 border-transparent hover:text-stone-800 hover:bg-stone-50"
          }`}
          onClick={() => setActiveTab("Overall")}
        >
          Overall
        </button>
        {eventCategories.map((catKey) => (
          <button
            key={catKey}
            className={`px-4 py-2 whitespace-nowrap font-bold text-sm rounded-t-lg transition-colors border-b-4 ${
              activeTab === catKey ? "text-red-600 border-red-600 bg-red-50" : "text-stone-500 border-transparent hover:text-stone-800 hover:bg-stone-50"
            }`}
            onClick={() => setActiveTab(catKey)}
          >
            {catKey}
          </button>
        ))}
      </div>

      <LeaderboardTable
        title={activeTab}
        categories={eventCategories}
        showTop10Badge={activeTab !== "Overall"}
        rows={rowsToDisplay}
        onSelect={(row) => {
          const event = events.find(e => e.id === eventId);
          if (!event) return;

          // Calculate ranks
          const finishers = overall.filter(
            (r) =>
              r.totalTimeDisplay !== "DNF" &&
              r.totalTimeDisplay !== "DSQ" &&
              r.totalTimeDisplay !== "Active" &&
              r.totalTimeDisplay !== "-",
          );
          const overallIndex = finishers.findIndex((r) => r.epc === row.epc);
          const overallRank = overallIndex !== -1 ? overallIndex + 1 : null;

          const genderFiltered = finishers.filter((r) => r.gender === row.gender);
          const genderIndex = genderFiltered.findIndex((r) => r.epc === row.epc);
          const genderRank = genderIndex !== -1 ? genderIndex + 1 : null;

          const categoryFiltered = finishers.filter((r) => r.category === row.category);
          const categoryIndex = categoryFiltered.findIndex((r) => r.epc === row.epc);
          const categoryRank = categoryIndex !== -1 ? categoryIndex + 1 : null;

          const ageFiltered = finishers.filter((r) => r.ageCategory === row.ageCategory);
          const ageIndex = ageFiltered.findIndex((r) => r.epc === row.epc);
          const ageRank = ageIndex !== -1 ? ageIndex + 1 : null;

          const data = {
            name: row.name,
            bib: row.bib,
            gender: row.gender,
            category: row.category,
            ageCategory: row.ageCategory,
            startTimeRaw: row.startTimeRaw ?? "-",
            finishTimeRaw: row.finishTimeRaw,
            totalTimeDisplay: row.totalTimeDisplay,
            checkpointTimes: row.laps?.map(l => l.timeDisplay) || [],
            penaltyMs: row.penaltyMs || 0,
            totalTimeMs: row.totalTimeMs,
            overallRank,
            genderRank,
            categoryRank,
            ageRank,
            distanceKm: row.distanceKm,
          };

          navigate(`/event/${event.slug}/participant/${row.epc}`, {
            state: { modalData: data, eventId: event.id, eventName: event.name }
          });
        }}
      />
    </div>
  );
}
