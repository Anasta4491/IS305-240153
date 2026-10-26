'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const User = require('../src/User');
const ServiceRequestManager = require('../src/ServiceRequestManager');
const { ValidationError, DuplicateError, PermissionError, WorkflowError } = require('../src/errors');
const h = require('./helpers');

describe('Pass component - users', () => {
  test('P01 valid user registration adds the user', async () => {
    const manager = new ServiceRequestManager();
    const user = new User({ userId: 'DWU2026001', firstName: 'Grace', lastName: 'Kila', email: 'Grace.Kila@Student.Campus.Example', userType: 'Student' });
    await manager.registerUser(user);
    assert.equal(manager.getAllUsers().length, 1);
    assert.equal(manager.findUserById('dwu2026001'), user);
    assert.equal(user.getFullName(), 'Grace Kila');
    assert.equal(user.email, 'grace.kila@student.campus.example');
    assert.match(user.displayInfo(), /User Type : Student/);
  });

  test('P02 duplicate user ID is rejected', async () => {
    const manager = new ServiceRequestManager();
    await manager.registerUser(h.makeStudent('DWU2026001', 'a@student.campus.example'));
    await assert.rejects(
      manager.registerUser(h.makeStudent('DWU2026001', 'b@student.campus.example')),
      DuplicateError,
    );
    assert.equal(manager.getAllUsers().length, 1);
  });

  test('P03 missing user ID, missing names and invalid email are rejected', () => {
    const base = { userId: 'DWU1', firstName: 'A', lastName: 'B', email: 'a@b.com', userType: 'Student' };
    assert.throws(() => new User({ ...base, userId: '' }), /User ID is required/);
    assert.throws(() => new User({ ...base, firstName: '  ' }), /First name is required/);
    assert.throws(() => new User({ ...base, lastName: undefined }), /Last name is required/);
    assert.throws(() => new User({ ...base, email: 'not-an-email' }), ValidationError);
  });

  test('P04 controlled setters validate new values and userId cannot be changed', () => {
    const user = h.makeStudent();
    user.firstName = 'Gracie';
    assert.equal(user.firstName, 'Gracie');
    assert.throws(() => { user.email = 'broken@'; }, ValidationError);
    assert.equal(user.email, 'grace.kila@student.campus.example');
    assert.throws(() => { 'use strict'; user.userId = 'HACK'; }, TypeError);
    assert.equal(user.userId, 'DWU2026001');
  });
});

describe('Pass component - requests', () => {
  test('P05 valid request is stored with Submitted status', async () => {
    const { manager, student } = await h.managerWithUsers();
    const request = h.makeICT(student, { requestId: manager.generateRequestId() });
    await manager.submitRequest(request);
    assert.equal(request.requestId, 'REQ001');
    assert.equal(manager.findRequestById('req001').status, 'Submitted');
    assert.ok(request.dateSubmitted instanceof Date);
  });

  test('P06 invalid request category is rejected clearly', async () => {
    const { student } = await h.managerWithUsers();
    assert.throws(() => h.makeICT(student, { category: 'Plumbing' }), /"Plumbing" is not a supported category/);
    const Factory = require('../src/requests/ServiceRequestFactory');
    assert.throws(() => Factory.create({ category: 'Catering' }, {}), /not a supported category/);
  });

  test('P07 missing title/description and unsupported priority are rejected', async () => {
    const { student } = await h.managerWithUsers();
    assert.throws(() => h.makeICT(student, { title: '' }), /Request title is required/);
    assert.throws(() => h.makeICT(student, { description: '' }), /Request description is required/);
    assert.throws(() => h.makeICT(student, { priority: 'Critical' }), /"Critical" is not a supported priority/);
  });

  test('P08 duplicate request ID is rejected', async () => {
    const { manager, student } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student, { requestId: 'REQ001' }));
    await assert.rejects(manager.submitRequest(h.makeCleaning(student, { requestId: 'REQ001' })), DuplicateError);
  });

  test('P09 view requester records shows only that user\'s requests', async () => {
    const { manager, student, student2 } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student, { requestId: 'REQ001' }));
    await manager.submitRequest(h.makeCleaning(student2, { requestId: 'REQ002' }));
    await manager.submitRequest(h.makeGeneral(student, { requestId: 'REQ003' }));
    const mine = manager.getRequestsByUser('DWU2026001');
    assert.deepEqual(mine.map((r) => r.requestId), ['REQ001', 'REQ003']);
    assert.ok(mine.every((r) => r.requesterId === 'DWU2026001'));
  });

  test('P10 requester updates own Submitted request; other users are refused', async () => {
    const { manager, student, student2 } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student, { requestId: 'REQ001' }));
    await manager.updateRequest('REQ001', 'DWU2026001', { title: 'Wi-Fi down on Level 2', networkImpact: 'Campus-wide' });
    const request = manager.findRequestById('REQ001');
    assert.equal(request.title, 'Wi-Fi down on Level 2');
    assert.equal(request.networkImpact, 'Campus-wide');
    await assert.rejects(manager.updateRequest('REQ001', student2.userId, { title: 'Hijacked' }), PermissionError);
    await assert.rejects(manager.updateRequest('REQ001', 'DWU2026001', { priority: 'Extreme' }), ValidationError);
    assert.equal(request.title, 'Wi-Fi down on Level 2');
  });

  test('P11 cancel Submitted request changes status to Cancelled', async () => {
    const { manager, student } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student, { requestId: 'REQ001' }));
    await manager.cancelRequest('REQ001', 'DWU2026001', 'Fixed itself');
    assert.equal(manager.findRequestById('REQ001').status, 'Cancelled');
  });

  test('P12 cancelling another user\'s request or an already Cancelled request is rejected', async () => {
    const { manager, student, student2 } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student, { requestId: 'REQ001' }));
    await assert.rejects(manager.cancelRequest('REQ001', student2.userId), PermissionError);
    await manager.cancelRequest('REQ001', student.userId);
    await assert.rejects(manager.cancelRequest('REQ001', student.userId), /already Cancelled/);
    await assert.rejects(manager.updateRequest('REQ001', student.userId, { title: 'x' }), WorkflowError);
  });

  test('P13 search and status summary', async () => {
    const { manager, student } = await h.managerWithUsers();
    await manager.submitRequest(h.makeICT(student, { requestId: 'REQ001' }));
    await manager.submitRequest(h.makeCleaning(student, { requestId: 'REQ002' }));
    await manager.cancelRequest('REQ002', student.userId);
    assert.deepEqual(manager.searchRequests('wi-fi').map((r) => r.requestId), ['REQ001']);
    assert.deepEqual(manager.searchRequests('req002').map((r) => r.requestId), ['REQ002']);
    assert.throws(() => manager.searchRequests('   '), ValidationError);
    const summary = manager.getRequestSummaryByStatus();
    assert.equal(summary.Submitted, 1);
    assert.equal(summary.Cancelled, 1);
    assert.equal(summary.Total, 2);
  });
});
