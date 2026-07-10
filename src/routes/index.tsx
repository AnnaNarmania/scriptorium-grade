import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  GRADE_OPTIONS,
  GRADE_PERCENT,
  GRADE_POINTS,
  type Grade,
  type Semester,
  type Subject,
  uid,
} from "@/lib/gpa";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "University GPA Calculator" },
      {
        name: "description",
        content:
          "An editorial, precision-minded GPA calculator. Add semesters, subjects, credits and grades — everything updates instantly.",
      },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "gpa.editorial.v1";
const THEME_KEY = "gpa.editorial.theme";

const CURRICULA = [
  "Computer Science, B.Sc.",
  "Mathematics, B.Sc.",
  "Economics, B.A.",
  "Design, B.F.A.",
] as const;

const defaultData = (): Semester[] => [
  {
    id: uid(),
    name: "Semester One",
    subjects: [
      { id: uid(), name: "Programming I", credits: 6, grade: "A" },
      { id: uid(), name: "Calculus I", credits: 6, grade: "B+" },
      { id: uid(), name: "Physics I", credits: 6, grade: "A-" },
    ],
  },
  {
    id: uid(),
    name: "Semester Two",
    subjects: [
      { id: uid(), name: "Programming II", credits: 6, grade: "A" },
      { id: uid(), name: "Linear Algebra", credits: 6, grade: "B" },
      { id: uid(), name: "Discrete Mathematics", credits: 4, grade: "A-" },
    ],
  },
];

const ordinal = (n: number) => n.toString().padStart(2, "0");

function useHydratedState<T>(key: string, initial: () => T) {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw) as T);
    } catch {}
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state, hydrated]);

  return [state, setState, hydrated] as const;
}

