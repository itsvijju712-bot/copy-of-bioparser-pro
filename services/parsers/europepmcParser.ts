import { ExtractedRecord, ParserResult } from '../../types';

// Regex matching the Python one: r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const parseEuropePMC = async (xmlContent: string): Promise<ParserResult> => {
  return new Promise((resolve, reject) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
      
      // Check for parsing errors
      const parseError = xmlDoc.querySelector("parsererror");
      if (parseError) {
        reject(new Error("Invalid XML format or file is corrupted."));
        return;
      }

      const rows: ExtractedRecord[] = [];
      const uniqueKeys = new Set<string>(); // For deduplication
      
      // Get all article nodes. In Europe PMC XML, usually under <result> or <article> depending on exact export
      // We will search for nodes that contain author lists to be safe, or iterate all descendents.
      // Based on the user's Python code: `for article in root.iter():`
      // We will select all elements and check if they look like articles with authors.
      // However, usually iterating top-level nodes is safer for performance.
      // Let's assume a standard structure but be robust like the Python script.
      
      const allElements = xmlDoc.getElementsByTagName("*");
      
      // In DOM, we don't have a direct equivalent to python's element.iter() that treats every node as a potential article root easily
      // without checking context. 
      // Strategy: Find all nodes that have <author> children.
      
      // A more specific approach based on Europe PMC standard XML export:
      // Usually <resultList><result>...</result></resultList>
      let articles = Array.from(xmlDoc.querySelectorAll("result"));
      
      // Fallback if structure is different (e.g. full text XML)
      if (articles.length === 0) {
        articles = Array.from(xmlDoc.querySelectorAll("article"));
      }

      for (const article of articles) {
        const authors = article.querySelectorAll("author");
        if (authors.length === 0) continue;

        // Find Title
        // Python: matches 'title' in tag name and has text.
        let title = "";
        const allArticleDescendants = article.querySelectorAll("*");
        
        for (let i = 0; i < allArticleDescendants.length; i++) {
          const el = allArticleDescendants[i];
          if (el.tagName.toLowerCase().includes("title") && el.textContent?.trim()) {
            title = el.textContent.trim();
            break; // Found the first title-like element
          }
        }

        if (!title) continue; // Filter empty titles per requirement

        // Process Authors
        for (let i = 0; i < authors.length; i++) {
          const author = authors[i];
          let firstName: string | null = null;
          let lastName: string | null = null;
          const affiliations: string[] = [];

          const authorDescendants = author.querySelectorAll("*");
          
          for (let j = 0; j < authorDescendants.length; j++) {
            const el = authorDescendants[j];
            const tag = el.tagName.toLowerCase();
            const text = el.textContent?.trim();

            if (!text) continue;

            if (tag.endsWith("firstname")) {
              firstName = text;
            } else if (tag.endsWith("lastname")) {
              lastName = text;
            } else if (tag.endsWith("affiliation")) {
              affiliations.push(text);
            }
          }

          if (firstName && lastName && affiliations.length > 0) {
            const fullName = `${firstName} ${lastName}`;

            for (const aff of affiliations) {
              const emails = aff.match(EMAIL_REGEX);
              
              if (emails) {
                for (const email of emails) {
                  const recordKey = `${title}|${fullName}|${email}`;
                  
                  // Python: df.drop_duplicates() happens at the end. We do it on the fly.
                  if (!uniqueKeys.has(recordKey)) {
                    uniqueKeys.add(recordKey);
                    rows.push({
                      id: crypto.randomUUID(),
                      title: title,
                      author: fullName,
                      email: email,
                      source: 'Europe PMC'
                    });
                  }
                }
              }
            }
          }
        }
      }

      resolve({
        records: rows,
        totalProcessed: articles.length
      });

    } catch (e) {
      console.error(e);
      reject(new Error("An unexpected error occurred during parsing."));
    }
  });
};
