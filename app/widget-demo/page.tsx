'use client';

import { useState } from 'react';
import { TwitterJobsMarketplace } from '@/components/TwitterJobCard';
import { EmbeddedVerificationDialog } from '@/components/EmbeddedVerificationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Twitter, Heart, Repeat, MessageCircle, Zap, Shield, Clock } from 'lucide-react';

export default function WidgetDemoPage() {
  const [showDemo, setShowDemo] = useState(false);
  const [demoJob] = useState({
    id: 'demo-1',
    actionType: 'like' as const,
    targetUrl: 'https://twitter.com/elonmusk/status/1234567890',
    reward: '0.05'
  });

  const features = [
    {
      icon: Twitter,
      title: 'Embedded Tweets',
      description: 'Users interact directly with real embedded tweets',
      color: 'text-blue-500'
    },
    {
      icon: Zap,
      title: 'Real-time Detection',
      description: 'Instant feedback when interactions are detected',
      color: 'text-yellow-500'
    },
    {
      icon: Shield,
      title: 'Multi-layer Verification',
      description: 'DOM monitoring, click detection, and timing analysis',
      color: 'text-green-500'
    },
    {
      icon: Clock,
      title: 'No API Costs',
      description: 'Eliminates expensive Twitter API calls',
      color: 'text-purple-500'
    }
  ];

  const verificationLayers = [
    {
      name: 'Click Detection',
      description: 'Monitors clicks on Twitter widget buttons',
      status: 'active'
    },
    {
      name: 'DOM Monitoring',
      description: 'Watches for interaction state changes',
      status: 'active'
    },
    {
      name: 'Timing Analysis',
      description: 'Ensures realistic completion times',
      status: 'active'
    },
    {
      name: 'Browser Storage',
      description: 'Tracks interaction history',
      status: 'active'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Twitter className="h-8 w-8 text-blue-500" />
            <h1 className="text-4xl font-bold text-white">Widget Verification Demo</h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Experience cost-effective Twitter verification with embedded widgets and real-time interaction detection
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge className="bg-green-600">No API Costs</Badge>
            <Badge className="bg-blue-600">Real-time Detection</Badge>
            <Badge className="bg-purple-600">Multi-layer Security</Badge>
          </div>
        </div>

        {/* Demo Section */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Demo Controls */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Interactive Demo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300 text-sm">
                Try the embedded verification system with a real Twitter widget. 
                The system will detect your interactions in real-time.
              </p>
              
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Heart className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-white font-medium">Demo Job: Like Tweet</p>
                    <p className="text-slate-400 text-sm">Earn 0.05 USDC for liking</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowDemo(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Twitter className="h-4 w-4 mr-2" />
                  Start Demo Verification
                </Button>
              </div>

              <div className="text-xs text-slate-500">
                * Demo uses real Twitter widgets but won't actually complete jobs
              </div>
            </CardContent>
          </Card>

          {/* Verification Layers */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Verification Layers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {verificationLayers.map((layer, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{layer.name}</p>
                    <p className="text-slate-400 text-xs">{layer.description}</p>
                  </div>
                  <Badge className="bg-green-600 text-xs">Active</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                <CardContent className="p-6 text-center">
                  <Icon className={`h-8 w-8 mx-auto mb-3 ${feature.color}`} />
                  <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Benefits Section */}
        <Card className="bg-slate-900 border-slate-800 mb-12">
          <CardHeader>
            <CardTitle className="text-white text-center">Why Widget Verification?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl font-bold">$0</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Zero API Costs</h3>
                <p className="text-slate-400 text-sm">
                  Eliminate expensive Twitter API calls while maintaining verification quality
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2">Real-time Feedback</h3>
                <p className="text-slate-400 text-sm">
                  Users get instant confirmation when their interactions are detected
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2">Fraud Prevention</h3>
                <p className="text-slate-400 text-sm">
                  Multiple verification layers prevent fake completions and abuse
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Full Marketplace Demo */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-center">Full Marketplace Experience</CardTitle>
            <p className="text-slate-400 text-center">
              See how the widget verification system works in a complete marketplace
            </p>
          </CardHeader>
          <CardContent>
            <TwitterJobsMarketplace />
          </CardContent>
        </Card>
      </div>

      {/* Demo Dialog */}
      <EmbeddedVerificationDialog
        isOpen={showDemo}
        onClose={() => setShowDemo(false)}
        onVerified={() => {
          setShowDemo(false);
          // Show success message
          alert('Demo completed! In a real app, you would earn USDC.');
        }}
        job={demoJob}
      />
    </div>
  );
}