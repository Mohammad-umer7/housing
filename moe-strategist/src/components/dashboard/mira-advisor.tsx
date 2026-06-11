'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Brain, Globe, Lightbulb, FileText, Search, BarChart3, TrendingUp, Send, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'alert' | 'urgent' | 'standard' | 'research'
type Language = 'en' | 'ar'
type Capability = 'profile' | 'insights' | 'briefing' | 'search' | 'predict' | 'comparison'
type AppStatus = 'idle' | 'thinking' | 'result'

type SectionType =
  | 'page-title'
  | 'section-header'
  | 'text'
  | 'bullet-list'
  | 'kv-grid'
  | 'opportunity'
  | 'forecast'
  | 'sensitivity'
  | 'bottom-line'
  | 'talking-point'
  | 'metric-row'
  | 'divider'

interface Section {
  type: SectionType
  content: string | string[] | Record<string, string>
  rtl?: boolean
}

interface CountryData {
  name: string
  nameAr: string
  flag: string
  gdp: string
  gdpGrowth: string
  rating: string
  energyMin: string
  primaryEnergy: string
  netZero: string
  tradeUAE: string
  keyFacts: string[]
  opportunities: string[]
  risks: string[]
}

// ─── Country Registry ─────────────────────────────────────────────────────────

const COUNTRIES: Record<string, CountryData> = {
  norway: {
    name: 'Norway', nameAr: 'النرويج', flag: '🇳🇴',
    gdp: '$419B', gdpGrowth: '+1.9%', rating: 'AAA',
    energyMin: 'Terje Aasland', primaryEnergy: '88% Hydro',
    netZero: '2050', tradeUAE: '$3.1B',
    keyFacts: ['World\'s largest sovereign wealth fund ($1.6T)', 'Nearly 100% renewable electricity', 'Major oil exporter despite green leadership', 'NEOM investor & hydrogen partner'],
    opportunities: ['Green hydrogen joint ventures', 'SWF co-investment in UAE infrastructure', 'Offshore wind technology transfer', 'Carbon capture expertise'],
    risks: ['Geopolitical neutrality limits deep partnerships', 'Domestic political pressure on fossil fuel exports'],
  },
  germany: {
    name: 'Germany', nameAr: 'ألمانيا', flag: '🇩🇪',
    gdp: '$4.1T', gdpGrowth: '+0.2%', rating: 'AAA',
    energyMin: 'Robert Habeck', primaryEnergy: '59% Renewables',
    netZero: '2045', tradeUAE: '$11.2B',
    keyFacts: ['Largest EU economy, industrial powerhouse', 'Aggressive Energiewende policy', 'Largest Middle East trade partner in EU', 'Siemens Energy & Volkswagen active in UAE'],
    opportunities: ['Green hydrogen supply agreements (NEOM → Hamburg)', 'Smart grid technology exports', 'Industrial efficiency partnerships', 'Hannover Messe bilateral pavilion'],
    risks: ['Political instability (coalition fragility)', 'Energy price sensitivity post-Russia crisis'],
  },
  'saudi arabia': {
    name: 'Saudi Arabia', nameAr: 'المملكة العربية السعودية', flag: '🇸🇦',
    gdp: '$1.07T', gdpGrowth: '+0.8%', rating: 'A1/A+',
    energyMin: 'Prince Abdulaziz bin Salman', primaryEnergy: '62% Oil',
    netZero: '2060', tradeUAE: '$28.5B',
    keyFacts: ['GCC strategic partner & neighbour', 'NEOM $500B mega-project', 'Aramco world\'s most valuable company', 'Vision 2030 overlaps with UAE Centennial 2071'],
    opportunities: ['Gulf electricity interconnection grid', 'ADNOC–Aramco joint upstream ventures', 'PIF–Mubadala co-investment platform', 'Bilateral clean energy research institute'],
    risks: ['Competitive tensions in FDI attraction', 'OPEC+ quota disagreements', 'Youth unemployment divergence pressures'],
  },
  china: {
    name: 'China', nameAr: 'الصين', flag: '🇨🇳',
    gdp: '$17.7T', gdpGrowth: '+5.2%', rating: 'A1/A+',
    energyMin: 'Zhang Jianhua (NEA)', primaryEnergy: '57% Coal / 31% Renewables',
    netZero: '2060', tradeUAE: '$95.6B',
    keyFacts: ['UAE\'s #1 trade partner', 'Largest solar panel manufacturer globally', 'Belt & Road presence in UAE logistics', 'CNOOC & Sinopec active in UAE upstream'],
    opportunities: ['Jebel Ali free zone expansion with Chinese firms', 'Solar manufacturing JV in UAE', 'Digital Silk Road data infrastructure', 'EV battery supply chain access'],
    risks: ['US pressure on UAE to limit Chinese tech access', 'Currency swap volatility', 'IP protection concerns in joint ventures'],
  },
  india: {
    name: 'India', nameAr: 'الهند', flag: '🇮🇳',
    gdp: '$3.5T', gdpGrowth: '+7.2%', rating: 'Baa3/BBB-',
    energyMin: 'R.K. Singh', primaryEnergy: '49% Coal / 19% Renewables',
    netZero: '2070', tradeUAE: '$84.8B',
    keyFacts: ['3.5M Indian expats in UAE (largest diaspora)', 'CEPA signed 2022 — fastest growing trade corridor', 'World\'s fastest growing major economy', 'National Green Hydrogen Mission launched'],
    opportunities: ['Green hydrogen import corridor (India → UAE → Europe)', 'Renewable energy equipment manufacturing', 'Fintech & digital payments integration (UPI↔ AED)', 'Food security partnerships (UAE investment in Indian agri)'],
    risks: ['Diplomatic balancing act (Russia, US, China)', 'Infrastructure bottlenecks limit delivery speed', 'Regulatory unpredictability in key sectors'],
  },
  japan: {
    name: 'Japan', nameAr: 'اليابان', flag: '🇯🇵',
    gdp: '$4.2T', gdpGrowth: '+1.9%', rating: 'A1/A+',
    energyMin: 'Yasutoshi Nishimura', primaryEnergy: '36% Gas',
    netZero: '2050', tradeUAE: '$22.8B',
    keyFacts: ['Barakah Nuclear Plant built by KEPCO (Korean, not Japanese)', 'Major LNG buyer from UAE', 'Toyota, Sony, Mitsubishi all active in UAE', 'G7 hydrogen society roadmap aligns with UAE'],
    opportunities: ['Ammonia co-firing technology for UAE power plants', 'Advanced nuclear SMR collaboration', 'Robotic & AI manufacturing partnerships', 'Pension fund infrastructure co-investment'],
    risks: ['Demographic decline limits long-term partnership depth', 'Post-Fukushima nuclear sensitivity', 'Yen weakness reduces investment capacity'],
  },
  usa: {
    name: 'United States', nameAr: 'الولايات المتحدة الأمريكية', flag: '🇺🇸',
    gdp: '$27.4T', gdpGrowth: '+2.5%', rating: 'Aaa/AA+',
    energyMin: 'Jennifer Granholm (DOE)', primaryEnergy: '22% Renewables',
    netZero: '2050', tradeUAE: '$32.1B',
    keyFacts: ['UAE hosts largest US military base in Middle East (Al Dhafra)', 'Abraham Accords strategic partner', 'IRA $369B clean energy incentives', 'Major F-35 & defence procurement discussions ongoing'],
    opportunities: ['AI & nuclear technology transfer under US-UAE Framework', 'LNG supply diversification (US → UAE storage/re-export)', 'VC co-investment in climate tech startups', 'Cybersecurity infrastructure partnership'],
    risks: ['Technology export controls (semiconductors, AI chips)', 'Geopolitical pressure on UAE-China ties', 'Policy reversal risk with administration changes'],
  },
  uk: {
    name: 'United Kingdom', nameAr: 'المملكة المتحدة', flag: '🇬🇧',
    gdp: '$3.1T', gdpGrowth: '+0.1%', rating: 'Aa3/AA',
    energyMin: 'Claire Coutinho', primaryEnergy: '29% Wind',
    netZero: '2050', tradeUAE: '$6.2B',
    keyFacts: ['COP26/28 host legacy — UAE shares clean energy narrative', 'ADNOC has major North Sea assets', 'London financial hub for UAE sovereign funds', 'Strong defence & security relationship'],
    opportunities: ['Offshore wind technology export to UAE', 'City of London green sukuk listings', 'UK-UAE FTA negotiations (post-Brexit)', 'Nuclear SMR (Rolls-Royce) collaboration'],
    risks: ['Post-Brexit regulatory uncertainty', 'Economic stagnation limits ambition', 'Political instability (4 PMs in 2 years)'],
  },
  france: {
    name: 'France', nameAr: 'فرنسا', flag: '🇫🇷',
    gdp: '$2.9T', gdpGrowth: '+0.9%', rating: 'Aa2/AA-',
    energyMin: 'Agnès Pannier-Runacher', primaryEnergy: '69% Nuclear',
    netZero: '2050', tradeUAE: '$8.4B',
    keyFacts: ['Louvre Abu Dhabi — cultural soft power anchor', 'EDF nuclear expertise — Barakah unit 4 consulting', 'Major Rafale fighter jet sales to UAE', 'Macron personal relationship with UAE leadership'],
    opportunities: ['Nuclear fleet expansion consultation (post-Barakah 4)', 'Luxury & cultural tourism development', 'Airbus aviation & hydrogen aircraft', 'Total Energies UAE offshore expansion'],
    risks: ['Nuclear technology export regulatory complexity', 'Domestic pension reform instability', 'EU taxonomy uncertainty on nuclear'],
  },
  'south korea': {
    name: 'South Korea', nameAr: 'كوريا الجنوبية', flag: '🇰🇷',
    gdp: '$1.7T', gdpGrowth: '+1.4%', rating: 'Aa2/AA',
    energyMin: 'Bang Moon-kyu (MOTIE)', primaryEnergy: '30% Nuclear',
    netZero: '2050', tradeUAE: '$14.8B',
    keyFacts: ['KEPCO built all 4 Barakah units — deepest nuclear partnership', 'Samsung, Hyundai, LG all major UAE contractors', 'K-Hydrogen roadmap aligns with UAE strategy', 'POSCO steel for UAE infrastructure projects'],
    opportunities: ['Barakah units 5-8 expansion (pre-qualified partner)', 'Battery storage gigafactory in UAE', 'Smart city technology (K-City → UAE municipalities)', 'Petrochemical downstream JV'],
    risks: ['Geopolitical exposure (North Korea, China tensions)', 'Samsung/LG competition with Chinese alternatives', 'Labour cost escalation on large projects'],
  },
}

