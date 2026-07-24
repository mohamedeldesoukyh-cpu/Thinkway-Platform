-- P1-01: Invalidate outstanding invites after switching to hashed tokens.
-- Existing token_hash values may be plaintext; they must not remain usable.
-- New invites hash with SHA-256 / HMAC-SHA256 (app-side). No schema change required.

UPDATE public.user_invites
SET
  status = 'revoked',
  updated_at = timezone('utc', now()),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'revoked_reason', 'p1_invite_token_hash_rotation',
    'revoked_at', timezone('utc', now())
  )
WHERE status = 'invited';

COMMENT ON COLUMN public.user_invites.token_hash IS
  'SHA-256 or HMAC-SHA256 hex digest of invite token. Never store plaintext.';
