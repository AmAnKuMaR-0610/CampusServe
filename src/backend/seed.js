import { inferDepartment } from './campusData.js';

/**
 * Generates 4 realistic synthetic BMSCE campus service requests plus
 * synthetic announcements, campus feed posts, and campus decisions.
 * Uses strictly synthetic student/staff IDs (STU-XXXX, FAC-XXX, ADM-XXX).
 */
export function buildSyntheticSeedRequests() {
  const now = Date.now();
  const iso = (offsetMinutes) => new Date(now - offsetMinutes * 60_000).toISOString();

  const base = [
    {
      requestId: 'REQ-b5ce1042a0000001',
      category: 'Classroom Maintenance',
      location: 'Main Block (A) · A-101 Seminar Hall',
      description: 'Overhead ceiling projector HDMI input port flickers intermittently during afternoon lab sessions.',
      requesterRef: 'STU-1042',
      status: 'Submitted',
      createdAt: iso(15),
      updatedAt: iso(15),
      statusHistory: [
        {
          fromStatus: null,
          toStatus: 'Submitted',
          changedBy: 'requester',
          timestamp: iso(15),
        },
      ],
    },
    {
      requestId: 'REQ-b5ce2081b0000002',
      category: 'IT Support',
      location: 'Main Block (A) · A-303 CSE Lab 2',
      description: 'Campus Wi-Fi access point drops 5GHz connections when more than 40 student devices join simultaneously.',
      requesterRef: 'STU-2081',
      status: 'Assigned',
      createdAt: iso(90),
      updatedAt: iso(45),
      statusHistory: [
        {
          fromStatus: null,
          toStatus: 'Submitted',
          changedBy: 'requester',
          timestamp: iso(90),
        },
        {
          fromStatus: 'Submitted',
          toStatus: 'Assigned',
          changedBy: 'synthetic-dispatch (ADM-001)',
          timestamp: iso(45),
        },
      ],
    },
    {
      requestId: 'REQ-b5ce3190c0000003',
      category: 'Facilities',
      location: 'Central Library · LIB-01 Reading Hall',
      description: 'Two reading desk power sockets near the west windows are non-responsive and require breaker inspection.',
      requesterRef: 'STU-3190',
      status: 'In progress',
      createdAt: iso(240),
      updatedAt: iso(30),
      statusHistory: [
        {
          fromStatus: null,
          toStatus: 'Submitted',
          changedBy: 'requester',
          timestamp: iso(240),
        },
        {
          fromStatus: 'Submitted',
          toStatus: 'Assigned',
          changedBy: 'synthetic-dispatch (ADM-001)',
          timestamp: iso(180),
        },
        {
          fromStatus: 'Assigned',
          toStatus: 'In progress',
          changedBy: 'electrical-hvac-unit',
          timestamp: iso(30),
        },
      ],
    },
    {
      requestId: 'REQ-b5ce4512d0000004',
      category: 'Classroom Maintenance',
      location: 'C Block · C-110 Mechanical Classroom',
      description: 'Whiteboard magnetic marker tray detached on the left corner and two fluorescent tubes needed replacement.',
      requesterRef: 'STU-4512',
      status: 'Resolved',
      createdAt: iso(420),
      updatedAt: iso(60),
      statusHistory: [
        {
          fromStatus: null,
          toStatus: 'Submitted',
          changedBy: 'requester',
          timestamp: iso(420),
        },
        {
          fromStatus: 'Submitted',
          toStatus: 'Assigned',
          changedBy: 'synthetic-dispatch (ADM-001)',
          timestamp: iso(360),
        },
        {
          fromStatus: 'Assigned',
          toStatus: 'In progress',
          changedBy: 'infra-maintenance-unit',
          timestamp: iso(210),
        },
        {
          fromStatus: 'In progress',
          toStatus: 'Resolved',
          changedBy: 'infra-maintenance-unit',
          timestamp: iso(60),
        },
      ],
    },
  ];

  return base.map((item) => ({
    ...item,
    assignedDepartment: inferDepartment(item.category, item.location, item.description),
  }));
}

export function buildSyntheticAnnouncements() {
  const now = Date.now();
  const iso = (offsetMinutes) => new Date(now - offsetMinutes * 60_000).toISOString();

  return [
    {
      id: 'ANN-0001',
      title: 'Internal Assessment Schedule & Seating Plans Live',
      description: 'Semester IA examinations begin next Monday across Main Block (A) and B Block. Check your room assignment in Campus Directory before 8:30 AM.',
      publishedBy: 'Synthetic Faculty (FAC-201)',
      createdAt: iso(180),
    },
    {
      id: 'ANN-0002',
      title: 'Cloud Service Desk Live on Floci GCP Emulator',
      description: 'Students can now submit Classroom Maintenance, IT Support, and Facilities tickets using synthetic references (STU-XXXX) and track live transitions.',
      publishedBy: 'Synthetic Admin (ADM-001)',
      createdAt: iso(90),
    },
    {
      id: 'ANN-0003',
      title: 'Scheduled Library Wi-Fi Access Point Upgrade',
      description: 'IT Services will upgrade firmware on LIB-02 Digital Library access points this Saturday between 6:00 AM and 7:30 AM.',
      publishedBy: 'Synthetic Admin (ADM-001)',
      createdAt: iso(40),
    },
  ];
}

