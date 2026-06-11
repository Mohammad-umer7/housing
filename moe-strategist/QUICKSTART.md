# Quick Start Guide - MOE Strategist

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies
```bash
cd "c:\Users\OTF\Desktop\MOE Stratigest"
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

Output should show:
```
▲ Next.js 14.0.0
- Local:        http://localhost:3000
```

### 3. Open in Browser
Navigate to: `http://localhost:3000`

### 4. Sign In (Demo)
- **Email**: Enter any email (e.g., `admin@example.com`)
- **Password**: Enter any password (e.g., `password123`)
- **Role**: Choose User or Admin
- **Click**: Sign In

You're now in the dashboard! 🎉

---

## 🎯 Explore Features

### Command Center
- Type a natural language query in the search bar
- Watch the AI "thinking" process
- View KPI cards with trends
- Click action buttons to generate reports

### Comparison View
- Select two countries
- Choose metrics to compare
- Watch interactive charts update
- Compare trends, radar views, and detailed metrics

### Report Generation
- Click "Generate Visual Insight" button
- Select report type
- Watch AI generate content
- Download as PDF or PowerPoint

### Multimedia Viewer
- View AI-generated videos
- Watch strategic achievement summaries
- Download or share content

### Theme Toggle
- Click sun/moon icon in top-right
- Switch between dark and light modes

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Sign-in page |
| `src/app/dashboard/page.tsx` | Dashboard page |
| `src/components/dashboard/` | Dashboard UI |
| `src/components/ui/` | Base components |
| `package.json` | Dependencies |
| `tailwind.config.js` | Styling config |

---

## 🔧 Development Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Start production
npm run start

# Linting
npm run lint

# Clean build
rm -rf .next && npm run build
```

---

## 🐛 Troubleshooting

### Port 3000 Already in Use
```bash
# Use different port
npm run dev -- -p 3001
```

### Styling Not Loading
```bash
# Clear cache
rm -rf .next
npm run dev
```

### Components Missing
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 📋 What to Test

- [ ] Sign in with different roles
- [ ] Search with natural language
- [ ] Toggle theme (dark/light)
- [ ] Change countries in comparison
- [ ] Toggle metrics on/off
- [ ] Generate report and download
- [ ] View multimedia content
- [ ] Logout and return to sign-in

---

## 🎨 Customization Tips

### Change Colors
Edit `src/app/globals.css` CSS variables:
```css
--primary: hsl(var(--primary));
--accent: hsl(var(--accent));
```

### Add New Pages
Create file in `src/app/` following Next.js convention:
```bash
src/app/new-page/page.tsx
```

### Modify Components
Edit files in `src/components/`:
- Dashboard components: `dashboard/`
- UI components: `ui/`
- Auth components: `auth/`
- AI components: `ai/`

---

## 📞 Common Questions

**Q: How do I change the company name?**
A: Search for "MOE Strategist" and "MOE" throughout the codebase

**Q: How do I connect to a real API?**
A: Update functions in `src/lib/auth.ts` and create `src/lib/api.ts`

**Q: How do I persist data to a database?**
A: Create backend API endpoints and update component state handlers

**Q: How do I deploy this?**
A: See README.md for deployment options (Vercel, Docker, etc.)

---

## 🚀 Next Steps

1. **Explore the Code**: Check out component structure
2. **Customize Colors**: Update `globals.css` variables
3. **Connect API**: Replace mock data with real endpoints
4. **Add Authentication**: Implement JWT/OAuth
5. **Deploy**: Host on Vercel, AWS, or Docker

---

## 📚 Additional Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Shadcn/ui](https://ui.shadcn.com)
- [Recharts](https://recharts.org)

---

**Happy Coding! 💻**
