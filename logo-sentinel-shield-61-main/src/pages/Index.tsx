
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import NavigationBar from '../components/NavigationBar';
import AnalysisTool from '../components/AnalysisTool';
import TrustSection from '../components/TrustSection';
import CTASection from '../components/CTASection';
import { AnalysisResponse } from '../types/api';

const Index = () => {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToAnalysis = () => {
    analysisRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const navigateToDashboard = () => {
    navigate('/dashboard');
  };

  const handleAnalysisComplete = (results: AnalysisResponse) => {
    setAnalysisResults(results);
    setIsAnalyzing(false);
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
    setAnalysisResults(null);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <NavigationBar onTryItOut={navigateToDashboard} />
      <HeroSection onAnalyzeClick={navigateToDashboard} />
      
      {/* Trust Section */}
      <TrustSection />
      
      {/* Analysis Tool Section */}
      <div ref={analysisRef} id="app" className="py-24 bg-gray-50 dark:bg-gray-950 border-t-2 border-gray-200 dark:border-gray-800">
        <AnalysisTool 
          onAnalysisStart={handleAnalysisStart}
          onAnalysisComplete={handleAnalysisComplete}
          analysisResults={analysisResults}
          isAnalyzing={isAnalyzing}
        />
      </div>

      {/* Final CTA Section */}
      <CTASection onGetStarted={navigateToDashboard} />
    </div>
  );
};

export default Index;
