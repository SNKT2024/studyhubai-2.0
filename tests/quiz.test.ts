import { describe, expect, it } from "vitest";

import {
  PUBLIC_QUESTION_SELECT,
  findCorrectOptionIndex,
  gradeAnswer,
  normalizeCorrectAnswer,
  optionLetter,
} from "@/lib/quiz";

describe("optionLetter", () => {
  it("maps an index to its letter", () => {
    expect(optionLetter(0)).toBe("a");
    expect(optionLetter(1)).toBe("b");
    expect(optionLetter(3)).toBe("d");
  });
});

describe("findCorrectOptionIndex", () => {
  const options = ["Alpha", "Beta", "Gamma", "Delta"];

  it("finds an option by its exact text", () => {
    expect(findCorrectOptionIndex(options, "Gamma")).toBe(2);
  });

  it("finds an option by its stored letter", () => {
    expect(findCorrectOptionIndex(options, "c")).toBe(2);
  });

  it("accepts a letter with stray whitespace or casing", () => {
    expect(findCorrectOptionIndex(options, " C ")).toBe(2);
  });

  it("returns -1 when the answer matches nothing", () => {
    // A legacy row whose letter no longer lines up with the options array.
    expect(findCorrectOptionIndex(["One", "Two"], "d")).toBe(-1);
  });
});

describe("normalizeCorrectAnswer", () => {
  const options = { a: "Alpha", b: "Beta", c: "Gamma", d: "Delta" };

  it("resolves an option key to its text", () => {
    expect(normalizeCorrectAnswer(options, "b")).toBe("Beta");
  });

  it("resolves a key regardless of casing", () => {
    expect(normalizeCorrectAnswer(options, "B")).toBe("Beta");
  });

  it("passes through an answer already given as the option text", () => {
    expect(normalizeCorrectAnswer(options, "Delta")).toBe("Delta");
  });

  it("falls back to the raw answer when it is not a usable key", () => {
    expect(normalizeCorrectAnswer(options, "none of these")).toBe(
      "none of these",
    );
  });
});

describe("gradeAnswer", () => {
  const options = ["Alpha", "Beta", "Gamma"];

  it("marks the correct choice correct", () => {
    expect(gradeAnswer(options, "Beta", "Beta")).toEqual({
      isCorrect: true,
      correctOptionIndex: 1,
    });
  });

  it("marks a wrong choice wrong but still reports the answer index", () => {
    expect(gradeAnswer(options, "Beta", "Gamma")).toEqual({
      isCorrect: false,
      correctOptionIndex: 1,
    });
  });

  it("marks a skipped question wrong", () => {
    expect(gradeAnswer(options, "Beta", null).isCorrect).toBe(false);
  });

  it("marks a choice that is not one of the options wrong", () => {
    expect(gradeAnswer(options, "Beta", "Epsilon").isCorrect).toBe(false);
  });

  it("grades a legacy letter answer against the right option", () => {
    expect(gradeAnswer(options, "b", "Beta").isCorrect).toBe(true);
  });

  it("grades nothing correct when the stored answer matches no option", () => {
    // Better that the question reads as unanswerable than that it passes everyone.
    expect(gradeAnswer(options, "d", "Alpha")).toEqual({
      isCorrect: false,
      correctOptionIndex: -1,
    });
  });
});

describe("PUBLIC_QUESTION_SELECT", () => {
  /**
   * The regression guard for the answer leak: this projection is what the generation response and
   * the library listing use, so an answer field added here would go straight to the client before
   * the user has answered anything.
   */
  it("carries no answer or explanation field", () => {
    expect(Object.keys(PUBLIC_QUESTION_SELECT).sort()).toEqual([
      "id",
      "options",
      "order",
      "question",
      "quizId",
    ]);
  });
});
