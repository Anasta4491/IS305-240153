/*
  Program: Dining Meal Booking Feature
  Student Name: Anasta John
  Student ID: 240153
  Date: 17 July 2026
  Description: A JavaScript program demonstrating classes,
  objects, constructors, private fields and methods.
*/

const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");
const { MealBooking } = require("./MealBooking");

// All bookings are kept in memory only (no database)
const bookings = [];

// Simple search algorithm: is there already a booking with the
// same student ID, meal date and meal type?
function isDuplicate(newBooking) {
  for (const b of bookings) {
    if (
      b.studentId.toLowerCase() === newBooking.studentId.toLowerCase() &&
      b.mealDate === newBooking.mealDate &&
      b.mealType === newBooking.mealType &&
      b.bookingStatus !== "Cancelled"
    ) {
      return true;
    }
  }
  return false;
}

// Creates, validates, checks for duplicates and stores a booking
function addBooking(data) {
  const booking = new MealBooking(data);
  booking.validate();
  if (isDuplicate(booking)) {
    throw new Error(
      `Duplicate booking: ${booking.studentId} already has a ${booking.mealType} booking on ${booking.mealDate}.`
    );
  }
  bookings.push(booking);
  return booking;
}

// ---------- Required test demonstrations ----------
function runTests() {
  console.log("\n########## RUNNING TESTS ##########");

  // Test 1: valid booking
  console.log("\nTest 1: Valid booking");
  try {
    const b = addBooking({
      studentId: "DWU2026001",
      studentName: "Mary Kila",
      mealDate: "2026-07-20",
      mealType: "Lunch",
      quantity: 2,
      dietaryNote: "Vegetarian",
    });
    b.confirmBooking();
    console.log(b.getSummary());
    console.log(`RESULT: PASS (expected K30.00, got K${b.calculateTotal().toFixed(2)})`);
  } catch (err) {
    console.log("RESULT: FAIL - " + err.message);
  }

  // Test 2: invalid booking
  console.log("\nTest 2: Invalid booking (no name, bad meal type, quantity 0)");
  try {
    addBooking({
      studentId: "DWU2026002",
      studentName: "",
      mealDate: "2026-07-20",
      mealType: "Supper",
      quantity: 0,
      dietaryNote: "",
    });
    console.log("RESULT: FAIL - invalid booking was accepted");
  } catch (err) {
    console.log("Error: " + err.message);
    console.log("RESULT: PASS (invalid booking rejected)");
  }

  // Test 3: duplicate booking (same ID, date and meal type as Test 1)
  console.log("\nTest 3: Duplicate booking");
  try {
    addBooking({
      studentId: "DWU2026001",
      studentName: "Mary Kila",
      mealDate: "2026-07-20",
      mealType: "Lunch",
      quantity: 1,
      dietaryNote: "None",
    });
    console.log("RESULT: FAIL - duplicate booking was accepted");
  } catch (err) {
    console.log("Error: " + err.message);
    console.log("RESULT: PASS (duplicate booking rejected)");
  }

  console.log("\n########## TESTS FINISHED ##########");
}

// ---------- Interactive console input ----------
async function enterBooking(rl) {
  console.log("\n--- New Meal Booking ---");
  const studentId = await rl.question("Student ID: ");
  const studentName = await rl.question("Student name: ");
  const mealDate = await rl.question("Meal date (YYYY-MM-DD): ");
  const mealType = await rl.question("Meal type (Breakfast/Lunch/Dinner): ");
  const quantity = await rl.question("Quantity: ");
  const dietaryNote = await rl.question("Dietary note (press Enter for none): ");

  try {
    const booking = addBooking({ studentId, studentName, mealDate, mealType, quantity, dietaryNote });
    console.log("\nBooking created.");
    console.log(booking.getSummary());

    const answer = await rl.question("Confirm (C), cancel (X) or leave Pending (Enter)? ");
    if (answer.trim().toUpperCase() === "C") booking.confirmBooking();
    else if (answer.trim().toUpperCase() === "X") booking.cancelBooking();
    console.log(`Booking status is now: ${booking.bookingStatus}`);
  } catch (err) {
    console.log("\nError: " + err.message);
  }
}

function listBookings() {
  if (bookings.length === 0) {
    console.log("\nNo bookings yet.");
    return;
  }
  bookings.forEach((b, i) => {
    console.log(`\nBooking ${i + 1}`);
    console.log(b.getSummary());
  });
}

async function main() {
  const rl = readline.createInterface({ input, output });
  console.log("Welcome to DWU Dining Meal Booking");
  console.log("Prices: Breakfast K10.00 | Lunch K15.00 | Dinner K20.00");

  try {
    let running = true;
    while (running) {
      console.log("\n1. Make a booking\n2. View all bookings\n3. Run test demonstrations\n4. Exit");
      const choice = (await rl.question("Choose an option: ")).trim();
      switch (choice) {
        case "1": await enterBooking(rl); break;
        case "2": listBookings(); break;
        case "3": runTests(); break;
        case "4": running = false; break;
        default: console.log("Please choose 1, 2, 3 or 4.");
      }
    }
  } catch (err) {
    console.log("Unexpected error: " + err.message);
  } finally {
    rl.close();
    console.log("Goodbye!");
  }
}

main();
