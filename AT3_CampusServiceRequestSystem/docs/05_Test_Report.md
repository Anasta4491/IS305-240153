# Test Report
## Campus Service Request Management System

**Student:** [Student Name] – [Student ID]  
**Test date:** 25 October 2026  
**Environment:** Node.js v22, Linux. Automated tests use the built-in `node:test` runner.

## Summary

| Test set | Tests | Passed | Failed |
|---|---|---|---|
| Automated – Pass (P01–P13) | 13 | 13 | 0 |
| Automated – Credit (C01–C12) | 12 | 12 | 0 |
| Automated – Distinction (D01–D13) | 13 | 13 | 0 |
| Manual console tests (M01–M16) | 16 | 16 | 0 |
| **Total** | **54** | **54** | **0** |

Evidence:

- `docs/evidence/automated_test_output.txt` – full output of `node --test --test-reporter=spec` (38 passed, 0 failed).
- `docs/evidence/console_session_input.txt` and `console_session_transcript.txt` – the exact input and output of the manual console session.
- `docs/screenshots/` – screenshots taken from that session.

To repeat: `npm test` for automated tests. For the console session: copy `data/` to a practice folder, then `CAMPUS_DATA_DIR=<folder> node src/CampusServiceApp.js < docs/evidence/console_session_input.txt`.

---

## 1. Automated Tests – Pass Component

| ID | Feature tested | Test input | Expected result | Actual result | Result |
|---|---|---|---|---|---|
| P01 | Valid user registration | `User` DWU2026001, Grace Kila, mixed-case email, Student | User added; found by lower-case ID; email stored in lower case; `displayInfo()` shows type | User added and found; email `grace.kila@student.campus.example` | Pass |
| P02 | Duplicate user ID | Register DWU2026001 twice (different emails) | Second registration rejected with `DuplicateError`; one user stored | `DuplicateError` thrown; 1 user | Pass |
| P03 | Missing ID / names, invalid email | `userId: ''`, `firstName: '  '`, `lastName: undefined`, `email: 'not-an-email'` | Each rejected with a clear `ValidationError` | All four rejected with matching messages | Pass |
| P04 | Encapsulation – setters | Set first name; set email `broken@`; assign `userId` | Valid name accepted; bad email rejected and old value kept; `userId` cannot be changed | As expected (`TypeError` on `userId`) | Pass |
| P05 | Valid request submission | ICT request with generated ID | Stored as REQ001 with status Submitted and a date | REQ001, Submitted | Pass |
| P06 | Invalid request category | Category `Plumbing`; factory with `Catering` | Rejected: "not a supported category" | Both rejected with that message | Pass |
| P07 | Missing title/description, bad priority | `title: ''`, `description: ''`, `priority: 'Critical'` | Each rejected clearly | Three clear errors | Pass |
| P08 | Duplicate request ID | Two requests with REQ001 | Second rejected with `DuplicateError` | Rejected | Pass |
| P09 | View requester records | 3 requests from two students | Only DWU2026001's REQ001 and REQ003 returned | `[REQ001, REQ003]` | Pass |
| P10 | Update own request / other user | Owner changes title and network impact; DWU2026002 tries; owner sends priority `Extreme` | Owner change applied; other user `PermissionError`; bad priority rejected with nothing changed | As expected | Pass |
| P11 | Cancel Submitted request | Owner cancels REQ001 | Status Cancelled | Cancelled | Pass |
| P12 | Cancel rules | Other user cancels; owner cancels twice; update after cancel | `PermissionError`; "already Cancelled"; `WorkflowError` | As expected | Pass |
| P13 | Search and summary | Search `wi-fi`, `req002`, blank; summary | REQ001; REQ002; blank rejected; Submitted 1, Cancelled 1, Total 2 | As expected | Pass |

## 2. Automated Tests – Credit Extension

