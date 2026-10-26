# Technical Documentation
## Campus Service Request Management System

**Student:** [Student Name] – [Student ID]  
**Runtime:** Node.js 20+ (developed and tested on Node.js 22) – no external packages

---

## 1. Project Folder Structure

```
AT3_CampusServiceRequestSystem/
├── package.json                 npm scripts: start, test, seed
├── README.md
├── AI_Use_Declaration.md
├── data/                        JSON data files (simulated data only)
│   ├── users.json
│   ├── serviceRequests.json
│   ├── requestHistory.json
│   └── auditLog.json
├── src/
│   ├── CampusServiceApp.js      console menu (entry point) + ConsoleIO
│   ├── User.js                  base user class
│   ├── ServiceRequest.js        abstract-style base request class + workflow
│   ├── ServiceRequestManager.js manages users/requests, permissions, audit
│   ├── constants.js             categories, priorities, statuses, transitions
│   ├── errors.js                custom error classes
│   ├── users/                   StudentRequester, StaffRequester, ServiceOfficer,
│   │                            Technician, SystemAdministrator, UserFactory
│   ├── requests/                ICTSupportRequest, MaintenanceRequest, CleaningRequest,
│   │                            GeneralServiceRequest, ServiceRequestFactory, fieldRules
│   ├── repositories/            JsonFileRepository + 4 file repositories, CampusDataStore
│   └── reports/                 ReportGenerator
├── scripts/
│   └── seedData.js              resets data/ with simulated demonstration records
├── tests/
│   ├── helpers.js               shared simulated test objects
│   ├── pass.test.js             P01–P13
│   ├── credit.test.js           C01–C12
│   └── distinction.test.js      D01–D13
└── docs/                        requirements, UML, this document, user guide,
                                 test report, screenshots and evidence
```

## 2. Responsibility of Each Class

| Class | File | Responsibility |
|---|---|---|
| `User` | `src/User.js` | Identity data (ID, names, email, user type) in private fields; validation; `getFullName()`, `displayInfo()`; role capability methods. |
| `StudentRequester` | `src/users/` | Adds programme and year level (1–6). May submit requests. |
| `StaffRequester` | `src/users/` | Adds department. May submit requests. |
| `ServiceOfficer` | `src/users/` | Adds service section. May review, prioritise, assign, close and view reports. |
| `Technician` | `src/users/` | Adds technical speciality. May work on assigned requests. |
| `SystemAdministrator` | `src/users/` | May view reports and the audit log. |
| `UserFactory` | `src/users/` | Builds the right user subclass from plain data (menu answers or JSON). |
| `ServiceRequest` | `src/ServiceRequest.js` | Abstract-style base. Common fields, validation, `updateDetails()`, `cancelRequest()`, all workflow steps, the single `changeStatus()` method, history, overdue calculation, `toJSON()`. |
| `ICTSupportRequest` | `src/requests/` | Device type, system name, fault type, network impact. |
| `MaintenanceRequest` | `src/requests/` | Building, room, hazard level, equipment affected. |
| `CleaningRequest` | `src/requests/` | Cleaning area, hygiene risk, service type, preferred time. |
| `GeneralServiceRequest` | `src/requests/` | Service area (Security, Grounds, Transport, Events, Other). Covers the fourth required category. |
| `ServiceRequestFactory` | `src/requests/` | `create()` chooses the class by category; `createFromData()` rebuilds a saved record by its `requestType`. |
| `ServiceRequestManager` | `src/ServiceRequestManager.js` | Holds the users, requests and audit arrays; registration, submission, lookup, search, filter, sort; role permission checks; audit trail; asks the data store to save after each successful change. |
| `ReportGenerator` | `src/reports/` | Nine management reports using `filter`, `map`, `reduce`, `sort`; text formatting helpers. |
| `JsonFileRepository` | `src/repositories/` | Generic JSON array file: `loadAll`, `saveAll`, `create`, `findById`, `findWhere`, `update`. |
| `UserFileRepository`, `ServiceRequestFileRepository`, `RequestHistoryFileRepository`, `AuditFileRepository` | `src/repositories/` | One per file, with the right ID field and extra finders (`findByRequester`, `findByTechnician`, `findByRequest`, `findByActor`, `findByType`). |
| `CampusDataStore` | `src/repositories/` | Owns the four repositories for one data folder; converts objects ↔ JSON; restores objects through the factories. |
| `CampusServiceApp` | `src/CampusServiceApp.js` | Console menus and prompts. Calls the manager only; never reads or writes files. |
| `ConsoleIO` | `src/CampusServiceApp.js` | Wraps `readline` so a question waits for one line; also works with piped input for demonstrations. |
| Error classes | `src/errors.js` | `ValidationError`, `DuplicateError`, `NotFoundError`, `PermissionError`, `WorkflowError`, `DataFileError`. |

## 3. Where Encapsulation Is Used

