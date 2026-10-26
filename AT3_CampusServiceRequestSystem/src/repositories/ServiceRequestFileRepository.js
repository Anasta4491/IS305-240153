'use strict';

const JsonFileRepository = require('./JsonFileRepository');

/** serviceRequests.json */
class ServiceRequestFileRepository extends JsonFileRepository {
  constructor(filePath) {
    super(filePath, 'requestId');
  }

  async findByRequester(userId) {
    return this.findWhere((record) => record.requesterId === userId);
  }

  async findByTechnician(technicianId) {
    return this.findWhere((record) => record.assignedTechnicianId === technicianId);
  }
}

module.exports = ServiceRequestFileRepository;
