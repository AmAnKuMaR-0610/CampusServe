import { CAMPUS_DEPARTMENTS, POST_CATEGORIES } from './campusData.js';

export const CATEGORIES = [
  'Classroom Maintenance',
  'IT Support',
  'Facilities',
];

export const STATUSES = [
  'Submitted',
  'Assigned',
  'In progress',
  'Resolved',
  'Closed',
];

export const ALLOWED_TRANSITIONS = {
  Submitted: ['Assigned'],
  Assigned: ['In progress'],
  'In progress': ['Resolved', 'Closed'],
  Resolved: ['Closed'],
  Closed: [],
};

const REQUESTER_REF_REGEX = /^STU-\d{3,6}$/;
const SYNTHETIC_ACCOUNT_REGEX = /^(STU|FAC|ADM)-\d{3,6}$/;
const REQUEST_ID_REGEX = /^REQ-[a-f0-9]{16}$/;

/**
 * Validates incoming request creation payloads against strict schema rules.
 */
export function validateCreateRequest(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be a JSON object.'] };
  }

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const requesterRef = typeof body.requesterRef === 'string' ? body.requesterRef.trim() : '';

  if (!CATEGORIES.includes(category)) {
    errors.push(`category must be one of: ${CATEGORIES.join(', ')}.`);
  }
  if (location.length < 3 || location.length > 80) {
    errors.push('location must be a trimmed string between 3 and 80 characters.');
  }
  if (description.length < 10 || description.length > 500) {
    errors.push('description must be a trimmed string between 10 and 500 characters.');
  }
  if (!REQUESTER_REF_REGEX.test(requesterRef)) {
    errors.push('requesterRef must be a synthetic student reference matching STU-XXX (3 to 6 digits, e.g., STU-1042).');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      category,
      location,
      description,
      requesterRef,
    },
  };
}

/**
 * Validates requestId format when provided on routes.
 */
export function isValidRequestIdFormat(id) {
  return typeof id === 'string' && REQUEST_ID_REGEX.test(id);
}

/**
 * Validates a status transition request payload and checks transition rules.
 */
export function validateStatusTransition(currentStatus, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      type: 'INVALID_INPUT',
      error: 'Request body must be a JSON object.',
    };
  }

  const nextStatus = typeof body.status === 'string' ? body.status.trim() : '';
  const changedBy = typeof body.changedBy === 'string' && body.changedBy.trim().length > 0
    ? body.changedBy.trim().slice(0, 60)
    : 'service-desk-operator';

  if (!STATUSES.includes(nextStatus)) {
    return {
      valid: false,
      type: 'INVALID_INPUT',
      error: `status must be one of: ${STATUSES.join(', ')}.`,
      currentStatus,
      allowedNextStates: ALLOWED_TRANSITIONS[currentStatus] || [],
    };
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      type: 'INVALID_TRANSITION',
      error: `Invalid status transition from "${currentStatus}" to "${nextStatus}".`,
      currentStatus,
      requestedStatus: nextStatus,
      allowedNextStates: allowed,
    };
  }

  return {
    valid: true,
    nextStatus,
    changedBy,
  };
}

/**
 * Validates synthetic demo login/registration inputs (no real PII or passwords).
 */
export function validateSyntheticAuth(body, isRegister = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Payload must be a JSON object.' };
  }

  const syntheticId = typeof body.syntheticId === 'string' ? body.syntheticId.trim().toUpperCase() : '';
  const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
  const department = typeof body.department === 'string' && CAMPUS_DEPARTMENTS.includes(body.department.trim())
    ? body.department.trim()
    : 'Computer Science & Engineering';
  const semester = Number.isInteger(Number(body.semester))
    ? Math.min(Math.max(Number(body.semester), 1), 8)
    : 3;

  if (!SYNTHETIC_ACCOUNT_REGEX.test(syntheticId)) {
    return {
      valid: false,
      error: 'Use a synthetic ID matching STU-XXXX, FAC-XXX, or ADM-XXX (3 to 6 digits). Never enter real names or emails.',
    };
  }

  const prefixRoleMap = { STU: 'student', FAC: 'faculty', ADM: 'admin' };
  const inferredRole = prefixRoleMap[syntheticId.slice(0, 3)];
  const resolvedRole = role || inferredRole;

  if (!['student', 'faculty', 'admin'].includes(resolvedRole)) {
    return { valid: false, error: 'role must be student, faculty, or admin.' };
  }

  if (resolvedRole !== inferredRole) {
    return {
      valid: false,
      error: `Synthetic ID prefix "${syntheticId.slice(0, 3)}" must match role "${inferredRole}".`,
    };
  }

  if (isRegister && body.email) {
    return {
      valid: false,
      error: 'Real emails are prohibited in Synthetic Lab Mode. Use a synthetic ID only.',
    };
  }

  const titleCaseRole = resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1);
  return {
    valid: true,
    session: {
      syntheticId,
      role: resolvedRole,
      displayLabel: `Synthetic ${titleCaseRole} (${syntheticId})`,
      department: resolvedRole === 'admin' ? 'Campus Administration' : department,
      semester: resolvedRole === 'student' ? semester : null,
      mode: 'Synthetic Lab Mode — No Real Personal Data',
    },
  };
}

export function validateAnnouncement(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const publishedBy = typeof body.publishedBy === 'string' && body.publishedBy.trim().length > 0
    ? body.publishedBy.trim().slice(0, 60)
    : 'Synthetic Admin (ADM-001)';

  if (title.length < 4 || title.length > 120) {
    return { valid: false, error: 'Announcement title must be 4–120 characters.' };
  }
  if (description.length < 10 || description.length > 800) {
    return { valid: false, error: 'Announcement description must be 10–800 characters.' };
  }
  return { valid: true, data: { title, description, publishedBy } };
}

export function validatePost(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  const kind = body.kind === 'decision' ? 'decision' : 'post';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const postBody = typeof body.body === 'string' ? body.body.trim() : '';
  const category = typeof body.category === 'string' && (POST_CATEGORIES.includes(body.category.trim()) || kind === 'decision')
    ? body.category.trim()
    : POST_CATEGORIES[0];
  const authorRef = typeof body.authorRef === 'string' && SYNTHETIC_ACCOUNT_REGEX.test(body.authorRef.trim().toUpperCase())
    ? body.authorRef.trim().toUpperCase()
    : 'STU-1042';
  const authorRole = authorRef.startsWith('ADM') ? 'admin' : authorRef.startsWith('FAC') ? 'faculty' : 'student';
  const titleCaseRole = authorRole.charAt(0).toUpperCase() + authorRole.slice(1);

  if (title.length < 3 || title.length > 120) {
    return { valid: false, error: 'Title must be 3–120 characters.' };
  }
  if (postBody.length < 10 || postBody.length > 1500) {
    return { valid: false, error: 'Body must be 10–1500 characters.' };
  }

  return {
    valid: true,
    data: {
      kind,
      title,
      body: postBody,
      category: kind === 'decision' ? 'Campus Decision' : category,
      authorRef,
      authorLabel: `Synthetic ${titleCaseRole} (${authorRef})`,
      authorRole,
      options: Array.isArray(body.options) ? body.options : undefined,
      aiSummary: typeof body.aiSummary === 'string' ? body.aiSummary.trim().slice(0, 240) : undefined,
    },
  };
}
