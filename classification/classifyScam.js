export function classifyScam(text = "") {
  const lower = String(text || "").toLowerCase();

  if (
    lower.includes("verification code") ||
    lower.includes("confirmation code") ||
    /\botp\b/.test(lower) ||
    lower.includes("2fa") ||
    lower.includes("one-time")
  ) {
    return "verification";
  }

  if (
    lower.includes("phishing") ||
    lower.includes("credential") ||
    lower.includes("login") ||
    lower.includes("password") ||
    lower.includes("sign-in") ||
    lower.includes("signin")
  ) {
    return "phishing";
  }

  if (
    lower.includes("malware") ||
    lower.includes("payload") ||
    lower.includes("ransomware") ||
    lower.includes("trojan") ||
    lower.includes("botnet") ||
    lower.includes("c2") ||
    lower.includes("malware_download")
  ) {
    return "malware";
  }

  if (
    lower.includes("crypto") ||
    lower.includes("bitcoin") ||
    lower.includes("wallet") ||
    lower.includes("ethereum") ||
    lower.includes("usdt")
  ) {
    return "crypto";
  }

  if (
    lower.includes("paypal") ||
    lower.includes("venmo") ||
    lower.includes("zelle") ||
    lower.includes("payment") ||
    lower.includes("wire transfer")
  ) {
    return "payment";
  }

  if (
    lower.includes("bank") ||
    lower.includes("debt") ||
    lower.includes("loan") ||
    lower.includes("routing number")
  ) {
    return "banking";
  }

  if (
    lower.includes("job") ||
    lower.includes("hiring") ||
    lower.includes("recruiter") ||
    lower.includes("interview")
  ) {
    return "job";
  }

  if (lower.includes("gift card") || lower.includes("voucher")) {
    return "gift_card";
  }

  if (
    lower.includes("amazon") ||
    lower.includes("ebay") ||
    lower.includes("marketplace") ||
    lower.includes("seller")
  ) {
    return "marketplace";
  }

  if (
    lower.includes("investment") ||
    lower.includes("profit") ||
    lower.includes("trading") ||
    lower.includes("forex")
  ) {
    return "investment";
  }

  if (
    lower.includes("spam") ||
    lower.includes("smtp") ||
    lower.includes("blacklist") ||
    lower.includes("dnsbl")
  ) {
    return "spam";
  }

  return "unknown";
}
