/**
 * CampusServe BMSCE campus knowledge ported from campus_data.py:
 * issue categories, support sectors/departments, auto-routing rules,
 * campus building/lab locations, and CampusBot intents.
 */

export const SLA_HOURS = 48;

export const API_CATEGORIES = [
  'Classroom Maintenance',
  'IT Support',
  'Facilities',
];

export const SECTORS = {
  'IT Services': {
    icon: 'wifi',
    tone: 'blue',
    desc: 'Wi-Fi, network, portals, projectors, software and accounts',
    rules: [
      'wifi', 'wi-fi', 'internet', 'network', 'portal', 'login', 'password',
      'software', 'projector', 'hdmi', 'computer', 'email', 'printer', 'website', 'it',
    ],
  },
  'Data Center': {
    icon: 'hdd-rack',
    tone: 'cyan',
    desc: 'Servers, cloud, databases, backups and lab compute',
    rules: [
      'server', 'data center', 'datacenter', 'rack', 'cloud', 'database', 'db',
      'firewall', 'switch', 'storage', 'backup', 'virtual machine', 'vm', 'nas',
    ],
  },
  'Infrastructure & Facilities': {
    icon: 'building',
    tone: 'violet',
    desc: 'Buildings, classrooms, furniture and civil works',
    rules: [
      'plumbing', 'leak', 'water', 'restroom', 'toilet', 'furniture', 'door',
      'window', 'roof', 'paint', 'chair', 'desk', 'classroom', 'building', 'wall',
      'ceiling', 'bench', 'stairs', 'lift', 'elevator', 'whiteboard', 'tray',
    ],
  },
  'Electrical & HVAC': {
    icon: 'zap',
    tone: 'amber',
    desc: 'Power, lighting, fans, sockets and air conditioning',
    rules: [
      'light', 'fan', 'power', 'socket', 'plug', 'electrical', 'voltage',
      'short circuit', 'ac', 'air conditioner', 'air conditioning', 'hvac',
      'generator', 'ups', 'wire', 'bulb', 'flicker', 'breaker', 'tube',
    ],
  },
  'Lab Equipment': {
    icon: 'cpu',
    tone: 'teal',
    desc: 'Instruments, machines and lab consumables',
    rules: [
      'lab', 'equipment', 'oscilloscope', 'machine', 'tool', 'instrument',
      'sensor', 'microscope', '3d printer', 'breadboard', 'calibration', 'workstation',
    ],
  },
  'Library & Exam Cell': {
    icon: 'book-open',
    tone: 'indigo',
    desc: 'Library, examinations and academic records',
    rules: [
      'library', 'book', 'exam', 'marks', 'certificate', 'transcript',
      'bonafide', 'attendance', 'result', 'hall ticket', 'seating',
    ],
  },
  'Security & Safety': {
    icon: 'shield-check',
    tone: 'rose',
    desc: 'Campus safety, CCTV, access and emergencies',
    rules: [
      'security', 'cctv', 'guard', 'fire', 'emergency', 'safety', 'theft',
      'access card', 'gate', 'hazard', 'extinguisher',
    ],
  },
  'Cleanliness & Waste': {
    icon: 'trash-2',
    tone: 'lime',
    desc: 'Housekeeping, sanitation and waste management',
    rules: [
      'garbage', 'clean', 'dustbin', 'trash', 'waste', 'pest', 'sanitation',
      'sweep', 'spill', 'hygiene', 'odor',
    ],
  },
  'Hostel & Welfare': {
    icon: 'heart-handshake',
    tone: 'pink',
    desc: 'Hostel, student welfare and wellbeing',
    rules: [
      'hostel', 'warden', 'mess', 'canteen', 'food', 'counsel', 'welfare',
      'medical', 'health', 'scholarship',
    ],
  },
};

export const SECTOR_NAMES = Object.keys(SECTORS);

export const CATEGORY_SECTOR = {
  'IT Support': 'IT Services',
  'Classroom Maintenance': 'Infrastructure & Facilities',
  Facilities: 'Infrastructure & Facilities',
};

/**
 * Infers the owning campus support department/sector from category + text.
 */
