import React, { useEffect } from 'react';
import { Clock, FileText, TrendingUp, Calendar, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { AnalysisRecord } from '../services/api'; // Import from API

// Remove the local interface and use the imported one
interface TimelineViewProps {
  analysisHistory: AnalysisRecord[]; // Use AnalysisRecord instead of AnalysisHistoryItem
  onSelectAnalysis: (analysisId: string) => void;
  fetchAnalysisHistory: () => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ analysisHistory, onSelectAnalysis, fetchAnalysisHistory }) => {
  const handleViewAnalysis = (item: AnalysisRecord) => { // Update parameter type
    onSelectAnalysis(item.id);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const hasRunningAnalyses = analysisHistory.some(a => a.status === 'running');

    if (hasRunningAnalyses) {
      // Poll every 5 seconds if there are running analyses
      interval = setInterval(() => {
        fetchAnalysisHistory();
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analysisHistory, fetchAnalysisHistory]);

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-black">
      <div className="mb-8">
        <h2 className="text-3xl font-poppins font-bold text-black dark:text-white mb-2">Analysis Timeline</h2>
        <p className="font-poppins text-gray-500 dark:text-gray-400">
          View your previous analysis results and comparisons
        </p>
      </div>

      <div className="space-y-4">
        {analysisHistory.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-poppins font-semibold text-gray-500 dark:text-gray-400 mb-4">
              No analysis history yet
            </h3>
            <p className="font-poppins text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Run your first analysis to see the timeline of your trademark comparisons here.
            </p>
          </div>
        ) : (
          analysisHistory.map((item: AnalysisRecord, index: number) => (
            <div
              key={item.id}
              className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white dark:text-black" />
                  </div>
                  <div>
                    <h3 className="text-lg font-poppins font-semibold text-black dark:text-white">
                      {item.journalName}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-poppins text-gray-500 dark:text-gray-400">
                        {item.date}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-2xl font-poppins font-bold text-black dark:text-white">
                      {item.infringements}
                    </div>
                    <div className="text-sm font-poppins text-gray-500 dark:text-gray-400">
                      Infringements
                    </div>
                  </div>
                  <Button
                    onClick={() => handleViewAnalysis(item)}
                    className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Results
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Total Comparisons:</span>
                  <div className="font-semibold text-black dark:text-white">
                    {item.totalComparisons?.toLocaleString() || '0'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Infringements:</span>
                  <div className="font-semibold text-red-600 dark:text-red-400">
                    {item.infringements || 0}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Infringement Rate:</span>
                  <div className="font-semibold text-orange-600 dark:text-orange-400">
                    {item.infringements && item.totalComparisons
                      ? `${((item.infringements / item.totalComparisons) * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Processing Time:</span>
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {item.processingTime ? `${item.processingTime}s` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Risk breakdown */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                  High Risk: {item.highRiskFound || 0}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
                  Medium Risk: {item.mediumRiskFound || 0}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                  No Risk: {item.noRiskFound || 0}
                </span>
              </div>

              {/* Status display */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      item.status === 'completed'
                        ? 'bg-green-500'
                        : item.status === 'running'
                        ? 'bg-yellow-500 animate-pulse'
                        : item.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-gray-500'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      item.status === 'completed'
                        ? 'text-green-600 dark:text-green-400'
                        : item.status === 'running'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : item.status === 'failed'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </div>

                {/* Show appropriate action based on status */}
                {item.status === 'running' && (
                  <div className="text-blue-500 text-sm font-medium">
                    Analysis in Progress...
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TimelineView;
