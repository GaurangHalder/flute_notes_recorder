const DEFAULT_ROWS = 20;
const MIN_ROWS = 1;
const COLS = 6;
const DOUBLE_CLICK_MS = 160;
const STORAGE_KEY = "musicTabLibrary";
const FORMAT_VERSION = 2;
const DEFAULT_SONG_NAME = "Untitled song";

/** @type {number[][]} */
let grid = createEmptyGrid(DEFAULT_ROWS);

/** Row notation symbol ids, parallel to grid rows. */
/** @type {string[]} */
let rowSymbols = createEmptyRowSymbols(DEFAULT_ROWS);

/** Blow-longer spans: inclusive 0-based row indices. */
/** @type {{ start: number, end: number }[]} */
let blowLongerSpans = [];

/** @type {number} */
let rowCount = DEFAULT_ROWS;

/** @type {string | null} */
let activeSongId = null;

/** @type {string | null} */
let activeSectionId = null;

/** In-memory copy of the song being edited. */
let activeSong = null;

const sheetEl = document.getElementById("sheet");
const statusEl = document.getElementById("status-text");
const songListEl = document.getElementById("song-list");
const songListEmptyEl = document.getElementById("song-list-empty");
const songNameEl = document.getElementById("song-name");
const sectionSelectEl = document.getElementById("section-select");
const sectionTypeAddEl = document.getElementById("section-type-add");
const rowCountLabelEl = document.getElementById("row-count-label");
const btnNew = document.getElementById("btn-new");
const btnOpen = document.getElementById("btn-open");
const btnSaveLocal = document.getElementById("btn-save-local");
const btnSaveJson = document.getElementById("btn-save-json");
const btnAddSection = document.getElementById("btn-add-section");
const btnCopySection = document.getElementById("btn-copy-section");
const btnPasteSection = document.getElementById("btn-paste-section");
const btnDeleteSection = document.getElementById("btn-delete-section");
const btnAddRow = document.getElementById("btn-add-row");
const btnRemoveRow = document.getElementById("btn-remove-row");
const fileInput = document.getElementById("file-input");
const viewerPanelEl = document.getElementById("viewer-panel");
const viewerTitleEl = document.getElementById("viewer-title");
const viewerModeSelectEl = document.getElementById("viewer-mode-select");
const viewerSectionFieldEl = document.getElementById("viewer-section-field");
const viewerSectionSelectEl = document.getElementById("viewer-section-select");
const viewerPanelBodyEl = document.getElementById("viewer-panel-body");
const viewerAllEl = document.getElementById("viewer-all");
const viewerSheetEl = document.getElementById("viewer-sheet");
const viewerZoomHostEl = document.getElementById("viewer-zoom-host");
const viewerZoomInEl = document.getElementById("viewer-zoom-in");
const viewerZoomOutEl = document.getElementById("viewer-zoom-out");
const viewerZoomResetEl = document.getElementById("viewer-zoom-reset");
const viewerZoomLabelEl = document.getElementById("viewer-zoom-label");
const viewerBtnEditEl = document.getElementById("viewer-btn-edit");
const viewerBtnCloseEl = document.getElementById("viewer-btn-close");
const deleteDialogEl = document.getElementById("delete-dialog");
const deleteDialogMessageEl = document.getElementById("delete-dialog-message");
const notationRulesListEl = document.getElementById("notation-rules-list");
const symbolPickerEl = document.getElementById("symbol-picker");
const blowLongerDialogEl = document.getElementById("blow-longer-dialog");
const blowLongerStartEl = document.getElementById("blow-longer-start");
const blowLongerEndEl = document.getElementById("blow-longer-end");
const blowLongerPreviewEl = document.getElementById("blow-longer-preview");
const blowLongerRemoveBtn = document.getElementById("blow-longer-remove");

/** Song currently shown in the viewer panel (read-only). */
let viewerSong = null;

/** @type {string | null} */
let viewerSectionId = null;

/** @type {"all" | "single"} */
let viewerMode = "single";

const VIEWER_ZOOM_MIN = 0.25;
const VIEWER_ZOOM_MAX = 2;
const VIEWER_ZOOM_STEP = 0.25;
const VIEWER_ZOOM_DEFAULT = 1;

/** @type {number} */
let viewerZoom = VIEWER_ZOOM_DEFAULT;

/** @type {string | null} */

/** @type {Map<string, HTMLButtonElement>} */
const holeButtons = new Map();

const SECTION_TYPE_LABELS = {
  intro: "Intro",
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  outro: "Outro",
  score: "Score",
};

/** @type {{ id: string, glyph: string, label: string, kind?: string }[]} */
const NOTATION_SYMBOLS = [
  { id: "quick_lift", glyph: "←", label: "Quick lift" },
  { id: "long_hold", glyph: "—", label: "Long hold" },
  { id: "short_hold", glyph: "-", label: "Short hold" },
  { id: "closed_hole", glyph: "●", label: "Closed hole" },
  { id: "open_hole", glyph: "○", label: "Open hole" },
  { id: "more_air", glyph: "·", label: "More air, higher pitch", kind: "more_air" },
  { id: "very_short", glyph: "×", label: "Very short while" },
  {
    id: "blow_longer",
    glyph: "┌",
    label: "Blow longer with quick lifts — dash on start row, line down to end row",
    kind: "blow_longer_range",
  },
  {
    id: "flow_high",
    glyph: "↗",
    label: "Flow slowly, then end with one note high",
  },
  {
    id: "steady_low",
    glyph: "↘",
    label: "Steady to low (flow less)",
  },
];

/** @type {Map<string, { id: string, glyph: string, label: string, kind?: string }>} */
const notationSymbolById = new Map(
  NOTATION_SYMBOLS.map((entry) => [entry.id, entry])
);

/** @type {number | null} */
let symbolPickerRow = null;

/** @type {HTMLButtonElement | null} */
let symbolPickerAnchor = null;

/** @type {number | null} */
let blowLongerEditSpanIndex = null;

/** @type {number | null} */
let blowLongerDialogAnchorRow = null;

/** Copied section tab data (grid, symbols, blow-longer). */
/** @type {{ rows: number, grid: number[][], rowSymbols: string[], blowLonger: { start: number, end: number }[] } | null} */
let sectionClipboard = null;

function createEmptyGrid(rows) {
  return Array.from({ length: rows }, () => Array(COLS).fill(0));
}

function createEmptyRowSymbols(rows) {
  return Array.from({ length: rows }, () => "");
}

function getNotationSymbol(id) {
  return notationSymbolById.get(id) ?? null;
}

function isSimpleRowSymbolId(id) {
  return Boolean(id) && id !== "blow_longer" && notationSymbolById.has(id);
}

