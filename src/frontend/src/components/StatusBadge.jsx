import { SECTORS_META } from '../constants.js';

export function StatusBadge({ status }) {
  const slug = String(status || 'submitted').toLowerCase().replace(/\s+/g, '-');
  return <span className={`badge-status badge-${slug}`}>{status}</span>;
}

export function SectorChip({ department }) {
  if (!department) return null;
  const meta = SECTORS_META[department] || { icon: 'bi-diagram-3', tone: 'blue' };
  return (
    <span className={`sector-chip sector-${meta.tone}`}>
      <i className={`bi ${meta.icon}`} />
      {department}
    </span>
  );
}
