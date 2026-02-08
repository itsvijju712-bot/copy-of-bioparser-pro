import React from 'react';
import { DataSourceType } from '../types';
import { Database, FileText, PlusCircle } from 'lucide-react';

interface SourceSelectorProps {
  selectedSource: DataSourceType;
  onChange: (source: DataSourceType) => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({ selectedSource, onChange }) => {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-slate-700 mb-2">Select Data Source</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Active Source */}
        <div 
          onClick={() => onChange(DataSourceType.EUROPE_PMC)}
          className={`
            cursor-pointer relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200
            ${selectedSource === DataSourceType.EUROPE_PMC 
              ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}
          `}
        >
          <Database className={`h-8 w-8 mb-3 ${selectedSource === DataSourceType.EUROPE_PMC ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className={`font-semibold ${selectedSource === DataSourceType.EUROPE_PMC ? 'text-indigo-900' : 'text-slate-600'}`}>Europe PMC</span>
          <span className="text-xs text-slate-500 mt-1">XML Exports</span>
          {selectedSource === DataSourceType.EUROPE_PMC && (
            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></div>
          )}
        </div>

        {/* PubMed Source */}
        <div 
          onClick={() => onChange(DataSourceType.PUBMED)}
          className={`
            cursor-pointer relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200
            ${selectedSource === DataSourceType.PUBMED 
              ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}
          `}
        >
          <FileText className={`h-8 w-8 mb-3 ${selectedSource === DataSourceType.PUBMED ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className={`font-semibold ${selectedSource === DataSourceType.PUBMED ? 'text-indigo-900' : 'text-slate-600'}`}>PubMed</span>
          <span className="text-xs text-slate-500 mt-1">TXT Exports</span>
          {selectedSource === DataSourceType.PUBMED && (
            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></div>
          )}
        </div>

        {/* MDPI Source */}
        <div 
          onClick={() => onChange(DataSourceType.MDPI)}
          className={`
            cursor-pointer relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200
            ${selectedSource === DataSourceType.MDPI 
              ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}
          `}
        >
          <FileText className={`h-8 w-8 mb-3 ${selectedSource === DataSourceType.MDPI ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className={`font-semibold ${selectedSource === DataSourceType.MDPI ? 'text-indigo-900' : 'text-slate-600'}`}>MDPI</span>
          <span className="text-xs text-slate-500 mt-1">TXT Exports</span>
          {selectedSource === DataSourceType.MDPI && (
            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></div>
          )}
        </div>

        <div className="relative flex flex-col items-center p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 opacity-60">
          <PlusCircle className="h-8 w-8 mb-3 text-slate-400" />
          <span className="font-medium text-slate-500">bioRxiv</span>
          <span className="text-xs text-slate-400 mt-1">Coming Soon</span>
        </div>

      </div>
    </div>
  );
};