/** Default row symbol when the notation slot beside the holes is left blank on save. */
const DEFAULT_BLANK_ROW_SYMBOL_ID = "short_hold";

function fillBlankRowSymbols(symbols, rows, spans = []) {
  return Array.from({ length: rows }, (_, i) => {
    if (getBlowLongerRole(i, spans)) return "";
    const id = symbols[i];
    return isSimpleRowSymbolId(id) ? id : DEFAULT_BLANK_ROW_SYMBOL_ID;
  });
}

function applyDefaultRowSymbolsToSection(section) {
  const rows = section.rows ?? section.grid?.length ?? 0;
  if (!rows) return section;

  const spans = normalizeBlowLongerSpans(section, rows);
  const symbols = normalizeRowSymbols(section, rows);
  section.rowSymbols = fillBlankRowSymbols(symbols, rows, spans);
  return section;
}

function applyDefaultRowSymbolsToSong(song) {
  for (const section of song.sections) {
    applyDefaultRowSymbolsToSection(section);
  }

  const current = song.sections.find((s) => s.id === activeSectionId);
  if (current) {
    rowSymbols = current.rowSymbols.slice(0, rowCount);
    buildSheet();
  }
}

function getBlowLongerRole(rowIndex, spans = blowLongerSpans) {
  for (const span of spans) {
    if (rowIndex < span.start || rowIndex > span.end) continue;
    if (span.start === span.end) return "single";
    if (rowIndex === span.start) return "start";
    if (rowIndex === span.end) return "end";
    return "mid";
  }
  return null;
}

function findBlowLongerSpanIndexAtRow(rowIndex, spans = blowLongerSpans) {
  return spans.findIndex(
    (span) => rowIndex >= span.start && rowIndex <= span.end
  );
}

function normalizeBlowLongerSpans(section, rows) {
  /** @type {{ start: number, end: number }[]} */
  const spans = [];
  const raw = section.blowLonger;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      let start = Number(item.start);
      let end = Number(item.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      start = Math.max(0, Math.min(rows - 1, Math.floor(start)));
      end = Math.max(0, Math.min(rows - 1, Math.floor(end)));
      if (end < start) [start, end] = [end, start];
      spans.push({ start, end });
    }
  }

  const symbols = section.rowSymbols;
  if (Array.isArray(symbols)) {
    symbols.forEach((id, i) => {
      if (i >= rows || id !== "blow_longer") return;
      if (!spans.some((s) => i >= s.start && i <= s.end)) {
        spans.push({ start: i, end: i });
      }
    });
  }

  return mergeBlowLongerSpans(spans);
}

function mergeBlowLongerSpans(spans) {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  /** @type {{ start: number, end: number }[]} */
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= prev.end + 1) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }

  return merged;
}

function clearRowSymbolsInBlowLongerSpans() {
  for (const span of blowLongerSpans) {
    for (let r = span.start; r <= span.end; r++) {
      rowSymbols[r] = "";
    }
  }
}

function createBlowLongerMark(rowIndex, { readonly = false, spans = blowLongerSpans } = {}) {
  const role = getBlowLongerRole(rowIndex, spans);
  if (!role) return null;

  if (readonly) {
    const cell = document.createElement("span");
    cell.className = `blow-longer-cell blow-longer-cell--${role} blow-longer-cell--readonly`;
    cell.setAttribute("aria-hidden", "true");
    if (role === "start" || role === "single") {
      const dash = document.createElement("span");
      dash.className = "blow-longer-dash";
      dash.textContent = "—";
      cell.appendChild(dash);
    }
    return cell;
  }

  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = `blow-longer-cell blow-longer-cell--${role}`;
  const span = spans[findBlowLongerSpanIndexAtRow(rowIndex, spans)];
  cell.setAttribute(
    "aria-label",
    `Blow longer rows ${span.start + 1}–${span.end + 1}. Click to edit.`
  );
  cell.title = `Blow longer: rows ${span.start + 1}–${span.end + 1}`;

  if (role === "start" || role === "single") {
    const dash = document.createElement("span");
    dash.className = "blow-longer-dash";
    dash.textContent = "—";
    cell.appendChild(dash);
  }

  cell.addEventListener("click", (event) => {
    event.stopPropagation();
    const idx = findBlowLongerSpanIndexAtRow(rowIndex);
    openBlowLongerDialog(rowIndex, idx !== -1 ? idx : null);
  });

  return cell;
}

function populateBlowLongerRowSelects() {
  blowLongerStartEl.innerHTML = "";
  blowLongerEndEl.innerHTML = "";

  for (let r = 0; r < rowCount; r++) {
    const startOpt = document.createElement("option");
    startOpt.value = String(r);
    startOpt.textContent = String(r + 1);
    blowLongerStartEl.appendChild(startOpt);

    const endOpt = document.createElement("option");
    endOpt.value = String(r);
    endOpt.textContent = String(r + 1);
    blowLongerEndEl.appendChild(endOpt);
  }
}

function getBlowLongerDialogRange() {
  let start = Number(blowLongerStartEl.value);
  let end = Number(blowLongerEndEl.value);
  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end)) end = start;
  if (end < start) end = start;
  return { start, end };
}

function renderBlowLongerPreview() {
  const { start, end } = getBlowLongerDialogRange();
  blowLongerPreviewEl.innerHTML = "";

  for (let r = start; r <= end; r++) {
    const row = document.createElement("div");
    row.className = "blow-longer-preview__row";

    const num = document.createElement("span");
    num.className = "blow-longer-preview__num";
    num.textContent = String(r + 1);

    const mark = document.createElement("span");
    mark.className = "blow-longer-preview__mark";

    let role = "mid";
    if (start === end) role = "single";
    else if (r === start) role = "start";
    else if (r === end) role = "end";

    const cell = document.createElement("span");
    cell.className = `blow-longer-cell blow-longer-cell--${role} blow-longer-cell--readonly`;
    if (role === "start" || role === "single") {
      const dash = document.createElement("span");
      dash.className = "blow-longer-dash";
      dash.textContent = "—";
      cell.appendChild(dash);
    }
    mark.appendChild(cell);

    row.append(num, mark);
    blowLongerPreviewEl.appendChild(row);
  }
}

function syncBlowLongerEndOptions() {
  const start = Number(blowLongerStartEl.value);
  const options = blowLongerEndEl.querySelectorAll("option");
  options.forEach((opt) => {
    const row = Number(opt.value);
    opt.hidden = row < start;
    opt.disabled = row < start;
  });
  if (Number(blowLongerEndEl.value) < start) {
    blowLongerEndEl.value = String(start);
  }
  renderBlowLongerPreview();
}

