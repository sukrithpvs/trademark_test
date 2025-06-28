import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JournalUploadSection from '@/components/JournalUploadSection'; // Adjust path as needed

const AnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalysisStart = (sessionId: string) => {
    console.log('📍 Analysis started with session ID:', sessionId);
    setIsAnalyzing(true);
    
    // Navigate to the results page with the session ID
    navigate(`/analysis/results/${sessionId}`);
  };

  const handleUploadSuccess = () => {
    console.log('✅ File uploaded successfully');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-poppins font-bold text-black dark:text-white mb-2">
            Trademark Analysis
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-poppins">
            Upload your journal PDF and start the comprehensive trademark similarity analysis.
          </p>
        </div>

        {/* Journal Upload Section */}
        <JournalUploadSection
          onAnalysisStart={handleAnalysisStart}
          isAnalyzing={isAnalyzing}
          onUploadSuccess={handleUploadSuccess}
        />

        {/* Analysis Status */}
        {isAnalyzing && (
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div>
                <h3 className="text-lg font-poppins font-medium text-black dark:text-white">
                  Analysis Starting...
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-poppins">
                  Please wait while we process your journal and start the analysis.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPage;
