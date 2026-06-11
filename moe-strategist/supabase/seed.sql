-- ============================================================================
-- MOE Strategist – Seed Data
-- Run AFTER schema.sql and functions.sql
-- ============================================================================

-- ── Countries ─────────────────────────────────────────────────────────────────

insert into public.countries
  (code, code_2, name, name_ar, flag_emoji, region, sub_region,
   energy_minister, energy_minister_ar, primary_energy, net_zero_target, credit_rating)
values
  ('NOR', 'NO', 'Norway',         'النرويج',                  '🇳🇴', 'Europe',        'Northern Europe',
   'Terje Aasland',                   'تيرجي أوسلاند',         '88% Hydro',             2050, 'AAA'),
  ('DEU', 'DE', 'Germany',        'ألمانيا',                  '🇩🇪', 'Europe',        'Western Europe',
   'Robert Habeck',                   'روبرت هابيك',           '59% Renewables',        2045, 'AAA'),
  ('SAU', 'SA', 'Saudi Arabia',   'المملكة العربية السعودية', '🇸🇦', 'Middle East',   'Arabian Peninsula',
   'Prince Abdulaziz bin Salman',     'الأمير عبدالعزيز بن سلمان', '62% Oil',          2060, 'A1/A+'),
  ('CHN', 'CN', 'China',          'الصين',                    '🇨🇳', 'Asia',          'East Asia',
   'Zhang Jianhua (NEA)',             'تشانغ جيانهوا',         '57% Coal / 31% Renewables', 2060, 'A1/A+'),
  ('IND', 'IN', 'India',          'الهند',                    '🇮🇳', 'Asia',          'South Asia',
   'R.K. Singh',                      'آر كيه سينغ',           '49% Coal / 19% Renewables', 2070, 'Baa3/BBB-'),
  ('JPN', 'JP', 'Japan',          'اليابان',                  '🇯🇵', 'Asia',          'East Asia',
   'Yasutoshi Nishimura',             'ياسوتوشي نيشيمورا',     '36% Gas',               2050, 'A1/A+'),
  ('USA', 'US', 'United States',  'الولايات المتحدة الأمريكية', '🇺🇸', 'Americas',   'North America',
   'Jennifer Granholm',               'جنيفر غرانهولم',        '22% Renewables',        2050, 'Aaa/AA+'),
  ('GBR', 'GB', 'United Kingdom', 'المملكة المتحدة',          '🇬🇧', 'Europe',        'Northern Europe',
   'Claire Coutinho',                 'كلير كوتينهو',          '29% Wind',              2050, 'Aa3/AA'),
  ('FRA', 'FR', 'France',         'فرنسا',                    '🇫🇷', 'Europe',        'Western Europe',
   'Agnès Pannier-Runacher',          'أنييس بانييه-روناشيه',  '69% Nuclear',           2050, 'Aa2/AA-'),
  ('KOR', 'KR', 'South Korea',    'كوريا الجنوبية',           '🇰🇷', 'Asia',          'East Asia',
   'Bang Moon-kyu (MOTIE)',           'بانغ مون-كيو',          '30% Nuclear',           2050, 'Aa2/AA')
on conflict (code) do update
  set energy_minister = excluded.energy_minister,
      primary_energy   = excluded.primary_energy,
      net_zero_target  = excluded.net_zero_target,
      credit_rating    = excluded.credit_rating,
      updated_at       = now();

-- ── Country Metrics (2023 data) ───────────────────────────────────────────────

insert into public.country_metrics
  (country_id, metric_year, gdp_usd_billions, gdp_growth_pct,
   inflation_rate_pct, trade_uae_usd_billions, renewable_energy_pct, source)
select c.id, 2023, m.gdp, m.gdp_growth, m.inflation, m.trade_uae, m.renewable, 'seed'
from (
  values
    ('NOR', 419.0,   1.9, 5.5,  3.1, 98.0),
    ('DEU', 4100.0,  0.2, 5.9, 11.2, 59.0),
    ('SAU', 1070.0,  0.8, 2.3, 28.5, 18.0),
    ('CHN', 17700.0, 5.2, 0.2, 95.6, 31.0),
    ('IND', 3500.0,  7.2, 5.4, 84.8, 19.0),
    ('JPN', 4200.0,  1.9, 3.3, 22.8, 23.0),
    ('USA', 27400.0, 2.5, 3.4, 32.1, 22.0),
    ('GBR', 3100.0,  0.1, 6.8,  6.2, 29.0),
    ('FRA', 2900.0,  0.9, 5.7,  8.4, 26.0),
    ('KOR', 1700.0,  1.4, 3.6, 14.8, 10.0)
) as m(code, gdp, gdp_growth, inflation, trade_uae, renewable)
join public.countries c on c.code = m.code
on conflict (country_id, metric_year) do update
  set gdp_usd_billions       = excluded.gdp_usd_billions,
      gdp_growth_pct         = excluded.gdp_growth_pct,
      trade_uae_usd_billions = excluded.trade_uae_usd_billions,
      renewable_energy_pct   = excluded.renewable_energy_pct;

