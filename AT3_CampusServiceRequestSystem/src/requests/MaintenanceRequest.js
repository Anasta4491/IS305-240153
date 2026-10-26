'use strict';

const ServiceRequest = require('../ServiceRequest');
const { requireText, requireOption, collectProblems } = require('./fieldRules');

const HAZARD_LEVELS = Object.freeze(['None', 'Low', 'Medium', 'High']);
const HAZARD_POINTS = Object.freeze({ None: 0, Low: 5, Medium: 10, High: 25 });
const TARGET_HOURS = Object.freeze({ Low: 72, Normal: 48, High: 24, Urgent: 8 });

/** Damaged facilities: doors, lights, plumbing, furniture, air-conditioning and so on. */
class MaintenanceRequest extends ServiceRequest {
  static CATEGORY = 'Facilities Maintenance';
  static REQUEST_TYPE = 'MaintenanceRequest';
  static HAZARD_LEVELS = HAZARD_LEVELS;

  #building;
  #roomNumber;
  #hazardLevel;
  #equipmentAffected;

  constructor(commonRequestData = {}, specialisedData = {}) {
    super(commonRequestData);
    const values = MaintenanceRequest.#checkFields(specialisedData);
    this.#building = values.building;
    this.#roomNumber = values.roomNumber;
    this.#hazardLevel = values.hazardLevel;
    this.#equipmentAffected = values.equipmentAffected;
    this.validateSpecialisedFields();
  }

  get building() { return this.#building; }
  get roomNumber() { return this.#roomNumber; }
  get hazardLevel() { return this.#hazardLevel; }
  get equipmentAffected() { return this.#equipmentAffected; }

  // ---- overridden methods ----
  calculatePriorityScore() {
    return this.getBasePriorityScore() + HAZARD_POINTS[this.#hazardLevel];
  }

  getTargetResolutionHours() {
    // A high safety hazard must be made safe within 4 hours whatever the priority.
    if (this.#hazardLevel === 'High') return 4;
    return TARGET_HOURS[this.priority];
  }

  getRequestSummary() {
    return [
      '--- Facilities Maintenance Request ---',
      ...this.buildSummaryLines(),
      `Building    : ${this.#building}`,
      `Room        : ${this.#roomNumber}`,
      `Hazard Level: ${this.#hazardLevel}`,
      `Equipment   : ${this.#equipmentAffected}`,
      `Score/Target: ${this.calculatePriorityScore()} points / ${this.getTargetResolutionHours()} hours`,
    ].join('\n');
  }

  validateSpecialisedFields() {
    MaintenanceRequest.#checkFields(this.getSpecialisedData());
    return true;
  }

  getEditableSpecialisedFields() {
    return ['building', 'roomNumber', 'hazardLevel', 'equipmentAffected'];
  }

  validateSpecialisedChanges(changes) {
    MaintenanceRequest.#checkFields({ ...this.getSpecialisedData(), ...changes });
    return true;
  }

  applySpecialisedChanges(changes) {
    const values = MaintenanceRequest.#checkFields({ ...this.getSpecialisedData(), ...changes });
    this.#building = values.building;
    this.#roomNumber = values.roomNumber;
    this.#hazardLevel = values.hazardLevel;
    this.#equipmentAffected = values.equipmentAffected;
  }

  getSpecialisedData() {
    return {
      building: this.#building,
      roomNumber: this.#roomNumber,
      hazardLevel: this.#hazardLevel,
      equipmentAffected: this.#equipmentAffected,
    };
  }

  static #checkFields(data = {}) {
    return collectProblems({
      building: () => requireText(data.building, 'Building'),
      roomNumber: () => requireText(data.roomNumber, 'Room number'),
      hazardLevel: () => requireOption(data.hazardLevel, HAZARD_LEVELS, 'Hazard level'),
      equipmentAffected: () => requireText(data.equipmentAffected, 'Equipment affected'),
    });
  }
}

module.exports = MaintenanceRequest;
