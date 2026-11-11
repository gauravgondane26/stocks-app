// Checks for AI text before it goes into an email. Pure: no network. Cheaper models
// break instructions more often, so callers pass these to generateText's `accept`
// and a failing answer goes to the next model.

// Free market data is delayed, so text promising live prices is wrong. Negated
// phrases such as "delayed, not real-time" are correct, so they're removed first.
const NEGATED_LIVE =
  /\b(?:not|never|no|isn['’]t|aren['’]t)\s+(?:real[- ]?time|live)(?:\s+or\s+(?:real[- ]?time|live))?\b/gi;
const LIVE_PRICE_CLAIM = /\breal[- ]?time\b|\blive\s+(prices?|quotes?|data|market|updates?)\b/i;

export const claimsLivePrices = (text: string) => LIVE_PRICE_CLAIM.test(text.replace(NEGATED_LIVE, ""));

// OpenWatch never tells anyone what to trade, even when a headline does.
const ADVICE =
  /\b(?:you should (?:buy|sell|hold|consider)|we recommend|i recommend|consider (?:buying|selling|adding|exiting)|(?:good|great|right) time to (?:buy|sell)|worth buying|strong buy|buy now|sell now|will (?:rise|fall|climb|drop|rally|surge|crash))\b/i;

export const givesAdvice = (text: string) => ADVICE.test(text);

// Collapses whitespace and drops markdown bold.
export const cleanAiText = (text: string) => text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
