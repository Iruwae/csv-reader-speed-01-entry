// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference CSV reader).
// Same answers, same error records, built for speed: the text is scanned with
// indexOf jumps and String.split instead of one character at a time.
//
// Semantics (csv-reader 1.0.0, as published in the kit):
// - U+FEFF at the very start is dropped.
// - A record ends at LF or CRLF; a line left with no characters is no record.
// - Outside quotes a CR not followed by LF is dropped (stray_cr).
// - A field that opens with a quote runs to the next quote that is not doubled;
//   "" inside is one quote; CRLF or a lone CR inside reads as LF; what follows
//   the closing quote, up to the next comma or line break, is appended as it
//   stands (quote_junk, when the field ends); a quote that never closes is a
//   literal character and the text after it is read again as unquoted
//   (unterminated_quote). A quote inside an unquoted field is literal.
// - Fields stay strings, never trimmed or converted.
// - columns is the first record when header is true, else null; rows holds the
//   records after it, each padded (short_row, with fields: its field count) or
//   cut (long_row, with extra: the cut fields) to the first record's width.
// - Each error is {code, line, row}: line the 1-based line its record starts
//   on, row its record's index in rows (null for the header), in the order met.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Every error of a record carries these two.
  let recordLine = 1;
  let recordRow = null;

  function pushError(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line
  // break. A CR not followed by LF is dropped (stray_cr). Returns the field
  // and how it ended; `added` counts the characters kept during this call.
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      const c = text.indexOf(',', pos);
      const n = text.indexOf('\n', pos);
      let end = len;
      let kind = END;
      if (c !== -1 && c < end) { end = c; kind = COMMA; }
      if (n !== -1 && n < end) { end = n; kind = LINE_BREAK; }
      let chunk = text.slice(pos, end);
      // A CR right before the line break is the CRLF, not a stray CR.
      if (kind === LINE_BREAK && chunk.charCodeAt(chunk.length - 1) === 13) {
        chunk = chunk.slice(0, -1);
      }
      if (chunk.indexOf('\r') !== -1) {
        // Every CR left here is stray: one error each, dropped from the value.
        const parts = chunk.split('\r');
        for (let i = 0; i < parts.length - 1; i++) pushError('stray_cr');
        chunk = parts.join('');
      }
      if (chunk.length > 0) {
        value += chunk;
        added += chunk.length;
      }
      pos = end;
      if (kind === COMMA) {
        pos += 1;
        return { value, ended: COMMA, added };
      }
      if (kind === LINE_BREAK) {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      return { value, ended: END, added };
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let closed = false;
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) break;
      let seg = text.slice(pos, q);
      if (seg.indexOf('\r') !== -1) {
        // CRLF and lone CR inside quotes each read as one LF.
        const norm = seg.replace(/\r\n?/g, '\n');
        const ni = norm.indexOf('\n');
        if (ni !== -1) line += norm.split('\n').length - 1;
        seg = norm;
      } else {
        const ni = seg.indexOf('\n');
        if (ni !== -1) line += seg.split('\n').length - 1;
      }
      value += seg;
      if (text.charCodeAt(q + 1) === 34) {
        // A doubled quote is one quote inside the field.
        value += '"';
        pos = q + 2;
        continue;
      }
      pos = q + 1;
      closed = true;
      break;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      pushError('unterminated_quote');
      return readUnquoted('"');
    }
    if (pos >= len) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) pushError('quote_junk');
    return junk;
  }

  // Finishes a record: the single empty unquoted field is no record, the
  // first record sets the width (and the header), the rest are padded or cut.
  function finishRecord(fields, quoted) {
    if (fields.length === 1 && fields[0] === '' && !quoted) return;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: no quote before the next line break, so this record holds
    // no quoted field and no line break inside a field. Split it whole.
    const nl = text.indexOf('\n', pos);
    const q = text.indexOf('"', pos);
    if (q === -1 || (nl !== -1 && q > nl)) {
      let contentEnd = nl === -1 ? len : nl;
      if (nl !== -1 && contentEnd > pos && text.charCodeAt(contentEnd - 1) === 13) {
        contentEnd -= 1; // CRLF: the CR is the line break, not a stray CR.
      }
      let s = text.slice(pos, contentEnd);
      if (s.indexOf('\r') !== -1) {
        const parts = s.split('\r');
        for (let i = 0; i < parts.length - 1; i++) pushError('stray_cr');
        s = parts.join('');
      }
      finishRecord(s.split(','), false);
      pos = nl === -1 ? len : nl + 1;
      if (nl !== -1) line += 1;
      continue;
    }

    // Slow path: the record holds a quote before its line break.
    const fields = [];
    let quoted = false;
    let ended = END;
    for (;;) {
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        const field = readQuoted();
        fields.push(field.value);
        ended = field.ended;
      } else {
        quoted = false;
        const field = readUnquoted('');
        fields.push(field.value);
        ended = field.ended;
      }
      if (ended !== COMMA) break;
    }
    finishRecord(fields, quoted);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
