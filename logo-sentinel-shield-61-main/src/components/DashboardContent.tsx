import React, { useState, useEffect } from 'react';
import { AnalysisResponse } from '../types/api';
import AnalysisResultsView from './AnalysisResultsView';
import DashboardOverview from './DashboardOverview';
import TimelineView from './TimelineView';
import ReportsView from './ReportsView';
import ClientDatabaseView from './ClientDatabaseView';
import JournalDataView from './JournalDataView';
import JournalListView from './JournalListView';
import JournalUploadSection from './JournalUploadSection';
import { getJournals, uploadJournal } from '../services/api';

interface DashboardContentProps {
  activeView: 'home' | 'results' | 'reports' | 'timeline' | 'client-database' | 'journal-data';
  onStartAnalysis: (sessionId: string) => void;
  analysisResults: AnalysisResponse | null;
  isAnalyzing: boolean;
  analysisHistory: any[];
  onSelectAnalysis: (analysisId: string) => void;
  exportedReports?: any[];
  onDeleteReport?: (reportId: string) => void;
  onExportToReports?: (exportData: any) => void;
  currentSessionId?: string | null;
  onAnalysisComplete?: (sessionId?: string) => void; // NEW: Add this
}

const DashboardContent: React.FC<DashboardContentProps> = ({
  activeView,
  onStartAnalysis,
  analysisResults,
  isAnalyzing,
  analysisHistory,
  onSelectAnalysis,
  exportedReports = [],
  onDeleteReport = () => {},
  onExportToReports,
  currentSessionId
}) => {
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [showJournalList, setShowJournalList] = useState(true);
  const [journalHistory, setJournalHistory] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load journals from API
  useEffect(() => {
    const loadJournals = async () => {
      try {
        console.log('Loading journals from API...');
        const journals = await getJournals();
        console.log('Loaded journals:', journals);
        setJournalHistory(journals);
      } catch (error) {
        console.error('Failed to load journals:', error);
        setJournalHistory([]); // Set empty array on error
      }
    };

    if (activeView === 'journal-data') {
      loadJournals();
    }
  }, [activeView, refreshTrigger]); // Added refreshTrigger dependency

  const handleSelectJournal = (journalId: string) => {
    setSelectedJournalId(journalId);
    setShowJournalList(false);
  };

  const handleBackToJournalList = () => {
    setSelectedJournalId(null);
    setShowJournalList(true);
    // Refresh journal list when going back
    setRefreshTrigger(prev => prev + 1);
  };

  const handleAddJournal = async () => {
    // Create file input for journal upload
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          console.log('Uploading journal:', file.name);
          await uploadJournal(file);
          console.log('Journal uploaded successfully');
          
          // Refresh the journal list after successful upload
          setRefreshTrigger(prev => prev + 1);
          
          // Show success message (you can add a toast notification here)
          alert('Journal uploaded successfully!');
        } catch (error) {
          console.error('Failed to upload journal:', error);
          alert('Failed to upload journal. Please try again.');
        }
      }
    };
    input.click();
  };

  // Enhanced journal upload handler that refreshes the list
  const handleJournalUploadSuccess = () => {
    console.log('Journal upload completed, refreshing journal list...');
    setRefreshTrigger(prev => prev + 1);
  };

  if (activeView === 'home') {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-black">
        {/* Journal Upload Section - Top */}
        <div className="max-w-6xl">
          <JournalUploadSection 
            onAnalysisStart={onStartAnalysis}
            isAnalyzing={isAnalyzing}
          />
        </div>
        
        {/* Dashboard Overview - Bottom */}
        <div className="max-w-6xl">
          <DashboardOverview 
            analysisHistory={analysisHistory}
            onSelectAnalysis={onSelectAnalysis}
          />
        </div>
      </div>
    );
  }
  
  if (activeView === 'results') {
    const onAnalysisComplete = () => {
      // Refresh analysis history when analysis completes
      // This ensures the timeline and dashboard overview show the latest results
      console.log('Analysis completed, refreshing data...');
      
      // You could trigger a refresh of analysis history here
      // For now, we'll just log the completion
      // In a full implementation, you might want to:
      // - Refresh the analysis history
      // - Show a success notification
      // - Navigate to results view automatically
    };
  return (
    <AnalysisResultsView 
      analysisResults={analysisResults}
      isAnalyzing={isAnalyzing}
      onExportToReports={onExportToReports}
      currentSessionId={currentSessionId}
      onAnalysisComplete={onAnalysisComplete} // NEW: Pass the callback
    />
  );
}

  if (activeView === 'timeline') {
    return (
      <TimelineView 
        analysisHistory={analysisHistory}
        onSelectAnalysis={onSelectAnalysis}
      />
    );
  }

  if (activeView === 'reports') {
    return (
      <ReportsView 
        exportedReports={exportedReports}
        onDeleteReport={onDeleteReport}
      />
    );
  }

  if (activeView === 'client-database') {
    return <ClientDatabaseView onExportToReports={onExportToReports} />;
  }

  if (activeView === 'journal-data') {
    if (showJournalList) {
      return (
        <JournalListView
          journals={journalHistory}
          onSelectJournal={handleSelectJournal}
          onAddJournal={handleAddJournal}
        />
      );
    } else {
      return (
        <JournalDataView
          journalId={selectedJournalId || undefined}
          onBack={handleBackToJournalList}
          onExportToReports={onExportToReports}
        />
      );
    }
  }

  return (
    <div className="p-6 bg-white dark:bg-black">
      <div className="text-center py-16">
        <h3 className="text-lg font-medium text-black dark:text-white mb-4">
          Coming Soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          This feature is under development.
        </p>
      </div>
    </div>
  );
};

export default DashboardContent;