export function inferDepartment(category, ...texts) {
  const haystack = texts.map((t) => String(t || '')).join(' ').toLowerCase();
  const scores = {};
  for (const name of SECTOR_NAMES) {
    scores[name] = 0;
    for (const rule of SECTORS[name].rules) {
      if (haystack.includes(rule)) {
        scores[name] += rule.length;
      }
    }
  }

  const defaultSector = CATEGORY_SECTOR[category] || 'IT Services';
  scores[defaultSector] = (scores[defaultSector] || 0) + 2;

  if (scores['Data Center'] >= 3) {
    scores['Data Center'] += 4;
  }

  let best = defaultSector;
  let bestScore = -1;
  for (const name of SECTOR_NAMES) {
    if (scores[name] > bestScore) {
      bestScore = scores[name];
      best = name;
    }
  }
  return best;
}

export const LOCATIONS = [
  { building: 'Main Block (A)', floor: '1', room: 'A-101', name: 'Seminar Hall', type: 'Hall', note: '180 seats, projector + PA', assignedDepartment: 'IT Services' },
  { building: 'Main Block (A)', floor: '2', room: 'A-204', name: 'CSE Classroom', type: 'Classroom', note: 'Section A · 70 seats', assignedDepartment: 'Infrastructure & Facilities' },
  { building: 'Main Block (A)', floor: '3', room: 'A-303', name: 'CSE Lab 2', type: 'Lab', note: '84 workstations · Git + Docker', assignedDepartment: 'IT Services' },
  { building: 'Main Block (A)', floor: '3', room: 'A-309', name: 'AI & ML Lab', type: 'Lab', note: 'GPU benches · 32 seats', assignedDepartment: 'Lab Equipment' },
  { building: 'Main Block (A)', floor: '4', room: 'A-402', name: 'ISE Classroom', type: 'Classroom', note: 'Section B · 68 seats', assignedDepartment: 'Infrastructure & Facilities' },
  { building: 'Main Block (A)', floor: '7', room: 'A-701', name: 'Faculty Suite', type: 'Office', note: 'CSE + ISE faculty', assignedDepartment: 'Infrastructure & Facilities' },
  { building: 'Main Block (A)', floor: 'Terrace', room: 'A-TER', name: 'Open Study Deck', type: 'Study spot', note: 'Shaded seating · campus Wi-Fi', assignedDepartment: 'IT Services' },
  { building: 'B Block', floor: '1', room: 'B-108', name: 'ECE Classroom', type: 'Classroom', note: 'Section C · 64 seats', assignedDepartment: 'Infrastructure & Facilities' },
  { building: 'B Block', floor: '2', room: 'B-205', name: 'Analog Electronics Lab', type: 'Lab', note: '24 benches · oscilloscopes', assignedDepartment: 'Lab Equipment' },
  { building: 'B Block', floor: '3', room: 'B-304', name: 'Digital Systems Lab', type: 'Lab', note: 'FPGA + microcontroller boards', assignedDepartment: 'Lab Equipment' },
  { building: 'B Block', floor: '5', room: 'B-502', name: 'Project Room', type: 'Lab', note: 'Capstone teams · 6 pods', assignedDepartment: 'Electrical & HVAC' },
  { building: 'C Block', floor: '1', room: 'C-110', name: 'Mechanical Classroom', type: 'Classroom', note: 'Section A · 72 seats', assignedDepartment: 'Infrastructure & Facilities' },
  { building: 'C Block', floor: '2', room: 'C-212', name: 'Thermal Engineering Lab', type: 'Lab', note: 'Heat exchangers · turbines', assignedDepartment: 'Lab Equipment' },
  { building: 'C Block', floor: '4', room: 'C-401', name: 'CAD & Simulation Lab', type: 'Lab', note: '48 workstations · SolidWorks', assignedDepartment: 'IT Services' },
  { building: 'C Block', floor: 'Terrace', room: 'C-TER', name: 'Quiet Study Terrace', type: 'Study spot', note: 'Best before 5 PM', assignedDepartment: 'Cleanliness & Waste' },
  { building: 'D Block', floor: '1', room: 'D-102', name: 'Civil Classroom', type: 'Classroom', note: 'Section B · 60 seats', assignedDepartment: 'Infrastructure & Facilities' },
  { building: 'D Block', floor: '2', room: 'D-204', name: 'Surveying Lab', type: 'Lab', note: 'Total stations · theodolites', assignedDepartment: 'Lab Equipment' },
  { building: 'D Block', floor: '3', room: 'D-310', name: 'Hackathon Arena', type: 'Lab', note: 'Open 24×7 during events', assignedDepartment: 'Electrical & HVAC' },
  { building: 'Central Library', floor: '1', room: 'LIB-01', name: 'Reading Hall', type: 'Library', note: 'Silent zone · 220 seats', assignedDepartment: 'Library & Exam Cell' },
  { building: 'Central Library', floor: '2', room: 'LIB-02', name: 'Digital Library', type: 'Library', note: 'E-journals · 40 terminals', assignedDepartment: 'IT Services' },
  { building: 'Central Library', floor: '3', room: 'LIB-03', name: 'Group Discussion Rooms', type: 'Library', note: 'Bookable 4-seat rooms', assignedDepartment: 'Library & Exam Cell' },
  { building: 'Annex Block', floor: '2', room: 'DC-201', name: 'Campus Data Center', type: 'Facility', note: 'Restricted access', assignedDepartment: 'Data Center' },
  { building: 'Annex Block', floor: '1', room: 'NOC-01', name: 'Network Operations', type: 'Facility', note: 'IT Services desk', assignedDepartment: 'IT Services' },
  { building: 'Annex Block', floor: '1', room: 'EX-112', name: 'Examination Cell', type: 'Office', note: 'Marks cards · transcripts', assignedDepartment: 'Library & Exam Cell' },
];

