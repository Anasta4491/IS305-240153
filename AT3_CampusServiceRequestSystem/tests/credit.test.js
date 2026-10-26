'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const User = require('../src/User');
const ServiceRequest = require('../src/ServiceRequest');
const StudentRequester = require('../src/users/StudentRequester');
const ICTSupportRequest = require('../src/requests/ICTSupportRequest');
const { ValidationError, PermissionError, WorkflowError } = require('../src/errors');
const h = require('./helpers');

/** Takes a request through review and assignment. */
async function assigned(manager, request, techId = 'TECH001') {
  await manager.submitRequest(request);
  await manager.reviewRequest(request.requestId, 'OFF001', 'Checked');
  await manager.assignTechnician(request.requestId, 'OFF001', techId);
  return request;
}

describe('Credit extension - inheritance and constructor chaining', () => {
  test('C01 user subclasses call super() and inherit User behaviour', () => {
    const student = h.makeStudent();
    const officer = h.makeOfficer();
    const tech = h.makeTechnician();
    assert.ok(student instanceof StudentRequester && student instanceof User);
    assert.equal(student.userType, 'Student');           // set by the subclass through super()
    assert.equal(student.getFullName(), 'Grace Kila');   // inherited method
    assert.equal(officer.userType, 'Service Officer');
    assert.equal(tech.speciality, 'Networking');
    // Base validation still runs through the chained constructor.
    assert.throws(() => new StudentRequester({ userId: '', firstName: 'A', lastName: 'B', email: 'a@b.com' }, { programme: 'BIT', yearLevel: 1 }), /User ID is required/);
  });

  test('C02 request subclasses call super() and keep base fields', () => {
    const request = h.makeICT(h.makeStudent());
    assert.ok(request instanceof ICTSupportRequest && request instanceof ServiceRequest);
    assert.equal(request.category, 'ICT Support'); // default category from the subclass
    assert.equal(request.status, 'Submitted');     // default from the base constructor
    assert.equal(request.deviceType, 'Laptop');
  });

  test('C03 specialised fields are validated', () => {
    const student = h.makeStudent();
    assert.throws(() => new StudentRequester({ userId: 'X1', firstName: 'A', lastName: 'B', email: 'a@b.com' }, { programme: 'BIT', yearLevel: 9 }), /Year level/);
    assert.throws(() => h.makeICT(student, {}, { networkImpact: 'Galaxy-wide' }), /Network impact must be one of/);
    assert.throws(() => h.makeMaintenance(student, {}, { roomNumber: '' }), /Room number is required/);
    assert.throws(() => h.makeCleaning(student, {}, { hygieneRisk: 'Extreme' }), /Hygiene risk/);
    assert.throws(() => h.makeGeneral(student, {}, { serviceArea: '' }), /Service area/);
    assert.throws(() => h.makeICT(student, { category: 'Cleaning and Sanitation' }), /must use the "ICT Support" category/);
    // Option values are matched case-insensitively and stored in the official spelling.
    assert.equal(h.makeICT(student, {}, { faultType: 'account access' }).faultType, 'Account Access');
  });
});

