'use strict';

const JsonFileRepository = require('./JsonFileRepository');

/** requestHistory.json: every history entry, tagged with its requestId. */
class RequestHistoryFileRepository extends JsonFileRepository {
  constructor(filePath) {
    super(filePath, 'historyId');
  }

  async findByRequest(requestId) {
    return this.findWhere((record) => record.requestId === requestId);
  }
}

module.exports = RequestHistoryFileRepository;
