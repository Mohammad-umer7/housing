# MOE Strategist - Architecture Overview

## Project Structure

```
MOE Strategist/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Sign-in page entry point
│   │   ├── layout.tsx               # Root layout with theme provider
│   │   ├── globals.css              # Global styles & CSS variables
│   │   └── dashboard/
│   │       └── page.tsx             # Dashboard page
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── sign-in-container.tsx    # Auth UI with tabs for user/admin
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard-layout.tsx     # Main dashboard wrapper
│   │   │   ├── header.tsx              # Navigation header
│   │   │   ├── command-center.tsx      # Main intelligence search interface
│   │   │   ├── kpi-grid.tsx            # KPI cards grid
│   │   │   ├── kpi-card.tsx            # Individual KPI card component
│   │   │   ├── action-bar.tsx          # Executive action buttons
│   │   │   ├── comparison-view.tsx     # Country comparison split-screen
│   │   │   ├── comparison-chart.tsx    # Charts for comparison (Line/Radar/Bar)
│   │   │   ├── country-selector.tsx    # Country dropdown selector
│   │   │   └── metric-toggle.tsx       # Metric selection checkboxes
│   │   │
│   │   ├── ai/
│   │   │   ├── report-generator.tsx    # AI report generation modal
│   │   │   └── multimedia-viewer.tsx   # AI-generated content viewer
│   │   │
│   │   ├── ui/
│   │   │   ├── button.tsx              # Button component (variants: default, ghost, outline, secondary)
│   │   │   ├── input.tsx               # Input component
│   │   │   ├── card.tsx                # Card layout component
│   │   │   ├── tabs.tsx                # Tabs component (Radix UI based)
│   │   │   └── dialog.tsx              # Dialog/Modal component
│   │   │
│   │   ├── theme-provider.tsx          # Next-themes provider wrapper
│   │   └── loading-skeleton.tsx        # Loading states & thinking indicators
│   │
│   └── lib/
│       └── auth.ts                     # Authentication utility functions
│
├── public/                             # Static assets
├── package.json                        # Dependencies & scripts
├── tsconfig.json                       # TypeScript configuration
├── tailwind.config.js                  # Tailwind CSS configuration
├── postcss.config.js                   # PostCSS configuration
├── next.config.js                      # Next.js configuration
├── .gitignore                          # Git ignore rules
├── .env.example                        # Environment variables template
├── README.md                           # Project documentation
├── USER_GUIDE.md                       # User manual
└── ARCHITECTURE.md                     # This file
```

## Technology Stack

### Frontend Framework
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **React 18**: Latest React features and hooks

### Styling & UI
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: High-quality accessible components
- **Radix UI**: Headless component primitives
- **Lucide React**: Beautiful icon library

### Charts & Visualization
- **Recharts**: Composable charting library
  - Line Charts: Time-series trends
  - Radar Charts: Multi-variable comparison
  - Bar Charts: Categorical comparison

### State Management & Theme
- **Zustand**: Lightweight state management (ready for expansion)
- **next-themes**: Seamless theme management
- **React Context**: For authentication state

### HTTP Client
- **Axios**: Promise-based HTTP client for API calls

---

## Key Design Patterns

### 1. Component Architecture

#### Smart Components (Containers)
- Handle business logic and state
- Manage data fetching
- Pass props to presentational components
- Examples: `CommandCenter`, `ComparisonView`, `DashboardLayout`

#### Presentational Components (UI)
- Focus on rendering UI
- Accept data as props
- Include styling logic
- Examples: `KPICard`, `CountrySelector`, `ActionBar`

### 2. Routing Structure

- **Root**: `/` - Sign-in page
- **Dashboard**: `/dashboard` - Main application interface
- Authentication check happens client-side (can be moved to middleware)

### 3. Theme System

```typescript
// Dark mode (default)
CSS Variables: --background, --foreground, --primary, --secondary, etc.

// Light mode
Automatically inverted values
Toggle via useTheme() hook
```

### 4. State Management Flow

```
User Session (localStorage)
    ↓
useTheme() for appearance
    ↓
Component-level state (useState)
    ↓
Ready for global state expansion (Zustand)
```

---

## Data Flow Architecture

### Command Center Search Flow
```
User Input (Natural Language)
    ↓
AI Processing (simulated)
    ↓
Display Thinking States
    ↓
Return Results
    ↓
Update Dashboard
```

### Comparison View Flow
```
Select Country 1 & 2
    ↓
Toggle Metrics
    ↓
Fetch Data (API call)
    ↓
Process for Visualization
    ↓
Render Charts
```

