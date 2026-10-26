# Campus Service Request Management System

**IS305 – Object-Oriented Programming · AT3 Major Project**

| | |
|---|---|
| Student name | [Student Name] |
| Student ID | [Student ID] |
| GitHub repository | https://github.com/[username]/IS305-[StudentID]/tree/main/AT3_CampusServiceRequestSystem |
| Technology | JavaScript, Node.js console application, JSON files (no database) |

## Project Description

Students and staff report campus problems (ICT faults, damaged facilities, cleaning needs and other services). This console application records each request, lets a Service Officer review it, set its priority and assign a Technician, lets the Technician record progress and resolve it, and lets the officer verify and close it. Every change is kept in the request's history and in an audit log, all data is saved to JSON files, and management reports summarise the workload.

## Achievement Components Attempted

| Component | Attempted | Status |
|---|---|---|
| Pass – core classes, workflow, validation | Yes | Complete |
| Credit – inheritance, constructor chaining, role workflow, history, filter/sort | Yes | Complete |
| Distinction – polymorphism, abstraction, JSON persistence, repositories, factory, audit, reports, automated tests | Yes | Complete |

## Features Completed

**Pass**
- `User`, `ServiceRequest`, `ServiceRequestManager`, `CampusServiceApp` with private fields, getters, controlled setters and validation.
- Register users; submit, view (by ID, by user, all), update, cancel and search requests; status summary.
- Rejects missing IDs/names, invalid emails, duplicate user and request IDs, missing titles/descriptions, unsupported categories and priorities, updates or cancellations by another user, and cancelling twice.

**Credit**
- User subclasses: `StudentRequester`, `StaffRequester`, `ServiceOfficer`, `Technician` (+ `SystemAdministrator`), all using `super()`.
- Request subclasses: `ICTSupportRequest`, `MaintenanceRequest`, `CleaningRequest` (+ `GeneralServiceRequest` for the fourth category), all using `super(commonRequestData)` with validated specialised fields.
- Controlled workflow Submitted → Reviewed → Assigned → In Progress → Resolved → Closed (Cancelled final); invalid transitions rejected.
- Role permissions: owner-only update/cancel, officer-only review/priority/assign/close, assigned-Technician-only start/note/resolve.
- Overridden `getRequestSummary()`, `calculatePriorityScore()`, `getTargetResolutionHours()`, `validateSpecialisedFields()`.
- Search by ID/title; filter by category, status, priority, Technician; sort by date or priority; full request history.

**Distinction**
- One collection of mixed request types processed with the same method calls (Reports → option 10).
- `ServiceRequest` is abstract-style: cannot be instantiated; abstract methods throw clear errors.
- JSON persistence with `fs/promises`: four data files, created empty when missing, saved after each successful change, atomic writes, clear read/write errors.
- Repository classes (`JsonFileRepository` base + four subclasses) and `CampusDataStore`; the console app never touches files.
- `ServiceRequestFactory.createFromData()` and `UserFactory` restore the correct subclasses.
- Audit trail of all required actions, including rejected attempts.
- Nine management reports using `filter`, `map`, `reduce` and `sort`.
- 38 automated tests with the built-in Node.js test runner, all using temporary folders.

## Project Folder Structure

```
AT3_CampusServiceRequestSystem/
├── package.json
├── README.md
├── AI_Use_Declaration.md
├── data/            users.json, serviceRequests.json, requestHistory.json, auditLog.json
├── src/
│   ├── CampusServiceApp.js   ServiceRequestManager.js   User.js   ServiceRequest.js
│   ├── constants.js   errors.js
│   ├── users/         StudentRequester, StaffRequester, ServiceOfficer, Technician,
│   │                  SystemAdministrator, UserFactory
│   ├── requests/      ICTSupportRequest, MaintenanceRequest, CleaningRequest,
│   │                  GeneralServiceRequest, ServiceRequestFactory, fieldRules
│   ├── repositories/  JsonFileRepository, UserFileRepository, ServiceRequestFileRepository,
│   │                  RequestHistoryFileRepository, AuditFileRepository, CampusDataStore
│   └── reports/       ReportGenerator
├── scripts/seedData.js
├── tests/           pass.test.js, credit.test.js, distinction.test.js, helpers.js
└── docs/            01_Requirements_Document.md, 02_UML_and_System_Design.md,
                     03_Technical_Documentation.md, 04_User_Guide.md, 05_Test_Report.md,
                     uml/, screenshots/, evidence/
```