// ─── Thinking Terminal Lines ──────────────────────────────────────────────────

function getThinkingLines(country: string, capability: Capability, query: string, lang: Language): string[] {
  const cap = {
    profile: 'COUNTRY INTELLIGENCE PROFILE',
    insights: 'STRATEGIC INSIGHTS ENGINE',
    briefing: 'EXECUTIVE BRIEFING GENERATOR',
    search: 'AI SEARCH & CONVERSATION',
    predict: 'PREDICTIVE INTELLIGENCE',
    comparison: 'COUNTRY COMPARISON ENGINE',
  }[capability]

  const countryData = Object.values(COUNTRIES).find(c => c.name.toLowerCase() === country.toLowerCase() || c.nameAr === country)
  const cName = countryData ? `${countryData.name} ${countryData.flag}` : country

  return [
    '> Accessing MIRA Intelligence Engine v3.1...',
    `> Parsing query: "${query.substring(0, 40)}${query.length > 40 ? '...' : ''}"`,
    `> Identified country: ${cName}`,
    `> Capability selected: ${cap}`,
    `> Phase protocol: ${lang === 'ar' ? 'وضع' : ''} ACTIVE MODE`,
    '> Cross-referencing UAE strategic interests database...',
    '> Applying MOEI diplomatic sensitivity filters...',
    '> Running strategic value analysis...',
    `> Generating ${lang === 'ar' ? 'Arabic' : 'English'} intelligence product...`,
    '> Confidence threshold: PASSED ✓',
    '✓ Intelligence product ready — presenting results.',
  ]
}

// ─── Response Generators ──────────────────────────────────────────────────────

