'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ServiceRequest = require('../src/ServiceRequest');
const ServiceRequestManager = require('../src/ServiceRequestManager');
const CampusDataStore = require('../src/repositories/CampusDataStore');
const ServiceRequestFileRepository = require('../src/repositories/ServiceRequestFileRepository');
const UserFileRepository = require('../src/repositories/UserFileRepository');
const ServiceRequestFactory = require('../src/requests/ServiceRequestFactory');
const ICTSupportRequest = require('../src/requests/ICTSupportRequest');
const MaintenanceRequest = require('../src/requests/MaintenanceRequest');
const CleaningRequest = require('../src/requests/CleaningRequest');
const ReportGenerator = require('../src/reports/ReportGenerator');
const { DataFileError, DuplicateError } = require('../src/errors');
const h = require('./helpers');

// Every test gets its own temporary folder, so the real data/ folder is never touched.
let tempDir;
beforeEach(async () => { tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-test-')); });
afterEach(async () => { await fs.rm(tempDir, { recursive: true, force: true }); });

const readJson = async (file) => JSON.parse(await fs.readFile(path.join(tempDir, file), 'utf8'));

describe('Distinction - abstraction and polymorphism', () => {
  test('D01 ServiceRequest cannot be created directly and abstract methods throw clear errors', () => {
    assert.throws(() => new ServiceRequest({ requestId: 'REQ1' }), /abstract-style class/);
    class IncompleteRequest extends ServiceRequest {}
    const request = new IncompleteRequest({
      requestId: 'REQ9', requester: h.makeStudent(), title: 'T', description: 'D', location: 'L', category: 'General Campus Service',
    });
    assert.throws(() => request.calculatePriorityScore(), /IncompleteRequest must implement calculatePriorityScore\(\)/);
    assert.throws(() => request.getTargetResolutionHours(), /must implement getTargetResolutionHours\(\)/);
    assert.throws(() => request.getRequestSummary(), /must implement getRequestSummary\(\)/);
  });

  test('D02 one collection, same method calls, specialised results', () => {
    const student = h.makeStudent();
    // All three are High priority, so any difference comes from the subclass.
    const requests = [
      h.makeICT(student, { priority: 'High' }, { networkImpact: 'Campus-wide', faultType: 'Hardware' }),
      h.makeMaintenance(student, { priority: 'High' }, { hazardLevel: 'High' }),
      h.makeCleaning(student, { priority: 'High' }, { hygieneRisk: 'Low', serviceType: 'Routine Cleaning' }),
    ];
    const results = requests.map((request) => ({
      type: request.constructor.name,
      score: request.calculatePriorityScore(),
      target: request.getTargetResolutionHours(),
      heading: request.getRequestSummary().split('\n')[0],
    }));
    assert.deepEqual(results, [
      { type: 'ICTSupportRequest', score: 50, target: 4, heading: '--- ICT Support Request ---' },
      { type: 'MaintenanceRequest', score: 55, target: 4, heading: '--- Facilities Maintenance Request ---' },
      { type: 'CleaningRequest', score: 30, target: 6, heading: '--- Cleaning and Sanitation Request ---' },
    ]);
  });
});

describe('Distinction - JSON persistence and restoration', () => {
  test('D03 missing data files are created as empty arrays', async () => {
    const { manager, warnings } = await ServiceRequestManager.createWithDataStore(new CampusDataStore(tempDir));
    assert.equal(manager.getAllUsers().length, 0);
    assert.deepEqual(warnings, []);
    for (const file of ['users.json', 'serviceRequests.json', 'requestHistory.json', 'auditLog.json']) {
      assert.deepEqual(await readJson(file), [], `${file} should be created empty`);
    }
  });

  test('D04 an empty file is treated as an empty array', async () => {
    await fs.writeFile(path.join(tempDir, 'users.json'), '   \n');
    assert.deepEqual(await new UserFileRepository(path.join(tempDir, 'users.json')).loadAll(), []);
  });

  test('D05 users, requests, history and audit are saved after successful actions', async () => {
    const store = new CampusDataStore(tempDir);
    const { manager, student } = await h.managerWithUsers({ dataStore: store });
    await manager.submitRequest(h.makeICT(student));
    await manager.reviewRequest('REQ001', 'OFF001', 'Looks valid');

    const users = await readJson('users.json');
    assert.equal(users.length, 7);
    assert.equal(users.find((u) => u.userId === 'DWU2026001').programme, 'BIT');

    const [saved] = await readJson('serviceRequests.json');
    assert.equal(saved.requestType, 'ICTSupportRequest');
    assert.equal(saved.requesterId, 'DWU2026001');
    assert.equal(saved.status, 'Reviewed');
    assert.equal(saved.networkImpact, 'Department');
    assert.equal(typeof saved.dateSubmitted, 'string');
    assert.equal(saved.requester, undefined, 'the requester object is stored as an ID only');

    const history = await readJson('requestHistory.json');
    assert.equal(history.length, 1);
    assert.equal(history[0].requestId, 'REQ001');
    assert.equal(history[0].newStatus, 'Reviewed');

    const audit = await readJson('auditLog.json');
    assert.deepEqual(audit.slice(-2).map((a) => a.action), ['Request Created', 'Request Reviewed']);
  });

  test('D06 invalid records are never saved', async () => {
    const store = new CampusDataStore(tempDir);
    const { manager, student } = await h.managerWithUsers({ dataStore: store });
    const before = await readJson('auditLog.json');
    await assert.rejects(manager.registerUser(h.makeStudent('DWU2026001', 'other@student.campus.example')), DuplicateError);
    await assert.rejects(manager.updateRequest('REQ404', 'DWU2026001', { title: 'x' }));
    assert.throws(() => h.makeICT(student, { title: '' }));
    assert.equal((await readJson('users.json')).length, 7);
    await assert.rejects(fs.access(path.join(tempDir, 'serviceRequests.json')), 'no request file was written');
    assert.equal((await readJson('auditLog.json')).length, before.length);
  });

  test('D07 saved requests reload as the correct specialised objects with history', async () => {
    const store = new CampusDataStore(tempDir);
    const { manager, student, staff } = await h.managerWithUsers({ dataStore: store });
    await manager.submitRequest(h.makeICT(student, { requestId: 'REQ001' }));
    await manager.submitRequest(h.makeMaintenance(staff, { requestId: 'REQ002' }));
    await manager.submitRequest(h.makeCleaning(student, { requestId: 'REQ003' }));
    await manager.reviewRequest('REQ002', 'OFF001');
    await manager.assignTechnician('REQ002', 'OFF001', 'TECH002');

    // A brand-new manager reading the same folder, like restarting the program.
    const { manager: reloaded, warnings } = await ServiceRequestManager.createWithDataStore(new CampusDataStore(tempDir));
    assert.deepEqual(warnings, []);
    const [ict, maintenance, cleaning] = reloaded.getAllRequests();
    assert.ok(ict instanceof ICTSupportRequest);
    assert.ok(maintenance instanceof MaintenanceRequest);
    assert.ok(cleaning instanceof CleaningRequest);
    assert.equal(maintenance.status, 'Assigned');
    assert.equal(maintenance.assignedTechnicianId, 'TECH002');
    assert.equal(maintenance.getHistory().length, 2);
    assert.equal(maintenance.calculatePriorityScore(), 55);   // overridden method still works
    assert.equal(ict.requester.programme, 'BIT');              // requester relinked to the real Student object
    assert.equal(reloaded.findUserById('TECH002').speciality, 'Networking');
    assert.equal(reloaded.generateRequestId(), 'REQ004');
    // The restored object still enforces the workflow.
    await assert.rejects(reloaded.closeRequest('REQ002', 'OFF001'), /Assigned -> Closed/);
    await reloaded.startWork('REQ002', 'TECH002');
    assert.equal(reloaded.findRequestById('REQ002').status, 'In Progress');
  });

  test('D08 the factory rebuilds each type and rejects unknown types', () => {
    const student = h.makeStudent();
    for (const original of [h.makeICT(student), h.makeMaintenance(student), h.makeCleaning(student), h.makeGeneral(student)]) {
      const plain = JSON.parse(JSON.stringify(original));
      const restored = ServiceRequestFactory.createFromData(plain, { requester: student });
      assert.equal(restored.constructor, original.constructor);
      assert.deepEqual(restored.toJSON(), original.toJSON());
    }
    assert.throws(() => ServiceRequestFactory.createFromData({ requestType: 'HackRequest' }, { requester: student }), /Unknown request type/);
  });

  test('D09 damaged JSON and damaged records give clear errors or warnings', async () => {
    await fs.writeFile(path.join(tempDir, 'serviceRequests.json'), '{ "this is": broken');
    await assert.rejects(new CampusDataStore(tempDir).loadAll(), (error) => error instanceof DataFileError && /serviceRequests\.json does not contain valid JSON/.test(error.message));

    await fs.writeFile(path.join(tempDir, 'serviceRequests.json'), '{"requestId":"REQ001"}');
    await assert.rejects(new CampusDataStore(tempDir).loadAll(), /must contain a JSON array/);

    // One bad record is skipped with a warning; the good data still loads.
    await fs.writeFile(path.join(tempDir, 'users.json'), JSON.stringify([
      h.makeStudent().toJSON(),
      { userId: 'BAD1', firstName: '', lastName: 'X', email: 'bad', userType: 'Student' },
    ]));
    await fs.writeFile(path.join(tempDir, 'serviceRequests.json'), JSON.stringify([
      { ...h.makeICT(h.makeStudent()).toJSON() },
      { ...h.makeICT(h.makeStudent(), { requestId: 'REQ002' }).toJSON(), requesterId: 'GHOST' },
    ]));
    const { users, requests, warnings } = await new CampusDataStore(tempDir).loadAll();
    assert.equal(users.length, 1);
    assert.equal(requests.length, 1);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /Skipped user BAD1/);
    assert.match(warnings[1], /requester GHOST not found/);
  });

  test('D10 file-writing errors are reported clearly and the change is not kept', async () => {
    // Make "users.json" a folder, so writing the file must fail.
    const blocked = path.join(tempDir, 'blocked');
    await fs.mkdir(path.join(blocked, 'users.json'), { recursive: true });
    const manager = new ServiceRequestManager({ dataStore: new CampusDataStore(blocked) });
    await assert.rejects(manager.registerUser(h.makeStudent()), (error) => error instanceof DataFileError && /Could not write users\.json/.test(error.message));
    assert.equal(manager.getAllUsers().length, 0, 'registration rolled back');
    assert.equal(manager.getAuditLog().length, 0);
  });

  test('D11 repository CRUD and find methods', async () => {
    const repo = new ServiceRequestFileRepository(path.join(tempDir, 'serviceRequests.json'));
    await repo.create({ requestId: 'REQ001', requesterId: 'DWU1', assignedTechnicianId: 'TECH001' });
    await repo.create({ requestId: 'REQ002', requesterId: 'DWU2', assignedTechnicianId: null });
    await assert.rejects(repo.create({ requestId: 'REQ001' }), DuplicateError);
    assert.equal((await repo.findById('REQ002')).requesterId, 'DWU2');
    assert.equal((await repo.findByRequester('DWU1')).length, 1);
    assert.equal((await repo.findByTechnician('TECH001'))[0].requestId, 'REQ001');
    const updated = await repo.update('REQ002', { assignedTechnicianId: 'TECH002', requestId: 'CHANGED' });
    assert.equal(updated.requestId, 'REQ002', 'the ID cannot be changed by update()');
    assert.equal((await repo.findByTechnician('TECH002')).length, 1);
    assert.equal(await repo.findById('NOPE'), null);
  });
});

describe('Distinction - audit trail and reports', () => {
  test('D12 audit trail records actions with all required fields, including refusals', async () => {
    const { manager, student } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student));
    await manager.updateRequest('REQ001', 'DWU2026001', { description: 'Still down' });
    await manager.reviewRequest('REQ001', 'OFF001');
    await manager.setPriority('REQ001', 'OFF001', 'Urgent');
    await manager.assignTechnician('REQ001', 'OFF001', 'TECH001');
    await assert.rejects(manager.startWork('REQ001', 'TECH002'));
    await manager.startWork('REQ001', 'TECH001');
    await manager.resolveRequest('REQ001', 'TECH001', 'Fixed');
    await manager.closeRequest('REQ001', 'OFF001');

    const log = manager.getAuditLog({ requestId: 'REQ001' });
    assert.deepEqual(log.map((e) => `${e.action}:${e.outcome}`), [
      'Request Created:Success', 'Request Updated:Success', 'Request Reviewed:Success', 'Priority Changed:Success',
      'Technician Assigned:Success', 'Work Started:Rejected', 'Work Started:Success', 'Request Resolved:Success', 'Request Closed:Success',
    ]);
    for (const entry of manager.getAuditLog()) {
      for (const field of ['auditId', 'actorId', 'actorRole', 'action', 'description', 'timestamp', 'outcome']) {
        assert.ok(entry[field], `audit entry ${entry.auditId} is missing ${field}`);
      }
      assert.ok('requestId' in entry);
    }
    assert.equal(manager.getAuditLog({ actorId: 'DWU2026001' })[0].action, 'User Registered');
    assert.equal(new Set(manager.getAuditLog().map((e) => e.auditId)).size, manager.getAuditLog().length, 'audit IDs are unique');
  });

  test('D13 report calculations', async () => {
    const student = h.makeStudent();
    const tech = h.makeTechnician();
    const tech2 = h.makeTechnician('TECH002');
    const actor = h.makeOfficer();
    const t0 = '2026-10-20T00:00:00.000Z';

    const closed = h.makeICT(student, { requestId: 'REQ001', dateSubmitted: t0, location: 'Library' });
    closed.review(actor); closed.assignTechnician('TECH001', actor); closed.startWork(tech); closed.resolve(tech, 'done');
    const urgent = h.makeMaintenance(student, { requestId: 'REQ002', priority: 'Urgent', dateSubmitted: t0, location: 'Library' });
    const fresh = h.makeCleaning(student, { requestId: 'REQ003', dateSubmitted: '2026-10-25T00:00:00.000Z', location: 'Dining Hall' });
    const cancelled = h.makeGeneral(student, { requestId: 'REQ004', dateSubmitted: t0 });
    cancelled.cancelRequest(student);

    const reports = new ReportGenerator([closed, urgent, fresh, cancelled], [student, tech, tech2]);
    assert.deepEqual(reports.groupByStatus(), { Submitted: 2, Reviewed: 0, Assigned: 0, 'In Progress': 0, Resolved: 1, Closed: 0, Cancelled: 1 });
    assert.deepEqual(reports.groupByCategory(), { 'ICT Support': 1, 'Facilities Maintenance': 1, 'Cleaning and Sanitation': 1, 'General Campus Service': 1 });
    assert.deepEqual(reports.groupByPriority(), { Low: 1, Normal: 1, High: 1, Urgent: 1 });
    assert.deepEqual(reports.getUrgentRequests().map((r) => r.requestId), ['REQ002']);

    // On 25 Oct 01:00 UTC: REQ002 is 121 h old with a 4 h target (High hazard); REQ003 is 1 h old (12 h target).
    const overdue = reports.getOverdueRequests(new Date('2026-10-25T01:00:00.000Z'));
    assert.deepEqual(overdue.map((r) => [r.requestId, r.targetHours, r.hoursOverdue]), [['REQ002', 4, 117]]);

    assert.deepEqual(reports.getAssignmentsByTechnician(), [
      { technicianId: 'TECH001', name: 'John Bais', assigned: 1, open: 0, completed: 1 },
      { technicianId: 'TECH002', name: 'John Bais', assigned: 0, open: 0, completed: 0 },
    ]);
    assert.deepEqual(reports.getCompletedByTechnician(), [{ technicianId: 'TECH001', name: 'John Bais', completed: 1 }]);
    const average = reports.getAverageResolutionTime();
    assert.equal(average.resolvedCount, 1);
    assert.ok(average.overallHours > 100, 'resolved several days after submission');
    assert.equal(average.byCategory['Cleaning and Sanitation'], null);
    assert.deepEqual(reports.getVolumeByLocation()[0], { location: 'Library', count: 2 });
    assert.match(ReportGenerator.formatCounts('By status', reports.groupByStatus()), /Total\s+:\s+4/);
  });
});
