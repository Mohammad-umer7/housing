# MOE Strategist - Executive Country Intelligence Platform

A next-generation intelligence dashboard designed for government leadership to facilitate rapid strategic decision-making regarding energy, infrastructure, and international partnerships.

## 🎯 Features

### Core Interface
- **Command Center Dashboard**: Centralized search with natural language support for querying country intelligence
- **KPI Snapshots**: Real-time critical indicators including GDP, Energy Production, Sustainability Index, and Infrastructure Rating
- **Executive Action Bar**: Single-click triggers for generating briefing decks, summary reports, and visual insights

### Analysis & Comparison
- **Interactive Split-Screen**: Compare two countries across dynamic, toggleable variables
- **Dynamic Visualizations**: Line graphs for trends, Radar charts for comparative indices, Bar charts for detailed metrics
- **Instant Updates**: Charts update dynamically based on user selections

### AI-Powered Features
- **Report Generator Modal**: AI displays "Drafting..." states with real-time generation feedback
- **Content Editing**: Review and edit generated talking points
- **Multi-Format Export**: Download reports as PDF or PowerPoint presentations
- **Multimedia Support**: View AI-generated video summaries and visual insights

### Design & UX
- **Dark/Light Mode**: Toggle theme with persistent preference
- **Executive Aesthetic**: Minimalist, professional design with high-contrast data visualization
- **Responsive Layout**: Optimized for desktop and tablet viewing
- **Thinking States**: Loading skeletons showing what AI is currently processing

## 🛠 Technology Stack

- **Frontend Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **Charts & Visualizations**: Recharts
- **Theme Management**: next-themes
- **Icons**: Lucide React

## 📦 Installation

### Prerequisites
- Node.js 18.0 or higher
- npm or yarn package manager

### Setup Steps

1. **Navigate to project directory**
   ```bash
   cd "c:\Users\OTF\Desktop\MOE Stratigest"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🔐 Authentication

The platform supports two account types:

### User Account
- Standard access to all dashboard features
- Can view reports and analytics
- Can generate basic comparisons

### Admin Account
- Full platform access
- User management capabilities
- Advanced analytics and custom reports

**Demo Credentials**: Use any email/password combination to test the dashboard

## 🎨 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Sign-in page
│   ├── layout.tsx            # Root layout with theme provider
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard main page
│   └── globals.css           # Global styles and theme variables
├── components/
│   ├── auth/
│   │   └── sign-in-container.tsx
│   ├── dashboard/
│   │   ├── dashboard-layout.tsx
│   │   ├── header.tsx
│   │   ├── command-center.tsx
│   │   ├── kpi-grid.tsx
│   │   ├── kpi-card.tsx
│   │   ├── action-bar.tsx
│   │   ├── comparison-view.tsx
│   │   ├── country-selector.tsx
│   │   ├── metric-toggle.tsx
│   │   └── comparison-chart.tsx
│   ├── ai/
│   │   └── report-generator.tsx
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── tabs.tsx
│   └── theme-provider.tsx
public/                      # Static assets
```

## 🚀 Usage Guide

### Sign In
1. Visit the homepage
2. Choose between User or Admin account
3. Enter credentials (any email/password works in demo mode)
4. Click "Sign In"

### Command Center
- **Search**: Use natural language to query country intelligence
- **KPI Cards**: Click cards to view detailed metrics
- **Action Bar**: Generate briefing decks, reports, or visual insights

### Comparison View
1. Select two countries from the dropdowns
2. Choose metrics to compare
3. Review charts showing trends, overall metrics, and detailed comparisons

### Report Generation
1. Click "Generate Visual Insight" from the action bar
2. Select report type (Briefing Deck, Summary Report, or Visual Insight)
3. Click "Generate Report"
4. Edit talking points as needed
5. Download as PDF or PowerPoint

## 🎯 Development

### Build for Production
```bash
npm run build
npm run start
```

### Run Tests
```bash
npm run lint
```

### Environment Variables
Create a `.env.local` file for environment-specific configuration:
```
NEXT_PUBLIC_API_URL=your_api_url
```

## 📋 Features Roadmap

- [ ] Real-time data integration
- [ ] Advanced filtering and search
- [ ] Custom dashboard layouts
- [ ] Report scheduling
- [ ] Multi-language support
- [ ] API authentication
- [ ] Database integration
- [ ] User preferences storage

## 🤝 Contributing

This is a demonstration project. For production deployment:
1. Implement proper authentication (JWT, OAuth2)
2. Connect to real data APIs
3. Add comprehensive error handling
4. Implement data caching strategies
5. Add comprehensive logging

## 📝 License

All rights reserved © 2026 MOE Strategist

## 📞 Support

For technical support or inquiries, please contact the development team.

---

**Note**: This is a frontend-focused demonstration. Real implementations will require backend API integration, secure authentication, and database setup.
