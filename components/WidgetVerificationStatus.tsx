'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Eye, Clock, AlertCircle } from 'lucide-react';

interface WidgetVerificationStatusProps {
  verificationId?: string | null;
  interactionDetected?: boolean;
  className?: string;
}

export function WidgetVerificationStatus({ 
  verificationId, 
  interactionDetected, 
  className = '' 
}: WidgetVerificationStatusProps) {
  const [status, setStatus] = useState<'idle' | 'monitoring' | 'detected' | 'verified'>('idle');
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!verificationId) {
      setStatus('idle');
      setTimeElapsed(0);
      return;
    }

    setStatus('monitoring');
    const startTime = Date.now();

    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [verificationId]);

  useEffect(() => {
    if (interactionDetected) {
      setStatus('detected');
    }
  }, [interactionDetected]);

  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return {
          icon: Clock,
          text: 'Ready to verify',
          color: 'text-slate-400',
          bgColor: 'bg-slate-800/50',
          borderColor: 'border-slate-700'
        };
      case 'monitoring':
        return {
          icon: Eye,
          text: `Monitoring interactions (${timeElapsed}s)`,
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/20',
          borderColor: 'border-blue-700'
        };
      case 'detected':
        return {
          icon: CheckCircle,
          text: 'Interaction detected!',
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-700'
        };
      case 'verified':
        return {
          icon: CheckCircle,
          text: 'Verification complete',
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-700'
        };
      default:
        return {
          icon: AlertCircle,
          text: 'Unknown status',
          color: 'text-red-400',
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-700'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}>
      <Icon className={`h-4 w-4 ${config.color} ${status === 'monitoring' ? 'animate-pulse' : ''}`} />
      <span className={`text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
      {status === 'detected' && (
        <div className="ml-2 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
      )}
    </div>
  );
}

// Global verification status component for the app header
export function GlobalVerificationStatus() {
  const [activeVerifications, setActiveVerifications] = useState(0);
  const [recentInteractions, setRecentInteractions] = useState(0);

  useEffect(() => {
    // Listen for verification events
    const handleVerificationStart = () => {
      setActiveVerifications(prev => prev + 1);
    };

    const handleVerificationEnd = () => {
      setActiveVerifications(prev => Math.max(0, prev - 1));
    };

    const handleInteractionDetected = () => {
      setRecentInteractions(prev => prev + 1);
      // Reset counter after 5 seconds
      setTimeout(() => {
        setRecentInteractions(prev => Math.max(0, prev - 1));
      }, 5000);
    };

    // Custom events for verification system
    window.addEventListener('widget-verification-start', handleVerificationStart);
    window.addEventListener('widget-verification-end', handleVerificationEnd);
    window.addEventListener('widget-interaction-detected', handleInteractionDetected);

    return () => {
      window.removeEventListener('widget-verification-start', handleVerificationStart);
      window.removeEventListener('widget-verification-end', handleVerificationEnd);
      window.removeEventListener('widget-interaction-detected', handleInteractionDetected);
    };
  }, []);

  if (activeVerifications === 0 && recentInteractions === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {activeVerifications > 0 && (
        <div className="bg-blue-900/90 border border-blue-700 text-blue-300 px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">
              {activeVerifications} verification{activeVerifications > 1 ? 's' : ''} active
            </span>
          </div>
        </div>
      )}
      
      {recentInteractions > 0 && (
        <div className="bg-green-900/90 border border-green-700 text-green-300 px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm animate-pulse">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {recentInteractions} interaction{recentInteractions > 1 ? 's' : ''} detected!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}