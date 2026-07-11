import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_GPA, computeStats, formatGpa, type Semester } from "@/lib/gpa";
import type { Curriculum } from "@/lib/curriculum";

const NAME_KEY = "gpa.editorial.student.v1";
const ACCENT_KEY = "gpa.editorial.cardAccent.v1";

// Literal light-palette values: the card is pinned to paper colors, so the
// accent must not shift with the site theme.
const ACCENTS = [
  { id: "pink", label: "Pink", color: "#FF4FA3", ink: "#171717" },
  { id: "blue", label: "Blue", color: "#3B5BFF", ink: "#171717" },
  { id: "yellow", label: "Yellow", color: "#FFD95A", ink: "#171717" },
  { id: "mint", label: "Mint", color: "#8DE2C4", ink: "#171717" },
  { id: "coral", label: "Coral", color: "#FF7A59", ink: "#171717" },
  { id: "lavender", label: "Lavender", color: "#B9A7FF", ink: "#171717" },
] as const;

type Accent = (typeof ACCENTS)[number];
type AccentId = Accent["id"];

const getAccent = (id: string): Accent =>
  ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];

const pad2 = (n: number) => n.toString().padStart(2, "0");

type SemesterMark = { label: string; gpa: number };

type CardStats = {
  overall: ReturnType<typeof computeStats>;
  completedSemesters: number;
  totalSemesters: number;
  current: SemesterMark | null;
  highest: SemesterMark | null;
  lowest: SemesterMark | null;
};

// The card is a curated overview — semester GPAs are derived here, but no
// subject-level detail ever reaches the composition.
function deriveCardStats(semesters: Semester[]): CardStats {
  const overall = computeStats(semesters.flatMap((s) => s.subjects));
  const perSemester = semesters.map((s, i) => ({
    label: `S.${pad2(i + 1)}`,
    subjects: s.subjects,
    stats: computeStats(s.subjects),
  }));
  const completedSemesters = perSemester.filter(
    (s) =>
      s.subjects.length > 0 &&
      s.subjects.every((sub) => sub.grade !== "" && sub.grade != null),
  ).length;
  const withGpa = perSemester
    .filter((s) => s.stats.passed > 0)
    .map((s) => ({ label: s.label, gpa: s.stats.gpa }));
  return {
    overall,
    completedSemesters,
    totalSemesters: semesters.length,
    current: withGpa.length ? withGpa[withGpa.length - 1] : null,
    // Lowest is only meaningful once there is something to compare against.
    highest: withGpa.length
      ? withGpa.reduce((a, b) => (b.gpa > a.gpa ? b : a))
      : null,
    lowest:
      withGpa.length >= 2
        ? withGpa.reduce((a, b) => (b.gpa < a.gpa ? b : a))
        : null,
  };
}

const CARD_STARS: Array<{
  top: string;
  left: string;
  glyph: string;
  size: string;
  rotate: number;
  color: string;
  opacity: number;
}> = [
  { top: "4%", left: "88%", glyph: "✶", size: "text-sm", rotate: -12, color: "var(--color-pink)", opacity: 0.45 },
  { top: "30%", left: "4%", glyph: "⋆", size: "text-2xl", rotate: 10, color: "var(--color-blue)", opacity: 0.25 },
  { top: "55%", left: "92%", glyph: "✧", size: "text-base", rotate: 8, color: "var(--color-coral)", opacity: 0.4 },
  { top: "72%", left: "6%", glyph: "✳", size: "text-xs", rotate: 0, color: "var(--color-lavender)", opacity: 0.45 },
  { top: "90%", left: "60%", glyph: "⋆", size: "text-sm", rotate: -8, color: "var(--color-mint)", opacity: 0.4 },
];

function StatCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="col-span-6 flex flex-col gap-1">
      <span className="label-eyebrow">{label}</span>
      <span className="numeric-display text-[1.7rem] text-foreground">
        {value}
      </span>
      {sub ? (
        <span className="label-mono text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  );
}

function ArchiveCard({
  name,
  curriculum,
  stats,
  accent,
}: {
  name: string;
  curriculum?: Curriculum;
  stats: CardStats;
  accent: Accent;
}) {
  const year = format(new Date(), "yyyy");
  return (
    <div className="archive-card relative w-[440px] shrink-0 overflow-hidden border border-rule bg-background font-sans text-foreground">
      {/* faint print scatter, matching the site's star field */}
      {CARD_STARS.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className={`pointer-events-none absolute select-none leading-none ${s.size}`}
          style={{
            top: s.top,
            left: s.left,
            transform: `rotate(${s.rotate}deg)`,
            color: s.color,
            opacity: s.opacity,
          }}
        >
          {s.glyph}
        </span>
      ))}

      <div className="relative grid grid-cols-12 gap-x-3 px-7 pb-6 pt-6">
        {/* masthead */}
        <div className="label-mono col-span-12 flex items-baseline justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5 text-foreground">
            <span aria-hidden style={{ color: accent.color }}>
              ★
            </span>
            Academic Archive
          </span>
          <span>[ Issue 01 ]</span>
          <span className="text-foreground">{year}</span>
        </div>
        <div className="rule-thick col-span-12 mt-2.5" />

        {/* title */}
        <div className="col-span-12 mt-5">
          <p className="label-eyebrow">Official Record · No. 0026-07</p>
          <p className="numeric-display mt-1.5 text-4xl font-medium text-foreground">
            The{" "}
            <span
              className="font-normal italic"
              style={{ color: accent.color }}
            >
              Scriptorium
            </span>
          </p>
        </div>

        {/* student / edition */}
        <div className="col-span-7 mt-6 flex flex-col gap-1">
          <span className="label-eyebrow">Student</span>
          {name ? (
            <span className="font-display text-xl italic leading-tight text-foreground">
              {name}
            </span>
          ) : (
            <span
              aria-hidden
              className="mt-5 block w-44 border-b border-foreground/60"
            />
          )}
        </div>
        <div className="col-span-5 mt-6 flex flex-col items-end gap-1 text-right">
          <span className="label-eyebrow">Edition</span>
          <span className="label-mono text-foreground">
            {year} · N°01
          </span>
        </div>

        {/* programme */}
        <div className="col-span-12 mt-4 flex flex-col gap-1">
          <span className="label-eyebrow">Programme</span>
          <span className="text-sm font-medium text-foreground">
            {curriculum
              ? `${curriculum.degree} — ${curriculum.faculty}`
              : "Independent study"}
          </span>
        </div>

        <div className="rule-thick col-span-12 mt-5" />

        {/* GPA hero, with the records stamp overlapping */}
        <div className="relative col-span-12 mt-5 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="label-eyebrow">Overall GPA</span>
            <span
              className="numeric-display inline-block self-start px-3 py-1 text-6xl font-medium"
              style={{
                backgroundColor: accent.color,
                color: accent.ink,
              }}
            >
              {stats.overall.passed ? formatGpa(stats.overall.gpa) : "—"}
            </span>
          </div>
          <div className="label-mono flex flex-col items-end gap-1 pb-1 text-right text-muted-foreground">
            <span>★ Out of {MAX_GPA.toFixed(2)}</span>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute right-20 -top-4 grid h-[104px] w-[104px] -rotate-12 place-items-center rounded-full border-2 select-none"
            style={{
              borderColor: "var(--color-blue)",
              color: "var(--color-blue)",
              opacity: 0.5,
              mixBlendMode: "multiply",
            }}
          >
            <div
              className="grid h-[88px] w-[88px] place-items-center rounded-full border text-center"
              style={{ borderColor: "var(--color-blue)" }}
            >
              <span className="label-mono leading-snug">
                Records
                <br />
                Dept
                <br />★ {year} ★
              </span>
            </div>
          </div>
        </div>

        <div className="rule-hair col-span-12 mt-6" />

        {/* curated stats — the overview, never the transcript */}
        <div className="col-span-12 mt-4 grid grid-cols-12 gap-x-3 gap-y-5">
          <StatCell
            label="Credits Completed"
            value={String(stats.overall.credits)}
            sub={
              curriculum ? `of ${curriculum.totalCredits} ECTS` : "ECTS"
            }
          />
          <StatCell
            label="Semesters Completed"
            value={pad2(stats.completedSemesters)}
            sub={`of ${pad2(stats.totalSemesters)} on record`}
          />
          <StatCell
            label="Current Sem. GPA"
            value={stats.current ? formatGpa(stats.current.gpa) : "—"}
            sub={stats.current?.label}
          />
          <StatCell
            label="Highest Sem. GPA"
            value={stats.highest ? formatGpa(stats.highest.gpa) : "—"}
            sub={stats.highest?.label}
          />
          {stats.lowest ? (
            <StatCell
              label="Lowest Sem. GPA"
              value={formatGpa(stats.lowest.gpa)}
              sub={stats.lowest.label}
            />
          ) : (
            <StatCell label="Grading" value="4.00" sub="KIU scale" />
          )}
          {/* sticky note */}
          <div className="col-span-6 flex items-center justify-end pr-1">
            <div
              className="rotate-2 px-3 py-2.5"
              style={{
                backgroundColor: "var(--color-yellow)",
                color: "var(--color-primary-foreground)",
                boxShadow: "2px 3px 0 rgba(0, 0, 0, 0.18)",
              }}
            >
              <span className="label-mono block lowercase">
                do not remove
              </span>
              <span className="label-mono block lowercase">
                from archive ⋆
              </span>
            </div>
          </div>
        </div>

        <div className="rule-thick col-span-12 mt-6" />

        {/* colophon */}
        <div className="col-span-12 mt-4 flex items-end justify-between">
          <div className="flex flex-col gap-2">
            <span aria-hidden className="barcode h-5 w-28 text-foreground" />
            <span className="label-mono text-muted-foreground">
              No. 0026-07 · p. 01 / 01 · {format(new Date(), "dd.MM.yy")}
            </span>
          </div>
          <span className="font-display text-sm italic text-foreground">
            ann.{" "}
            <span
              aria-hidden
              className="inline-block select-none not-italic"
              style={{ color: accent.color }}
            >
              ⋆
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
};

