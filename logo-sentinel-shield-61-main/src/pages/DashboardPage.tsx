import React, { useState, useEffect } from 'react';
import AnalysisDashboard from '../components/AnalysisDashboard';
import { AnalysisResponse } from '../types/api';
import { getAnalysisHistory, getReports, getJournals, getAnalysisResults } from '../services/api';

const DashboardPage = () => {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [exportedReports, setExportedReports] = useState<any[]>([]);
  const [journalHistory, setJournalHistory] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial data from API
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        console.log('🚀 === LOADING DASHBOARD DATA ===');
        
        // Load analysis history with detailed logging
        console.log('📊 Fetching analysis history...');
        const history = await getAnalysisHistory();
        console.log('📋 Analysis history raw response:', history);
        
        if (Array.isArray(history)) {
          console.log(`✅ Setting ${history.length} analysis records`);
          setAnalysisHistory(history);
        } else {
          console.warn('⚠️ Analysis history is not an array:', typeof history);
          setAnalysisHistory([]);
        }

        // Load reports
        console.log('📄 Fetching reports...');
        const reports = await getReports();
        console.log('📄 Reports received:', reports);
        setExportedReports(reports || []);

        // Load journals
        console.log('📚 Fetching journals...');
        const journals = await getJournals();
        console.log('📚 Journals received:', journals);
        setJournalHistory(journals || []);

        console.log('✅ === DASHBOARD DATA LOADED ===');
      } catch (error) {
        console.error('💥 Failed to load initial data:', error);
        setAnalysisHistory([]);
        setExportedReports([]);
        setJournalHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStartAnalysis = async (sessionId: string) => {
    console.log('🔬 Starting analysis with session ID:', sessionId);
    setIsAnalyzing(true);
    setCurrentSessionId(sessionId);
    setAnalysisResults(null);
  };

  const handleAnalysisComplete = async (sessionId: string) => {
    console.log('✅ Analysis completed for session:', sessionId);
    try {
      const results = await getAnalysisResults(sessionId, 1, 50);
      console.log('📊 Loaded completed analysis results:', results);
      
      setAnalysisResults(results);
      setIsAnalyzing(false);
      
      // Refresh analysis history
      const history = await getAnalysisHistory();
      setAnalysisHistory(history || []);
    } catch (error) {
      console.error('💥 Failed to load completed analysis results:', error);
      setIsAnalyzing(false);
    }
  };

  const handleSelectAnalysis = async (analysisId: string) => {
    const selectedAnalysis = analysisHistory.find(item => item.id === analysisId);
    if (selectedAnalysis) {
      console.log('👆 Selected analysis:', analysisId);
      try {
        const results = await getAnalysisResults(analysisId, 1, 50);
        console.log('📊 Loaded selected analysis results:', results);
        setAnalysisResults(results);
        setCurrentSessionId(analysisId);
        setIsAnalyzing(false);
      } catch (error) {
        console.error('💥 Failed to load selected analysis results:', error);
      }
    }
  };

  const handleExportToReports = (exportData: any) => {
    console.log('📤 Export to reports:', exportData);
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const { deleteReport } = await import('../services/api');
      await deleteReport(reportId);
      
      const reports = await getReports();
      setExportedReports(reports || []);
    } catch (error) {
      console.error('💥 Failed to delete report:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <AnalysisDashboard 
      onStartAnalysis={handleStartAnalysis}
      analysisResults={analysisResults}
      isAnalyzing={isAnalyzing}
      analysisHistory={analysisHistory}
      onSelectAnalysis={handleSelectAnalysis}
      exportedReports={exportedReports}
      onDeleteReport={handleDeleteReport}
      onExportToReports={handleExportToReports}
      currentSessionId={currentSessionId}
    />
  );
};

export default DashboardPage;
