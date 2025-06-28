import React, { useState, useMemo } from 'react';
import { BatchResult } from '../types/api';
import { Eye, Flag, AlertTriangle, Shield, Download, FlagOff, FileText, ExternalLink } from 'lucide-react';
import ResultDetailModal from './ResultDetailModal';
import ImageZoomModal from './ImageZoomModal';
import JournalViewerModal from './JournalViewerModal';
import { ResultCardSkeleton } from './ui/loading-skeleton';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Search, Filter } from 'lucide-react';

interface ResultsGridProps {
  batchResults: BatchResult[];
  isLoading?: boolean;
  onExportToReports?: (exportData: any) => void;
  activeTab: 'all' | 'word' | 'device';  // Add this prop
  onTabChange: (tab: 'all' | 'word' | 'device') => void;  // Add this prop
}

interface ProcessedResult {
  id: string;
  logo_name: string;
  logo_path: string;
  text1: string;
  text2: string;
  text_similarity: number;
  vit_similarity: number;
  final_similarity: number;
  infringement_detected: boolean;
  risk_level: string;
  comparison_type: string;
  client_mark: any;
  journal_mark: any;
  client_text_display: string;
  journal_text_display: string;
}

type TabType = 'all' | 'device' | 'word';

const ResultsGrid: React.FC<ResultsGridProps> = ({ 
  batchResults, 
  isLoading = false, 
  onExportToReports,
  activeTab,  // Now controlled by parent
  onTabChange  // Now controlled by parent
}) => {
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [referenceClasses, setReferenceClasses] = useState<string[]>([]);
  const [matchClasses, setMatchClasses] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExportAllDialogOpen, setIsExportAllDialogOpen] = useState(false);
  const [deflaggedItems, setDeflaggedItems] = useState<Set<string>>(new Set());
  // Remove internal activeTab state - now controlled by parent
  const [classDescriptions, setClassDescriptions] = useState<{[key: string]: boolean}>({});
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [selectedImageZoom, setSelectedImageZoom] = useState<any>(null);
  const [isJournalViewerOpen, setIsJournalViewerOpen] = useState(false);
  const [selectedJournalApp, setSelectedJournalApp] = useState('');

  // Process ALL results from backend data - Results are already filtered by server
  const allResults: ProcessedResult[] = useMemo(() => {
    if (!batchResults || batchResults.length === 0) return [];
    
    const processedResults: ProcessedResult[] = [];
    
    // Handle the new API structure correctly
    for (const result of batchResults) {
      // The result should now match BatchResult interface
      processedResults.push({
        id: result.id,
        logo_name: result.logo_name ?? '',
        logo_path: result.logo_path ?? '',
        text1: result.text1 ?? '',
        text2: result.text2 ?? '',
        text_similarity: result.text_score ?? 0,
        vit_similarity: result.visual_score ?? 0,
        final_similarity: result.final_score ?? 0,
        infringement_detected: result.infringement_detected ?? false,
        risk_level: result.risk_level ?? '',
        comparison_type: result.comparison_type === 'device_mark' ? 'device' : 'word',
        client_mark: result.client_mark ?? {},
        journal_mark: result.journal_mark ?? {},
        client_text_display: result.client_text_display ?? '',
        journal_text_display: result.journal_text_display ?? ''
      });
    }
    
    // UPDATED: Ensure highest scores first (100%, 90%, 80%, etc.)
    return processedResults.sort((a, b) => b.final_similarity - a.final_similarity);
  }, [batchResults]);

  const getRiskLevel = (score: number) => {
    if (score >= 75) return 'High';      
    if (score >= 50) return 'Medium';    
    if (score >= 40) return 'Low';       
    return 'No Risk';
  };

  // UPDATED: Enhanced score display with color coding
  const getScoreDisplay = (score: number) => {
    const percentage = Math.round(score);
    if (percentage >= 90) return { text: `${percentage}% MATCH`, color: 'bg-red-600', textColor: 'text-white' };
    if (percentage >= 80) return { text: `${percentage}% MATCH`, color: 'bg-red-500', textColor: 'text-white' };
    if (percentage >= 70) return { text: `${percentage}% MATCH`, color: 'bg-orange-500', textColor: 'text-white' };
    if (percentage >= 60) return { text: `${percentage}% MATCH`, color: 'bg-yellow-500', textColor: 'text-white' };
    return { text: `${percentage}% MATCH`, color: 'bg-blue-500', textColor: 'text-white' };
  };

  const getRiskDisplay = (score: number, isDeflagged: boolean = false) => {
    if (isDeflagged) return { text: 'DEFLAGGED', color: 'bg-gray-500', icon: Shield };
    if (score >= 90) return { text: 'HIGH RISK', color: 'bg-red-500', icon: Flag };
    if (score >= 75) return { text: 'MEDIUM RISK', color: 'bg-orange-500', icon: AlertTriangle };
    if (score >= 50) return { text: 'LOW RISK', color: 'bg-yellow-500', icon: Shield };
    return { text: 'NO RISK', color: 'bg-green-500', icon: Shield };
  };

  // Get unique classes for filter dropdowns
  const uniqueReferenceClasses = [...new Set(allResults.map(result => result.client_mark?.class || 'N/A'))];
  const uniqueMatchClasses = [...new Set(allResults.map(result => result.journal_mark?.class || 'N/A'))];

  // Enhanced search functionality - FIXED to use backend risk_level
  const filteredResults = useMemo(() => {
    // Remove tab filtering since it's now done server-side
    let filtered = allResults.filter(result => {
      // Enhanced search - check multiple fields
      const searchFields = [
        result.logo_name,
        result.journal_mark?.application_number || '',
        result.journal_mark?.company_name || '',
        result.client_text_display || result.text1 || '',
        result.journal_text_display || result.text2 || ''
      ].join(' ').toLowerCase();
      
      const matchesSearch = searchFields.includes(searchTerm.toLowerCase());
      
      // FIXED: Use backend risk_level directly
      let matchesRisk = true;
      if (riskFilter !== 'all') {
        const backendRiskLevel = result.risk_level; // This comes from your backend
        
        // Map frontend filter values to backend risk levels  
        const riskMapping = {
          'high': 'High',
          'medium': 'Medium', 
          'low': 'Low',
          'none': 'No Risk'
        };
        
        const expectedRiskLevel = riskMapping[riskFilter as keyof typeof riskMapping];
        matchesRisk = backendRiskLevel === expectedRiskLevel;
      }
      
      let matchesClass = true;
      if (classFilter === 'same') {
        matchesClass = result.client_mark?.class === result.journal_mark?.class;
      } else if (classFilter === 'custom') {
        const refClassMatch = referenceClasses.length === 0 || referenceClasses.includes(result.client_mark?.class || 'N/A');
        const matchClassMatch = matchClasses.length === 0 || matchClasses.includes(result.journal_mark?.class || 'N/A');
        matchesClass = refClassMatch && matchClassMatch;
      }
      
      return matchesSearch && matchesRisk && matchesClass;
    });

    return filtered;
  }, [allResults, searchTerm, riskFilter, classFilter, referenceClasses, matchClasses]); 

  // FIXED: Update tab counts to also use backend risk_level
  const tabCounts = useMemo(() => {
    // Apply current filters except tab filter to get base filtered set
    const baseFiltered = allResults.filter(result => {
      const searchFields = [
        result.logo_name,
        result.journal_mark?.application_number || '',
        result.journal_mark?.company_name || '',
        result.client_text_display || result.text1 || '',
        result.journal_text_display || result.text2 || ''
      ].join(' ').toLowerCase();
      
      const matchesSearch = searchFields.includes(searchTerm.toLowerCase());
      
      let matchesRisk = true;
      if (riskFilter !== 'all') {
        // FIXED: Use backend risk_level here too
        const backendRiskLevel = result.risk_level;
        const riskMapping = {
          'high': 'High',
          'medium': 'Medium', 
          'low': 'Low',
          'none': 'No Risk'
        };
        const expectedRiskLevel = riskMapping[riskFilter as keyof typeof riskMapping];
        matchesRisk = backendRiskLevel === expectedRiskLevel;
      }
      
      let matchesClass = true;
      if (classFilter === 'same') {
        matchesClass = result.client_mark?.class === result.journal_mark?.class;
      } else if (classFilter === 'custom') {
        const refClassMatch = referenceClasses.length === 0 || referenceClasses.includes(result.client_mark?.class || 'N/A');
        const matchClassMatch = matchClasses.length === 0 || matchClasses.includes(result.journal_mark?.class || 'N/A');
        matchesClass = refClassMatch && matchClassMatch;
      }
      
      return matchesSearch && matchesRisk && matchesClass;
    });

    return {
      all: baseFiltered.length,
      device: baseFiltered.filter(r => r.comparison_type === 'device').length,
      word: baseFiltered.filter(r => r.comparison_type === 'word').length
    };
  }, [allResults, searchTerm, riskFilter, classFilter, referenceClasses, matchClasses]);

  const handleViewDetails = (result: ProcessedResult) => {
    setSelectedResult(result);
    setIsModalOpen(true);
  };

  const handleImageClick = (result: ProcessedResult) => {
    setSelectedImageZoom(result);
    setIsImageZoomOpen(true);
  };

  const handleCheckboxChange = (resultId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(resultId);
    } else {
      newSelected.delete(resultId);
    }
    setSelectedItems(newSelected);
  };

  const handleDeflag = (result: ProcessedResult) => {
    const newDeflagged = new Set(deflaggedItems);
    if (deflaggedItems.has(result.id)) {
      newDeflagged.delete(result.id);
    } else {
      newDeflagged.add(result.id);
    }
    setDeflaggedItems(newDeflagged);
    console.log(`${deflaggedItems.has(result.id) ? 'Re-flagging' : 'Deflagging'} item with id ${result.id}`);
  };

  const toggleClassDescription = (resultId: string) => {
    setClassDescriptions(prev => ({
      ...prev,
      [resultId]: !prev[resultId]
    }));
  };

  const openJournalPage = (applicationNumber: string) => {
    setSelectedJournalApp(applicationNumber);
    setIsJournalViewerOpen(true);
  };

  const toggleReferenceClass = (className: string) => {
    setReferenceClasses(prev => 
      prev.includes(className) 
        ? prev.filter(c => c !== className)
        : [...prev, className]
    );
  };

  const toggleMatchClass = (className: string) => {
    setMatchClasses(prev => 
      prev.includes(className) 
        ? prev.filter(c => c !== className)
        : [...prev, className]
    );
  };

  const exportAllRisks = () => {
    const allRiskItems = filteredResults;
    if (onExportToReports) {
      onExportToReports({
        type: 'auto-export',
        data: allRiskItems,
        exportDate: new Date().toISOString(),
        title: `All Risks Analysis - ${new Date().toLocaleDateString()}`,
        format: 'pdf'
      });
    }
    exportData(allRiskItems, 'All Risks Analysis');
    setIsExportAllDialogOpen(false);
  };

  const exportAllRisksToPDF = async () => {
    const allRiskItems = filteredResults;
    if (onExportToReports) {
      onExportToReports({
        type: 'auto-export',
        data: allRiskItems,
        exportDate: new Date().toISOString(),
        title: `All Risks Analysis - ${new Date().toLocaleDateString()}`,
        format: 'pdf'
      });
    }
    exportData(allRiskItems, 'All Risks Analysis Report');
    setIsExportAllDialogOpen(false);
  };

  // UPDATED: Enhanced CSV export with ranking
  const exportAllRisksToExcel = () => {
    const allRiskItems = filteredResults;
    
    const csvContent = [
      // UPDATED: Added Rank column and reorganized headers
      'Generated on: ' + new Date().toLocaleDateString(),
      '',
      'Rank,Similarity Score,Logo Name,Risk Level,Reference Application Number,Reference Proprietor,Reference Class,Reference DoA,Reference DoU,Reference Class Description,Reference Text,Match Application Number,Match Proprietor,Match Class,Match DoA,Match DoU,Match Class Description,Match Text,Reference Image,Match Image',
      ...allRiskItems.map((item, index) => {
        // ADDED: Calculate rank based on position in sorted list
        const rank = index + 1;
        const score = Math.round(item.final_similarity);
        
        return [
          rank, // ADDED: Rank as first column
          `${score}%`, // ADDED: Formatted score
          item.logo_name,
          deflaggedItems.has(item.id) ? 'DEFLAGGED' : getRiskDisplay(item.final_similarity).text,
          item.client_mark?.application_number || 'N/A',
          `"${item.client_mark?.business_name || 'N/A'}"`,
          item.client_mark?.class || 'N/A',
          item.client_mark?.date_of_app || 'N/A',
          item.client_mark?.status || 'N/A',
          `"${item.client_mark?.class_description || 'N/A'}"`,
          `"${item.client_text_display || item.text1 || 'No text detected'}"`,
          item.journal_mark?.application_number || 'N/A',
          `"${item.journal_mark?.company_name || 'N/A'}"`,
          item.journal_mark?.class || 'N/A',
          item.journal_mark?.application_date || 'N/A',
          item.journal_mark?.journal_date || 'N/A',
          `"${item.journal_mark?.class_description || 'N/A'}"`,
          `"${item.journal_text_display || item.text2 || 'No text detected'}"`,
          item.client_mark?.image_path || 'N/A',
          item.logo_path || 'N/A'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-risks-analysis-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if (onExportToReports) {
      onExportToReports({
        type: 'auto-export',
        data: allRiskItems,
        exportDate: new Date().toISOString(),
        title: `All Risks Analysis - ${new Date().toLocaleDateString()}`,
        format: 'excel'
      });
    }
    
    setIsExportAllDialogOpen(false);
  };

  // UPDATED: Enhanced export data with ranking
  const exportData = (dataToExport: ProcessedResult[], title: string) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
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
          .rank-badge { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #a855f7); color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; margin-right: 10px; }
          .score-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; margin-right: 10px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #555; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
        <p><strong>Note:</strong> Results sorted by highest similarity scores first</p>
        
        ${dataToExport.map((item, index) => {
          const rank = index + 1; // ADDED: Calculate rank
          const score = getScoreDisplay(item.final_similarity);
          return `
          <div class="comparison">
            <h2>
              <span class="rank-badge">#${rank}</span>
              <span class="score-badge" style="background-color: ${score.color.replace('bg-', '')}; color: white;">${score.text}</span>
              ${item.logo_name || 'Unnamed'}
            </h2>
            ${!deflaggedItems.has(item.id) ? `<div class="risk ${getRiskLevel(item.final_similarity)}">Risk Level: ${getRiskDisplay(item.final_similarity).text}</div>` : '<div class="risk">Status: DEFLAGGED</div>'}
            
            <div class="images">
              <div class="image-section">
                <h3>Reference Logo</h3>
                <img src="${item.client_mark?.image_path || 'https://via.placeholder.com/300x200?text=Client+Mark'}" alt="Reference Logo" />
                <p>${item.client_text_display || item.text1 || 'No text'}</p>
              </div>
              <div class="image-section">
                <h3>Potential Match</h3>
                <img src="${item.logo_path || 'https://via.placeholder.com/300x200?text=Journal+Mark'}" alt="Match Logo" />
                <p>${item.journal_text_display || item.text2 || 'No text'}</p>
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
                  <td><strong>Rank</strong></td>
                  <td colspan="2">#${rank} (${Math.round(item.final_similarity)}% similarity)</td>
                </tr>
                <tr>
                  <td><strong>Application Number</strong></td>
                  <td>${item.client_mark?.application_number || 'N/A'}</td>
                  <td>${item.journal_mark?.application_number || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Proprietor</strong></td>
                  <td>${item.client_mark?.business_name || 'N/A'}</td>
                  <td>${item.journal_mark?.company_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Class</strong></td>
                  <td>${item.client_mark?.class || 'N/A'}</td>
                  <td>${item.journal_mark?.class || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Date of Application</strong></td>
                  <td>${item.client_mark?.date_of_app || 'N/A'}</td>
                  <td>${item.journal_mark?.application_date || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Date of Use</strong></td>
                  <td>${item.client_mark?.status || 'N/A'}</td>
                  <td>${item.journal_mark?.journal_date || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Extracted Text</strong></td>
                  <td>${item.client_text_display || item.text1 || 'No text detected'}</td>
                  <td>${item.journal_text_display || item.text2 || 'No text detected'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;}).join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  // UPDATED: Enhanced selected export with ranking
  const exportToPDF = async () => {
    const selectedData = filteredResults.filter(result => selectedItems.has(result.id));
    if (onExportToReports) {
      onExportToReports({
        type: 'selected-export',
        data: selectedData,
        exportDate: new Date().toISOString(),
        title: `Selected Analysis - ${new Date().toLocaleDateString()}`,
        format: 'pdf'
      });
    }
    exportData(selectedData, 'Trademark Analysis Report');
    setIsExportDialogOpen(false);
    setSelectedItems(new Set());
  };

  // UPDATED: Enhanced selected Excel export with ranking
  const exportToExcel = () => {
    const selectedData = filteredResults.filter(result => selectedItems.has(result.id));
    
    const csvContent = [
      'Generated on: ' + new Date().toLocaleDateString(),
      '',
      'Rank,Similarity Score,Logo Name,Risk Level,Reference Application Number,Reference Proprietor,Reference Class,Reference DoA,Reference DoU,Reference Class Description,Reference Text,Match Application Number,Match Proprietor,Match Class,Match DoA,Match DoU,Match Class Description,Match Text,Reference Image,Match Image',
      ...selectedData.map((item, index) => {
        const rank = filteredResults.findIndex(r => r.id === item.id) + 1; // ADDED: Find rank in original list
        const score = Math.round(item.final_similarity);
        
        return [
          rank, // ADDED: Rank
          `${score}%`, // ADDED: Formatted score
          item.logo_name,
          deflaggedItems.has(item.id) ? 'DEFLAGGED' : getRiskDisplay(item.final_similarity).text,
          item.client_mark?.application_number || 'N/A',
          `"${item.client_mark?.business_name || 'N/A'}"`,
          item.client_mark?.class || 'N/A',
          item.client_mark?.date_of_app || 'N/A',
          item.client_mark?.status || 'N/A',
          `"${item.client_mark?.class_description || 'N/A'}"`,
          `"${item.client_text_display || item.text1 || 'No text detected'}"`,
          item.journal_mark?.application_number || 'N/A',
          `"${item.journal_mark?.company_name || 'N/A'}"`,
          item.journal_mark?.class || 'N/A',
          item.journal_mark?.application_date || 'N/A',
          item.journal_mark?.journal_date || 'N/A',
          `"${item.journal_mark?.class_description || 'N/A'}"`,
          `"${item.journal_text_display || item.text2 || 'No text detected'}"`,
          item.client_mark?.image_path || 'N/A',
          item.logo_path || 'N/A'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trademark-analysis-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if (onExportToReports) {
      onExportToReports({
        type: 'selected-export',
        data: selectedData,
        exportDate: new Date().toISOString(),
        title: `Selected Analysis - ${new Date().toLocaleDateString()}`,
        format: 'excel'
      });
    }
    
    setIsExportDialogOpen(false);
    setSelectedItems(new Set());
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-8">
          <h2 className="text-2xl font-poppins font-bold text-black dark:text-white mb-2">Analysis Results</h2>
          <p className="font-poppins text-gray-500 dark:text-gray-400">Loading results...</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <ResultCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (allResults.length === 0) {
    return (
      <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 p-8">
        <div className="text-center py-16">
          <h3 className="text-lg font-medium text-black dark:text-white mb-4 font-poppins">
            No Comparison Results Found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 font-poppins">
            No comparison results were found for the selected filter.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-poppins font-bold text-black dark:text-white mb-2">Analysis Results</h2>
          {/* UPDATED: Added indicator for sorting by highest scores */}
          <p className="font-poppins text-gray-500 dark:text-gray-400">
            {filteredResults.length} potential infringement{filteredResults.length !== 1 ? 's' : ''} detected • Sorted by highest similarity scores
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Dialog open={isExportAllDialogOpen} onOpenChange={setIsExportAllDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-poppins">
                <Download className="mr-2 h-4 w-4" />
                Export All Risks
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-black border-gray-200 dark:border-gray-800">
              <DialogHeader>
                <DialogTitle className="text-black dark:text-white font-poppins">Export Options</DialogTitle>
                <DialogDescription className="text-gray-500 dark:text-gray-400 font-poppins">
                  Choose your preferred export format for all trademark analysis results.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-4 mt-4">
                <Button 
                  onClick={exportAllRisksToPDF}
                  className="flex-1 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-poppins"
                >
                  Export as PDF
                </Button>
                <Button 
                  onClick={exportAllRisksToExcel}
                  className="flex-1 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-poppins"
                >
                  Export as Excel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {selectedItems.size > 0 && (
            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-poppins">
                  <Download className="mr-2 h-4 w-4" />
                  Export Selected ({selectedItems.size})
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-black border-gray-200 dark:border-gray-800">
                <DialogHeader>
                  <DialogTitle className="text-black dark:text-white font-poppins">Export Options</DialogTitle>
                  <DialogDescription className="text-gray-500 dark:text-gray-400 font-poppins">
                    Choose your preferred export format for the selected trademark analysis results.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-4 mt-4">
                  <Button 
                    onClick={exportToPDF}
                    className="flex-1 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-poppins"
                  >
                    Export as PDF
                  </Button>
                  <Button 
                    onClick={exportToExcel}
                    className="flex-1 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 font-poppins"
                  >
                    Export as Excel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters - Improved responsive layout */}
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6 overflow-x-auto">
        <div className="flex flex-col space-y-4 min-w-max">
          <div className="flex items-center space-x-4">
            <div className="flex-1 min-w-0 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by logo name, app number, proprietor, or text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-poppins text-sm"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-black dark:text-white rounded-lg px-3 py-2 text-sm font-poppins focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="high">High Risk (≥75%)</option>
                  <option value="medium">Medium Risk (65-75%)</option>
                  <option value="low">Low Risk (30-65%)</option>
                  <option value="none">No Risk (&lt;30%)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm font-poppins text-gray-500">Class:</span>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-black dark:text-white rounded-lg px-3 py-2 text-sm font-poppins focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="all">All Classes</option>
                  <option value="same">Same Class</option>
                  <option value="custom">Custom Selection</option>
                </select>
              </div>
            </div>
          </div>

          {classFilter === 'custom' && (
            <div className="flex items-center space-x-4 pt-2 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-poppins text-gray-500">Ref Classes:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40 justify-start">
                      {referenceClasses.length > 0 ? `${referenceClasses.length} selected` : 'Select classes'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-white dark:bg-black border-gray-200 dark:border-gray-800 z-50">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {uniqueReferenceClasses.map(cls => (
                        <div key={cls} className="flex items-center space-x-2">
                          <Checkbox
                            checked={referenceClasses.includes(cls)}
                            onCheckedChange={() => toggleReferenceClass(cls)}
                          />
                          <span className="text-sm">{cls}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm font-poppins text-gray-500">Match Classes:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40 justify-start">
                      {matchClasses.length > 0 ? `${matchClasses.length} selected` : 'Select classes'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-white dark:bg-black border-gray-200 dark:border-gray-800 z-50">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {uniqueMatchClasses.map(cls => (
                        <div key={cls} className="flex items-center space-x-2">
                          <Checkbox
                            checked={matchClasses.includes(cls)}
                            onCheckedChange={() => toggleMatchClass(cls)}
                          />
                          <span className="text-sm">{cls}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm font-poppins text-gray-500 dark:text-gray-400">
            Showing {filteredResults.length} potential infringement{filteredResults.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Enhanced Navigation Tabs - Full width layout */}
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-2">
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => onTabChange('all')}
            className={`px-6 py-4 rounded-lg text-sm font-poppins font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            All Infringements ({tabCounts.all})
          </button>
          <button
            onClick={() => onTabChange('device')}
            className={`px-6 py-4 rounded-lg text-sm font-poppins font-medium transition-colors ${
              activeTab === 'device'
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Device Mark Comparison ({tabCounts.device})
          </button>
          <button
            onClick={() => onTabChange('word')}
            className={`px-6 py-4 rounded-lg text-sm font-poppins font-medium transition-colors ${
              activeTab === 'word'
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Word Mark Comparison ({tabCounts.word})
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10">
        {filteredResults.map((result, index) => {
          const isDeflagged = deflaggedItems.has(result.id);
          const risk = getRiskDisplay(result.final_similarity, isDeflagged);
          const scoreDisplay = getScoreDisplay(result.final_similarity); // ADDED: Score display
          const rank = index + 1; // ADDED: Calculate rank
          const RiskIcon = risk.icon;
          
          return (
            <div key={result.id} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all duration-300 group flex flex-col relative z-20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={selectedItems.has(result.id)}
                    onCheckedChange={(checked) => handleCheckboxChange(result.id, !!checked)}
                    className="border-gray-300 dark:border-gray-600"
                  />
                  
                  {/* ADDED: Ranking Badge */}
                  <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-100 to-purple-200">
                    <span className="text-xs font-poppins font-bold text-purple-800">
                      #{rank}
                    </span>
                  </div>
                  
                  {/* UPDATED: Enhanced Score Badge with Color Coding */}
                  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${scoreDisplay.color}`}>
                    <span className="text-xs font-poppins font-bold text-white">
                      {scoreDisplay.text}
                    </span>
                  </div>
                  
                  {!isDeflagged && (
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${risk.color}`}>
                      <RiskIcon className="w-3 h-3 text-black" />
                      <span className="text-xs font-poppins font-bold text-black">
                        {risk.text}
                      </span>
                    </div>
                  )}
                  {isDeflagged && (
                    <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-500">
                      <Shield className="w-3 h-3 text-white" />
                      <span className="text-xs font-poppins font-bold text-white">
                        DEFLAGGED
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <h4 className="text-sm font-poppins font-medium text-black dark:text-white mb-4 truncate">
                {result.client_text_display || result.text1 || result.logo_name || 'Unnamed'}
              </h4>

              {/* Improved image display section */}
              <div className="relative mb-4">
                <div className="grid grid-cols-2 gap-4 h-32">
                  {/* Reference Image Container */}
                  <div 
                    className="relative flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden"
                    onClick={() => handleImageClick(result)}
                  >
                    {result.client_mark?.image_path ? (
                      <img 
                        src={result.client_mark.image_path}
                        alt="Reference"
                        className="max-h-28 max-w-full object-contain p-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://via.placeholder.com/120x120?text=Client+Mark";
                        }}
                      />
                    ) : (
                      <div className="text-xs text-gray-400 dark:text-gray-500 text-center p-2 max-w-full">
                        <div className="font-mono text-xs break-words">
                          {result.client_text_display || result.text1 || 'No Image'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Match Image Container */}
                  <div 
                    className="relative flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden"
                    onClick={() => handleImageClick(result)}
                  >
                    {result.logo_path ? (
                      <img 
                        src={result.logo_path}
                        alt="Match"
                        className="max-h-28 max-w-full object-contain p-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://via.placeholder.com/120x120?text=Journal+Mark";
                        }}
                      />
                    ) : (
                      <div className="text-xs text-gray-400 dark:text-gray-500 text-center p-2 max-w-full">
                        <div className="font-mono text-xs break-words">
                          {result.journal_text_display || result.text2 || 'No Image'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* VS Badge - positioned outside the image grid */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 shadow-lg z-10">
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300">VS</span>
                </div>
              </div>

              {/* Details in table format */}
              <div className="space-y-4 mb-4 text-xs font-poppins border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <th className="text-left p-2 font-medium text-gray-600 dark:text-gray-300">Detail</th>
                      <th className="text-left p-2 font-medium text-gray-600 dark:text-gray-300">Reference</th>
                      <th className="text-left p-2 font-medium text-gray-600 dark:text-gray-300">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-200 dark:border-gray-800">
                      <td className="p-2 text-gray-500 dark:text-gray-400">App. Number</td>
                      <td className="p-2 text-black dark:text-white">{result.client_mark?.application_number || 'N/A'}</td>
                      <td className="p-2 text-black dark:text-white">{result.journal_mark?.application_number || 'N/A'}</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-800">
                      <td className="p-2 text-gray-500 dark:text-gray-400">Proprietor</td>
                      <td className="p-2 text-black dark:text-white">{result.client_mark?.business_name || 'N/A'}</td>
                      <td className="p-2 text-black dark:text-white">{result.journal_mark?.company_name || 'N/A'}</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-800">
                      <td className="p-2 text-gray-500 dark:text-gray-400">Class</td>
                      <td className="p-2 text-black dark:text-white">{result.client_mark?.class || 'N/A'}</td>
                      <td className="p-2 text-black dark:text-white">{result.journal_mark?.class || 'N/A'}</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-800">
                      <td className="p-2 text-gray-500 dark:text-gray-400">DoA</td>
                      <td className="p-2 text-black dark:text-white">{result.client_mark?.date_of_app || 'N/A'}</td>
                      <td className="p-2 text-black dark:text-white">{result.journal_mark?.application_date || 'N/A'}</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-800">
                      <td className="p-2 text-gray-500 dark:text-gray-400">DoU</td>
                      <td className="p-2 text-black dark:text-white">{result.client_mark?.status || 'N/A'}</td>
                      <td className="p-2 text-black dark:text-white">{result.journal_mark?.journal_date || 'N/A'}</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-800">
                      <td className="p-2 text-gray-500 dark:text-gray-400">Extracted Text</td>
                      <td className="p-2 text-black dark:text-white font-mono text-xs">
                        {result.client_text_display || result.text1 || <span className="italic text-gray-500">No text detected</span>}
                      </td>
                      <td className="p-2 text-black dark:text-white font-mono text-xs">
                        {result.journal_text_display || result.text2 || <span className="italic text-gray-500">No text detected</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Class Description Display */}
              {classDescriptions[result.id] && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="text-xs font-poppins">
                    <div className="mb-2">
                      <span className="font-medium text-gray-600 dark:text-gray-300">Reference Class Description:</span>
                      <p className="text-black dark:text-white mt-1">{result.client_mark?.class_description || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-300">Match Class Description:</span>
                      <p className="text-black dark:text-white mt-1">{result.journal_mark?.class_description || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* UPDATED: Action bar with rank information */}
              <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
                {/* ADDED: Rank and score display */}
                <div className="mb-3">
                  <span className="text-xs font-poppins text-gray-500 dark:text-gray-400">
                    Rank #{rank} • {Math.round(result.final_similarity)}% similarity
                  </span>
                </div>
                
                <TooltipProvider>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-wrap gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleClassDescription(result.id)}
                            className="font-poppins text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
                          >
                            <FileText className="mr-1 w-3 h-3" />
                            {classDescriptions[result.id] ? 'Hide' : 'Show'} Classes
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{classDescriptions[result.id] ? 'Hide' : 'Show'} class descriptions</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openJournalPage(result.journal_mark?.application_number || '')}
                            className="font-poppins text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
                          >
                            <ExternalLink className="mr-1 w-3 h-3" />
                            View in Journal
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Open trademark journal page</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeflag(result)}
                            className="font-poppins text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
                          >
                            <FlagOff className="mr-1 w-3 h-3" />
                            {isDeflagged ? 'Re-flag' : 'Deflag'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isDeflagged ? 'Mark as infringement' : 'Mark as not infringement'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </TooltipProvider>
              </div>
            </div>
          );
        })}
      </div>

      <ResultDetailModal
        result={selectedResult}
        referenceImage={selectedResult?.client_mark?.image_path || ""}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <ImageZoomModal
        isOpen={isImageZoomOpen}
        onClose={() => setIsImageZoomOpen(false)}
        referenceImage={selectedImageZoom?.client_mark?.image_path || ""}
        matchImage={selectedImageZoom?.logo_path || ''}
        referenceName={selectedImageZoom?.client_text_display || ''}
        matchName={selectedImageZoom?.logo_name || ''}
        result={selectedImageZoom}
      />

      <JournalViewerModal
        isOpen={isJournalViewerOpen}
        onClose={() => setIsJournalViewerOpen(false)}
        applicationNumber={selectedJournalApp}
      />
    </div>
  );
};

export default ResultsGrid;