function genProfileSections(countryKey: string, lang: Language): Section[] {
  const country = COUNTRIES[countryKey.toLowerCase()]
  if (!country) return [{ type: 'text', content: `No data found for "${countryKey}". Try: norway, germany, saudi arabia, china, india, japan, usa, uk, france, south korea` }]

  const isAr = lang === 'ar'
  const sections: Section[] = [
    {
      type: 'page-title',
      content: isAr ? `ملف الاستخبارات الاستراتيجية — ${country.nameAr} ${country.flag}` : `Strategic Intelligence Profile — ${country.name} ${country.flag}`,
      rtl: isAr,
    },
    {
      type: 'section-header',
      content: isAr ? 'المؤشرات الاقتصادية الرئيسية' : 'KEY ECONOMIC INDICATORS',
    },
    {
      type: 'kv-grid',
      content: {
        [isAr ? 'الناتج المحلي الإجمالي' : 'GDP']: country.gdp,
        [isAr ? 'نمو الناتج المحلي' : 'GDP Growth']: country.gdpGrowth,
        [isAr ? 'التصنيف الائتماني' : 'Credit Rating']: country.rating,
        [isAr ? 'التجارة مع الإمارات' : 'UAE Trade Volume']: country.tradeUAE,
        [isAr ? 'مسار الحياد المناخي' : 'Net-Zero Target']: country.netZero,
        [isAr ? 'مصدر الطاقة الأساسي' : 'Primary Energy']: country.primaryEnergy,
      },
    },
    {
      type: 'section-header',
      content: isAr ? 'وزير الطاقة' : 'ENERGY MINISTER',
    },
    {
      type: 'text',
      content: country.energyMin,
    },
    {
      type: 'section-header',
      content: isAr ? 'الحقائق الاستراتيجية الرئيسية' : 'KEY STRATEGIC FACTS',
    },
    {
      type: 'bullet-list',
      content: country.keyFacts,
      rtl: isAr,
    },
    {
      type: 'section-header',
      content: isAr ? 'الفرص الاستراتيجية للإمارات' : 'UAE STRATEGIC OPPORTUNITIES',
    },
    {
      type: 'bullet-list',
      content: country.opportunities,
      rtl: isAr,
    },
    {
      type: 'section-header',
      content: isAr ? 'عوامل المخاطر' : 'RISK FACTORS',
    },
    {
      type: 'bullet-list',
      content: country.risks,
      rtl: isAr,
    },
    {
      type: 'divider',
      content: '',
    },
    {
      type: 'bottom-line',
      content: isAr
        ? `الخلاصة: ${country.nameAr} شريك استراتيجي محوري في مسيرة الإمارات نحو ريادة الطاقة النظيفة.`
        : `BOTTOM LINE: ${country.name} is a high-value strategic partner in UAE's clean energy leadership agenda.`,
      rtl: isAr,
    },
  ]
  return sections
}

function genInsightsSections(countryKey: string, lang: Language): Section[] {
  const country = COUNTRIES[countryKey.toLowerCase()]
  if (!country) return [{ type: 'text', content: `No data found for "${countryKey}".` }]

  const isAr = lang === 'ar'
  const sections: Section[] = [
    {
      type: 'page-title',
      content: isAr ? `محرك الرؤى الاستراتيجية — ${country.nameAr} ${country.flag}` : `Strategic Insights Engine — ${country.name} ${country.flag}`,
      rtl: isAr,
    },
  ]

  country.opportunities.forEach((opp, i) => {
    sections.push({
      type: 'opportunity',
      content: {
        'OPPORTUNITY': opp,
        'VALUE TO UAE': `Direct strategic and economic benefit in ${country.name} corridor`,
        'TIMELINE': i === 0 ? 'Immediate (0–6 months)' : i === 1 ? 'Short-term (6–18 months)' : 'Medium-term (18–36 months)',
        'RISK LEVEL': i === country.opportunities.length - 1 ? 'High — requires political alignment' : 'Medium — manageable with proper structuring',
        'LEAD UAE ENTITY': i === 0 ? 'ADNOC / Mubadala' : i === 1 ? 'Ministry of Energy & Infrastructure' : 'ADQ / Abu Dhabi Investment Authority',
        'RECOMMENDED FIRST ACTION': `Commission feasibility study and appoint bilateral working group for ${opp.toLowerCase()}`,
      },
    })
    if (i < country.opportunities.length - 1) {
      sections.push({ type: 'divider', content: '' })
    }
  })

  sections.push({
    type: 'bottom-line',
    content: isAr
      ? `الفرص المتاحة مع ${country.nameAr} تستوجب تحركاً استراتيجياً فورياً.`
      : `BOTTOM LINE: Act now — ${country.name} window is open and competitive.`,
    rtl: isAr,
  })
  return sections
}

