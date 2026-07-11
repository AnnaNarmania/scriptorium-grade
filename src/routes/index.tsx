import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  MAX_GPA,
  computeStats,
  formatGpa,
  subjectStatus,
  weightedLines,
  type Semester,
  type Subject,
  uid,
} from "@/lib/gpa";
import {
  CURRICULA,
  curriculumToSemesters,
  getCurriculum,
  numberWord,
} from "@/lib/curriculum";
import { ArchiveCardDialog } from "@/components/archive-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Scriptorium — An Academic Archive" },
      {
        name: "description",
        content:
          "Where grades are inscribed. An editorial GPA archive — subjects, credits and semesters weighed on the official 4.00 scale.",
      },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "gpa.editorial.v2";
const LEGACY_STORAGE_KEY = "gpa.editorial.v1";
const THEME_KEY = "gpa.editorial.theme";
const CURRICULUM_KEY = "gpa.editorial.curriculum.v1";

const CHAPTER_ACCENTS = [
  "var(--color-pink)",
  "var(--color-blue)",
  "var(--color-yellow)",
  "var(--color-mint)",
  "var(--color-coral)",
  "var(--color-lavender)",
] as const;

// First visit: open on the first faculty's full curriculum, ungraded.
const defaultData = (): Semester[] =>
  CURRICULA.length ? curriculumToSemesters(CURRICULA[0]) : [];

// v1 stored letter grades; map them to representative percentages so
// existing records survive the switch to the numeric scale.
const LEGACY_GRADE_PERCENT: Record<string, number> = {
  "A+": 98,
  A: 95,
  "A-": 92,
  "B+": 89,
  B: 86,
  "B-": 82,
  "C+": 79,
  C: 75,
  "C-": 72,
  "D+": 69,
  D: 65,
  F: 45,
};

type LegacySemester = {
  id: string;
  name: string;
  subjects: { id: string; name: string; credits: number; grade: string }[];
};

function loadSemesters(): Semester[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as Semester[];
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return null;
  const old = JSON.parse(legacy) as LegacySemester[];
  return old.map((s) => ({
    id: s.id,
    name: s.name,
    subjects: s.subjects.map((c) => ({
      id: c.id,
      name: c.name,
      credits: c.credits,
      grade: c.grade in LEGACY_GRADE_PERCENT ? LEGACY_GRADE_PERCENT[c.grade] : "",
    })),
  }));
}

const ordinal = (n: number) => n.toString().padStart(2, "0");

const trimNumber = (n: number) => String(Math.round(n * 100) / 100);

