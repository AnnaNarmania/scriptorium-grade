import { z } from "zod";
import { SUBJECT_CATEGORIES, type Semester, uid } from "@/lib/gpa";

// Curriculum "database": every JSON file in src/data/curricula is discovered,
// validated and registered automatically — add a faculty by adding a file.

const curriculumSubjectSchema = z.object({
  name: z.string().min(1),
  credits: z.number().positive(),
  category: z.enum(SUBJECT_CATEGORIES),
});

const curriculumSemesterSchema = z.object({
  semester: z.number().int().positive(),
  subjects: z.array(curriculumSubjectSchema),
});

export const curriculumSchema = z.object({
  id: z.string().min(1),
  faculty: z.string().min(1),
  degree: z.string().min(1),
  totalCredits: z.number().positive(),
  gradingSystem: z.string().default("KIU"),
  semesters: z.array(curriculumSemesterSchema),
});

export type Curriculum = z.infer<typeof curriculumSchema>;
export type CurriculumSubject = z.infer<typeof curriculumSubjectSchema>;
export type CurriculumSemester = z.infer<typeof curriculumSemesterSchema>;

const modules = import.meta.glob("../data/curricula/*.json", {
  eager: true,
}) as Record<string, { default: unknown }>;

export const CURRICULA: Curriculum[] = Object.entries(modules)
  .map(([path, mod]) => {
    const parsed = curriculumSchema.safeParse(mod.default);
    if (!parsed.success) {
      throw new Error(`Invalid curriculum file ${path}: ${parsed.error.message}`);
    }
    return parsed.data;
  })
  .sort((a, b) => a.faculty.localeCompare(b.faculty));

export const getCurriculum = (id: string): Curriculum | undefined =>
  CURRICULA.find((c) => c.id === id);

export function numberWord(n: number) {
  const words = [
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
  ];
  return words[n - 1] ?? String(n);
}

// Expand a curriculum template into editable, ungraded app state. Students
// then remove subjects, add their own, change credits or add semesters.
export function curriculumToSemesters(curriculum: Curriculum): Semester[] {
  return curriculum.semesters.map((sem) => ({
    id: uid(),
    name: `Semester ${numberWord(sem.semester)}`,
    subjects: sem.subjects.map((subject) => ({
      id: uid(),
      name: subject.name,
      credits: subject.credits,
      grade: "" as const,
      category: subject.category,
    })),
  }));
}
