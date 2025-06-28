
import React, { useState } from 'react';
import AnalysisDashboard from './AnalysisDashboard';
import { AnalysisResponse } from '../types/api';

interface AnalysisToolProps {
  onAnalysisStart: () => void;
  onAnalysisComplete: (results: AnalysisResponse) => void;
  analysisResults: AnalysisResponse | null;
  isAnalyzing: boolean;
}

const AnalysisTool: React.FC<AnalysisToolProps> = ({
  onAnalysisStart,
  onAnalysisComplete,
  analysisResults,
  isAnalyzing
}) => {
  const [showDashboard, setShowDashboard] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);

  const handleStartAnalysis = (sessionId: string) => {
    onAnalysisStart();
    console.log('Starting analysis with session ID:', sessionId);
    // The actual analysis will now be handled by the backend API
    // through the AnalysisDashboard component
  };

  const handleSelectAnalysis = (analysisId: string) => {
    console.log('Selected analysis:', analysisId);
    // Here you would load the specific analysis results
  };

  const handleTryItOut = () => {
    setShowDashboard(true);
  };

  if (showDashboard) {
    return (
      <AnalysisDashboard 
        onStartAnalysis={handleStartAnalysis}
        analysisResults={analysisResults}
        isAnalyzing={isAnalyzing}
        analysisHistory={analysisHistory}
        onSelectAnalysis={handleSelectAnalysis}
      />
    );
  }

  // This return is not used since the button is now in HeroSection
  return null;
};

export default AnalysisTool;
