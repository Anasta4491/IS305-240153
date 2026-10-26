'use strict';

const path = require('node:path');
const readline = require('node:readline');

const ServiceRequestManager = require('./ServiceRequestManager');
const ServiceRequest = require('./ServiceRequest');
const CampusDataStore = require('./repositories/CampusDataStore');
const UserFactory = require('./users/UserFactory');
const ServiceRequestFactory = require('./requests/ServiceRequestFactory');
const ICTSupportRequest = require('./requests/ICTSupportRequest');
const MaintenanceRequest = require('./requests/MaintenanceRequest');
const CleaningRequest = require('./requests/CleaningRequest');
const GeneralServiceRequest = require('./requests/GeneralServiceRequest');
const ReportGenerator = require('./reports/ReportGenerator');
const { CATEGORIES, PRIORITIES, STATUSES, STATUS, USER_TYPE_LIST, USER_TYPES } = require('./constants');
const { AppError, DataFileError, ValidationError, PermissionError } = require('./errors');

const LINE = '============================================';

/** Thrown when the input stream ends (for example at the end of a piped script). */
class InputClosedError extends Error {}

/**
 * Wraps readline so the app can ask a question and wait for one line.
 * Uses an async iterator, which works both when typing and when input is piped
 * in from a file (useful for demonstrations).
 */
class ConsoleIO {
  #rl;
  #lines;
  #echo;

  constructor(input = process.stdin, output = process.stdout) {
    this.#rl = readline.createInterface({ input, output, terminal: false });
    this.#lines = this.#rl[Symbol.asyncIterator]();
    this.#echo = !input.isTTY; // show piped answers so the transcript is readable
    this.output = output;
  }

  print(text = '') {
    this.output.write(`${text}\n`);
  }

  async ask(prompt) {
    this.output.write(prompt);
    const { value, done } = await this.#lines.next();
    if (done) throw new InputClosedError();
    if (this.#echo) this.output.write(`${value}\n`);
    return value.trim();
  }

  close() {
    this.#rl.close();
  }
}

/**
 * The console user interface. It only talks to the ServiceRequestManager
 * (and the factories and reports); it never reads or writes JSON files.
 */
class CampusServiceApp {
  #manager;
  #io;

  constructor(manager, io) {
    this.#manager = manager;
    this.#io = io;
  }

  async run() {
    const actions = {
      1: () => this.registerUser(),
      2: () => this.submitRequest(),
      3: () => this.viewRequestById(),
      4: () => this.viewMyRequests(),
      5: () => this.viewAllRequests(),
      6: () => this.updateMyRequest(),
      7: () => this.cancelMyRequest(),
      8: () => this.searchRequests(),
      9: () => this.viewSummary(),
      10: () => this.officerWorkspace(),
      11: () => this.technicianWorkspace(),
      12: () => this.filterAndSort(),
      13: () => this.viewHistory(),
      14: () => this.managementReports(),
      15: () => this.viewAuditLog(),
    };

    try {
      for (;;) {
        this.#showMainMenu();
        const choice = await this.#io.ask('Select an option: ');
        if (choice === '0') break;
        const action = actions[choice];
        if (!action) {
          this.#error('Please choose a number from the menu.');
          continue;
        }
        await this.#safely(action);
      }
      this.#io.print('\nGoodbye. All changes have been saved.');
    } catch (error) {
      if (!(error instanceof InputClosedError)) throw error;
      this.#io.print('\n\nInput ended. Goodbye.');
    } finally {
      this.#io.close();
    }
  }

  #showMainMenu() {
    this.#io.print(`\n${LINE}\n     CAMPUS SERVICE REQUEST SYSTEM\n${LINE}`);
    [
      '1. Register User',
      '2. Submit Service Request',
      '3. View Request by ID',
      '4. View My Requests',
      '5. View All Requests',
      '6. Update My Request',
      '7. Cancel My Request',
      '8. Search Requests',
      '9. View Request Summary',
      '--------------------------------------------',
      '10. Service Officer Workspace',
      '11. Technician Workspace',
      '12. Filter and Sort Requests',
      '13. View Request History',
      '14. Management Reports',
      '15. Audit Log',
      '0. Exit',
    ].forEach((item) => this.#io.print(item));
    this.#io.print(LINE);
  }

