import { ExtractedRecord, ParserResult } from '../../types';
import { normalizeExtractedText, trimTrailingFullStop } from './textNormalization';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const NON_AUTHOR_CONTACT_REGEX = /(?:permission|permissions|reprint|reprints|membership|epub)/i;
const NON_AUTHOR_DOMAIN_REGEX = /(?:benthamscience\.net)$/i;

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

const normalizeAlpha = (value: string) =>
  value.toLowerCase().replace(/[^a-z]/g, '');

const getAlphaTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z]+|\d+/)
    .map(token => token.trim())
    .filter(Boolean);

const getEmailLocalTokens = (email: string) =>
  getAlphaTokens(email.split('@')[0] ?? '').map(token => normalizeForMatch(token));

const isNonAuthorContactEmail = (email: string) => {
  const lower = email.toLowerCase();
  const [local = '', domain = ''] = lower.split('@');
  if (NON_AUTHOR_DOMAIN_REGEX.test(domain)) return true;
  if (local.includes('journals.permissions')) return true;
  return NON_AUTHOR_CONTACT_REGEX.test(local);
};

const getAuthorNameSignals = (authorName: string) => {
  const parts = authorName
    .split(' ')
    .map(part => normalizeForMatch(part))
    .filter(Boolean);
  const lastName = parts.length > 0 ? parts[parts.length - 1] : '';
  const givenNames = parts.slice(0, -1);
  const givenInitials = givenNames.map(part => part[0]).join('');
  const allInitials = parts.map(part => part[0]).join('');

  return {
    lastName,
    givenNames,
    givenInitials,
    allInitials
  };
};

const getShortNameSignals = (shortName: string) => {
  const alphaTokens = getAlphaTokens(shortName).map(token => normalizeForMatch(token)).filter(Boolean);
  const compact = alphaTokens.join('');
  const surname = alphaTokens.length > 0 ? alphaTokens[0] : '';
  const initials = alphaTokens.length > 1 ? alphaTokens.slice(1).join('') : '';
  const initialBeforeSurname = initials && surname ? `${initials}${surname}` : '';
  const surnameBeforeInitial = initials && surname ? `${surname}${initials}` : '';
  return { compact, initials, initialBeforeSurname, surnameBeforeInitial };
};

const scoreAuthorEmailMatch = (email: string, authorName: string, shortNames: string[] = []) => {
  const local = email.split('@')[0] ?? '';
  const localAlnum = normalizeForMatch(local);
  const localTokens = getEmailLocalTokens(email);
  const localAlphaTokens = getAlphaTokens(local);
  const { lastName, givenNames, givenInitials, allInitials } = getAuthorNameSignals(authorName);

  let score = 0;

  for (const token of localTokens) {
    if (!token) continue;
    if (token === lastName) score = Math.max(score, 120);
    if (lastName && token.startsWith(lastName)) score = Math.max(score, 110);
    if (lastName && token.endsWith(lastName)) score = Math.max(score, 105);
    if (lastName && lastName.startsWith(token) && token.length >= 4) score = Math.max(score, 95);
    if (lastName && lastName.length >= 4 && token.includes(lastName)) score = Math.max(score, 90);
    if (givenNames.includes(token)) score = Math.max(score, 85);
    if (allInitials && token === allInitials && token.length >= 2) score = Math.max(score, 108);
    if (givenInitials && lastName && token === `${givenInitials}${lastName}`) score = Math.max(score, 112);
    if (givenInitials && lastName && token === `${lastName}${givenInitials}`) score = Math.max(score, 110);
    if (
      givenInitials &&
      lastName &&
      givenInitials.length >= 1 &&
      token === `${givenInitials[0]}${lastName}`
    ) {
      score = Math.max(score, 111);
    }
  }

  for (const token of localAlphaTokens) {
    const normalized = normalizeForMatch(token);
    if (!normalized) continue;
    if (allInitials && normalized === allInitials) score = Math.max(score, 108);
    if (lastName && normalized.startsWith(lastName)) score = Math.max(score, 110);
    if (lastName && normalized.endsWith(lastName)) score = Math.max(score, 105);
  }

  for (const shortName of shortNames) {
    const { compact, initials, initialBeforeSurname, surnameBeforeInitial } = getShortNameSignals(shortName);
    if (compact && localAlnum.includes(compact)) score = Math.max(score, 114);
    if (initials && initials.length >= 2 && localAlnum.includes(initials)) score = Math.max(score, 102);
    if (initialBeforeSurname && localAlnum.includes(initialBeforeSurname)) score = Math.max(score, 116);
    if (surnameBeforeInitial && localAlnum.includes(surnameBeforeInitial)) score = Math.max(score, 113);
  }

  return score;
};

