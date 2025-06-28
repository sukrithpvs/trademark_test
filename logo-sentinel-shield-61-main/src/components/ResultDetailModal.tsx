
import React from 'react';
import { ComparisonResult } from '../types/api';
import { X, Download, Flag, ShieldCheck, AlertTriangle, ShieldOff } from 'lucide-react';
import { Button } from './ui/button';

interface ResultDetailModalProps {
  result: (ComparisonResult & { 
    reference_logo: string;
    reference_doa?: string;
    reference_dou?: string;
    reference_class?: string;
    reference_proprietor?: string;
    reference_classDescription?: string;
    application_number?: string;
    doa?: string;
    dou?: string;
    class?: string;
    proprietor?: string;
    classDescription?: string;
  }) | null;
  referenceImage: string;
  isOpen: boolean;
  onClose: () => void;
}

const ResultDetailModal: React.FC<ResultDetailModalProps> = ({
  result,
  referenceImage,
  isOpen,
  onClose
}) => {
  if (!isOpen || !result) return null;

  const getRiskLevel = (score: number) => {
    if (score >= 90) {
      return { text: 'HIGH RISK', icon: Flag, textColor: 'text-red-500', badgeClasses: 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' };
    }
    if (score >= 75) {
      return { text: 'MEDIUM RISK', icon: AlertTriangle, textColor: 'text-orange-500', badgeClasses: 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800' };
    }
    return { text: 'LOW RISK', icon: ShieldCheck, textColor: 'text-green-500', badgeClasses: 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800' };
  };

  const risk = getRiskLevel(result.final_similarity);
  const RiskIcon = risk.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10 flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${risk.badgeClasses}`}>
              <RiskIcon className="w-4 h-4" />
              <span className="font-poppins font-bold text-sm">{risk.text}</span>
            </div>
            <div className="text-2xl font-poppins font-bold text-black dark:text-white">
              Detailed Comparison
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950">
              <Download className="w-5 h-5" />
              <span className="sr-only">Download</span>
            </Button>
            <Button
              variant="outline" 
              size="icon"
              onClick={onClose}
              className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950"
            >
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-8 space-y-8">
          {/* Logo Comparison */}
          <div>
            <h3 className="text-xl font-poppins font-semibold text-black dark:text-white mb-4">
              Logo Comparison
            </h3>
            <div className="relative grid grid-cols-1 lg:grid-cols-2 items-stretch justify-center gap-0 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl h-auto lg:h-[350px]">
                <div className="flex-1 flex flex-col items-center justify-between text-center p-6">
                    <div className="font-poppins font-medium text-black dark:text-white mb-4">Reference Logo</div>
                    <div className="flex-grow flex items-center justify-center w-full min-h-0 py-2">
                        <img
                            src={referenceImage}
                            alt="Reference logo"
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                    <p className="font-poppins text-sm text-gray-500 dark:text-gray-400 mt-4 w-full truncate" title={result.reference_logo}>{result.reference_logo}</p>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center h-full">
                    <div className="w-px h-4/5 bg-gray-200 dark:bg-gray-800 hidden lg:block"></div>
                    <div className="absolute w-12 h-12 bg-white dark:bg-black rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-800 z-10">
                        <span className="font-bold text-lg text-gray-500 dark:text-gray-400">VS</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-between text-center p-6 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800">
                    <div className="font-poppins font-medium text-black dark:text-white mb-4">Potential Match</div>
                    <div className="flex-grow flex items-center justify-center w-full min-h-0 py-2">
                        <img
                            src={result.logo_path}
                            alt="Comparison logo"
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                    <p className="font-poppins text-sm text-gray-500 dark:text-gray-400 mt-4 w-full truncate" title={result.logo_name}>{result.logo_name}</p>
                </div>
            </div>
          </div>
          
          {/* Trademark Information - Table Format */}
          <div className="space-y-4">
            <h3 className="text-xl font-poppins font-semibold text-black dark:text-white">Trademark Information</h3>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <th className="text-left p-4 font-poppins font-medium text-gray-600 dark:text-gray-300">Detail</th>
                    <th className="text-left p-4 font-poppins font-medium text-gray-600 dark:text-gray-300 border-l border-gray-200 dark:border-gray-800">Reference Logo</th>
                    <th className="text-left p-4 font-poppins font-medium text-gray-600 dark:text-gray-300 border-l border-gray-200 dark:border-gray-800">Potential Match</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200 dark:border-gray-800">
                    <td className="p-4 font-poppins text-sm text-gray-500 dark:text-gray-400 font-medium">Application Number</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">N/A</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.application_number || "Not specified"}</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-800">
                    <td className="p-4 font-poppins text-sm text-gray-500 dark:text-gray-400 font-medium">Proprietor</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.reference_proprietor || "Not specified"}</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.proprietor || "Not specified"}</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-800">
                    <td className="p-4 font-poppins text-sm text-gray-500 dark:text-gray-400 font-medium">Class</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.reference_class || "Not specified"}</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.class || "Not specified"}</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-800">
                    <td className="p-4 font-poppins text-sm text-gray-500 dark:text-gray-400 font-medium">Date of Application</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.reference_doa || "Not specified"}</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.doa || "Not specified"}</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-800">
                    <td className="p-4 font-poppins text-sm text-gray-500 dark:text-gray-400 font-medium">Date of Use</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.reference_dou || "Not specified"}</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.dou || "Not specified"}</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-800">
                    <td className="p-4 font-poppins text-sm text-gray-500 dark:text-gray-400 font-medium">Class Description</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.reference_classDescription || "Not specified"}</td>
                    <td className="p-4 font-poppins text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">{result.classDescription || "Not specified"}</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-800">
                    <td className="p-4 font-poppins text-sm text-gray-500 dark:text-gray-400 font-medium">Extracted Text</td>
                    <td className="p-4 font-mono text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">
                      <span className={!result.text1 ? "italic text-gray-500 dark:text-gray-400" : ""}>{result.text1 || "No text detected"}</span>
                    </td>
                    <td className="p-4 font-mono text-sm text-black dark:text-white border-l border-gray-200 dark:border-gray-800">
                      <span className={!result.text2 ? "italic text-gray-500 dark:text-gray-400" : ""}>{result.text2 || "No text detected"}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-end space-x-3 flex-shrink-0 rounded-b-2xl">
          <Button variant="outline" className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950">
            <ShieldOff className="mr-2 h-4 w-4" />
            Mark as False Positive
          </Button>
          <Button className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200">
            <Flag className="mr-2 h-4 w-4" />
            Flag for Review
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResultDetailModal;