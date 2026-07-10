// Official KIU grading scale: grade percentage → grade point (GP).
// Grades below PASSING_MIN are failing and carry no grade point.
export const GRADING_SYSTEM = "KIU";

export type GradeBand = { min: number; max: number; gp: number };

export const GRADE_SCALE: GradeBand[] = [
  { min: 94, max: 100, gp: 4.0 },
  { min: 91, max: 93, gp: 3.7 },
  { min: 88, max: 90, gp: 3.4 },
  { min: 85, max: 87, gp: 3.1 },
  { min: 81, max: 84, gp: 2.8 },
  { min: 78, max: 80, gp: 2.5 },
  { min: 74, max: 77, gp: 2.2 },
  { min: 71, max: 73, gp: 1.9 },
  { min: 68, max: 70, gp: 1.6 },
  { min: 64, max: 67, gp: 1.3 },
  { min: 61, max: 63, gp: 1.0 },
  { min: 56, max: 60, gp: 0.8 },
  { min: 51, max: 55, gp: 0.5 },
];

export const MAX_GPA = 4.0;
export const PASSING_MIN = 51;

export const isPassing = (grade: number) =>
  Number.isFinite(grade) && grade >= PASSING_MIN;

export function gradePoint(grade: number): number | null {
  if (!isPassing(grade)) return null;
  for (const band of GRADE_SCALE) {
    if (grade >= band.min) return band.gp;
  }
  return null;
}

export const SUBJECT_CATEGORIES = [
  "mandatory",
  "elective",
  "minor",
  "language",
  "internship",
  "thesis",
  "project",
] as const;

export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

export type Subject = {
  id: string;
  name: string;
  credits: number;
  grade: number | ""; // percentage 0–100; "" while ungraded
  category?: SubjectCategory; // set when the subject comes from a curriculum
};

export type Semester = {
  id: string;
  name: string;
  subjects: Subject[];
};

export type SubjectStatus = "passed" | "failed" | "pending";

export function subjectStatus(subject: Subject): SubjectStatus {
  if (subject.grade === "" || subject.grade == null) return "pending";
  return isPassing(Number(subject.grade)) ? "passed" : "failed";
}

export type GpaStats = {
  gpa: number; // Σ(GP × credits) / Σ(credits), passed subjects only
  weightedPoints: number;
  credits: number; // completed (passed) credits only
  avgPercent: number; // credit-weighted average grade across all graded subjects
  passed: number;
  failed: number;
  graded: number;
  courses: number;
};

export function computeStats(subjects: Subject[]): GpaStats {
  let weightedPoints = 0;
  let credits = 0;
  let percentSum = 0;
  let percentCredits = 0;
  let passed = 0;
  let failed = 0;
  let courses = 0;

  for (const subject of subjects) {
    courses += 1;
    if (subject.grade === "" || subject.grade == null) continue;
    const grade = Number(subject.grade);
    const cr = Number(subject.credits) || 0;

    percentSum += grade * cr;
    percentCredits += cr;

    const gp = gradePoint(grade);
    if (gp === null) {
      // Failed subjects stay on record but never count toward GPA or credits.
      failed += 1;
      continue;
    }
    passed += 1;
    weightedPoints += gp * cr;
    credits += cr;
  }

  return {
    gpa: credits ? weightedPoints / credits : 0,
    weightedPoints,
    credits,
    avgPercent: percentCredits ? percentSum / percentCredits : 0,
    passed,
    failed,
    graded: passed + failed,
    courses,
  };
}

// Per-subject contribution lines for the "How GPA is calculated" breakdown.
export type WeightedLine = {
  id: string;
  name: string;
  credits: number;
  gp: number;
  weighted: number;
};

export function weightedLines(subjects: Subject[]): WeightedLine[] {
  const lines: WeightedLine[] = [];
  for (const subject of subjects) {
    if (subject.grade === "" || subject.grade == null) continue;
    const gp = gradePoint(Number(subject.grade));
    if (gp === null) continue;
    const credits = Number(subject.credits) || 0;
    lines.push({
      id: subject.id,
      name: subject.name,
      credits,
      gp,
      weighted: gp * credits,
    });
  }
  return lines;
}

// Round mathematically to hundredths (3.675 → 3.68); EPSILON compensates for
// binary floats landing a hair below the .xx5 midpoint.
export const roundHundredths = (x: number) =>
  Math.round((x + Number.EPSILON) * 100) / 100;

export const formatGpa = (x: number) => roundHundredths(x).toFixed(2);

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