export const POST_CATEGORIES = [
  'Campus life',
  'Academics',
  'Study spots',
  'Clubs & events',
  'Lost & found',
];

export const DECISION_STATUSES = ['Upcoming', 'Active', 'Closed', 'Implemented'];

export const BOT_INTENTS = [
  {
    tag: 'Report an issue',
    patterns: ['report', 'complaint', 'issue', 'broken', 'not working', 'fix', 'submit'],
    reply:
      'Open Requests → Submit Request. Select one of the three verified categories (Classroom Maintenance, IT Support, Facilities), pick a BMSCE location, and use your synthetic student ID (STU-XXXX). CampusServe auto-routes the owning department and issues a non-guessable REQ- tracking ID.',
  },
  {
    tag: 'Which department handles it?',
    patterns: ['which team', 'sector', 'who handles', 'department', 'routing', 'data center', 'infrastructure', 'it support'],
    reply:
      'Requests are auto-routed by category and keywords: Wi-Fi, projectors, and software go to IT Services; servers and cloud go to Data Center; classrooms and civil works go to Infrastructure & Facilities; power sockets, fans, and lighting go to Electrical & HVAC.',
  },
  {
    tag: 'Status lifecycle rules',
    patterns: ['status', 'transition', 'lifecycle', 'workflow', 'assigned', 'in progress', 'resolved', 'closed'],
    reply:
      'Tickets follow a strict state machine: Submitted → Assigned → In progress → Resolved → Closed (or In progress → Closed). Skipping states such as Submitted → Resolved is blocked with HTTP 400 to protect audit integrity.',
  },
  {
    tag: 'SLA timer',
    patterns: ['sla', 'how long', 'deadline', 'overdue', '48'],
    reply:
      `CampusServe targets a ${SLA_HOURS}-hour initial pickup SLA. Tickets in Submitted or Assigned beyond ${SLA_HOURS} hours are highlighted for escalation.`,
  },
  {
    tag: 'Campus decisions & voting',
    patterns: ['vote', 'decision', 'proposal', 'ballot', 'anonymous', 'receipt'],
    reply:
      'Visit Campus Decisions to review active proposals and cast an anonymous synthetic ballot. A SHA-256 receipt code is returned so you can verify participation without exposing identity.',
  },
  {
    tag: 'Find a room or lab',
    patterns: ['room', 'class', 'lab', 'where is', 'floor', 'building', 'location'],
    reply:
      'Open Campus Directory to filter 24 BMSCE classrooms, labs, libraries, and study decks by block, floor, or equipment notes.',
  },
  {
    tag: 'Privacy & logging',
    patterns: ['privacy', 'pii', 'log', 'logging', 'redacted', 'secret'],
    reply:
      'CampusServe operates in Synthetic Lab Mode only. Cloud Logging records only { timestamp, requestId, operation, result, statusCode, latencyMs } — descriptions, student refs, and locations are strictly stripped.',
  },
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
