// src/app/sensitivity/page.tsx
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { runSensitivityAnalysis } from '../../lib/simulation/sensitivity-analysis';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function SensitivityPageContent() {
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
        setAnalysisOutput(output + '\nERROR: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
      });
  };

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    setAnalysisOutput('Running sensitivity analysis for PMOVES Economic Model...\nThis may take a moment.\n');
    
    try {
      const results = await captureConsoleOutput(() => runSensitivityAnalysis());
      setAnalysisResults(results);
      if (results && results.rankings) {
        setAnalysisOutput(prev => prev + "\nAnalysis complete. See rankings and charts below.");
      } else {
        setAnalysisOutput(prev => prev + "\nAnalysis completed, but results structure might be unexpected.");
      }
    } catch (error) {
      console.error('Error running sensitivity analysis:', error);
      setAnalysisOutput(prev => prev + `\nError during analysis: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Prepare chart data
  const prepareChartData = (paramName: string) => {
    if (!analysisResults || !analysisResults.parameterResults || !analysisResults.parameterResults[paramName]) {
      return [];
    }
    
    return analysisResults.parameterResults[paramName]
      .filter((result: any) => result && !('avgSensitivity' in result) && typeof result.paramValue === 'number' && typeof result.wealthDiff === 'number')
      .map((result: any) => ({
        paramValue: result.paramValue,
        wealthDiff: result.wealthDiff,
      }));
  };

  return (
    <div className="container mx-auto py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Parameter Sensitivity Analysis</h1>
        <p className="text-muted-foreground">
          Analyze how changes in PMOVES Economic Model parameters affect simulation outcomes.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sensitivity Analysis Controls</CardTitle>
            <CardDescription>
              This tool tests how changes in individual parameters affect the wealth difference between Model A (Traditional) and Model B (Cooperative).
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
              {isRunning ? 'Running Analysis...' : 'Run PMOVES Sensitivity Analysis'}
            </Button>
          </CardContent>
        </Card>

        {analysisResults && analysisResults.rankings && (
          <Card>
            <CardHeader>
              <CardTitle>Parameter Rankings by Impact</CardTitle>
              <CardDescription>
                Parameters ranked by their influence on the wealth difference between models.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-96"> {/* Increased height for better readability */}
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analysisResults.rankings.map((r: any) => ({ 
                        name: r.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()), // Format name
                        sensitivity: parseFloat(r.sensitivity.toFixed(3)) // More precision
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 150, bottom: 20 }} // Adjusted margins
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={180} interval={0} /> {/* Adjusted width and interval */}
                      <Tooltip formatter={(value) => `${Number(value).toFixed(3)}`} />
                      <Legend />
                      <Bar dataKey="sensitivity" fill="hsl(var(--chart-1))" name="Sensitivity Coefficient" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {analysisResults.rankings.slice(0, 4).map((param: any) => (
                    <Card key={param.name} className="overflow-hidden">
                      <CardHeader className="p-4">
                        <CardTitle className="text-base">{param.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</CardTitle>
                        <CardDescription>
                          Sensitivity: {param.sensitivity.toFixed(3)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="h-56"> {/* Increased height */}
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={prepareChartData(param.name)}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }} // Adjusted margins
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="paramValue" name="Parameter Value" />
                              <YAxis name="Wealth Difference ($)" tickFormatter={(value) => `$${Number(value)/1000}k`} /> {/* Format Y-axis ticks */}
                              <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                              <Bar dataKey="wealthDiff" fill="hsl(var(--chart-2))" name="Wealth Difference ($)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Higher sensitivity coefficients indicate a stronger impact on the simulation&apos;s wealth difference outcome.</p>
            </CardFooter>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Analysis Console Output</CardTitle>
            <CardDescription>
              Detailed log and results from the sensitivity analysis run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/30">
              <pre className="text-xs font-mono whitespace-pre-wrap">{analysisOutput}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SensitivityPage() {
  return (
      <SensitivityPageContent />
  );
}