function openBlowLongerDialog(anchorRow, spanIndex = null) {
  blowLongerDialogAnchorRow = anchorRow;
  blowLongerEditSpanIndex = spanIndex;

  populateBlowLongerRowSelects();

  let start = anchorRow;
  let end = Math.min(rowCount - 1, anchorRow + 3);

  if (spanIndex !== null && blowLongerSpans[spanIndex]) {
    start = blowLongerSpans[spanIndex].start;
    end = blowLongerSpans[spanIndex].end;
    blowLongerRemoveBtn.hidden = false;
  } else {
    blowLongerRemoveBtn.hidden = true;
  }

  blowLongerStartEl.value = String(start);
  blowLongerEndEl.value = String(end);
  syncBlowLongerEndOptions();

  blowLongerDialogEl.returnValue = "";
  blowLongerDialogEl.showModal();
}

function applyBlowLongerSpan(start, end) {
  if (end < start) [start, end] = [end, start];

  if (blowLongerEditSpanIndex !== null) {
    blowLongerSpans.splice(blowLongerEditSpanIndex, 1);
  }

  blowLongerSpans = blowLongerSpans.filter(
    (span) => end < span.start || start > span.end
  );

  blowLongerSpans.push({ start, end });
  blowLongerSpans = mergeBlowLongerSpans(blowLongerSpans);

  clearRowSymbolsInBlowLongerSpans();
  buildSheet();
  persistCurrentSectionToSong();
  setStatus(
    `Blow longer: row ${start + 1} (dash) down to row ${end + 1}`,
    "ok"
  );
}

function removeBlowLongerSpanAtIndex(spanIndex) {
  if (spanIndex === null || spanIndex < 0 || !blowLongerSpans[spanIndex]) return;
  blowLongerSpans.splice(spanIndex, 1);
  buildSheet();
  persistCurrentSectionToSong();
  setStatus("Removed blow longer", "ok");
}

function syncBlowLongerSpansAfterRowCountChange() {
  blowLongerSpans = blowLongerSpans
    .map((span) => ({
      start: Math.min(span.start, rowCount - 1),
      end: Math.min(span.end, rowCount - 1),
    }))
    .filter((span) => span.start <= span.end && span.start >= 0);
}

function renderSymbolGlyph(symbol, { compact = false } = {}) {
  if (!symbol) return "";
  if (symbol.kind === "more_air") {
    const cls = compact ? "row-symbol-btn__more-air" : "notation-rules__symbol--more-air";
    return `<span class="${cls} notation-rules__symbol"><span class="notation-bar">‾</span><span>·</span></span>`;
  }
  return symbol.glyph;
}

function updateRowSymbolButton(button, symbolId) {
  const id = isSimpleRowSymbolId(symbolId) ? symbolId : "";
  const symbol = getNotationSymbol(id);
  if (symbol) {
    button.classList.add("row-symbol-btn--set");
    button.innerHTML = renderSymbolGlyph(symbol, { compact: true });
    button.setAttribute("aria-label", `Row symbol: ${symbol.label}. Click to change.`);
    button.title = symbol.label;
  } else {
    button.classList.remove("row-symbol-btn--set");
    button.textContent = "+";
    button.setAttribute("aria-label", "Add row symbol");
    button.title = "Add notation symbol";
  }
}

function createRowLeading(
  rowIndex,
  { readonly = false, symbolId = "", blowLongerSpans: spans = blowLongerSpans } = {}
) {
  const leading = document.createElement("div");
  leading.className = "row-leading";

  const blowMark = createBlowLongerMark(rowIndex, { readonly, spans });
  if (blowMark) {
    leading.appendChild(blowMark);
  } else if (readonly) {
    const symbolSpan = document.createElement("span");
    symbolSpan.className = "row-symbol-readonly";
    const symbol = isSimpleRowSymbolId(symbolId)
      ? getNotationSymbol(symbolId)
      : null;
    if (symbol) {
      symbolSpan.innerHTML = renderSymbolGlyph(symbol, { compact: true });
      symbolSpan.title = symbol.label;
    }
    leading.appendChild(symbolSpan);
  } else {
    const symbolBtn = document.createElement("button");
    symbolBtn.type = "button";
    symbolBtn.className = "row-symbol-btn";
    symbolBtn.dataset.row = String(rowIndex);
    updateRowSymbolButton(symbolBtn, rowSymbols[rowIndex] || "");
    symbolBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openSymbolPicker(rowIndex, symbolBtn);
    });
    leading.appendChild(symbolBtn);
  }

  const label = document.createElement("span");
  label.className = "row-label";
  label.textContent = String(rowIndex + 1);
  leading.appendChild(label);

  return leading;
}

function renderNotationRulesList() {
  if (!notationRulesListEl) return;

  notationRulesListEl.innerHTML = "";

  for (const entry of NOTATION_SYMBOLS) {
    const li = document.createElement("li");
    li.className = "notation-rules__item";

    const symbolSpan = document.createElement("span");
    symbolSpan.className = "notation-rules__symbol";
    if (entry.kind === "more_air") {
      symbolSpan.innerHTML = renderSymbolGlyph(entry);
    } else {
      symbolSpan.textContent = entry.glyph;
    }

    const desc = document.createElement("span");
    desc.className = "notation-rules__desc";
    desc.textContent = entry.label;

    li.append(symbolSpan, desc);
    notationRulesListEl.appendChild(li);
  }
}

function buildSymbolPickerMenu() {
  symbolPickerEl.innerHTML = "";

  for (const entry of NOTATION_SYMBOLS) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "symbol-picker__option";
    option.setAttribute("role", "menuitem");
    option.dataset.symbolId = entry.id;

    const glyph = document.createElement("span");
    glyph.className = "symbol-picker__glyph";
    if (entry.kind === "more_air") {
      glyph.innerHTML = '<span class="row-symbol-btn__more-air"><span class="notation-bar">‾</span><span>·</span></span>';
    } else {
      glyph.textContent = entry.glyph;
    }

    const label = document.createElement("span");
    label.className = "symbol-picker__label";
    label.textContent = entry.label;

    option.append(glyph, label);
    option.addEventListener("click", () => {
      const row = symbolPickerRow;
      closeSymbolPicker();
      if (entry.id === "blow_longer") {
        openBlowLongerDialog(row ?? 0, findBlowLongerSpanIndexAtRow(row ?? 0));
      } else {
        setRowSymbol(row, entry.id);
      }
    });
    symbolPickerEl.appendChild(option);
  }

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "symbol-picker__option symbol-picker__clear";
  clearBtn.setAttribute("role", "menuitem");
  clearBtn.textContent = "Clear symbol";
  clearBtn.addEventListener("click", () => {
    setRowSymbol(symbolPickerRow, "");
    closeSymbolPicker();
  });
  symbolPickerEl.appendChild(clearBtn);
}

