import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import path from 'path'
import fs from 'fs/promises'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const outputPath = body.outputPath || 'public/reports/economic_report.pdf'
    const resolvedPath = path.join(process.cwd(), outputPath)

    // Ensure directory exists
    const dir = path.dirname(resolvedPath)
    await fs.mkdir(dir, { recursive: true }).catch(() => {})

    // Generate PDF
    const pdfBuffer = generatePDFContent()
    
    // Write to file
    await fs.writeFile(resolvedPath, pdfBuffer)

    return NextResponse.json({
      success: true,
      message: 'PDF report generated successfully',
      filePath: outputPath,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('PDF export error:', errorMessage, error)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

function generatePDFContent(): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  let yPosition = 20

  // Title
  doc.setFontSize(20)
  doc.text('United Arab Emirates - Major Economic Indicators', 105, yPosition, { align: 'center' })
  yPosition += 10

  // Date
  doc.setFontSize(9)
  doc.text(`As of ${new Date().toLocaleDateString()}`, 105, yPosition, { align: 'center' })
  yPosition += 8

  // Real GDP and Inflation
  doc.setFontSize(14)
  doc.text('Real GDP and Inflation', 15, yPosition)
  yPosition += 6
  doc.setFontSize(9)
  doc.text('2022-2026 (2024-2026 forecast)', 15, yPosition)
  yPosition += 6
  
  const gdpInflationTable = [
    ['Year', 'Real GDP (%)', 'Inflation (%)'],
    ['2022', '7.5', '4.8'],
    ['2023', '3.6', '1.5'],
    ['2024(e)', '4.0', '1.7'],
    ['2025(f)', '4.8', '1.6'],
    ['2026(f)', '5.0', '2.0'],
  ]
  
  drawTable(doc, 15, yPosition, gdpInflationTable)
  yPosition += 38

  // GDP by Sector
  doc.setFontSize(14)
  doc.text('GDP by Sector (2023)', 15, yPosition)
  yPosition += 6
  
  const sectorTable = [
    ['Sector', 'Percentage (%)'],
    ['Services', '51.6'],
    ['Industry', '47.7'],
    ['Agriculture', '0.7'],
  ]
  
  drawTable(doc, 15, yPosition, sectorTable)
  yPosition += 28

  // Unemployment Rate
  doc.setFontSize(14)
  doc.text('Unemployment Rate', 15, yPosition)
  yPosition += 6
  doc.setFontSize(9)
  doc.text('2020-2024 (World Bank data)', 15, yPosition)
  yPosition += 6
  
  const unemploymentTable = [
    ['Year', 'Unemployment Rate (%)'],
    ['2020', '4.3'],
    ['2021', '3.1'],
    ['2022', '2.9'],
    ['2023', '2.2'],
    ['2024', '2.1'],
  ]
  
  drawTable(doc, 15, yPosition, unemploymentTable)
  yPosition += 38

  // Current Account Balance
  doc.setFontSize(14)
  doc.text('Current Account Balance', 15, yPosition)
  yPosition += 6
  doc.setFontSize(9)
  doc.text('2022-2026 (2024-2026 forecast), USD Billions', 15, yPosition)
  yPosition += 6
  
  const accountTable = [
    ['Year', 'Balance (USD B)', '% of GDP'],
    ['2022', '66.5', '12'],
    ['2023', '68.6', '11.5'],
    ['2024(e)', '80.0', '12.0'],
    ['2025(f)', '75.0', '11.0'],
    ['2026(f)', '74.0', '10.5'],
  ]
  
  drawTable(doc, 15, yPosition, accountTable)
  yPosition += 38

  // Key Economic Insights
  yPosition += 5
  doc.setFontSize(14)
  doc.text('Key Economic Insights', 15, yPosition)
  yPosition += 8
  
  doc.setFontSize(10)
  const insights = [
    '• GDP Growth: Steady recovery with 5.0% growth projected for 2026',
    '• Inflation: Moderate levels at 2.0%, well-controlled by monetary policy',
    '• Employment: Strong job market with unemployment at historic low of 2.1%',
    '• Trade: Robust current account surplus of USD 74.0B in 2026 projection',
  ]
  
  insights.forEach((insight) => {
    doc.text(insight, 15, yPosition, { maxWidth: 180 })
    yPosition += 6
  })

  // Footer
  yPosition = 280
  doc.setFontSize(8)
  doc.text('Data Source: IMF World Economic Outlook, World Bank | Last Updated: ' + new Date().toLocaleDateString(), 105, yPosition, { align: 'center' })
  doc.text('Individual figures may not add up to 100% due to rounding.', 105, yPosition + 4, { align: 'center' })

  // Get PDF as buffer
  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}

function drawTable(doc: jsPDF, startX: number, startY: number, tableData: string[][]): void {
  const cellWidth = 50
  const cellHeight = 7
  const headerColor = [155, 122, 54]
  const lightRowColor = [246, 240, 225]
  const darkRowColor = [255, 255, 255]

  // Helper to draw a cell
  const drawCell = (x: number, y: number, text: string, bgColor: number[], textColor: number[], isBold: boolean = false) => {
    // Draw background
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2])
    doc.rect(x, y, cellWidth, cellHeight, 'F')
    
    // Draw border
    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.3)
    doc.rect(x, y, cellWidth, cellHeight)
    
    // Draw text
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.setFontSize(isBold ? 9 : 8)
    doc.text(text, x + 2, y + 5, { maxWidth: cellWidth - 4 })
  }

  // Draw header row
  tableData[0].forEach((header, i) => {
    drawCell(startX + i * cellWidth, startY, header, headerColor, [255, 255, 255], true)
  })

  // Draw data rows
  tableData.slice(1).forEach((row, rowIndex) => {
    const rowY = startY + cellHeight * (rowIndex + 1)
    const bgColor = rowIndex % 2 === 0 ? lightRowColor : darkRowColor
    
    row.forEach((cell, colIndex) => {
      drawCell(startX + colIndex * cellWidth, rowY, cell, bgColor, [0, 0, 0], false)
    })
  })
}
