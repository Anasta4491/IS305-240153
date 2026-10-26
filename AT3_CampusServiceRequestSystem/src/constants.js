'use strict';

/**
 * Shared lookup values used across the Campus Service Request Management System.
 * Keeping them in one place means validation rules stay consistent everywhere.
 */

const CATEGORIES = Object.freeze([
  'ICT Support',
  'Facilities Maintenance',
  'Cleaning and Sanitation',
  'General Campus Service',
]);

const PRIORITIES = Object.freeze(['Low', 'Normal', 'High', 'Urgent']);

/** Numeric weight of each priority, used for sorting and priority scores. */
const PRIORITY_WEIGHT = Object.freeze({ Low: 1, Normal: 2, High: 3, Urgent: 4 });

const STATUS = Object.freeze({
  SUBMITTED: 'Submitted',
  REVIEWED: 'Reviewed',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
});

const STATUSES = Object.freeze(Object.values(STATUS));

/**
 * Permitted status flow:
 * Submitted -> Reviewed -> Assigned -> In Progress -> Resolved -> Closed
 * A Submitted request may also be Cancelled. Closed and Cancelled are final.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  [STATUS.SUBMITTED]: Object.freeze([STATUS.REVIEWED, STATUS.CANCELLED]),
  [STATUS.REVIEWED]: Object.freeze([STATUS.ASSIGNED]),
  [STATUS.ASSIGNED]: Object.freeze([STATUS.IN_PROGRESS]),
  [STATUS.IN_PROGRESS]: Object.freeze([STATUS.RESOLVED]),
  [STATUS.RESOLVED]: Object.freeze([STATUS.CLOSED]),
  [STATUS.CLOSED]: Object.freeze([]),
  [STATUS.CANCELLED]: Object.freeze([]),
});

/** Statuses where the request is finished and no longer counts as open work. */
const FINAL_STATUSES = Object.freeze([STATUS.CLOSED, STATUS.CANCELLED]);
const COMPLETED_STATUSES = Object.freeze([STATUS.RESOLVED, STATUS.CLOSED]);

const USER_TYPES = Object.freeze({
  STUDENT: 'Student',
  STAFF: 'Staff',
  SERVICE_OFFICER: 'Service Officer',
  TECHNICIAN: 'Technician',
  ADMINISTRATOR: 'Administrator',
});

const USER_TYPE_LIST = Object.freeze(Object.values(USER_TYPES));

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = {
  CATEGORIES,
  PRIORITIES,
  PRIORITY_WEIGHT,
  STATUS,
  STATUSES,
  ALLOWED_TRANSITIONS,
  FINAL_STATUSES,
  COMPLETED_STATUSES,
  USER_TYPES,
  USER_TYPE_LIST,
  EMAIL_PATTERN,
};
