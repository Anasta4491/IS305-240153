'use strict';

const { USER_TYPE_LIST, USER_TYPES, EMAIL_PATTERN } = require('./constants');
const { ValidationError } = require('./errors');

/**
 * Base class for everyone who uses the system.
 * All identity data is held in private (#) fields, so it can only be changed
 * through the controlled setters below, which validate every new value.
 */
class User {
  #userId;
  #firstName;
  #lastName;
  #email;
  #userType;

  /**
   * @param {object} data
   * @param {string} data.userId    e.g. "DWU2026001"
   * @param {string} data.firstName
   * @param {string} data.lastName
   * @param {string} data.email
   * @param {string} data.userType  one of USER_TYPE_LIST
   */
  constructor({ userId, firstName, lastName, email, userType } = {}) {
    this.#userId = User.#clean(userId);
    this.#firstName = User.#clean(firstName);
    this.#lastName = User.#clean(lastName);
    this.#email = User.#clean(email).toLowerCase();
    this.#userType = User.#clean(userType);

    // Only the base rules are checked here. Subclasses check their own
    // fields at the end of their constructors, once those fields exist.
    this.#validateBaseFields();
  }

  // ---------- getters ----------
  get userId() { return this.#userId; }
  get firstName() { return this.#firstName; }
  get lastName() { return this.#lastName; }
  get email() { return this.#email; }
  get userType() { return this.#userType; }

  // ---------- controlled setters ----------
  // userId and userType have no setters: they must not change after creation.

  set firstName(value) {
    const name = User.#clean(value);
    if (!name) throw new ValidationError('First name is required.');
    this.#firstName = name;
  }

  set lastName(value) {
    const name = User.#clean(value);
    if (!name) throw new ValidationError('Last name is required.');
    this.#lastName = name;
  }

  set email(value) {
    const email = User.#clean(value).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      throw new ValidationError(`"${value}" is not a valid email address.`);
    }
    this.#email = email;
  }

  getFullName() {
    return `${this.#firstName} ${this.#lastName}`;
  }

  /** The role name used in history, audit records and permission checks. */
  getRole() {
    return this.#userType;
  }

  // ---------- role capabilities (overridden by subclasses) ----------
  canSubmitRequests() {
    return this.#userType === USER_TYPES.STUDENT || this.#userType === USER_TYPES.STAFF;
  }

  canManageRequests() {
    return this.#userType === USER_TYPES.SERVICE_OFFICER;
  }

  canWorkOnRequests() {
    return this.#userType === USER_TYPES.TECHNICIAN;
  }

  canViewReports() {
    return this.#userType === USER_TYPES.ADMINISTRATOR || this.#userType === USER_TYPES.SERVICE_OFFICER;
  }

  /**
   * Checks the whole object. Throws a ValidationError listing every problem.
   * Subclasses extend this with super.validate() + their own checks.
   */
  validate() {
    this.#validateBaseFields();
    return true;
  }

  /** Returns a readable, multi-line description of the user. */
  displayInfo() {
    return [
      `User ID   : ${this.#userId}`,
      `Name      : ${this.getFullName()}`,
      `Email     : ${this.#email}`,
      `User Type : ${this.#userType}`,
    ].join('\n');
  }

  /** Extra fields a subclass wants saved. The base class has none. */
  getSpecialisedData() {
    return {};
  }

  /** Plain data for saving to JSON (no private fields are exposed directly). */
  toJSON() {
    return {
      userId: this.#userId,
      firstName: this.#firstName,
      lastName: this.#lastName,
      email: this.#email,
      userType: this.#userType,
      ...this.getSpecialisedData(),
    };
  }

  #validateBaseFields() {
    const problems = [];
    if (!this.#userId) problems.push('User ID is required.');
    if (!this.#firstName) problems.push('First name is required.');
    if (!this.#lastName) problems.push('Last name is required.');
    if (!EMAIL_PATTERN.test(this.#email)) {
      problems.push(`"${this.#email}" is not a valid email address.`);
    }
    if (!USER_TYPE_LIST.includes(this.#userType)) {
      problems.push(`User type must be one of: ${USER_TYPE_LIST.join(', ')}.`);
    }
    if (problems.length > 0) throw new ValidationError(problems.join(' '));
  }

  static #clean(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }
}

module.exports = User;
