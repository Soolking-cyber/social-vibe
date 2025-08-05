'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, Clock, Shield } from 'lucide-react';

interface VerificationStatusProps {
  verificationId?: string;
}

export function VerificationStatus({ verificationId }: VerificationStatusProps) {
  const [status, setStatus] = useState<{
    hasHelper: boolean;
    verificationProof: boolean;
    lastVerification?: string;
  }>({
    hasHelper: false,
    verificationProof: false
  });

  useEffect(() => {
    checkVerificationStatus();
    const interval = setInterval(checkVerificationStatus, 2000);
    return () => clearInterval(interval);
  }, [verificationId]);

  const checkVerificationStatus = () => {
    try {
      // Check if verification helper is installed (user script detection)
      const hasHelper = localStorage.getItem('twitter_verifier_installed') === 'true';
      
      // Check if current verification has proof
      let verificationProof = false;
      let lastVerification = undefined;
      
      if (verificationId) {
        verificationProof = localStorage.getItem(`twitter_action_verified_${verificationId}`) === 'true';
        const timestamp = localStorage.getItem(`twitter_action_verified_time_${verificationId}`);
        if (timestamp) {
          lastVerification = new Date(parseInt(timestamp)).toLocaleTimeString();
        }
      }

      setStatus({
        hasHelper,
        verificationProof,
        lastVerification
      });
    } catch (error) {
      console.warn('Error checking verification status:', error);
    }
  };

  const installHelper = () => {
    window.open('/install-verification.html', '_blank');
  };

  const testVerification = () => {
    if (verificationId) {
      // Simulate verification for testing
      localStorage.setItem(`twitter_action_verified_${verificationId}`, 'true');
      localStorage.setItem(`twitter_action_verified_time_${verificationId}`, Date.now().toString());
      checkVerificationStatus();
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Shield className="h-5 w-5 text-blue-500" />
          Verification Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Helper Status */}
        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            {status.hasHelper ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            <span className="text-sm text-slate-300">
              Verification Helper
            </span>
          </div>
          <div className="text-sm">
            {status.hasHelper ? (
              <span className="text-green-400">Installed</span>
            ) : (
              <Button onClick={installHelper} size="sm" className="bg-blue-600 hover:bg-blue-700">
                Install
              </Button>
            )}
          </div>
        </div>

        {/* Current Verification Status */}
        {verificationId && (
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              {status.verificationProof ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Clock className="h-5 w-5 text-slate-500" />
              )}
              <span className="text-sm text-slate-300">
                Action Verification
              </span>
            </div>
            <div className="text-sm">
              {status.verificationProof ? (
                <div className="text-green-400">
                  <div>✅ Verified</div>
                  {status.lastVerification && (
                    <div className="text-xs text-slate-400">
                      at {status.lastVerification}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-slate-400">Pending</span>
              )}
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
            <div className="text-xs text-red-300">
              <strong>Security Notice:</strong> Only actions verified through our helper or with valid proof will earn rewards. 
              False claims may result in account suspension.
            </div>
          </div>
        </div>

        {/* Testing (Development Only) */}
        {process.env.NODE_ENV === 'development' && verificationId && (
          <div className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
            <div className="text-xs text-yellow-300 mb-2">
              <strong>Development Testing:</strong>
            </div>
            <Button 
              onClick={testVerification} 
              size="sm" 
              className="bg-yellow-600 hover:bg-yellow-700 text-xs"
            >
              Simulate Verification
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}