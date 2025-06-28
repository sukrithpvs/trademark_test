
import React from 'react';
import { BatchResult } from '../types/api';
import ResultCard from './ResultCard';

interface ResultsDisplayProps {
  batchResults: BatchResult[];
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ batchResults }) => {
  const infringementResults = batchResults.flatMap(batch => 
    batch.results.filter(result => result.infringement_detected)
      .map(result => ({ ...result, reference_logo: batch.reference_logo }))
  );

  if (infringementResults.length === 0) {
    return (
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-12 text-center border border-gray-800 shadow-2xl">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-3xl font-bold text-green-400 mb-6">Analysis Complete</h3>
          <div className="w-16 h-1 bg-green-400 mx-auto rounded-full mb-6"></div>
          <p className="text-gray-300 text-xl leading-relaxed">
            No potential trademark infringements detected above the threshold. Your brand appears to be well-protected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
          Potential Infringements Detected
        </h2>
        <div className="w-24 h-1 bg-red-400 mx-auto rounded-full"></div>
        <p className="text-gray-400 text-lg mt-4">
          {infringementResults.length} potential matches require your attention
        </p>
      </div>
      
      {infringementResults.map((result, index) => (
        <ResultCard 
          key={`${result.logo_name}-${index}`}
          result={result}
          referenceImage="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=200&fit=crop"
        />
      ))}
    </div>
  );
};

export default ResultsDisplay;