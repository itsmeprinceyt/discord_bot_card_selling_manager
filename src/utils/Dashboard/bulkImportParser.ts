const COMMAND_WORDS = new Set([
  "sv",
  "s",
  "view",
  "show",
  "info",
  "card",
  "c",
  "v",
  "lookup",
  "l",
  "get",
  "check",
  "kv",
]);

const STOP_WORDS = new Set([
  "total",
  "owned",
  "buying",
  "selling",
  "thanks",
  "please",
]);

const CURRENCY_ALIASES: Record<string, string> = {
  s: "silver",
  sil: "silver",
  silv: "silver",
  silver: "silver",
  silvers: "silver",
  g: "gold",
  gld: "gold",
  gold: "gold",
  "💰": "gold",
  w: "wist",
  wist: "wist",
  wists: "wist",
  sc_wist: "wist",
  t: "ticket",
  tic: "ticket",
  tix: "ticket",
  tick: "ticket",
  ticket: "ticket",
  tickets: "ticket",
  "🎟": "ticket",
  bit: "bits",
  bits: "bits",
};

const CODE_RE = /^[a-z0-9]{5,8}$/i;
const AMOUNT_RE = /^(\d[\d,]*(?:\.\d+)?)(k)?(.*)$/i;
const MENTION_RE = /<@!?(\d+)>/;
const MENTION_GLOBAL_RE = /<@!?\d+>/g;
const HEADER_RE =
  /\s—\s*(?:(?:yesterday|today)\s+at\s+)?\d{1,2}:\d{2}\s*(?:[ap]m)?\s*$/i;
const IGNORED_LINE_RE = /^(owned by|total)\b/i;

interface ParsedOrder {
  code: string;
  amount: string;
  currency: string | null;
}

interface ExtractOptions {
  fallbackBuyerId: string;
  fallbackAmount: string;
  currency: string;
}

export interface ExtractResult {
  lines: string[];
  skipped: string[];
  otherCurrencies: Record<string, number>;
}

const resolveCurrency = (raw: string): string | null => {
  const key = raw.toLowerCase().replace(/[:\uFE0F]/g, "");
  return key ? (CURRENCY_ALIASES[key] ?? null) : null;
};

const normalizeCurrency = (option: string) =>
  resolveCurrency(option) ?? option.toLowerCase();

const tokenize = (line: string) =>
  line
    .replace(MENTION_GLOBAL_RE, " ")
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[,;]+$/, ""))
    .filter(Boolean);

const isCodeToken = (token: string) =>
  CODE_RE.test(token) &&
  /[a-z]/i.test(token) &&
  !COMMAND_WORDS.has(token.toLowerCase()) &&
  !STOP_WORDS.has(token.toLowerCase()) &&
  resolveCurrency(token) === null;

const parseAmountAt = (tokens: string[], index: number) => {
  const match = tokens[index].match(AMOUNT_RE);
  if (!match) return null;
  const base = parseFloat(match[1].replace(/,/g, ""));
  if (Number.isNaN(base)) return null;
  const value = match[2] ? base * 1000 : base;
  const suffix = match[3];
  if (suffix) {
    const currency = resolveCurrency(suffix);
    return currency ? { value, currency } : null;
  }
  const next = tokens[index + 1];
  return { value, currency: next ? resolveCurrency(next) : null };
};

const parseOrderTokens = (
  tokens: string[],
  fallbackAmount = "",
): ParsedOrder | null => {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const amount = parseAmountAt(tokens, i);
    if (!amount) continue;
    for (let j = i - 1; j >= 0; j--) {
      if (isCodeToken(tokens[j])) {
        return {
          code: tokens[j],
          amount: String(amount.value),
          currency: amount.currency,
        };
      }
    }
    return null;
  }

  if (!fallbackAmount) return null;

  for (let i = 0; i < tokens.length - 1; i++) {
    if (
      COMMAND_WORDS.has(tokens[i].toLowerCase()) &&
      isCodeToken(tokens[i + 1])
    ) {
      return { code: tokens[i + 1], amount: fallbackAmount, currency: null };
    }
  }
  return null;
};

const looksLikeOrder = (tokens: string[]) =>
  tokens.some(
    (token, i) => isCodeToken(token) || parseAmountAt(tokens, i) !== null,
  );

export const extractOrders = (
  raw: string,
  options: ExtractOptions,
): ExtractResult => {
  const target = options.currency ? normalizeCurrency(options.currency) : "";
  const seen = new Set<string>();
  const lines: string[] = [];
  const skipped: string[] = [];
  const otherCurrencies: Record<string, number> = {};
  let stickyBuyer: string | null = null;

  const rawLines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of rawLines) {
    if (HEADER_RE.test(line)) {
      stickyBuyer = null;
      continue;
    }
    if (IGNORED_LINE_RE.test(line)) continue;

    const mention = line.match(MENTION_RE);
    if (mention) stickyBuyer = mention[1];
    else if (line.startsWith("@")) stickyBuyer = null;

    const tokens = tokenize(line);

    if (line.includes(" · ")) {
      skipped.push(line);
      continue;
    }

    const parsed = parseOrderTokens(tokens, options.fallbackAmount);
    if (!parsed) {
      if (looksLikeOrder(tokens)) skipped.push(line);
      continue;
    }

    if (parsed.currency && target && parsed.currency !== target) {
      otherCurrencies[parsed.currency] =
        (otherCurrencies[parsed.currency] ?? 0) + 1;
      continue;
    }

    const buyer = stickyBuyer || options.fallbackBuyerId;
    if (!buyer) {
      skipped.push(line);
      continue;
    }

    const output = `${buyer} ${parsed.code.toLowerCase()} ${parsed.amount}`;
    if (seen.has(output)) continue;
    seen.add(output);
    lines.push(output);
  }

  return { lines, skipped, otherCurrencies };
};

export const cleanBulkLine = (line: string): string => {
  const trimmed = line.trim();
  if (!trimmed) return line;

  const mention = trimmed.match(MENTION_RE);
  const tokens = tokenize(trimmed);
  let buyer = mention ? mention[1] : "";

  if (!buyer && /^\d+$/.test(tokens[0] ?? "")) {
    buyer = tokens.shift() as string;
  }
  if (!buyer) return line;

  const parsed = parseOrderTokens(tokens);
  if (!parsed) return line;

  return `${buyer} ${parsed.code.toLowerCase()} ${parsed.amount}`;
};
