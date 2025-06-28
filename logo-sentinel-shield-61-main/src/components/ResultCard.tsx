
import React from 'react';
import { ComparisonResult } from '../types/api';

interface ResultCardProps {
  result: ComparisonResult & { reference_logo: string };
  referenceImage: string;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, referenceImage }) => {
  const getInfringementBadge = (score: number) => {
    if (score >= 90) return { text: 'HIGH RISK', color: 'bg-red-500' };
    if (score >= 80) return { text: 'MEDIUM RISK', color: 'bg-orange-500' };
    return { text: 'LOW RISK', color: 'bg-yellow-500' };
  };

  const badge = getInfringementBadge(result.final_similarity);

  return (
    <div className="bg-black/80 backdrop-blur-sm rounded-lg p-10 border border-gray-800 shadow-2xl mb-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white tracking-tight">
            Reference: {result.reference_logo}
          </h3>
          <div className="flex items-center space-x-4">
            <span className={`px-6 py-2 rounded-full text-black font-bold text-sm ${badge.color}`}>
              {badge.text}
            </span>
            <span className="text-3xl font-bold text-white">
              {result.final_similarity.toFixed(1)}% Match
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
        <div className="text-center">
          <h4 className="text-xl font-semibold text-white mb-6">Reference Logo</h4>
          <div className="bg-white rounded-lg p-6 h-64 flex items-center justify-center border border-gray-300">
            <img 
              src={referenceImage}
              alt="Reference logo"
              className="max-h-full max-w-full object-contain rounded"
            />
          </div>
        </div>

        <div className="text-center">
          <h4 className="text-xl font-semibold text-white mb-6">Potential Match</h4>
          <div className="bg-white rounded-lg p-6 h-64 flex items-center justify-center border border-gray-300">
            <img 
              src={result.logo_path}
              alt="Comparison logo"
              className="max-h-full max-w-full object-contain rounded"
            />
          </div>
          <p className="text-gray-400 text-sm mt-4 font-medium">{result.logo_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 text-center">
          <div className="text-3xl font-poppins font-bold text-blue-400 mb-2">
            {result.vit_similarity.toFixed(1)}%
          </div>
          <div className="text-lg font-poppins font-semibold text-white mb-1">
            Visual Similarity
          </div>
          <div className="text-sm font-poppins text-gray-400">
            Image-based analysis
          </div>
        </div>
        
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 text-center">
          <div className="text-3xl font-poppins font-bold text-purple-400 mb-2">
            {result.text_similarity.toFixed(1)}%
          </div>
          <div className="text-lg font-poppins font-semibold text-white mb-1">
            Textual Similarity
          </div>
          <div className="text-sm font-poppins text-gray-400">
            Text-based analysis
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 rounded-lg p-8 border border-gray-700">
        <h4 className="text-xl font-semibold text-white mb-6">Extracted Text Comparison</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-gray-400 text-sm font-medium">Reference Text:</span>
            <div className="font-mono text-white bg-gray-800 p-4 rounded mt-2 border border-gray-600">
              {result.text1 || "No text detected"}
            </div>
          </div>
          <div>
            <span className="text-gray-400 text-sm font-medium">Comparison Text:</span>
            <div className="font-mono text-white bg-gray-800 p-4 rounded mt-2 border border-gray-600">
              {result.text2 || "No text detected"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
