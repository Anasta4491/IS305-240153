/*
  Program: Dining Meal Booking Feature
  Student Name: Anasta John
  Student ID: 240153
  Date: 17 July 2026
  Description: A JavaScript program demonstrating classes,
  objects, constructors, private fields and methods.
*/

// Prices per meal in kina
const MEAL_PRICES = {
  Breakfast: 10.0,
  Lunch: 15.0,
  Dinner: 20.0,
};

class MealBooking {
  // ----- Private fields (encapsulation) -----
  #studentId;
  #studentName;
  #mealDate;
  #mealType;
  #quantity;
  #dietaryNote;
  #bookingStatus;

  // ----- Constructor -----
  constructor({ studentId, studentName, mealDate, mealType, quantity, dietaryNote = "None" }) {
    this.#studentId = String(studentId ?? "").trim();
    this.#studentName = String(studentName ?? "").trim();
    this.#mealDate = String(mealDate ?? "").trim();
    this.#mealType = MealBooking.normaliseMealType(mealType);
    this.#quantity = Number(quantity);
    this.#dietaryNote = String(dietaryNote ?? "").trim() || "None";
    this.#bookingStatus = "Pending"; // default status
  }

  // Turns "lunch", " LUNCH " etc. into "Lunch"
  static normaliseMealType(type) {
    const text = String(type ?? "").trim().toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // ----- Getters -----
  get studentId() { return this.#studentId; }
  get studentName() { return this.#studentName; }
  get mealDate() { return this.#mealDate; }
  get mealType() { return this.#mealType; }
  get quantity() { return this.#quantity; }
  get dietaryNote() { return this.#dietaryNote; }
  get bookingStatus() { return this.#bookingStatus; }

  // ----- Setters (each one validates before changing the field) -----
  set studentId(value) {
    if (!String(value ?? "").trim()) throw new Error("Student ID is required.");
    this.#studentId = String(value).trim();
  }

  set studentName(value) {
    if (!String(value ?? "").trim()) throw new Error("Student name is required.");
    this.#studentName = String(value).trim();
  }

  set mealDate(value) {
    if (!String(value ?? "").trim()) throw new Error("Meal date is required.");
    this.#mealDate = String(value).trim();
  }

  set mealType(value) {
    const type = MealBooking.normaliseMealType(value);
    if (!(type in MEAL_PRICES)) throw new Error("Meal type must be Breakfast, Lunch or Dinner.");
    this.#mealType = type;
  }

  set quantity(value) {
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty < 1) throw new Error("Quantity must be a whole number of 1 or more.");
    this.#quantity = qty;
  }

  set dietaryNote(value) {
    this.#dietaryNote = String(value ?? "").trim() || "None";
  }

  // No public setter for bookingStatus: it may only change
  // through confirmBooking() and cancelBooking().

  // ----- Methods -----

  // Rejects missing or invalid booking information
  validate() {
    const errors = [];
    if (!this.#studentId) errors.push("Student ID is required.");
    if (!this.#studentName) errors.push("Student name is required.");
    if (!this.#mealDate) errors.push("Meal date is required.");
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(this.#mealDate) || isNaN(Date.parse(this.#mealDate))) {
      errors.push("Meal date must be a valid date in the format YYYY-MM-DD.");
    }
    if (!(this.#mealType in MEAL_PRICES)) errors.push("Meal type must be Breakfast, Lunch or Dinner.");
    if (!Number.isInteger(this.#quantity) || this.#quantity < 1) {
      errors.push("Quantity must be a whole number of 1 or more.");
    }

    if (errors.length > 0) {
      throw new Error("Invalid booking:\n  - " + errors.join("\n  - "));
    }
    return true;
  }

  // Total cost = meal price × quantity
  calculateTotal() {
    const price = MEAL_PRICES[this.#mealType];
    if (price === undefined) throw new Error("Cannot calculate total: unknown meal type.");
    return price * this.#quantity;
  }

  confirmBooking() {
    if (this.#bookingStatus !== "Pending") {
      throw new Error(`Only a Pending booking can be confirmed (current status: ${this.#bookingStatus}).`);
    }
    this.#bookingStatus = "Confirmed";
  }

  cancelBooking() {
    if (this.#bookingStatus === "Cancelled") {
      throw new Error("This booking is already cancelled.");
    }
    this.#bookingStatus = "Cancelled";
  }

  // Returns a clear booking receipt
  getSummary() {
    return [
      "========== DWU DINING BOOKING RECEIPT ==========",
      `Student      : ${this.#studentName} (${this.#studentId})`,
      `Meal Date    : ${this.#mealDate}`,
      `Meal Type    : ${this.#mealType}`,
      `Quantity     : ${this.#quantity}`,
      `Dietary Note : ${this.#dietaryNote}`,
      `Status       : ${this.#bookingStatus}`,
      `Total Cost   : K${this.calculateTotal().toFixed(2)}`,
      "================================================",
    ].join("\n");
  }
}

module.exports = { MealBooking, MEAL_PRICES };
