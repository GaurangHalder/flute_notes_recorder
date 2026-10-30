# Music Tab Editor

A browser-based editor for transcribing flute (or similar wind instrument) fingerings on a six-hole grid, with per-row notation symbols and multi-section songs.

## Features

- **Hole grid** — six columns per row; click to cycle hole states (see below).
- **Row symbols** — optional notation per row (quick lift, holds, air, flow arrows, and more). Use the **+** button at the start of each row, or read the legend under **Notation symbols**.
- **Blow longer** — multi-row mark: dash on the start row and a vertical line down to the end row. Choose it from the row symbol picker, then set the range in the dialog.
- **Sections** — intro, verse, chorus, bridge, outro, or score; verses auto-number (Verse 1, Verse 2, …).
- **Copy / paste section** — duplicate the current section’s tab (grid, symbols, and blow-longer spans) as a new section; pick the target type under **Add section** before **Paste**.
- **Saved songs** — library stored in `localStorage`; sidebar actions: **View**, **Edit**, **Delete**.
- **Viewer** — read-only panel with zoom, “all sections together” or one section at a time, and **Edit in editor** to switch back.

## Hole states

| Visual     | Value | How to set                               |
| ---------- | ----- | ---------------------------------------- |
| Hollow     | `0`   | Default, or single click when half/full  |
| Full black | `1`   | Single click from hollow                 |
| Half black | `9`   | Double click from hollow or full         |

## Songs and sections

Each **song** has one ID and contains multiple **sections**.

- **Song name** — title for the whole piece.
- **Section** — switch between parts; the grid saves automatically when you change section.
- **Add section** — pick a type and click **Add**. New verses are numbered automatically.
- **+ Add row** / **− Remove row** — row count is per section.

Toolbar actions:

| Button          | Action                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| **New song**    | Start a fresh song in the editor                                       |
| **Import file** | Load a JSON song file into the library and open it in the editor       |
| **Save locally**| Store the current song in the browser library (`localStorage`)       |
| **Export JSON** | Download the song as a `.json` file (does not require saving first)  |

## Viewer

From the **Saved songs** sidebar, **View** opens a read-only overlay:

- **View as** — all sections in one scrollable view, or one section at a time.
- **Zoom** — 25%–200% with reset.
- **Edit in editor** — load the same song in the main editor and close the viewer.

## Project layout

```
fluterecorder/
├── index.html      # App shell
├── css/styles.css  # Layout and grid styling
├── js/app.js       # Editor, storage, viewer, import/export
└── README.md
```

No build step or dependencies are required.

## Run locally

From the project folder:

```bash
npx --yes serve .
```

Open the URL shown (usually `http://localhost:3000`).

You can also open `index.html` directly in a browser. **Save locally** still uses `localStorage`; **Export JSON** always downloads a file.

## Save format (v2)

Example export `greensleeves-20260601-143022.json`:

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
      "grid": [[0, 1, 0, 0, 0, 0]],
      "rowSymbols": ["", "quick_lift", "", "", "", "", "", ""],
      "blowLonger": []
    },
    {
      "id": "section-...",
      "type": "verse",
      "number": 1,
      "label": "Verse 1",
      "rows": 20,
      "grid": [],
      "rowSymbols": [],
      "blowLonger": [{ "start": 4, "end": 9 }]
    }
  ]
}
```

- Each grid cell is `0` (hollow), `1` (full), or `9` (half).
- `rowSymbols` — parallel array of symbol ids per row (`""` if none). Simple symbols include `quick_lift`, `long_hold`, `short_hold`, `closed_hole`, `open_hole`, `more_air`, `very_short`, `flow_high`, `steady_low`.
- `blowLonger` — zero or more inclusive row ranges (`start` / `end` are 0-based indices).

Older **v1** files with a single top-level `grid` import as a song with one **Score** section (empty symbols and blow-longer spans).

I have added 2 .json files that you can directly download and import to get a look of how a song tabs should look like.
