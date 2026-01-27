"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { runSensitivityAnalysis } from '@/lib/simulation/sensitivity-analysis';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SensitivityPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [analysisOutput, setAnalysisOutput] = useState<string>('');
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  // Capture console.log output
  const captureConsoleOutput = (fn: () => Promise<any>) => {
    const originalLog = console.log;
    const originalError = console.error;
    let output = '';

    console.log = (...args) => {
      output += args.join(' ') + '\n';
      originalLog(...args);
    };

    console.error = (...args) => {
      output += 'ERROR: ' + args.join(' ') + '\n';
      originalError(...args);
    };

    return fn()
      .then(result => {
        console.log = originalLog;
        console.error = originalError;
        setAnalysisOutput(output);
        return result;
      })
      .catch(error => {
        console.log = originalLog;
        console.error = originalError;
        setAnalysisOutput(output + '\nERROR: ' + error.message);
        throw error;
      });
  };

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    setAnalysisOutput('Running sensitivity analysis...\n');
    
    try {
      const results = await captureConsoleOutput(() => runSensitivityAnalysis());
      setAnalysisResults(results);
    } catch (error) {
      console.error('Error running sensitivity analysis:', error);
    } finally {
      setIsRunning(false);
    }
  };

  // Prepare chart data
  const prepareChartData = (paramName: string) => {
    if (!analysisResults || !analysisResults.parameterResults[paramName]) {
      return [];
    }
    
    return analysisResults.parameterResults[paramName]
      .filter((result: any) => !('avgSensitivity' in result))
      .map((result: any) => ({
        paramValue: result.paramValue,
        wealthDiff: result.wealthDiff,
        percentChange: result.percentChange * 100 // Convert to percentage
      }));
  };

  return (
    <div className="container mx-auto py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Parameter Sensitivity Analysis</h1>
        <p className="text-muted-foreground">
          Analyze how changes in parameters affect simulation outcomes
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sensitivity Analysis</CardTitle>
            <CardDescription>
              This tool tests how changes in individual parameters affect the wealth difference between models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                The sensitivity analysis will run multiple simulations with varying parameter values to determine
                which parameters have the most significant impact on the results. This may take a few minutes to complete.
              </p>
            </div>
            <Button
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? 'Running Analysis...' : 'Run Sensitivity Analysis'}
            </Button>
          </CardContent>
        </Card>

        {analysisResults && (
          <Card>
            <CardHeader>
              <CardTitle>Parameter Rankings</CardTitle>
              <CardDescription>
                Parameters ranked by their impact on simulation results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analysisResults.rankings.map((r: any) => ({ 
                        name: r.name, 
                        sensitivity: parseFloat(r.sensitivity.toFixed(2))
                      }))}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={150} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sensitivity" fill="#8884d8" name="Sensitivity Coefficient" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {analysisResults.rankings.slice(0, 4).map((param: any) => (
                    <Card key={param.name} className="overflow-hidden">
                      <CardHeader className="p-4">
                        <CardTitle className="text-base">{param.name}</CardTitle>
                        <CardDescription>
                          Sensitivity: {param.sensitivity.toFixed(2)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={prepareChartData(param.name)}
                              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="paramValue" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="wealthDiff" fill="#82ca9d" name="Wealth Difference ($)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Analysis Output</CardTitle>
            <CardDescription>
              Detailed results of the sensitivity analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap">{analysisOutput}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