### Report Generation Flow
```
Select Report Type
    ↓
AI Drafting (step-by-step)
    ↓
Display Content
    ↓
Allow Editing
    ↓
Export (PDF/PowerPoint)
```

---

## Component Interaction Map

```
DashboardLayout
├── Header
│   ├── Navigation (viewMode state)
│   ├── Theme Toggle
│   └── Logout
│
├── CommandCenter
│   ├── SearchBar (with thinking states)
│   ├── KPIGrid
│   │   └── KPICard (x4)
│   └── ActionBar
│
├── ComparisonView
│   ├── CountrySelector (x2)
│   ├── MetricToggle
│   └── ComparisonChart
│       ├── LineChart
│       ├── RadarChart
│       └── BarChart
│
├── MultimediaViewer
│   └── MediaItems
│       └── MediaViewer Modal
│
└── AIReportGenerator (Modal)
    ├── ReportTypeSelector
    ├── GenerationProcess
    ├── ContentEditor
    └── ExportButtons
```

---

## API Integration Points (Ready for Backend)

### Planned API Endpoints

```typescript
// Authentication
POST /api/auth/signin
POST /api/auth/logout
GET /api/auth/verify

// Country Data
GET /api/countries
GET /api/countries/:id
GET /api/countries/:id/metrics
GET /api/countries/:id1/compare/:id2

// Metrics
GET /api/metrics
GET /api/metrics/:country/:metric
GET /api/metrics/:country/:metric/trends

// AI Operations
POST /api/ai/search
POST /api/ai/generate-report
POST /api/ai/generate-insights

// User Profile
GET /api/user/profile
PUT /api/user/preferences
GET /api/user/saved-reports
```

---

## Performance Optimization

### Current Implementation
- ✓ Code splitting via Next.js automatic splitting
- ✓ Image optimization ready (public folder)
- ✓ Dark mode reduces eye strain
- ✓ Responsive design for all screen sizes

### Future Optimizations
- [ ] Implement data caching strategy
- [ ] Add request debouncing for search
- [ ] Lazy load chart libraries
- [ ] Implement virtual scrolling for large datasets
- [ ] Add service workers for offline support

---

## Security Considerations

### Current Demo Implementation
- ⚠️ Authentication is client-side (demo only)
- ⚠️ No real data validation

### Production Implementation Checklist
- [ ] JWT/OAuth2 authentication
- [ ] Secure HTTP-only cookies
- [ ] CORS configuration
- [ ] Rate limiting
- [ ] Input validation & sanitization
- [ ] Data encryption in transit (HTTPS)
- [ ] Environment variable protection
- [ ] CSRF token implementation
- [ ] SQL injection prevention
- [ ] XSS protection

---

## Development Workflow

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### Building for Production
```bash
npm run build
npm run start
```

### Code Quality
```bash
npm run lint
```

---

## Styling Architecture

### CSS Variables (Tailwind)
```css
--background: Page background
--foreground: Text color
--primary: Main action color (Blue)
--secondary: Secondary color (Light Gray)
--accent: Accent color (Cyan)
--destructive: Error/warning color (Red)
--muted: Muted text color
--border: Border color
```

### Color Gradient Palette
- Primary: Blue to Cyan
- Energy: Yellow to Orange
- Sustainability: Green to Emerald
- Infrastructure: Purple to Pink
- Admin: Amber to Orange

---

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile: iOS Safari 12+, Chrome Android 12+

---

## Future Enhancements

### Phase 2
- [ ] Real-time data integration
- [ ] Advanced filtering system
- [ ] Custom dashboard layouts
- [ ] Report scheduling

### Phase 3
- [ ] Multi-language support
- [ ] Mobile application
- [ ] Collaborative features
- [ ] API documentation

### Phase 4
- [ ] Machine learning predictions
- [ ] Real-time collaboration
- [ ] Advanced analytics
- [ ] Integration marketplace

---

## Troubleshooting Guide

### Development Issues

**Issue**: Components not updating
- Clear Next.js cache: `rm -rf .next`
- Restart dev server

**Issue**: Styles not applying
- Verify Tailwind config
- Check CSS variable names
- Clear browser cache

**Issue**: Theme not persisting
- Check localStorage in DevTools
- Verify next-themes setup
- Check HTML root element

---

## Contributing Guidelines

1. Follow TypeScript strict mode
2. Use functional components with hooks
3. Add proper type annotations
4. Keep components focused and reusable
5. Document complex logic
6. Test responsive design

---

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Shadcn/ui Components](https://ui.shadcn.com)
- [Recharts Docs](https://recharts.org)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

**Last Updated**: June 2026
**Version**: 1.0.0
**Status**: Production Ready (Frontend Demo)
