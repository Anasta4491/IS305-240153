# AT1 – Dining Meal Booking Feature

**Student Name:** Anasta John
**Student ID:** 240153
**Unit:** IS305
**GitHub Repository:** https://github.com/Anasta4491/IS305-240153

## Description
A console-based Node.js program that lets a DWU student book a meal (Breakfast, Lunch or Dinner).
It collects the booking details, validates them, calculates the cost, prevents duplicate bookings
and prints a booking receipt. All data is stored temporarily in a JavaScript array (no database),
so it is lost when the program closes.

| Meal Type | Price |
|-----------|-------|
| Breakfast | K10.00 |
| Lunch     | K15.00 |
| Dinner    | K20.00 |

## Files
| File | Purpose |
|------|---------|
| `MealBooking.js` | Defines the `MealBooking` class with private fields, a constructor, getters, setters and the methods `validate()`, `calculateTotal()`, `confirmBooking()`, `cancelBooking()` and `getSummary()`. |
| `DiningApp.js` | Main program. Reads input with `readline/promises`, creates `MealBooking` objects, stores them in an array, checks for duplicates, handles errors and runs the test demonstrations. |
| `README.md` | This file. |

## How to Run
1. Install Node.js (version 17 or later).
2. Open a terminal in the `AT1_DiningFeature` folder.
3. Run:

```
node DiningApp.js
```

4. Choose from the menu: `1` make a booking, `2` view bookings, `3` run tests, `4` exit.

## Tests Completed
| Test | Input | Expected Result | Actual Result |
|------|-------|-----------------|---------------|
| Valid booking | DWU2026001, Mary Kila, 2026-07-20, Lunch, 2 | Booking created, total K30.00 | Pass |
| Invalid booking | Empty name, meal type "Supper", quantity 0 | Rejected with error messages | Pass |
| Duplicate booking | Same ID, date and meal type as the valid booking | Second booking rejected | Pass |

Error handling: invalid input shows a clear error message and the program keeps running instead of crashing.
