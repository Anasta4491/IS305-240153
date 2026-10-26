'use strict';

const User = require('../User');
const StudentRequester = require('./StudentRequester');
const StaffRequester = require('./StaffRequester');
const ServiceOfficer = require('./ServiceOfficer');
const Technician = require('./Technician');
const SystemAdministrator = require('./SystemAdministrator');
const { USER_TYPES } = require('../constants');

/**
 * Builds the correct User subclass from plain data, for example a record
 * loaded from users.json or the answers typed into the registration menu.
 */
class UserFactory {
  static createFromData(data = {}) {
    const { userId, firstName, lastName, email } = data;
    const common = { userId, firstName, lastName, email };

    switch (data.userType) {
      case USER_TYPES.STUDENT:
        return new StudentRequester(common, { programme: data.programme, yearLevel: data.yearLevel });
      case USER_TYPES.STAFF:
        return new StaffRequester(common, { department: data.department });
      case USER_TYPES.SERVICE_OFFICER:
        return new ServiceOfficer(common, { serviceSection: data.serviceSection });
      case USER_TYPES.TECHNICIAN:
        return new Technician(common, { speciality: data.speciality });
      case USER_TYPES.ADMINISTRATOR:
        return new SystemAdministrator(common);
      default:
        // Falls back to the base class, which rejects an unknown user type.
        return new User(data);
    }
  }
}

module.exports = UserFactory;
