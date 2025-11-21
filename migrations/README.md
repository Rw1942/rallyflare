# Database Migrations

This folder contains SQL migrations for the Email2ChatGPT D1 database. Migrations are applied sequentially and should **never** be modified once deployed to production.

## Migration Strategy

**Sequential numbered files**: `NNNN_description.sql`
- Wrangler applies them in order automatically
- Each migration runs exactly once
- Failed migrations block subsequent ones

## How to Apply Migrations

### Remote (Production)
```bash
cd services/ingest
npx wrangler d1 migrations apply rally-database --remote
```

### Local Development
```bash
cd services/ingest
npx wrangler d1 migrations apply rally-database --local
```

## Creating a New Migration

1. **Name it sequentially**: `0026_your_description.sql`
2. **Write idempotent SQL** when possible:
   ```sql
   -- Good: Won't fail if column exists
   ALTER TABLE messages ADD COLUMN IF NOT EXISTS new_field TEXT;
   
   -- Avoid: Will fail on re-run
   ALTER TABLE messages ADD COLUMN new_field TEXT;
   ```
3. **Test locally first**: Apply to local D1, verify schema
4. **Deploy to remote**: After testing, apply with `--remote`

## Migration History

### Schema Evolution
- **0001-0002**: Initial tables (messages, participants, comments)
- **0003**: Added message direction tracking (inbound/outbound)
- **0004-0006**: Model updates and email-specific features
- **0007**: User tracking, GDPR compliance (users table, data_retention)
- **0008-0012**: Performance metrics, token tracking, response IDs
- **0013-0019**: API parameter refinements (verbosity, timing, temperature)
- **0020-0021**: Refactored to email_settings, removed unsupported params
- **0022-0023**: User backfill and auto-population trigger
- **0024**: Email normalization and case-insensitive lookups
- **0025**: **GPT-5.1 upgrade** - Updated default model to `gpt-5.1`
- **0026**: **Cleanup** - Dropped unused `comments` table (Wrangler scaffolding artifact)

### Current Schema (as of migration 0025)

**Core Tables:**
- `messages` - Email messages (inbound/outbound) with AI responses
- `users` - Auto-tracked users with token usage and costs
- `email_settings` - Per-user AI configuration overrides
- `attachments` - R2 file references
- `processing_logs` - Detailed timing breakdowns
- `requests` - API request tracking

**Key Features:**
- Automatic user tracking via trigger on messages insert
- Performance metrics (OpenAI time, total time, token counts)
- Per-user settings with global defaults
- Case-insensitive email handling

## Best Practices

✅ **Do:**
- Write migrations for schema changes only (not data fixes)
- Add comments explaining why (not just what)
- Test locally before deploying
- Keep migrations small and focused

❌ **Don't:**
- Modify deployed migrations (create a new one to fix issues)
- Put sensitive data in migrations
- Write migrations that depend on external services
- Use migrations for one-time data imports (use scripts instead)

## Troubleshooting

**Migration won't apply:**
```bash
# Check current migration status
npx wrangler d1 migrations list rally-database --remote

# View applied migrations
npx wrangler d1 execute rally-database --remote --command "SELECT * FROM d1_migrations;"
```

**Need to rollback:**
D1 doesn't support automatic rollback. To revert:
1. Write a new migration that undoes the change
2. Name it `0026_rollback_feature_x.sql`
3. Apply it like any other migration

## Future Considerations

As migrations grow (currently 25), consider:
- Archiving pre-launch migrations into `archive/` after consolidation
- Creating a "fresh start" migration for new deployments
- Documenting breaking changes clearly in this README