function positionSymbolPicker(anchor) {
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  symbolPickerEl.hidden = false;

  const pickerRect = symbolPickerEl.getBoundingClientRect();
  let top = rect.bottom + margin;
  let left = rect.left;

  if (top + pickerRect.height > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - pickerRect.height - margin);
  }
  if (left + pickerRect.width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - pickerRect.width - margin);
  }

  symbolPickerEl.style.top = `${top}px`;
  symbolPickerEl.style.left = `${left}px`;
}

function openSymbolPicker(rowIndex, anchor) {
  symbolPickerRow = rowIndex;
  symbolPickerAnchor = anchor;
  symbolPickerEl.hidden = false;
  positionSymbolPicker(anchor);
}

function closeSymbolPicker() {
  symbolPickerEl.hidden = true;
  symbolPickerRow = null;
  symbolPickerAnchor = null;
}

function setRowSymbol(rowIndex, symbolId) {
  if (rowIndex === null || rowIndex < 0 || rowIndex >= rowCount) return;

  if (symbolId && symbolId !== "blow_longer") {
    const spanIdx = findBlowLongerSpanIndexAtRow(rowIndex);
    if (spanIdx !== -1) {
      blowLongerSpans.splice(spanIdx, 1);
    }
  }

  rowSymbols[rowIndex] = isSimpleRowSymbolId(symbolId) ? symbolId : "";
  buildSheet();
  persistCurrentSectionToSong();

  const symbol = getNotationSymbol(rowSymbols[rowIndex]);
  if (symbol) {
    setStatus(`Row ${rowIndex + 1}: ${symbol.label}`, "ok");
  }
}

function syncRowSymbolsLength(rows) {
  if (rowSymbols.length < rows) {
    rowSymbols.push(...createEmptyRowSymbols(rows - rowSymbols.length));
  } else if (rowSymbols.length > rows) {
    rowSymbols = rowSymbols.slice(0, rows);
  }
}

function holeKey(row, col) {
  return `${row},${col}`;
}

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = kind ? `status--${kind}` : "";
}

function holeClass(value) {
  if (value === 1) return "hole hole--full";
  if (value === 9) return "hole hole--half";
  return "hole";
}

function stateLabel(value) {
  if (value === 1) return "full";
  if (value === 9) return "half";
  return "hollow";
}

function updateHoleButton(button, value) {
  button.className = holeClass(value);
  const r = Number(button.dataset.row) + 1;
  const c = Number(button.dataset.col) + 1;
  button.setAttribute("aria-label", `Row ${r}, hole ${c}, ${stateLabel(value)}`);
}

function updateRowCountLabel() {
  rowCountLabelEl.textContent = `${rowCount} row${rowCount === 1 ? "" : "s"} × ${COLS} holes`;
}

function buildSheet() {
  sheetEl.innerHTML = "";
  holeButtons.clear();

  for (let r = 0; r < rowCount; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "sheet-row";
    rowEl.dataset.rowIndex = String(r);

    rowEl.appendChild(
      createRowLeading(r, { symbolId: rowSymbols[r] || "" })
    );

    for (let c = 0; c < COLS; c++) {
      const hole = document.createElement("button");
      hole.type = "button";
      hole.className = holeClass(grid[r][c]);
      hole.setAttribute(
        "aria-label",
        `Row ${r + 1}, hole ${c + 1}, ${stateLabel(grid[r][c])}`
      );
      hole.dataset.row = String(r);
      hole.dataset.col = String(c);
      holeButtons.set(holeKey(r, c), hole);
      rowEl.appendChild(hole);
    }

    sheetEl.appendChild(rowEl);
  }

  updateRowCountLabel();
}

function syncSheetFromGrid() {
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < COLS; c++) {
      const button = holeButtons.get(holeKey(r, c));
      if (button) updateHoleButton(button, grid[r][c]);
    }
  }
}

function applySingleClick(row, col) {
  const value = grid[row][col];
  grid[row][col] = value === 0 ? 1 : 0;
  const button = holeButtons.get(holeKey(row, col));
  if (button) updateHoleButton(button, grid[row][col]);
}

function applyDoubleClick(row, col) {
  const value = grid[row][col];
  grid[row][col] = value === 0 || value === 1 ? 9 : 0;
  const button = holeButtons.get(holeKey(row, col));
  if (button) updateHoleButton(button, grid[row][col]);
}

/** @type {Map<string, number>} */
const clickTimers = new Map();

sheetEl.addEventListener("click", (event) => {
  const hole = event.target.closest(".hole");
  if (!hole) return;
  event.preventDefault();

  const row = Number(hole.dataset.row);
  const col = Number(hole.dataset.col);
  const key = holeKey(row, col);

  if (clickTimers.has(key)) {
    window.clearTimeout(clickTimers.get(key));
    clickTimers.delete(key);
    return;
  }

  const timer = window.setTimeout(() => {
    clickTimers.delete(key);
    applySingleClick(row, col);
  }, DOUBLE_CLICK_MS);

  clickTimers.set(key, timer);
});

sheetEl.addEventListener("dblclick", (event) => {
  const hole = event.target.closest(".hole");
  if (!hole) return;
  event.preventDefault();

  const row = Number(hole.dataset.row);
  const col = Number(hole.dataset.col);
  const key = holeKey(row, col);

  if (clickTimers.has(key)) {
    window.clearTimeout(clickTimers.get(key));
    clickTimers.delete(key);
  }

  applyDoubleClick(row, col);
});

