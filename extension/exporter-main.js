// SCCE – Skyway CALM Chrome Extension.
// Dieser Seitenkontext-Exporter kann über das Popup injiziert oder direkt in
// der Cloud-ALM-DevTools-Konsole ausgeführt werden.
(() => {
  'use strict';

  if (globalThis.__calmTestcaseExportRunning) {
    console.warn('[CALM Export] Läuft bereits. Abbrechen mit: __calmTestcaseExportCancel?.()');
    return;
  }

  const PAGE_SIZE = 100;
  const DETAIL_CONCURRENCY = 4;
  const DETAIL_RETRIES = 3;
  const SERVICE = '/ui/tmService-ui/v1/odata/v4/ManualTestCaseService/';
  const startedAt = performance.now();
  const state = { cancelled: false };
  globalThis.__calmTestcaseExportRunning = true;
  globalThis.__calmTestcaseExportCancel = () => { state.cancelled = true; };

  function findBinding() {
    const candidates = Object.values(sap.ui.core.Element.registry.all())
      .filter((control) => control.isA?.('sap.m.Table'))
      .map((table) => ({ table, binding: table.getBinding?.('items') }))
      .filter(({ binding }) => binding && Number(binding.getLength?.()) >= 0);
    const exact = candidates.find(({ table }) => /tableTCO/i.test(table.getId?.() || ''));
    const match = exact || candidates.sort((a, b) => Number(b.binding.getLength()) - Number(a.binding.getLength()))[0];
    if (!match) throw new Error('Keine Testfalltabelle gefunden. Skript bitte in Test Preparation ausführen.');
    return match.binding;
  }

  function makeProgress() {
    const box = document.createElement('div');
    box.id = 'calm-testcase-export-progress';
    box.style.cssText = [
      'position:fixed', 'right:24px', 'bottom:24px', 'z-index:2147483647',
      'width:390px', 'padding:16px 18px', 'border-radius:10px',
      'background:#1f2937', 'color:#f9fafb', 'font:14px/1.4 system-ui,sans-serif',
      'box-shadow:0 8px 30px #0006',
    ].join(';');
    box.innerHTML = '<div id="calm-export-title" style="font-weight:700;margin-bottom:8px">SAP Cloud ALM Export</div>'
      + '<div id="calm-export-phase">Wird vorbereitet …</div>'
      + '<div style="height:10px;background:#4b5563;border-radius:5px;margin:10px 0 7px;overflow:hidden">'
      + '<div id="calm-export-bar" style="height:100%;width:0;background:#60a5fa;transition:width .2s"></div></div>'
      + '<div id="calm-export-eta" style="color:#d1d5db;font-size:12px">Noch wird die Restzeit berechnet …</div>';
    document.body.appendChild(box);
    return {
      set(phase, done, total) {
        const elapsed = Math.max(0.001, (performance.now() - startedAt) / 1000);
        const fraction = total ? Math.min(1, done / total) : 0;
        const rate = done / elapsed;
        const remaining = rate > 0 ? Math.max(0, (total - done) / rate) : null;
        const eta = remaining == null ? 'Restzeit wird berechnet …'
          : remaining < 60 ? 'noch < 1 Minute'
            : `noch ca. ${Math.ceil(remaining / 60)} Minuten`;
        box.querySelector('#calm-export-phase').textContent = `${phase}: ${done} von ${total} gelesen`;
        box.querySelector('#calm-export-bar').style.width = `${Math.round(fraction * 100)}%`;
        box.querySelector('#calm-export-eta').textContent = eta;
      },
      done(message, failed = false) {
        box.querySelector('#calm-export-title').textContent = failed ? 'CALM Export fehlgeschlagen' : 'CALM Export fertig';
        box.querySelector('#calm-export-phase').textContent = message;
        box.querySelector('#calm-export-eta').textContent = failed ? 'Details stehen in der Konsole.' : 'Die Excel-Datei wurde heruntergeladen.';
        box.querySelector('#calm-export-bar').style.background = failed ? '#f87171' : '#34d399';
        if (!failed) box.querySelector('#calm-export-bar').style.width = '100%';
        setTimeout(() => box.remove(), failed ? 15000 : 8000);
      },
    };
  }

  const progress = makeProgress();
  function ensureRunning() {
    if (state.cancelled) throw new Error('Export vom Benutzer abgebrochen.');
  }
  function value(value) {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  function localDate(valueToFormat) {
    if (!valueToFormat) return '';
    const date = new Date(valueToFormat);
    return Number.isNaN(date.getTime()) ? value(valueToFormat) : date.toLocaleString('de-DE');
  }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  async function fetchJson(id) {
    const encoded = encodeURIComponent(id);
    const url = `${SERVICE}TestCases(${encoded})?$expand=tags`;
    let lastError = new Error('Keine Detailantwort erhalten.');
    for (let attempt = 1; attempt <= DETAIL_RETRIES; attempt += 1) {
      try {
        const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
        const json = await response.json();
        const hasTags = Object.prototype.hasOwnProperty.call(json, 'tags')
          || Object.prototype.hasOwnProperty.call(json?.manualtestcase || {}, 'tags');
        if (!hasTags) throw new Error('Detailantwort enthält kein tags-Feld. Export wird abgebrochen, damit kein Teil-Export entsteht.');
        return json;
      } catch (error) {
        lastError = error;
        if (attempt < DETAIL_RETRIES) await sleep(400 * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }

  async function readContexts(binding) {
    const total = Number(binding.getLength());
    if (!Number.isFinite(total) || total < 0) throw new Error(`Ungültige Trefferzahl: ${total}`);
    const rows = [];
    for (let start = 0; start < total;) {
      ensureRunning();
      const contexts = await binding.requestContexts(start, Math.min(PAGE_SIZE, total - start));
      if (!contexts.length) break;
      rows.push(...contexts.map((context) => context.getObject()));
      start += contexts.length;
      progress.set('Testfälle', rows.length, total);
      console.log(`[CALM Export] Testfälle: ${rows.length} / ${total}`);
    }
    if (rows.length !== total) throw new Error(`Nur ${rows.length} von ${total} Testfällen geladen.`);
    return { total, rows };
  }

  async function readDetails(rows) {
    const details = new Array(rows.length);
    const errors = [];
    let next = 0;
    let completed = 0;
    progress.set('Details', 0, rows.length);
    async function worker() {
      while (true) {
        ensureRunning();
        const index = next++;
        if (index >= rows.length) return;
        const rowId = rows[index]?.ID ?? rows[index]?.uuid ?? rows[index]?.UUID;
        try {
          if (!rowId) throw new Error('Testfall ohne UUID/ID in der Tabellenbindung.');
          details[index] = await fetchJson(rowId);
        } catch (error) {
          errors.push({ id: rowId, error: String(error?.message || error) });
          details[index] = null;
        }
        completed += 1;
        progress.set('Details', completed, rows.length);
        if (completed === 1 || completed % 10 === 0 || completed === rows.length) {
          console.log(`[CALM Export] Details: ${completed} / ${rows.length}`);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, rows.length) }, worker));
    return { details, errors };
  }

  function tags(detail) {
    const source = detail?.tags ?? detail?.manualtestcase?.tags;
    if (typeof source === 'string') return source;
    const list = Array.isArray(source) ? source
      : Array.isArray(source?.value) ? source.value
        : Array.isArray(source?.items) ? source.items : [];
    return [...new Set(list.map((tag) => tag?.tagLabel ?? tag?.tagName ?? tag?.label ?? tag?.name ?? '').filter(Boolean))].join(', ');
  }
  function firstValue(...values) {
    return values.find((item) => item !== undefined && item !== null && item !== '') ?? '';
  }
  const PRIORITY_LABELS = new Map([
    [10, '10 - Very High'],
    [20, '20 - High'],
    [30, '30 - Medium'],
    [40, '40 - Low'],
    [50, '50 - Very Low'],
  ]);
  const PRIORITY_TEXT = new Map([
    ['very high', '10 - Very High'], ['sehr hoch', '10 - Very High'],
    ['high', '20 - High'], ['hoch', '20 - High'],
    ['medium', '30 - Medium'], ['mittel', '30 - Medium'],
    ['low', '40 - Low'], ['niedrig', '40 - Low'],
    ['very low', '50 - Very Low'], ['sehr niedrig', '50 - Very Low'],
  ]);
  function normalizePriority(raw) {
    let candidate = raw;
    if (candidate && typeof candidate === 'object') {
      candidate = firstValue(candidate.id, candidate.ID, candidate.code, candidate.value, candidate.priorityId, candidate.priority, candidate.label, candidate.name, candidate.text);
    }
    const text = String(candidate ?? '').trim();
    if (!text) return '00 - Unknown';
    const numeric = Number(text.match(/\b(?:10|20|30|40|50)\b/)?.[0]);
    if (PRIORITY_LABELS.has(numeric)) return PRIORITY_LABELS.get(numeric);
    return PRIORITY_TEXT.get(text.toLowerCase()) || '00 - Unknown';
  }
  function firstPriority(...values) {
    for (const candidate of values) {
      const normalized = normalizePriority(candidate);
      if (normalized !== '00 - Unknown') return normalized;
    }
    return '00 - Unknown';
  }
  function outputRows(listRows, details) {
    return listRows.map((row, index) => {
      const detail = details[index] || {};
      return {
        'Testcase ID': firstValue(detail.displayId, row.displayId, detail.ID, detail.uuid, row.ID, row.uuid, row.UUID),
        'Testcase Title': firstValue(detail.title, row.title),
        'Testcase Tag': firstValue(tags(detail), tags(row)),
        'Last Changed By': firstValue(detail.modifiedBy, row.modifiedBy, detail.lastChangedBy, row.lastChangedBy, detail.changedBy, row.changedBy),
        'Last Change Time/Date': localDate(firstValue(detail.modifiedAt, row.modifiedAt, detail.lastChangedAt, row.lastChangedAt, detail.lastChangeTime, row.lastChangeTime, detail.lastChangeDateTime, row.lastChangeDateTime)),
        'Priority': firstPriority(
          detail.priority, row.priority,
          detail.priorityCode, row.priorityCode,
          detail.priorityId, row.priorityId,
          detail.manualtestcase?.priority, row.manualtestcase?.priority,
        ),
      };
    });
  }

  function xml(valueToEscape) {
    return value(valueToEscape).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function column(index) {
    let result = '';
    for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
    return result;
  }
  function sheetXml(rows) {
    const headers = ['Testcase ID', 'Testcase Title', 'Testcase Tag', 'Last Changed By', 'Last Change Time/Date', 'Priority'];
    const lastCell = `${column(headers.length - 1)}${rows.length + 1}`;
    const cell = (content, style, ref) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(content)}</t></is></c>`;
    const header = `<row r="1">${headers.map((x, i) => cell(x, 1, `${column(i)}1`)).join('')}</row>`;
    const body = rows.map((row, ri) => `<row r="${ri + 2}">${headers.map((key, ci) => cell(row[key], 0, `${column(ci)}${ri + 2}`)).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="45" customWidth="1"/><col min="3" max="3" width="30" customWidth="1"/><col min="4" max="4" width="24" customWidth="1"/><col min="5" max="5" width="25" customWidth="1"/><col min="6" max="6" width="22" customWidth="1"/></cols><sheetData>${header}${body}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>`;
  }
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
  function join(parts) { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  function crc32(bytes) { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function zip(entries) {
    const encoder = new TextEncoder(); const locals = []; const centrals = []; let offset = 0;
    for (const [name, text] of entries) {
      const nameBytes = encoder.encode(name); const raw = encoder.encode(text); const crc = crc32(raw);
      const local = join([u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(0), u16(0), u32(crc), u32(raw.length), u32(raw.length), u16(nameBytes.length), u16(0), nameBytes, raw]);
      const central = join([u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(0), u16(0), u32(crc), u32(raw.length), u32(raw.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]);
      locals.push(local); centrals.push(central); offset += local.length;
    }
    const central = join(centrals);
    return join([...locals, central, join([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)])]);
  }
  async function buildXlsx(rows) {
    const entries = [
      ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test Cases" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>'],
      ['xl/worksheets/sheet1.xml', sheetXml(rows)],
    ];
    return zip(entries);
  }
  function download(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function run() {
    try {
      const binding = findBinding();
      const { total, rows } = await readContexts(binding);
      const { details, errors } = await readDetails(rows);
      ensureRunning();
      if (errors.length) {
        console.error('[CALM Export] Keine Datei erzeugt: Detaildaten fehlen.', errors);
        throw new Error(`Detaildaten für ${errors.length} von ${rows.length} Testfällen konnten nicht geladen werden. Bitte erneut versuchen; es wurde keine Excel-Datei erzeugt.`);
      }
      const exportRows = outputRows(rows, details);
      const bytes = await buildXlsx(exportRows);
      const filename = `SAP_Cloud_ALM_Testcases_${new Date().toISOString().slice(0, 10)}.xlsx`;
      download(bytes, filename);
      progress.done(`${exportRows.length} Testfälle exportiert${errors.length ? ` (${errors.length} Detailfehler)` : ''}`);
      console.log('[CALM Export] Fertig:', { total, exported: exportRows.length, detailErrors: errors.length, filename, errors });
      return { total, exported: exportRows.length, detailErrors: errors.length, filename };
    } catch (error) {
      progress.done(String(error?.message || error), true);
      console.error('[CALM Export] Abbruch:', error);
      throw error;
    } finally {
      globalThis.__calmTestcaseExportRunning = false;
      delete globalThis.__calmTestcaseExportCancel;
    }
  }
  globalThis.__calmTestcaseExportPromise = run();
})();