-- ── Bilateral Agreements (UAE key partnerships) ───────────────────────────────

insert into public.bilateral_agreements
  (country_id, title, agreement_type, signed_date, status, key_sectors, summary)
select c.id, a.title, a.agreement_type::text, a.signed_date::date, 'active',
       a.sectors, a.summary
from (
  values
    ('NOR', 'UAE-Norway Renewable Energy and Hydrogen Partnership MOU',
     'MOU', '2023-01-15', '{Energy,Hydrogen,Technology}',
     'Bilateral framework for green hydrogen supply chains and offshore wind technology transfer between UAE and Norway.'),
    ('NOR', 'Sovereign Wealth Fund Co-Investment Framework',
     'Framework', '2022-06-10', '{Finance,Infrastructure}',
     'ADIA and Norges Bank Investment Management co-investment platform targeting $5B in joint infrastructure assets.'),
    ('DEU', 'UAE-Germany Comprehensive Energy Partnership',
     'EnergyPact', '2022-09-27', '{Energy,Trade,Technology}',
     'Signed at the sidelines of UNGA. Covers LNG supply, green hydrogen, solar energy, and industrial transformation.'),
    ('DEU', 'Hannover Messe UAE Pavilion MOU',
     'MOU', '2023-03-15', '{Industry,Technology}',
     'UAE industrial showcasing and technology exchange at Hannover Messe. Supports UAE Industrial Strategy 2031.'),
    ('SAU', 'GCC Electricity Interconnection Framework',
     'Framework', '2001-01-01', '{Energy,Infrastructure}',
     'Gulf Cooperation Council interconnected electricity grid. Phase 3 expansion under active negotiation.'),
    ('SAU', 'ADNOC-Aramco Downstream Cooperation Agreement',
     'MOU', '2021-09-15', '{Energy,Petrochemicals}',
     'Joint downstream refining, petrochemicals, and LNG liquefaction cooperation between ADNOC and Saudi Aramco.'),
    ('CHN', 'UAE-China Comprehensive Strategic Partnership',
     'Treaty', '2019-07-23', '{Trade,Energy,Technology,Finance}',
     'Elevates UAE-China ties to comprehensive strategic partnership. Covers BRI projects, energy, digital economy.'),
    ('CHN', 'ADNOC-CNOOC Joint Exploration Agreement',
     'MOU', '2022-11-16', '{Energy}',
     'Joint upstream oil and gas exploration in Abu Dhabi concessions with Chinese national oil company.'),
    ('IND', 'UAE-India CEPA (Comprehensive Economic Partnership Agreement)',
     'CEPA', '2022-02-18', '{Trade,Investment,Services}',
     'Landmark CEPA eliminating tariffs on 90% of goods. Target $100B bilateral trade by 2030. Includes digital payments interoperability.'),
    ('JPN', 'UAE-Japan Long-Term LNG Supply Agreement',
     'EnergyPact', '2021-04-01', '{Energy,LNG}',
     'ADNOC long-term LNG supply to Japanese utilities. Covers 1 million tonnes per annum through 2035.'),
    ('USA', 'Abraham Accords Economic Normalization Framework',
     'Framework', '2020-09-15', '{Trade,Technology,Defence,Finance}',
     'Comprehensive normalization with strategic economic dimensions. Covers defence, clean energy, and tech cooperation.'),
    ('USA', 'UAE-US Artificial Intelligence & Nuclear Cooperation Framework',
     'Framework', '2023-06-01', '{Technology,Nuclear,AI}',
     'Framework for AI governance alignment and civil nuclear cooperation. Relates to UAE AUKUS-adjacent technology access discussions.'),
    ('GBR', 'UAE-UK Sovereign Investment Partnership',
     'Framework', '2021-09-17', '{Finance,Infrastructure,Technology}',
     'UAE commits £10B investment in UK infrastructure and clean energy. Mubadala and British Patient Capital co-investment.'),
    ('FRA', 'Louvre Abu Dhabi Cultural Partnership Agreement',
     'Treaty', '2007-03-06', '{Culture,Tourism}',
     '30-year agreement for UAE use of Louvre brand. Covers art loans, curatorial expertise, and cultural diplomacy.'),
    ('KOR', 'UAE-South Korea Barakah Nuclear Power Partnership',
     'EnergyPact', '2009-12-27', '{Nuclear,Energy,Technology}',
     'KEPCO consortium contract to build and operate UAE''s 4-unit Barakah Nuclear Power Plant (5.6 GW). Includes operational partnership and possible expansion.')
) as a(code, title, agreement_type, signed_date, sectors, summary)
join public.countries c on c.code = a.code
on conflict do nothing;