export function ArchiveCardDialog({
  open,
  onOpenChange,
  semesters,
  curriculum,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesters: Semester[];
  curriculum?: Curriculum;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [accentId, setAccentId] = useState<AccentId>(ACCENTS[0].id);
  const [busy, setBusy] = useState<"png" | "jpg" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setName(saved);
      const savedAccent = localStorage.getItem(ACCENT_KEY);
      if (savedAccent) setAccentId(getAccent(savedAccent).id);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {}
  }, [name]);
  useEffect(() => {
    try {
      localStorage.setItem(ACCENT_KEY, accentId);
    } catch {}
  }, [accentId]);

  const stats = useMemo(() => deriveCardStats(semesters), [semesters]);

  // pixelRatio 3 turns the 440px composition into a ~1320px-wide image.
  const capturePng = async () => {
    const node = cardRef.current;
    if (!node) throw new Error("Card is not mounted");
    const { toPng } = await import("html-to-image");
    return toPng(node, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#FFF9F0",
    });
  };

  const runExport = async (kind: "png" | "jpg" | "pdf") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "jpg") {
        const node = cardRef.current;
        if (!node) throw new Error("Card is not mounted");
        const { toJpeg } = await import("html-to-image");
        const dataUrl = await toJpeg(node, {
          pixelRatio: 3,
          cacheBust: true,
          quality: 0.95,
          backgroundColor: "#FFF9F0",
        });
        downloadDataUrl(dataUrl, "scriptorium-archive-card.jpg");
      } else if (kind === "png") {
        downloadDataUrl(await capturePng(), "scriptorium-archive-card.png");
      } else {
        const node = cardRef.current;
        if (!node) throw new Error("Card is not mounted");
        const dataUrl = await capturePng();
        const { jsPDF } = await import("jspdf");
        const w = node.offsetWidth;
        const h = node.offsetHeight;
        const pdf = new jsPDF({
          orientation: h >= w ? "portrait" : "landscape",
          unit: "px",
          format: [w, h],
          hotfixes: ["px_scaling"],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
        pdf.save("scriptorium-archive-card.pdf");
      }
    } catch (e) {
      console.error(e);
      setError("Export failed — try again.");
    } finally {
      setBusy(null);
    }
  };

  const exportButton = (kind: "png" | "jpg" | "pdf", label: string) => (
    <button
      onClick={() => runExport(kind)}
      disabled={busy !== null}
      className="label-eyebrow inline-flex h-8 items-center gap-2 rounded-[6px] border border-input px-3 transition-colors hover:bg-muted disabled:opacity-50"
    >
      {busy === kind ? "Rendering…" : label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-auto max-w-[95vw] overflow-y-auto sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="label-eyebrow text-foreground">
            Export — Archive Card
          </DialogTitle>
          <DialogDescription>
            A curated summary of your record, composed for saving or sharing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="label-eyebrow">Student name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Appears on the card"
              className="h-9 rounded-[6px] border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="label-eyebrow">Accent</span>
            <div className="flex items-center gap-2 pb-1.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={`${a.label} accent`}
                  aria-pressed={accentId === a.id}
                  onClick={() => setAccentId(a.id)}
                  className={`h-6 w-6 rounded-full border border-foreground/25 transition-transform hover:scale-110 ${
                    accentId === a.id
                      ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                      : ""
                  }`}
                  style={{ backgroundColor: a.color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="-mx-2 overflow-x-auto px-2 py-1">
          <div ref={cardRef} className="w-[440px]">
            <ArchiveCard
              name={name.trim()}
              curriculum={curriculum}
              stats={stats}
              accent={getAccent(accentId)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {error ? (
            <span className="label-mono mr-auto text-destructive">
              {error}
            </span>
          ) : null}
          {exportButton("png", "Save PNG")}
          {exportButton("jpg", "Save JPG")}
          {exportButton("pdf", "Save PDF")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