function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatFilenameDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "-" +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function sanitizeFilename(name) {
  const base = (name || "song").trim().replace(/[<>:"/\\|?*]+/g, "-");
  return base.slice(0, 80) || "song";
}

function resolveSongName(raw = songNameEl.value) {
  const trimmed = String(raw ?? "").trim();
  return trimmed || DEFAULT_SONG_NAME;
}

/** Apply song name from the field; fill the input when it was left blank. */
function applySongNameFromField({ fillInput = false } = {}) {
  const name = resolveSongName();
  if (fillInput && !songNameEl.value.trim()) {
    songNameEl.value = name;
  }
  if (activeSong) {
    activeSong.name = name;
  }
  return name;
}

function sectionDisplayLabel(section) {
  if (section.label) return section.label;
  if (section.type === "verse" && section.number) {
    return `Verse ${section.number}`;
  }
  return SECTION_TYPE_LABELS[section.type] || section.type;
}

function nextVerseNumber(sections) {
  const verses = sections.filter((s) => s.type === "verse");
  if (verses.length === 0) return 1;
  return Math.max(...verses.map((s) => s.number || 0)) + 1;
}

function createSection(type, sections) {
  const number = type === "verse" ? nextVerseNumber(sections) : null;
  const label =
    type === "verse"
      ? `Verse ${number}`
      : SECTION_TYPE_LABELS[type] || type;

  return {
    id: generateId("section"),
    type,
    number,
    label,
    rows: DEFAULT_ROWS,
    grid: createEmptyGrid(DEFAULT_ROWS),
    rowSymbols: createEmptyRowSymbols(DEFAULT_ROWS),
    blowLonger: [],
  };
}

function cloneSectionTabData(section) {
  const rows = section.rows ?? section.grid.length;
  return {
    rows,
    grid: section.grid.map((row) => [...row]),
    rowSymbols: normalizeRowSymbols(section, rows),
    blowLonger: normalizeBlowLongerSpans(section, rows).map((span) => ({ ...span })),
  };
}

function createSectionFromTabData(type, sections, data) {
  const number = type === "verse" ? nextVerseNumber(sections) : null;
  const label =
    type === "verse"
      ? `Verse ${number}`
      : SECTION_TYPE_LABELS[type] || type;

  return {
    id: generateId("section"),
    type,
    number,
    label,
    rows: data.rows,
    grid: data.grid.map((row) => [...row]),
    rowSymbols: data.rowSymbols.slice(),
    blowLonger: data.blowLonger.map((span) => ({ ...span })),
  };
}

function updateSectionPasteUi() {
  btnPasteSection.disabled = !sectionClipboard;
}

function copySection() {
  if (!activeSong) {
    setStatus("No song open", "error");
    return;
  }

  persistCurrentSectionToSong();
  const section = getActiveSection();
  if (!section) return;

  sectionClipboard = cloneSectionTabData(section);
  updateSectionPasteUi();
  setStatus(`Copied ${sectionDisplayLabel(section)}`, "ok");
}

function pasteSection() {
  if (!sectionClipboard) {
    setStatus("Copy a section first", "error");
    return;
  }

  if (!activeSong) {
    newSong();
  }

  persistCurrentSectionToSong();

  const type = sectionTypeAddEl.value;
  const section = createSectionFromTabData(
    type,
    activeSong.sections,
    sectionClipboard
  );

  const index = activeSong.sections.findIndex((s) => s.id === activeSectionId);
  const insertAt = index >= 0 ? index + 1 : activeSong.sections.length;
  activeSong.sections.splice(insertAt, 0, section);

  loadSectionIntoEditor(section);
  renderSectionSelect();
  renderSongList();
  setStatus(`Pasted as ${sectionDisplayLabel(section)}`, "ok");
}

function createEmptySong(name) {
  const now = new Date().toISOString();
  const intro = createSection("intro", []);
  return {
    version: FORMAT_VERSION,
    id: generateId("song"),
    name: name || DEFAULT_SONG_NAME,
    createdAt: now,
    updatedAt: now,
    columns: COLS,
    sections: [intro],
  };
}

function validateGridData(gridData, rows) {
  if (!gridData || !Array.isArray(gridData)) return false;
  if (gridData.length !== rows) return false;
  return gridData.every(
    (row) =>
      Array.isArray(row) &&
      row.length === COLS &&
      row.every((cell) => cell === 0 || cell === 1 || cell === 9)
  );
}

function validateSection(section) {
  if (!section || typeof section !== "object") return false;
  const rows = section.rows ?? section.grid?.length;
  if (!rows || rows < MIN_ROWS) return false;
  return validateGridData(section.grid, rows);
}

function validateSong(song) {
  if (!song || !Array.isArray(song.sections) || song.sections.length === 0) {
    return false;
  }
  return song.sections.every(validateSection);
}

function normalizeRowSymbols(section, rows) {
  const raw = section.rowSymbols;
  if (!Array.isArray(raw)) return createEmptyRowSymbols(rows);
  return Array.from({ length: rows }, (_, i) => {
    const id = raw[i];
    return isSimpleRowSymbolId(id) ? id : "";
  });
}

function normalizeSection(section) {
  const rows = section.rows ?? section.grid.length;
  return {
    id: section.id || generateId("section"),
    type: section.type || "score",
    number: section.number ?? null,
    label: section.label || sectionDisplayLabel(section),
    rows,
    grid: section.grid.map((row) => [...row]),
    rowSymbols: normalizeRowSymbols(section, rows),
    blowLonger: normalizeBlowLongerSpans(section, rows),
  };
}

function normalizeSong(raw, fallbackName) {
  if (raw.sections && Array.isArray(raw.sections)) {
    return {
      version: FORMAT_VERSION,
      id: raw.id || generateId("song"),
      name: raw.name || fallbackName || DEFAULT_SONG_NAME,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
      columns: COLS,
      sections: raw.sections.map(normalizeSection),
    };
  }

  if (raw.grid && Array.isArray(raw.grid)) {
    const rows = raw.rows ?? raw.grid.length;
    return {
      version: FORMAT_VERSION,
      id: raw.id || generateId("song"),
      name: raw.name || fallbackName || DEFAULT_SONG_NAME,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      columns: COLS,
      sections: [
        normalizeSection({
          id: generateId("section"),
          type: "score",
          label: "Score",
          rows,
          grid: raw.grid,
          rowSymbols: createEmptyRowSymbols(rows),
        }),
      ],
    };
  }

  return null;
}

function migrateLibraryItem(item) {
  if (item.sections) return item;
  return normalizeSong(item, item.name);
}

function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateLibraryItem).filter(Boolean);
  } catch {
    return [];
  }
}

function persistLibrary(songs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

function getActiveSection() {
  if (!activeSong) return null;
  return activeSong.sections.find((s) => s.id === activeSectionId) ?? null;
}

function persistCurrentSectionToSong() {
  const section = getActiveSection();
  if (!section || !activeSong) return;

  section.rows = rowCount;
  section.grid = grid.map((row) => [...row]);
  syncRowSymbolsLength(rowCount);
  section.rowSymbols = rowSymbols.slice(0, rowCount);
  section.blowLonger = blowLongerSpans.map((span) => ({ ...span }));
  applySongNameFromField();
  activeSong.updatedAt = new Date().toISOString();
}

function loadSectionIntoEditor(section) {
  rowCount = section.rows;
  grid = section.grid.map((row) => [...row]);
  rowSymbols = normalizeRowSymbols(section, rowCount);
  blowLongerSpans = normalizeBlowLongerSpans(section, rowCount).map((span) => ({
    ...span,
  }));
  activeSectionId = section.id;
  buildSheet();
}

function renderSectionSelect() {
  sectionSelectEl.innerHTML = "";

  if (!activeSong || activeSong.sections.length === 0) {
    sectionSelectEl.disabled = true;
    btnDeleteSection.disabled = true;
    return;
  }

  sectionSelectEl.disabled = false;
  btnDeleteSection.disabled = activeSong.sections.length <= 1;

  for (const section of activeSong.sections) {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = sectionDisplayLabel(section);
    if (section.id === activeSectionId) option.selected = true;
    sectionSelectEl.appendChild(option);
  }
}

function cloneSong(song) {
  return {
    ...song,
    sections: song.sections.map((s) => {
      const rows = s.rows ?? s.grid.length;
      return {
        ...s,
        grid: s.grid.map((row) => [...row]),
        rowSymbols: normalizeRowSymbols(s, rows),
        blowLonger: normalizeBlowLongerSpans(s, rows).map((span) => ({ ...span })),
      };
    }),
  };
}

function getSongById(id) {
  return loadLibrary().find((s) => s.id === id) ?? null;
}

function buildReadonlySheet(container, section) {
  container.innerHTML = "";

  for (let r = 0; r < section.rows; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "sheet-row";

    const symbols = section.rowSymbols ?? createEmptyRowSymbols(section.rows);
    const spans = normalizeBlowLongerSpans(section, section.rows);
    rowEl.appendChild(
      createRowLeading(r, {
        readonly: true,
        symbolId: symbols[r] || "",
        blowLongerSpans: spans,
      })
    );

    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("span");
      cell.className = `hole-readonly ${holeClass(section.grid[r][c]).replace("hole ", "")}`;
      cell.setAttribute("aria-hidden", "true");
      rowEl.appendChild(cell);
    }

    container.appendChild(rowEl);
  }
}

