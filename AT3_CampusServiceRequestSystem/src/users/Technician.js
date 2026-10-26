'use strict';

const User = require('../User');
const { USER_TYPES } = require('../constants');
const { ValidationError } = require('../errors');

/** Carries out assigned work, records progress and resolves requests. */
class Technician extends User {
  #speciality;

  constructor(userData = {}, { speciality } = {}) {
    super({ ...userData, userType: USER_TYPES.TECHNICIAN });
    this.#speciality = speciality === undefined || speciality === null ? '' : String(speciality).trim();
    this.validateSpecialisedFields();
  }

  get speciality() { return this.#speciality; }

  canSubmitRequests() { return false; }
  canWorkOnRequests() { return true; }

  validateSpecialisedFields() {
    if (!this.#speciality) throw new ValidationError('Technical speciality is required for a Technician.');
    return true;
  }

  validate() {
    super.validate();
    return this.validateSpecialisedFields();
  }

  displayInfo() {
    return `${super.displayInfo()}\nSpeciality: ${this.#speciality}`;
  }

  getSpecialisedData() {
    return { speciality: this.#speciality };
  }
}

module.exports = Technician;
