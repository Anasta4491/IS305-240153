'use strict';

const User = require('./User');
const ServiceRequest = require('./ServiceRequest');
const { STATUSES, PRIORITY_WEIGHT, CATEGORIES, PRIORITIES } = require('./constants');
const {
  ValidationError,
  DuplicateError,
  NotFoundError,
  PermissionError,
  WorkflowError,
  DataFileError,
} = require('./errors');

/**
 * Keeps track of all users and service requests in arrays and controls every
 * change to them.
 *
 * Responsibilities:
 * - registration, submission, lookup, search, filter and sort;
 * - role permissions (who may do what);
 * - the audit trail;
 * - asking the data store (if one is attached) to save after each successful change.
 *
 * It never reads or writes files itself. File work belongs to the repository
 * classes, reached through the optional dataStore object.
 */
class ServiceRequestManager {
  #users = [];
  #requests = [];
  #auditLog = [];
  #dataStore;

  /**
   * @param {object} [options]
   * @param {object} [options.dataStore] a CampusDataStore. Leave it out for an
   *        in-memory manager (used by the Pass tests).
   */
  constructor({ dataStore = null } = {}) {
    this.#dataStore = dataStore;
  }

  /**
   * Creates a manager and loads every saved record through the data store.
   * @returns {Promise<{manager: ServiceRequestManager, warnings: string[]}>}
   */
  static async createWithDataStore(dataStore) {
    const manager = new ServiceRequestManager({ dataStore });
    const { users, requests, auditLog, warnings } = await dataStore.loadAll();
    manager.#users = users;
    manager.#requests = requests;
    manager.#auditLog = auditLog;
    return { manager, warnings };
  }

