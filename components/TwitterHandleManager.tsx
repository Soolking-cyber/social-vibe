'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Twitter, CheckCircle, AlertCircle } from 'lucide-react';

interface TwitterHandleManagerProps {
  onUpdate?: () => void;
}

export function TwitterHandleManager({ onUpdate }: TwitterHandleManagerProps) {
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTwitterHandle();
  }, []);

  const fetchTwitterHandle = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/twitter-handle');
      const data = await response.json();

      if (response.ok) {
        setTwitterHandle(data.twitterHandle);
      } else {
        setError(data.error || 'Failed to fetch Twitter handle');
      }
    } catch (error) {
      console.error('Error fetching Twitter handle:', error);
      setError('Failed to fetch Twitter handle');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-300">Loading Twitter handle...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Twitter className="h-5 w-5 text-blue-500" />
          Twitter Handle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <p className="text-sm text-slate-300">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          {twitterHandle ? (
            <>
              <Badge variant="outline" className="border-green-500 text-green-400 bg-green-500/10">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
              <span className="text-white font-mono text-lg">@{twitterHandle}</span>
            </>
          ) : (
            <>
              <Badge variant="outline" className="border-slate-500 text-slate-400 bg-slate-500/10">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
              <span className="text-slate-400">Twitter handle will be captured on next login</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}