function useHydratedState<T>(
  key: string,
  initial: () => T,
  load?: () => T | null,
) {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const value = load
        ? load()
        : (JSON.parse(localStorage.getItem(key) ?? "null") as T | null);
      if (value != null) setState(value);
    } catch {}
    setHydrated(true);
  }, [key, load]);

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
    loadSemesters,
  );
  const [curriculumId, setCurriculumId] = useHydratedState<string>(
    CURRICULUM_KEY,
    () => CURRICULA[0]?.id ?? "",
  );
  const activeCurriculum = getCurriculum(curriculumId);
  const [dark, setDark] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

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

  // "auto saved" pulse + digital timestamp (client-only to avoid SSR mismatch)
  useEffect(() => {
    setSavedFlash(true);
    setLastSaved(new Date());
    const t = setTimeout(() => setSavedFlash(false), 900);
    return () => clearTimeout(t);
  }, [semesters]);

  // Cumulative GPA weighs every passed subject across all semesters —
  // never an average of semester GPAs.
  const stats = useMemo(
    () => computeStats(semesters.flatMap((s) => s.subjects)),
    [semesters],
  );

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

  // Swap the whole record for the selected faculty's curriculum template.
  // Grades already entered are the only thing worth guarding.
  const selectCurriculum = (id: string) => {
    const next = getCurriculum(id);
    if (!next || id === curriculumId) return;
    const hasGrades = semesters.some((s) =>
      s.subjects.some((c) => c.grade !== ""),
    );
    if (
      hasGrades &&
      !window.confirm(
        `Load the ${next.faculty} curriculum? This replaces your current subjects and grades.`,
      )
    )
      return;
    setCurriculumId(id);
    setSemesters(curriculumToSemesters(next));
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <StarScatter />
      <div className="relative mx-auto w-full max-w-[1200px] px-6 md:px-12 lg:px-16 py-10 md:py-16">
        {/* MASTHEAD */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 label-mono text-muted-foreground">
          <span className="flex items-center gap-1.5 text-foreground">
            <Star style={{ color: "var(--color-pink)" }} />
            Academic Archive
          </span>
          <span className="hidden sm:inline">[ Issue 01 ]</span>
          <span
            aria-hidden
            className="barcode hidden md:block h-4 w-28 text-foreground"
          />
          <span className="hidden sm:inline">University Records Dept.</span>
          <span className="text-foreground">2026</span>
        </div>
        <div className="rule-thick mt-3" />

        {/* COVER */}
        <header className="mt-10 md:mt-14 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8 md:gap-12">
          <div className="relative min-w-0">
            {/* faint print ornaments behind the cover */}
            <Star
              className="pointer-events-none absolute -top-4 right-4 hidden -rotate-12 text-8xl md:block"
              style={{ color: "var(--color-blue)", opacity: 0.07 }}
            />
            <span
              aria-hidden
              className="label-mono pointer-events-none absolute right-0 top-0 hidden text-muted-foreground/50 md:block"
            >
              +
            </span>
            <div className="mb-4 md:mb-6 flex flex-wrap items-center gap-2">
              <span
                className="sticker -rotate-1"
                style={{
                  backgroundColor: "var(--color-pink)",
                  color: "var(--color-primary-foreground)",
                }}
              >
                Issue N°01
              </span>
              <span className="sticker">2026 Edition</span>
              <span
                className="sticker rotate-1"
                style={{
                  backgroundColor: "var(--color-lavender)",
                  color: "var(--color-primary-foreground)",
                }}
              >
                Academic Archive
              </span>
            </div>
            <h1 className="relative numeric-display text-[2.6rem] leading-[0.9] sm:text-5xl md:text-6xl lg:text-[5.5rem] font-medium text-foreground">
              The
              <br />
              <span
                className="italic font-normal print-offset"
                style={{ color: "var(--color-pink)" }}
              >
                Scriptorium
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground">
              A small academic ledger — courses, credits, and results arranged
              into a personal record.
            </p>
            <p className="mt-3 font-display italic text-[0.95rem] text-foreground">
              ann.{" "}
              <span
                aria-hidden
                className="inline-block select-none not-italic"
                style={{ color: "var(--color-pink)" }}
              >
                ⋆
              </span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-4 shrink-0 pt-1">
            {/* system status readout */}
            <div className="print-shadow flex min-w-[200px] flex-col gap-1.5 rounded-[4px] border border-rule bg-background px-4 py-3 label-mono">
              <span className="flex items-center justify-between gap-6 text-foreground">
                System Status
                <span
                  aria-hidden
                  className={`inline-block h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
                    savedFlash ? "bg-success" : "bg-muted-foreground/40"
                  }`}
                />
              </span>
              <span className="text-muted-foreground">GPA calculated ✓</span>
              <span className="text-muted-foreground">
                Autosave {savedFlash ? "writing…" : "idle"}
              </span>
              <span className="text-muted-foreground">
                Last update{" "}
                {lastSaved ? format(lastSaved, "MM.dd.yy — HH:mm") : "—"}
                <span aria-hidden className="cursor-blink">
                  ▊
                </span>
              </span>
            </div>

            <button
              onClick={() => setDark((d) => !d)}
              className="label-eyebrow inline-flex h-8 items-center gap-2 border border-input px-3 rounded-[6px] hover:bg-muted transition-colors"
              aria-label="Toggle dark mode"
            >
              {dark ? "Light" : "Dark"} Mode
            </button>

            <button
              onClick={() => setExportOpen(true)}
              className="label-eyebrow inline-flex h-8 items-center gap-2 border border-input px-3 rounded-[6px] hover:bg-muted transition-colors"
            >
              Export Card
              <span aria-hidden style={{ color: "var(--color-pink)" }}>
                ★
              </span>
            </button>

            <label className="flex flex-col items-end gap-1">
              <span className="label-eyebrow">Faculty Curriculum</span>
              <select
                value={curriculumId}
                onChange={(e) => selectCurriculum(e.target.value)}
                className="bg-transparent border border-input rounded-[6px] px-3 h-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {CURRICULA.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.faculty}
                  </option>
                ))}
              </select>
              {activeCurriculum ? (
                <span className="label-mono max-w-[230px] text-right text-muted-foreground">
                  {activeCurriculum.degree} ·{" "}
                  {activeCurriculum.totalCredits} ECTS
                </span>
              ) : null}
            </label>
          </div>
        </header>

        <div className="rule-thick mt-10 md:mt-14" />

        {/* ACADEMIC PERFORMANCE */}
        <section aria-label="Academic performance" className="py-10 md:py-14">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <p className="label-eyebrow flex items-center gap-2 text-foreground">
              <Star style={{ color: "var(--color-pink)" }} />
              Academic Performance
            </p>
            <span className="label-mono text-muted-foreground">
              [ System 01 ]
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-10 gap-x-8">
            <StatBlock
              label="Overall GPA"
              value={stats.passed ? formatGpa(stats.gpa) : "—"}
              badge={`★ Out of ${MAX_GPA.toFixed(2)}`}
              annotation="Σ(GP × ECTS) ÷ Σ ECTS"
              highlight
            />
            <StatBlock
              label="Completed Credits"
              value={String(stats.credits)}
              sub={
                activeCurriculum
                  ? `of ${activeCurriculum.totalCredits} ECTS`
                  : undefined
              }
            />
          </div>
        </section>

        <div className="rule-thick" />

        {/* SEMESTERS — keyed by curriculum so switching faculties turns the
            whole record over like a new section of the publication */}
        <main
          key={curriculumId}
          className="pt-4 animate-in fade-in slide-in-from-bottom-6 duration-500"
        >
          {semesters.map((semester, i) => (
            <SemesterChapter
              key={semester.id}
              index={i + 1}
              semester={semester}
              accent={CHAPTER_ACCENTS[i % CHAPTER_ACCENTS.length]}
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
            <p className="label-eyebrow flex items-center gap-2">
              <Star style={{ color: "var(--color-pink)" }} />
              End of Record
            </p>
            <button
              onClick={addSemester}
              className="print-shadow inline-flex items-center gap-2 label-eyebrow px-4 py-2.5 rounded-[4px] border border-foreground transition-all hover:bg-foreground hover:text-background hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
              style={{ backgroundColor: "var(--color-pink)", color: "var(--color-foreground)" }}
            >
              <span aria-hidden>+</span>
              Add Semester
            </button>
          </div>
        </main>

        {/* COLOPHON — a fixed two-column composition, like a printed
            magazine colophon: the columns compress on small screens but
            never stack. */}
        <footer className="rule-hair mt-6 grid grid-cols-[minmax(0,9fr)_minmax(0,11fr)] items-start gap-6 pt-6 text-xs text-muted-foreground md:grid-cols-[minmax(0,7fr)_minmax(0,13fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="label-eyebrow text-foreground">Colophon</p>
            <span
              aria-hidden
              className="barcode h-6 w-32 max-w-full text-foreground"
            />
            <p className="label-mono">
              No. 0026-07 · Scanned{" "}
              {lastSaved ? format(lastSaved, "dd.MM.yy") : "—"} · Edition 01
            </p>
          </div>
          <div className="flex min-w-0 max-w-md flex-col gap-2 justify-self-end text-right">
            <p className="font-medium text-foreground">
              Designed and developed by ann.{" "}
              <span
                aria-hidden
                className="inline-block select-none"
                style={{ color: "var(--color-pink)" }}
              >
                ⋆
              </span>
            </p>
            <p className="label-mono flex flex-wrap justify-end gap-x-5 gap-y-1">
              <span>
                Source ·{" "}
                <a
                  href="https://github.com/AnnaNarmania"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Source code on GitHub (opens in a new tab)"
                  className="text-foreground underline-offset-2 transition-colors hover:underline"
                >
                  GitHub <span aria-hidden>↗</span>
                </a>
              </span>
              <span>
                Profile ·{" "}
                <a
                  href="https://www.linkedin.com/in/ananarmania/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Profile on LinkedIn (opens in a new tab)"
                  className="text-foreground underline-offset-2 transition-colors hover:underline"
                >
                  LinkedIn <span aria-hidden>↗</span>
                </a>
              </span>
            </p>
            <p className="leading-relaxed">
              A digital academic archive for tracking university progress.
              Curriculums are editable, credits are weighted, and GPA
              calculations follow the official 4.00 scale.
            </p>
          </div>
        </footer>
      </div>

      <ArchiveCardDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        semesters={semesters}
        curriculum={activeCurriculum}
      />
    </div>
  );
}

// Print scatter — star flourishes stamped across the whole sheet, zine-style.
// Hand-placed rather than randomized so the page "prints" identically on
// every visit; percentage tops stretch the field over however many
// semesters the record grows to.
const SCATTERED_STARS: Array<{
  top: string;
  left: string;
  glyph: string;
  size: string;
  rotate: number;
  color: string;
  opacity: number;
}> = [
  { top: "1%", left: "55%", glyph: "✧", size: "text-base", rotate: 10, color: "--color-lavender", opacity: 0.4 },
  { top: "2%", left: "6%", glyph: "✶", size: "text-2xl", rotate: -12, color: "--color-pink", opacity: 0.5 },
  { top: "4%", left: "88%", glyph: "⋆", size: "text-4xl", rotate: 8, color: "--color-blue", opacity: 0.35 },
  { top: "5%", left: "26%", glyph: "⋆", size: "text-xs", rotate: 0, color: "--color-mint", opacity: 0.5 },
  { top: "7%", left: "46%", glyph: "✳", size: "text-sm", rotate: 0, color: "--color-coral", opacity: 0.45 },
  { top: "8%", left: "96%", glyph: "✶", size: "text-base", rotate: -10, color: "--color-yellow", opacity: 0.5 },
  { top: "10%", left: "3%", glyph: "★", size: "text-6xl", rotate: -18, color: "--color-yellow", opacity: 0.3 },
  { top: "13%", left: "93%", glyph: "✦", size: "text-xl", rotate: 15, color: "--color-pink", opacity: 0.45 },
  { top: "15%", left: "7%", glyph: "✳", size: "text-xl", rotate: 12, color: "--color-coral", opacity: 0.35 },
  { top: "17%", left: "12%", glyph: "⋆", size: "text-base", rotate: -6, color: "--color-blue", opacity: 0.5 },
  { top: "19%", left: "95%", glyph: "⋆", size: "text-sm", rotate: -8, color: "--color-pink", opacity: 0.5 },
  { top: "21%", left: "82%", glyph: "✶", size: "text-5xl", rotate: 20, color: "--color-mint", opacity: 0.3 },
  { top: "23%", left: "2%", glyph: "✦", size: "text-base", rotate: 14, color: "--color-mint", opacity: 0.45 },
  { top: "24%", left: "41%", glyph: "✦", size: "text-xs", rotate: 0, color: "--color-foreground", opacity: 0.25 },
  { top: "26%", left: "70%", glyph: "✧", size: "text-sm", rotate: 0, color: "--color-yellow", opacity: 0.5 },
  { top: "28%", left: "5%", glyph: "✷", size: "text-3xl", rotate: -14, color: "--color-lavender", opacity: 0.4 },
  { top: "30%", left: "88%", glyph: "✶", size: "text-xs", rotate: 8, color: "--color-blue", opacity: 0.5 },
  { top: "32%", left: "90%", glyph: "★", size: "text-2xl", rotate: 10, color: "--color-coral", opacity: 0.35 },
  { top: "34%", left: "10%", glyph: "⋆", size: "text-2xl", rotate: -16, color: "--color-yellow", opacity: 0.35 },
  { top: "36%", left: "66%", glyph: "⋆", size: "text-sm", rotate: 0, color: "--color-pink", opacity: 0.5 },
  { top: "39%", left: "52%", glyph: "✳", size: "text-xs", rotate: 0, color: "--color-foreground", opacity: 0.2 },
  { top: "41%", left: "2%", glyph: "✦", size: "text-7xl", rotate: 12, color: "--color-pink", opacity: 0.12 },
  { top: "43%", left: "8%", glyph: "✧", size: "text-sm", rotate: 10, color: "--color-coral", opacity: 0.45 },
  { top: "45%", left: "86%", glyph: "✳", size: "text-base", rotate: -8, color: "--color-blue", opacity: 0.45 },
  { top: "47%", left: "92%", glyph: "✶", size: "text-xl", rotate: -14, color: "--color-lavender", opacity: 0.35 },
  { top: "49%", left: "30%", glyph: "✶", size: "text-xs", rotate: 0, color: "--color-mint", opacity: 0.5 },
  { top: "51%", left: "5%", glyph: "⋆", size: "text-base", rotate: 6, color: "--color-pink", opacity: 0.45 },
  { top: "53%", left: "94%", glyph: "⋆", size: "text-3xl", rotate: 18, color: "--color-yellow", opacity: 0.45 },
  { top: "57%", left: "8%", glyph: "★", size: "text-xl", rotate: -10, color: "--color-blue", opacity: 0.3 },
  { top: "59%", left: "90%", glyph: "✷", size: "text-sm", rotate: 12, color: "--color-mint", opacity: 0.5 },
  { top: "62%", left: "74%", glyph: "✷", size: "text-6xl", rotate: -16, color: "--color-lavender", opacity: 0.16 },
  { top: "64%", left: "12%", glyph: "✦", size: "text-xs", rotate: 0, color: "--color-pink", opacity: 0.5 },
  { top: "66%", left: "4%", glyph: "✶", size: "text-sm", rotate: 6, color: "--color-coral", opacity: 0.5 },
  { top: "68%", left: "55%", glyph: "⋆", size: "text-sm", rotate: -6, color: "--color-yellow", opacity: 0.45 },
  { top: "70%", left: "89%", glyph: "✦", size: "text-2xl", rotate: -12, color: "--color-pink", opacity: 0.4 },
  { top: "72%", left: "3%", glyph: "✶", size: "text-2xl", rotate: 16, color: "--color-blue", opacity: 0.25 },
  { top: "75%", left: "18%", glyph: "⋆", size: "text-4xl", rotate: 14, color: "--color-mint", opacity: 0.3 },
  { top: "77%", left: "93%", glyph: "✧", size: "text-base", rotate: -10, color: "--color-coral", opacity: 0.45 },
  { top: "79%", left: "60%", glyph: "✳", size: "text-xs", rotate: 0, color: "--color-foreground", opacity: 0.25 },
  { top: "81%", left: "8%", glyph: "✳", size: "text-sm", rotate: 8, color: "--color-mint", opacity: 0.5 },
  { top: "83%", left: "92%", glyph: "★", size: "text-5xl", rotate: -20, color: "--color-blue", opacity: 0.15 },
  { top: "85%", left: "52%", glyph: "⋆", size: "text-xs", rotate: 0, color: "--color-foreground", opacity: 0.22 },
  { top: "87%", left: "7%", glyph: "✦", size: "text-base", rotate: 10, color: "--color-yellow", opacity: 0.55 },
  { top: "89%", left: "91%", glyph: "✶", size: "text-base", rotate: -12, color: "--color-lavender", opacity: 0.45 },
  { top: "91%", left: "45%", glyph: "✶", size: "text-3xl", rotate: -8, color: "--color-pink", opacity: 0.35 },
  { top: "93%", left: "27%", glyph: "✧", size: "text-sm", rotate: 10, color: "--color-blue", opacity: 0.4 },
  { top: "95%", left: "84%", glyph: "⋆", size: "text-xl", rotate: 16, color: "--color-coral", opacity: 0.45 },
  { top: "97%", left: "60%", glyph: "✦", size: "text-xs", rotate: 0, color: "--color-coral", opacity: 0.4 },
  { top: "98%", left: "15%", glyph: "✳", size: "text-2xl", rotate: -14, color: "--color-lavender", opacity: 0.4 },
];

function StarScatter() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
      {SCATTERED_STARS.map((s, i) => (
        <span
          key={i}
          className={`absolute leading-none ${s.size}`}
          style={{
            top: s.top,
            left: s.left,
            transform: `rotate(${s.rotate}deg)`,
            color: `var(${s.color})`,
            opacity: s.opacity,
          }}
        >
          {s.glyph}
        </span>
      ))}
    </div>
  );
}