function genBriefingSections(countryKey: string, phase: Phase, lang: Language): Section[] {
  const country = COUNTRIES[countryKey.toLowerCase()]
  if (!country) return [{ type: 'text', content: `No data found for "${countryKey}".` }]

  const isAr = lang === 'ar'

  if (isAr && countryKey.toLowerCase() === 'saudi arabia') {
    return [
      {
        type: 'page-title',
        content: `نقاط الحوار الاستراتيجية\n${country.nameAr} — الإمارات العربية المتحدة ${country.flag}`,
        rtl: true,
      },
      {
        type: 'section-header',
        content: 'المحور الأول: بناء الثقة والشراكة',
        rtl: true,
      },
      {
        type: 'talking-point',
        content: {
          number: '١',
          text: 'تجمعنا شراكة استراتيجية راسخة في إطار منظومة دول الخليج العربي — وأي تقدم في منظومة الطاقة الإقليمية يُعزز أمن الطاقة لكلا البلدين.',
        },
        rtl: true,
      },
      {
        type: 'talking-point',
        content: {
          number: '٢',
          text: 'نتقاسم مسيرة تاريخية من التعاون الاقتصادي والأمني — وإطار العمل المشترك بيننا هو الأنضج على مستوى المنطقة.',
        },
        rtl: true,
      },
      {
        type: 'section-header',
        content: 'المحور الثاني: الأجندة الطاقية والاستثمارية',
        rtl: true,
      },
      {
        type: 'talking-point',
        content: {
          number: '٣',
          text: 'يُشكّل مشروع الربط الكهربائي الخليجي المشترك منصةً استراتيجية — نقترح تسريع الجدول الزمني لاستكمال المراحل المتبقية خلال ٣٦ شهراً.',
        },
        rtl: true,
      },
      {
        type: 'talking-point',
        content: {
          number: '٤',
          text: 'تُتيح الشراكة بين أدنوك وأرامكو فرصاً واعدة في مجالات التكرير المشترك والبتروكيماويات — نرحب بتوسيع نطاق التعاون إلى قطاعات اللوجستيات والطاقة المتجددة.',
        },
        rtl: true,
      },
      {
        type: 'talking-point',
        content: {
          number: '٥',
          text: 'نرحب بتوسيع التعاون بين صندوق الاستثمارات العامة ومبادلة — بما يشمل الاستثمارات المشتركة في البنية التحتية الرقمية والطاقة النظيفة.',
        },
        rtl: true,
      },
      {
        type: 'section-header',
        content: 'المحور الثالث: المطالب الاستراتيجية',
        rtl: true,
      },
      {
        type: 'talking-point',
        content: {
          number: '٦',
          text: 'نقترح تفعيل الإطار التنظيمي المشترك للمشاريع العابرة للحدود — بما يُيسّر تبادل الطاقة الكهربائية والهيدروجين الأخضر عبر الشبكة الخليجية الموحدة.',
        },
        rtl: true,
      },
      {
        type: 'talking-point',
        content: {
          number: '٧',
          text: 'نُوصي بإنشاء لجنة طاقة سعودية-إماراتية دائمة تجتمع كل ربع سنة — لمتابعة تنفيذ الاتفاقيات وتحديد المبادرات الجديدة بشكل استباقي.',
        },
        rtl: true,
      },
      {
        type: 'divider',
        content: '',
      },
      {
        type: 'bottom-line',
        content: 'الخلاصة: التكامل الطاقي السعودي-الإماراتي فرصة تاريخية — لا ينبغي إضاعتها.',
        rtl: true,
      },
    ]
  }

  const phaseNote =
    phase === 'alert' ? 'ALERT MODE — Talking points only. Meeting in under 30 minutes.' :
    phase === 'urgent' ? 'URGENT — Summary + key points. Meeting today.' :
    phase === 'standard' ? 'STANDARD — Full executive briefing.' :
    'RESEARCH — Deep strategic analysis.'

  const sections: Section[] = [
    {
      type: 'page-title',
      content: isAr
        ? `الإحاطة التنفيذية — ${country.nameAr} ${country.flag}`
        : `Executive Briefing — ${country.name} ${country.flag}`,
      rtl: isAr,
    },
    {
      type: 'metric-row',
      content: {
        label: isAr ? 'مستوى الإحاطة' : 'Briefing Level',
        value: phaseNote,
      },
    },
    {
      type: 'section-header',
      content: isAr ? 'الملخص التنفيذي' : 'EXECUTIVE SUMMARY',
    },
    {
      type: 'text',
      content: isAr
        ? `تمثل ${country.nameAr} شريكاً استراتيجياً رئيسياً للإمارات في مجال الطاقة والاستثمار، مع ناتج محلي يبلغ ${country.gdp} ونمو ${country.gdpGrowth}. التعاون الثنائي يصل إلى ${country.tradeUAE} ويرتكز على رؤية مشتركة نحو هدف الحياد المناخي ${country.netZero}.`
        : `${country.name} represents a key strategic partner for UAE in energy and investment, with GDP of ${country.gdp} growing at ${country.gdpGrowth}. Bilateral trade stands at ${country.tradeUAE}, anchored by a shared pathway toward net-zero by ${country.netZero}.`,
      rtl: isAr,
    },
    {
      type: 'section-header',
      content: isAr ? 'نقاط الحوار الرئيسية' : 'KEY TALKING POINTS',
    },
  ]

  const talkingPoints = isAr ? [
    `الإمارات تقدر الشراكة الاستراتيجية مع ${country.nameAr} وتسعى إلى تعميقها`,
    `التجارة البينية بلغت ${country.tradeUAE} — نستهدف مضاعفتها خلال الخمس سنوات القادمة`,
    `نتقاسم رؤية مشتركة للتحول الطاقوي ومستهدفات الحياد المناخي`,
    `الطاقة المتجددة والهيدروجين الأخضر يمثلان ركيزتين أساسيتين للشراكة المستقبلية`,
    `ندعو إلى إنشاء لجنة عمل مشتركة لمتابعة الفرص الاستثمارية`,
  ] : [
    `UAE values the strategic partnership with ${country.name} and seeks to deepen it`,
    `Bilateral trade at ${country.tradeUAE} — we target doubling this within 5 years`,
    `Shared vision on energy transition and net-zero targets by ${country.netZero}`,
    `Green hydrogen and renewable energy are the pillars of our future partnership`,
    `Propose establishing a joint working committee to accelerate investment opportunities`,
  ]

  sections.push({
    type: 'bullet-list',
    content: talkingPoints,
    rtl: isAr,
  })

  if (phase === 'standard' || phase === 'research') {
    sections.push(
      {
        type: 'section-header',
        content: isAr ? 'الحساسيات الدبلوماسية' : 'DIPLOMATIC SENSITIVITIES',
      },
      {
        type: 'sensitivity',
        content: {
          [isAr ? 'تجنب ذكر' : 'AVOID']: country.risks[0],
          [isAr ? 'التزم الحياد حول' : 'NEUTRAL ON']: country.risks[1] || 'Regional geopolitical alignments',
          [isAr ? 'أكد موقفك من' : 'AFFIRM']: `UAE-${country.name} bilateral framework commitment`,
        },
        rtl: isAr,
      }
    )
  }

  sections.push(
    { type: 'divider', content: '' },
    {
      type: 'bottom-line',
      content: isAr
        ? `الخلاصة: الشراكة مع ${country.nameAr} فرصة استراتيجية — استثمرها بحكمة.`
        : `BOTTOM LINE: ${country.name} partnership is strategic gold — invest wisely.`,
      rtl: isAr,
    }
  )

  return sections
}

function genPredictSections(countryKey: string, lang: Language): Section[] {
  const country = COUNTRIES[countryKey.toLowerCase()]
  if (!country) return [{ type: 'text', content: `No data found for "${countryKey}".` }]

  const isAr = lang === 'ar'
  const forecasts = [
    {
      prediction: `${country.name} will accelerate bilateral energy investment by 35%+ over 24 months`,
      confidence: '78%',
      basis: `Current trade trajectory of ${country.tradeUAE}, favourable political signals, shared net-zero commitments`,
      timeline: '18–24 months',
      implication: 'UAE should pre-position ADNOC and Mubadala deal structures now',
      response: 'Commission bilateral investment framework within 90 days',
    },
    {
      prediction: `Political transition risk in ${country.name} may delay major agreements by 6–12 months`,
      confidence: '62%',
      basis: `${country.risks[0]}. Historical precedent from similar transitions`,
      timeline: '6–18 months',
      implication: 'Build redundant political channels at ministerial and deputy ministerial levels',
      response: 'Diversify engagement beyond energy ministry to finance and trade ministries',
    },
    {
      prediction: `New clean energy corridor with ${country.name} viable by 2027`,
      confidence: '71%',
      basis: `${country.primaryEnergy} base + UAE IRENA leadership + bilateral trade momentum`,
      timeline: '24–36 months',
      implication: 'First mover advantage — competitor nations are advancing similar frameworks',
      response: 'Fast-track UAE-${country.name} Green Energy MOU by Q2 next year',
    },
  ]

  const sections: Section[] = [
    {
      type: 'page-title',
      content: isAr
        ? `الاستخبارات التنبؤية — ${country.nameAr} ${country.flag}`
        : `Predictive Intelligence — ${country.name} ${country.flag}`,
      rtl: isAr,
    },
  ]

  forecasts.forEach((f, i) => {
    sections.push({
      type: 'forecast',
      content: {
        'PREDICTION': f.prediction,
        'CONFIDENCE': f.confidence,
        'BASIS': f.basis,
        'TIMELINE': f.timeline,
        'UAE IMPLICATION': f.implication,
        'RESPONSE': f.response,
      },
    })
    if (i < forecasts.length - 1) sections.push({ type: 'divider', content: '' })
  })

  sections.push(
    { type: 'divider', content: '' },
    {
      type: 'bottom-line',
      content: isAr
        ? `التوقعات تُشير إلى نافذة فرص مفتوحة — التحرك الآن يُقرر نتائج ${country.nameAr}.`
        : `BOTTOM LINE: Window is open. Move in 90 days or lose first-mover advantage.`,
      rtl: isAr,
    }
  )
  return sections
}

