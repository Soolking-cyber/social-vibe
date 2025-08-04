'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Twitter, CheckCircle, AlertCircle, Edit3, Save, X } from 'lucide-react';

interface TwitterHandleManagerProps {
  onUpdate?: () => void;
}

export function TwitterHandleManager({ onUpdate }: TwitterHandleManagerProps) {
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        setEditValue(data.twitterHandle || '');
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

  const handleSave = async () => {
    if (!editValue.trim()) {
      setError('Twitter handle cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/user/twitter-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twitterHandle: editValue.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setTwitterHandle(data.twitterHandle);
        setIsEditing(false);
        onUpdate?.();
      } else {
        setError(data.error || 'Failed to update Twitter handle');
      }
    } catch (error) {
      console.error('Error updating Twitter handle:', error);
      setError('Failed to update Twitter handle');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(twitterHandle || '');
    setIsEditing(false);
    setError(null);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
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
          <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {!isEditing ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {twitterHandle ? (
                  <>
                    <Badge variant="outline" className="border-green-500 text-green-400 bg-green-500/10">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                    <span className="text-white font-mono">@{twitterHandle}</span>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="border-yellow-500 text-yellow-400 bg-yellow-500/10">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Not Set
                    </Badge>
                    <span className="text-slate-400">No Twitter handle configured</span>
                  </>
                )}
              </div>
              <Button
                onClick={handleEdit}
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {twitterHandle ? 'Edit' : 'Set Handle'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">@</span>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="your_twitter_handle"
                  className="bg-slate-800 border-slate-700 text-white"
                  maxLength={15}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !editValue.trim()}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </div>
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={saving}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <X className="h-3 w-3 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
          <p className="text-sm text-blue-400">
            <strong>Secure Storage:</strong> Your Twitter handle is captured once during login and stored securely. 
            No additional Twitter API calls are made, avoiding rate limits and ensuring privacy.
          </p>
        </div>

        {twitterHandle && (
          <div className="text-xs text-slate-500">
            This handle is used for job verification without making Twitter API requests.
          </div>
        )}
      </CardContent>
    </Card>
  );
}