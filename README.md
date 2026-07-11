# The Scriptorium ★

**An editorial academic archive — where grades are inscribed.**

The Scriptorium is a GPA calculator designed like a printed publication rather
than a dashboard. Courses, credits, and results are arranged into a personal
academic record with an editorial zine aesthetic: masthead, chapters, print
ornaments, and a colophon.

## Features

- **Cumulative GPA on the official 4.00 scale** — every passed subject across
  all semesters is credit-weighted (`Σ(GP × ECTS) ÷ Σ ECTS`); never an average
  of semester GPAs. Failed subjects stay on record but carry no grade points.
- **Faculty curricula** — full degree programmes (Computer Science,
  Management, Mathematics) load as editable semester-by-semester templates.
  Adding a faculty is just adding a JSON file to `src/data/curricula/`.
- **Per-semester chapters** — each semester is a chapter of the publication,
  with its own GPA breakdown showing exactly how every subject contributes.
- **Exportable archive card** — a curated summary card (overall GPA, credits,
  semester highlights) composed like a printed artifact, with a selectable
  accent color, exportable as PNG, JPG, or PDF.
- **Light and dark editions** — warm paper by day, ink-black by night. The
  exported card always stays paper.
- **Autosave** — the whole record persists in the browser via localStorage.

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | React 19 + TanStack Start (SSR) + TanStack Router   |
| Styling    | Tailwind CSS v4, custom editorial utility system    |
| Typography | Fraunces · Inter · Space Mono                       |
| Validation | Zod (curriculum schemas)                            |
| Export     | html-to-image + jsPDF                               |
| Build      | Vite + Nitro                                        |

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm run preview  # preview the production build
```

## How GPA is calculated

Grades are entered as percentages (0–100) and mapped to grade points on the
official KIU scale (94–100 → 4.0 down to 51–55 → 0.5; below 51 is failing).
Each subject's grade point is weighted by its ECTS credits, so a 6-credit
course moves the GPA twice as much as a 3-credit one. The maths lives in
[`src/lib/gpa.ts`](src/lib/gpa.ts).

## Project structure

```
src/
├── routes/            # TanStack Router routes (the publication itself)
├── components/
│   ├── archive-card.tsx   # exportable summary card + export dialog
│   └── ui/                # dialog primitive
├── lib/               # GPA maths, curriculum registry, SSR error pages
├── data/curricula/    # faculty curriculum JSON files (auto-discovered)
└── styles.css         # editorial design system (Tailwind v4 utilities)
```

---

Designed and developed by **ann.** ⋆
[GitHub](https://github.com/AnnaNarmania) · [LinkedIn](https://www.linkedin.com/in/ananarmania/)
