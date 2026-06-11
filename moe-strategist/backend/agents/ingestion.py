from __future__ import annotations

import asyncio
from typing import Any, AsyncGenerator

from .base import BaseAgent
from ..models.schemas import AgentEvent, AgentLogEvent

# ── Hardcoded fallback (mirrors MIRA frontend registry) ──────────────────────

COUNTRY_FALLBACK: dict[str, dict[str, Any]] = {
    "NOR": {
        "name": "Norway", "name_ar": "النرويج", "flag": "🇳🇴",
        "energy_minister": "Terje Aasland", "primary_energy": "88% Hydro",
        "net_zero": 2050, "credit_rating": "AAA",
        "gdp": 419.0, "gdp_growth": 1.9, "inflation": 5.5,
        "trade_uae": 3.1, "renewable": 98.0,
        "key_facts": [
            "World's largest sovereign wealth fund ($1.6T)",
            "Nearly 100% renewable electricity",
            "Major oil exporter despite green leadership",
        ],
        "opportunities": [
            "Green hydrogen joint ventures",
            "SWF co-investment in UAE infrastructure",
            "Offshore wind technology transfer",
            "Carbon capture expertise sharing",
        ],
        "risks": [
            "Geopolitical neutrality limits deep partnerships",
            "Domestic political pressure on fossil fuel exports",
        ],
    },
    "DEU": {
        "name": "Germany", "name_ar": "ألمانيا", "flag": "🇩🇪",
        "energy_minister": "Robert Habeck", "primary_energy": "59% Renewables",
        "net_zero": 2045, "credit_rating": "AAA",
        "gdp": 4100.0, "gdp_growth": 0.2, "inflation": 5.9,
        "trade_uae": 11.2, "renewable": 59.0,
        "key_facts": [
            "Largest EU economy, industrial powerhouse",
            "Aggressive Energiewende policy",
            "Siemens Energy & Volkswagen active in UAE",
        ],
        "opportunities": [
            "Green hydrogen supply agreements (NEOM → Hamburg)",
            "Smart grid technology exports",
            "Industrial efficiency partnerships",
        ],
        "risks": [
            "Political instability (coalition fragility)",
            "Energy price sensitivity post-Russia crisis",
        ],
    },
    "SAU": {
        "name": "Saudi Arabia", "name_ar": "المملكة العربية السعودية", "flag": "🇸🇦",
        "energy_minister": "Prince Abdulaziz bin Salman", "primary_energy": "62% Oil",
        "net_zero": 2060, "credit_rating": "A1/A+",
        "gdp": 1070.0, "gdp_growth": 0.8, "inflation": 2.3,
        "trade_uae": 28.5, "renewable": 18.0,
        "key_facts": [
            "GCC strategic partner & neighbour",
            "NEOM $500B mega-project",
            "Aramco world's most valuable company",
        ],
        "opportunities": [
            "Gulf electricity interconnection grid",
            "ADNOC-Aramco joint upstream ventures",
            "PIF-Mubadala co-investment platform",
        ],
        "risks": [
            "Competitive tensions in FDI attraction",
            "OPEC+ quota disagreements",
        ],
    },
    "CHN": {
        "name": "China", "name_ar": "الصين", "flag": "🇨🇳",
        "energy_minister": "Zhang Jianhua (NEA)", "primary_energy": "57% Coal / 31% Renewables",
        "net_zero": 2060, "credit_rating": "A1/A+",
        "gdp": 17700.0, "gdp_growth": 5.2, "inflation": 0.2,
        "trade_uae": 95.6, "renewable": 31.0,
        "key_facts": [
            "UAE's #1 trade partner",
            "Largest solar panel manufacturer globally",
            "Belt & Road presence in UAE logistics",
        ],
        "opportunities": [
            "Jebel Ali free zone expansion with Chinese firms",
            "Solar manufacturing JV in UAE",
            "Digital Silk Road data infrastructure",
        ],
        "risks": [
            "US pressure on UAE to limit Chinese tech access",
            "IP protection concerns in joint ventures",
        ],
    },
    "IND": {
        "name": "India", "name_ar": "الهند", "flag": "🇮🇳",
        "energy_minister": "R.K. Singh", "primary_energy": "49% Coal / 19% Renewables",
        "net_zero": 2070, "credit_rating": "Baa3/BBB-",
        "gdp": 3500.0, "gdp_growth": 7.2, "inflation": 5.4,
        "trade_uae": 84.8, "renewable": 19.0,
        "key_facts": [
            "3.5M Indian expats in UAE (largest diaspora)",
            "CEPA signed 2022 — fastest growing trade corridor",
            "World's fastest growing major economy",
        ],
        "opportunities": [
            "Green hydrogen import corridor (India → UAE → Europe)",
            "Fintech & digital payments integration (UPI ↔ AED)",
            "Food security partnerships",
        ],
        "risks": [
            "Diplomatic balancing act (Russia, US, China)",
            "Infrastructure bottlenecks limit delivery speed",
        ],
    },
    "JPN": {
        "name": "Japan", "name_ar": "اليابان", "flag": "🇯🇵",
        "energy_minister": "Yasutoshi Nishimura", "primary_energy": "36% Gas",
        "net_zero": 2050, "credit_rating": "A1/A+",
        "gdp": 4200.0, "gdp_growth": 1.9, "inflation": 3.3,
        "trade_uae": 22.8, "renewable": 23.0,
        "key_facts": [
            "Major LNG buyer from UAE",
            "G7 hydrogen society roadmap aligns with UAE",
            "Toyota, Sony, Mitsubishi all active in UAE",
        ],
        "opportunities": [
            "Ammonia co-firing technology for UAE power plants",
            "Advanced nuclear SMR collaboration",
            "Robotic & AI manufacturing partnerships",
        ],
        "risks": [
            "Demographic decline limits long-term partnership depth",
            "Yen weakness reduces investment capacity",
        ],
    },
    "USA": {
        "name": "United States", "name_ar": "الولايات المتحدة الأمريكية", "flag": "🇺🇸",
        "energy_minister": "Jennifer Granholm (DOE)", "primary_energy": "22% Renewables",
        "net_zero": 2050, "credit_rating": "Aaa/AA+",
        "gdp": 27400.0, "gdp_growth": 2.5, "inflation": 3.4,
        "trade_uae": 32.1, "renewable": 22.0,
        "key_facts": [
            "UAE hosts largest US military base in Middle East (Al Dhafra)",
            "Abraham Accords strategic partner",
            "IRA $369B clean energy incentives",
        ],
        "opportunities": [
            "AI & nuclear technology transfer under US-UAE Framework",
            "LNG supply diversification (US → UAE storage/re-export)",
            "Cybersecurity infrastructure partnership",
        ],
        "risks": [
            "Technology export controls (semiconductors, AI chips)",
            "Geopolitical pressure on UAE-China ties",
        ],
    },
    "GBR": {
        "name": "United Kingdom", "name_ar": "المملكة المتحدة", "flag": "🇬🇧",
        "energy_minister": "Claire Coutinho", "primary_energy": "29% Wind",
        "net_zero": 2050, "credit_rating": "Aa3/AA",
        "gdp": 3100.0, "gdp_growth": 0.1, "inflation": 6.8,
        "trade_uae": 6.2, "renewable": 29.0,
        "key_facts": [
            "ADNOC has major North Sea assets",
            "London financial hub for UAE sovereign funds",
            "Strong defence & security relationship",
        ],
        "opportunities": [
            "Offshore wind technology export to UAE",
            "City of London green sukuk listings",
            "Nuclear SMR (Rolls-Royce) collaboration",
        ],
        "risks": [
            "Post-Brexit regulatory uncertainty",
            "Economic stagnation limits ambition",
        ],
    },
    "FRA": {
        "name": "France", "name_ar": "فرنسا", "flag": "🇫🇷",
        "energy_minister": "Agnès Pannier-Runacher", "primary_energy": "69% Nuclear",
        "net_zero": 2050, "credit_rating": "Aa2/AA-",
        "gdp": 2900.0, "gdp_growth": 0.9, "inflation": 5.7,
        "trade_uae": 8.4, "renewable": 26.0,
        "key_facts": [
            "Louvre Abu Dhabi — cultural soft power anchor",
            "EDF nuclear expertise — Barakah unit 4 consulting",
            "Macron personal relationship with UAE leadership",
        ],
        "opportunities": [
            "Nuclear fleet expansion consultation",
            "Airbus aviation & hydrogen aircraft",
            "Total Energies UAE offshore expansion",
        ],
        "risks": [
            "Nuclear technology export regulatory complexity",
            "Domestic pension reform instability",
        ],
    },
    "KOR": {
        "name": "South Korea", "name_ar": "كوريا الجنوبية", "flag": "🇰🇷",
        "energy_minister": "Bang Moon-kyu (MOTIE)", "primary_energy": "30% Nuclear",
        "net_zero": 2050, "credit_rating": "Aa2/AA",
        "gdp": 1700.0, "gdp_growth": 1.4, "inflation": 3.6,
        "trade_uae": 14.8, "renewable": 10.0,
        "key_facts": [
            "KEPCO built all 4 Barakah nuclear units — deepest nuclear partnership",
            "Samsung, Hyundai, LG all major UAE contractors",
            "K-Hydrogen roadmap aligns with UAE strategy",
        ],
        "opportunities": [
            "Barakah units 5-8 expansion (pre-qualified partner)",
            "Battery storage gigafactory in UAE",
            "Smart city technology (K-City → UAE municipalities)",
        ],
        "risks": [
            "Samsung/LG competition with Chinese alternatives",
            "Labour cost escalation on large projects",
        ],
    },
}