function renderViewerSectionSelect() {
  viewerSectionSelectEl.innerHTML = "";

  if (!viewerSong) {
    viewerSectionSelectEl.disabled = true;
    return;
  }

  viewerSectionSelectEl.disabled = false;

  for (const section of viewerSong.sections) {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = sectionDisplayLabel(section);
    if (section.id === viewerSectionId) option.selected = true;
    viewerSectionSelectEl.appendChild(option);
  }
}

function showViewerSection(sectionId) {
  if (!viewerSong) return;

  const section = viewerSong.sections.find((s) => s.id === sectionId);
  if (!section) return;

  viewerSectionId = section.id;
  buildReadonlySheet(viewerSheetEl, section);
  renderViewerSectionSelect();
}

function showViewerAllSections() {
  if (!viewerSong) return;

  viewerAllEl.innerHTML = "";

  for (const section of viewerSong.sections) {
    const block = document.createElement("section");
    block.className = "viewer-section-block";

    const heading = document.createElement("h3");
    heading.className = "viewer-section-block__title";
    heading.textContent = sectionDisplayLabel(section);

    const sheet = document.createElement("div");
    sheet.className = "sheet sheet--readonly";
    sheet.setAttribute(
      "aria-label",
      `${sectionDisplayLabel(section)} read-only tab`
    );

    block.append(heading, sheet);
    viewerAllEl.appendChild(block);
    buildReadonlySheet(sheet, section);
  }
}

function applyViewerZoom() {
  const pct = Math.round(viewerZoom * 100);
  viewerZoomHostEl.style.setProperty("--viewer-zoom", String(viewerZoom));
  viewerZoomLabelEl.textContent = `${pct}%`;
  viewerZoomInEl.disabled = viewerZoom >= VIEWER_ZOOM_MAX;
  viewerZoomOutEl.disabled = viewerZoom <= VIEWER_ZOOM_MIN;
}

function setViewerZoom(next) {
  viewerZoom = Math.min(
    VIEWER_ZOOM_MAX,
    Math.max(VIEWER_ZOOM_MIN, Math.round(next / VIEWER_ZOOM_STEP) * VIEWER_ZOOM_STEP)
  );
  applyViewerZoom();
}

function resetViewerZoom() {
  viewerZoom = VIEWER_ZOOM_DEFAULT;
  applyViewerZoom();
}

/** Shrink zoom in “all sections” view so every column fits the panel width when possible. */
function fitViewerZoomToAllSections() {
  if (viewerMode !== "all") return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      viewerZoom = VIEWER_ZOOM_DEFAULT;
      applyViewerZoom();

      const available = viewerPanelBodyEl.clientWidth - 12;
      const content = viewerAllEl.scrollWidth;
      if (content <= 0 || available <= 0 || content <= available) return;

      const raw = available / content;
      setViewerZoom(Math.max(VIEWER_ZOOM_MIN, raw));
    });
  });
}

function applyViewerModeUi() {
  const showAll = viewerMode === "all";

  viewerPanelBodyEl.classList.toggle("viewer-panel__body--all", showAll);
  viewerPanelBodyEl.classList.toggle("viewer-panel__body--single", !showAll);

  viewerSectionFieldEl.hidden = showAll;
  viewerSheetEl.hidden = showAll;
  viewerAllEl.hidden = !showAll;
}

function refreshViewerContent() {
  if (!viewerSong) return;

  applyViewerModeUi();

  if (viewerMode === "all") {
    viewerSheetEl.innerHTML = "";
    showViewerAllSections();
    fitViewerZoomToAllSections();
    return;
  }

  viewerAllEl.innerHTML = "";

  const sectionId =
    viewerSectionId ?? viewerSong.sections[0]?.id ?? null;
  if (sectionId) {
    showViewerSection(sectionId);
  }
}

function setViewerMode(mode) {
  viewerMode = mode === "all" ? "all" : "single";
  if (viewerModeSelectEl.value !== viewerMode) {
    viewerModeSelectEl.value = viewerMode;
  }
  refreshViewerContent();
}

function openSongViewer(song) {
  viewerSong = cloneSong(song);
  viewerSectionId = viewerSong.sections[0]?.id ?? null;
  viewerMode = "single";
  viewerModeSelectEl.value = viewerMode;
  resetViewerZoom();
  viewerTitleEl.textContent = viewerSong.name;
  viewerBtnEditEl.dataset.songId = song.id;

  renderViewerSectionSelect();
  refreshViewerContent();

  viewerPanelEl.hidden = false;
  document.body.classList.add("viewer-open");
  setStatus(`Viewing ${song.name}`, "ok");
}

function closeSongViewer() {
  viewerPanelEl.hidden = true;
  document.body.classList.remove("viewer-open");
  viewerSong = null;
  viewerSectionId = null;
  viewerMode = "single";
  viewerSheetEl.innerHTML = "";
  viewerAllEl.innerHTML = "";
  applyViewerModeUi();
}

function openSongViewerById(id) {
  const song = getSongById(id);
  if (!song) {
    setStatus("Song not found", "error");
    renderSongList();
    return;
  }
  openSongViewer(song);
}

async function confirmDelete(message) {
  deleteDialogMessageEl.textContent = message;
  deleteDialogEl.returnValue = "";
  deleteDialogEl.showModal();
  const result = await new Promise((resolve) => {
    deleteDialogEl.addEventListener(
      "close",
      () => resolve(deleteDialogEl.returnValue),
      { once: true }
    );
  });
  return result === "confirm";
}

