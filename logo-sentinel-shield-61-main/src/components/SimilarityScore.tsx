
import React from 'react';

interface SimilarityScoreProps {
  label: string;
  score: number;
  icon?: string;
}

const SimilarityScore: React.FC<SimilarityScoreProps> = ({ label, score }) => {
  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 60) return 'text-orange-400';
    return 'text-green-400';
  };

  const getRiskBg = (score: number) => {
    if (score >= 80) return 'bg-red-400/10 border-red-400/20';
    if (score >= 60) return 'bg-orange-400/10 border-orange-400/20';
    return 'bg-green-400/10 border-green-400/20';
  };

  return (
    <div className={`rounded-xl p-6 border backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${getRiskBg(score)}`}>
      <div className="text-center">
        <div className="mb-3">
          <h4 className="text-lg font-poppins font-semibold text-white mb-2">{label}</h4>
        </div>
        
        <div className={`text-4xl font-poppins font-bold mb-2 ${getRiskColor(score)}`}>
          {score.toFixed(1)}%
        </div>
        
        <div className="text-sm font-poppins text-gray-400">
          Similarity Score
        </div>
      </div>
    </div>
  );
};

export default SimilarityScore;
