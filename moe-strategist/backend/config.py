from __future__ import annotations

import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── AI Keys ──────────────────────────────────────────────────────────────
    groq_api_key:   str = Field(default="", alias="GROQ_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")

    # ── Supabase (service role — not anon key) ────────────────────────────────
    supabase_url:              str = Field(default="", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")

    # ── Model config ──────────────────────────────────────────────────────────
    groq_model:  str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    embed_model: str = Field(default="text-embedding-3-small",  alias="EMBED_MODEL")
    embed_dim:   int = Field(default=1536,                       alias="EMBED_DIM")

    # ── Server ────────────────────────────────────────────────────────────────
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        alias="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), ".env.backend"),
        env_file_encoding="utf-8",
        populate_by_name=True,
        extra="ignore",
    )


settings = Settings()
