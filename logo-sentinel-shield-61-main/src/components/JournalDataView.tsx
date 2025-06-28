import React, { useState, useEffect } from 'react';
import { Plus, Upload, FileSpreadsheet, FileText, Search, X, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from './ui/pagination';
import { getJournalData, uploadJournal, exportReport } from '../services/api';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ isOpen, onClose, imageUrl, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-poppins font-semibold text-black dark:text-white">{title}</h3>
          <Button variant="outline" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-6 flex items-center justify-center">
          <img src={imageUrl} alt={title} className="max-w-full max-h-[60vh] object-contain" />
        </div>
      </div>
    </div>
  );
};

interface JournalDataViewProps {
  journalId?: string;
  onBack?: () => void;
  onExportToReports?: (exportData: any) => void;
}

const JournalDataView: React.FC<JournalDataViewProps> = ({ journalId, onBack, onExportToReports }) => {
  const [journalData, setJournalData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [entryType, setEntryType] = useState('all');
  const [zoomModal, setZoomModal] = useState<{ isOpen: boolean; imageUrl: string; title: string }>({
    isOpen: false,
    imageUrl: '',
    title: ''
  });
  
  const entriesPerPage = 50;

  // Load journal data from API
  useEffect(() => {
    const loadJournalData = async () => {
      if (!journalId) return;
      
      setLoading(true);
      try {
        const data = await getJournalData(journalId, currentPage, entriesPerPage, entryType);
        setJournalData(data);
      } catch (error) {
        console.error('Failed to load journal data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadJournalData();
  }, [journalId, currentPage, entryType]);

  const handleSelectAll = () => {
    if (!journalData?.entries) return;
    
    if (selectedEntries.length === journalData.entries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(journalData.entries.map((entry: any) => entry.id));
    }
  };

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntries(prev =>
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedEntries([]);
  };

  const handleUploadPDF = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await uploadJournal(file);
          console.log('Journal uploaded successfully');
          // Refresh the data
          window.location.reload();
        } catch (error) {
          console.error('Failed to upload journal:', error);
        }
      }
    };
    input.click();
  };

  const handleExportSelected = async (format: 'excel' | 'pdf') => {
    if (!journalData || !journalId) return;

    const exportData = selectedEntries.length > 0
      ? journalData.entries.filter((entry: any) => selectedEntries.includes(entry.id))
      : journalData.entries;

    try {
      const reportData = {
        session_id: journalId,
        format: format === 'excel' ? 'csv' : 'pdf',
        title: `Journal ${journalData.journal_info?.journal_no} Export`,
        selected_results: exportData
      };

      const result = await exportReport(reportData);
      
      // Download the file
      const response = await fetch(result.download_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `journal_${journalData.journal_info?.journal_no}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'csv' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Export to Reports if callback is provided
      if (onExportToReports) {
        onExportToReports({
          id: result.report_id,
          name: reportData.title,
          type: 'Journal Data Export',
          createdAt: new Date().toISOString(),
          size: `${exportData.length} entries`,
          format: format === 'excel' ? 'Excel' : 'PDF',
          source: `Journal ${journalData.journal_info?.journal_no}`,
          data: exportData
        });
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const handleImageClick = (imageUrl: string, title: string) => {
    setZoomModal({ isOpen: true, imageUrl, title });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-black">
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading journal data...</p>
        </div>
      </div>
    );
  }

  if (!journalData) {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-black">
        <div className="text-center py-16">
          <h3 className="text-lg font-medium text-black dark:text-white mb-4">
            Journal not found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            The requested journal could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const { journal_info, entries, pagination } = journalData;
  const totalPages = pagination?.pages || 1;

  // Filter entries based on search term
  const filteredEntries = entries.filter((entry: any) =>
    entry.application_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.proprietor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.word_mark?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderPaginationItems = () => {
    const items = [];
    
    // Always show first page
    items.push(
      <PaginationItem key={1}>
        <PaginationLink
          onClick={() => handlePageChange(1)}
          isActive={currentPage === 1}
          className="cursor-pointer"
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    // Show page 2 if we have more than 1 page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key={2}>
          <PaginationLink
            onClick={() => handlePageChange(2)}
            isActive={currentPage === 2}
            className="cursor-pointer"
          >
            2
          </PaginationLink>
        </PaginationItem>
      );
    }

    // If totalPages is 3, show page 3 without ellipsis
    // If totalPages > 3, show ellipsis and last page
    if (totalPages === 3) {
      items.push(
        <PaginationItem key={3}>
          <PaginationLink
            onClick={() => handlePageChange(3)}
            isActive={currentPage === 3}
            className="cursor-pointer"
          >
            3
          </PaginationLink>
        </PaginationItem>
      );
    } else if (totalPages > 3) {
      items.push(
        <PaginationItem key="ellipsis">
          <PaginationEllipsis />
        </PaginationItem>
      );

      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            onClick={() => handlePageChange(totalPages)}
            isActive={currentPage === totalPages}
            className="cursor-pointer"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-black">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <Button
              onClick={onBack}
              variant="outline"
              size="icon"
              className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h2 className="text-3xl font-poppins font-bold text-black dark:text-white mb-2">Journal Data</h2>
            <h3 className="text-xl font-poppins font-semibold text-black dark:text-white mb-2">
              Journal No: {journal_info.journal_no} | Journal Date: {journal_info.journal_date}
            </h3>
            <p className="font-poppins text-gray-600 dark:text-gray-400">
              Total entries: {pagination?.total || 0}
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleUploadPDF}
          className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 flex items-center space-x-2"
        >
          <Upload className="w-4 h-4" />
          <span>Add Journal PDF</span>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
          <Input
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white dark:bg-black border-gray-300 dark:border-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>

        {selectedEntries.length > 0 && (
          <div className="flex items-center space-x-3">
            <span className="text-sm font-poppins text-gray-600 dark:text-gray-400">
              {selectedEntries.length} selected
            </span>
            <Button
              onClick={() => handleExportSelected('excel')}
              variant="outline"
              className="flex items-center space-x-2 border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </Button>
            <Button
              onClick={() => handleExportSelected('pdf')}
              variant="outline"
              className="flex items-center space-x-2 border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              <FileText className="w-4 h-4" />
              <span>Export PDF</span>
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-black border border-gray-300 dark:border-gray-700 rounded-xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="text-black dark:text-white font-semibold">S.No</TableHead>
              <TableHead className="text-black dark:text-white font-semibold">Application Number</TableHead>
              <TableHead className="text-black dark:text-white font-semibold">DOA/DOU</TableHead>
              <TableHead className="text-black dark:text-white font-semibold">Proprietor Name</TableHead>
              <TableHead className="text-black dark:text-white font-semibold">Company Name</TableHead>
              <TableHead className="text-black dark:text-white font-semibold">Class</TableHead>
              <TableHead className="text-black dark:text-white font-semibold">Device Mark</TableHead>
              <TableHead className="text-black dark:text-white font-semibold">Word Mark</TableHead>
              <TableHead className="text-black dark:text-white font-semibold">Legal Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.map((entry: any, index: number) => (
              <TableRow key={entry.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                <TableCell>
                  <Checkbox
                    checked={selectedEntries.includes(entry.id || index.toString())}
                    onCheckedChange={() => handleSelectEntry(entry.id || index.toString())}
                  />
                </TableCell>
                <TableCell className="font-medium text-black dark:text-white">{entry.s_no || index + 1}</TableCell>
                <TableCell className="text-black dark:text-white">{entry.application_number}</TableCell>
                <TableCell className="text-black dark:text-white">{entry.doa_or_dou}</TableCell>
                <TableCell className="text-black dark:text-white">{entry.proprietor_name}</TableCell>
                <TableCell className="text-black dark:text-white">{entry.company_name}</TableCell>
                <TableCell className="text-black dark:text-white">{entry.class}</TableCell>
                <TableCell>
                  {entry.device_mark && (
                    <img 
                      src={entry.device_mark} 
                      alt="Device Mark" 
                      className="w-12 h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleImageClick(entry.device_mark, `${entry.proprietor_name} - Device Mark`)}
                    />
                  )}
                </TableCell>
                <TableCell className="font-medium text-black dark:text-white">{entry.word_mark}</TableCell>
                <TableCell className="text-black dark:text-white">{entry.legal_status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {renderPaginationItems()}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      
      {totalPages > 1 && pagination && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          Showing {(currentPage - 1) * entriesPerPage + 1}-{Math.min(currentPage * entriesPerPage, pagination.total)} of {pagination.total} entries
        </div>
      )}

      {filteredEntries.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-black">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-xl font-poppins font-semibold text-gray-600 dark:text-gray-400 mb-4">
            No journal entries found
          </h3>
          <p className="font-poppins text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {searchTerm ? 'Try adjusting your search terms.' : 'No entries available for this journal.'}
          </p>
        </div>
      )}

      <ImageZoomModal
        isOpen={zoomModal.isOpen}
        onClose={() => setZoomModal({ isOpen: false, imageUrl: '', title: '' })}
        imageUrl={zoomModal.imageUrl}
        title={zoomModal.title}
      />
    </div>
  );
};

export default JournalDataView;
