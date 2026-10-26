'use strict';

const JsonFileRepository = require('./JsonFileRepository');

/** users.json */
class UserFileRepository extends JsonFileRepository {
  constructor(filePath) {
    super(filePath, 'userId');
  }

  async findByType(userType) {
    return this.findWhere((record) => record.userType === userType);
  }
}

module.exports = UserFileRepository;