- **Private fields.** Every domain class stores its data in `#` fields, for example `#userId`, `#email` in `User`, and `#status`, `#history` in `ServiceRequest`. Code outside the class cannot read or change them directly.
- **Getters.** Read access is through getters (`user.email`, `request.status`). Date getters return a *copy* of the `Date`, and `getHistory()` returns copies of the entries, so callers cannot change internal state by editing what they receive.
- **Controlled setters.** `User` has setters for first name, last name and email that validate the new value; there is no setter for `userId` or `userType`, so assigning to them throws a `TypeError` in strict mode (tested in P04).
- **Controlled methods instead of setters.** A request's status can only change through `review()`, `assignTechnician()`, `startWork()`, `resolve()`, `close()` and `cancelRequest()`, which all go through `changeStatus()`. There is no `status` setter.
- **Private helpers.** `#ensureTransition()`, `#addHistory()`, `#touch()` in `ServiceRequest`, and `#runAction()`, `#addAudit()`, `#save()` in the manager are private methods, so they cannot be called from outside.
- **Manager arrays.** `getAllRequests()` and `getAllUsers()` return new arrays, so the internal arrays cannot be emptied or reordered from outside.

## 4. Inheritance and Constructor Chaining

Every subclass constructor calls its parent constructor with `super()` before using `this`:

```js
// src/requests/ICTSupportRequest.js
constructor(commonRequestData = {}, specialisedData = {}) {
  super(commonRequestData);                          // base fields + base validation
  const values = ICTSupportRequest.#checkFields(specialisedData);
  this.#deviceType = values.deviceType;
  // ...
  this.validateSpecialisedFields();
}

// src/users/StudentRequester.js
constructor(userData = {}, { programme, yearLevel } = {}) {
  super({ ...userData, userType: USER_TYPES.STUDENT });
  // ...
}
```

The base constructor validates only base fields (with a private method), because the subclass fields do not exist yet while `super()` is running. The subclass then validates its own fields at the end of its constructor. `validate()` is overridden in the user subclasses as `super.validate()` followed by the specialised check.

The base `ServiceRequest` constructor also reads `new.target.CATEGORY`, so an `ICTSupportRequest` gets the category "ICT Support" by default and rejects a mismatching category.

## 5. Overriding and Polymorphism

Overridden in every request subclass:

| Method | ICTSupportRequest | MaintenanceRequest | CleaningRequest | GeneralServiceRequest |
|---|---|---|---|---|
| `calculatePriorityScore()` | priority×10 + network impact (0/5/10/20) + 5 for Network/Account Access faults | priority×10 + hazard (0/5/10/25) | priority×10 + hygiene risk (0/5/15) + 5 for Sanitisation/Pest Control | priority×10 + 10 for Security |
| `getTargetResolutionHours()` | Low 48, Normal 24, High 8, Urgent 4; halved if Campus-wide | 4 h if High hazard, else 72/48/24/8 | 2 h if High hygiene risk, else 24/12/6/3 | 120/72/48/24 |
| `getRequestSummary()` | Base lines + device, system, fault, impact | Base lines + building, room, hazard, equipment | Base lines + area, risk, service, time | Base lines + service area |
| `validateSpecialisedFields()` | own field rules | own field rules | own field rules | own field rules |

User subclasses override `canSubmitRequests()`, `canManageRequests()`, `canWorkOnRequests()`, `canViewReports()` and `displayInfo()`.

**Polymorphism in use:**

- *Management Reports → option 10* loops over all requests (every type in one array) and calls `calculatePriorityScore()` and `getTargetResolutionHours()` on each. Each class answers with its own rule.
- *View Request by ID* calls `getRequestSummary()` without knowing the type.
- `ReportGenerator.getOverdueRequests()` calls `isOverdue()`, which calls the overridden `getTargetResolutionHours()`.
- The manager's permission checks call `user.canManageRequests()` etc., so each user subclass decides.
- Test D02 runs exactly this loop and checks that three High-priority requests give three different results.

## 6. Abstraction

`ServiceRequest` is an abstract-style class:

- `new ServiceRequest(...)` throws a `TypeError` (checked with `new.target`).
- `calculatePriorityScore()`, `getTargetResolutionHours()` and `getRequestSummary()` in the base class throw `Error("<ClassName> must implement ...()")`. Test D01 creates an incomplete subclass to prove this.
- Hooks (`validateSpecialisedFields`, `getEditableSpecialisedFields`, `validateSpecialisedChanges`, `applySpecialisedChanges`, `getSpecialisedData`) let the base class run the shared algorithm while each subclass fills in its own part (the Template Method idea).

Separation of responsibilities: the menu does not know about files, the domain classes do not know about users' permissions or files, and the repositories do not know about workflow rules.

## 7. How the Request Workflow Is Controlled

Two checks happen for every workflow action:

1. **Who** – `ServiceRequestManager` checks the actor before calling the request:
   - `#requireOwner()` – requester must own the request (update, cancel);
   - `#requireOfficer()` – actor must be a Service Officer (review, priority, assign, close);
   - `#requireAssignedTechnician()` – actor must be a Technician *and* the one assigned (start, note, resolve).
