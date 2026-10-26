'use strict';

const ServiceRequest = require('../ServiceRequest');
const { requireOption, collectProblems } = require('./fieldRules');

const SERVICE_AREAS = Object.freeze(['Security', 'Grounds', 'Transport', 'Events', 'Other']);
const TARGET_HOURS = Object.freeze({ Low: 120, Normal: 72, High: 48, Urgent: 24 });

/** Anything that does not fit the other three categories. */
class GeneralServiceRequest extends ServiceRequest {
  static CATEGORY = 'General Campus Service';
  static REQUEST_TYPE = 'GeneralServiceRequest';
  static SERVICE_AREAS = SERVICE_AREAS;

  #serviceArea;

  constructor(commonRequestData = {}, specialisedData = {}) {
    super(commonRequestData);
    this.#serviceArea = GeneralServiceRequest.#checkFields(specialisedData).serviceArea;
    this.validateSpecialisedFields();
  }

  get serviceArea() { return this.#serviceArea; }

  // ---- overridden methods ----
  calculatePriorityScore() {
    // Security issues get extra points because they can affect people's safety.
    return this.getBasePriorityScore() + (this.#serviceArea === 'Security' ? 10 : 0);
  }

  getTargetResolutionHours() {
    return TARGET_HOURS[this.priority];
  }

  getRequestSummary() {
    return [
      '--- General Campus Service Request ---',
      ...this.buildSummaryLines(),
      `Service Area: ${this.#serviceArea}`,
      `Score/Target: ${this.calculatePriorityScore()} points / ${this.getTargetResolutionHours()} hours`,
    ].join('\n');
  }

  validateSpecialisedFields() {
    GeneralServiceRequest.#checkFields(this.getSpecialisedData());
    return true;
  }

  getEditableSpecialisedFields() {
    return ['serviceArea'];
  }

  validateSpecialisedChanges(changes) {
    GeneralServiceRequest.#checkFields({ ...this.getSpecialisedData(), ...changes });
    return true;
  }

  applySpecialisedChanges(changes) {
    this.#serviceArea = GeneralServiceRequest.#checkFields({ ...this.getSpecialisedData(), ...changes }).serviceArea;
  }

  getSpecialisedData() {
    return { serviceArea: this.#serviceArea };
  }

  static #checkFields(data = {}) {
    return collectProblems({
      serviceArea: () => requireOption(data.serviceArea, SERVICE_AREAS, 'Service area'),
    });
  }
}

module.exports = GeneralServiceRequest;