function genSearchSections(query: string, countryKey: string, lang: Language): Section[] {
  const country = COUNTRIES[countryKey.toLowerCase()]
  const isAr = lang === 'ar'

  const sections: Section[] = [
    {
      type: 'page-title',
      content: isAr
        ? `نتائج البحث الاستراتيجي — "${query}"`
        : `AI Strategic Search Results — "${query}"`,
      rtl: isAr,
    },
    {
      type: 'text',
      content: isAr
        ? `استناداً إلى قاعدة بيانات وزارة الطاقة والبنية التحتية الإماراتية، إليك أبرز النتائج المتعلقة بـ "${query}":${country ? ` في سياق العلاقات مع ${country.nameAr}.` : ''}`
        : `Based on UAE Ministry of Energy & Infrastructure strategic database, here are key findings for "${query}"${country ? ` in the context of relations with ${country.name}` : ''}:`,
      rtl: isAr,
    },
  ]

  if (country) {
    sections.push(
      {
        type: 'section-header',
        content: isAr ? 'النتائج الرئيسية' : 'KEY FINDINGS',
      },
      {
        type: 'bullet-list',
        content: [...country.keyFacts, ...country.opportunities.slice(0, 2)],
        rtl: isAr,
      },
      {
        type: 'section-header',
        content: isAr ? 'توصية MIRA' : 'MIRA RECOMMENDATION',
      },
      {
        type: 'text',
        content: isAr
          ? `بناءً على تحليل MIRA، يُنصح بالتركيز على ${country.opportunities[0]} كأولوية استراتيجية فورية مع ${country.nameAr}.`
          : `Based on MIRA analysis, prioritise ${country.opportunities[0]} as the immediate strategic focus with ${country.name}.`,
        rtl: isAr,
      }
    )
  } else {
    sections.push({
      type: 'bullet-list',
      content: isAr ? [
        'توسيع شراكات الطاقة المتجددة عبر الممرات الإقليمية',
        'تسريع مبادرات الهيدروجين الأخضر مع الشركاء الاستراتيجيين',
        'تعزيز الاستثمارات المشتركة في قطاع التحول الطاقوي',
      ] : [
        'Expand renewable energy partnerships across regional corridors',
        'Accelerate green hydrogen initiatives with strategic partners',
        'Strengthen joint investments in energy transition sector',
      ],
      rtl: isAr,
    })
  }

  sections.push(
    { type: 'divider', content: '' },
    {
      type: 'bottom-line',
      content: isAr
        ? 'الخلاصة: البيانات تدعم اتخاذ إجراءات استراتيجية فورية.'
        : 'BOTTOM LINE: Data supports immediate strategic action.',
      rtl: isAr,
    }
  )
  return sections
}

function genComparisonSections(country1Key: string, country2Key: string, lang: Language): Section[] {
  const c1 = COUNTRIES[country1Key.toLowerCase()]
  const c2 = COUNTRIES[country2Key.toLowerCase()]
  const isAr = lang === 'ar'

  if (!c1 || !c2) {
    return [{
      type: 'text',
      content: `Please specify two valid countries. Available: ${Object.keys(COUNTRIES).join(', ')}`,
    }]
  }

  return [
    {
      type: 'page-title',
      content: isAr
        ? `محرك المقارنة الاستراتيجية — ${c1.nameAr} ${c1.flag} مقابل ${c2.nameAr} ${c2.flag}`
        : `Country Comparison Engine — ${c1.name} ${c1.flag} vs ${c2.name} ${c2.flag}`,
      rtl: isAr,
    },
    {
      type: 'section-header',
      content: isAr ? 'مقارنة المؤشرات الاقتصادية' : 'ECONOMIC INDICATORS COMPARISON',
    },
    {
      type: 'kv-grid',
      content: {
        [isAr ? 'الناتج المحلي' : 'GDP']: `${c1.flag} ${c1.gdp} / ${c2.flag} ${c2.gdp}`,
        [isAr ? 'النمو الاقتصادي' : 'GDP Growth']: `${c1.flag} ${c1.gdpGrowth} / ${c2.flag} ${c2.gdpGrowth}`,
        [isAr ? 'التصنيف الائتماني' : 'Credit Rating']: `${c1.flag} ${c1.rating} / ${c2.flag} ${c2.rating}`,
        [isAr ? 'حجم التجارة مع الإمارات' : 'UAE Trade']: `${c1.flag} ${c1.tradeUAE} / ${c2.flag} ${c2.tradeUAE}`,
        [isAr ? 'الحياد المناخي' : 'Net-Zero']: `${c1.flag} ${c1.netZero} / ${c2.flag} ${c2.netZero}`,
        [isAr ? 'الطاقة الرئيسية' : 'Primary Energy']: `${c1.flag} ${c1.primaryEnergy} / ${c2.flag} ${c2.primaryEnergy}`,
      },
    },
    {
      type: 'section-header',
      content: isAr ? 'الأفضلية الاستراتيجية للإمارات' : 'UAE STRATEGIC PREFERENCE',
    },
    {
      type: 'text',
      content: isAr
        ? `من منظور الإمارات، يتميز كل بلد بمزايا مختلفة: ${c1.nameAr} يُقدم ${c1.opportunities[0].toLowerCase()}، بينما ${c2.nameAr} يُتيح ${c2.opportunities[0].toLowerCase()}. التوصية: المزج الاستراتيجي بين الشراكتين وفق الأهداف المرحلية.`
        : `From UAE's perspective, each country offers distinct advantages: ${c1.name} excels in ${c1.opportunities[0].toLowerCase()}, while ${c2.name} offers ${c2.opportunities[0].toLowerCase()}. Recommendation: pursue complementary bilateral tracks rather than choosing one.`,
      rtl: isAr,
    },
    { type: 'divider', content: '' },
    {
      type: 'bottom-line',
      content: isAr
        ? `الخلاصة: ${c1.nameAr} و${c2.nameAr} يكملان بعضهما — ادمج الشراكتين.`
        : `BOTTOM LINE: ${c1.name} and ${c2.name} are complementary — pursue both tracks.`,
      rtl: isAr,
    },
  ]
}

// ─── Section Renderer ─────────────────────────────────────────────────────────

