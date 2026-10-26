'use strict';

const User = require('../User');
const { USER_TYPES } = require('../constants');
const { ValidationError } = require('../errors');

/** Reviews requests, sets priority, assigns Technicians and closes resolved work. */
class ServiceOfficer extends User {
  #serviceSection;

  constructor(userData = {}, { serviceSection } = {}) {
    super({ ...userData, userType: USER_TYPES.SERVICE_OFFICER });
    this.#serviceSection = serviceSection === undefined || serviceSection === null ? '' : String(serviceSection).trim();
    this.validateSpecialisedFields();
  }

  get serviceSection() { return this.#serviceSection; }

  canSubmitRequests() { return false; }
  canManageRequests() { return true; }
  canViewReports() { return true; }

  validateSpecialisedFields() {
    if (!this.#serviceSection) throw new ValidationError('Service section is required for a Service Officer.');
    return true;
  }

  validate() {
    super.validate();
    return this.validateSpecialisedFields();
  }

  displayInfo() {
    return `${super.displayInfo()}\nSection   : ${this.#serviceSection}`;
  }

  getSpecialisedData() {
    return { serviceSection: this.#serviceSection };
  }
}

module.exports = ServiceOfficer;
