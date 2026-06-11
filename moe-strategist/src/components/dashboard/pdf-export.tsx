import React, { useState } from 'react';
import { Download, FileText, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PDFExportProps {
  onExportComplete?: (filePath: string) => void;
}

export function PDFExport({ onExportComplete }: PDFExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleExportPDF = async () => {
    setIsExporting(true);
    setExportStatus('loading');
    setErrorMessage('');

    try {
      // Call the API route to export PDF via MCP server
      const response = await fetch('/api/mcp/export-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outputPath: 'public/reports/economic_report.pdf',
          includeCharts: true,
          title: 'United Arab Emirates - Major Economic Indicators',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export PDF');
      }

      const data = await response.json();

      setExportStatus('success');
      if (onExportComplete) {
        onExportComplete(data.filePath || 'public/reports/economic_report.pdf');
      }

      // Auto-download the PDF
      setTimeout(() => {
        downloadPDF();
      }, 500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      setErrorMessage(errorMsg);
      setExportStatus('error');
      console.error('PDF export error:', error);
    } finally {
      setIsExporting(false);
      // Reset status after 3 seconds
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
    }
  };

  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = '/reports/economic_report.pdf';
    link.download = 'UAE_Economic_Indicators.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-amber-50 to-transparent border-amber-200">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Export Economic Report
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Generate and download a professional PDF report with real-time UAE economic indicators, 
            including GDP, inflation, unemployment, and current account balance data.
          </p>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isExporting ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Generate & Download PDF
                </>
              )}
            </Button>

            <Button
              onClick={downloadPDF}
              variant="outline"
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </div>

          {exportStatus === 'success' && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                ✓ PDF report generated successfully! Download starting...
              </p>
            </div>
          )}

          {exportStatus === 'error' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                ✗ Error: {errorMessage}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default PDFExport;