| ID | Feature tested | Test input | Expected result | Actual result | Result |
|---|---|---|---|---|---|
| C01 | User constructor chaining | Create student, officer, technician; student with empty ID | `instanceof User`; type set through `super()`; inherited `getFullName()`; base validation runs | As expected | Pass |
| C02 | Request constructor chaining | `ICTSupportRequest` without category | `instanceof ServiceRequest`; category "ICT Support"; status Submitted | As expected | Pass |
| C03 | Specialised field validation | Year 9; impact `Galaxy-wide`; empty room; risk `Extreme`; empty service area; wrong category; `account access` | All invalid values rejected; option normalised to `Account Access` | As expected | Pass |
| C04 | Full workflow | Submit → review → assign → start → note → resolve → close | Ends Closed with resolved/closed dates and notes | Closed | Pass |
| C05 | Officer-only actions | Student/Technician review; Admin sets priority; Technician assigns; officer assigns a student | All `PermissionError` / "not a Technician"; officer assignment works | As expected | Pass |
| C06 | Assigned Technician only | TECH002 and OFF001 try to start; TECH002 notes/resolves; empty note | All refused; TECH001 resolves successfully | As expected | Pass |
| C07 | Invalid transitions | Assign before review; close Submitted; `changeStatus('Resolved')`; cancel/update Reviewed; status `Finished` | All rejected; status stays Reviewed | As expected | Pass |
| C08 | Final statuses | Review a Cancelled request | Rejected: "none (final status)" | As expected | Pass |
| C09 | Specialised summaries | `getRequestSummary()` on ICT, Maintenance, Cleaning | Each shows its own heading and fields; common lines present | As expected | Pass |
| C10 | Search, filter and sort | 4 requests with different categories, priorities, dates, one assigned | Correct results for search, each filter, combined filter, date sort, priority sort (ties oldest first); original order unchanged | As expected | Pass |
| C11 | Request history | Review, assign, set priority, start, refused second start | 4 entries in order with previous/new status, actor, role, comment, timestamp; refused action not recorded; copy returned | As expected | Pass |
| C12 | Staff cannot submit | Technician submits a request | Rejected | "Technician accounts cannot submit" | Pass |

## 3. Automated Tests – Distinction Extension

| ID | Feature tested | Test input | Expected result | Actual result | Result |
|---|---|---|---|---|---|
| D01 | Abstract-style base class | `new ServiceRequest()`; subclass without overrides | Constructor refused; each abstract method throws "must implement" | As expected | Pass |
| D02 | Polymorphism | One array of ICT, Maintenance, Cleaning (all High) | Scores 50 / 55 / 30, targets 4 / 4 / 6, own headings | As expected | Pass |
| D03 | Missing data files | Load from empty temp folder | Four files created containing `[]`; no warnings | As expected | Pass |
| D04 | Empty data file | `users.json` contains only spaces | Loads as `[]` | `[]` | Pass |
| D05 | Saving after actions | Register 7 users, submit, review | Users (with subclass fields), request (type, requesterId, status, dates as strings), history and audit saved | As expected | Pass |
| D06 | Invalid records not saved | Duplicate user, unknown request, invalid request | Files unchanged; no request file written | As expected | Pass |
| D07 | Restore objects | Save 3 typed requests, reload in a new manager | Correct classes, status, technician, history, scores; requester relinked; next ID REQ004; workflow still enforced | As expected | Pass |
| D08 | Factory | Round-trip all four types; unknown type | Same class and same data; unknown type rejected | As expected | Pass |
| D09 | Damaged files | Broken JSON; object instead of array; one bad user and one orphan request | Clear `DataFileError`s; bad records skipped with 2 warnings, good ones load | As expected | Pass |
| D10 | Write error | `users.json` path is a folder | `DataFileError` "Could not write users.json"; registration and audit rolled back | As expected | Pass |
| D11 | Repository methods | `create`, duplicate, `findById`, `findByRequester`, `findByTechnician`, `update` | All return correct data; ID cannot be changed by `update` | As expected | Pass |
| D12 | Audit trail | Create, update, review, priority, assign, refused start, start, resolve, close | 9 entries with correct actions and outcomes (one Rejected); all fields present; unique IDs | As expected | Pass |
| D13 | Report calculations | 4 requests (resolved, urgent, new, cancelled), fixed "now" | Correct status/category/priority counts, urgent list, overdue (REQ002 117 h over), technician workload, average time, location volume | As expected | Pass |

