-- Migration: Ensure all persona email addresses are lowercase
-- Purpose: Fix any remaining mixed-case email addresses in email_settings table
-- that may have been created after the previous normalization migration

UPDATE email_settings
SET email_address = lower(email_address)
WHERE email_address != lower(email_address);
