'use strict';

/** Shared test data. Everything here is simulated. */
const StudentRequester = require('../src/users/StudentRequester');
const StaffRequester = require('../src/users/StaffRequester');
const ServiceOfficer = require('../src/users/ServiceOfficer');
const Technician = require('../src/users/Technician');
const SystemAdministrator = require('../src/users/SystemAdministrator');
const ICTSupportRequest = require('../src/requests/ICTSupportRequest');
const MaintenanceRequest = require('../src/requests/MaintenanceRequest');
const CleaningRequest = require('../src/requests/CleaningRequest');
const GeneralServiceRequest = require('../src/requests/GeneralServiceRequest');
const ServiceRequestManager = require('../src/ServiceRequestManager');

const makeStudent = (id = 'DWU2026001', email = 'grace.kila@student.campus.example') =>
  new StudentRequester({ userId: id, firstName: 'Grace', lastName: 'Kila', email }, { programme: 'BIT', yearLevel: 2 });
const makeStaff = (id = 'STF1001') =>
  new StaffRequester({ userId: id, firstName: 'Ruth', lastName: 'Kaupa', email: `${id.toLowerCase()}@staff.campus.example` }, { department: 'Information Systems' });
const makeOfficer = (id = 'OFF001') =>
  new ServiceOfficer({ userId: id, firstName: 'Michael', lastName: 'Tobias', email: `${id.toLowerCase()}@staff.campus.example` }, { serviceSection: 'Help Desk' });
const makeTechnician = (id = 'TECH001') =>
  new Technician({ userId: id, firstName: 'John', lastName: 'Bais', email: `${id.toLowerCase()}@staff.campus.example` }, { speciality: 'Networking' });
const makeAdmin = (id = 'ADM001') =>
  new SystemAdministrator({ userId: id, firstName: 'Helen', lastName: 'Morobe', email: `${id.toLowerCase()}@staff.campus.example` });

function makeICT(requester, overrides = {}, specialised = {}) {
  return new ICTSupportRequest(
    { requestId: 'REQ001', requester, title: 'Unable to access campus Wi-Fi', description: 'No internet on Level 2', location: 'Library Level 2', priority: 'High', ...overrides },
    { deviceType: 'Laptop', systemName: 'Campus Wi-Fi', faultType: 'Network', networkImpact: 'Department', ...specialised },
  );
}

function makeMaintenance(requester, overrides = {}, specialised = {}) {
  return new MaintenanceRequest(
    { requestId: 'REQ002', requester, title: 'Exposed wiring', description: 'Broken socket cover', location: 'ICT Lab 3', priority: 'High', ...overrides },
    { building: 'ICT Building', roomNumber: 'Lab 3', hazardLevel: 'High', equipmentAffected: 'Wall socket', ...specialised },
  );
}

function makeCleaning(requester, overrides = {}, specialised = {}) {
  return new CleaningRequest(
    { requestId: 'REQ003', requester, title: 'Overflowing bins', description: 'Bins are full', location: 'Dining Hall', priority: 'Normal', ...overrides },
    { cleaningArea: 'Entrance', hygieneRisk: 'Medium', serviceType: 'Waste Removal', preferredServiceTime: 'Morning', ...specialised },
  );
}

function makeGeneral(requester, overrides = {}, specialised = {}) {
  return new GeneralServiceRequest(
    { requestId: 'REQ004', requester, title: 'Street light out', description: 'Car park light off', location: 'North Car Park', priority: 'Low', ...overrides },
    { serviceArea: 'Security', ...specialised },
  );
}

/** A manager with one of each role registered. */
async function managerWithUsers(options) {
  const manager = new ServiceRequestManager(options);
  const users = {
    student: makeStudent(),
    student2: makeStudent('DWU2026002', 'peter.wama@student.campus.example'),
    staff: makeStaff(),
    officer: makeOfficer(),
    tech: makeTechnician(),
    tech2: makeTechnician('TECH002'),
    admin: makeAdmin(),
  };
  for (const user of Object.values(users)) await manager.registerUser(user);
  return { manager, ...users };
}

module.exports = {
  makeStudent, makeStaff, makeOfficer, makeTechnician, makeAdmin,
  makeICT, makeMaintenance, makeCleaning, makeGeneral, managerWithUsers,
};
