# Music Tab Editor

A simple web UI for transcribing flute (or similar) fingerings on a hole grid.

## Hole states

| Visual      | Value | How to set                          |
| ----------- | ----- | ----------------------------------- |
| Hollow      | `0`   | Default, or single click when half  |
| Full black  | `1`   | Single click from hollow            |
| Half black  | `9`   | Double click from hollow or full    |

## Songs and sections

Each **song** has one ID and contains multiple **sections** (intro, verse 1, verse 2, chorus, score, etc.).

- **Song name** — title for the whole piece.
- **Section** — switch between parts; the grid saves automatically when you change section.
- **Add section** — pick a type (Intro, Verse, Chorus, …) and click **Add**. New verses are numbered automatically (Verse 1, Verse 2, …).
- **+ Add row** / **− Remove row** — change how many rows the current section has (per section).

**Save song** stores the full song in the browser (`localStorage`) and downloads one JSON file with every section.

**Import file** loads a song file (v2 with sections, or older single-grid v1 files) and adds it to the saved list.

The **Saved songs** sidebar lists songs stored in the browser. For each song:

- **View** — opens a read-only panel inside the app (switch sections without editing).
- **Edit** — loads the song in the main editor.
- **Delete** — removes the song from saved storage (with confirmation).

## Run locally

```bash
cd "c:\Users\noctu\STUDY_MATERIAL\personal projects\fluterecorder"
npx --yes serve .
```

Open the URL shown (usually `http://localhost:3000`).

You can also open `index.html` directly in a browser; **Save song** still downloads a JSON file.

## Save format (v2)

Example `greensleeves-20260601-143022.json`:

```json
{
  "version": 2,
  "id": "song-1717248622038-abc123",
  "name": "Greensleeves",
  "createdAt": "2026-06-01T14:30:22.000Z",
  "updatedAt": "2026-06-01T15:10:00.000Z",
  "columns": 6,
  "sections": [
    {
      "id": "section-...",
      "type": "intro",
      "number": null,
      "label": "Intro",
      "rows": 8,
      "grid": [[0, 1, 0, 0, 0, 0], ...]
    },
    {
      "id": "section-...",
      "type": "verse",
      "number": 1,
      "label": "Verse 1",
      "rows": 20,
      "grid": [...]
    },
    {
      "id": "section-...",
      "type": "chorus",
      "number": null,
      "label": "Chorus",
      "rows": 16,
      "grid": [...]
    }
  ]
}
```

Each cell is `0` (hollow), `1` (full), or `9` (half). Older v1 files with a single `grid` import as a song with one **Score** section.
