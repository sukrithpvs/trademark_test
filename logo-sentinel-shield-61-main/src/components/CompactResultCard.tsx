
import React from 'react';
import { ComparisonResult } from '../types/api';

interface CompactResultCardProps {
  result: ComparisonResult & { reference_logo: string };
  referenceImage: string;
}

const CompactResultCard: React.FC<CompactResultCardProps> = ({ result, referenceImage }) => {
  const getInfringementBadge = (score: number) => {
    if (score >= 90) return { text: 'HIGH RISK', color: 'bg-red-500' };
    if (score >= 80) return { text: 'MEDIUM RISK', color: 'bg-orange-500' };
    return { text: 'LOW RISK', color: 'bg-yellow-500' };
  };

  const badge = getInfringementBadge(result.final_similarity);

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-6 border border-gray-800 hover:border-gray-700 transition-all duration-300">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`px-3 py-1 rounded-full text-black font-bold text-xs ${badge.color}`}>
            {badge.text}
          </span>
          <span className="text-xl font-bold text-white">
            {result.final_similarity.toFixed(1)}%
          </span>
        </div>
        <h4 className="text-sm font-medium text-gray-400 truncate">
          {result.logo_name}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center">
          <div className="bg-white rounded-lg p-3 h-24 flex items-center justify-center">
            <img 
              src={referenceImage}
              alt="Reference"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">Reference</p>
        </div>

        <div className="text-center">
          <div className="bg-white rounded-lg p-3 h-24 flex items-center justify-center">
            <img 
              src={result.logo_path}
              alt="Comparison"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">Match</p>
        </div>
      </div>

      {(result.text1 || result.text2) && (
        <div className="mt-4 pt-3 border-t border-gray-800">
          <div className="text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400 truncate">{result.text1 || "No text"}</span>
              <span className="text-gray-400 truncate">{result.text2 || "No text"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompactResultCard;
