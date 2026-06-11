import { jsPDF } from 'jspdf'

// ── Shared Styling Helper constants ─────────────────────────────────────────
const GOLD_COLOR = [155, 122, 54] as [number, number, number]       // #9b7a36
const CREAM_COLOR = [246, 240, 225] as [number, number, number]     // #f6f0e1
const DARK_COLOR = [26, 18, 8] as [number, number, number]          // #1a1208
const WHITE_COLOR = [255, 255, 255] as [number, number, number]

interface TableColumn {
  header: string
  width: number
  align?: 'left' | 'center' | 'right'
}

function drawPDFHeader(doc: jsPDF, title: string, subtitle?: string) {
  // Page background soft accent top bar
  doc.setFillColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2])
  doc.rect(0, 0, 210, 8, 'F')

  // Header Title
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2])
  doc.text('MOE STRATEGIST', 15, 20)

  // Subtitle / Section title
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(DARK_COLOR[0], DARK_COLOR[1], DARK_COLOR[2])
  doc.text(title, 15, 26)

  if (subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(subtitle, 15, 31)
  }

  // Horizontal line separating header
  doc.setDrawColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2])
  doc.setLineWidth(0.5)
  doc.line(15, 35, 195, 35)
}

function drawPDFFooter(doc: jsPDF, pageNum: number = 1) {
  const y = 282
  // Horizontal line separating footer
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(15, y - 5, 195, y - 5)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text('Data Source: MOE Strategist Real-Time Data Streams', 15, y)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, y, { align: 'center' })
  doc.text(`Page ${pageNum}`, 195, y, { align: 'right' })
}

function drawPDFTable(
  doc: jsPDF,
  startY: number,
  columns: TableColumn[],
  rows: string[][],
) {
  let currentY = startY
  const cellHeight = 8

  // Draw Header
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)

  let currentX = 15
  columns.forEach((col) => {
    // Background for header cell
    doc.setFillColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2])
    doc.rect(currentX, currentY, col.width, cellHeight, 'F')
    
    // Draw text inside cell
    let textX = currentX + 3
    if (col.align === 'center') textX = currentX + col.width / 2
    else if (col.align === 'right') textX = currentX + col.width - 3

    doc.text(col.header, textX, currentY + 5.5, {
      align: col.align || 'left',
      maxWidth: col.width - 6,
    })
    currentX += col.width
  })
  currentY += cellHeight

  // Draw Rows
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8.5)

  rows.forEach((row, rowIndex) => {
    // Alternating background color
    const bgColor = rowIndex % 2 === 0 ? CREAM_COLOR : WHITE_COLOR

    currentX = 15
    row.forEach((cellText, colIndex) => {
      const col = columns[colIndex]
      if (!col) return

      // Draw background
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2])
      doc.rect(currentX, currentY, col.width, cellHeight, 'F')

      // Draw thin border
      doc.setDrawColor(230, 220, 200)
      doc.setLineWidth(0.2)
      doc.rect(currentX, currentY, col.width, cellHeight, 'S')

      // Write text inside cell
      doc.setTextColor(DARK_COLOR[0], DARK_COLOR[1], DARK_COLOR[2])
      let textX = currentX + 3
      if (col.align === 'center') textX = currentX + col.width / 2
      else if (col.align === 'right') textX = currentX + col.width - 3

      doc.text(cellText || '—', textX, currentY + 5.5, {
        align: col.align || 'left',
        maxWidth: col.width - 6,
      })
      currentX += col.width
    })
    currentY += cellHeight
  })

  return currentY
}

// ── Export Functions ─────────────────────────────────────────────────────────

export function exportKPIToPDF(kpis: any[]) {
  const doc = new jsPDF('p', 'mm', 'a4')
  
  drawPDFHeader(doc, 'Critical Indicators - Real-Time Dashboard Status', 'Real-time telemetry showing core strategic KPIs')

  const columns: TableColumn[] = [
    { header: 'Indicator Name', width: 60 },
    { header: 'Current Value', width: 35, align: 'center' },
    { header: 'Unit', width: 25, align: 'center' },
    { header: 'Change %', width: 30, align: 'center' },
    { header: 'Metric Scope', width: 30 },
  ]

  const rows = kpis.map(kpi => [
    kpi.title,
    kpi.value.toString(),
    kpi.unit,
    `${kpi.change >= 0 ? '+' : ''}${kpi.change}%`,
    kpi.description,
  ])

  const nextY = drawPDFTable(doc, 45, columns, rows)

  // Brief Executive Summary
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2])
  doc.text('Strategic Insights Summary', 15, nextY + 15)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(DARK_COLOR[0], DARK_COLOR[1], DARK_COLOR[2])
  const summaryText = 
    `This report presents a real-time snapshot of the global critical indicators monitored by the MOE Strategist command center. ` +
    `Key metrics including global GDP growth, bilateral trade, and renewable energy capacities are continuously captured and updated. ` +
    `Currently, the indicators demonstrate stable performance with key sustainability and trade targets operating within high efficiency ranges.`
  
  doc.text(summaryText, 15, nextY + 22, { maxWidth: 180 })

  drawPDFFooter(doc)
  doc.save(`Critical_Indicators_Report_${Date.now()}.pdf`)
}

