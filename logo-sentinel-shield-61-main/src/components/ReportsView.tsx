import React, { useState } from 'react';
import { Download, FileText, Calendar, Eye, Trash2, Filter, FileSpreadsheet } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface ReportsViewProps {
  exportedReports: any[];
  onDeleteReport: (reportId: string) => void;
}

const ReportsView: React.FC<ReportsViewProps> = ({ exportedReports, onDeleteReport }) => {
  const [filterType, setFilterType] = useState('all');

  const filteredReports = exportedReports.filter(report => {
    if (filterType === 'all') return true;
    return report.type === filterType;
  });

  const viewReport = (report: any) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .comparison { border: 1px solid #ccc; margin: 20px 0; padding: 20px; page-break-inside: avoid; }
          .images { display: flex; gap: 20px; margin: 20px 0; justify-content: center; }
          .image-section { flex: 1; text-align: center; max-width: 300px; }
          .image-section img { max-width: 100%; height: auto; border: 1px solid #ddd; }
          .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .details-table th, .details-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .details-table th { background-color: #f5f5f5; font-weight: bold; }
          .risk { font-weight: bold; margin-bottom: 10px; }
          .risk.high { color: #dc2626; }
          .risk.medium { color: #ea580c; }
          .risk.low { color: #65a30d; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #555; }
        </style>
      </head>
      <body>
        <h1>${report.title}</h1>
        <p>Generated on: ${new Date(report.exportDate).toLocaleDateString()}</p>
        <p>Export Type: ${report.type === 'auto-export' ? 'Automatic High Risk Export' : 'Manual Selection Export'}</p>
        <p>Total Items: ${report.data.length}</p>
        <p>Format: ${report.format ? report.format.toUpperCase() : 'PDF'}</p>
        
        ${report.data.map((item: any, index: number) => `
          <div class="comparison">
            <h2>Comparison ${index + 1}: ${item.logo_name}</h2>
            <div class="risk">Risk Level: ${item.final_similarity >= 90 ? 'HIGH RISK' : item.final_similarity >= 75 ? 'MEDIUM RISK' : 'LOW RISK'}</div>
            
            <div class="images">
              <div class="image-section">
                <h3>Reference Logo</h3>
                <img src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=200&fit=crop" alt="Reference Logo" />
                <p>${item.reference_logo}</p>
              </div>
              <div class="image-section">
                <h3>Potential Match</h3>
                <img src="${item.logo_path}" alt="Match Logo" />
                <p>${item.logo_name}</p>
              </div>
            </div>
            
            <table class="details-table">
              <thead>
                <tr>
                  <th>Detail</th>
                  <th>Reference Logo</th>
                  <th>Potential Match</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Application Number</strong></td>
                  <td>N/A</td>
                  <td>${item.application_number}</td>
                </tr>
                <tr>
                  <td><strong>Proprietor</strong></td>
                  <td>${item.reference_proprietor}</td>
                  <td>${item.proprietor}</td>
                </tr>
                <tr>
                  <td><strong>Class</strong></td>
                  <td>${item.reference_class}</td>
                  <td>${item.class}</td>
                </tr>
                <tr>
                  <td><strong>Date of Application</strong></td>
                  <td>${item.reference_doa}</td>
                  <td>${item.doa}</td>
                </tr>
                <tr>
                  <td><strong>Date of Use</strong></td>
                  <td>${item.reference_dou}</td>
                  <td>${item.dou}</td>
                </tr>
                <tr>
                  <td><strong>Class Description</strong></td>
                  <td>${item.reference_classDescription}</td>
                  <td>${item.classDescription}</td>
                </tr>
                <tr>
                  <td><strong>Extracted Text</strong></td>
                  <td>${item.text1 || 'No text detected'}</td>
                  <td>${item.text2 || 'No text detected'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
    }
  };

  const downloadReport = (report: any) => {
    if (report.format === 'excel') {
      // Generate Excel/CSV format
      const csvContent = [
        'Logo Name,Risk Level,Reference Application Number,Reference Proprietor,Reference Class,Reference DoA,Reference DoU,Reference Class Description,Reference Text,Match Application Number,Match Proprietor,Match Class,Match DoA,Match DoU,Match Class Description,Match Text,Reference Image,Match Image',
        ...report.data.map((item: any) => [
          item.logo_name,
          item.final_similarity >= 90 ? 'HIGH RISK' : item.final_similarity >= 75 ? 'MEDIUM RISK' : 'LOW RISK',
          'N/A',
          `"${item.reference_proprietor}"`,
          item.reference_class,
          item.reference_doa,
          item.reference_dou,
          `"${item.reference_classDescription}"`,
          `"${item.text1 || 'No text detected'}"`,
          item.application_number,
          `"${item.proprietor}"`,
          item.class,
          item.doa,
          item.dou,
          `"${item.classDescription}"`,
          `"${item.text2 || 'No text detected'}"`,
          'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=200&fit=crop',
          item.logo_path
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Default to PDF view
      viewReport(report);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-black">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-poppins font-bold text-black dark:text-white mb-2">Reports</h2>
          <p className="font-poppins text-gray-500 dark:text-gray-400">
            View and manage your exported analysis reports
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-black dark:text-white rounded-lg px-3 py-2 text-sm font-poppins focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          >
            <option value="all">All Reports</option>
            <option value="auto-export">Auto All Risks</option>
            <option value="selected-export">Manual Selection</option>
          </select>
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-poppins font-semibold text-gray-500 dark:text-gray-400 mb-4">
            No reports generated yet
          </h3>
          <p className="font-poppins text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Export analysis results to generate reports that will appear here for easy access and management.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <div className="grid grid-cols-12 gap-4 text-sm font-poppins font-medium text-gray-600 dark:text-gray-300">
              <div className="col-span-4">Report Name</div>
              <div className="col-span-2">Export Type</div>
              <div className="col-span-2">Format</div>
              <div className="col-span-1">Items</div>
              <div className="col-span-1">High Risk</div>
              <div className="col-span-1">Date</div>
              <div className="col-span-1">Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredReports.map((report, index) => (
              <div
                key={index}
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Report Name */}
                  <div className="col-span-4 flex items-center space-x-3">
                    <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                      {report.format === 'excel' ? (
                        <FileSpreadsheet className="w-4 h-4 text-white dark:text-black" />
                      ) : (
                        <FileText className="w-4 h-4 text-white dark:text-black" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-poppins font-semibold text-black dark:text-white truncate">
                        {report.title}
                      </h3>
                      <p className="text-xs font-poppins text-gray-500 dark:text-gray-400 truncate">
                        Generated report
                      </p>
                    </div>
                  </div>

                  {/* Export Type */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-poppins font-medium ${
                      report.type === 'auto-export' 
                        ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' 
                        : 'bg-black text-white dark:bg-white dark:text-black'
                    }`}>
                      {report.type === 'auto-export' ? 'Auto All Risks' : 'Manual Selection'}
                    </span>
                  </div>

                  {/* Format */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-poppins font-medium ${
                      report.format === 'excel' 
                        ? 'bg-black text-white dark:bg-white dark:text-black' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                    }`}>
                      {report.format ? report.format.toUpperCase() : 'PDF'}
                    </span>
                  </div>

                  {/* Items Count */}
                  <div className="col-span-1">
                    <span className="text-sm font-poppins font-medium text-black dark:text-white">
                      {report.data.length}
                    </span>
                  </div>

                  {/* High Risk Count */}
                  <div className="col-span-1">
                    <span className="text-sm font-poppins font-bold text-black dark:text-white">
                      {report.data.filter((item: any) => item.final_similarity >= 90).length}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="col-span-1">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-poppins text-gray-500 dark:text-gray-400">
                        {new Date(report.exportDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1">
                    <div className="flex items-center space-x-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewReport(report)}
                              className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Report</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadReport(report)}
                              className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Download Report</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDeleteReport(report.id || index.toString())}
                              className="h-8 w-8 p-0 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Report</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
