// Country name → ISO-3166 alpha-2 → flag emoji. Used by the base detail panel
// to show a flag next to a base's country (the bundled OSM data carries the
// country NAME only, not an ISO code). Covers every country present in
// public/military_bases.json plus the major military nations + common aliases,
// so it still works if the bases set is regenerated/expanded.
const NAME_TO_ISO2: Record<string, string> = {
  Afghanistan: "AF",
  Armenia: "AM",
  Azerbaijan: "AZ",
  Bahrain: "BH",
  Bangladesh: "BD",
  Belarus: "BY",
  Bhutan: "BT",
  "British Indian Ocean Territory": "IO",
  Brunei: "BN",
  Bulgaria: "BG",
  Cambodia: "KH",
  China: "CN",
  Cyprus: "CY",
  "Democratic Republic of the Congo": "CD",
  Djibouti: "DJ",
  Egypt: "EG",
  Eritrea: "ER",
  Ethiopia: "ET",
  Georgia: "GE",
  Greece: "GR",
  "Hong Kong S.A.R.": "HK",
  India: "IN",
  Indonesia: "ID",
  Iran: "IR",
  Iraq: "IQ",
  Israel: "IL",
  Japan: "JP",
  Jordan: "JO",
  Kazakhstan: "KZ",
  Kenya: "KE",
  Kuwait: "KW",
  Kyrgyzstan: "KG",
  Lebanon: "LB",
  Malaysia: "MY",
  Moldova: "MD",
  Mongolia: "MN",
  Mozambique: "MZ",
  Myanmar: "MM",
  Nepal: "NP",
  "North Korea": "KP",
  Oman: "OM",
  Pakistan: "PK",
  Palestine: "PS",
  "Papua New Guinea": "PG",
  Philippines: "PH",
  Qatar: "QA",
  Romania: "RO",
  Russia: "RU",
  Rwanda: "RW",
  "Saudi Arabia": "SA",
  Singapore: "SG",
  Somalia: "SO",
  "South Korea": "KR",
  "South Sudan": "SS",
  "Sri Lanka": "LK",
  Sudan: "SD",
  Syria: "SY",
  Taiwan: "TW",
  Tajikistan: "TJ",
  Thailand: "TH",
  Turkey: "TR",
  Turkmenistan: "TM",
  Uganda: "UG",
  Ukraine: "UA",
  "United Arab Emirates": "AE",
  "United Republic of Tanzania": "TZ",
  Uzbekistan: "UZ",
  Vietnam: "VN",
  Yemen: "YE",
  Zambia: "ZM",

  // ---- major military nations + common alt spellings (future-proofing) ----
  "United States": "US",
  "United States of America": "US",
  USA: "US",
  "United Kingdom": "GB",
  UK: "GB",
  France: "FR",
  Germany: "DE",
  Italy: "IT",
  Spain: "ES",
  Poland: "PL",
  Australia: "AU",
  Canada: "CA",
  "South Africa": "ZA",
  Brazil: "BR",
  Nigeria: "NG",
  Algeria: "DZ",
  Libya: "LY",
  Morocco: "MA",
  Tunisia: "TN",
  Sweden: "SE",
  Norway: "NO",
  Finland: "FI",
  Netherlands: "NL",
  Serbia: "RS",
  Croatia: "HR",
  "Russian Federation": "RU",
  "Republic of Korea": "KR",
  Burma: "MM",
  Tanzania: "TZ",
  "Czech Republic": "CZ",
  Czechia: "CZ",
  UAE: "AE",
};

/** ISO-3166 alpha-2 (e.g. "SA") → flag emoji (🇸🇦) via regional indicators. */
export function flagEmoji(iso2: string): string {
  const cc = iso2.toUpperCase().replace(/[^A-Z]/g, "");
  if (cc.length !== 2) return "";
  return cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** Look up a country by name → `{ iso2, emoji }`, or null if unknown. */
export function countryFlag(
  name: string | undefined
): { iso2: string; emoji: string } | null {
  if (!name) return null;
  const iso2 = NAME_TO_ISO2[name.trim()];
  if (!iso2) return null;
  return { iso2, emoji: flagEmoji(iso2) };
}