async function confirmDeleteSong(song) {
  return confirmDelete(
    `Delete “${song.name}” from saved songs? This cannot be undone.`
  );
}

async function deleteSongById(id) {
  const song = getSongById(id);
  if (!song) {
    setStatus("Song not found", "error");
    renderSongList();
    return;
  }

  const confirmed = await confirmDeleteSong(song);
  if (!confirmed) return;

  const songs = loadLibrary().filter((s) => s.id !== id);
  persistLibrary(songs);

  if (viewerSong?.id === id) closeSongViewer();

  if (activeSongId === id) {
    activeSong = null;
    activeSongId = null;
    activeSectionId = null;
    songNameEl.value = "";
    rowCount = DEFAULT_ROWS;
    grid = createEmptyGrid(DEFAULT_ROWS);
    rowSymbols = createEmptyRowSymbols(DEFAULT_ROWS);
    blowLongerSpans = [];
    buildSheet();
    renderSectionSelect();
  }

  renderSongList();
  setStatus(`Deleted “${song.name}”`, "ok");
}

function renderSongList() {
  const songs = loadLibrary().sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
  );

  songListEl.innerHTML = "";

  if (songs.length === 0) {
    songListEmptyEl.hidden = false;
    return;
  }

  songListEmptyEl.hidden = true;

  for (const song of songs) {
    const li = document.createElement("li");
    const item = document.createElement("div");
    item.className = "tab-list__item";
    if (song.id === activeSongId) item.classList.add("tab-list__item--active");

    const name = document.createElement("span");
    name.className = "tab-list__name";
    name.textContent = song.name;

    const meta = document.createElement("span");
    meta.className = "tab-list__date";
    const sectionNames = song.sections.map(sectionDisplayLabel).join(", ");
    meta.textContent = `${song.sections.length} section(s): ${sectionNames}`;

    const actions = document.createElement("div");
    actions.className = "tab-list__actions";

    const btnView = document.createElement("button");
    btnView.type = "button";
    btnView.className = "btn btn-secondary btn-sm";
    btnView.textContent = "View";
    btnView.addEventListener("click", () => openSongViewerById(song.id));

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className = "btn btn-secondary btn-sm";
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", () => loadSongById(song.id));

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn btn-danger btn-sm";
    btnDelete.textContent = "Delete";
    btnDelete.addEventListener("click", () => deleteSongById(song.id));

    actions.append(btnView, btnEdit, btnDelete);
    item.append(name, meta, actions);
    li.appendChild(item);
    songListEl.appendChild(li);
  }
}

function loadSong(song) {
  closeSongViewer();
  activeSong = cloneSong(song);
  activeSongId = song.id;
  songNameEl.value = song.name;

  const first =
    activeSong.sections.find((s) => s.id === activeSectionId) ||
    activeSong.sections[0];

  loadSectionIntoEditor(first);
  renderSectionSelect();
  renderSongList();
  setStatus(`Opened ${song.name}`, "ok");
}

function loadSongById(id) {
  persistCurrentSectionToSong();

  const songs = loadLibrary();
  const song = songs.find((s) => s.id === id);
  if (!song) {
    setStatus("Song not found", "error");
    renderSongList();
    return;
  }

  loadSong(song);
}

function newSong() {
  activeSong = createEmptySong("");
  activeSongId = activeSong.id;
  activeSectionId = activeSong.sections[0].id;
  songNameEl.value = "";
  loadSectionIntoEditor(activeSong.sections[0]);
  renderSectionSelect();
  renderSongList();
  setStatus("New song created", "ok");
}

function switchSection(sectionId) {
  if (!activeSong || sectionId === activeSectionId) return;

  persistCurrentSectionToSong();

  const section = activeSong.sections.find((s) => s.id === sectionId);
  if (!section) return;

  loadSectionIntoEditor(section);
  renderSectionSelect();
  setStatus(`Editing ${sectionDisplayLabel(section)}`, "ok");
}

function addSection() {
  if (!activeSong) {
    newSong();
  }

  persistCurrentSectionToSong();

  const type = sectionTypeAddEl.value;
  const section = createSection(type, activeSong.sections);
  activeSong.sections.push(section);
  loadSectionIntoEditor(section);
  renderSectionSelect();
  renderSongList();
  setStatus(`Added ${sectionDisplayLabel(section)}`, "ok");
}

async function deleteSection() {
  if (!activeSong) {
    setStatus("No song open", "error");
    return;
  }

  if (activeSong.sections.length <= 1) {
    setStatus("Need at least one section", "error");
    return;
  }

  const section = getActiveSection();
  if (!section) return;

  const label = sectionDisplayLabel(section);
  const confirmed = await confirmDelete(
    `Delete “${label}” from this song? This cannot be undone.`
  );
  if (!confirmed) return;

  persistCurrentSectionToSong();

  const index = activeSong.sections.findIndex((s) => s.id === section.id);
  if (index === -1) return;

  activeSong.sections.splice(index, 1);

  const next =
    activeSong.sections[Math.min(index, activeSong.sections.length - 1)];
  loadSectionIntoEditor(next);
  renderSectionSelect();
  renderSongList();
  setStatus(`Deleted ${label}`, "ok");
}

function addRow() {
  grid.push(Array(COLS).fill(0));
  rowCount += 1;

  const rowEl = document.createElement("div");
  rowEl.className = "sheet-row";
  const r = rowCount - 1;

  rowSymbols.push("");
  syncBlowLongerSpansAfterRowCountChange();
  rowEl.appendChild(createRowLeading(r));

  for (let c = 0; c < COLS; c++) {
    const hole = document.createElement("button");
    hole.type = "button";
    hole.className = holeClass(0);
    hole.setAttribute("aria-label", `Row ${r + 1}, hole ${c + 1}, hollow`);
    hole.dataset.row = String(r);
    hole.dataset.col = String(c);
    holeButtons.set(holeKey(r, c), hole);
    rowEl.appendChild(hole);
  }

  sheetEl.appendChild(rowEl);
  updateRowCountLabel();
  persistCurrentSectionToSong();
}

function removeRow() {
  if (rowCount <= MIN_ROWS) {
    setStatus("Need at least one row", "error");
    return;
  }

  grid.pop();
  rowSymbols.pop();
  rowCount -= 1;
  syncBlowLongerSpansAfterRowCountChange();

  const rows = sheetEl.querySelectorAll(".sheet-row");
  rows[rows.length - 1]?.remove();

  for (let c = 0; c < COLS; c++) {
    holeButtons.delete(holeKey(rowCount, c));
  }

  updateRowCountLabel();
  persistCurrentSectionToSong();
  setStatus("Removed last row", "ok");
}

