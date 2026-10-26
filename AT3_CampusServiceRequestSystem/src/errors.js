'use strict';

/**
 * Custom error types. Using separate classes lets the console app and the tests
 * tell the difference between bad input, a permission problem and a file problem.
 */

class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Input data is missing, badly formatted or not an allowed value. */
class ValidationError extends AppError {}

/** A record with the same identifier already exists. */
class DuplicateError extends AppError {}

/** A user or request could not be found. */
class NotFoundError extends AppError {}

/** The user's role does not allow the action. */
class PermissionError extends AppError {}

/** The action is not allowed for the request's current status. */
class WorkflowError extends AppError {}

/** Reading or writing a JSON data file failed. */
class DataFileError extends AppError {
  constructor(message, filePath, cause) {
    super(message);
    this.filePath = filePath;
    if (cause) this.cause = cause;
  }
}

module.exports = {
  AppError,
  ValidationError,
  DuplicateError,
  NotFoundError,
  PermissionError,
  WorkflowError,
  DataFileError,
};
