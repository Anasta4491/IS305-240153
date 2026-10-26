'use strict';

const User = require('../User');
const { USER_TYPES } = require('../constants');
const { ValidationError } = require('../errors');

/** A student who reports campus problems. */
class StudentRequester extends User {
  #programme;
  #yearLevel;

  constructor(userData = {}, { programme, yearLevel } = {}) {
    // Constructor chaining: the base User constructor sets and checks the shared fields.
    super({ ...userData, userType: USER_TYPES.STUDENT });
    this.#programme = programme === undefined || programme === null ? '' : String(programme).trim();
    this.#yearLevel = Number(yearLevel);
    this.validateSpecialisedFields();
  }

  get programme() { return this.#programme; }
  get yearLevel() { return this.#yearLevel; }

  set yearLevel(value) {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 1 || year > 6) {
      throw new ValidationError('Year level must be a whole number from 1 to 6.');
    }
    this.#yearLevel = year;
  }

  canSubmitRequests() { return true; }

  validateSpecialisedFields() {
    if (!this.#programme) throw new ValidationError('Programme is required for a student.');
    if (!Number.isInteger(this.#yearLevel) || this.#yearLevel < 1 || this.#yearLevel > 6) {
      throw new ValidationError('Year level must be a whole number from 1 to 6.');
    }
    return true;
  }

  validate() {
    super.validate();
    return this.validateSpecialisedFields();
  }

  displayInfo() {
    return `${super.displayInfo()}\nProgramme : ${this.#programme}\nYear Level: ${this.#yearLevel}`;
  }

  getSpecialisedData() {
    return { programme: this.#programme, yearLevel: this.#yearLevel };
  }
}

module.exports = StudentRequester;
