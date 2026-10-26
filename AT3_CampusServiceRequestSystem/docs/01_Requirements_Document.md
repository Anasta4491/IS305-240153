# Requirements Document
## Campus Service Request Management System

**Course:** IS305 – Object-Oriented Programming  
**Assessment:** AT3 Major Project  
**Student:** [Student Name] – [Student ID]  
**Version:** 1.0 (final submission)

---

## 1. Project Background

Students and staff report campus problems such as Wi-Fi faults, broken projectors, leaking roofs, blocked toilets and broken street lights. At present these problems are reported by telephone, in passing conversations or on handwritten notes. Nobody has a single list of open problems, so it is hard to know who is responsible, how long a problem has been waiting, or whether it was ever fixed.

## 2. Problem Statement

Because requests are not recorded in one place:

- requests are lost or forgotten;
- the same problem is reported several times by different people;
- there is no clear owner for each job;
- the requester cannot see the progress of their request;
- managers cannot measure workload, delays or completion times;
- there is no record of who changed what, and when.

## 3. Project Objectives

1. Record every campus service request with a unique ID, a requester, a category, a priority and a status.
2. Control the life of a request through a fixed workflow: Submitted → Reviewed → Assigned → In Progress → Resolved → Closed (or Cancelled).
3. Make sure each role can only perform its own actions (requester, Service Officer, Technician, Administrator).
4. Keep a full history of each request and an audit trail of all system actions.
5. Keep all data after the program closes, using JSON files (no database).
6. Give management reports on workload, priorities, overdue work and resolution times.
7. Demonstrate the OOP concepts taught in IS305: classes, encapsulation, inheritance, constructor chaining, overriding, polymorphism, abstraction and composition.

## 4. Project Scope

**In scope**

- A Node.js console application (single user at a time, menu driven).
- Four request categories: ICT Support, Facilities Maintenance, Cleaning and Sanitation, General Campus Service.
- Five user types: Student, Staff, Service Officer, Technician, Administrator.
- Registration, submission, viewing, updating, cancelling, searching, filtering and sorting of requests.
- The full staff workflow (review, priority, assignment, work, resolution, closure).
- JSON file storage with the `fs/promises` module, request history, audit log and management reports.
- Automated tests with the built-in Node.js test runner.

**Out of scope**

- Passwords, login sessions and real authentication (users identify themselves by user ID only).
- Web or mobile interfaces, email or SMS notifications.
- Databases of any kind (MongoDB, MySQL, SQLite and so on).
- Real institutional data. All records are simulated.

## 5. Actors and User Roles

| Actor | Class | Responsibilities |
|---|---|---|
| Student Requester | `StudentRequester` | Submit requests, view progress, update or cancel their own Submitted requests. |
| Staff Requester | `StaffRequester` | Same as a student requester. |
| Service Officer | `ServiceOfficer` | Review requests, set priority, assign Technicians, verify and close resolved requests, view reports. |
| Technician | `Technician` | View assigned requests, start work, add progress notes, resolve requests. |
| System Administrator | `SystemAdministrator` | Review system records, request history, audit log and management reports. |

## 6. Functional Requirements

### 6.1 Pass – core system

| ID | Requirement |
|---|---|
| FR01 | The system shall register a user with user ID, first name, last name, email address and user type. |
| FR02 | The system shall reject a missing user ID, missing first or last name, an invalid email address and a duplicate user ID. |
| FR03 | The system shall let a registered Student or Staff member submit a request with title, description, campus location, category and priority. |
| FR04 | The system shall give each new request a unique ID (REQ001, REQ002 …) and the status **Submitted**. |
| FR05 | The system shall reject duplicate request IDs, missing titles or descriptions, unsupported categories and unsupported priorities. |
| FR06 | The system shall display one request by its ID, all requests of a selected user, and all requests. |
| FR07 | A requester shall be able to update the details of their own request while it is Submitted. Updates by another user shall be rejected. |
| FR08 | A requester shall be able to cancel their own Submitted request. Cancelling another user's request, or a request that is already Cancelled, shall be rejected. |
| FR09 | The system shall search requests by text in the request ID, title, description or location. |
| FR10 | The system shall show a count of requests for each status. |

### 6.2 Credit – inheritance and workflow

| ID | Requirement |
|---|---|
| FR11 | Users shall be created as `StudentRequester`, `StaffRequester`, `ServiceOfficer`, `Technician` or `SystemAdministrator`, each with its own specialised fields. |
| FR12 | Requests shall be created as `ICTSupportRequest`, `MaintenanceRequest`, `CleaningRequest` or `GeneralServiceRequest`, each with specialised fields that are validated. |
| FR13 | Only a Service Officer shall review a request, set its priority, assign a Technician and close a Resolved request. |
| FR14 | Only the assigned Technician shall start work, add progress notes and resolve the request. |
| FR15 | Status changes shall follow Submitted → Reviewed → Assigned → In Progress → Resolved → Closed. Cancelled and Closed are final. Any other change shall be rejected. |
| FR16 | The system shall filter requests by category, status, priority and assigned Technician, and sort by date submitted or priority. |
| FR17 | Every request shall keep a history of previous status, new status, action, actor ID and role, comment and date/time. |

