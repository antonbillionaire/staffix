-- Add structured onboarding tracking to SalesLead so Victor can resume the
-- step-by-step Staffix setup conversation across multiple sessions instead of
-- relying on free-text history alone (which gets lost after 20 messages).
--
-- Steps:
--   0 = not_started, 1 = registered, 2 = business_profile, 3 = telegram_bot,
--   4 = extra_channels, 5 = team, 6 = catalog, 7 = knowledge_base,
--   8 = ai_settings, 9 = automations, 10 = tested, 11 = launched

ALTER TABLE "SalesLead"
  ADD COLUMN "onboardingStep"  INTEGER,
  ADD COLUMN "onboardingNotes" TEXT;