2. **When** – `ServiceRequest.changeStatus()` looks up the current status in `ALLOWED_TRANSITIONS`. If the new status is not listed, a `WorkflowError` explains the move that was attempted and what is allowed next (for example `Submitted -> Closed. Allowed next status: Reviewed or Cancelled.`).

Every successful change writes a history entry inside the request and an audit entry in the manager. Refused permission or workflow attempts are written to the audit log with the outcome **Rejected**, but not to the request history (history only holds approved actions).

All workflow actions go through one private method, `#runAction()`, so lookup, auditing and saving are done the same way every time.

## 8. Validation and Error Handling

- **Where validation happens:** in constructors and setters (user and request fields), in `updateDetails()` (all values checked before any are applied), in `changeStatus()` (transitions), and in the manager (duplicates, ownership, roles, registered requester).
- **Collected messages:** validation gathers every problem and reports them together, e.g. `Request title is required. Campus location is required.`
- **Custom errors:** each kind of problem has its own class (see section 2), so the console shows a friendly `[ERROR] message` and the tests can check the exact type.
- **Console safety:** each menu action runs inside `#safely()`. Known errors are printed; the menu then continues. Option lists accept the number or the text and allow three attempts.
- **Start-up errors:** if a data file contains invalid JSON or is not an array, the program prints which file is damaged and stops without overwriting it. A single invalid record is skipped with a `[WARNING]`, and the rest of the data still loads.
- **Save errors:** a failed write raises a `DataFileError` (`Could not write users.json: ...`). Registration and submission are rolled back in memory so the screen and the files stay the same.

## 9. How JSON Data Is Stored and Restored

**Files** (in `data/`, or the folder in the `CAMPUS_DATA_DIR` environment variable):

| File | Content | ID field |
|---|---|---|
| `users.json` | One record per user, including the subclass fields | `userId` |
| `serviceRequests.json` | One record per request: common fields, `requestType`, `requesterId`, specialised fields | `requestId` |
| `requestHistory.json` | Every history entry with its `requestId` | `historyId` |
| `auditLog.json` | Every audit entry | `auditId` |

**Saving.** After a successful change the manager calls `CampusDataStore.saveUsers()`, `saveRequests()` and/or `saveAudit()`. These call each object's `toJSON()`, which returns plain data only (the requester object becomes `requesterId`, dates become ISO strings). `JsonFileRepository.saveAll()` writes the JSON to `file.tmp` and renames it over the real file, using `fs/promises` (`mkdir`, `writeFile`, `rename`).

**Loading and restoring.** At start-up `ServiceRequestManager.createWithDataStore()` calls `CampusDataStore.loadAll()`:

1. `loadAll()` on each repository reads the file. A missing file is created containing `[]`; an empty file counts as `[]`.
2. Each user record goes through `UserFactory.createFromData()`, giving a real `StudentRequester`, `Technician`, etc.
3. History records are grouped by `requestId`.
4. Each request record goes through `ServiceRequestFactory.createFromData(record, { requester, history })`. The factory picks the class from `requestType`, splits common and specialised fields, and calls the normal constructor, so all validation runs again. The `requesterId` is swapped back for the real user object.
5. The restored objects behave exactly like new ones: overridden methods, validation and workflow rules all work (test D07 restarts from the files and continues the workflow).

## 10. How Tests Are Organised

- Built-in runner: `node:test` and `node:assert/strict`. Run with `npm test`.
- `tests/pass.test.js` (P01–P13), `tests/credit.test.js` (C01–C12), `tests/distinction.test.js` (D01–D13): 38 tests in 8 groups.
- `tests/helpers.js` builds simulated users and requests so each test is short.
- Pass and Credit tests use an in-memory manager (no data store).
- Distinction tests create a new temporary folder with `fs.mkdtemp(os.tmpdir())` before each test and delete it afterwards, so the real `data/` folder is never read or changed.
- File error tests write broken JSON, a non-array, invalid records, and make a file path into a folder to force a write failure.
- Full results are in `docs/05_Test_Report.md` and the raw output in `docs/evidence/automated_test_output.txt`.

## 11. Known Limitations and Future Improvements

| Limitation | Possible improvement |
|---|---|
| No login; any user ID can be typed. | Add password hashing or campus single sign-on and a session for the current user. |
| Whole files are rewritten on every save. | Append-only audit log; move to a database when the project allows it. |
| A failed save after a workflow step leaves the change only in memory. | Snapshot the request before the change and restore it if the save fails. |
| A Technician cannot be changed once assigned; a resolved request cannot be reopened. | Add "Reassign" and "Reopen" transitions with officer permission. |
| One console user at a time. | Web interface with an API built on the same manager and domain classes. |
| No notifications. | Email or SMS when a request changes status. |
| Target times are fixed in code. | Load service-level targets from a settings file. |