## 4. Manual Console Tests

Run against a copy of the demonstration data using `docs/evidence/console_session_input.txt`.

| ID | Feature tested | Test input | Expected result | Actual result | Result | Evidence |
|---|---|---|---|---|---|---|
| M01 | Start-up and menu | `node src/CampusServiceApp.js` | Loads 8 users and 9 requests; menu shown | As expected | Pass | Screenshot 01 |
| M02 | Register student | Option 1, Student DWU2026010 Anna Tau | `[OK] User DWU2026010 registered successfully.` | As expected | Pass | Screenshot 02 |
| M03 | Submit maintenance request | Option 2, DWU2026010, Facilities Maintenance, window latch | `[OK] Request REQ010 submitted with status Submitted.` + summary (score 25, target 48 h) | As expected | Pass | Screenshot 03 |
| M04 | Officer review | Option 10, OFF001, review REQ010 | `[OK] REQ010 is now Reviewed.` | As expected | Pass | Screenshot 04 |
| M05 | Assign Technician | Officer option 4, TECH002 | `[OK] REQ010 assigned to TECH002. Status: Assigned.` | As expected | Pass | Screenshot 04 |
| M06 | Technician start / note / resolve | Option 11, TECH002, options 2, 3, 4 | In Progress, note saved, Resolved | As expected | Pass | Screenshot 05 |
| M07 | Officer closes | Option 10, OFF001, option 6 | `[OK] REQ010 is now Closed.` | As expected | Pass | Screenshot 06 |
| M08 | Request history | Option 13, REQ010 | 6 rows from Reviewed to Closed with actors and comments | As expected | Pass | Screenshot 06 |
| M09 | Cancel another user's request | Option 7 as DWU2026002 on REQ010 | `[ERROR] You can only cancel your own requests.` | As expected | Pass | Screenshot 07 |
| M10 | Invalid email | Register staff with `ben.kora@` | `[ERROR] "ben.kora@" is not a valid email address.` | As expected | Pass | Screenshot 07 |
| M11 | Duplicate user ID | Register DWU2026001 again | `[ERROR] User ID DWU2026001 is already registered.` | As expected | Pass | Screenshot 07 |
| M12 | Role check | Option 10 with student DWU2026010 | `[ERROR] Only Service Officers can use this workspace.` | As expected | Pass | Screenshot 07 |
| M13 | Search and summary | Option 8 `latch`; option 9 | REQ003 and REQ010 found; counts per status | As expected | Pass | Screenshot 08 |
| M14 | Reports | Option 14, ADM001, reports 9 and 6 | Location volume and Technician workload tables | As expected | Pass | Screenshot 09 |
| M15 | Data kept after restart | Exit, start again with the same folder | REQ010 still Closed, DWU2026010 still registered (10 requests, 9 users loaded) | As expected | Pass | Transcript |
| M16 | Damaged data file at start-up | `users.json` containing `[{"userId": broken` | `[ERROR] The data files could not be loaded. users.json does not contain valid JSON ...`; program stops; file not overwritten | As expected | Pass | Section 5 |

## 5. Additional Evidence – Start-up File Error (M16)

```
$ CAMPUS_DATA_DIR=bad-data node src/CampusServiceApp.js
[ERROR] The data files could not be loaded. users.json does not contain valid JSON (Unexpected token 'b', "[{"userId": broken
" is not valid JSON).
Fix or remove the damaged file in the data folder and start the program again.
```

## 6. Defects Found and Fixed During Testing

| # | Problem found | Fix |
|---|---|---|
| 1 | `npm test` with `node --test tests/` failed on Node 22 because a folder is not accepted as a test path. | Changed the script to the glob `"tests/**/*.test.js"`. |
| 2 | Expected score in the first version of D02 was wrong (Network fault adds 5 points to ICT requests). | Test changed to use a Hardware fault so the expected value matches the documented rule. |
| 3 | First version of D06 expected an empty `serviceRequests.json`, but the file is only created when it is loaded or written. | Test now checks that no request file was written at all, which is the stronger check. |
| 4 | Report tables had trailing spaces at the end of each line. | `formatTable()` now trims each line. |
