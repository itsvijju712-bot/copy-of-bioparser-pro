import React, { useMemo, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, FlaskConical, Database } from 'lucide-react';
import { DataSourceType, ExtractedRecord } from './types';
import { parseEuropePMC } from './services/parsers/europepmcParser';
import { parsePubMedTxt } from './services/parsers/pubmedTxtParser';
import { DataTable } from './components/DataTable';
import { SourceSelector } from './components/SourceSelector';

const App: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState<DataSourceType>(DataSourceType.EUROPE_PMC);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractedRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const uniqueEmailData = useMemo(() => {
    const seen = new Set<string>();
    const result: ExtractedRecord[] = [];
    for (const row of data) {
      const key = row.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
    }
    return result;
  }, [data]);

  const isEuropePmc = selectedSource === DataSourceType.EUROPE_PMC;
  const uploadLabel = isEuropePmc ? 'XML files only (Europe PMC format)' : 'TXT files only (PubMed format)';
  const parsingLabel = isEuropePmc ? 'Parsing XML Structure...' : 'Parsing PubMed TXT...';
  const parsingDetail = isEuropePmc ? 'Extracting author metadata' : 'Extracting author and email metadata';
  const acceptType = isEuropePmc ? '.xml' : '.txt';

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setIsParsing(true);
    setData([]);

    try {
      const text = await file.text();
      
      let result;
      // Strategy pattern for future parsers
      switch (selectedSource) {
        case DataSourceType.EUROPE_PMC:
          result = await parseEuropePMC(text);
          break;
        case DataSourceType.PUBMED:
          result = await parsePubMedTxt(text);
          break;
        default:
          throw new Error("Parser not implemented yet.");
      }

      if (result.records.length === 0) {
        setError("No authors with emails found in this file.");
      } else {
        setData(result.records);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file.");
    } finally {
      setIsParsing(false);
    }
    
    // Reset input
    event.target.value = '';
  };

  const handleClear = () => {
    setData([]);
    setFileName(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FlaskConical className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">BioParser Pro</h1>
                <p className="text-xs text-slate-500">Academic Metadata Extractor</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Intro Section */}
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Transform Exports to Contacts</h2>
          <p className="text-lg text-slate-600">
            Upload your Europe PMC XML or PubMed TXT exports to automatically extract article titles, author names, and verified email addresses.
          </p>
        </div>

        {/* Configuration & Upload Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <SourceSelector selectedSource={selectedSource} onChange={setSelectedSource} />

          {/* Upload Area */}
          <div className="mt-6">
            <label 
              htmlFor="file-upload" 
              className={`
                relative group flex flex-col items-center justify-center w-full h-64 rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
                ${isParsing ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}
              `}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {isParsing ? (
                   <div className="flex flex-col items-center animate-pulse">
                      <div className="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4"></div>
                      <p className="text-lg font-medium text-indigo-700">{parsingLabel}</p>
                      <p className="text-sm text-indigo-500 mt-2">{parsingDetail}</p>
                   </div>
                ) : (
                  <>
                    <div className="p-4 rounded-full bg-indigo-50 mb-4 group-hover:bg-indigo-100 transition-colors">
                      <Upload className="h-10 w-10 text-indigo-600" />
                    </div>
                    <p className="mb-2 text-lg text-slate-700 font-medium">
                      <span className="font-bold text-indigo-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-sm text-slate-500">{uploadLabel}</p>
                  </>
                )}
              </div>
              <input 
                id="file-upload" 
                name="file-upload" 
                type="file" 
                className="hidden" 
                accept={acceptType}
                onChange={handleFileChange}
                disabled={isParsing}
              />
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Parsing Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {data.length > 0 && (
           <div className="space-y-6">
              {/* Stats Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-700" /></div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Records Extracted</p>
                      <p className="text-2xl font-bold text-slate-900">{data.length}</p>
                    </div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg"><CheckCircle2 className="h-5 w-5 text-indigo-700" /></div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Unique Emails</p>
                      <p className="text-2xl font-bold text-slate-900">{uniqueEmailData.length}</p>
                    </div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg"><FileText className="h-5 w-5 text-blue-700" /></div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Source File</p>
                      <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{fileName}</p>
                    </div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg"><Database className="h-5 w-5 text-indigo-700" /></div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Schema</p>
                      <p className="text-sm font-bold text-slate-900">{selectedSource.replace('_', ' ')}</p>
                    </div>
                 </div>
              </div>

              {/* Data Table */}
              <DataTable rawData={data} uniqueData={uniqueEmailData} onClear={handleClear} />
           </div>
        )}
      </main>
    </div>
  );
};

export default App;
