'use strict';

const JsonFileRepository = require('./JsonFileRepository');

/** auditLog.json */
class AuditFileRepository extends JsonFileRepository {
  constructor(filePath) {
    super(filePath, 'auditId');
  }

  async findByRequest(requestId) {
    return this.findWhere((record) => record.requestId === requestId);
  }

  async findByActor(actorId) {
    return this.findWhere((record) => record.actorId === actorId);
  }
}

module.exports = AuditFileRepository;