  // ======================================================= PASS FEATURES
  async registerUser() {
    this.#heading('Register User');
    const userType = await this.#choose('User type', USER_TYPE_LIST);
    const data = {
      userType,
      userId: (await this.#io.ask('User ID (e.g. DWU2026001): ')).toUpperCase(),
      firstName: await this.#io.ask('First name: '),
      lastName: await this.#io.ask('Last name: '),
      email: await this.#io.ask('Email address: '),
    };

    if (userType === USER_TYPES.STUDENT) {
      data.programme = await this.#io.ask('Programme of study: ');
      data.yearLevel = await this.#io.ask('Year level (1-6): ');
    } else if (userType === USER_TYPES.STAFF) {
      data.department = await this.#io.ask('Department: ');
    } else if (userType === USER_TYPES.SERVICE_OFFICER) {
      data.serviceSection = await this.#io.ask('Service section: ');
    } else if (userType === USER_TYPES.TECHNICIAN) {
      data.speciality = await this.#io.ask('Technical speciality: ');
    }

    const user = UserFactory.createFromData(data);
    await this.#manager.registerUser(user);
    this.#ok(`User ${user.userId} registered successfully.`);
    this.#io.print(user.displayInfo());
  }

  async submitRequest() {
    this.#heading('Submit Service Request');
    const requester = this.#requireUser(await this.#io.ask('Your user ID: '));
    if (!requester.canSubmitRequests()) {
      throw new PermissionError(`${requester.getRole()} accounts cannot submit requests. Use a Student or Staff account.`);
    }

    const category = await this.#choose('Category', CATEGORIES);
    const common = {
      requestId: this.#manager.generateRequestId(),
      requester,
      category,
      title: await this.#io.ask('Title: '),
      description: await this.#io.ask('Description: '),
      location: await this.#io.ask('Campus location: '),
      priority: await this.#choose('Priority', PRIORITIES, { defaultValue: 'Normal' }),
    };
    const specialised = await this.#askSpecialisedFields(category);

    const request = ServiceRequestFactory.create(common, specialised);
    await this.#manager.submitRequest(request);
    this.#ok(`Request ${request.requestId} submitted with status ${request.status}.`);
    this.#io.print(request.getRequestSummary());
  }

  async viewRequestById() {
    this.#heading('View Request by ID');
    const request = this.#requireRequest(await this.#io.ask('Request ID: '));
    this.#io.print(request.getRequestSummary());
    if (request.resolutionNotes) this.#io.print(`Resolution  : ${request.resolutionNotes}`);
  }

  async viewMyRequests() {
    this.#heading('View My Requests');
    const user = this.#requireUser(await this.#io.ask('Your user ID: '));
    this.#printList(this.#manager.getRequestsByUser(user.userId), `Requests for ${user.getFullName()}`);
  }

  async viewAllRequests() {
    this.#heading('View All Requests');
    this.#printList(this.#manager.getAllRequests(), 'All requests');
  }

  async updateMyRequest() {
    this.#heading('Update My Request');
    const user = this.#requireUser(await this.#io.ask('Your user ID: '));
    const request = this.#requireRequest(await this.#io.ask('Request ID to update: '));
    this.#io.print(request.getRequestSummary());
    this.#io.print('\nPress Enter to keep the current value.');

    const changes = {
      title: await this.#io.ask(`Title [${request.title}]: `),
      description: await this.#io.ask('Description [keep]: '),
      location: await this.#io.ask(`Location [${request.location}]: `),
      priority: await this.#choose('Priority', PRIORITIES, { defaultValue: '', current: request.priority }),
    };
    const specialisedNow = request.getSpecialisedData();
    for (const field of request.getEditableSpecialisedFields()) {
      changes[field] = await this.#io.ask(`${CampusServiceApp.#label(field)} [${specialisedNow[field]}]: `);
    }
    // Only send fields that actually changed.
    for (const [key, value] of Object.entries(changes)) {
      const current = key in specialisedNow ? specialisedNow[key] : request[key];
      if (value === '' || value === current) delete changes[key];
    }

    await this.#manager.updateRequest(request.requestId, user.userId, changes);
    this.#ok(`Request ${request.requestId} updated.`);
    this.#io.print(request.getRequestSummary());
  }

  async cancelMyRequest() {
    this.#heading('Cancel My Request');
    const user = this.#requireUser(await this.#io.ask('Your user ID: '));
    const request = this.#requireRequest(await this.#io.ask('Request ID to cancel: '));
    const reason = await this.#io.ask('Reason for cancelling (optional): ');
    const confirm = await this.#io.ask(`Cancel ${request.requestId} "${request.title}"? (y/n): `);
    if (confirm.toLowerCase() !== 'y') {
      this.#io.print('Cancellation stopped. Nothing was changed.');
      return;
    }
    await this.#manager.cancelRequest(request.requestId, user.userId, reason);
    this.#ok(`Request ${request.requestId} is now ${request.status}.`);
  }

  async searchRequests() {
    this.#heading('Search Requests');
    const text = await this.#io.ask('Search text (request ID, title, description or location): ');
    const results = this.#manager.searchRequests(text);
    this.#printList(results, `${results.length} result(s) for "${text}"`);
  }

  async viewSummary() {
    this.#heading('Request Summary by Status');
    const { Total, ...counts } = this.#manager.getRequestSummaryByStatus();
    this.#io.print(ReportGenerator.formatCounts('Requests by status', counts));
    if (Total === 0) this.#io.print('No requests have been submitted yet.');
  }

  // ===================================================== CREDIT FEATURES
  async officerWorkspace() {
    this.#heading('Service Officer Workspace');
    const officer = this.#requireUser(await this.#io.ask('Service Officer ID: '));
    if (!officer.canManageRequests()) {
      throw new PermissionError(`Only Service Officers can use this workspace. ${officer.userId} is a ${officer.getRole()}.`);
    }
    this.#io.print(`Welcome, ${officer.getFullName()} (${officer.serviceSection}).`);

    for (;;) {
      this.#io.print('\n-- Officer Menu --');
      ['1. Requests waiting for review', '2. Review a request', '3. Set priority', '4. Assign a Technician',
        '5. Resolved requests waiting to close', '6. Close a request', '0. Back'].forEach((item) => this.#io.print(item));
      const choice = await this.#io.ask('Select: ');
      if (choice === '0') return;

      await this.#safely(async () => {
        if (choice === '1') {
          this.#printList(this.#manager.sortRequests('priority', 'desc', this.#manager.filterRequests({ status: STATUS.SUBMITTED })), 'Waiting for review (highest priority first)');
        } else if (choice === '2') {
          const id = await this.#io.ask('Request ID: ');
          const comment = await this.#io.ask('Review comment: ');
          const request = await this.#manager.reviewRequest(id, officer.userId, comment);
          this.#ok(`${request.requestId} is now ${request.status}.`);
        } else if (choice === '3') {
          const id = await this.#io.ask('Request ID: ');
          const priority = await this.#choose('New priority', PRIORITIES);
          const comment = await this.#io.ask('Reason (optional): ');
          const request = await this.#manager.setPriority(id, officer.userId, priority, comment);
          this.#ok(`${request.requestId} priority is now ${request.priority}.`);
        } else if (choice === '4') {
          const id = await this.#io.ask('Request ID: ');
          this.#io.print('Technicians:');
          this.#manager.getUsersByType(USER_TYPES.TECHNICIAN).forEach((tech) => {
            const load = this.#manager.getRequestsByTechnician(tech.userId).filter((r) => !r.isFinal() && r.status !== STATUS.RESOLVED).length;
            this.#io.print(`  ${tech.userId} - ${tech.getFullName()} (${tech.speciality}) - ${load} open job(s)`);
          });
          const techId = await this.#io.ask('Technician ID: ');
          const comment = await this.#io.ask('Instructions for the Technician (optional): ');
          const request = await this.#manager.assignTechnician(id, officer.userId, techId, comment);
          this.#ok(`${request.requestId} assigned to ${request.assignedTechnicianId}. Status: ${request.status}.`);
        } else if (choice === '5') {
          this.#printList(this.#manager.filterRequests({ status: STATUS.RESOLVED }), 'Resolved, waiting for verification');
        } else if (choice === '6') {
          const id = await this.#io.ask('Request ID: ');
          const comment = await this.#io.ask('Verification comment: ');
          const request = await this.#manager.closeRequest(id, officer.userId, comment);
          this.#ok(`${request.requestId} is now ${request.status}.`);
        } else {
          this.#error('Please choose a number from the officer menu.');
        }
      });
    }
  }

  async technicianWorkspace() {
    this.#heading('Technician Workspace');
    const technician = this.#requireUser(await this.#io.ask('Technician ID: '));
    if (!technician.canWorkOnRequests()) {
      throw new PermissionError(`Only Technicians can use this workspace. ${technician.userId} is a ${technician.getRole()}.`);
    }
    this.#io.print(`Welcome, ${technician.getFullName()} (${technician.speciality}).`);

    for (;;) {
      this.#io.print('\n-- Technician Menu --');
      ['1. My assigned requests', '2. Start work', '3. Add progress note', '4. Resolve a request', '0. Back']
        .forEach((item) => this.#io.print(item));
      const choice = await this.#io.ask('Select: ');
      if (choice === '0') return;

      await this.#safely(async () => {
        if (choice === '1') {
          const mine = this.#manager.sortRequests('priority', 'desc', this.#manager.getRequestsByTechnician(technician.userId));
          this.#printList(mine, `Assigned to ${technician.userId}`);
        } else if (choice === '2') {
          const id = await this.#io.ask('Request ID: ');
          const comment = await this.#io.ask('Comment (optional): ');
          const request = await this.#manager.startWork(id, technician.userId, comment);
          this.#ok(`${request.requestId} is now ${request.status}.`);
        } else if (choice === '3') {
          const id = await this.#io.ask('Request ID: ');
          const note = await this.#io.ask('Progress note: ');
          await this.#manager.addProgressNote(id, technician.userId, note);
          this.#ok('Progress note saved.');
        } else if (choice === '4') {
          const id = await this.#io.ask('Request ID: ');
          const notes = await this.#io.ask('Resolution notes (what was done): ');
          const request = await this.#manager.resolveRequest(id, technician.userId, notes);
          this.#ok(`${request.requestId} is now ${request.status}. A Service Officer will verify and close it.`);
        } else {
          this.#error('Please choose a number from the technician menu.');
        }
      });
    }
  }

  async filterAndSort() {
    this.#heading('Filter and Sort Requests');
    this.#io.print('Leave any filter blank to include everything.');
    const filters = {
      category: await this.#choose('Category', CATEGORIES, { defaultValue: '' }),
      status: await this.#choose('Status', STATUSES, { defaultValue: '' }),
      priority: await this.#choose('Priority', PRIORITIES, { defaultValue: '' }),
      technicianId: (await this.#io.ask('Assigned Technician ID (blank for any): ')).toUpperCase(),
    };
    const sortBy = await this.#choose('Sort by', ['dateSubmitted', 'priority'], { defaultValue: 'dateSubmitted' });
    const order = await this.#choose('Order', ['asc', 'desc'], { defaultValue: 'asc' });

    const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const results = this.#manager.sortRequests(sortBy, order, this.#manager.filterRequests(active));
    const described = Object.entries(active).map(([key, value]) => `${key}=${value}`).join(', ') || 'no filters';
    this.#printList(results, `${results.length} request(s) [${described}; sorted by ${sortBy} ${order}]`);
  }

  async viewHistory() {
    this.#heading('Request History');
    const request = this.#requireRequest(await this.#io.ask('Request ID: '));
    const rows = request.getHistory().map((entry) => ({
      time: ServiceRequest.formatDate(entry.timestamp),
      change: entry.previousStatus === entry.newStatus ? entry.newStatus : `${entry.previousStatus} -> ${entry.newStatus}`,
      action: entry.action,
      actor: `${entry.actorId} (${entry.actorRole})`,
      comment: entry.comment,
    }));
    this.#io.print(ReportGenerator.formatTable(`History for ${request.requestId}: ${request.title}`, rows, [
      { key: 'time', label: 'Date/Time' },
      { key: 'change', label: 'Status' },
      { key: 'action', label: 'Action' },
      { key: 'actor', label: 'Actor' },
      { key: 'comment', label: 'Comment' },
    ]));
  }

  // ================================================= DISTINCTION FEATURES
  async managementReports() {
    this.#heading('Management Reports');
    const viewer = this.#requireUser(await this.#io.ask('Administrator or Service Officer ID: '));
    if (!viewer.canViewReports()) {
      throw new PermissionError(`Reports are only available to Administrators and Service Officers. ${viewer.userId} is a ${viewer.getRole()}.`);
    }

    const reports = new ReportGenerator(this.#manager.getAllRequests(), this.#manager.getAllUsers());
    for (;;) {
      this.#io.print('\n-- Reports --');
      ['1. Requests by status', '2. Requests by category', '3. Requests by priority', '4. Urgent open requests',
        '5. Overdue requests', '6. Requests assigned to each Technician', '7. Completed requests by Technician',
        '8. Average resolution time', '9. Request volume by campus location', '10. Priority scores (polymorphism demo)',
        '0. Back'].forEach((item) => this.#io.print(item));
      const choice = await this.#io.ask('Select: ');
      if (choice === '0') return;
      this.#io.print('');

      switch (choice) {
        case '1': this.#io.print(ReportGenerator.formatCounts('Requests grouped by status', reports.groupByStatus())); break;
        case '2': this.#io.print(ReportGenerator.formatCounts('Requests grouped by category', reports.groupByCategory())); break;
        case '3': this.#io.print(ReportGenerator.formatCounts('Requests grouped by priority', reports.groupByPriority())); break;
        case '4': this.#printList(reports.getUrgentRequests(), 'Urgent open requests (highest score first)'); break;
        case '5':
          this.#io.print(ReportGenerator.formatTable('Overdue requests', reports.getOverdueRequests(), [
            { key: 'requestId', label: 'ID' }, { key: 'status', label: 'Status' }, { key: 'targetHours', label: 'Target h' },
            { key: 'ageHours', label: 'Age h' }, { key: 'hoursOverdue', label: 'Overdue h' }, { key: 'title', label: 'Title' },
          ]));
          break;
        case '6':
          this.#io.print(ReportGenerator.formatTable('Requests assigned to each Technician', reports.getAssignmentsByTechnician(), [
            { key: 'technicianId', label: 'Technician' }, { key: 'name', label: 'Name' }, { key: 'assigned', label: 'Assigned' },
            { key: 'open', label: 'Open' }, { key: 'completed', label: 'Completed' },
          ]));
          break;
        case '7':
          this.#io.print(ReportGenerator.formatTable('Completed requests by Technician', reports.getCompletedByTechnician(), [
            { key: 'technicianId', label: 'Technician' }, { key: 'name', label: 'Name' }, { key: 'completed', label: 'Completed' },
          ]));
          break;
        case '8': {
          const avg = reports.getAverageResolutionTime();
          const rows = Object.entries(avg.byCategory).map(([category, hours]) => ({ category, hours: hours ?? 'n/a' }));
          rows.push({ category: 'ALL CATEGORIES', hours: avg.overallHours ?? 'n/a' });
          this.#io.print(ReportGenerator.formatTable(`Average resolution time in hours (${avg.resolvedCount} resolved)`, rows, [
            { key: 'category', label: 'Category' }, { key: 'hours', label: 'Avg hours' },
          ]));
          break;
        }
        case '9':
          this.#io.print(ReportGenerator.formatTable('Request volume by campus location', reports.getVolumeByLocation(), [
            { key: 'location', label: 'Location' }, { key: 'count', label: 'Requests' },
          ]));
          break;
        case '10': this.#polymorphismDemo(); break;
        default: this.#error('Please choose a number from the reports menu.');
      }
    }
  }

  /** Same three method calls on every request; each subclass answers differently. */
  #polymorphismDemo() {
    const rows = this.#manager.getAllRequests().map((request) => ({
      requestId: request.requestId,
      type: request.requestType,
      priority: request.priority,
      score: request.calculatePriorityScore(),
      target: request.getTargetResolutionHours(),
      title: request.title,
    }));
    this.#io.print(ReportGenerator.formatTable('calculatePriorityScore() and getTargetResolutionHours() on every request', rows, [
      { key: 'requestId', label: 'ID' }, { key: 'type', label: 'Class' }, { key: 'priority', label: 'Priority' },
      { key: 'score', label: 'Score' }, { key: 'target', label: 'Target h' }, { key: 'title', label: 'Title' },
    ]));
  }

  async viewAuditLog() {
    this.#heading('Audit Log');
    const viewer = this.#requireUser(await this.#io.ask('Administrator ID: '));
    if (viewer.userType !== USER_TYPES.ADMINISTRATOR) {
      throw new PermissionError(`Only a System Administrator can view the audit log. ${viewer.userId} is a ${viewer.getRole()}.`);
    }
    const requestId = (await this.#io.ask('Filter by request ID (blank for all): ')).toUpperCase();
    const entries = this.#manager.getAuditLog(requestId ? { requestId } : {});
    const rows = entries.map((entry) => ({ ...entry, timestamp: ServiceRequest.formatDate(entry.timestamp), requestId: entry.requestId ?? '-' }));
    this.#io.print(ReportGenerator.formatTable(`Audit log (${entries.length} entries)`, rows, [
      { key: 'auditId', label: 'Audit ID' }, { key: 'timestamp', label: 'Date/Time' }, { key: 'actorId', label: 'Actor' },
      { key: 'actorRole', label: 'Role' }, { key: 'action', label: 'Action' }, { key: 'requestId', label: 'Request' },
      { key: 'outcome', label: 'Outcome' }, { key: 'description', label: 'Description' },
    ]));
  }

  // ============================================================ HELPERS
  async #askSpecialisedFields(category) {
    this.#io.print(`\n${category} details:`);
    switch (category) {
      case 'ICT Support':
        return {
          deviceType: await this.#io.ask('Device type (e.g. Laptop, Projector, Printer): '),
          systemName: await this.#io.ask('System or service name (e.g. Campus Wi-Fi, Moodle): '),
          faultType: await this.#choose('Fault type', ICTSupportRequest.FAULT_TYPES),
          networkImpact: await this.#choose('Network impact', ICTSupportRequest.NETWORK_IMPACTS),
        };
      case 'Facilities Maintenance':
        return {
          building: await this.#io.ask('Building: '),
          roomNumber: await this.#io.ask('Room number: '),
          hazardLevel: await this.#choose('Hazard level', MaintenanceRequest.HAZARD_LEVELS),
          equipmentAffected: await this.#io.ask('Equipment affected: '),
        };
      case 'Cleaning and Sanitation':
        return {
          cleaningArea: await this.#io.ask('Area to be cleaned: '),
          hygieneRisk: await this.#choose('Hygiene risk', CleaningRequest.HYGIENE_RISKS),
          serviceType: await this.#choose('Service type', CleaningRequest.SERVICE_TYPES),
          preferredServiceTime: await this.#choose('Preferred service time', CleaningRequest.SERVICE_TIMES),
        };
      default:
        return { serviceArea: await this.#choose('Service area', GeneralServiceRequest.SERVICE_AREAS) };
    }
  }

  /**
   * Shows a numbered list and accepts the number or the text itself.
   * With a defaultValue, pressing Enter returns that value.
   */
  async #choose(label, options, { defaultValue, current } = {}) {
    const list = options.map((option, i) => `${i + 1}) ${option}`).join('  ');
    const hint = current ? ` [current: ${current}]` : (defaultValue ? ` [Enter = ${defaultValue}]` : (defaultValue === '' ? ' [Enter = any/keep]' : ''));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const answer = await this.#io.ask(`${label}: ${list}${hint}\n> `);
      if (answer === '' && defaultValue !== undefined) return defaultValue;
      const byNumber = options[Number(answer) - 1];
      const byText = options.find((option) => option.toLowerCase() === answer.toLowerCase());
      if (/^\d+$/.test(answer) && byNumber) return byNumber;
      if (byText) return byText;
      this.#error(`"${answer}" is not one of the listed options.`);
    }
    throw new ValidationError(`No valid ${label.toLowerCase()} was chosen.`);
  }

  #requireUser(userId) {
    if (!userId) throw new ValidationError('A user ID is required.');
    const user = this.#manager.findUserById(userId);
    if (!user) throw new ValidationError(`No user is registered with ID ${userId}. Register first (option 1).`);
    return user;
  }

  #requireRequest(requestId) {
    if (!requestId) throw new ValidationError('A request ID is required.');
    const request = this.#manager.findRequestById(requestId);
    if (!request) throw new ValidationError(`No request found with ID ${requestId}.`);
    return request;
  }

  #printList(requests, title) {
    this.#io.print(`\n${title}`);
    if (requests.length === 0) {
      this.#io.print('  (no requests found)');
      return;
    }
    this.#io.print(`  ${'ID'.padEnd(7)} | ${'Status'.padEnd(11)} | ${'Prio'.padEnd(6)} | ${'Category'.padEnd(23)} | Title`);
    this.#io.print(`  ${'-'.repeat(80)}`);
    requests.forEach((request) => this.#io.print(`  ${request.getShortSummary()}`));
  }

  async #safely(action) {
    try {
      await action();
    } catch (error) {
      if (error instanceof InputClosedError) throw error;
      if (error instanceof DataFileError) this.#error(`File error: ${error.message}`);
      else if (error instanceof AppError) this.#error(error.message);
      else if (error instanceof TypeError || error instanceof RangeError) this.#error(`Unexpected problem: ${error.message}`);
      else throw error;
    }
  }

  #heading(text) { this.#io.print(`\n--- ${text} ---`); }
  #ok(text) { this.#io.print(`[OK] ${text}`); }
  #error(text) { this.#io.print(`[ERROR] ${text}`); }

  static #label(field) {
    return field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }
}

async function main() {
  const dataFolder = process.env.CAMPUS_DATA_DIR || path.join(__dirname, '..', 'data');
  const io = new ConsoleIO();
  let manager;
  try {
    const result = await ServiceRequestManager.createWithDataStore(new CampusDataStore(dataFolder));
    manager = result.manager;
    io.print(`Loaded ${manager.getAllUsers().length} user(s) and ${manager.getAllRequests().length} request(s) from ${dataFolder}`);
    result.warnings.forEach((warning) => io.print(`[WARNING] ${warning}`));
  } catch (error) {
    io.print(`[ERROR] The data files could not be loaded. ${error.message}`);
    io.print('Fix or remove the damaged file in the data folder and start the program again.');
    io.close();
    process.exitCode = 1;
    return;
  }
  await new CampusServiceApp(manager, io).run();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[FATAL] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { CampusServiceApp, ConsoleIO, main };
