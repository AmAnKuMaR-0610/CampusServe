import { useState } from 'react';
import { SectorChip } from './StatusBadge.jsx';

export function LocationsView({ locations, buildings, onReportAtLocation }) {
  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');

  const filtered = locations.filter((loc) => {
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      `${loc.building} ${loc.room} ${loc.name} ${loc.type} ${loc.note} ${loc.assignedDepartment}`
        .toLowerCase()
        .includes(q);
    const matchB = !building || loc.building === building;
    const matchF = !floor || loc.floor === floor;
    return matchQ && matchB && matchF;
  });

  const floors = ['1', '2', '3', '4', '5', '7', 'Terrace'];

  return (
    <div className="space-y-5">
      <section className="page-head">
        <div>
          <div className="eyebrow">BMSCE Directory</div>
          <h1 className="page-title">Class &amp; Lab Directory</h1>
          <p className="page-sub">
            Search {locations.length} classrooms, labs, libraries, and campus facilities with their assigned support departments.
          </p>
        </div>
        <span className="badge-status badge-submitted">{filtered.length} locations</span>
      </section>

      <div className="glass-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="block text-xs font-semibold cs-secondary mb-1">Search room, lab, or equipment</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g., AI & ML, Seminar Hall, CAD, LIB-02..."
              className="cs-input"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold cs-secondary mb-1">Building</label>
            <select value={building} onChange={(e) => setBuilding(e.target.value)} className="cs-select">
              <option value="">All buildings</option>
              {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold cs-secondary mb-1">Floor</label>
            <select value={floor} onChange={(e) => setFloor(e.target.value)} className="cs-select">
              <option value="">All floors</option>
              {floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="loc-grid">
        {filtered.map((loc) => (
          <div key={loc.room} className="loc-card flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="ticket-id">{loc.room}</span>
                <span className="badge-status badge-assigned">{loc.type}</span>
              </div>
              <h2 className="text-sm font-bold">{loc.name}</h2>
              <div className="text-xs cs-muted mt-0.5">
                <i className="bi bi-geo-alt mr-1" />
                {loc.building} · Floor {loc.floor}
              </div>
              <p className="text-xs cs-secondary mt-1.5">{loc.note}</p>
            </div>

            <div className="pt-2.5 border-t cs-border flex items-center justify-between gap-2 flex-wrap">
              <SectorChip department={loc.assignedDepartment} />
              <button
                type="button"
                onClick={() => onReportAtLocation(`${loc.building} · ${loc.room} ${loc.name}`)}
                className="btn-cs btn-cs-ghost btn-cs-sm"
              >
                Report issue →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
