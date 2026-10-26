'use strict';

const User = require('../User');
const { USER_TYPES } = require('../constants');
const { ValidationError } = require('../errors');

/** A staff member who reports campus problems. */
class StaffRequester extends User {
  #department;

  constructor(userData = {}, { department } = {}) {
    super({ ...userData, userType: USER_TYPES.STAFF });
    this.#department = department === undefined || department === null ? '' : String(department).trim();
    this.validateSpecialisedFields();
  }

  get department() { return this.#department; }

  set department(value) {
    const department = value === undefined || value === null ? '' : String(value).trim();
    if (!department) throw new ValidationError('Department is required for a staff member.');
    this.#department = department;
  }

  canSubmitRequests() { return true; }

  validateSpecialisedFields() {
    if (!this.#department) throw new ValidationError('Department is required for a staff member.');
    return true;
  }

  validate() {
    super.validate();
    return this.validateSpecialisedFields();
  }

  displayInfo() {
    return `${super.displayInfo()}\nDepartment: ${this.#department}`;
  }

  getSpecialisedData() {
    return { department: this.#department };
  }
}

module.exports = StaffRequester;
