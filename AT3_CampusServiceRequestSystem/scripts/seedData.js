'use strict';

/**
 * Resets the data folder with simulated demonstration records.
 *
 * It does NOT write JSON by hand. It runs the real workflow through the
 * ServiceRequestManager (registration, submission, review, assignment ...)
 * with a simulated clock, so the saved files, history and audit trail are
 * exactly what the application itself would produce.
 *
 * Usage:  npm run seed            (writes to ./data)
 *         node scripts/seedData.js <folder>
 *
 * All names, IDs and email addresses are fictional.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

// ---- simulated clock -------------------------------------------------------
const RealDate = Date;
let clock = new RealDate('2026-09-01T08:00:00+10:00').getTime();
class SimulatedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(clock);
    else super(...args);
  }
  static now() { return clock; }
}
globalThis.Date = SimulatedDate;
const at = (iso) => { clock = new RealDate(iso).getTime(); };

const ServiceRequestManager = require('../src/ServiceRequestManager');
const CampusDataStore = require('../src/repositories/CampusDataStore');
const UserFactory = require('../src/users/UserFactory');
const ServiceRequestFactory = require('../src/requests/ServiceRequestFactory');

async function seed(folder) {
  for (const file of ['users.json', 'serviceRequests.json', 'requestHistory.json', 'auditLog.json']) {
    await fs.rm(path.join(folder, file), { force: true });
  }
  const { manager } = await ServiceRequestManager.createWithDataStore(new CampusDataStore(folder));

  // ---------------------------------------------------------------- users
  const users = [
    { userType: 'Student', userId: 'DWU2026001', firstName: 'Grace', lastName: 'Kila', email: 'grace.kila@student.campus.example', programme: 'Bachelor of Information Technology', yearLevel: 2 },
    { userType: 'Student', userId: 'DWU2026002', firstName: 'Peter', lastName: 'Wama', email: 'peter.wama@student.campus.example', programme: 'Bachelor of Business Studies', yearLevel: 3 },
    { userType: 'Staff', userId: 'STF1001', firstName: 'Ruth', lastName: 'Kaupa', email: 'ruth.kaupa@staff.campus.example', department: 'Information Systems' },
    { userType: 'Service Officer', userId: 'OFF001', firstName: 'Michael', lastName: 'Tobias', email: 'michael.tobias@staff.campus.example', serviceSection: 'Campus Services Help Desk' },
    { userType: 'Technician', userId: 'TECH001', firstName: 'John', lastName: 'Bais', email: 'john.bais@staff.campus.example', speciality: 'Networking and ICT Support' },
    { userType: 'Technician', userId: 'TECH002', firstName: 'Lucy', lastName: 'Aihi', email: 'lucy.aihi@staff.campus.example', speciality: 'Electrical and Building Maintenance' },
    { userType: 'Technician', userId: 'TECH003', firstName: 'Samuel', lastName: 'Pona', email: 'samuel.pona@staff.campus.example', speciality: 'Cleaning and Sanitation' },
    { userType: 'Administrator', userId: 'ADM001', firstName: 'Helen', lastName: 'Morobe', email: 'helen.morobe@staff.campus.example' },
  ];
  for (const data of users) {
    await manager.registerUser(UserFactory.createFromData(data));
    clock += 5 * 60_000;
  }

  const submit = async (when, requesterId, common, specialised) => {
    at(when);
    const request = ServiceRequestFactory.create(
      { ...common, requestId: manager.generateRequestId(), requester: manager.findUserById(requesterId) },
      specialised,
    );
    return manager.submitRequest(request);
  };

  // REQ001 - ICT, full workflow to Closed
  const r1 = await submit('2026-09-08T09:30:00+10:00', 'DWU2026001',
    { category: 'ICT Support', title: 'Unable to access campus Wi-Fi', description: 'Laptop connects to the network but no pages load on Level 2.', location: 'Library Level 2', priority: 'High' },
    { deviceType: 'Laptop', systemName: 'Campus Wi-Fi', faultType: 'Network', networkImpact: 'Department' });
  at('2026-09-08T10:05:00+10:00'); await manager.reviewRequest(r1.requestId, 'OFF001', 'Several students reported the same problem.');
  at('2026-09-08T10:10:00+10:00'); await manager.assignTechnician(r1.requestId, 'OFF001', 'TECH001', 'Check the Level 2 access point.');
  at('2026-09-08T11:00:00+10:00'); await manager.startWork(r1.requestId, 'TECH001', 'On site at the library.');
  at('2026-09-08T12:15:00+10:00'); await manager.addProgressNote(r1.requestId, 'TECH001', 'Access point AP-L2-03 was not getting an IP lease. Restarted the switch port.');
  at('2026-09-08T14:40:00+10:00'); await manager.resolveRequest(r1.requestId, 'TECH001', 'Replaced faulty patch cable to AP-L2-03. Wi-Fi working on Level 2.');
  at('2026-09-09T08:30:00+10:00'); await manager.closeRequest(r1.requestId, 'OFF001', 'Confirmed with library staff that Wi-Fi is working.');

  // REQ002 - Maintenance, Resolved (waiting for officer to close)
  const r2 = await submit('2026-09-15T13:10:00+10:00', 'STF1001',
    { category: 'Facilities Maintenance', title: 'Roof leaking above lecture seats', description: 'Rain water drips onto the back two rows during heavy rain.', location: 'Lecture Theatre 1', priority: 'Normal' },
    { building: 'Lecture Theatre Complex', roomNumber: 'LT1', hazardLevel: 'Medium', equipmentAffected: 'Ceiling panels and seating' });
  at('2026-09-15T14:00:00+10:00'); await manager.reviewRequest(r2.requestId, 'OFF001', 'Wet floor is a slip risk.');
  at('2026-09-15T14:05:00+10:00'); await manager.setPriority(r2.requestId, 'OFF001', 'High', 'Slip hazard in a busy lecture theatre.');
  at('2026-09-15T14:10:00+10:00'); await manager.assignTechnician(r2.requestId, 'OFF001', 'TECH002');
  at('2026-09-16T08:00:00+10:00'); await manager.startWork(r2.requestId, 'TECH002', 'Inspecting roof sheeting.');
  at('2026-09-16T15:30:00+10:00'); await manager.resolveRequest(r2.requestId, 'TECH002', 'Resealed two roof sheets and replaced three stained ceiling panels.');

  // REQ003 - Maintenance, Closed
  const r9 = await submit('2026-09-25T09:00:00+10:00', 'STF1001',
    { category: 'Facilities Maintenance', title: 'Office door lock jammed', description: 'Key turns but the latch does not open.', location: 'Administration Block', priority: 'Low' },
    { building: 'Administration Block', roomNumber: 'A-14', hazardLevel: 'None', equipmentAffected: 'Door lock' });
  at('2026-09-25T10:00:00+10:00'); await manager.reviewRequest(r9.requestId, 'OFF001');
  at('2026-09-25T10:05:00+10:00'); await manager.assignTechnician(r9.requestId, 'OFF001', 'TECH002');
  at('2026-09-26T09:00:00+10:00'); await manager.startWork(r9.requestId, 'TECH002');
  at('2026-09-26T09:45:00+10:00'); await manager.resolveRequest(r9.requestId, 'TECH002', 'Replaced lock cylinder and latch. Two new keys given to the office.');
  at('2026-09-26T13:00:00+10:00'); await manager.closeRequest(r9.requestId, 'OFF001', 'Staff member confirmed the door works.');

  // REQ004 - Cleaning, Cancelled by requester
  const r7 = await submit('2026-10-01T12:30:00+10:00', 'DWU2026001',
    { category: 'Cleaning and Sanitation', title: 'Rubbish bins overflowing', description: 'Bins outside the dining hall are full and attracting flies.', location: 'Student Dining Hall', priority: 'Normal' },
    { cleaningArea: 'Dining hall entrance', hygieneRisk: 'Medium', serviceType: 'Waste Removal', preferredServiceTime: 'Any Time' });
  at('2026-10-01T15:00:00+10:00'); await manager.cancelRequest(r7.requestId, 'DWU2026001', 'Bins were emptied on the normal collection run.');

  // REQ005 - Cleaning, In Progress
  const r3 = await submit('2026-10-20T07:45:00+10:00', 'DWU2026002',
    { category: 'Cleaning and Sanitation', title: 'Blocked and overflowing toilet', description: 'The second toilet in the block is blocked and water is on the floor.', location: 'Student Residence Block C', priority: 'High' },
    { cleaningArea: 'Block C ground floor bathroom', hygieneRisk: 'High', serviceType: 'Sanitisation', preferredServiceTime: 'Morning' });
  at('2026-10-20T08:10:00+10:00'); await manager.reviewRequest(r3.requestId, 'OFF001');
  at('2026-10-20T08:15:00+10:00'); await manager.assignTechnician(r3.requestId, 'OFF001', 'TECH003');
  at('2026-10-20T09:00:00+10:00'); await manager.startWork(r3.requestId, 'TECH003', 'Bathroom closed off for cleaning.');
  at('2026-10-20T10:30:00+10:00'); await manager.addProgressNote(r3.requestId, 'TECH003', 'Floor cleaned. Plumber needed to clear the blockage.');

  // REQ006 - ICT, Assigned
  const r4 = await submit('2026-10-22T10:20:00+10:00', 'STF1001',
    { category: 'ICT Support', title: 'Projector shows no signal', description: 'Projector turns on but shows "No Signal" from the lectern PC.', location: 'Lecture Room 4', priority: 'Normal' },
    { deviceType: 'Projector', systemName: 'Lectern PC display', faultType: 'Hardware', networkImpact: 'None' });
  at('2026-10-22T11:00:00+10:00'); await manager.reviewRequest(r4.requestId, 'OFF001');
  at('2026-10-22T11:05:00+10:00'); await manager.assignTechnician(r4.requestId, 'OFF001', 'TECH001', 'Bring a spare HDMI cable.');

  // REQ007 - Maintenance, Reviewed, urgent safety hazard
  const r5 = await submit('2026-10-23T15:00:00+10:00', 'DWU2026001',
    { category: 'Facilities Maintenance', title: 'Exposed electrical wiring', description: 'Wall socket cover is broken and wires are exposed next to desk 12.', location: 'ICT Building Lab 3', priority: 'High' },
    { building: 'ICT Building', roomNumber: 'Lab 3', hazardLevel: 'High', equipmentAffected: 'Wall power socket' });
  at('2026-10-23T15:20:00+10:00'); await manager.reviewRequest(r5.requestId, 'OFF001', 'Lab 3 desk 12 taped off.');
  at('2026-10-23T15:25:00+10:00'); await manager.setPriority(r5.requestId, 'OFF001', 'Urgent', 'Electrical shock risk.');

  // REQ008 - General, Submitted
  await submit('2026-10-24T18:40:00+10:00', 'DWU2026002',
    { category: 'General Campus Service', title: 'Street light not working near car park', description: 'The light pole at the north car park entrance has been off for three nights.', location: 'North Car Park', priority: 'Normal' },
    { serviceArea: 'Security' });

  // REQ009 - ICT, Submitted, urgent
  const r8 = await submit('2026-10-25T08:15:00+10:00', 'DWU2026002',
    { category: 'ICT Support', title: 'Cannot log in to Moodle before assignment deadline', description: 'Moodle says my account is locked. Assignment is due today.', location: 'Library Level 1', priority: 'Urgent' },
    { deviceType: 'Desktop PC', systemName: 'Moodle', faultType: 'Account Access', networkImpact: 'Single User' });

  // A refused attempt, so the audit log shows a Rejected outcome.
  at('2026-10-25T08:20:00+10:00');
  await manager.reviewRequest(r8.requestId, 'DWU2026002', 'Please hurry').catch(() => {});

  return manager;
}

if (require.main === module) {
  const folder = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data'));
  seed(folder)
    .then((manager) => {
      console.log(`Seeded ${manager.getAllUsers().length} users, ${manager.getAllRequests().length} requests and ${manager.getAuditLog().length} audit entries into ${folder}`);
    })
    .catch((error) => {
      console.error(`Seeding failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { seed };
