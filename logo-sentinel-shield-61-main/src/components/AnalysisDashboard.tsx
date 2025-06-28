import React, { useState, useEffect } from 'react';
import { AnalysisResponse } from '../types/api';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import DashboardContent from './DashboardContent';
import BackendStatus from './BackendStatus';
import { getAnalysisHistory, getReports, getJournals, healthCheck } from '../services/api';

interface AnalysisDashboardProps {
  onStartAnalysis: (sessionId: string) => void;
  analysisResults: AnalysisResponse | null;
  isAnalyzing: boolean;
  analysisHistory: any[];
  onSelectAnalysis: (analysisId: string) => void;
  exportedReports?: any[];
  onDeleteReport?: (reportId: string) => void;
  onExportToReports?: (exportData: any) => void;
  currentSessionId?: string | null;
  onAnalysisComplete?: (sessionId?: string) => void; // NEW: Add callback prop
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  onStartAnalysis,
  analysisResults,
  isAnalyzing,
  analysisHistory,
  onSelectAnalysis,
  exportedReports = [],
  onDeleteReport,
  onExportToReports,
  currentSessionId,
  onAnalysisComplete // NEW: Receive callback
}) => {
  const [activeView, setActiveView] = useState<'home' | 'results' | 'reports' | 'timeline' | 'client-database' | 'journal-data'>('home');
  const [showBackendStatus, setShowBackendStatus] = useState(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  // Check backend connectivity on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await healthCheck();
        setBackendConnected(true);
        setShowBackendStatus(false);
      } catch (error) {
        setBackendConnected(false);
        setShowBackendStatus(true);
        console.warn('Backend not available, showing status notification');
      }
    };

    checkBackend();
  }, []);

  const handleAnalysisStart = (sessionId: string) => {
    setActiveView('results');
    onStartAnalysis(sessionId);
  };

  // Enhanced onSelectAnalysis that includes view switching
  const handleSelectAnalysisWithViewSwitch = async (analysisId: string) => {
    console.log('Selecting analysis and switching to results view:', analysisId);
    
    // Call the original onSelectAnalysis function to fetch data
    await onSelectAnalysis(analysisId);
    
    // Switch to results view after data is loaded
    setActiveView('results');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader />
      
      {/* Backend Status Notification */}
      {showBackendStatus && (
        <BackendStatus onClose={() => setShowBackendStatus(false)} />
      )}
      
      <div className="flex pt-16">
        <DashboardSidebar 
          analysisResults={analysisResults}
          activeView={activeView}
          onViewChange={setActiveView}
        />
        
        <main className="flex-1 ml-64">
          <DashboardContent
            activeView={activeView}
            onStartAnalysis={handleAnalysisStart}
            analysisResults={analysisResults}
            isAnalyzing={isAnalyzing}
            analysisHistory={analysisHistory}
            onSelectAnalysis={handleSelectAnalysisWithViewSwitch} 
            exportedReports={exportedReports}
            onDeleteReport={onDeleteReport}
            onExportToReports={onExportToReports}
            currentSessionId={currentSessionId}
            onAnalysisComplete={onAnalysisComplete} // NEW: Pass callback down
          />
        </main>
      </div>
      
      {/* Backend connectivity indicator in bottom corner */}
      <div className="fixed bottom-4 left-4 z-10">
        <div 
          className={`flex items-center space-x-2 px-3 py-2 rounded-full text-xs font-poppins cursor-pointer transition-all ${
            backendConnected === true
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : backendConnected === false
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
          }`}
          onClick={() => setShowBackendStatus(!showBackendStatus)}
        >
          <div className={`w-2 h-2 rounded-full ${
            backendConnected === true ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span>
            {backendConnected === true ? 'Backend Connected' : 'Backend Offline'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;