function Index() {
  const [semesters, setSemesters] = useHydratedState<Semester[]>(
    STORAGE_KEY,
    defaultData,
  );
  const [curriculum, setCurriculum] = useState<string>(CURRICULA[0]);
  const [dark, setDark] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // dark mode
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "dark") setDark(true);
    } catch {}
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  // "auto saved" pulse
  useEffect(() => {
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 900);
    return () => clearTimeout(t);
  }, [semesters]);

  const stats = useMemo(() => {
    let totalPoints = 0;
    let totalCredits = 0;
    let percentSum = 0;
    let percentCredits = 0;
    let passed = 0;
    let courses = 0;
    for (const s of semesters) {
      for (const c of s.subjects) {
        courses += 1;
        if (!c.grade) continue;
        const g = c.grade as Grade;
        const cr = Number(c.credits) || 0;
        totalPoints += GRADE_POINTS[g] * cr;
        totalCredits += cr;
        percentSum += GRADE_PERCENT[g] * cr;
        percentCredits += cr;
        if (g !== "F") passed += 1;
      }
    }
    return {
      gpa: totalCredits ? totalPoints / totalCredits : 0,
      credits: totalCredits,
      avg: percentCredits ? percentSum / percentCredits : 0,
      passed,
      courses,
    };
  }, [semesters]);

  const updateSubject = (
    semesterId: string,
    subjectId: string,
    patch: Partial<Subject>,
  ) =>
    setSemesters((prev) =>
      prev.map((s) =>
        s.id !== semesterId
          ? s
          : {
              ...s,
              subjects: s.subjects.map((c) =>
                c.id === subjectId ? { ...c, ...patch } : c,
              ),
            },
      ),
    );

  const removeSubject = (semesterId: string, subjectId: string) =>
    setSemesters((prev) =>
      prev.map((s) =>
        s.id !== semesterId
          ? s
          : { ...s, subjects: s.subjects.filter((c) => c.id !== subjectId) },
      ),
    );

  const addSubject = (semesterId: string) =>
    setSemesters((prev) =>
      prev.map((s) =>
        s.id !== semesterId
          ? s
          : {
              ...s,
              subjects: [
                ...s.subjects,
                { id: uid(), name: "", credits: 3, grade: "" },
              ],
            },
      ),
    );

  const addSemester = () =>
    setSemesters((prev) => [
      ...prev,
      {
        id: uid(),
        name: `Semester ${numberWord(prev.length + 1)}`,
        subjects: [],
      },
    ]);

  const removeSemester = (semesterId: string) =>
    setSemesters((prev) => prev.filter((s) => s.id !== semesterId));

  const renameSemester = (semesterId: string, name: string) =>
    setSemesters((prev) =>
      prev.map((s) => (s.id === semesterId ? { ...s, name } : s)),
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-12 lg:px-16 py-10 md:py-16">
        {/* HEADER */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8 md:gap-12">
          <div className="min-w-0">
            <p className="label-eyebrow mb-4 md:mb-6">
              Issue N°01 · Academic Record
            </p>
            <h1 className="numeric-display text-[2.6rem] leading-[0.95] sm:text-5xl md:text-6xl lg:text-[5.25rem] font-medium text-foreground">
              University
              <br />
              <span className="italic font-normal">GPA</span> Calculator
            </h1>
            <p className="mt-6 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground">
              Calculate your GPA. Modify subjects, credits and semesters at any
              time. Every change is saved to this browser.
            </p>
          </div>

          <div className="flex flex-col items-end gap-4 shrink-0 pt-1">
            <span className="flex items-center gap-2 label-eyebrow">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
                  savedFlash ? "bg-success" : "bg-muted-foreground/50"
                }`}
                aria-hidden
              />
              Auto Saved
            </span>

            <button
              onClick={() => setDark((d) => !d)}
              className="label-eyebrow inline-flex h-8 items-center gap-2 border border-input px-3 rounded-[6px] hover:bg-muted transition-colors"
              aria-label="Toggle dark mode"
            >
              {dark ? "Light" : "Dark"} Mode
            </button>

            <label className="flex flex-col items-end gap-1">
              <span className="label-eyebrow">Current Curriculum</span>
              <select
                value={curriculum}
                onChange={(e) => setCurriculum(e.target.value)}
                className="bg-transparent border border-input rounded-[6px] px-3 h-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {CURRICULA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {/* MASTHEAD RULE */}
        <div className="rule-thick mt-10 md:mt-14" />

        {/* SUMMARY */}
        <section
          aria-label="Summary"
          className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8 py-10 md:py-14"
        >
          <StatBlock label="Current GPA" value={stats.gpa.toFixed(2)} />
          <StatBlock label="Completed Credits" value={String(stats.credits)} />
          <StatBlock
            label="Average Grade"
            value={stats.avg ? stats.avg.toFixed(1) : "—"}
          />
          <StatBlock
            label="Passed Courses"
            value={`${stats.passed}${stats.courses ? ` / ${stats.courses}` : ""}`}
          />
        </section>

        <div className="rule-thick" />

        {/* SEMESTERS */}
        <main className="pt-4">
          {semesters.map((semester, i) => (
            <SemesterChapter
              key={semester.id}
              index={i + 1}
              semester={semester}
              onRename={(n) => renameSemester(semester.id, n)}
              onRemove={() => removeSemester(semester.id)}
              onAddSubject={() => addSubject(semester.id)}
              onUpdateSubject={(sid, patch) =>
                updateSubject(semester.id, sid, patch)
              }
              onRemoveSubject={(sid) => removeSubject(semester.id, sid)}
            />
          ))}

          <div className="rule-thick" />

          <div className="flex flex-wrap items-center justify-between gap-4 py-8">
            <p className="label-eyebrow">End of Record</p>
            <button
              onClick={addSemester}
              className="group inline-flex items-center gap-3 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
            >
              <span className="inline-block h-px w-8 bg-current" />
              Add Semester
            </button>
          </div>
        </main>

        {/* COLOPHON */}
        <footer className="rule-hair mt-6 pt-6 flex flex-wrap items-end justify-between gap-4 text-xs text-muted-foreground">
          <p className="label-eyebrow">Colophon</p>
          <p className="max-w-md text-right leading-relaxed">
            Set in Fraunces &amp; Inter. Composed on a 12-column grid. Grades
            weighted on the 4.00 scale. Data resides only in this browser.
          </p>
        </footer>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="label-eyebrow">{label}</span>
      <span className="numeric-display text-5xl md:text-6xl lg:text-7xl font-medium">
        {value}
      </span>
    </div>
  );
}

function SemesterChapter({
  index,
  semester,
  onRename,
  onRemove,
  onAddSubject,
  onUpdateSubject,
  onRemoveSubject,
}: {
  index: number;
  semester: Semester;
  onRename: (n: string) => void;
  onRemove: () => void;
  onAddSubject: () => void;
  onUpdateSubject: (id: string, patch: Partial<Subject>) => void;
  onRemoveSubject: (id: string) => void;
}) {
  return (
    <section className="pt-12 md:pt-16 pb-4 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-6 md:gap-10 mb-8">
        <div className="flex md:block items-baseline gap-6">
          <span
            aria-hidden
            className="numeric-display text-7xl md:text-[8rem] leading-none text-foreground/90 font-medium"
          >
            {ordinal(index)}
          </span>
        </div>
        <div className="flex flex-col justify-end min-w-0">
          <p className="label-eyebrow mb-2">Chapter {ordinal(index)}</p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
            <input
              value={semester.name}
              onChange={(e) => onRename(e.target.value)}
              className="min-w-0 bg-transparent border-0 border-b border-transparent hover:border-input focus:border-foreground focus:outline-none font-display text-3xl md:text-4xl font-medium tracking-tight py-1"
            />
            <button
              onClick={onRemove}
              className="label-eyebrow text-muted-foreground hover:text-destructive transition-colors shrink-0"
              aria-label={`Remove ${semester.name}`}
            >
              Remove Chapter
            </button>
          </div>
        </div>
      </div>

      <div className="rule-thick" />

      {/* table header */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_100px_140px_60px] gap-6 py-3 label-eyebrow">
        <span>Subject</span>
        <span className="text-right">Credits</span>
        <span className="text-right">Grade</span>
        <span className="text-right sr-only">Delete</span>
      </div>
      <div className="rule-hair hidden md:block" />

      {semester.subjects.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground italic">
          No subjects yet — add one to begin this chapter.
        </p>
      ) : (
        <ul>
          {semester.subjects.map((subject) => (
            <li
              key={subject.id}
              className="group grid grid-cols-[minmax(0,1fr)_72px_88px_28px] md:grid-cols-[minmax(0,1fr)_100px_140px_60px] gap-3 md:gap-6 items-center py-3.5 border-b border-border hover:bg-muted/40 transition-colors"
            >
              <input
                value={subject.name}
                placeholder="Untitled subject"
                onChange={(e) =>
                  onUpdateSubject(subject.id, { name: e.target.value })
                }
                className="min-w-0 bg-transparent border-0 focus:outline-none text-[0.95rem] placeholder:text-muted-foreground/60 py-1"
              />
              <input
                type="number"
                min={0}
                max={30}
                value={subject.credits}
                onChange={(e) =>
                  onUpdateSubject(subject.id, {
                    credits: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full bg-transparent border-0 focus:outline-none text-right tabular-nums numeric-display text-lg py-1"
              />
              <select
                value={subject.grade}
                onChange={(e) =>
                  onUpdateSubject(subject.id, {
                    grade: e.target.value as Grade | "",
                  })
                }
                className="w-full bg-transparent border-0 focus:outline-none text-right numeric-display text-lg font-medium py-1 cursor-pointer"
              >
                <option value="">—</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onRemoveSubject(subject.id)}
                aria-label={`Remove ${subject.name || "subject"}`}
                className="justify-self-end text-muted-foreground/60 hover:text-destructive transition-colors text-xl leading-none w-6 h-6 grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-5">
        <button
          onClick={onAddSubject}
          className="inline-flex items-center gap-3 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>
          Add Subject
        </button>
      </div>
    </section>
  );
}

function numberWord(n: number) {
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
