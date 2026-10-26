'use strict';

const ICTSupportRequest = require('./ICTSupportRequest');
const MaintenanceRequest = require('./MaintenanceRequest');
const CleaningRequest = require('./CleaningRequest');
const GeneralServiceRequest = require('./GeneralServiceRequest');
const { CATEGORIES } = require('../constants');
const { ValidationError } = require('../errors');

const CLASSES = [ICTSupportRequest, MaintenanceRequest, CleaningRequest, GeneralServiceRequest];
const BY_TYPE = new Map(CLASSES.map((cls) => [cls.REQUEST_TYPE, cls]));
const BY_CATEGORY = new Map(CLASSES.map((cls) => [cls.CATEGORY, cls]));

const COMMON_KEYS = [
  'requestId', 'title', 'description', 'location', 'category', 'priority', 'status',
  'dateSubmitted', 'dateUpdated', 'assignedTechnicianId', 'dateResolved', 'dateClosed', 'resolutionNotes',
];

/**
 * Creates the correct specialised request object.
 * - create(): for a brand-new request, chosen by its category.
 * - createFromData(): for a saved JSON record, chosen by its requestType, so a
 *   record saved as an ICTSupportRequest comes back as an ICTSupportRequest.
 */
class ServiceRequestFactory {
  static getClassForCategory(category) {
    const cls = BY_CATEGORY.get(category);
    if (!cls) {
      throw new ValidationError(`"${category}" is not a supported category. Use one of: ${CATEGORIES.join(', ')}.`);
    }
    return cls;
  }

  static getClassForType(requestType) {
    const cls = BY_TYPE.get(requestType);
    if (!cls) {
      throw new ValidationError(`Unknown request type "${requestType}". Expected one of: ${[...BY_TYPE.keys()].join(', ')}.`);
    }
    return cls;
  }

  /** Names of the specialised fields each category asks for. */
  static getSpecialisedFieldNames(category) {
    const cls = ServiceRequestFactory.getClassForCategory(category);
    return cls.prototype.getEditableSpecialisedFields.call(Object.create(cls.prototype));
  }

  /** New request from the menu: commonData + specialisedData. */
  static create(commonData = {}, specialisedData = {}) {
    const cls = ServiceRequestFactory.getClassForCategory(commonData.category);
    return new cls(commonData, specialisedData);
  }

  /**
   * Rebuilds a request from saved JSON data.
   * @param {object} savedData   one record from serviceRequests.json
   * @param {object} links       { requester: User, history: object[] }
   */
  static createFromData(savedData = {}, { requester, history = [] } = {}) {
    if (!savedData || typeof savedData !== 'object') {
      throw new ValidationError('Saved request data must be an object.');
    }
    const cls = savedData.requestType
      ? ServiceRequestFactory.getClassForType(savedData.requestType)
      : ServiceRequestFactory.getClassForCategory(savedData.category);

    const common = { requester, history };
    const specialised = {};
    for (const [key, value] of Object.entries(savedData)) {
      if (COMMON_KEYS.includes(key)) common[key] = value;
      else if (key !== 'requestType' && key !== 'requesterId') specialised[key] = value;
    }
    return new cls(common, specialised);
  }
}

module.exports = ServiceRequestFactory;
