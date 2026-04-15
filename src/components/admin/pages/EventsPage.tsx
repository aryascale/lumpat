import { useState } from "react";
import { useEvent } from "../../../contexts/EventContext";
import { CATEGORY_KEYS } from "../../../lib/config";
import EventDetailPage from "./EventDetailPage";

interface EventsPageProps {
  events: any[];
  onEventsChange: (events: any[]) => void;
}

type EventStatus = 'upcoming' | 'ongoing' | 'completed';

// Helper functions for status styling
function getStatusColor(status?: string): string {
  switch (status) {
    case 'ongoing':
      return '#dcfce7';
    case 'completed':
      return '#f3f4f6';
    case 'upcoming':
    default:
      return '#fef3c7';
  }
}

function getStatusTextColor(status?: string): string {
  switch (status) {
    case 'ongoing':
      return '#166534';
    case 'completed':
      return '#6b7280';
    case 'upcoming':
    default:
      return '#92400e';
  }
}

export default function EventsPage({ events, onEventsChange }: EventsPageProps) {
  const { refreshEvents } = useEvent();
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventLatitude, setNewEventLatitude] = useState('');
  const [newEventLongitude, setNewEventLongitude] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventActive, setNewEventActive] = useState(true);
  const [newEventStatus, setNewEventStatus] = useState<EventStatus>('upcoming');

  // Selected event for detail view
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) {
      alert('Event name is required');
      return;
    }
    if (!newEventDate) {
      alert('Event date is required');
      return;
    }

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newEventName.trim(),
          description: newEventDescription.trim(),
          eventDate: newEventDate,
          location: newEventLocation.trim(),
          latitude: newEventLatitude.trim() ? parseFloat(newEventLatitude.trim()) : null,
          longitude: newEventLongitude.trim() ? parseFloat(newEventLongitude.trim()) : null,
          isActive: newEventActive,
          categories: [...CATEGORY_KEYS],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create event' }));
        throw new Error(errorData.error || 'Failed to create event');
      }

      const event = await response.json();

      // Reset form
      setNewEventName('');
      setNewEventDate('');
      setNewEventLocation('');
      setNewEventLatitude('');
      setNewEventLongitude('');
      setNewEventDescription('');
      setNewEventActive(true);
      setNewEventStatus('upcoming');
      setShowEventForm(false);

      // Reload events list
      const eventsRes = await fetch('/api/events');
      const eventsData = await eventsRes.json();
      onEventsChange(Array.isArray(eventsData) ? eventsData : []);
      await refreshEvents();

      alert(`Event "${event.name}" created successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to create event');
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: EventStatus) => {
    setUpdatingStatus(eventId);
    try {
      const response = await fetch(`/api/events?eventId=${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update event status');
      }

      // Reload events
      const eventsRes = await fetch('/api/events');
      const eventsData = await eventsRes.json();
      onEventsChange(Array.isArray(eventsData) ? eventsData : []);
      await refreshEvents();

      alert(`Event status updated to "${newStatus}"`);
    } catch (error: any) {
      alert(error.message || 'Failed to update event status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const clearForm = () => {
    setShowEventForm(false);
    setNewEventName("");
    setNewEventDate("");
    setNewEventLocation("");
    setNewEventLatitude("");
    setNewEventLongitude("");
    setNewEventDescription("");
    setNewEventActive(true);
  };

  const handleBackFromDetail = async () => {
    setSelectedEvent(null);
    // Refresh events list
    const eventsRes = await fetch('/api/events');
    const eventsData = await eventsRes.json();
    onEventsChange(Array.isArray(eventsData) ? eventsData : []);
    await refreshEvents();
  };

  // Show event detail page if an event is selected
  if (selectedEvent) {
    return (
      <EventDetailPage
        eventId={selectedEvent.id}
        eventSlug={selectedEvent.slug}
        eventName={selectedEvent.name}
        onBack={handleBackFromDetail}
      />
    );
  }

  return (
    <>
      {/* Manage Events */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">Manage Events</h2>
            <div className="subtle">Create and manage multiple race events.</div>
          </div>
          <button className="btn w-full sm:w-auto" onClick={() => setShowEventForm(!showEventForm)}>
            {showEventForm ? "Cancel" : "+ Create Event"}
          </button>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-400 rounded text-blue-900 text-sm">
          <strong>Info:</strong> Setiap event memiliki kategori dan data CSV sendiri.
          Pilih event dari data table di bawah untuk mengelola event tersebut.
        </div>

        {showEventForm && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block mb-2 font-medium text-sm">Event Name</label>
                <input
                  className="search w-full"
                  placeholder="e.g., Jakarta Marathon 2025"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm">Event Date</label>
                <input
                  type="date"
                  className="search w-full"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm">Location</label>
                <input
                  className="search w-full"
                  placeholder="e.g., Jakarta, Indonesia"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block mb-2 font-medium text-sm">
                  Coordinates (Optional)
                </label>
                <div className="text-xs text-gray-500 mb-2">
                  For accurate map placement, enter coordinates from Google Maps.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="search w-full"
                    placeholder="Latitude"
                    value={newEventLatitude}
                    onChange={(e) => setNewEventLatitude(e.target.value)}
                  />
                  <input
                    className="search w-full"
                    placeholder="Longitude"
                    value={newEventLongitude}
                    onChange={(e) => setNewEventLongitude(e.target.value)}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block mb-2 font-medium text-sm">Description</label>
                <textarea
                  className="search w-full min-h-[80px]"
                  placeholder="Brief description of the event..."
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm">Event Status</label>
                <select
                  className="search w-full"
                  value={newEventStatus}
                  onChange={(e) => setNewEventStatus(e.target.value as EventStatus)}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newEventActive}
                    onChange={(e) => setNewEventActive(e.target.checked)}
                  />
                  <span className="text-sm">Event is active</span>
                </label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button className="btn w-full sm:w-auto" onClick={handleCreateEvent}>
                Create Event
              </button>
              <button className="btn ghost w-full sm:w-auto" onClick={clearForm}>
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Desktop Table - hidden on mobile */}
        <div className="hidden md:block table-wrap mt-4">
          <table className="f1-table compact">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Date</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">No events created yet</td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="row-hover">
                    <td className="name-cell">{evt.name}</td>
                    <td className="mono">{evt.eventDate ? new Date(evt.eventDate).toLocaleDateString() : (evt.date || '-')}</td>
                    <td>{evt.location || "-"}</td>
                    <td>
                      <select
                        className="search"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: '1px solid #e5e7eb',
                          background: getStatusColor(evt.status),
                          color: getStatusTextColor(evt.status),
                          cursor: 'pointer',
                        }}
                        value={evt.status || 'upcoming'}
                        onChange={(e) => handleStatusChange(evt.id, e.target.value as EventStatus)}
                        disabled={updatingStatus === evt.id}
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn"
                          onClick={() => setSelectedEvent(evt)}
                        >
                          Manage
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() => window.open(`/event/${evt.slug}`, '_blank')}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards - visible only on mobile */}
        <div className="md:hidden mt-4 space-y-3">
          {events.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No events created yet</div>
          ) : (
            events.map((evt) => (
              <div key={evt.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{evt.name}</h3>
                    <p className="text-sm text-gray-500">{evt.location || "No location"}</p>
                  </div>
                  <span
                    className="px-2 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: getStatusColor(evt.status),
                      color: getStatusTextColor(evt.status),
                    }}
                  >
                    {evt.status || 'upcoming'}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  <span className="mono">
                    {evt.eventDate ? new Date(evt.eventDate).toLocaleDateString() : (evt.date || 'No date')}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <select
                    className="search w-full text-sm"
                    value={evt.status || 'upcoming'}
                    onChange={(e) => handleStatusChange(evt.id, e.target.value as EventStatus)}
                    disabled={updatingStatus === evt.id}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      className="btn flex-1"
                      onClick={() => setSelectedEvent(evt)}
                    >
                      Manage
                    </button>
                    <button
                      className="btn ghost flex-1"
                      onClick={() => window.open(`/event/${evt.slug}`, '_blank')}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
