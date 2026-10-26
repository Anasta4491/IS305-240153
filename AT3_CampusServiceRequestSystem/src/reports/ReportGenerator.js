'use strict';

const {
  STATUSES,
  CATEGORIES,
  PRIORITIES,
  STATUS,
  COMPLETED_STATUSES,
  FINAL_STATUSES,
} = require('../constants');

/**
 * Management reports built with filter(), map(), reduce() and sort().
 * Every method returns plain data, so the reports can be tested directly;
 * the format...() helpers turn that data into console text.
 */
class ReportGenerator {
  #requests;
  #users;

  /**
   * @param {ServiceRequest[]} requests
   * @param {User[]} users
   */
  constructor(requests = [], users = []) {
    this.#requests = [...requests];
    this.#users = [...users];
  }

  /** Count per status, including statuses with zero requests. */
  groupByStatus() {
    return ReportGenerator.#countBy(this.#requests, (request) => request.status, STATUSES);
  }

  groupByCategory() {
    return ReportGenerator.#countBy(this.#requests, (request) => request.category, CATEGORIES);
  }

  groupByPriority() {
    return ReportGenerator.#countBy(this.#requests, (request) => request.priority, PRIORITIES);
  }

  /** Open Urgent requests, highest priority score first. */
  getUrgentRequests() {
    return this.#requests
      .filter((request) => request.priority === 'Urgent' && !FINAL_STATUSES.includes(request.status)
        && request.status !== STATUS.RESOLVED)
      .sort((a, b) => b.calculatePriorityScore() - a.calculatePriorityScore());
  }

  /** Open requests older than their own target resolution time (polymorphic call). */
  getOverdueRequests(now = new Date()) {
    return this.#requests
      .filter((request) => request.isOverdue(now))
      .map((request) => ({
        requestId: request.requestId,
        title: request.title,
        status: request.status,
        targetHours: request.getTargetResolutionHours(),
        ageHours: Math.round(request.getAgeHours(now) * 10) / 10,
        hoursOverdue: Math.round((request.getAgeHours(now) - request.getTargetResolutionHours()) * 10) / 10,
      }))
      .sort((a, b) => b.hoursOverdue - a.hoursOverdue);
  }

  /** For each Technician: total assigned, still open and completed. */
  getAssignmentsByTechnician() {
    const technicians = this.#users.filter((user) => user.canWorkOnRequests());
    return technicians
      .map((technician) => {
        const assigned = this.#requests.filter((request) => request.assignedTechnicianId === technician.userId);
        const completed = assigned.filter((request) => COMPLETED_STATUSES.includes(request.status)).length;
        return {
          technicianId: technician.userId,
          name: technician.getFullName(),
          assigned: assigned.length,
          open: assigned.length - completed,
          completed,
        };
      })
      .sort((a, b) => b.assigned - a.assigned || a.technicianId.localeCompare(b.technicianId));
  }

  /** Technicians with at least one Resolved or Closed request, most completed first. */
  getCompletedByTechnician() {
    return this.getAssignmentsByTechnician()
      .filter((row) => row.completed > 0)
      .map(({ technicianId, name, completed }) => ({ technicianId, name, completed }))
      .sort((a, b) => b.completed - a.completed);
  }

  /** Average hours from submission to resolution, overall and per category. */
  getAverageResolutionTime() {
    const resolved = this.#requests.filter((request) => request.getResolutionHours() !== null);
    const average = (list) => (list.length === 0
      ? null
      : Math.round((list.reduce((sum, request) => sum + request.getResolutionHours(), 0) / list.length) * 10) / 10);

    const byCategory = CATEGORIES.reduce((result, category) => {
      result[category] = average(resolved.filter((request) => request.category === category));
      return result;
    }, {});

    return { resolvedCount: resolved.length, overallHours: average(resolved), byCategory };
  }

  /** Number of requests per campus location, busiest first. */
  getVolumeByLocation() {
    const counts = this.#requests.reduce((result, request) => {
      result[request.location] = (result[request.location] ?? 0) + 1;
      return result;
    }, {});
    return Object.entries(counts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location));
  }

  // --------------------------------------------------------- text output
  static formatCounts(title, counts) {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const width = Math.max(...Object.keys(counts).map((key) => key.length), 5);
    const lines = Object.entries(counts).map(([key, value]) => {
      const bar = '#'.repeat(value);
      return `  ${key.padEnd(width)} : ${String(value).padStart(3)}  ${bar}`;
    });
    return [title, '-'.repeat(title.length), ...lines, `  ${'Total'.padEnd(width)} : ${String(total).padStart(3)}`].join('\n');
  }

  static formatTable(title, rows, columns) {
    if (rows.length === 0) return `${title}\n${'-'.repeat(title.length)}\n  (no matching records)`;
    const widths = columns.map(({ key, label }) =>
      Math.max(label.length, ...rows.map((row) => String(row[key] ?? '-').length)));
    const header = columns.map(({ label }, i) => label.padEnd(widths[i])).join(' | ');
    const body = rows.map((row) => columns.map(({ key }, i) => String(row[key] ?? '-').padEnd(widths[i])).join(' | '));
    return [title, '-'.repeat(title.length), `  ${header}`, `  ${widths.map((w) => '-'.repeat(w)).join('-+-')}`, ...body.map((line) => `  ${line}`)].map((line) => line.trimEnd()).join('\n');
  }

  static #countBy(items, keyOf, allKeys) {
    const start = Object.fromEntries(allKeys.map((key) => [key, 0]));
    return items.reduce((counts, item) => {
      const key = keyOf(item);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, start);
  }
}

module.exports = ReportGenerator;