export function exportGlobalFeedToPDF(countries: any[]) {
  const doc = new jsPDF('p', 'mm', 'a4')

  drawPDFHeader(doc, 'Live Global Feed Status', 'Real-time country telemetry streams')

  const columns: TableColumn[] = [
    { header: 'Country Name', width: 45 },
    { header: 'ISO Code', width: 25, align: 'center' },
    { header: 'GDP EMA ($B)', width: 35, align: 'center' },
    { header: 'CAGR (1yr %)', width: 35, align: 'center' },
    { header: 'ESG Score (%)', width: 40, align: 'center' },
  ]

  const rows = countries.map(c => [
    c.label,
    c.code,
    c.gdpEma || '—',
    c.cagr || '—',
    c.esg || '—',
  ])

  drawPDFTable(doc, 45, columns, rows)
  drawPDFFooter(doc)
  doc.save(`Live_Global_Feed_${Date.now()}.pdf`)
}

export function exportComparisonToPDF(
  country1: string,
  country2: string,
  metrics: string[],
  data: any,
) {
  const doc = new jsPDF('p', 'mm', 'a4')

  drawPDFHeader(
    doc,
    `Bilateral Country Comparison: ${country1} vs ${country2}`,
    `Comparative metrics and infrastructure capability profiling`,
  )

  // Metrics Table
  const columns: TableColumn[] = [
    { header: 'Sector Metric', width: 60 },
    { header: `${country1} Status`, width: 60, align: 'center' },
    { header: `${country2} Status`, width: 60, align: 'center' },
  ]

  const rows = metrics.map((m) => {
    const label = m.charAt(0).toUpperCase() + m.slice(1)
    const val1 = data[m]?.[country1] || '—'
    const val2 = data[m]?.[country2] || '—'
    return [label, val1.toString(), val2.toString()]
  })

  const nextY = drawPDFTable(doc, 45, columns, rows)

  // Comparative remarks
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2])
  doc.text('Comparative Summary & Alignment Opportunities', 15, nextY + 15)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(DARK_COLOR[0], DARK_COLOR[1], DARK_COLOR[2])
  const summaryText = 
    `Based on the bilateral mapping above, ${country1} and ${country2} present highly complementary strategic profiles. ` +
    `Areas of energy production and sustainability index scores show strong potential for joint infrastructure projects, bilateral technology transfers, and smart grid orchestration policies.`
  
  doc.text(summaryText, 15, nextY + 22, { maxWidth: 180 })

  drawPDFFooter(doc)
  doc.save(`Bilateral_Comparison_${country1}_vs_${country2}_${Date.now()}.pdf`)
}

export function exportVisualInsightsToPDF(activeAsset: any, telemetry: any[]) {
  const doc = new jsPDF('p', 'mm', 'a4')

  drawPDFHeader(
    doc,
    `Visual Asset Status: ${activeAsset.name}`,
    `Strategic Infrastructure Telemetry & Operational Analysis`,
  )

  // Asset Details
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2])
  doc.text('Asset Specifications & Information', 15, 45)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(DARK_COLOR[0], DARK_COLOR[1], DARK_COLOR[2])
  doc.text(`Asset Name:      ${activeAsset.name}`, 15, 53)
  doc.text(`Asset Type:      ${activeAsset.type}`, 15, 59)
  doc.text(`Location Scope:  ${activeAsset.location}`, 15, 65)

  doc.text('Description:', 15, 71)
  doc.text(activeAsset.description, 45, 71, { maxWidth: 150 })

  // Telemetry Table
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(GOLD_COLOR[0], GOLD_COLOR[1], GOLD_COLOR[2])
  doc.text('Real-Time Telemetry and Operational Efficiency', 15, 90)

  const columns: TableColumn[] = [
    { header: 'Telemetry Metric', width: 70 },
    { header: 'Operational Value', width: 55, align: 'center' },
    { header: 'Status Flag', width: 55, align: 'center' },
  ]

  const rows = telemetry.map((t) => [
    t.label,
    t.value,
    t.status,
  ])

  drawPDFTable(doc, 96, columns, rows)

  drawPDFFooter(doc)
  doc.save(`Visual_Asset_Report_${activeAsset.id}_${Date.now()}.pdf`)
}

export function exportLiveInsightsToPDF(streams: string[], insights: any[]) {
  const doc = new jsPDF('p', 'mm', 'a4')

  drawPDFHeader(
    doc,
    'Live Intelligence Streams & Real-Time Insights',
    `Report covering ${streams.length} active country data streams`,
  )

  const columns: TableColumn[] = [
    { header: 'Country Code', width: 35, align: 'center' },
    { header: 'GDP EMA ($B)', width: 35, align: 'center' },
    { header: 'Inflation (%)', width: 35, align: 'center' },
    { header: 'Live Strategic Insight Note', width: 75 },
  ]

  const rows = insights.map((ins) => [
    ins.code,
    ins.gdp,
    ins.inflation,
    ins.note,
  ])

  drawPDFTable(doc, 45, columns, rows)
  drawPDFFooter(doc)
  doc.save(`Live_Insights_Report_${Date.now()}.pdf`)
}
