'use strict';

const User = require('./User');
const {
  CATEGORIES,
  PRIORITIES,
  PRIORITY_WEIGHT,
  STATUS,
  STATUSES,
  ALLOWED_TRANSITIONS,
  FINAL_STATUSES,
} = require('./constants');
const { ValidationError, WorkflowError } = require('./errors');

const COMMON_EDITABLE_FIELDS = Object.freeze(['title', 'description', 'location', 'priority']);

/**
 * Abstract-style base class for every campus service request.
 *
 * - It cannot be created directly: use ICTSupportRequest, MaintenanceRequest,
 *   CleaningRequest or GeneralServiceRequest.
 * - Subclasses must implement calculatePriorityScore(), getTargetResolutionHours()
 *   and getRequestSummary(). The base versions throw a clear error.
 * - It owns the status workflow, so an invalid status change can never happen,
 *   no matter which subclass is used.
 */
class ServiceRequest {
  #requestId;
  #requester;
  #title;
  #description;
  #location;
  #category;
  #priority;
  #status;
  #dateSubmitted;
  #dateUpdated;
  #assignedTechnicianId;
  #dateResolved;
  #dateClosed;
  #resolutionNotes;
  #history;

  /**
   * @param {object} data common request data
   * @param {string} data.requestId
   * @param {User}   data.requester    the User object who submitted the request
   * @param {string} data.title
   * @param {string} data.description
   * @param {string} data.location     campus location
   * @param {string} [data.category]   defaults to the subclass category
   * @param {string} [data.priority]   defaults to "Normal"
   * @param {string} [data.status]     defaults to "Submitted" (other values only when restoring saved data)
   */
  constructor(data = {}) {
    if (new.target === ServiceRequest) {
      throw new TypeError(
        'ServiceRequest is an abstract-style class. Create an ICTSupportRequest, MaintenanceRequest, CleaningRequest or GeneralServiceRequest instead.',
      );
    }

    this.#requestId = ServiceRequest.cleanText(data.requestId).toUpperCase();
    this.#requester = data.requester;
    this.#title = ServiceRequest.cleanText(data.title);
    this.#description = ServiceRequest.cleanText(data.description);
    this.#location = ServiceRequest.cleanText(data.location);
    this.#category = ServiceRequest.cleanText(data.category) || new.target.CATEGORY || '';
    this.#priority = ServiceRequest.cleanText(data.priority) || 'Normal';
    this.#status = ServiceRequest.cleanText(data.status) || STATUS.SUBMITTED;
    this.#dateSubmitted = ServiceRequest.toDate(data.dateSubmitted, 'Date submitted') ?? new Date();
    this.#dateUpdated = ServiceRequest.toDate(data.dateUpdated, 'Date updated') ?? new Date(this.#dateSubmitted);
    this.#assignedTechnicianId = ServiceRequest.cleanText(data.assignedTechnicianId) || null;
    this.#dateResolved = ServiceRequest.toDate(data.dateResolved, 'Date resolved');
    this.#dateClosed = ServiceRequest.toDate(data.dateClosed, 'Date closed');
    this.#resolutionNotes = ServiceRequest.cleanText(data.resolutionNotes);
    this.#history = Array.isArray(data.history) ? data.history.map((entry) => ({ ...entry })) : [];

    this.#validateBaseFields(new.target);
  }