// Signature mark — the five-pointed star recurs across the publication:
// masthead identity, section titles, chapter markers, end slugs.
function Star({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block select-none leading-none ${className}`}
      style={style}
    >
      ★
    </span>
  );
}

function StatBlock({
  label,
  value,
  sub,
  badge,
  annotation,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  annotation?: string;
  highlight?: boolean;
}) {
  return (
    <div className="group/stat flex flex-col gap-3">
      <span className="label-eyebrow">{label}</span>
      {highlight ? (
        <span
          key={value}
          className="digit-tick numeric-display inline-block self-start px-3 py-1 -mx-1 text-5xl md:text-6xl lg:text-7xl font-medium"
          style={{
            backgroundColor: "var(--color-pink)",
            color: "var(--color-primary-foreground)",
          }}
        >
          {value}
        </span>
      ) : (
        <span
          key={value}
          className="digit-tick numeric-display text-5xl md:text-6xl lg:text-7xl font-medium"
        >
          {value}
        </span>
      )}
      {badge ? (
        <span className="chrome-badge label-mono self-start rounded-[3px] px-2 py-0.5">
          {badge}
        </span>
      ) : null}
      {sub ? <span className="label-eyebrow">{sub}</span> : null}
      {annotation ? (
        <span className="label-mono text-muted-foreground opacity-0 transition-opacity duration-300 group-hover/stat:opacity-100">
          {annotation}
        </span>
      ) : null}
    </div>
  );
}

function SemesterChapter({
  index,
  semester,
  accent,
  onRemove,
  onAddSubject,
  onUpdateSubject,
  onRemoveSubject,
}: {
  index: number;
  semester: Semester;
  accent: string;
  onRemove: () => void;
  onAddSubject: () => void;
  onUpdateSubject: (id: string, patch: Partial<Subject>) => void;
  onRemoveSubject: (id: string) => void;
}) {
  const semStats = useMemo(
    () => computeStats(semester.subjects),
    [semester.subjects],
  );
  const lines = useMemo(
    () => weightedLines(semester.subjects),
    [semester.subjects],
  );

  return (
    <section className="group/chapter pt-12 md:pt-16 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-6 md:gap-10 mb-8">
        <div className="flex md:block items-baseline gap-6">
          {/* layered print block: halftone screen + misregistered ink plate */}
          <span className="relative inline-block">
            <span
              aria-hidden
              className="halftone absolute -top-4 -left-5 h-24 w-24 rounded-full md:-top-8 md:-left-10 md:h-44 md:w-44"
              style={{ color: accent, opacity: 0.5 }}
            />
            {/* anchored on the leading zero so every chapter reads identically,
                regardless of how wide the second digit's glyph is */}
            <Star
              className="absolute bottom-0 left-0 -translate-x-1/3 rotate-12 text-4xl md:text-7xl"
              style={{ color: accent, opacity: 0.22 }}
            />
            <span
              aria-hidden
              className="print-offset relative numeric-display text-7xl md:text-[9rem] leading-none font-medium"
              style={{ color: accent }}
            >
              {ordinal(index)}
            </span>
          </span>
        </div>
        <div className="flex flex-col justify-end min-w-0">
          <p className="label-eyebrow mb-2 flex items-center gap-2">
            <Star className="text-sm" style={{ color: accent }} />
            Chapter {ordinal(index)}
            <span className="label-mono text-muted-foreground opacity-0 transition-opacity duration-300 group-hover/chapter:opacity-100">
              [ Ref SEM.{ordinal(index)} ]
            </span>
          </p>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
            <h2 className="min-w-0 font-display text-3xl md:text-4xl font-medium tracking-tight py-1">
              {semester.name}
            </h2>
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
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_80px_90px_40px] gap-6 py-3 label-eyebrow">
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
            <SubjectRow
              key={subject.id}
              subject={subject}
              onUpdate={(patch) => onUpdateSubject(subject.id, patch)}
              onRemove={() => onRemoveSubject(subject.id)}
            />
          ))}
        </ul>
      )}

      <div className="pt-6">
        <button
          onClick={onAddSubject}
          className="print-shadow inline-flex items-center gap-2 label-eyebrow px-3 py-2 border border-foreground bg-foreground text-background hover:bg-background hover:text-foreground hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all rounded-[4px]"
          style={{ backgroundColor: accent, color: "var(--color-foreground)", borderColor: "var(--color-foreground)" }}
        >
          <span aria-hidden>+</span>
          Add Subject
        </button>
      </div>

      {/* semester report */}
      <div className="rule-thick mt-10" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-8 pt-8">
        <div className="flex flex-col gap-2">
          <span className="label-eyebrow">Semester GPA</span>
          <span
            key={semStats.passed ? formatGpa(semStats.gpa) : "—"}
            className="digit-tick numeric-display text-4xl md:text-5xl font-medium"
          >
            {semStats.passed ? formatGpa(semStats.gpa) : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label-eyebrow">Credits Completed</span>
          <span className="numeric-display text-4xl md:text-5xl font-medium">
            {semStats.credits}
          </span>
        </div>
      </div>

      {/* calculation transparency */}
      <details className="group mt-8">
        <summary className="label-eyebrow inline-flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:text-foreground transition-colors">
          <span
            aria-hidden
            className="inline-block text-sm leading-none transition-transform duration-200 group-open:rotate-45"
          >
            +
          </span>
          How this GPA is calculated
        </summary>
        <div className="mt-5 max-w-md text-sm">
          <p className="text-muted-foreground leading-relaxed mb-4">
            GPA = total weighted grade points ÷ total completed credits. Each
            subject contributes its grade point × its credits.
          </p>
          {lines.length === 0 ? (
            <p className="italic text-muted-foreground">
              Nothing to calculate yet.
            </p>
          ) : (
            <>
              <ul>
                {lines.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border"
                  >
                    <span className="min-w-0 truncate">
                      {line.name || "Untitled subject"}
                    </span>
                    <span className="numeric-display tabular-nums shrink-0">
                      {line.gp.toFixed(1)} × {line.credits} ={" "}
                      {trimNumber(line.weighted)}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-eyebrow">Total Weighted Points</dt>
                  <dd className="numeric-display tabular-nums">
                    {trimNumber(semStats.weightedPoints)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-eyebrow">Completed Credits</dt>
                  <dd className="numeric-display tabular-nums">
                    {semStats.credits}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-eyebrow">Semester GPA</dt>
                  <dd className="numeric-display tabular-nums font-medium">
                    {semStats.passed ? formatGpa(semStats.gpa) : "—"}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </details>
    </section>
  );
}

function SubjectRow({
  subject,
  onUpdate,
  onRemove,
}: {
  subject: Subject;
  onUpdate: (patch: Partial<Subject>) => void;
  onRemove: () => void;
}) {
  const status = subjectStatus(subject);

  return (
    <li
      className={`group grid grid-cols-[minmax(0,1fr)_44px_56px_24px] md:grid-cols-[minmax(0,1fr)_80px_90px_40px] gap-3 md:gap-6 items-center py-3.5 border-b border-border transition-colors ${
        status === "failed" ? "bg-destructive/5" : "hover:bg-muted/40"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <input
          value={subject.name}
          placeholder="Untitled subject"
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent border-0 focus:outline-none text-[0.95rem] placeholder:text-muted-foreground/60 py-1"
        />
        {subject.category && subject.category !== "mandatory" ? (
          <span className="label-mono shrink-0 text-muted-foreground/70">
            [{subject.category}]
          </span>
        ) : null}
      </div>
      <input
        type="number"
        min={0}
        max={30}
        value={subject.credits}
        onChange={(e) =>
          onUpdate({ credits: Math.max(0, Number(e.target.value) || 0) })
        }
        className="w-full bg-transparent border-0 focus:outline-none text-right tabular-nums numeric-display text-lg py-1"
        aria-label="Credits"
      />
      <input
        type="number"
        min={0}
        max={100}
        value={subject.grade}
        placeholder="—"
        onChange={(e) => {
          const v = e.target.value;
          const n = Number(v);
          onUpdate({
            grade:
              v === "" || Number.isNaN(n)
                ? ""
                : Math.min(100, Math.max(0, n)),
          });
        }}
        className="w-full bg-transparent border-0 focus:outline-none text-right tabular-nums numeric-display text-lg font-medium py-1"
        aria-label="Grade out of 100"
        style={
          status === "failed"
            ? { color: "var(--color-destructive)" }
            : undefined
        }
      />
      <button
        onClick={onRemove}
        aria-label={`Remove ${subject.name || "subject"}`}
        className="justify-self-end text-muted-foreground/60 hover:text-destructive transition-colors text-xl leading-none w-6 h-6 grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        ×
      </button>
    </li>
  );
}