### 6.3 Distinction – persistence, audit and reports

| ID | Requirement |
|---|---|
| FR18 | The system shall load `users.json`, `serviceRequests.json`, `requestHistory.json` and `auditLog.json` at start-up, creating any missing file as an empty array. |
| FR19 | The system shall save users, requests, history and audit records after every successful change, and never save invalid records. |
| FR20 | The system shall restore each saved request as the correct specialised class using `ServiceRequestFactory.createFromData()`. |
| FR21 | The system shall record an audit entry (audit ID, actor, action, request ID, description, date/time, outcome) for registration, creation, update, priority change, assignment, status changes, cancellation, resolution and closure, including refused attempts. |
| FR22 | The system shall produce reports: requests by status, category and priority; urgent requests; overdue requests; requests per Technician; completed requests per Technician; average resolution time; and request volume by location. |
| FR23 | The system shall show clear messages when a data file cannot be read or written. |

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR01 | Usability | Menus are numbered, option lists can be answered by number or by name, and every action ends with a clear `[OK]` or `[ERROR]` message. |
| NFR02 | Reliability | Invalid input never crashes the program. A data file is written to a temporary file first and then renamed, so a failed write cannot leave a half-written file. |
| NFR03 | Maintainability | Each class has one responsibility. Domain classes, the manager, the repositories and the console interface are kept in separate files and folders. |
| NFR04 | Data integrity | All object data is held in private (`#`) fields and changed only through validated methods. |
| NFR05 | Portability | Runs on Windows, macOS or Linux with Node.js 20 or later. No external npm packages are needed. |
| NFR06 | Performance | All operations on the expected data size (hundreds of requests) respond instantly. |
| NFR07 | Testability | At least 10 automated tests (38 delivered) that use temporary folders and never touch the real data files. |
| NFR08 | Security and privacy | No passwords, tokens or real personal data are stored. JSON files hold data only, never code. |

## 8. Assumptions and Limitations

**Assumptions**

- One person uses the console at a time.
- A user is identified by typing their user ID; the campus would add proper login later.
- Service Officers and Technicians are registered through the same menu as other users.
- Target resolution times (for example 4 hours for a high electrical hazard) are reasonable examples and can be changed in the request classes.

**Limitations**

- No authentication: anyone at the console can type any user ID.
- JSON files are rewritten in full on each save, which is fine for hundreds of records but would be slow for very large data sets.
- If a file write fails after a workflow action, the change stays in memory for the session but is not saved; the user is told about the failure.
- Requests cannot be reassigned to a different Technician once assigned.

## 9. User Stories

| ID | User story | Acceptance criteria |
|---|---|---|
| US01 | As a **student**, I want to register with my student ID and email so that I can report campus problems. | A valid registration is saved; a duplicate ID or bad email gives a clear error. |
| US02 | As a **student**, I want to submit an ICT request describing my Wi-Fi problem so that the ICT team knows about it. | The request gets a new ID, status Submitted and appears in "View My Requests". |
| US03 | As a **staff member**, I want to see all my requests and their status so that I know what is happening. | Only my requests are listed, each with its current status. |
| US04 | As a **requester**, I want to correct the details of my request before it is reviewed so that the officer has accurate information. | Changes are accepted only while Submitted and only for my own request. |
| US05 | As a **requester**, I want to cancel a request I no longer need so that staff do not waste time on it. | Status becomes Cancelled; it cannot be cancelled twice or by someone else. |
| US06 | As a **Service Officer**, I want to see Submitted requests with the most urgent first so that I review the most important ones first. | The list is filtered to Submitted and sorted by priority. |
| US07 | As a **Service Officer**, I want to set the priority and assign a suitable Technician so that every job has an owner. | Only officers can do this; the request becomes Assigned and the change is in the history. |
| US08 | As a **Technician**, I want to see my assigned jobs and record progress notes so that others can see what I have done. | Only the assigned Technician can start, add notes and resolve. |
| US09 | As a **Technician**, I want to mark a job as resolved with notes so that the officer can check it. | Status becomes Resolved with the resolution notes and date. |
| US10 | As a **Service Officer**, I want to verify and close resolved requests so that finished work is confirmed. | Only Resolved requests can be closed, only by an officer. |
| US11 | As a **System Administrator**, I want to view the audit log, including refused actions, so that I can check how the system is being used. | Each entry shows who, what, which request, when and the outcome. |
| US12 | As a **System Administrator**, I want reports on overdue requests, Technician workload and average resolution time so that I can plan resources. | Reports are calculated from the current data with array methods. |
| US13 | As any **user**, I want my data to still be there after the program is closed so that nothing is lost. | Restarting the program reloads every user and request as the correct object type. |