function SectionRenderer({ section, index }: { section: Section; index: number }) {
  const delay = `${index * 120}ms`
  const style = { animationDelay: delay, animationFillMode: 'both' as const }
  const dir = section.rtl ? 'rtl' : 'ltr'

  switch (section.type) {
    case 'page-title':
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out]" dir={dir}>
          <h1 className={`text-xl font-bold text-[#4a3728] border-b-2 border-[#9b7a36] pb-3 mb-4 ${section.rtl ? 'text-right' : ''}`}>
            {String(section.content)}
          </h1>
        </div>
      )
    case 'section-header':
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out] mt-5 mb-2" dir={dir}>
          <h2 className={`text-xs font-bold tracking-widest text-[#9b7a36] uppercase ${section.rtl ? 'text-right' : ''}`}>
            {String(section.content)}
          </h2>
        </div>
      )
    case 'text':
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out]" dir={dir}>
          <p className={`text-sm text-[#4a3728] leading-relaxed ${section.rtl ? 'text-right' : ''}`}>
            {String(section.content)}
          </p>
        </div>
      )
    case 'bullet-list': {
      const items = Array.isArray(section.content) ? section.content : [String(section.content)]
      return (
        <ul style={style} className={`animate-[fadeSlide_0.4s_ease-out] space-y-1.5 ${section.rtl ? 'text-right' : ''}`} dir={dir}>
          {items.map((item, i) => (
            <li key={i} className={`flex items-start gap-2 text-sm text-[#4a3728] ${section.rtl ? 'flex-row-reverse' : ''}`}>
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#9b7a36] flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    }
    case 'kv-grid': {
      const entries = Object.entries(section.content as Record<string, string>)
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out] grid grid-cols-2 sm:grid-cols-3 gap-2" dir={dir}>
          {entries.map(([k, v]) => (
            <div key={k} className="bg-[#f6f0e1] border border-[#e8dcc8] rounded-lg p-3">
              <div className={`text-[10px] font-semibold text-[#9b7a36] uppercase tracking-wide mb-1 ${section.rtl ? 'text-right' : ''}`}>{k}</div>
              <div className={`text-sm font-bold text-[#4a3728] ${section.rtl ? 'text-right' : ''}`}>{v}</div>
            </div>
          ))}
        </div>
      )
    }
    case 'opportunity': {
      const entries = Object.entries(section.content as Record<string, string>)
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out] bg-gradient-to-br from-[#faf6ec] to-[#f6f0e1] border-l-4 border-[#9b7a36] rounded-lg p-4 space-y-2">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="font-bold text-[#9b7a36] uppercase tracking-wide min-w-[140px] flex-shrink-0">{k}:</span>
              <span className="text-[#4a3728]">{v}</span>
            </div>
          ))}
        </div>
      )
    }
    case 'forecast': {
      const entries = Object.entries(section.content as Record<string, string>)
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out] bg-[#1a1208] border border-[#9b7a36]/40 rounded-lg p-4 space-y-2">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm font-mono">
              <span className="text-[#c2a14e] uppercase min-w-[140px] flex-shrink-0">{k}:</span>
              <span className="text-[#d4c4a0]">{v}</span>
            </div>
          ))}
        </div>
      )
    }
    case 'sensitivity': {
      const entries = Object.entries(section.content as Record<string, string>)
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out] bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2" dir={dir}>
          {entries.map(([k, v]) => (
            <div key={k} className={`flex gap-2 text-sm ${section.rtl ? 'flex-row-reverse text-right' : ''}`}>
              <span className="font-bold text-amber-700 uppercase tracking-wide min-w-[120px] flex-shrink-0">{k}:</span>
              <span className="text-[#4a3728]">{v}</span>
            </div>
          ))}
        </div>
      )
    }
    case 'talking-point': {
      const tp = section.content as Record<string, string>
      return (
        <div style={style} className={`animate-[fadeSlide_0.4s_ease-out] flex gap-3 items-start py-2 ${section.rtl ? 'flex-row-reverse' : ''}`} dir={dir}>
          <span className="text-lg font-bold text-[#9b7a36] flex-shrink-0">{tp.number}</span>
          <p className={`text-sm text-[#4a3728] leading-relaxed ${section.rtl ? 'text-right' : ''}`}>{tp.text}</p>
        </div>
      )
    }
    case 'metric-row': {
      const mr = section.content as Record<string, string>
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out] flex items-center gap-3 bg-[#f6f0e1] border border-[#e8dcc8] rounded-lg px-4 py-2.5">
          <span className="text-xs font-bold text-[#9b7a36] uppercase tracking-wide">{mr.label}</span>
          <span className="text-sm text-[#4a3728]">{mr.value}</span>
        </div>
      )
    }
    case 'divider':
      return <hr style={style} className="animate-[fadeSlide_0.4s_ease-out] border-[#e8dcc8] my-4" />
    case 'bottom-line':
      return (
        <div style={style} className="animate-[fadeSlide_0.4s_ease-out] bg-[#9b7a36] text-white rounded-lg px-5 py-3 mt-2" dir={dir}>
          <p className={`text-sm font-bold ${section.rtl ? 'text-right' : ''}`}>{String(section.content)}</p>
        </div>
      )
    default:
      return null
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MiraAdvisor() {
  const [phase, setPhase] = useState<Phase>('standard')
  const [lang, setLang] = useState<Language>('en')
  const [capability, setCapability] = useState<Capability>('profile')
  const [status, setStatus] = useState<AppStatus>('idle')
  const [country, setCountry] = useState('')
  const [country2, setCountry2] = useState('')
  const [query, setQuery] = useState('')
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [terminalDone, setTerminalDone] = useState(false)
  const [resultSections, setResultSections] = useState<Section[]>([])
  const [phaseOpen, setPhaseOpen] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  const CAPABILITIES: { id: Capability; label: string; labelAr: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Country Profile', labelAr: 'ملف الدولة', icon: <Globe className="w-4 h-4" /> },
    { id: 'insights', label: 'Strategic Insights', labelAr: 'الرؤى الاستراتيجية', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'briefing', label: 'Executive Briefing', labelAr: 'الإحاطة التنفيذية', icon: <FileText className="w-4 h-4" /> },
    { id: 'search', label: 'AI Search', labelAr: 'البحث الذكي', icon: <Search className="w-4 h-4" /> },
    { id: 'comparison', label: 'Country Comparison', labelAr: 'مقارنة الدول', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'predict', label: 'Predictive Intel', labelAr: 'الاستخبارات التنبؤية', icon: <TrendingUp className="w-4 h-4" /> },
  ]

  const PHASES: { id: Phase; label: string; color: string }[] = [
    { id: 'alert', label: '⚡ ALERT (<30 min)', color: 'text-red-600' },
    { id: 'urgent', label: '🔴 URGENT (Today)', color: 'text-orange-500' },
    { id: 'standard', label: '📋 STANDARD (Tomorrow)', color: 'text-[#9b7a36]' },
    { id: 'research', label: '🔬 RESEARCH (Strategy)', color: 'text-blue-600' },
  ]

  const QUICK_COMMANDS = [
    { label: lang === 'ar' ? 'ملف النرويج' : 'Norway profile', action: () => { setCountry('norway'); setCapability('profile') } },
    { label: lang === 'ar' ? 'الألمانيا مقارنة' : 'Germany vs India', action: () => { setCountry('germany'); setCountry2('india'); setCapability('comparison') } },
    { label: lang === 'ar' ? 'إحاطة السعودية' : 'Saudi briefing', action: () => { setCountry('saudi arabia'); setCapability('briefing') } },
    { label: lang === 'ar' ? 'توقعات الصين' : 'China predict', action: () => { setCountry('china'); setCapability('predict') } },
  ]

  const resolveCountryKey = (input: string): string => {
    const lower = input.toLowerCase().trim()
    if (COUNTRIES[lower]) return lower
    const match = Object.keys(COUNTRIES).find(k =>
      k.includes(lower) || lower.includes(k) || COUNTRIES[k].nameAr === input
    )
    return match || lower
  }

  const handleSend = useCallback(async () => {
    const q    = query.trim() || capability
    const cKey = resolveCountryKey(country || 'uae')
    const c2Key = resolveCountryKey(country2 || 'india')

    setStatus('thinking')
    setTerminalLines([])
    setTerminalDone(false)
    setResultSections([])

    // ── Try real backend (SSE streaming) ─────────────────────────────────
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL
    if (backendUrl || (typeof window !== 'undefined' && window.location.port !== '')) {
      try {
        const res = await fetch('/api/intel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            capability,
            phase,
            language: lang,
            country_code: cKey,
            country_code_2: c2Key || null,
            query: q,
          }),
        })

        if (res.ok && res.body) {
          const reader  = res.body.getReader()
          const decoder = new TextDecoder()
          let   buffer  = ''
          const newSections: Section[] = []

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') { setTerminalDone(true); continue }

              try {
                const ev = JSON.parse(data) as {
                  event: string
                  message?: string
                  section?: Section
                  level?: string
                }

                if (ev.event === 'agent_log' && ev.message) {
                  setTerminalLines(prev => [...prev, ev.message!])
                } else if (ev.event === 'section' && ev.section) {
                  newSections.push(ev.section)
                  setResultSections([...newSections])
                } else if (ev.event === 'done') {
                  setTerminalDone(true)
                  setStatus('result')
                } else if (ev.event === 'error') {
                  setTerminalLines(prev => [...prev, `! ${ev.message ?? 'Error'}`])
                }
              } catch { /* skip malformed events */ }
            }
          }

          if (newSections.length > 0) {
            setStatus('result')
            return
          }
          // Fall through to local if backend returned nothing
        }
      } catch { /* backend unreachable — fall through to local */ }
    }

    // ── Local fallback (mock terminal + static generators) ───────────────
    const termLines = getThinkingLines(cKey, capability, q, lang)
    for (let i = 0; i < termLines.length; i++) {
      await new Promise(r => setTimeout(r, 280 + Math.random() * 120))
      setTerminalLines(prev => [...prev, termLines[i]])
    }

    setTerminalDone(true)
    await new Promise(r => setTimeout(r, 400))

    let sections: Section[] = []
    switch (capability) {
      case 'profile':    sections = genProfileSections(cKey, lang); break
      case 'insights':   sections = genInsightsSections(cKey, lang); break
      case 'briefing':   sections = genBriefingSections(cKey, phase, lang); break
      case 'search':     sections = genSearchSections(q, cKey, lang); break
      case 'predict':    sections = genPredictSections(cKey, lang); break
      case 'comparison': sections = genComparisonSections(cKey, c2Key, lang); break
    }

    setResultSections(sections)
    setStatus('result')
  }, [query, country, country2, capability, phase, lang])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend()
  }

  const currentPhase = PHASES.find(p => p.id === phase)!

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#faf6ec] overflow-hidden">

      {/* ── Dark MIRA Header ── */}
      <div className="bg-[#2a1e0e] border-b border-[#9b7a36]/40 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9b7a36] to-[#c2a14e] flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base tracking-wide">MIRA</div>
            <div className="text-[#a89060] text-[10px] tracking-wider">MINISTRY INTELLIGENCE & RESEARCH ADVISOR</div>
          </div>
          <div className="flex items-center gap-1.5 ml-3 bg-green-900/40 border border-green-500/30 rounded-full px-2.5 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[10px] font-mono tracking-wider">ONLINE</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Phase selector */}
          <div className="relative">
            <button
              onClick={() => setPhaseOpen(o => !o)}
              className="flex items-center gap-2 bg-[#1a1208] border border-[#9b7a36]/40 rounded-lg px-3 py-1.5 text-xs text-[#c2a14e] hover:border-[#9b7a36] transition-colors"
            >
              <span>{currentPhase.label}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {phaseOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#1a1208] border border-[#9b7a36]/40 rounded-lg overflow-hidden z-50 min-w-[200px]">
                {PHASES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPhase(p.id); setPhaseOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-xs hover:bg-[#2a1e0e] transition-colors ${p.id === phase ? 'bg-[#2a1e0e]' : ''} ${p.color}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language toggle */}
          <button
            onClick={() => setLang(l => l === 'en' ? 'ar' : 'en')}
            className="bg-[#1a1208] border border-[#9b7a36]/40 rounded-lg px-3 py-1.5 text-xs text-[#c2a14e] hover:border-[#9b7a36] transition-colors font-mono"
          >
            {lang === 'en' ? 'عربي' : 'EN'}
          </button>
        </div>
      </div>

      {/* ── Body (sidebar + main) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar ── */}
        <div className="w-[220px] flex-shrink-0 bg-[#f6f0e1] border-r border-[#e8dcc8] flex flex-col overflow-y-auto">
          <div className="p-3">
            <div className="text-[10px] font-bold text-[#9b7a36] uppercase tracking-widest mb-2 px-1">
              {lang === 'ar' ? 'القدرات' : 'Capabilities'}
            </div>
            <div className="space-y-1">
              {CAPABILITIES.map(cap => (
                <button
                  key={cap.id}
                  onClick={() => setCapability(cap.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                    capability === cap.id
                      ? 'bg-[#9b7a36] text-white font-semibold shadow-sm'
                      : 'text-[#4a3728] hover:bg-[#e8dcc8]'
                  }`}
                >
                  {cap.icon}
                  <span className="truncate">{lang === 'ar' ? cap.labelAr : cap.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 py-2 border-t border-[#e8dcc8]">
            <div className="text-[10px] font-bold text-[#9b7a36] uppercase tracking-widest mb-2 px-1">
              {lang === 'ar' ? 'أوامر سريعة' : 'Quick Commands'}
            </div>
            <div className="space-y-1">
              {QUICK_COMMANDS.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => { cmd.action(); setQuery('') }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-[#4a3728] hover:bg-[#e8dcc8] transition-colors border border-transparent hover:border-[#e8dcc8]"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 py-2 border-t border-[#e8dcc8] mt-auto">
            <div className="text-[10px] font-bold text-[#9b7a36] uppercase tracking-widest mb-1.5 px-1">
              {lang === 'ar' ? 'الدول المتاحة' : 'Available Countries'}
            </div>
            <div className="space-y-0.5">
              {Object.entries(COUNTRIES).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => setCountry(key)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    country.toLowerCase() === key
                      ? 'bg-[#9b7a36]/20 text-[#9b7a36] font-semibold'
                      : 'text-[#4a3728] hover:bg-[#e8dcc8]'
                  }`}
                >
                  {c.flag} {lang === 'ar' ? c.nameAr : c.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* IDLE — welcome screen */}
            {status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9b7a36] to-[#c2a14e] flex items-center justify-center mb-5 shadow-lg">
                  <Brain className="w-9 h-9 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-[#4a3728] mb-2">
                  {lang === 'ar' ? 'مرحباً بكم في MIRA' : 'Welcome to MIRA'}
                </h2>
                <p className="text-sm text-[#6b5340] mb-1">
                  {lang === 'ar'
                    ? 'نظام الاستخبارات الاستراتيجية لوزارة الطاقة والبنية التحتية'
                    : 'Ministry Intelligence & Research Advisor'}
                </p>
                <p className="text-xs text-[#9b7a36] mb-6">
                  {lang === 'ar'
                    ? 'عندما يكون الاجتماع بعد 15 دقيقة — اجعلهم أكثر استعداداً في الغرفة'
                    : 'When a meeting is in 15 minutes — make leadership the most informed in the room'}
                </p>
                <div className="grid grid-cols-2 gap-3 w-full">
                  {CAPABILITIES.map(cap => (
                    <button
                      key={cap.id}
                      onClick={() => setCapability(cap.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                        capability === cap.id
                          ? 'border-[#9b7a36] bg-[#9b7a36]/10'
                          : 'border-[#e8dcc8] hover:border-[#c2a14e] bg-white/60'
                      }`}
                    >
                      <span className="text-[#9b7a36]">{cap.icon}</span>
                      <span className="text-xs font-medium text-[#4a3728]">
                        {lang === 'ar' ? cap.labelAr : cap.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* THINKING — terminal */}
            {status === 'thinking' && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-[#1a1208] rounded-xl border border-[#9b7a36]/30 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#9b7a36]/20">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/70" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                      <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    </div>
                    <span className="font-mono text-[10px] text-[#a89060] tracking-wider ml-2">MIRA Intelligence Engine v3.1</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#c2a14e] animate-pulse" />
                      <span className="text-[#c2a14e] text-[10px] font-mono">PROCESSING</span>
                    </div>
                  </div>
                  <div ref={terminalRef} className="p-4 font-mono text-xs space-y-1 min-h-[200px] max-h-[400px] overflow-y-auto">
                    {terminalLines.map((line, i) => {
                      const isCmd = line.startsWith('>')
                      const isSuccess = line.startsWith('✓')
                      const isWarning = line.startsWith('!')
                      return (
                        <div
                          key={i}
                          className="animate-[fadeSlide_0.3s_ease-out]"
                          style={{ color: isSuccess ? '#22c55e' : isWarning ? '#ef4444' : isCmd ? '#c2a14e' : '#a89060' }}
                        >
                          {line}
                        </div>
                      )
                    })}
                    {!terminalDone && (
                      <div className="text-[#c2a14e] animate-pulse">█</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RESULT — sections */}
            {status === 'result' && (
              <div className="max-w-3xl mx-auto space-y-1">
                {/* Reset + re-query bar */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-[#9b7a36] font-mono">
                    ✓ {lang === 'ar' ? 'تم إنشاء المنتج الاستخباراتي' : 'Intelligence product generated'}
                  </span>
                  <button
                    onClick={() => setStatus('idle')}
                    className="text-xs text-[#9b7a36] hover:underline"
                  >
                    {lang === 'ar' ? '← استعلام جديد' : '← New query'}
                  </button>
                </div>
                {resultSections.map((section, i) => (
                  <SectionRenderer key={i} section={section} index={i} />
                ))}
              </div>
            )}
          </div>

          {/* ── Query Bar ── */}
          <div className="flex-shrink-0 border-t border-[#e8dcc8] bg-[#f6f0e1] px-4 py-3">
            <div className="max-w-3xl mx-auto">
              {/* Capability indicator */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-[#9b7a36] uppercase tracking-widest">
                  {lang === 'ar' ? 'الوضع:' : 'Mode:'}
                </span>
                <span className="text-[10px] text-[#4a3728] bg-[#e8dcc8] rounded-full px-2.5 py-0.5">
                  {CAPABILITIES.find(c => c.id === capability)?.[lang === 'ar' ? 'labelAr' : 'label']}
                </span>
                <span className="text-[10px] text-[#4a3728] bg-[#e8dcc8] rounded-full px-2.5 py-0.5">
                  {currentPhase.label}
                </span>
              </div>

              <div className="flex gap-2 items-end">
                {/* Country input(s) */}
                <div className={`flex gap-2 ${capability === 'comparison' ? 'flex-col' : ''}`}>
                  <input
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    placeholder={lang === 'ar' ? 'الدولة' : 'Country'}
                    className="w-32 h-9 px-3 text-xs rounded-lg border-2 border-[#e8dcc8] bg-white text-[#4a3728] placeholder-[#b0976c] focus:outline-none focus:border-[#9b7a36] transition-colors"
                  />
                  {capability === 'comparison' && (
                    <input
                      value={country2}
                      onChange={e => setCountry2(e.target.value)}
                      placeholder={lang === 'ar' ? 'الدولة الثانية' : 'vs Country'}
                      className="w-32 h-9 px-3 text-xs rounded-lg border-2 border-[#e8dcc8] bg-white text-[#4a3728] placeholder-[#b0976c] focus:outline-none focus:border-[#9b7a36] transition-colors"
                    />
                  )}
                </div>

                {/* Main query */}
                <textarea
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={lang === 'ar'
                    ? 'اكتب استعلامك الاستراتيجي هنا... (Ctrl+Enter للإرسال)'
                    : 'Enter strategic query or leave blank for default analysis... (Ctrl+Enter)'}
                  rows={1}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border-2 border-[#e8dcc8] bg-white text-[#4a3728] placeholder-[#b0976c] focus:outline-none focus:border-[#9b7a36] transition-colors resize-none"
                />

                {/* Send */}
                <Button
                  onClick={handleSend}
                  disabled={status === 'thinking'}
                  className="h-9 px-4 bg-[#9b7a36] hover:bg-[#7a6030] text-white text-xs font-semibold rounded-lg border-0 flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'إرسال' : 'Send'}
                </Button>
              </div>
              <div className="text-[10px] text-[#b0976c] mt-1.5">
                {lang === 'ar'
                  ? 'نصيحة: اختر دولة من القائمة الجانبية أو اكتبها يدوياً. اضغط Ctrl+Enter للإرسال السريع.'
                  : 'Tip: Select a country from the sidebar or type it. Press Ctrl+Enter to send quickly.'}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
