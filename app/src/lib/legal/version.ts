/**
 * Version of the legal documents currently published.
 *
 * Every consent record stores this string, so you can always answer "what
 * exactly did this person agree to?" — which is the whole point of Article 7(1)
 * of the RGPD, where the burden of proof sits with the controller.
 *
 * Bump it whenever the terms of sale or the privacy notice change materially.
 * Existing customers keep their old record; asking them to re-accept then becomes
 * a product decision rather than a data-loss problem.
 */
export const LEGAL_VERSION = "2026-08-05";
