'use client';

import { AlertTriangle, Info, Lightbulb, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { insightsApi } from '@/lib/api/insights';
import type { Insight, Suggestion } from '@/types/insight';

const severityConfig = {
  info: {
    icon: Info,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  warning: {
    icon: AlertTriangle,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  critical: {
    icon: AlertTriangle,
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
};

export default function InsightsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [insightsRes, suggestionsRes] = await Promise.all([
        insightsApi.get(projectId),
        insightsApi.getSuggestions(projectId),
      ]);
      setInsights(insightsRes.data?.insights || []);
      setSuggestions(suggestionsRes.data?.suggestions || []);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await insightsApi.generate(projectId);
      setInsights(res.data?.insights || []);
      loadData();
    } catch {
      // Handle error
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered analysis and actionable suggestions
          </p>
        </div>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          <RefreshCw className={`h-4 w-4 mr-1 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Generate Insights'}
        </Button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Suggestions
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map((suggestion) => (
              <Card key={suggestion.id} className="border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {suggestion.priority} priority
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && insights.length > 0 && <Separator />}

      {/* Insights */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-muted rounded w-2/3 mt-2 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : insights.length === 0 && suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No insights yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Click &quot;Generate Insights&quot; to analyze your project data and get AI-powered
              recommendations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          {insights.length > 0 && (
            <>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5" />
                Analysis
              </h2>
              <div className="space-y-3">
                {insights.map((insight) => {
                  const config = severityConfig[insight.severity];
                  const Icon = config.icon;
                  return (
                    <Card key={insight.id} className={config.border}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="secondary" className={config.color}>
                            <Icon className="h-3 w-3" />
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{insight.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {insight.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(insight.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
