-- ============================================================================
-- A third kind of consent: publishing a child's drawing.
--
-- It lives in its own migration on purpose. `alter type … add value` may run
-- inside a transaction, but the new value cannot be *used* until that
-- transaction commits — so anything that reads or writes 'gallery' has to be in
-- a later file than this one.
--
-- It is a separate kind rather than a flavour of 'terms' because consent must be
-- specific and unbundled (RGPD Art. 4(11), 7(2)): agreeing to the conditions of
-- sale is not agreeing to have your child's drawing and first name on a public,
-- indexable page. It is also withdrawable on its own — see `user_consents`,
-- where withdrawal is a new row and never an edit.
-- ============================================================================

alter type public.consent_kind add value if not exists 'gallery';