## Installation

Requires Node.js 20 or later (tested on Node.js 22). No external packages.

```
cd AT3_CampusServiceRequestSystem
npm install
```

## Running the Application

```
node src/CampusServiceApp.js        # or: npm start
npm run seed                        # reset data/ to the demonstration records (deletes added data)
```

Set `CAMPUS_DATA_DIR` to use a different data folder.

## The JSON Data Files

| File | What it holds |
|---|---|
| `data/users.json` | Every registered user, with `userType` and the subclass fields (e.g. `programme`, `speciality`). |
| `data/serviceRequests.json` | Every request: common fields, `requestType` (class name), `requesterId`, `assignedTechnicianId`, dates and the specialised fields. |
| `data/requestHistory.json` | Every history entry (previous status, new status, action, actor, role, comment, time) tagged with its `requestId`. |
| `data/auditLog.json` | Every audit entry (audit ID, actor, role, action, request ID, description, time, outcome). |

The files contain simulated data only — no code, passwords or real records. Missing files are created as empty arrays at start-up. Saves write to a temporary file and then rename it, so a crash cannot leave a half-written file.

## How Objects Are Restored from Saved Data

JSON holds plain data, not class objects. At start-up `CampusDataStore.loadAll()`:

1. reads each file through its repository;
2. rebuilds each user with `UserFactory.createFromData()` (giving a real `StudentRequester`, `Technician`, …);
3. groups history entries by `requestId`;
4. rebuilds each request with `ServiceRequestFactory.createFromData(record, { requester, history })`, which chooses the class from `requestType`, swaps `requesterId` back for the user object and runs the normal constructor, so all validation runs again.

Restored requests keep their specialised fields, overridden methods, history and workflow rules. Invalid records are skipped with a warning instead of stopping the program.

## Running the Tests

```
npm test
```

Runs 38 tests (P01–P13, C01–C12, D01–D13). Tests use temporary folders and never change `data/`. Results: `docs/05_Test_Report.md`.

## Sample User Scenarios

Using the demonstration data:

1. **Student reports a fault** – Option 2, user `DWU2026001`, category ICT Support, fill in the details. Then option 4 to see it.
2. **Officer handles it** – Option 10, `OFF001`: 1 (waiting list), 2 (review), 4 (assign to `TECH001`).
3. **Technician fixes it** – Option 11, `TECH001`: 2 (start), 3 (note), 4 (resolve).
4. **Officer closes it** – Option 10, `OFF001`: 6 (close). Option 13 shows the full history.
5. **Administrator checks** – Option 14, `ADM001`: overdue requests, Technician workload, average resolution time. Option 15: audit log, including the rejected attempt by `DWU2026002` to review REQ009.
6. **Errors** – try to cancel REQ006 as `DWU2026001` (not the owner), or close REQ007 as `OFF001` (not yet resolved).

## Known Limitations

- No passwords or login; users identify themselves by ID.
- Whole JSON files are rewritten on each save (fine for this scale).
- If saving fails after a workflow step, the change remains in memory for the session but is not saved (the user is told).
- No reassigning Technicians or reopening resolved requests.
- Single console user at a time.

## Future Improvements

- Proper authentication and a current-user session.
- Reassign and reopen workflow steps.
- Email/SMS notifications on status changes.
- Configurable target resolution times.
- A web interface reusing the same domain and manager classes.

## AI Use Declaration

AI (Claude, by Anthropic) was used to produce this project. Full details are in [`AI_Use_Declaration.md`](AI_Use_Declaration.md), which must be completed and signed by the student before submission.
