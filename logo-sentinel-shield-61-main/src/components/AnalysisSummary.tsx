import React from 'react';

interface AnalysisSummaryProps {
  summary: any;
  processingTime: number;
}

const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({ summary, processingTime }) => {
  if (!summary) return null;

  // FIXED: Use the correct API fields
  const totalComparisons = summary.total_comparisons || 0;
  const highRisk = summary.high_risk_found || 0;
  const mediumRisk = summary.medium_risk_found || 0;
  const lowRisk = summary.low_risk_found || 0;
  const noRisk = summary.no_risk_found || 0;
  const deviceMarkCount = summary.device_mark_count || 0;  // ← Use this for Device Mark tab
  const wordMarkCount = summary.word_mark_count || 0;      // ← Use this for Word Mark tab
  const totalInfringements = summary.total_infringements || 0;

  const riskPercentage = totalComparisons > 0 ? 
    ((highRisk + mediumRisk + lowRisk) / totalComparisons * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Analysis Summary Header */}
      <div>
        <h2 className="text-2xl font-poppins font-bold text-black dark:text-white mb-2">
          Analysis Summary
        </h2>
        <p className="text-gray-500 dark:text-gray-400 font-poppins">
          Completed in {processingTime.toFixed(1)}s
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-black dark:text-white font-poppins">
            {totalComparisons}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-poppins">
            Total Comparisons
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-3xl font-bold text-red-600 dark:text-red-400 font-poppins">
            {highRisk}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-poppins">
            High Risk
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 font-poppins">
            {mediumRisk}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-poppins">
            Medium Risk
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 font-poppins">
            {noRisk}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-poppins">
            No Risk
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h3 className="font-poppins font-semibold text-black dark:text-white mb-2">
          Risk Assessment
        </h3>
        <p className="text-lg font-poppins text-black dark:text-white">
          {riskPercentage}% Risk
        </p>
        <div className="flex items-center space-x-4 mt-2 text-sm font-poppins">
          <span className="text-red-600 dark:text-red-400">{highRisk} High</span>
          <span className="text-orange-600 dark:text-orange-400">{mediumRisk} Medium</span>
          <span className="text-green-600 dark:text-green-400">{noRisk} Safe</span>
        </div>
      </div>

      {/* Analysis Results Summary */}
      <div>
        <h3 className="font-poppins font-semibold text-black dark:text-white mb-2">
          Analysis Results
        </h3>
        <p className="font-poppins text-gray-600 dark:text-gray-400 mb-4">
          {totalInfringements} potential infringements detected
        </p>
        
        {/* FIXED: Use correct counts from API summary */}
        <div className="space-y-2 text-sm font-poppins">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">All Infringements</span>
            <span className="text-black dark:text-white">({totalInfringements})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Device Mark Comparison</span>
            <span className="text-black dark:text-white">({deviceMarkCount})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Word Mark Comparison</span>
            <span className="text-black dark:text-white">({wordMarkCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisSummary;