function buildSongExportPayload() {
  persistCurrentSectionToSong();
  if (!activeSong) return null;

  applyDefaultRowSymbolsToSong(activeSong);

  return {
    version: FORMAT_VERSION,
    id: activeSong.id,
    name: activeSong.name,
    createdAt: activeSong.createdAt,
    updatedAt: activeSong.updatedAt,
    columns: COLS,
    sections: activeSong.sections.map((s) => ({
      id: s.id,
      type: s.type,
      number: s.number,
      label: s.label,
      rows: s.rows,
      grid: s.grid.map((row) => [...row]),
      rowSymbols: normalizeRowSymbols(s, s.rows),
      blowLonger: normalizeBlowLongerSpans(s, s.rows).map((span) => ({ ...span })),
    })),
  };
}

function prepareSongPayload() {
  if (!activeSong) {
    activeSong = createEmptySong(resolveSongName());
    activeSongId = activeSong.id;
    activeSectionId = activeSong.sections[0].id;
    persistCurrentSectionToSong();
  }

  applySongNameFromField({ fillInput: true });

  if (!validateSong(activeSong)) {
    setStatus("Cannot save: invalid grid in one or more sections", "error");
    return null;
  }

  return buildSongExportPayload();
}

function saveSongLocally() {
  const payload = prepareSongPayload();
  if (!payload) return;

  const songs = loadLibrary();
  const index = songs.findIndex((s) => s.id === activeSongId);

  if (index !== -1) {
    songs[index] = payload;
  } else {
    songs.unshift(payload);
    activeSongId = payload.id;
  }

  activeSong = {
    ...payload,
    sections: payload.sections.map((s) => ({
      ...s,
      grid: s.grid.map((row) => [...row]),
    })),
  };

  persistLibrary(songs);
  renderSongList();
  setStatus(
    `Saved locally: “${payload.name}” (${payload.sections.length} sections)`,
    "ok"
  );
}

function exportSongAsJson() {
  const payload = prepareSongPayload();
  if (!payload) return;

  const now = new Date();
  const filename = `${sanitizeFilename(payload.name)}-${formatFilenameDate(now)}.json`;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  setStatus(`Exported “${payload.name}” as JSON`, "ok");
}

function importSongFromPayload(payload, fallbackName) {
  const song = normalizeSong(payload, fallbackName);
  if (!song || !validateSong(song)) {
    setStatus("Invalid song file: missing or bad sections", "error");
    return false;
  }

  const songs = loadLibrary();
  const existingIndex = songs.findIndex((s) => s.id === song.id);

  if (existingIndex !== -1) {
    songs[existingIndex] = song;
  } else {
    if (songs.some((s) => s.id === song.id)) {
      song.id = generateId("song");
    }
    songs.unshift(song);
  }

  persistLibrary(songs);
  loadSong(song);
  return true;
}

function openFile() {
  fileInput.click();
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result));
      const fallbackName = file.name.replace(/\.json$/i, "");
      if (importSongFromPayload(payload, fallbackName)) {
        setStatus(`Imported ${activeSong?.name}`, "ok");
      }
    } catch {
      setStatus("Could not read JSON file", "error");
    }
  };
  reader.readAsText(file);
}

btnNew.addEventListener("click", newSong);
btnOpen.addEventListener("click", openFile);
btnSaveLocal.addEventListener("click", saveSongLocally);
btnSaveJson.addEventListener("click", exportSongAsJson);
btnAddSection.addEventListener("click", addSection);
btnCopySection.addEventListener("click", copySection);
btnPasteSection.addEventListener("click", pasteSection);
btnDeleteSection.addEventListener("click", deleteSection);
btnAddRow.addEventListener("click", addRow);
btnRemoveRow.addEventListener("click", removeRow);

sectionSelectEl.addEventListener("change", () => {
  switchSection(sectionSelectEl.value);
});

songNameEl.addEventListener("blur", () => {
  applySongNameFromField({ fillInput: true });
  if (activeSong) renderSongList();
});

songNameEl.addEventListener("change", () => {
  applySongNameFromField({ fillInput: true });
  if (activeSong) renderSongList();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) importFromFile(file);
  fileInput.value = "";
});

viewerBtnCloseEl.addEventListener("click", closeSongViewer);

viewerBtnEditEl.addEventListener("click", () => {
  const id = viewerBtnEditEl.dataset.songId;
  if (id) {
    closeSongViewer();
    loadSongById(id);
  }
});

viewerModeSelectEl.addEventListener("change", () => {
  setViewerMode(viewerModeSelectEl.value);
});

viewerSectionSelectEl.addEventListener("change", () => {
  viewerMode = "single";
  viewerModeSelectEl.value = "single";
  applyViewerModeUi();
  showViewerSection(viewerSectionSelectEl.value);
});

viewerZoomInEl.addEventListener("click", () => {
  setViewerZoom(viewerZoom + VIEWER_ZOOM_STEP);
});

viewerZoomOutEl.addEventListener("click", () => {
  setViewerZoom(viewerZoom - VIEWER_ZOOM_STEP);
});

viewerZoomResetEl.addEventListener("click", resetViewerZoom);

viewerPanelEl.addEventListener("click", (event) => {
  if (event.target === viewerPanelEl) closeSongViewer();
});

blowLongerStartEl.addEventListener("change", syncBlowLongerEndOptions);
blowLongerEndEl.addEventListener("change", renderBlowLongerPreview);

blowLongerRemoveBtn.addEventListener("click", () => {
  if (blowLongerEditSpanIndex !== null) {
    removeBlowLongerSpanAtIndex(blowLongerEditSpanIndex);
  }
  blowLongerDialogEl.close("cancel");
});

blowLongerDialogEl.addEventListener("close", () => {
  if (blowLongerDialogEl.returnValue === "apply") {
    const { start, end } = getBlowLongerDialogRange();
    applyBlowLongerSpan(start, end);
  }
  blowLongerEditSpanIndex = null;
  blowLongerDialogAnchorRow = null;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!symbolPickerEl.hidden) {
      closeSymbolPicker();
      return;
    }
    if (viewerPanelEl.hidden === false) {
      closeSongViewer();
    }
  }
});

document.addEventListener("click", (event) => {
  if (symbolPickerEl.hidden) return;
  const target = event.target;
  if (
    symbolPickerEl.contains(target) ||
    symbolPickerAnchor?.contains(target)
  ) {
    return;
  }
  closeSymbolPicker();
});

window.addEventListener(
  "resize",
  () => {
    if (!symbolPickerEl.hidden && symbolPickerAnchor) {
      positionSymbolPicker(symbolPickerAnchor);
    }
  },
  { passive: true }
);

buildSymbolPickerMenu();
renderNotationRulesList();
buildSheet();
renderSongList();
updateSectionPasteUi();
applyViewerZoom();
setStatus("Ready");
