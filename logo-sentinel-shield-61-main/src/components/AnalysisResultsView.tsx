import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, ArrowLeft, Download, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import ResultsGrid from '@/components/ResultsGrid'; // Make sure this path matches your file structure
import {
  getAnalysisStatus,
  getAnalysisResults,
  getDeviceResults,
  getWordResults,
  getAnalysisSummary,
  connectToProgressWebSocket,
  exportReport,
  type AnalysisStatus as ApiAnalysisStatus,
  type AnalysisResults,
  type AnalysisSummary,
  type BatchResult
} from '@/services/api';

interface AnalysisResultsViewProps {
  sessionId?: string;
}

export default function AnalysisResultsView({ sessionId: propSessionId }: AnalysisResultsViewProps) {
  const { sessionId: paramSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Use prop sessionId first, then URL param
  const sessionId = propSessionId || paramSessionId;

  console.log('🔍 AnalysisResultsView - sessionId from props:', propSessionId);
  console.log('🔍 AnalysisResultsView - sessionId from params:', paramSessionId);
  console.log('🔍 AnalysisResultsView - final sessionId:', sessionId);

  // FIXED: Proper type annotations
  const [analysisStatus, setAnalysisStatus] = useState<ApiAnalysisStatus | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter and pagination state
  const [activeTab, setActiveTab] = useState<'all' | 'device' | 'word'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'risk' | 'date'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  
  // WebSocket connection
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Check if analysis is complete
  const isAnalysisComplete = analysisStatus?.status === 'completed';
  const isAnalysisFailed = analysisStatus?.status === 'failed';
  const isAnalysisRunning = analysisStatus?.status === 'running' || analysisStatus?.status === 'pending';

  // Fetch analysis status
  const fetchAnalysisStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      const status = await getAnalysisStatus(sessionId);
      setAnalysisStatus(status);
      
      if (status.status === 'completed') {
        const summary = await getAnalysisSummary(sessionId);
        setAnalysisSummary(summary);
      }
    } catch (error) {
      console.error('Failed to fetch analysis status:', error);
      setError('Failed to fetch analysis status');
    }
  }, [sessionId]);

  // Fetch analysis results
  const fetchAnalysisResults = useCallback(async () => {
    if (!sessionId || !isAnalysisComplete) return;

    try {
      setRefreshing(true);
      let results: AnalysisResults;

      switch (activeTab) {
        case 'device':
          results = await getDeviceResults(sessionId, currentPage, 50, true);
          break;
        case 'word':
          results = await getWordResults(sessionId, currentPage, 50, true);
          break;
        default:
          results = await getAnalysisResults(sessionId, currentPage, 50, undefined, true);
      }

      setAnalysisResults(results);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch analysis results:', error);
      setError('Failed to fetch analysis results');
      toast.error('Failed to load analysis results');
    } finally {
      setRefreshing(false);
    }
  }, [sessionId, isAnalysisComplete, activeTab, currentPage]);

  // Setup WebSocket for real-time progress
  useEffect(() => {
    if (!sessionId || isAnalysisComplete) return;

    const websocket = connectToProgressWebSocket(sessionId, (data) => {
      setAnalysisStatus(prev => ({
        ...prev,
        ...data
      } as ApiAnalysisStatus));
    });

    setWs(websocket);

    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [sessionId, isAnalysisComplete]);

  // Initial data fetch
  useEffect(() => {
    if (!sessionId) {
      console.error('❌ No session ID available in AnalysisResultsView');
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    console.log('✅ Session ID found, initializing data load for:', sessionId);
    const initializeData = async () => {
      setLoading(true);
      await fetchAnalysisStatus();
      setLoading(false);
    };

    initializeData();
  }, [sessionId, fetchAnalysisStatus]);

  // Fetch results when analysis completes or tab changes
  useEffect(() => {
    if (isAnalysisComplete) {
      fetchAnalysisResults();
    }
  }, [isAnalysisComplete, fetchAnalysisResults]);

  // Poll for status updates if analysis is running
  useEffect(() => {
    if (!isAnalysisRunning) return;

    const interval = setInterval(fetchAnalysisStatus, 2000);
    return () => clearInterval(interval);
  }, [isAnalysisRunning, fetchAnalysisStatus]);

  // Handle result selection
  const handleResultSelect = (result: BatchResult) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(result.id)) {
        newSet.delete(result.id);
      } else {
        newSet.add(result.id);
      }
      return newSet;
    });
  };

  // FIXED: Export handler to match ResultsGrid expectations
  const handleExport = async (exportData: any) => {
    if (!sessionId) return;

    try {
      await exportReport({
        session_id: sessionId,
        format: 'csv',
        title: `Trademark Analysis Results - ${new Date().toLocaleDateString()}`,
        selected_results: exportData.data || []
      });

      toast.success(`Report exported successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report');
    }
  };

  // Refresh data
  const handleRefresh = () => {
    if (isAnalysisComplete) {
      fetchAnalysisResults();
    } else {
      fetchAnalysisStatus();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analysis results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Results</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={() => navigate('/analysis')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Analysis
          </Button>
        </div>
      </div>
    );
  }

  // Early return if no session ID
  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Session ID</h3>
          <p className="text-gray-500 mb-4">No analysis session ID was provided.</p>
          <Button onClick={() => navigate('/analysis')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Start New Analysis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/analysis')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Analysis</span>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Analysis Results</h1>
        </div>

        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Analysis Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <span>Analysis Status</span>
              <Badge 
                variant={isAnalysisComplete ? 'default' : isAnalysisFailed ? 'destructive' : 'secondary'}
                className={`${
                  isAnalysisComplete ? 'bg-green-500' : 
                  isAnalysisFailed ? 'bg-red-500' : 
                  'bg-blue-500'
                } text-white`}
              >
                {analysisStatus?.status || 'Unknown'}
              </Badge>
            </CardTitle>

            {analysisSummary && (
              <div className="text-sm text-gray-600">
                Processing time: {Math.round(analysisSummary.processing_time || 0)}s
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isAnalysisRunning && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{Math.round(analysisStatus?.progress_percent || 0)}%</span>
                </div>
                <Progress value={analysisStatus?.progress_percent || 0} className="h-2" />
              </div>
              
              <div className="text-sm text-gray-600">
                Processed {analysisStatus?.processed_comparisons || 0} of {analysisStatus?.total_comparisons || 0} comparisons
                {((analysisStatus?.high_risk_found || 0) + (analysisStatus?.medium_risk_found || 0)) > 0 && (
                  <span className="ml-2 text-red-600 font-medium">
                    • {(analysisStatus?.high_risk_found || 0) + (analysisStatus?.medium_risk_found || 0)} risk matches found
                  </span>
                )}
              </div>
            </div>
          )}

          {isAnalysisComplete && analysisSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Total Comparisons</div>
                <div className="text-2xl font-bold">{analysisSummary.total_comparisons || 0}</div>
              </div>
              
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-sm text-red-600">High Risk</div>
                <div className="text-2xl font-bold text-red-600">
                  {(analysisSummary.device_marks?.high_risk || 0) + (analysisSummary.word_marks?.high_risk || 0)}
                </div>
              </div>
              
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-sm text-yellow-600">Medium Risk</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {(analysisSummary.device_marks?.medium_risk || 0) + (analysisSummary.word_marks?.medium_risk || 0)}
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-600">Low Risk</div>
                <div className="text-2xl font-bold text-blue-600">
                  {(analysisSummary.device_marks?.low_risk || 0) + (analysisSummary.word_marks?.low_risk || 0)}
                </div>
              </div>
            </div>
          )}

          {isAnalysisFailed && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div className="text-sm text-red-700">
                  Analysis failed. Please try starting a new analysis.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {isAnalysisComplete && analysisResults ? (
        <div className="space-y-6">
          {/* FIXED: Pass correct props to ResultsGrid */}
          <ResultsGrid
            batchResults={analysisResults.batch_results}
            isLoading={refreshing}
            onExportToReports={handleExport}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      ) : (
        !isAnalysisRunning && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Available</h3>
                <p className="text-gray-500">
                  Start an analysis to see results here.
                </p>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
