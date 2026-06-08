const BAD_WORDS = [
  "fuck", "fuck", "f.u.c.k", "f**k", "fuk", "fvck",
  "shit", "sh1t", "sh!t", "sht",
  "ass", "a55", "a**",
  "asshole", "a**hole",
  "bitch", "b1tch", "b!tch", "btch",
  "bastard",
  "cunt", "c**t",
  "dick", "d1ck", "d!ck",
  "cock", "c0ck",
  "pussy", "puss",
  "prick",
  "slut", "sl*t",
  "whore", "wh0re",
  "nigger", "n1gger", "n****",
  "nigga",
  "faggot", "f*ggot", "fag",
  "retard", "ret*rd",
  "motherfucker", "motherf**ker", "mf",
  "bullshit", "bulls**t",
  "damn", "dammit",
  "crap",
  "hell",
  "idiot", "moron", "imbecile", "dumbass",
  "jackass",
  "dipshit",
  "douchebag", "douche",
  "wanker", "w*nker",
  "tosser",
  "twat",
  "arsehole",
  "shithead",
  "fucker",
  "pornhub", "porn", "p0rn",
  "xxx",
  "nude", "nudes",
  "sex", "s3x",
];

const SCAM_DOMAINS = [
  "bit\\.ly", "tinyurl\\.com", "t\\.co", "goo\\.gl", "ow\\.ly", "buff\\.ly",
  "adf\\.ly", "bc\\.vc", "j\\.mp", "cutt\\.ly", "shorturl\\.at",
  "steamcommunity\\-gift\\.com", "steam-gift\\.com", "steamgifts?\\.ru",
  "steam-wallet\\.com", "steamwallet\\.",
  "free-steam\\.", "freesteam\\.", "steamfree\\.",
  "free-robux\\.", "freerobux\\.",
  "discord\\.gift", "discordapp\\.gift", "discordnitro\\.",
  "nitro-discord\\.", "discord-nitro\\.",
  "crypto\\-giveaway\\.", "btc-free\\.", "bitcoin-giveaway\\.",
  "csgo-free\\.", "csgofree\\.", "cs-go-skins\\.",
  "verify-human\\.", "human-verification\\.",
  "getfreegames\\.", "freegame\\.",
  "account-verify\\.", "verify-account\\.",
  "survey-bypass\\.", "human-verify\\.",
];

const SUSPICIOUS_TLDS = /https?:\/\/[^\s]*\.(xyz|tk|ml|ga|cf|gq|top|click|work|link|win|bid|loan|accountant|stream|download|racing|party|review|trade|webcam|science|country|faith|men|date|cricket|space|press|website|site|fun|online|shop|store|live|icu|buzz|club|vip|pro|world|network|digital|media|solutions|today|news|info|biz|mobi)(\/[^\s]*)?/gi;

const URL_WITH_SCAM_DOMAIN = new RegExp(
  `https?:\\/\\/[^\\s]*(${SCAM_DOMAINS.join("|")})[^\\s]*`,
  "gi",
);

const IP_URL = /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[^\s]*/gi;

function buildBadWordRegex(): RegExp {
  const escaped = BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

const BAD_WORD_REGEX = buildBadWordRegex();

export function filterContent(text: string): string {
  if (!text) return text;

  let filtered = text;

  filtered = filtered.replace(URL_WITH_SCAM_DOMAIN, "[***]");

  filtered = filtered.replace(SUSPICIOUS_TLDS, "[***]");

  filtered = filtered.replace(IP_URL, "[***]");

  filtered = filtered.replace(BAD_WORD_REGEX, "[***]");

  return filtered;
}