describe('Credit extension - roles and workflow', () => {
  test('C04 full workflow Submitted -> Reviewed -> Assigned -> In Progress -> Resolved -> Closed', async () => {
    const { manager, student } = await h.managerWithUsers();
    const request = await assigned(manager, h.makeICT(student));
    await manager.startWork('REQ001', 'TECH001');
    await manager.addProgressNote('REQ001', 'TECH001', 'Restarted access point');
    await manager.resolveRequest('REQ001', 'TECH001', 'Replaced patch cable');
    await manager.closeRequest('REQ001', 'OFF001', 'Verified');
    assert.equal(request.status, 'Closed');
    assert.ok(request.dateResolved && request.dateClosed);
    assert.equal(request.resolutionNotes, 'Replaced patch cable');
  });

  test('C05 only Service Officers can review, set priority, assign Technicians and close', async () => {
    const { manager, student } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student));
    await assert.rejects(manager.reviewRequest('REQ001', 'DWU2026001'), PermissionError);
    await assert.rejects(manager.reviewRequest('REQ001', 'TECH001'), PermissionError);
    await manager.reviewRequest('REQ001', 'OFF001');
    await assert.rejects(manager.setPriority('REQ001', 'ADM001', 'Urgent'), PermissionError);
    await assert.rejects(manager.assignTechnician('REQ001', 'TECH001', 'TECH001'), /Only a Service Officer can assign Technicians/);
    await assert.rejects(manager.assignTechnician('REQ001', 'OFF001', 'DWU2026002'), /not a Technician/);
    await manager.assignTechnician('REQ001', 'OFF001', 'TECH001');
    assert.equal(manager.findRequestById('REQ001').assignedTechnicianId, 'TECH001');
  });

  test('C06 only the assigned Technician can start, update and resolve the work', async () => {
    const { manager, student } = await h.managerWithUsers();
    await assigned(manager, h.makeICT(student));
    await assert.rejects(manager.startWork('REQ001', 'TECH002'), /Only the assigned Technician \(TECH001\)/);
    await assert.rejects(manager.startWork('REQ001', 'OFF001'), PermissionError);
    await manager.startWork('REQ001', 'TECH001');
    await assert.rejects(manager.addProgressNote('REQ001', 'TECH002', 'note'), PermissionError);
    await assert.rejects(manager.resolveRequest('REQ001', 'TECH002', 'done'), PermissionError);
    await assert.rejects(manager.addProgressNote('REQ001', 'TECH001', '   '), ValidationError);
    await manager.resolveRequest('REQ001', 'TECH001', 'Fixed');
    assert.equal(manager.findRequestById('REQ001').status, 'Resolved');
  });

  test('C07 invalid status transitions are rejected', async () => {
    const { manager, student } = await h.managerWithUsers();
    const request = h.makeICT(student);
    await manager.submitRequest(request);
    await assert.rejects(manager.assignTechnician('REQ001', 'OFF001', 'TECH001'), WorkflowError); // must be Reviewed first
    await assert.rejects(manager.closeRequest('REQ001', 'OFF001'), /Submitted -> Closed/);
    assert.throws(() => request.changeStatus('Resolved', { actor: student }), WorkflowError);
    await manager.reviewRequest('REQ001', 'OFF001');
    await assert.rejects(manager.cancelRequest('REQ001', 'DWU2026001'), /Only Submitted requests can be cancelled/);
    await assert.rejects(manager.updateRequest('REQ001', 'DWU2026001', { title: 'New' }), WorkflowError);
    assert.throws(() => request.changeStatus('Finished', { actor: student }), ValidationError);
    assert.equal(request.status, 'Reviewed');
  });

  test('C08 Closed and Cancelled are final statuses', async () => {
    const { manager, student } = await h.managerWithUsers();
    const request = h.makeICT(student);
    await manager.submitRequest(request);
    await manager.cancelRequest('REQ001', 'DWU2026001');
    await assert.rejects(manager.reviewRequest('REQ001', 'OFF001'), /none \(final status\)/);
    assert.ok(request.isFinal());
  });
});