  // =================================================================== USERS
  async registerUser(user) {
    if (!(user instanceof User)) throw new ValidationError('Only User objects can be registered.');
    user.validate();
    if (this.findUserById(user.userId)) {
      throw new DuplicateError(`User ID ${user.userId} is already registered.`);
    }
    if (this.#users.some((existing) => existing.email === user.email)) {
      throw new DuplicateError(`The email address ${user.email} is already registered.`);
    }

    this.#users.push(user);
    this.#addAudit({
      actorId: user.userId,
      actorRole: user.getRole(),
      action: 'User Registered',
      requestId: null,
      description: `${user.getFullName()} registered as ${user.getRole()}.`,
      outcome: 'Success',
    });

    try {
      await this.#save('users', 'audit');
    } catch (error) {
      // Nothing half-saved: take the user back out of memory as well.
      this.#users = this.#users.filter((existing) => existing !== user);
      this.#auditLog.pop();
      throw error;
    }
    return user;
  }

  findUserById(userId) {
    const id = String(userId ?? '').trim().toUpperCase();
    if (!id) return null;
    return this.#users.find((user) => user.userId.toUpperCase() === id) ?? null;
  }

  getAllUsers() {
    return [...this.#users];
  }

  getUsersByType(userType) {
    return this.#users.filter((user) => user.userType === userType);
  }

  // ================================================================ REQUESTS
  /** Next free ID in the form REQ001, REQ002 ... */
  generateRequestId() {
    const highest = this.#requests.reduce((max, request) => {
      const number = Number.parseInt(request.requestId.replace(/\D/g, ''), 10);
      return Number.isNaN(number) ? max : Math.max(max, number);
    }, 0);
    return `REQ${String(highest + 1).padStart(3, '0')}`;
  }

  async submitRequest(request) {
    if (!(request instanceof ServiceRequest)) {
      throw new ValidationError('Only ServiceRequest objects can be submitted.');
    }
    request.validate();

    const requester = this.findUserById(request.requesterId);
    if (!requester) throw new NotFoundError(`Requester ${request.requesterId} is not registered.`);
    if (!requester.canSubmitRequests()) {
      throw new PermissionError(`${requester.getRole()} accounts cannot submit service requests. Use a Student or Staff account.`);
    }
    if (this.findRequestById(request.requestId)) {
      throw new DuplicateError(`Request ID ${request.requestId} already exists.`);
    }
    if (request.status !== 'Submitted') {
      throw new WorkflowError('A new request must start with the Submitted status.');
    }

    this.#requests.push(request);
    this.#addAudit({
      actorId: requester.userId,
      actorRole: requester.getRole(),
      action: 'Request Created',
      requestId: request.requestId,
      description: `${request.requestType} "${request.title}" submitted (${request.priority}).`,
      outcome: 'Success',
    });

    try {
      await this.#save('requests', 'audit');
    } catch (error) {
      this.#requests = this.#requests.filter((existing) => existing !== request);
      this.#auditLog.pop();
      throw error;
    }
    return request;
  }

  findRequestById(requestId) {
    const id = String(requestId ?? '').trim().toUpperCase();
    if (!id) return null;
    return this.#requests.find((request) => request.requestId === id) ?? null;
  }

  getRequestsByUser(userId) {
    const user = this.#requireUser(userId);
    return this.#requests.filter((request) => request.requesterId === user.userId);
  }

  getAllRequests() {
    return [...this.#requests];
  }

  /** Requester updates their own Submitted request. */
  async updateRequest(requestId, userId, changes) {
    return this.#runAction(
      { requestId, actorId: userId, action: 'Request Updated' },
      ({ request, actor }) => {
        this.#requireOwner(request, actor, 'update');
        const fields = request.updateDetails(changes, actor);
        return `Fields updated: ${fields.join(', ')}.`;
      },
    );
  }

  /** Requester cancels their own Submitted request. */
  async cancelRequest(requestId, userId, reason = '') {
    return this.#runAction(
      { requestId, actorId: userId, action: 'Request Cancelled' },
      ({ request, actor }) => {
        this.#requireOwner(request, actor, 'cancel');
        request.cancelRequest(actor, reason);
        return `Request cancelled${reason ? `: ${reason}` : '.'}`;
      },
    );
  }

  /** Case-insensitive search by request ID, title, description or location. */
  searchRequests(searchText) {
    const text = String(searchText ?? '').trim().toLowerCase();
    if (!text) throw new ValidationError('Please enter some text to search for.');
    return this.#requests.filter((request) =>
      [request.requestId, request.title, request.description, request.location]
        .some((value) => value.toLowerCase().includes(text)),
    );
  }

  /** Count of requests for every status, plus a total. */
  getRequestSummaryByStatus() {
    const summary = Object.fromEntries(STATUSES.map((status) => [status, 0]));
    for (const request of this.#requests) summary[request.status] += 1;
    summary.Total = this.#requests.length;
    return summary;
  }

  // ======================================================== STAFF WORKFLOW
  async reviewRequest(requestId, officerId, comment = '') {
    return this.#runAction(
      { requestId, actorId: officerId, action: 'Request Reviewed' },
      ({ request, actor }) => {
        this.#requireOfficer(actor, 'review requests');
        request.review(actor, comment);
        return `Reviewed by ${actor.getFullName()}.`;
      },
    );
  }

  async setPriority(requestId, officerId, priority, comment = '') {
    return this.#runAction(
      { requestId, actorId: officerId, action: 'Priority Changed' },
      ({ request, actor }) => {
        this.#requireOfficer(actor, 'set request priority');
        const previous = request.setPriority(priority, actor, comment);
        return `Priority changed from ${previous} to ${request.priority}.`;
      },
    );
  }

  async assignTechnician(requestId, officerId, technicianId, comment = '') {
    return this.#runAction(
      { requestId, actorId: officerId, action: 'Technician Assigned' },
      ({ request, actor }) => {
        this.#requireOfficer(actor, 'assign Technicians');
        const technician = this.#requireUser(technicianId);
        if (!technician.canWorkOnRequests()) {
          throw new ValidationError(`${technician.userId} is a ${technician.getRole()}, not a Technician.`);
        }
        request.assignTechnician(technician.userId, actor, comment || `Assigned to ${technician.getFullName()}`);
        return `Assigned to Technician ${technician.userId} (${technician.getFullName()}).`;
      },
    );
  }

  async startWork(requestId, technicianId, comment = '') {
    return this.#runAction(
      { requestId, actorId: technicianId, action: 'Work Started' },
      ({ request, actor }) => {
        this.#requireAssignedTechnician(request, actor, 'start work on');
        request.startWork(actor, comment);
        return 'Status changed to In Progress.';
      },
    );
  }

  async addProgressNote(requestId, technicianId, note) {
    return this.#runAction(
      { requestId, actorId: technicianId, action: 'Progress Note Added' },
      ({ request, actor }) => {
        this.#requireAssignedTechnician(request, actor, 'add progress notes to');
        request.addProgressNote(actor, note);
        return `Note: ${String(note).trim()}`;
      },
    );
  }

  async resolveRequest(requestId, technicianId, resolutionNotes) {
    return this.#runAction(
      { requestId, actorId: technicianId, action: 'Request Resolved' },
      ({ request, actor }) => {
        this.#requireAssignedTechnician(request, actor, 'resolve');
        request.resolve(actor, resolutionNotes);
        return `Resolved: ${request.resolutionNotes}`;
      },
    );
  }

  async closeRequest(requestId, officerId, comment = '') {
    return this.#runAction(
      { requestId, actorId: officerId, action: 'Request Closed' },
      ({ request, actor }) => {
        this.#requireOfficer(actor, 'close requests');
        request.close(actor, comment);
        return 'Completion verified and request closed.';
      },
    );
  }

  // ============================================== FILTER, SORT AND HISTORY
  /**
   * Returns requests matching every filter supplied.
   * @param {object} filters { category, status, priority, technicianId, requesterId }
   */
  filterRequests({ category, status, priority, technicianId, requesterId } = {}, source = this.#requests) {
    if (category && !CATEGORIES.includes(category)) {
      throw new ValidationError(`"${category}" is not a supported category.`);
    }
    if (status && !STATUSES.includes(status)) throw new ValidationError(`"${status}" is not a recognised status.`);
    if (priority && !PRIORITIES.includes(priority)) throw new ValidationError(`"${priority}" is not a supported priority.`);

    const techId = technicianId ? String(technicianId).trim().toUpperCase() : null;
    const ownerId = requesterId ? String(requesterId).trim().toUpperCase() : null;
    return source.filter((request) =>
      (!category || request.category === category)
      && (!status || request.status === status)
      && (!priority || request.priority === priority)
      && (!techId || (request.assignedTechnicianId ?? '').toUpperCase() === techId)
      && (!ownerId || request.requesterId.toUpperCase() === ownerId));
  }

  getRequestsByTechnician(technicianId) {
    return this.filterRequests({ technicianId });
  }

  /**
   * Sorted copy of the requests. The original array is not changed.
   * @param {'dateSubmitted'|'priority'} sortBy
   * @param {'asc'|'desc'} order
   */
  sortRequests(sortBy = 'dateSubmitted', order = 'asc', source = this.#requests) {
    const direction = order === 'desc' ? -1 : 1;
    const byDate = (a, b) => a.dateSubmitted - b.dateSubmitted;
    let compare;
    if (sortBy === 'dateSubmitted') {
      compare = (a, b) => direction * byDate(a, b);
    } else if (sortBy === 'priority') {
      // Ties are broken by the oldest request first.
      compare = (a, b) => direction * (PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]) || byDate(a, b);
    } else {
      throw new ValidationError('Sort by must be "dateSubmitted" or "priority".');
    }
    return [...source].sort(compare);
  }

  getRequestHistory(requestId) {
    return this.#requireRequest(requestId).getHistory();
  }

  getAuditLog({ requestId, actorId } = {}) {
    return this.#auditLog
      .filter((entry) => (!requestId || entry.requestId === String(requestId).toUpperCase())
        && (!actorId || entry.actorId === String(actorId).toUpperCase()))
      .map((entry) => ({ ...entry }));
  }

  // ========================================================= PRIVATE HELPERS
  /**
   * Runs one request action: looks up the request and actor, runs the change,
   * writes an audit entry (Success or Rejected) and saves.
   */
  async #runAction({ requestId, actorId, action }, change) {
    const request = this.#requireRequest(requestId);
    const actor = this.#requireUser(actorId);
    const before = request.status;

    let detail;
    try {
      detail = change({ request, actor });
    } catch (error) {
      if (error instanceof PermissionError || error instanceof WorkflowError) {
        // Refused attempts are recorded too, so the administrator can see them.
        this.#addAudit({
          actorId: actor.userId,
          actorRole: actor.getRole(),
          action,
          requestId: request.requestId,
          description: error.message,
          outcome: 'Rejected',
        });
        await this.#save('audit').catch(() => {});
      }
      throw error;
    }

    const statusText = before !== request.status ? ` Status ${before} -> ${request.status}.` : '';
    this.#addAudit({
      actorId: actor.userId,
      actorRole: actor.getRole(),
      action,
      requestId: request.requestId,
      description: `${detail}${statusText}`,
      outcome: 'Success',
    });
    await this.#save('requests', 'audit');
    return request;
  }

  #requireUser(userId) {
    if (!String(userId ?? '').trim()) throw new ValidationError('A user ID is required.');
    const user = this.findUserById(userId);
    if (!user) throw new NotFoundError(`No user is registered with ID ${userId}.`);
    return user;
  }

  #requireRequest(requestId) {
    if (!String(requestId ?? '').trim()) throw new ValidationError('A request ID is required.');
    const request = this.findRequestById(requestId);
    if (!request) throw new NotFoundError(`No request found with ID ${requestId}.`);
    return request;
  }

  #requireOwner(request, user, verb) {
    if (request.requesterId !== user.userId) {
      throw new PermissionError(`You can only ${verb} your own requests. ${request.requestId} belongs to ${request.requesterId}.`);
    }
  }

  #requireOfficer(user, task) {
    if (!user.canManageRequests()) {
      throw new PermissionError(`Only a Service Officer can ${task}. ${user.userId} is a ${user.getRole()}.`);
    }
  }

  #requireAssignedTechnician(request, user, task) {
    if (!user.canWorkOnRequests()) {
      throw new PermissionError(`Only a Technician can ${task} a request. ${user.userId} is a ${user.getRole()}.`);
    }
    if (request.assignedTechnicianId !== user.userId) {
      throw new PermissionError(
        `Only the assigned Technician (${request.assignedTechnicianId ?? 'none yet'}) can ${task} ${request.requestId}.`,
      );
    }
  }

  #addAudit({ actorId, actorRole, action, requestId, description, outcome }) {
    const highest = this.#auditLog.reduce((max, entry) => {
      const number = Number.parseInt(String(entry.auditId).replace(/\D/g, ''), 10);
      return Number.isNaN(number) ? max : Math.max(max, number);
    }, 0);
    const entry = {
      auditId: `AUD${String(highest + 1).padStart(4, '0')}`,
      actorId,
      actorRole,
      action,
      requestId,
      description,
      timestamp: new Date().toISOString(),
      outcome,
    };
    this.#auditLog.push(entry);
    return entry;
  }

  /** Saves the named collections. Does nothing for an in-memory manager. */
  async #save(...parts) {
    if (!this.#dataStore) return;
    try {
      if (parts.includes('users')) await this.#dataStore.saveUsers(this.#users);
      if (parts.includes('requests')) await this.#dataStore.saveRequests(this.#requests);
      if (parts.includes('audit')) await this.#dataStore.saveAudit(this.#auditLog);
    } catch (error) {
      if (error instanceof DataFileError) throw error;
      throw new DataFileError(`Saving failed: ${error.message}`, null, error);
    }
  }
}

module.exports = ServiceRequestManager;
