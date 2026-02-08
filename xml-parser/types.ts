export interface ExtractedRecord {
  id: string; // Unique internal ID for React keys
  title: string;
  author: string;
  email: string;
  source: string;
}

export enum DataSourceType {
  EUROPE_PMC = 'EUROPE_PMC',
  PUBMED = 'PUBMED',
  // Future sources can be added here
  BIORXIV = 'BIORXIV_FUTURE'
}

export interface ParserResult {
  records: ExtractedRecord[];
  totalProcessed: number;
  error?: string;
}

export interface ParserStrategy {
  name: string;
  description: string;
  parse: (xmlContent: string) => Promise<ParserResult>;
}
