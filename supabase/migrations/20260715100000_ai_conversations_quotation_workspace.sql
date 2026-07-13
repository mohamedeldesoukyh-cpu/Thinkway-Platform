-- Allow quotation-scoped AI workspace conversations (Generate Campaign Outputs from quotations).

ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_workspace_type_check;

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_workspace_type_check
  CHECK (workspace_type IN (
    'general',
    'campaign',
    'client',
    'group',
    'brand',
    'vendor',
    'discovery',
    'shortlist',
    'quotation',
    'report'
  ));

COMMENT ON COLUMN public.ai_conversations.workspace_type IS
  'Business workspace scope for conversation reuse (general, campaign, shortlist, quotation, …).';