# Aliases for flexible name resolution
NAME_ALIASES: dict[str, str] = {
    "norway": "NOR", "nor": "NOR",
    "germany": "DEU", "deu": "DEU", "deutschland": "DEU",
    "saudi arabia": "SAU", "saudi": "SAU", "ksa": "SAU", "sau": "SAU",
    "china": "CHN", "chn": "CHN", "prc": "CHN",
    "india": "IND", "ind": "IND",
    "japan": "JPN", "jpn": "JPN",
    "usa": "USA", "united states": "USA", "us": "USA", "america": "USA",
    "uk": "GBR", "united kingdom": "GBR", "britain": "GBR", "gbr": "GBR",
    "france": "FRA", "fra": "FRA",
    "south korea": "KOR", "korea": "KOR", "kor": "KOR",
}


def resolve_code(raw: str) -> str | None:
    """Resolve any country name/code to ISO-3 key used in COUNTRY_FALLBACK."""
    key = raw.strip().upper()
    if key in COUNTRY_FALLBACK:
        return key
    alias = NAME_ALIASES.get(raw.strip().lower())
    return alias


class IngestionAgent(BaseAgent):
    """
    Agent 1 — Data Ingestion.

    Fetches country economic data and bilateral context from Supabase.
    Falls back to the hardcoded registry if Supabase is not configured.
    """

    name = "Ingestion Agent"

    def __init__(self) -> None:
        self._sb = None
        try:
            from ..config import settings
            if settings.supabase_url and settings.supabase_service_role_key:
                from supabase import create_client
                self._sb = create_client(
                    settings.supabase_url,
                    settings.supabase_service_role_key,
                )
        except Exception:
            pass

    async def run(self, ctx: dict[str, Any]) -> AsyncGenerator[AgentEvent, None]:  # type: ignore[override]
        raw_code = ctx.get("country_code", "")
        iso3 = resolve_code(raw_code)

        yield self.log(f"> Resolving country identifier: '{raw_code}'...")
        await asyncio.sleep(0.05)

        if not iso3:
            yield self.log(f"Unknown country '{raw_code}' — no data available", "error")
            ctx["country_not_found"] = True
            return

        yield self.log(f"> Identified: {COUNTRY_FALLBACK.get(iso3, {}).get('flag', '')} {iso3}")
        ctx["iso3"] = iso3

        # ── Try Supabase first ─────────────────────────────────────────────
        if self._sb:
            yield self.log("> Querying Supabase live country metrics...")
            try:
                resp = (
                    self._sb.table("countries")
                    .select(
                        "*, country_metrics(metric_year, gdp_usd_billions, gdp_growth_pct,"
                        " inflation_rate_pct, trade_uae_usd_billions, renewable_energy_pct)"
                    )
                    .eq("code", iso3)
                    .single()
                    .execute()
                )
                row = resp.data or {}
                metrics = (row.get("country_metrics") or [{}])[0]

                ctx.update(
                    country_name=row.get("name", ""),
                    country_name_ar=row.get("name_ar"),
                    flag_emoji=row.get("flag_emoji"),
                    energy_minister=row.get("energy_minister"),
                    primary_energy=row.get("primary_energy"),
                    net_zero=row.get("net_zero_target"),
                    credit_rating=row.get("credit_rating"),
                    gdp_usd_bn=metrics.get("gdp_usd_billions"),
                    gdp_growth_pct=metrics.get("gdp_growth_pct"),
                    inflation_pct=metrics.get("inflation_rate_pct"),
                    trade_uae_bn=metrics.get("trade_uae_usd_billions"),
                    renewable_pct=metrics.get("renewable_energy_pct"),
                )
                yield self.log(
                    f"> Live data loaded: GDP=${ctx.get('gdp_usd_bn')}B | "
                    f"Growth={ctx.get('gdp_growth_pct')}% ✓",
                    "success",
                )
                return
            except Exception as exc:
                yield self.log(f"> Supabase query failed ({exc}) — using fallback", "warning")

        # ── Hardcoded fallback ─────────────────────────────────────────────
        fb = COUNTRY_FALLBACK.get(iso3, {})
        ctx.update(
            country_name=fb.get("name", iso3),
            country_name_ar=fb.get("name_ar"),
            flag_emoji=fb.get("flag"),
            energy_minister=fb.get("energy_minister"),
            primary_energy=fb.get("primary_energy"),
            net_zero=fb.get("net_zero"),
            credit_rating=fb.get("credit_rating"),
            gdp_usd_bn=fb.get("gdp"),
            gdp_growth_pct=fb.get("gdp_growth"),
            inflation_pct=fb.get("inflation"),
            trade_uae_bn=fb.get("trade_uae"),
            renewable_pct=fb.get("renewable"),
            key_facts=fb.get("key_facts", []),
            opportunities=fb.get("opportunities", []),
            risks=fb.get("risks", []),
        )

        # Enrich second country for comparison mode
        raw2 = ctx.get("country_code_2")
        if raw2:
            iso3_2 = resolve_code(raw2)
            if iso3_2 and iso3_2 in COUNTRY_FALLBACK:
                fb2 = COUNTRY_FALLBACK[iso3_2]
                ctx.update(
                    iso3_2=iso3_2,
                    country_name_2=fb2.get("name"),
                    flag_2=fb2.get("flag"),
                    gdp_2=fb2.get("gdp"),
                    gdp_growth_2=fb2.get("gdp_growth"),
                    trade_uae_2=fb2.get("trade_uae"),
                    renewable_2=fb2.get("renewable"),
                    net_zero_2=fb2.get("net_zero"),
                    primary_energy_2=fb2.get("primary_energy"),
                )

        yield self.log(
            f"> Loaded fallback profile: {ctx['country_name']} "
            f"GDP=${ctx.get('gdp_usd_bn')}B ✓",
            "success",
        )