describe('Credit extension - overriding, search, filter, sort and history', () => {
  test('C09 specialised summaries display the correct information', () => {
    const student = h.makeStudent();
    const ict = h.makeICT(student).getRequestSummary();
    const maintenance = h.makeMaintenance(student).getRequestSummary();
    const cleaning = h.makeCleaning(student).getRequestSummary();
    assert.match(ict, /--- ICT Support Request ---/);
    assert.match(ict, /Net\. Impact : Department/);
    assert.match(maintenance, /Hazard Level: High/);
    assert.match(maintenance, /Room        : Lab 3/);
    assert.match(cleaning, /Service Type: Waste Removal/);
    assert.doesNotMatch(cleaning, /Hazard Level/);
    // Common lines come from the base class through buildSummaryLines().
    for (const text of [ict, maintenance, cleaning]) assert.match(text, /Requester   : Grace Kila \(DWU2026001\)/);
  });

  test('C10 search, filter and sort return correct results', async () => {
    const { manager, student, staff } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student, { requestId: 'REQ001', priority: 'Normal', dateSubmitted: '2026-10-01T00:00:00Z' }));
    await manager.submitRequest(h.makeMaintenance(staff, { requestId: 'REQ002', priority: 'Urgent', dateSubmitted: '2026-10-03T00:00:00Z' }));
    await manager.submitRequest(h.makeCleaning(student, { requestId: 'REQ003', priority: 'Low', dateSubmitted: '2026-10-02T00:00:00Z' }));
    await manager.submitRequest(h.makeICT(staff, { requestId: 'REQ004', title: 'Printer jam', priority: 'Urgent', dateSubmitted: '2026-09-30T00:00:00Z' }));
    await manager.reviewRequest('REQ004', 'OFF001');
    await manager.assignTechnician('REQ004', 'OFF001', 'TECH002');

    assert.deepEqual(manager.searchRequests('printer').map((r) => r.requestId), ['REQ004']);
    assert.deepEqual(manager.filterRequests({ category: 'ICT Support' }).map((r) => r.requestId), ['REQ001', 'REQ004']);
    assert.deepEqual(manager.filterRequests({ status: 'Assigned' }).map((r) => r.requestId), ['REQ004']);
    assert.deepEqual(manager.filterRequests({ priority: 'Urgent' }).map((r) => r.requestId), ['REQ002', 'REQ004']);
    assert.deepEqual(manager.filterRequests({ technicianId: 'tech002' }).map((r) => r.requestId), ['REQ004']);
    assert.deepEqual(manager.filterRequests({ category: 'ICT Support', priority: 'Normal' }).map((r) => r.requestId), ['REQ001']);
    assert.deepEqual(manager.sortRequests('dateSubmitted').map((r) => r.requestId), ['REQ004', 'REQ001', 'REQ003', 'REQ002']);
    // Urgent first; the two Urgent requests are ordered oldest first.
    assert.deepEqual(manager.sortRequests('priority', 'desc').map((r) => r.requestId), ['REQ004', 'REQ002', 'REQ001', 'REQ003']);
    assert.throws(() => manager.filterRequests({ status: 'Lost' }), ValidationError);
    // The original order is untouched.
    assert.deepEqual(manager.getAllRequests().map((r) => r.requestId), ['REQ001', 'REQ002', 'REQ003', 'REQ004']);
  });

  test('C11 request history records every approved workflow action', async () => {
    const { manager, student } = await h.managerWithUsers();
    await assigned(manager, h.makeICT(student));
    await manager.setPriority('REQ001', 'OFF001', 'Urgent', 'Whole floor affected');
    await manager.startWork('REQ001', 'TECH001');
    await assert.rejects(manager.startWork('REQ001', 'TECH001')); // refused, so not in history
    const history = manager.getRequestHistory('REQ001');
    assert.deepEqual(history.map((e) => e.action), ['Request Reviewed', 'Technician Assigned', 'Priority Changed', 'Work Started']);
    const assign = history[1];
    assert.equal(assign.previousStatus, 'Reviewed');
    assert.equal(assign.newStatus, 'Assigned');
    assert.equal(assign.actorId, 'OFF001');
    assert.equal(assign.actorRole, 'Service Officer');
    assert.ok(!Number.isNaN(Date.parse(assign.timestamp)));
    assert.equal(history[2].comment, 'Whole floor affected');
    // getHistory() returns a copy, so it cannot be tampered with.
    history.length = 0;
    assert.equal(manager.getRequestHistory('REQ001').length, 4);
  });

  test('C12 Technicians and officers cannot submit requests', async () => {
    const { manager, tech } = await h.managerWithUsers();
    await assert.rejects(manager.submitRequest(h.makeICT(tech)), /Technician accounts cannot submit/);
  });
});