const findAuthorMatch = (email: string, authors: string[], unusedAuthors?: Set<string>) => {
  let best: string | null = null;
  let bestScore = -1;

  for (const author of authors) {
    if (unusedAuthors && !unusedAuthors.has(author)) continue;
    const score = scoreAuthorEmailMatch(email, author);
    if (score > bestScore) {
      best = author;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
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
  const normalizedTitle = trimTrailingFullStop(title);
  const cleanedAuthors = dedupe(authors.map(formatAuthorName).filter(Boolean));
  const cleanedEmails = dedupe(
    emails
      .map(email => email.trim())
      .filter(Boolean)
      .filter(email => !isNonAuthorContactEmail(email))
  );
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
  let authors: { name: string; shortNames: string[]; affiliations: string[] }[] = [];
  let currentAuthor: { name: string; shortNames: string[]; affiliations: string[] } | null = null;
  let currentTag: 'TI' | 'FAU' | 'AU' | 'AD' | null = null;

  const flushRecord = () => {
    const hasContent = titleParts.length > 0 || authors.length > 0;
    if (!hasContent) return;

    totalProcessed += 1;

    const title = trimTrailingFullStop(titleParts.join(' '));
    if (!title) {
      titleParts = [];
      authors = [];
      currentAuthor = null;
      currentTag = null;
      return;
    }

    const preparedAuthors = authors
      .map(author => {
        const formattedName = formatAuthorName(author.name);
        if (!formattedName) return null;

        const normalizedShortNames = dedupe(
          author.shortNames.map(value => normalizeWhitespace(value)).filter(Boolean)
        );
        const electronicEmails = extractElectronicEmails(author.affiliations);
        const affiliationEmails = extractEmails(author.affiliations.join(' '));
        const candidateEmails = dedupe(
          (electronicEmails.length > 0 ? electronicEmails : affiliationEmails)
            .map(email => email.trim().toLowerCase())
            .filter(Boolean)
            .filter(email => !isNonAuthorContactEmail(email))
        );

        return {
          name: formattedName,
          shortNames: normalizedShortNames,
          candidateEmails
        };
      })
      .filter((author): author is { name: string; shortNames: string[]; candidateEmails: string[] } => !!author);

    if (preparedAuthors.length === 0) {
      titleParts = [];
      authors = [];
      currentAuthor = null;
      currentTag = null;
      return;
    }

    const emailToOwnerIndices = new Map<string, Set<number>>();
    preparedAuthors.forEach((author, index) => {
      for (const email of author.candidateEmails) {
        if (!emailToOwnerIndices.has(email)) {
          emailToOwnerIndices.set(email, new Set<number>());
        }
        emailToOwnerIndices.get(email)!.add(index);
      }
    });

    const assignEmailToAuthor = (email: string, ownerIndices: Set<number>) => {
      let bestIndex = -1;
      let bestScore = -1;

      for (let index = 0; index < preparedAuthors.length; index += 1) {
        const author = preparedAuthors[index];
        let score = scoreAuthorEmailMatch(email, author.name, author.shortNames);
        if (ownerIndices.has(index)) {
          score += 2;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }

      if (bestIndex >= 0 && bestScore > 0) {
        return preparedAuthors[bestIndex].name;
      }

      if (ownerIndices.size === 1) {
        const onlyOwner = Array.from(ownerIndices)[0];
        return preparedAuthors[onlyOwner]?.name ?? null;
      }

      if (preparedAuthors.length === 1) {
        return preparedAuthors[0].name;
      }

      return null;
    };

    for (const [email, ownerIndices] of emailToOwnerIndices.entries()) {
      const authorName = assignEmailToAuthor(email, ownerIndices);
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
        currentAuthor = { name: value, shortNames: [], affiliations: [] };
        authors.push(currentAuthor);
      } else if (tag === 'AU') {
        currentTag = 'AU';
        if (currentAuthor) {
          currentAuthor.shortNames.push(value);
        } else {
          currentAuthor = { name: value, shortNames: [value], affiliations: [] };
          authors.push(currentAuthor);
        }
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
      } else if (currentTag === 'AU' && currentAuthor) {
        if (currentAuthor.shortNames.length === 0) {
          currentAuthor.shortNames.push(continuation);
        } else {
          const lastIndex = currentAuthor.shortNames.length - 1;
          currentAuthor.shortNames[lastIndex] = `${currentAuthor.shortNames[lastIndex]} ${continuation}`.trim();
        }
      } else if (currentTag === 'AD' && currentAuthor && currentAuthor.affiliations.length > 0) {
        const lastIndex = currentAuthor.affiliations.length - 1;
        currentAuthor.affiliations[lastIndex] = `${currentAuthor.affiliations[lastIndex]} ${continuation}`.trim();
      }
      continue;
    }

    const untaggedLine = line.trim();
    if (currentTag === 'AD' && currentAuthor && untaggedLine) {
      if (currentAuthor.affiliations.length === 0) {
        currentAuthor.affiliations.push(untaggedLine);
      } else {
        const lastIndex = currentAuthor.affiliations.length - 1;
        currentAuthor.affiliations[lastIndex] = `${currentAuthor.affiliations[lastIndex]} ${untaggedLine}`.trim();
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
