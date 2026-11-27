export const CATEGORIES = [
  'Classroom Maintenance',
  'IT Support',
  'Facilities',
];

export const THEMES = [
  { id: 'midnight', name: 'Midnight', note: 'Classic deep blue glass', mode: 'dark', icon: 'bi-moon-stars', swatch: 'sw-midnight' },
  { id: 'aurora', name: 'Aurora', note: 'Teal & mint glow', mode: 'dark', icon: 'bi-water', swatch: 'sw-aurora' },
  { id: 'violet', name: 'Violet', note: 'Nebula purple haze', mode: 'dark', icon: 'bi-gem', swatch: 'sw-violet' },
  { id: 'ember', name: 'Ember', note: 'Warm sunset glass', mode: 'dark', icon: 'bi-fire', swatch: 'sw-ember' },
  { id: 'light', name: 'Daylight', note: 'Bright frosted mode', mode: 'light', icon: 'bi-sun', swatch: 'sw-light' },
];

export const VALID_ACTIONS = {
  Submitted: [{ label: 'Assign', nextStatus: 'Assigned', btnClass: 'btn-cs-primary' }],
  Assigned: [{ label: 'Start Progress', nextStatus: 'In progress', btnClass: 'btn-cs-secondary' }],
  'In progress': [
    { label: 'Resolve', nextStatus: 'Resolved', btnClass: 'btn-cs-primary' },
    { label: 'Close', nextStatus: 'Closed', btnClass: 'btn-cs-ghost' },
  ],
  Resolved: [{ label: 'Close', nextStatus: 'Closed', btnClass: 'btn-cs-ghost' }],
  Closed: [],
};

export const INVALID_JUMP_TARGET = {
  Submitted: 'Resolved',
  Assigned: 'Closed',
  'In progress': 'Submitted',
  Resolved: 'Assigned',
  Closed: 'Submitted',
};

export const STATUS_PROGRESS = {
  Submitted: 15,
  Assigned: 42,
  'In progress': 72,
  Resolved: 100,
  Closed: 100,
};

export const REACTION_EMOJIS = ['👍', '🔥', '💡', '😂', '👏'];

export const POST_CATEGORIES = [
  'Campus life',
  'Academics',
  'Study spots',
  'Clubs & events',
  'Lost & found',
];

export const CAMPUS_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication',
  'Information Science',
  'Mechanical Engineering',
  'Civil Engineering',
  'Campus Administration',
  'Student Welfare',
];

export const SECTORS_META = {
  'IT Services': { icon: 'bi-router', tone: 'blue' },
  'Data Center': { icon: 'bi-hdd-rack', tone: 'cyan' },
  'Infrastructure & Facilities': { icon: 'bi-building-gear', tone: 'violet' },
  'Electrical & HVAC': { icon: 'bi-lightning-charge', tone: 'amber' },
  'Lab Equipment': { icon: 'bi-cpu', tone: 'teal' },
  'Library & Exam Cell': { icon: 'bi-journal-bookmark', tone: 'indigo' },
  'Security & Safety': { icon: 'bi-shield-check', tone: 'rose' },
  'Cleanliness & Waste': { icon: 'bi-trash3', tone: 'lime' },
  'Hostel & Welfare': { icon: 'bi-house-heart', tone: 'pink' },
};

export function formatTimestamp(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Burning the midnight oil';
}

export function getTodayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
