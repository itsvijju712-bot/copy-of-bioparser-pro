import { ExtractedRecord, ParserResult } from '../../types';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const normalizeHeader = (value: string) => normalizeWhitespace(value).toLowerCase();

const dedupe = <T,>(items: T[]) => Array.from(new Set(items));

const formatAuthorName = (raw: string) => {
  const cleaned = normalizeWhitespace(raw.replace(/\.$/, ''));
  const commaIndex = cleaned.indexOf(',');
  if (commaIndex > -1) {
    const last = cleaned.slice(0, commaIndex).trim();
    const rest = cleaned.slice(commaIndex + 1).trim();
    if (last && rest) {
      return normalizeWhitespace(`${rest} ${last}`);
    }
  }
  return cleaned;
};

const splitAuthors = (value: string) =>
  dedupe(
    value
      .split(';')
      .map(part => formatAuthorName(part))
      .filter(Boolean)
  );

const splitEmails = (value: string) =>
  dedupe((value.match(EMAIL_REGEX) ?? []).map(email => email.trim()).filter(Boolean));

const pairAuthorsAndEmails = (authors: string[], emails: string[]) => {
  if (authors.length === 0 || emails.length === 0) return [];

  if (authors.length === emails.length) {
    return authors.map((author, index) => ({ author, email: emails[index] }));
  }

  if (authors.length === 1) {
    return emails.map(email => ({ author: authors[0], email }));
  }

  if (emails.length === 1) {
    return [{ author: authors[0], email: emails[0] }];
  }

  const pairCount = Math.min(authors.length, emails.length);
  return Array.from({ length: pairCount }, (_, index) => ({
    author: authors[index],
    email: emails[index]
  }));
};

const parseTabDelimitedRows = (content: string) => {
  const lines = content
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const headerLine = lines.find(line => line.trim().length > 0);
  if (!headerLine) {
    throw new Error('The MDPI TXT file is empty.');
  }

  const headerIndex = lines.indexOf(headerLine);
  const headers = headerLine.split('\t');
  const expectedColumnCount = headers.length;

  const rows: string[][] = [];
  let currentRow = '';

  for (const rawLine of lines.slice(headerIndex + 1)) {
    if (!rawLine.trim() && !currentRow) continue;

    currentRow = currentRow ? `${currentRow}\n${rawLine}` : rawLine;
    const columns = currentRow.split('\t');

    if (columns.length < expectedColumnCount) {
      continue;
    }

    if (columns.length > expectedColumnCount) {
      const fixed = [
        ...columns.slice(0, expectedColumnCount - 1),
        columns.slice(expectedColumnCount - 1).join('\t')
      ];
      rows.push(fixed);
    } else {
      rows.push(columns);
    }
    currentRow = '';
  }

  return { headers, rows };
};

export const parseMdpiTxt = async (txtContent: string): Promise<ParserResult> => {
  return new Promise((resolve, reject) => {
    try {
      const { headers, rows } = parseTabDelimitedRows(txtContent ?? '');
      const headerMap = headers.reduce<Record<string, number>>((acc, header, index) => {
        acc[normalizeHeader(header)] = index;
        return acc;
      }, {});

      const authorIndex = headerMap.author;
      const emailIndex = headerMap.email;
      const titleIndex = headerMap.title;

      if (authorIndex === undefined || emailIndex === undefined || titleIndex === undefined) {
        throw new Error(
          'Missing required MDPI columns. Expected tab-delimited headers for Author, Email, and Title.'
        );
      }

      const uniqueKeys = new Set<string>();
      const records: ExtractedRecord[] = [];
      let totalProcessed = 0;

      for (const row of rows) {
        totalProcessed += 1;

        const title = normalizeWhitespace(row[titleIndex] ?? '');
        const authors = splitAuthors(row[authorIndex] ?? '');
        const emails = splitEmails(row[emailIndex] ?? '');

        for (const pair of pairAuthorsAndEmails(authors, emails)) {
          if (!title || !pair.author || !pair.email) continue;

          const recordKey = `${title}|${pair.author}|${pair.email}`;
          if (uniqueKeys.has(recordKey)) continue;
          uniqueKeys.add(recordKey);

          records.push({
            id: crypto.randomUUID(),
            title,
            author: pair.author,
            email: pair.email,
            source: 'MDPI'
          });
        }
      }

      resolve({ records, totalProcessed });
    } catch (error) {
      console.error(error);
      reject(new Error('An unexpected error occurred during MDPI TXT parsing.'));
    }
  });
};
