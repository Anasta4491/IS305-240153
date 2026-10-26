'use strict';

const path = require('node:path');
const UserFileRepository = require('./UserFileRepository');
const ServiceRequestFileRepository = require('./ServiceRequestFileRepository');
const RequestHistoryFileRepository = require('./RequestHistoryFileRepository');
const AuditFileRepository = require('./AuditFileRepository');
const UserFactory = require('../users/UserFactory');
const ServiceRequestFactory = require('../requests/ServiceRequestFactory');

/**
 * Groups the four repositories for one data folder and converts between
 * plain JSON records and real objects.
 *
 * Loading:  JSON records -> UserFactory / ServiceRequestFactory -> objects
 * Saving:   objects -> toJSON() -> JSON records
 */
class CampusDataStore {
  #users;
  #requests;
  #history;
  #audit;

  constructor(dataFolder) {
    this.#users = new UserFileRepository(path.join(dataFolder, 'users.json'));
    this.#requests = new ServiceRequestFileRepository(path.join(dataFolder, 'serviceRequests.json'));
    this.#history = new RequestHistoryFileRepository(path.join(dataFolder, 'requestHistory.json'));
    this.#audit = new AuditFileRepository(path.join(dataFolder, 'auditLog.json'));
  }

  get userRepository() { return this.#users; }
  get requestRepository() { return this.#requests; }
  get historyRepository() { return this.#history; }
  get auditRepository() { return this.#audit; }

  /**
   * Loads every file and rebuilds the objects.
   * A record that fails validation is skipped and reported as a warning
   * rather than stopping the whole program.
   */
  async loadAll() {
    const warnings = [];
    const [userRecords, requestRecords, historyRecords, auditLog] = await Promise.all([
      this.#users.loadAll(),
      this.#requests.loadAll(),
      this.#history.loadAll(),
      this.#audit.loadAll(),
    ]);

    const users = [];
    for (const record of userRecords) {
      try {
        users.push(UserFactory.createFromData(record));
      } catch (error) {
        warnings.push(`Skipped user ${record?.userId ?? '(no ID)'} in users.json: ${error.message}`);
      }
    }
    const usersById = new Map(users.map((user) => [user.userId, user]));

    // Group history entries by request so each request gets its own history back.
    const historyByRequest = historyRecords.reduce((groups, entry) => {
      const { requestId, historyId, ...rest } = entry;
      if (!groups.has(requestId)) groups.set(requestId, []);
      groups.get(requestId).push(rest);
      return groups;
    }, new Map());

    const requests = [];
    for (const record of requestRecords) {
      const requester = usersById.get(record?.requesterId);
      if (!requester) {
        warnings.push(`Skipped request ${record?.requestId ?? '(no ID)'}: requester ${record?.requesterId} not found in users.json.`);
        continue;
      }
      try {
        const history = (historyByRequest.get(record.requestId) ?? [])
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        requests.push(ServiceRequestFactory.createFromData(record, { requester, history }));
      } catch (error) {
        warnings.push(`Skipped request ${record?.requestId ?? '(no ID)'} in serviceRequests.json: ${error.message}`);
      }
    }

    return { users, requests, auditLog, warnings };
  }

  async saveUsers(users) {
    return this.#users.saveAll(users.map((user) => user.toJSON()));
  }

  /** Saves the requests and, alongside them, every request's history. */
  async saveRequests(requests) {
    let counter = 0;
    const historyRecords = requests.flatMap((request) =>
      request.getHistory().map((entry) => {
        counter += 1;
        return { historyId: `HIS${String(counter).padStart(5, '0')}`, requestId: request.requestId, ...entry };
      }));
    await this.#requests.saveAll(requests.map((request) => request.toJSON()));
    await this.#history.saveAll(historyRecords);
    return requests.length;
  }

  async saveAudit(entries) {
    return this.#audit.saveAll(entries);
  }
}

module.exports = CampusDataStore;
