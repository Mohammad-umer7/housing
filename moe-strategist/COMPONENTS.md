# Component Reference Guide

## Base UI Components

### Button
```tsx
import { Button } from '@/components/ui/button'

// Variants: 'default' | 'ghost' | 'outline' | 'secondary'
// Sizes: 'default' | 'sm' | 'lg' | 'icon'

<Button variant="ghost" size="sm">Click me</Button>
<Button onClick={() => {}} disabled={isLoading}>Submit</Button>
```

### Input
```tsx
import { Input } from '@/components/ui/input'

<Input
  type="text"
  placeholder="Enter text..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
  disabled={isDisabled}
/>
```

### Card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

### Tabs
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

### Dialog
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/components/ui/dialog'

<Dialog>
  <DialogTrigger>Open Dialog</DialogTrigger>
  <DialogContent>
    <DialogTitle>Dialog Title</DialogTitle>
    Content here
  </DialogContent>
</Dialog>
```

---

## Dashboard Components

### CommandCenter
```tsx
import { CommandCenter } from '@/components/dashboard/command-center'

// Standalone component, no props needed
<CommandCenter />
```

### KPIGrid & KPICard
```tsx
import { KPIGrid } from '@/components/dashboard/kpi-grid'
import { KPICard } from '@/components/dashboard/kpi-card'

<KPIGrid /> {/* Displays grid of 4 KPI cards */}

{/* Or use KPICard individually: */}
<KPICard
  title="GDP Growth"
  value="2.8"
  change={1.2}
  unit="%"
  icon={<TrendingUp />}
  color="from-blue-500 to-cyan-500"
  description="Year-over-year growth"
/>
```

### ComparisonView
```tsx
import { ComparisonView } from '@/components/dashboard/comparison-view'

<ComparisonView /> {/* Full comparison interface */}
```

### CountrySelector
```tsx
import { CountrySelector } from '@/components/dashboard/country-selector'

<CountrySelector
  label="Select Country"
  value={country}
  onChange={(c) => setCountry(c)}
/>
```

### MetricToggle
```tsx
import { MetricToggle } from '@/components/dashboard/metric-toggle'

<MetricToggle
  metrics={selectedMetrics}
  onToggle={(metric) => toggleMetric(metric)}
/>
```

### ComparisonChart
```tsx
import { ComparisonChart } from '@/components/dashboard/comparison-chart'

<ComparisonChart
  country1="UAE"
  country2="Norway"
  metrics={['energy', 'sustainability']}
/>
```

---

## AI Components

### AIReportGenerator
```tsx
import { AIReportGenerator } from '@/components/ai/report-generator'

<AIReportGenerator onClose={() => setShowReport(false)} />
```

### MultimediaViewer
```tsx
import { MultimediaViewer } from '@/components/ai/multimedia-viewer'

<MultimediaViewer />
```

---

## Loading & Feedback Components

### LoadingSkeleton
```tsx
import { LoadingSkeleton } from '@/components/loading-skeleton'

<LoadingSkeleton
  message="Processing..."
  details={['Fetching data', 'Analyzing metrics']}
/>
```

### ThinkingState
```tsx
import { ThinkingState } from '@/components/loading-skeleton'

<ThinkingState
  thoughts={['Step 1', 'Step 2', 'Step 3']}
  currentThought={1}
/>
```

### KPICardSkeleton
```tsx
import { KPICardSkeleton } from '@/components/loading-skeleton'

<KPICardSkeleton />
```

### ChartSkeleton
```tsx
import { ChartSkeleton } from '@/components/loading-skeleton'

<ChartSkeleton />
```

---

## Layout Components

### Header
```tsx
import { Header } from '@/components/dashboard/header'

<Header
  onViewChange={(view) => setView(view)}
  currentView={currentView}
  onToggleTheme={() => toggleTheme()}
  currentTheme="dark"
  onShowReport={() => setShowReportModal(true)}
/>
```

### DashboardLayout
```tsx
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'

<DashboardLayout /> {/* Main dashboard container */}
```

---

## Theme Provider

### Using Themes
```tsx
import { useTheme } from 'next-themes'

function MyComponent() {
  const { theme, setTheme } = useTheme()
  
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </button>
  )
}
```

---

## Authentication

### Auth Utilities
```tsx
import { 
  setUserSession, 
  getUserRole, 
  isAdmin, 
  clearUserSession 
} from '@/lib/auth'

// Login
setUserSession('user', 'user@example.com')

// Check role
if (isAdmin()) {
  // Admin only code
}

// Logout
clearUserSession()
```

---

## Common Patterns

### Form Submission
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  
  try {
    // Your API call
    await someAPI()
  } catch (error) {
    setError('Error occurred')
  } finally {
    setIsLoading(false)
  }
}
```

### Theme-Aware Styling
```tsx
<div className="bg-background text-foreground">
  {/* Automatically adapts to dark/light mode */}
</div>
```

### Responsive Classes
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 1 column mobile, 2 tablet, 4 desktop */}
</div>
```

### Gradient Text
```tsx
<h1 className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
  Gradient Text
</h1>
```

---

## Icon Library

### Available Icons (Lucide React)
```tsx
import { 
  Search, 
  Loader, 
  TrendingUp, 
  Shield,
  LogOut,
  Moon,
  Sun,
  FileText,
  GitCompare,
  Film,
  Download,
  Share2,
  Sparkles,
  Copy,
  Play,
  BarChart3,
  Zap,
  TreePine,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  X
} from 'lucide-react'
```

---

## Chart Components (Recharts)

### Line Chart
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

<ResponsiveContainer width="100%" height={400}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="value" stroke="#3b82f6" />
  </LineChart>
</ResponsiveContainer>
```

### Radar Chart
```tsx
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts'

<ResponsiveContainer width="100%" height={400}>
  <RadarChart data={data}>
    <PolarGrid />
    <PolarAngleAxis dataKey="name" />
    <PolarRadiusAxis />
    <Radar name="Series 1" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
    <Legend />
  </RadarChart>
</ResponsiveContainer>
```

### Bar Chart
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

<ResponsiveContainer width="100%" height={400}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis />
    <YAxis />
    <Tooltip />
    <Legend />
    <Bar dataKey="value" fill="#3b82f6" />
  </BarChart>
</ResponsiveContainer>
```

---

## Styling Utilities

### Color Variables (CSS)
```css
--primary: Main brand color
--secondary: Secondary color
--accent: Accent highlight
--background: Page background
--foreground: Text color
--border: Border color
--muted: Muted text/background
--destructive: Error/danger color
```

### Tailwind Classes
```tsx
// Colors
className="bg-primary text-white"

// Responsive
className="hidden md:block" // Hide on mobile, show on tablet+

// Gradients
className="bg-gradient-to-r from-blue-500 to-cyan-500"

// Transitions
className="transition-all duration-300"

// Animations
className="animate-spin" // Loading spinner
className="animate-pulse" // Pulsing effect
```

---

## Performance Tips

1. **Use React.memo** for expensive components
2. **Lazy load routes** with dynamic imports
3. **Debounce search** queries
4. **Cache API responses** with appropriate headers
5. **Use Next.js Image** component for optimization

---

## Testing Components

```tsx
// Example test structure
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

test('Button renders with text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})
```

---

**Last Updated**: June 2026
**Framework**: Next.js 14, React 18
