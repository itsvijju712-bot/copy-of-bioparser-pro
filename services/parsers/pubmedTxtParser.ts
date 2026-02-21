import { ExtractedRecord, ParserResult } from '../../types';
import { normalizeExtractedText } from './textNormalization';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const normalizeWhitespace = (value: string) => normalizeExtractedText(value);

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

const normalizeForMatch = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const getLastName = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : name;
};

const findAuthorMatch = (email: string, authors: string[], unusedAuthors?: Set<string>) => {
  const localPart = normalizeForMatch(email.split('@')[0] ?? '');
  let best: string | null = null;
  let bestScore = 0;

  for (const author of authors) {
    if (unusedAuthors && !unusedAuthors.has(author)) continue;
    const lastName = normalizeForMatch(getLastName(author));
    if (!lastName) continue;
    if (localPart.includes(lastName)) {
      const score = lastName.length;
      if (score > bestScore) {
        best = author;
        bestScore = score;
      }
    }
  }

  return best;
};

const buildRecords = (
  title: string,
  authors: string[],
  emails: string[],
  source: string,
  uniqueKeys: Set<string>,
  options?: { strictMatch?: boolean }
) => {
  const rows: ExtractedRecord[] = [];
  const normalizedTitle = normalizeWhitespace(title);
  const cleanedAuthors = dedupe(authors.map(formatAuthorName).filter(Boolean));
  const cleanedEmails = dedupe(emails.map(email => email.trim()).filter(Boolean));
  const strictMatch = options?.strictMatch ?? false;

  if (!normalizedTitle || cleanedAuthors.length === 0 || cleanedEmails.length === 0) {
    return rows;
  }

  const unusedAuthors = new Set(cleanedAuthors);
  const indexFallback = cleanedEmails.length === cleanedAuthors.length;

  for (const email of cleanedEmails) {
    let author = findAuthorMatch(email, cleanedAuthors, unusedAuthors);
    if (author && unusedAuthors.has(author)) {
      unusedAuthors.delete(author);
    } else if (!author && indexFallback) {
      const index = cleanedEmails.indexOf(email);
      const indexAuthor = cleanedAuthors[index];
      if (indexAuthor && unusedAuthors.has(indexAuthor)) {
        author = indexAuthor;
        unusedAuthors.delete(indexAuthor);
      }
    }

    if (!author && cleanedAuthors.length === 1) {
      author = cleanedAuthors[0];
    } else if (!author && !strictMatch) {
      author = cleanedAuthors[0];
    }

    if (!author) continue;

    const recordKey = `${normalizedTitle}|${author}|${email}`;
    if (uniqueKeys.has(recordKey)) continue;
    uniqueKeys.add(recordKey);
    rows.push({
      id: crypto.randomUUID(),
      title: normalizedTitle,
      author,
      email,
      source
    });
  }

  return rows;
};

const extractEmails = (text: string) => {
  const matches = text.match(EMAIL_REGEX);
  return matches ? matches : [];
};

const extractElectronicEmails = (affiliations: string[]) => {
  const emails: string[] = [];
  for (const aff of affiliations) {
    const lower = aff.toLowerCase();
    const idx = lower.lastIndexOf('electronic address');
    if (idx === -1) continue;
    const segment = aff.slice(idx);
    const matches = extractEmails(segment);
    if (matches.length > 0) {
      emails.push(matches[matches.length - 1]);
    }
  }
  return emails;
};

const parseMedline = (text: string): ParserResult => {
  const rows: ExtractedRecord[] = [];
  const uniqueKeys = new Set<string>();
  let totalProcessed = 0;

  let titleParts: string[] = [];
  let authors: { name: string; affiliations: string[] }[] = [];
  let currentAuthor: { name: string; affiliations: string[] } | null = null;
  let currentTag: 'TI' | 'FAU' | 'AD' | null = null;

  const flushRecord = () => {
    const hasContent = titleParts.length > 0 || authors.length > 0;
    if (!hasContent) return;

    totalProcessed += 1;

    const title = normalizeWhitespace(titleParts.join(' '));

    for (const author of authors) {
      const electronicEmails = extractElectronicEmails(author.affiliations);
      const affiliationEmails = extractEmails(author.affiliations.join(' '));
      const fallbackEmails = electronicEmails.length > 0 ? electronicEmails : affiliationEmails;
      if (fallbackEmails.length === 0) continue;
      const email = fallbackEmails[fallbackEmails.length - 1];
      if (!email) continue;

      const authorName = formatAuthorName(author.name);
      if (!authorName) continue;

      const recordKey = `${title}|${authorName}|${email}`;
      if (uniqueKeys.has(recordKey)) continue;
      uniqueKeys.add(recordKey);
      rows.push({
        id: crypto.randomUUID(),
        title,
        author: authorName,
        email,
        source: 'PubMed'
      });
    }

    titleParts = [];
    authors = [];
    currentAuthor = null;
    currentTag = null;
  };

  const lines = text
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  const tagPattern = /^([A-Z]{2,4})\s*-\s*(.*)$/;

  for (const line of lines) {
    if (line.startsWith('PMID-') && (titleParts.length > 0 || authors.length > 0)) {
      flushRecord();
    }

    const tagMatch = line.match(tagPattern);
    if (tagMatch) {
      const tag = tagMatch[1];
      const value = tagMatch[2].trim();

      if (tag === 'TI') {
        if (titleParts.length > 0 || authors.length > 0) {
          flushRecord();
        }
        currentTag = 'TI';
        titleParts.push(value);
      } else if (tag === 'FAU') {
        currentTag = 'FAU';
        currentAuthor = { name: value, affiliations: [] };
        authors.push(currentAuthor);
      } else if (tag === 'AD') {
        currentTag = 'AD';
        if (currentAuthor) {
          currentAuthor.affiliations.push(value);
        }
      } else {
        currentTag = null;
      }
      continue;
    }

    if (/^\s+\S/.test(line) && currentTag) {
      const continuation = line.trim();
      if (currentTag === 'TI' && titleParts.length > 0) {
        titleParts[titleParts.length - 1] = `${titleParts[titleParts.length - 1]} ${continuation}`.trim();
      } else if (currentTag === 'FAU' && currentAuthor) {
        currentAuthor.name = `${currentAuthor.name} ${continuation}`.trim();
      } else if (currentTag === 'AD' && currentAuthor && currentAuthor.affiliations.length > 0) {
        const lastIndex = currentAuthor.affiliations.length - 1;
        currentAuthor.affiliations[lastIndex] = `${currentAuthor.affiliations[lastIndex]} ${continuation}`.trim();
      }
      continue;
    }

    if (currentTag === 'AD' && currentAuthor && extractEmails(line).length > 0) {
      if (currentAuthor.affiliations.length === 0) {
        currentAuthor.affiliations.push(line.trim());
      } else {
        const lastIndex = currentAuthor.affiliations.length - 1;
        currentAuthor.affiliations[lastIndex] = `${currentAuthor.affiliations[lastIndex]} ${line.trim()}`.trim();
      }
      continue;
    }
  }

  flushRecord();

  return {
    records: rows,
    totalProcessed
  };
};

