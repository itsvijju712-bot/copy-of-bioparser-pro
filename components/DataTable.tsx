import React, { useState } from 'react';
import { ExtractedRecord } from '../types';
import { Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { downloadCSV } from '../services/exportService';

interface DataTableProps {
  rawData: ExtractedRecord[];
  uniqueData: ExtractedRecord[];
  onClear: () => void;
}

const ROWS_PER_PAGE = 10;

type TableView = 'raw' | 'unique';

export const DataTable: React.FC<DataTableProps> = ({ rawData, uniqueData, onClear }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<TableView>('raw');

  const activeData = view === 'raw' ? rawData : uniqueData;

  const filteredData = activeData.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const currentData = filteredData.slice(startIndex, startIndex + ROWS_PER_PAGE);

  const handleDownload = () => {
    const filename = view === 'raw' ? 'authors_with_title_email.csv' : 'unique_emails.csv';
    downloadCSV(activeData, filename);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Actions */}
      <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => {
              setView('raw');
              setCurrentPage(1);
            }}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              view === 'raw'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Raw ({rawData.length})
          </button>
          <button
            onClick={() => {
              setView('unique');
              setCurrentPage(1);
            }}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              view === 'unique'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Unique Emails ({uniqueData.length})
          </button>
        </div>
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            placeholder="Filter results..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
           <button 
            onClick={onClear}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors w-1/2 sm:w-auto"
          >
            Clear Data
          </button>
          <button 
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 w-1/2 sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Export Excel (CSV)
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-grow">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/4">Author</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/4">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/2">Title</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {currentData.length > 0 ? (
              currentData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{row.author}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 hover:text-indigo-800">
                    <a href={`mailto:${row.email}`}>{row.email}</a>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 break-words line-clamp-2 max-w-md" title={row.title}>
                    {row.title.length > 80 ? row.title.substring(0, 80) + '...' : row.title}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-500 text-sm">
                  No records found matching your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between sm:px-6">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(startIndex + ROWS_PER_PAGE, filteredData.length)}</span> of <span className="font-medium">{filteredData.length}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};
