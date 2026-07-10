export type Grade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "F";

export const GRADE_OPTIONS: Grade[] = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "F",
];

// 4.0 scale
export const GRADE_POINTS: Record<Grade, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  F: 0.0,
};

// Rough percentage midpoints for "average grade" display
export const GRADE_PERCENT: Record<Grade, number> = {
  "A+": 98,
  A: 94,
  "A-": 91,
  "B+": 88,
  B: 85,
  "B-": 81,
  "C+": 78,
  C: 75,
  "C-": 71,
  "D+": 68,
  D: 65,
  F: 55,
};

export type Subject = {
  id: string;
  name: string;
  credits: number;
  grade: Grade | "";
};

export type Semester = {
  id: string;
  name: string;
  subjects: Subject[];
};

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
