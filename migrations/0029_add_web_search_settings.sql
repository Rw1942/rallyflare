-- Migration 0029: Add web search settings to project_settings and messages
-- Enables OpenAI web_search tool via global toggle with configurable context size

-- Global web search controls
ALTER TABLE project_settings ADD COLUMN web_search_enabled INTEGER DEFAULT 1;
ALTER TABLE project_settings ADD COLUMN web_search_context_size TEXT DEFAULT 'low';

-- Observability: track web search usage per message
ALTER TABLE messages ADD COLUMN web_search_used INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN web_search_source_count INTEGER;