  // ---------------------------------------------------------------- getters
  get requestId() { return this.#requestId; }
  get requester() { return this.#requester; }
  get requesterId() { return this.#requester.userId; }
  get title() { return this.#title; }
  get description() { return this.#description; }
  get location() { return this.#location; }
  get category() { return this.#category; }
  get priority() { return this.#priority; }
  get status() { return this.#status; }
  get dateSubmitted() { return new Date(this.#dateSubmitted); }
  get dateUpdated() { return new Date(this.#dateUpdated); }
  get assignedTechnicianId() { return this.#assignedTechnicianId; }
  get dateResolved() { return this.#dateResolved ? new Date(this.#dateResolved) : null; }
  get dateClosed() { return this.#dateClosed ? new Date(this.#dateClosed) : null; }
  get resolutionNotes() { return this.#resolutionNotes; }
  get requestType() { return this.constructor.REQUEST_TYPE || this.constructor.name; }

  /** Returns a copy, so outside code cannot rewrite the history. */
  getHistory() {
    return this.#history.map((entry) => ({ ...entry }));
  }

  isFinal() {
    return FINAL_STATUSES.includes(this.#status);
  }

  // ------------------------------------------------- abstract-style methods
  calculatePriorityScore() {
    throw new Error(`${this.constructor.name} must implement calculatePriorityScore().`);
  }

  getTargetResolutionHours() {
    throw new Error(`${this.constructor.name} must implement getTargetResolutionHours().`);
  }

  getRequestSummary() {
    throw new Error(`${this.constructor.name} must implement getRequestSummary().`);
  }

  // ------------------------------------------------ hooks for subclasses
  /** Checks the subclass's own fields. Overridden by every subclass. */
  validateSpecialisedFields() {
    return true;
  }

  /** Names of specialised fields a requester may change while the request is Submitted. */
  getEditableSpecialisedFields() {
    return [];
  }

  /** Checks proposed specialised changes without applying them. */
  validateSpecialisedChanges() {
    return true;
  }

  /** Applies specialised changes that have already been validated. */
  applySpecialisedChanges() {}

  /** Specialised fields to include when the request is saved. */
  getSpecialisedData() {
    return {};
  }

  // --------------------------------------------------- shared behaviour
  /** Points from priority alone. Subclasses add their own risk points. */
  getBasePriorityScore() {
    return PRIORITY_WEIGHT[this.#priority] * 10;
  }

  /** Common summary lines that every subclass builds on. */
  buildSummaryLines() {
    const requester = this.#requester;
    return [
      `Request ID  : ${this.#requestId}`,
      `Type        : ${this.requestType}`,
      `Title       : ${this.#title}`,
      `Description : ${this.#description}`,
      `Category    : ${this.#category}`,
      `Location    : ${this.#location}`,
      `Priority    : ${this.#priority}`,
      `Status      : ${this.#status}`,
      `Requester   : ${requester.getFullName()} (${requester.userId})`,
      `Technician  : ${this.#assignedTechnicianId ?? 'Not assigned'}`,
      `Submitted   : ${ServiceRequest.formatDate(this.#dateSubmitted)}`,
      `Updated     : ${ServiceRequest.formatDate(this.#dateUpdated)}`,
    ];
  }

  /** Full validation of the object (base fields plus subclass fields). */
  validate() {
    this.#validateBaseFields(this.constructor);
    this.validateSpecialisedFields();
    return true;
  }

  /** Hours since the request was submitted. */
  getAgeHours(now = new Date()) {
    return (now.getTime() - this.#dateSubmitted.getTime()) / 3_600_000;
  }

  /** Hours from submission to resolution, or null if not resolved yet. */
  getResolutionHours() {
    if (!this.#dateResolved) return null;
    return (this.#dateResolved.getTime() - this.#dateSubmitted.getTime()) / 3_600_000;
  }

  /** Open work that has gone past its target resolution time. */
  isOverdue(now = new Date()) {
    const open = ![STATUS.RESOLVED, STATUS.CLOSED, STATUS.CANCELLED].includes(this.#status);
    return open && this.getAgeHours(now) > this.getTargetResolutionHours();
  }

  /** One-line version used in lists. */
  getShortSummary() {
    return `${this.#requestId.padEnd(7)} | ${this.#status.padEnd(11)} | ${this.#priority.padEnd(6)} | ${this.#category.padEnd(23)} | ${this.#title}`;
  }

  // ------------------------------------------- requester actions (Pass)
  /**
   * Changes the editable details of a Submitted request.
   * Every new value is validated before anything is changed.
   * @param {object} changes e.g. { title, description, location, priority, ...specialised }
   * @param {User|object} actor who made the change
   * @returns {string[]} the names of the fields that changed
   */
  updateDetails(changes = {}, actor = null) {
    if (this.#status !== STATUS.SUBMITTED) {
      throw new WorkflowError(`Only Submitted requests can be updated. ${this.#requestId} is ${this.#status}.`);
    }

    const keys = Object.keys(changes).filter((key) => changes[key] !== undefined && changes[key] !== '');
    if (keys.length === 0) throw new ValidationError('No changes were supplied.');

    const specialisedFields = this.getEditableSpecialisedFields();
    const unknown = keys.filter((key) => !COMMON_EDITABLE_FIELDS.includes(key) && !specialisedFields.includes(key));
    if (unknown.length > 0) {
      throw new ValidationError(
        `These fields cannot be updated: ${unknown.join(', ')}. Editable fields: ${[...COMMON_EDITABLE_FIELDS, ...specialisedFields].join(', ')}.`,
      );
    }

    // Build and check the new common values first.
    const candidate = {
      title: this.#title,
      description: this.#description,
      location: this.#location,
      priority: this.#priority,
    };
    const specialisedChanges = {};
    for (const key of keys) {
      if (COMMON_EDITABLE_FIELDS.includes(key)) candidate[key] = ServiceRequest.cleanText(changes[key]);
      else specialisedChanges[key] = changes[key];
    }
    ServiceRequest.#checkCommonValues(candidate);
    this.validateSpecialisedChanges(specialisedChanges);

    // Everything is valid, so apply it.
    this.#title = candidate.title;
    this.#description = candidate.description;
    this.#location = candidate.location;
    this.#priority = candidate.priority;
    this.applySpecialisedChanges(specialisedChanges);
    this.#touch();
    this.#addHistory(this.#status, this.#status, 'Request Updated', actor ?? this.#requester, `Updated: ${keys.join(', ')}`);
    return keys;
  }

  /** Cancels a Submitted request. Cancelled is a final status. */
  cancelRequest(actor = null, reason = '') {
    if (this.#status === STATUS.CANCELLED) {
      throw new WorkflowError(`Request ${this.#requestId} is already Cancelled.`);
    }
    if (this.#status !== STATUS.SUBMITTED) {
      throw new WorkflowError(`Only Submitted requests can be cancelled. ${this.#requestId} is ${this.#status}.`);
    }
    this.changeStatus(STATUS.CANCELLED, {
      action: 'Request Cancelled',
      actor: actor ?? this.#requester,
      comment: reason || 'Cancelled by requester',
    });
  }

  // ---------------------------------------- staff workflow actions (Credit)
  review(actor, comment = '') {
    this.changeStatus(STATUS.REVIEWED, { action: 'Request Reviewed', actor, comment: comment || 'Request reviewed' });
  }

  /** Sets the priority. Allowed until the request is Resolved. */
  setPriority(priority, actor, comment = '') {
    const value = ServiceRequest.cleanText(priority);
    if (!PRIORITIES.includes(value)) {
      throw new ValidationError(`Priority must be one of: ${PRIORITIES.join(', ')}.`);
    }
    if ([STATUS.RESOLVED, STATUS.CLOSED, STATUS.CANCELLED].includes(this.#status)) {
      throw new WorkflowError(`Priority cannot be changed when a request is ${this.#status}.`);
    }
    const previous = this.#priority;
    this.#priority = value;
    this.#touch();
    this.#addHistory(this.#status, this.#status, 'Priority Changed', actor, comment || `Priority ${previous} -> ${value}`);
    return previous;
  }

  assignTechnician(technicianId, actor, comment = '') {
    const id = ServiceRequest.cleanText(technicianId);
    if (!id) throw new ValidationError('A Technician ID is required.');
    this.#ensureTransition(STATUS.ASSIGNED);
    this.#assignedTechnicianId = id;
    this.changeStatus(STATUS.ASSIGNED, {
      action: 'Technician Assigned',
      actor,
      comment: comment || `Assigned to ${id}`,
    });
  }

  startWork(actor, comment = '') {
    this.changeStatus(STATUS.IN_PROGRESS, { action: 'Work Started', actor, comment: comment || 'Work started' });
  }

  addProgressNote(actor, note) {
    const text = ServiceRequest.cleanText(note);
    if (!text) throw new ValidationError('A progress note cannot be empty.');
    if (this.#status !== STATUS.IN_PROGRESS) {
      throw new WorkflowError(`Progress notes can only be added while work is In Progress. ${this.#requestId} is ${this.#status}.`);
    }
    this.#touch();
    this.#addHistory(this.#status, this.#status, 'Progress Note', actor, text);
  }

  resolve(actor, resolutionNotes) {
    const notes = ServiceRequest.cleanText(resolutionNotes);
    if (!notes) throw new ValidationError('Resolution notes are required to resolve a request.');
    this.#ensureTransition(STATUS.RESOLVED);
    this.#resolutionNotes = notes;
    this.changeStatus(STATUS.RESOLVED, { action: 'Request Resolved', actor, comment: notes });
  }

  close(actor, comment = '') {
    this.changeStatus(STATUS.CLOSED, { action: 'Request Closed', actor, comment: comment || 'Completion verified and closed' });
  }

  /**
   * The only place where the status field changes. Rejects anything that is
   * not in ALLOWED_TRANSITIONS and records every change in the history.
   */
  changeStatus(newStatus, { action, actor, comment = '' } = {}) {
    this.#ensureTransition(newStatus);
    const previous = this.#status;
    this.#status = newStatus;
    const now = this.#touch();
    if (newStatus === STATUS.RESOLVED) this.#dateResolved = now;
    if (newStatus === STATUS.CLOSED) this.#dateClosed = now;
    this.#addHistory(previous, newStatus, action || `Status changed to ${newStatus}`, actor, comment);
  }

  canTransitionTo(newStatus) {
    return (ALLOWED_TRANSITIONS[this.#status] || []).includes(newStatus);
  }

  /** Plain data for JSON. History is saved separately in requestHistory.json. */
  toJSON() {
    return {
      requestId: this.#requestId,
      requestType: this.requestType,
      requesterId: this.#requester.userId,
      title: this.#title,
      description: this.#description,
      location: this.#location,
      category: this.#category,
      priority: this.#priority,
      status: this.#status,
      assignedTechnicianId: this.#assignedTechnicianId,
      resolutionNotes: this.#resolutionNotes || null,
      dateSubmitted: this.#dateSubmitted.toISOString(),
      dateUpdated: this.#dateUpdated.toISOString(),
      dateResolved: this.#dateResolved ? this.#dateResolved.toISOString() : null,
      dateClosed: this.#dateClosed ? this.#dateClosed.toISOString() : null,
      ...this.getSpecialisedData(),
    };
  }

  // ------------------------------------------------------- private helpers
  #ensureTransition(newStatus) {
    if (!STATUSES.includes(newStatus)) {
      throw new ValidationError(`"${newStatus}" is not a recognised status.`);
    }
    if (!this.canTransitionTo(newStatus)) {
      const allowed = ALLOWED_TRANSITIONS[this.#status];
      const next = allowed.length ? allowed.join(' or ') : 'none (final status)';
      throw new WorkflowError(
        `Invalid status change for ${this.#requestId}: ${this.#status} -> ${newStatus}. Allowed next status: ${next}.`,
      );
    }
  }

  #touch() {
    const now = new Date();
    // Keeps dates in order even if two actions happen in the same millisecond.
    this.#dateUpdated = now < this.#dateUpdated ? new Date(this.#dateUpdated) : now;
    return new Date(this.#dateUpdated);
  }

  #addHistory(previousStatus, newStatus, action, actor, comment) {
    this.#history.push({
      previousStatus,
      newStatus,
      action,
      actorId: actor?.userId ?? actor?.actorId ?? 'SYSTEM',
      actorRole: (typeof actor?.getRole === 'function' ? actor.getRole() : actor?.actorRole) ?? 'System',
      comment: comment || '',
      timestamp: new Date(this.#dateUpdated).toISOString(),
    });
  }

  #validateBaseFields(requestClass) {
    const problems = [];
    if (!this.#requestId) problems.push('Request ID is required.');
    if (!(this.#requester instanceof User)) problems.push('A valid requester (User object) is required.');
    try {
      ServiceRequest.#checkCommonValues({
        title: this.#title,
        description: this.#description,
        location: this.#location,
        priority: this.#priority,
      });
    } catch (error) {
      problems.push(error.message);
    }
    if (!CATEGORIES.includes(this.#category)) {
      problems.push(`"${this.#category}" is not a supported category. Use one of: ${CATEGORIES.join(', ')}.`);
    } else if (requestClass.CATEGORY && requestClass.CATEGORY !== this.#category) {
      problems.push(`${requestClass.name} must use the "${requestClass.CATEGORY}" category, not "${this.#category}".`);
    }
    if (!STATUSES.includes(this.#status)) {
      problems.push(`"${this.#status}" is not a recognised status.`);
    }
    if (problems.length > 0) throw new ValidationError(problems.join(' '));
  }

  static #checkCommonValues({ title, description, location, priority }) {
    const problems = [];
    if (!title) problems.push('Request title is required.');
    else if (title.length > 100) problems.push('Request title must be 100 characters or fewer.');
    if (!description) problems.push('Request description is required.');
    if (!location) problems.push('Campus location is required.');
    if (!PRIORITIES.includes(priority)) {
      problems.push(`"${priority}" is not a supported priority. Use one of: ${PRIORITIES.join(', ')}.`);
    }
    if (problems.length > 0) throw new ValidationError(problems.join(' '));
  }

  // --------------------------------------------------------- static utils
  static cleanText(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  static toDate(value, label) {
    if (value === undefined || value === null || value === '') return null;
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new ValidationError(`${label} is not a valid date.`);
    return date;
  }

  static formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

module.exports = ServiceRequest;
