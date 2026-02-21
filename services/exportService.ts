import { ExtractedRecord } from '../types';

export const downloadCSV = (data: ExtractedRecord[], filename: string) => {
  // Define columns
  const headers = ["Title", "Author", "Author Email"];
  
  // Create CSV content
  const csvRows = [
    headers.join(","), // Header row
    ...data.map(row => {
      // Escape quotes and wrap in quotes to handle commas in content
      const title = `"${row.title.replace(/"/g, '""')}"`;
      const author = `"${row.author.replace(/"/g, '""')}"`;
      const email = `"${row.email.replace(/"/g, '""')}"`;
      return [title, author, email].join(",");
    })
  ];

  // Prefix UTF-8 BOM so Excel preserves non-ASCII characters correctly.
  const csvString = `\uFEFF${csvRows.join("\n")}`;
  
  // Create a blob and trigger download
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
