'use strict';

const ServiceRequest = require('../ServiceRequest');
const { requireText, requireOption, collectProblems } = require('./fieldRules');

const HYGIENE_RISKS = Object.freeze(['Low', 'Medium', 'High']);
const HYGIENE_POINTS = Object.freeze({ Low: 0, Medium: 5, High: 15 });
const SERVICE_TYPES = Object.freeze(['Routine Cleaning', 'Spill Clean-up', 'Waste Removal', 'Sanitisation', 'Pest Control']);
const SERVICE_TIMES = Object.freeze(['Morning', 'Afternoon', 'Evening', 'Any Time']);
const TARGET_HOURS = Object.freeze({ Low: 24, Normal: 12, High: 6, Urgent: 3 });

/** Cleaning and sanitation needs such as spills, blocked toilets and waste removal. */
class CleaningRequest extends ServiceRequest {
  static CATEGORY = 'Cleaning and Sanitation';
  static REQUEST_TYPE = 'CleaningRequest';
  static HYGIENE_RISKS = HYGIENE_RISKS;
  static SERVICE_TYPES = SERVICE_TYPES;
  static SERVICE_TIMES = SERVICE_TIMES;

  #cleaningArea;
  #hygieneRisk;
  #serviceType;
  #preferredServiceTime;

  constructor(commonRequestData = {}, specialisedData = {}) {
    super(commonRequestData);
    const values = CleaningRequest.#checkFields(specialisedData);
    this.#cleaningArea = values.cleaningArea;
    this.#hygieneRisk = values.hygieneRisk;
    this.#serviceType = values.serviceType;
    this.#preferredServiceTime = values.preferredServiceTime;
    this.validateSpecialisedFields();
  }

  get cleaningArea() { return this.#cleaningArea; }
  get hygieneRisk() { return this.#hygieneRisk; }
  get serviceType() { return this.#serviceType; }
  get preferredServiceTime() { return this.#preferredServiceTime; }

  // ---- overridden methods ----
  calculatePriorityScore() {
    let score = this.getBasePriorityScore() + HYGIENE_POINTS[this.#hygieneRisk];
    if (this.#serviceType === 'Sanitisation' || this.#serviceType === 'Pest Control') score += 5;
    return score;
  }

  getTargetResolutionHours() {
    // A high hygiene risk is a health issue and is cleaned within 2 hours.
    if (this.#hygieneRisk === 'High') return 2;
    return TARGET_HOURS[this.priority];
  }

  getRequestSummary() {
    return [
      '--- Cleaning and Sanitation Request ---',
      ...this.buildSummaryLines(),
      `Area        : ${this.#cleaningArea}`,
      `Hygiene Risk: ${this.#hygieneRisk}`,
      `Service Type: ${this.#serviceType}`,
      `Pref. Time  : ${this.#preferredServiceTime}`,
      `Score/Target: ${this.calculatePriorityScore()} points / ${this.getTargetResolutionHours()} hours`,
    ].join('\n');
  }

  validateSpecialisedFields() {
    CleaningRequest.#checkFields(this.getSpecialisedData());
    return true;
  }

  getEditableSpecialisedFields() {
    return ['cleaningArea', 'hygieneRisk', 'serviceType', 'preferredServiceTime'];
  }

  validateSpecialisedChanges(changes) {
    CleaningRequest.#checkFields({ ...this.getSpecialisedData(), ...changes });
    return true;
  }

  applySpecialisedChanges(changes) {
    const values = CleaningRequest.#checkFields({ ...this.getSpecialisedData(), ...changes });
    this.#cleaningArea = values.cleaningArea;
    this.#hygieneRisk = values.hygieneRisk;
    this.#serviceType = values.serviceType;
    this.#preferredServiceTime = values.preferredServiceTime;
  }

  getSpecialisedData() {
    return {
      cleaningArea: this.#cleaningArea,
      hygieneRisk: this.#hygieneRisk,
      serviceType: this.#serviceType,
      preferredServiceTime: this.#preferredServiceTime,
    };
  }

  static #checkFields(data = {}) {
    return collectProblems({
      cleaningArea: () => requireText(data.cleaningArea, 'Cleaning area'),
      hygieneRisk: () => requireOption(data.hygieneRisk, HYGIENE_RISKS, 'Hygiene risk'),
      serviceType: () => requireOption(data.serviceType, SERVICE_TYPES, 'Service type'),
      preferredServiceTime: () => requireOption(data.preferredServiceTime, SERVICE_TIMES, 'Preferred service time'),
    });
  }
}

module.exports = CleaningRequest;
