
import React from 'react';
import { AnalysisResponse } from '../types/api';
import DashboardSidebar from './DashboardSidebar';
import ResultsGrid from './ResultsGrid';
import AnalysisSummary from './AnalysisSummary';

interface DashboardProps {
  analysisResults: AnalysisResponse;
}

const Dashboard: React.FC<DashboardProps> = ({ analysisResults }) => {
  // Transform the batch_results to match the expected BatchResult structure
  const transformedBatchResults = [{
    reference_logo: "Analysis Results",
    processing_time: analysisResults.total_processing_time || 0,
    infringement_count: (analysisResults.summary?.high_risk_found || 0) + (analysisResults.summary?.medium_risk_found || 0),
    results: analysisResults.batch_results || []
  }];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <DashboardSidebar 
          analysisResults={analysisResults}
          activeView="results"
          onViewChange={() => {}}
        />
        
        <main className="flex-1 ml-80 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-4">Analysis Dashboard</h1>
              <div className="w-24 h-1 bg-primary rounded-full"></div>
            </div>
            
            <AnalysisSummary 
              summary={analysisResults.summary} 
              processingTime={analysisResults.total_processing_time} 
            />
            
            <ResultsGrid batchResults={transformedBatchResults} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
