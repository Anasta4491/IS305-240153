'use strict';

const User = require('../User');
const { USER_TYPES } = require('../constants');

/** Reviews system records, the audit history and management reports. */
class SystemAdministrator extends User {
  constructor(userData = {}) {
    super({ ...userData, userType: USER_TYPES.ADMINISTRATOR });
  }

  canSubmitRequests() { return false; }
  canViewReports() { return true; }
}

module.exports = SystemAdministrator;