const splitAuthorList = (authorText: string) => {
  if (!authorText) return [];
  const cleaned = normalizeWhitespace(authorText.replace(/\bet al\.?/gi, '').replace(/\.$/, ''));
  return cleaned
    .split(/(?:;|,|\band\b)\s*/i)
    .map(item => item.trim())
    .filter(item => item.length > 1);
};

const parseAbstractText = (text: string): ParserResult => {
  const rows: ExtractedRecord[] = [];
  const uniqueKeys = new Set<string>();
  let totalProcessed = 0;

  const headingMap: Record<string, 'title' | 'authors' | 'affiliations'> = {
    title: 'title',
    authors: 'authors',
    'author information': 'affiliations',
    affiliation: 'affiliations',
    affiliations: 'affiliations',
    correspondence: 'affiliations'
  };

  let titleParts: string[] = [];
  let authorLines: string[] = [];
  let affiliationLines: string[] = [];
  let recordLines: string[] = [];
  let currentSection: 'title' | 'authors' | 'affiliations' | null = null;

  const flushRecord = () => {
    if (titleParts.length === 0 && authorLines.length === 0 && affiliationLines.length === 0) {
      return;
    }

    totalProcessed += 1;

    const title = normalizeWhitespace(titleParts.join(' '));
    const authorText = normalizeWhitespace(authorLines.join(' '));
    const authors = splitAuthorList(authorText);
    const affiliationText = affiliationLines.join(' ');
    const electronicEmails = extractElectronicEmails(affiliationLines);
    const emailsFromAffiliations = extractEmails(affiliationText);
    const emails = emailsFromAffiliations.length > 0
      ? emailsFromAffiliations
      : extractEmails(recordLines.join(' '));

    const chosenEmails = electronicEmails.length > 0 ? electronicEmails : emails;
    const records = buildRecords(
      title,
      authors,
      chosenEmails,
      'PubMed',
      uniqueKeys,
      { strictMatch: electronicEmails.length > 0 }
    );
    rows.push(...records);

    titleParts = [];
    authorLines = [];
    affiliationLines = [];
    recordLines = [];
    currentSection = null;
  };

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const inlineHeadingMatch = trimmed.match(/^(title|authors?|author information|affiliations?|correspondence):\s*(.*)$/i);
    if (inlineHeadingMatch) {
      const headingKey = inlineHeadingMatch[1].toLowerCase();
      const value = inlineHeadingMatch[2]?.trim();
      const mappedSection = headingMap[headingKey];
      if (mappedSection === 'title' && (titleParts.length || authorLines.length || affiliationLines.length)) {
        flushRecord();
      }
      currentSection = mappedSection;
      if (value) {
        if (currentSection === 'title') {
          titleParts.push(value);
        } else if (currentSection === 'authors') {
          authorLines.push(value);
        } else if (currentSection === 'affiliations') {
          affiliationLines.push(value);
        }
      }
      continue;
    }

    const headingKey = trimmed.replace(/:$/, '').toLowerCase();
    if (headingMap[headingKey]) {
      if (headingMap[headingKey] === 'title' && (titleParts.length || authorLines.length || affiliationLines.length)) {
        flushRecord();
      }
      currentSection = headingMap[headingKey];
      continue;
    }

    if (/^PMID:\s*\d+/i.test(trimmed) && (titleParts.length || authorLines.length || affiliationLines.length)) {
      recordLines.push(trimmed);
      flushRecord();
      continue;
    }

    recordLines.push(trimmed);

    if (currentSection === 'title') {
      titleParts.push(trimmed);
    } else if (currentSection === 'authors') {
      authorLines.push(trimmed);
    } else if (currentSection === 'affiliations') {
      affiliationLines.push(trimmed);
    }
  }

  flushRecord();

  return {
    records: rows,
    totalProcessed
  };
};

export const parsePubMedTxt = async (txtContent: string): Promise<ParserResult> => {
  return new Promise((resolve, reject) => {
    try {
      const content = txtContent ?? '';
      const isMedline = /(^|\n)PMID- /m.test(content) || /(^|\n)[A-Z]{2,4}\s{2}- /m.test(content);
      const result = isMedline ? parseMedline(content) : parseAbstractText(content);
      resolve(result);
    } catch (error) {
      console.error(error);
      reject(new Error("An unexpected error occurred during parsing."));
    }
  });
};
