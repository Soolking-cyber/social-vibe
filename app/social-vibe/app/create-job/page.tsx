'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CreateJob() {
  const { data: session } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    tweet_url: '',
    action_type: 'like' as 'like' | 'repost' | 'comment',
    price_per_action: 0.01,
    max_actions: 10,
    comment_text: ''
  });
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [jobResult, setJobResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setLoading(true);

    try {
      const totalBudget = formData.price_per_action * formData.max_actions;
      const platformFee = totalBudget * 0.1;
      const totalCost = totalBudget + platformFee;

      const response = await fetch('/api/contract/create-job', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({
          tweet_url: formData.tweet_url,
          action_type: formData.action_type,
          price_per_action: formData.price_per_action.toString(),
          max_actions: formData.max_actions,
          comment_text: formData.comment_text || ""
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Job created successfully:', result);
        
        // Store job result and show success modal
        setJobResult({
          ...result,
          jobDetails: {
            tweet_url: formData.tweet_url,
            action_type: formData.action_type,
            price_per_action: formData.price_per_action,
            max_actions: formData.max_actions,
            comment_text: formData.comment_text,
            total_budget: totalBudget,
            platform_fee: platformFee,
            total_cost: totalCost
          }
        });
        setShowSuccessModal(true);
      } else {
        const error = await response.json();
        console.error('API Error:', error);
        alert(error.error || error.message || 'Failed to create job');
      }
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const totalBudget = formData.price_per_action * formData.max_actions;
  const platformFee = totalBudget * 0.1;
  const totalCost = totalBudget + platformFee;

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="bg-slate-900 border-slate-800 max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-white">Authentication Required</CardTitle>
            <CardDescription className="text-slate-400">Please sign in to create jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="bg-blue-600 hover:bg-blue-700">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Create New Job</h1>
          <p className="text-slate-400">Create an engagement job to amplify your social impact message</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tweet URL */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <Label htmlFor="tweet_url" className="text-white">Tweet URL *</Label>
            </CardHeader>
            <CardContent>
              <Input
                id="tweet_url"
                type="url"
                required
                value={formData.tweet_url}
                onChange={(e) => setFormData({ ...formData, tweet_url: e.target.value })}
                placeholder="https://twitter.com/username/status/..."
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500 mt-2">
                Paste the full URL of the tweet you want to promote
              </p>
            </CardContent>
          </Card>

          {/* Action Type */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <Label className="text-white">Action Type *</Label>
            </CardHeader>
            <CardContent>
              <Select value={formData.action_type} onValueChange={(value: any) => setFormData({ ...formData, action_type: value })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="like" className="text-white">Like</SelectItem>
                  <SelectItem value="repost" className="text-white">Repost</SelectItem>
                  <SelectItem value="comment" className="text-white">Comment</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Comment Text */}
          {formData.action_type === 'comment' && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <Label htmlFor="comment_text" className="text-white">Comment Text *</Label>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="comment_text"
                  required
                  value={formData.comment_text}
                  onChange={(e) => setFormData({ ...formData, comment_text: e.target.value })}
                  placeholder="Enter the comment you want users to post..."
                  className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                  maxLength={280}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-slate-500">
                    This comment will be posted by users who complete your job
                  </p>
                  <span className={`text-xs ${formData.comment_text.length > 250 ? 'text-yellow-400' : 'text-slate-500'}`}>
                    {formData.comment_text.length}/280
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <Label htmlFor="price_per_action" className="text-white">Price per Action (USD) *</Label>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    id="price_per_action"
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={formData.price_per_action}
                    onChange={(e) => setFormData({ ...formData, price_per_action: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700 text-white pl-8"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Minimum: $0.001</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <Label htmlFor="max_actions" className="text-white">Maximum Actions *</Label>
              </CardHeader>
              <CardContent>
                <Input
                  id="max_actions"
                  type="number"
                  min="1"
                  required
                  value={formData.max_actions}
                  onChange={(e) => setFormData({ ...formData, max_actions: parseInt(e.target.value) })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-500 mt-2">Total number of actions needed</p>
              </CardContent>
            </Card>
          </div>

          {/* Cost Breakdown */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Budget for actions:</span>
                <span className="text-white font-medium">${totalBudget.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Platform fee (10%):</span>
                <span className="text-white font-medium">${platformFee.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-700 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-white">Total cost:</span>
                  <span className="text-2xl font-bold text-green-400">${totalCost.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || totalCost <= 0}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-semibold disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Creating Job...</span>
              </div>
            ) : (
              `Create Job - $${totalCost.toFixed(2)}`
            )}
          </Button>
        </form>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Job Created Successfully!
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Your engagement job has been created on the blockchain
              </DialogDescription>
            </DialogHeader>
            
            {jobResult && (
              <div className="space-y-4">
                {/* Job Details */}
                <div className="bg-slate-800 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Job ID:</span>
                    <span className="text-white font-mono">#{jobResult.jobId || 'Pending'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Action Type:</span>
                    <span className="text-white capitalize">{jobResult.jobDetails?.action_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price per Action:</span>
                    <span className="text-green-400 font-semibold">${jobResult.jobDetails?.price_per_action}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Actions:</span>
                    <span className="text-white">{jobResult.jobDetails?.max_actions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Cost:</span>
                    <span className="text-green-400 font-semibold">${jobResult.jobDetails?.total_cost?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Transaction Details */}
                {jobResult.transactionHash && (
                  <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg">
                    <h4 className="text-blue-400 font-medium mb-2">Transaction Details</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-400 text-sm">Transaction Hash:</span>
                        <div className="text-blue-400 text-xs font-mono break-all mt-1">
                          {jobResult.transactionHash}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">New Balance:</span>
                        <span className="text-white">${jobResult.newBalance}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                <div className="bg-green-900/20 border border-green-800 p-4 rounded-lg">
                  <p className="text-green-400 text-sm">
                    🎉 {jobResult.message || 'Your job is now live and ready for engagement!'}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowSuccessModal(false);
                      router.push('/marketplace');
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    View Marketplace
                  </Button>
                  <Button
                    onClick={() => {
                      setShowSuccessModal(false);
                      // Reset form for creating another job
                      setFormData({
                        tweet_url: '',
                        action_type: 'like',
                        price_per_action: 0.01,
                        max_actions: 10,
                        comment_text: ''
                      });
                    }}
                    variant="outline"
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Create Another
                  </Button>
                </div>

                {/* View on Explorer Link */}
                {jobResult.transactionHash && (
                  <div className="text-center">
                    <Button
                      onClick={() => {
                        window.open(`https://sepolia.etherscan.io/tx/${jobResult.transactionHash}`, '_blank');
                      }}
                      variant="link"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View on Etherscan →
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}