export function buildSyntheticPosts() {
  const now = Date.now();
  const iso = (offsetMinutes) => new Date(now - offsetMinutes * 60_000).toISOString();

  return [
    {
      id: 'POST-0001',
      kind: 'post',
      title: 'Central Library 2nd Floor Wi-Fi latency improved',
      body: 'Tested the upgraded access points in LIB-02 this afternoon — sustained speeds with zero packet drops across 30+ connected laptops.',
      category: 'Campus life',
      authorRef: 'STU-1042',
      authorLabel: 'Synthetic Student (STU-1042)',
      authorRole: 'student',
      isPinned: false,
      upvotes: 14,
      voterRefs: ['STU-2081', 'STU-3190'],
      reactions: { '👍': 6, '🔥': 4, '💡': 2 },
      createdAt: iso(300),
    },
    {
      id: 'POST-0002',
      kind: 'post',
      title: 'Quiet study deck hours on Main Block Terrace',
      body: 'Open Study Deck (A-TER) has shaded seating and steady Wi-Fi coverage before 6 PM for capstone team discussions.',
      category: 'Study spots',
      authorRef: 'STU-2081',
      authorLabel: 'Synthetic Student (STU-2081)',
      authorRole: 'student',
      isPinned: false,
      upvotes: 9,
      voterRefs: ['STU-1042'],
      reactions: { '👍': 5, '👏': 3 },
      createdAt: iso(190),
    },
    {
      id: 'POST-0003',
      kind: 'post',
      title: 'Hackathon Arena D-310 power strip check completed',
      body: 'Electrical & HVAC team verified all floor power outlets in D-310 ahead of the weekend cloud engineering sprint.',
      category: 'Clubs & events',
      authorRef: 'FAC-201',
      authorLabel: 'Synthetic Faculty (FAC-201)',
      authorRole: 'faculty',
      isPinned: true,
      upvotes: 18,
      voterRefs: ['STU-1042', 'STU-3190'],
      reactions: { '🔥': 7, '👏': 5 },
      createdAt: iso(95),
    },
    {
      id: 'DEC-0001',
      kind: 'decision',
      title: 'Extend Central Library Reading Hall hours to 10 PM during exams',
      body: 'Proposal to extend Central Library (LIB-01 and LIB-02) closing time from 8:00 PM to 10:00 PM during internal assessment and semester exam weeks.',
      aiSummary: 'Extends reading hall & digital library access by 2 hours daily during exam windows with evening security rotation.',
      status: 'Active',
      category: 'Campus Decision',
      authorRef: 'ADM-001',
      authorLabel: 'Synthetic Admin (ADM-001)',
      authorRole: 'admin',
      opensAt: iso(2880),
      closesAt: new Date(now + 5 * 86_400_000).toISOString(),
      options: [
        { id: 'opt-1', label: 'Yes, extend both halls to 10 PM', votes: 18 },
        { id: 'opt-2', label: 'Extend Digital Library (LIB-02) only', votes: 7 },
        { id: 'opt-3', label: 'Keep existing 8 PM closing time', votes: 3 },
      ],
      voterHashes: [],
      upvotes: 28,
      createdAt: iso(1440),
    },
    {
      id: 'DEC-0002',
      kind: 'decision',
      title: 'Install additional water dispensers on C Block Floors 2 and 4',
      body: 'Proposal to add chilled filtered water dispensers near C-212 and C-401 labs to reduce ground-floor crowding between sessions.',
      aiSummary: 'Adds two high-capacity dispensers in C Block with weekly Facilities sanitation checks.',
      status: 'Upcoming',
      category: 'Campus Decision',
      authorRef: 'ADM-001',
      authorLabel: 'Synthetic Admin (ADM-001)',
      authorRole: 'admin',
      opensAt: new Date(now + 2 * 86_400_000).toISOString(),
      closesAt: new Date(now + 9 * 86_400_000).toISOString(),
      options: [
        { id: 'opt-1', label: 'Approve two dispensers (Floors 2 & 4)', votes: 0 },
        { id: 'opt-2', label: 'Approve one dispenser on Floor 3', votes: 0 },
        { id: 'opt-3', label: 'Defer to next semester cycle', votes: 0 },
      ],
      voterHashes: [],
      upvotes: 11,
      createdAt: iso(720),
    },
    {
      id: 'DEC-0003',
      kind: 'decision',
      title: 'Deploy Main Block (A) rooftop solar monitoring dashboard',
      body: 'Approved Phase 1 sustainability initiative to publish live solar generation metrics for BMSCE academic blocks.',
      aiSummary: 'Certified by campus energy unit; telemetry dashboard scheduled for rollout.',
      status: 'Implemented',
      category: 'Campus Decision',
      authorRef: 'ADM-001',
      authorLabel: 'Synthetic Admin (ADM-001)',
      authorRole: 'admin',
      opensAt: iso(20_000),
      closesAt: iso(4_320),
      options: [
        { id: 'opt-1', label: 'Approve Phase 1 deployment', votes: 31 },
        { id: 'opt-2', label: 'Request revised budget review', votes: 6 },
      ],
      voterHashes: [],
      upvotes: 37,
      createdAt: iso(10_000),
    },
  ];
}
