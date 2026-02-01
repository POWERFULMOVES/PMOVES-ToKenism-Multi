"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRightIcon } from '@radix-ui/react-icons';

export default function DocumentationPage() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>PMOVES Token Simulator Documentation</CardTitle>
          <CardDescription>
            Comprehensive documentation for understanding and using the simulator
          </CardDescription>
        </CardHeader>
        <CardContent className="prose max-w-none">
          <p>
            The PMOVES Token Simulator is a tool for comparing traditional economic models with cooperative economic models. 
            It allows users to explore how different parameters affect economic outcomes and to understand the potential 
            benefits of cooperative economic approaches.
          </p>
          
          <h3>Documentation Sections</h3>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <Link href="/documentation/mathematical-model" className="no-underline">
              <Card className="h-full hover:bg-gray-50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Mathematical Model
                    <ArrowRightIcon className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Explains the mathematical model used in the simulator, including its strengths and limitations.
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/documentation/presets" className="no-underline">
              <Card className="h-full hover:bg-gray-50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Preset Scenarios
                    <ArrowRightIcon className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Describes the pre-configured scenarios available in the simulator.
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/documentation/metrics" className="no-underline">
              <Card className="h-full hover:bg-gray-50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Key Metrics
                    <ArrowRightIcon className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Explains the key metrics used to evaluate the simulation results.
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/documentation/interpretation" className="no-underline">
              <Card className="h-full hover:bg-gray-50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Interpretation Guide
                    <ArrowRightIcon className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Provides guidance on how to interpret the simulation results.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
          
          <h3 className="mt-8">Getting Started</h3>
          <p>
            To get started with the simulator, select a preset scenario from the dropdown menu or adjust the parameters manually. 
            Click the &quot;Run Simulation&quot; button to see the results.
          </p>
          
          <p>
            The simulator will display the results in several formats:
          </p>
          <ul>
            <li>Summary metrics comparing the two economic scenarios</li>
            <li>Charts showing the evolution of key metrics over time</li>
            <li>Detailed analysis of the final state of the economy</li>
            <li>Mathematical validation of the results</li>
          </ul>
          
          <div className="mt-8">
            <Link href="/" className="text-blue-500 hover:text-blue-700">
              &larr; Return to Simulator
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
