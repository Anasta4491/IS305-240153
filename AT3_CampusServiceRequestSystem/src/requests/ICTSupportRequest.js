'use strict';

const ServiceRequest = require('../ServiceRequest');
const { requireText, requireOption, collectProblems } = require('./fieldRules');

const FAULT_TYPES = Object.freeze(['Hardware', 'Software', 'Network', 'Account Access', 'Other']);
const NETWORK_IMPACTS = Object.freeze(['None', 'Single User', 'Department', 'Campus-wide']);
const NETWORK_IMPACT_POINTS = Object.freeze({ None: 0, 'Single User': 5, Department: 10, 'Campus-wide': 20 });
const TARGET_HOURS = Object.freeze({ Low: 48, Normal: 24, High: 8, Urgent: 4 });

/** ICT problems such as Wi-Fi faults, broken projectors or system access issues. */
class ICTSupportRequest extends ServiceRequest {
  static CATEGORY = 'ICT Support';
  static REQUEST_TYPE = 'ICTSupportRequest';
  static FAULT_TYPES = FAULT_TYPES;
  static NETWORK_IMPACTS = NETWORK_IMPACTS;

  #deviceType;
  #systemName;
  #faultType;
  #networkImpact;

  constructor(commonRequestData = {}, specialisedData = {}) {
    // Constructor chaining: the base class sets and validates the common fields.
    super(commonRequestData);
    const values = ICTSupportRequest.#checkFields(specialisedData);
    this.#deviceType = values.deviceType;
    this.#systemName = values.systemName;
    this.#faultType = values.faultType;
    this.#networkImpact = values.networkImpact;
    this.validateSpecialisedFields();
  }

  get deviceType() { return this.#deviceType; }
  get systemName() { return this.#systemName; }
  get faultType() { return this.#faultType; }
  get networkImpact() { return this.#networkImpact; }

  // ---- overridden methods ----
  calculatePriorityScore() {
    let score = this.getBasePriorityScore() + NETWORK_IMPACT_POINTS[this.#networkImpact];
    if (this.#faultType === 'Network' || this.#faultType === 'Account Access') score += 5;
    return score;
  }

  getTargetResolutionHours() {
    const hours = TARGET_HOURS[this.priority];
    // A campus-wide outage is handled twice as fast as normal.
    return this.#networkImpact === 'Campus-wide' ? hours / 2 : hours;
  }

  getRequestSummary() {
    return [
      '--- ICT Support Request ---',
      ...this.buildSummaryLines(),
      `Device      : ${this.#deviceType}`,
      `System      : ${this.#systemName}`,
      `Fault Type  : ${this.#faultType}`,
      `Net. Impact : ${this.#networkImpact}`,
      `Score/Target: ${this.calculatePriorityScore()} points / ${this.getTargetResolutionHours()} hours`,
    ].join('\n');
  }

  validateSpecialisedFields() {
    ICTSupportRequest.#checkFields(this.getSpecialisedData());
    return true;
  }

  getEditableSpecialisedFields() {
    return ['deviceType', 'systemName', 'faultType', 'networkImpact'];
  }

  validateSpecialisedChanges(changes) {
    ICTSupportRequest.#checkFields({ ...this.getSpecialisedData(), ...changes });
    return true;
  }

  applySpecialisedChanges(changes) {
    const values = ICTSupportRequest.#checkFields({ ...this.getSpecialisedData(), ...changes });
    this.#deviceType = values.deviceType;
    this.#systemName = values.systemName;
    this.#faultType = values.faultType;
    this.#networkImpact = values.networkImpact;
  }

  getSpecialisedData() {
    return {
      deviceType: this.#deviceType,
      systemName: this.#systemName,
      faultType: this.#faultType,
      networkImpact: this.#networkImpact,
    };
  }

  static #checkFields(data = {}) {
    return collectProblems({
      deviceType: () => requireText(data.deviceType, 'Device type'),
      systemName: () => requireText(data.systemName, 'System name'),
      faultType: () => requireOption(data.faultType, FAULT_TYPES, 'Fault type'),
      networkImpact: () => requireOption(data.networkImpact, NETWORK_IMPACTS, 'Network impact'),
    });
  }
}

module.exports = ICTSupportRequest;
