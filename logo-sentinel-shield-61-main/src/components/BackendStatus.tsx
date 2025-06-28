
import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, X } from 'lucide-react';
import { healthCheck } from '../services/api';
import { Button } from './ui/button';

interface BackendStatusProps {
  onClose?: () => void;
}

const BackendStatus: React.FC<BackendStatusProps> = ({ onClose }) => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [backendInfo, setBackendInfo] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const checkBackendStatus = async () => {
    setStatus('checking');
    setError('');
    
    try {
      const result = await healthCheck();
      setBackendInfo(result);
      setStatus('connected');
    } catch (error: any) {
      setError(error.message);
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'disconnected':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'checking':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950';
      case 'connected':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950';
      case 'disconnected':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
    }
  };

  return (
    <div className={`fixed top-4 right-4 max-w-md p-4 border rounded-lg shadow-lg z-50 ${getStatusColor()}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <h3 className="text-sm font-poppins font-semibold">
            Backend Connection
          </h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <div className="text-sm space-y-2">
        {status === 'checking' && (
          <p>Checking backend connection...</p>
        )}
        
        {status === 'connected' && backendInfo && (
          <div className="space-y-1">
            <p className="text-green-700 dark:text-green-300">✓ Connected to backend</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Version: {backendInfo.version} | Status: {backendInfo.status}
            </p>
          </div>
        )}
        
        {status === 'disconnected' && (
          <div className="space-y-2">
            <p className="text-red-700 dark:text-red-300">✗ Backend not available</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 break-words">
              {error}
            </p>
            <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded text-xs">
              <p className="font-medium mb-1">To fix this issue:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Make sure your backend server is running on port 8000</li>
                <li>Check that CORS is properly configured</li>
                <li>Verify the backend URL is accessible</li>
              </ol>
            </div>
          </div>
        )}
        
        <Button
          onClick={checkBackendStatus}
          size="sm"
          variant="outline"
          className="w-full mt-2"
          disabled={status === 'checking'}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${status === 'checking' ? 'animate-spin' : ''}`} />
          Retry Connection
        </Button>
      </div>
    </div>
  );
};

export default BackendStatus;
