export function classifyScam(text = "") {
    const lower = text.toLowerCase();
  
    if (
      lower.includes("verification code") ||
      lower.includes("confirmation code") ||
      lower.includes("otp")
    ) return "verification";
  
    if (
      lower.includes("phishing") ||
      lower.includes("login") ||
      lower.includes("password")
    ) return "phishing";
  
    if (
      lower.includes("crypto") ||
      lower.includes("bitcoin") ||
      lower.includes("wallet")
    ) return "crypto";
  
    if (
      lower.includes("paypal") ||
      lower.includes("venmo") ||
      lower.includes("zelle") ||
      lower.includes("payment")
    ) return "payment";
  
    if (
      lower.includes("bank") ||
      lower.includes("debt") ||
      lower.includes("loan")
    ) return "banking";
  
    if (
      lower.includes("job") ||
      lower.includes("hiring") ||
      lower.includes("recruiter") ||
      lower.includes("interview")
    ) return "job";
  
    if (
      lower.includes("gift card") ||
      lower.includes("voucher")
    ) return "gift_card";
  
    if (
      lower.includes("amazon") ||
      lower.includes("ebay") ||
      lower.includes("marketplace") ||
      lower.includes("seller")
    ) return "marketplace";
  
    if (
      lower.includes("investment") ||
      lower.includes("profit") ||
      lower.includes("trading")
    ) return "investment";
  
    return "unknown";
  }