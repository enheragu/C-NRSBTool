/**
 * data.js — Runtime data layer
 *
 * - Loads `data/hdi.csv` at startup
 * - Builds HDI indexes by ISO-3
 * - Keeps alias resolver (ISO, EN/ES names, optional extra aliases)
 */
const Data = (() => {
  const HDI_DATA = [];
  const HDI_BY_ISO3 = {};
  const ALIAS_MAP = new Map();
  let _aliasesByIso3 = {};

  let _meta = {
    source: 'https://ourworldindata.org/grapher/human-development-index',
    generated_at_utc: null,
    latest_year_global: null,
    countries: 0,
  };

  function normalize(s) {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function _parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current);
    return values;
  }

  function _buildAliasMap(extraAliasConfig = {}) {
    ALIAS_MAP.clear();

    for (const row of HDI_DATA) {
      const iso3 = row.iso3;
      const country = row.country;

      ALIAS_MAP.set(normalize(iso3), iso3);
      ALIAS_MAP.set(normalize(country), iso3);

      const autoCandidates = [
        country.replace(/\s*\(country\)\s*/i, ''),
        country.replace(/&/g, 'and'),
      ];

      for (const c of autoCandidates) {
        ALIAS_MAP.set(normalize(c), iso3);
      }
    }

    for (const [iso3, aliases] of Object.entries(extraAliasConfig)) {
      const iso = String(iso3 ?? '').trim().toUpperCase();
      if (!iso || !HDI_BY_ISO3[iso]) continue;
      if (!Array.isArray(aliases)) continue;
      for (const alias of aliases) {
        ALIAS_MAP.set(normalize(alias), iso);
      }
    }
  }

  function _candidateKeys(raw) {
    const original = String(raw ?? '').trim();
    if (!original) return [];

    const forms = new Set([original]);
    const articlePattern = '(el|la|los|las|the)';

    const leading = original.match(new RegExp(`^${articlePattern}\\s+(.+)$`, 'i'));
    if (leading) {
      const base = leading[2].trim();
      forms.add(base);
      forms.add(`${base} (${leading[1]})`);
      forms.add(`${base}, ${leading[1]}`);
    }

    const parenthetical = original.match(new RegExp(`^(.+?)\\s*\\(${articlePattern}\\)\\s*$`, 'i'));
    if (parenthetical) {
      const base = parenthetical[1].trim();
      const article = parenthetical[2].trim();
      forms.add(base);
      forms.add(`${article} ${base}`);
      forms.add(`${base}, ${article}`);
    }

    const commaArticle = original.match(new RegExp(`^(.+?),\\s*${articlePattern}\\s*$`, 'i'));
    if (commaArticle) {
      const base = commaArticle[1].trim();
      const article = commaArticle[2].trim();
      forms.add(base);
      forms.add(`${article} ${base}`);
      forms.add(`${base} (${article})`);
    }

    return Array.from(forms)
      .map(normalize)
      .filter(Boolean);
  }

  async function _loadAliasesConfig() {
    try {
      const res = await fetch('data/country_aliases.json');
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  }

  async function _loadMeta() {
    try {
      const res = await fetch('data/metadata.json');
      if (!res.ok) return;
      const json = await res.json();
      _meta = { ..._meta, ...json };
    } catch {
      // keep defaults
    }
  }

  async function init() {
    const res = await fetch('data/hdi.csv');
    if (!res.ok) throw new Error('Unable to load data/hdi.csv');

    const raw = await res.text();
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error('hdi.csv has no data rows');

    const header = _parseCsvLine(lines[0]).map(h => normalize(h));
    const idxCountry = header.indexOf('country');
    const idxIso = header.indexOf('isocode');
    const idxHdi = header.indexOf('humandevelopmentindex');
    const idxYear = header.indexOf('year');

    if (idxCountry < 0 || idxIso < 0 || idxHdi < 0) {
      throw new Error('hdi.csv missing required columns: country, iso_code, human_development_index');
    }

    HDI_DATA.length = 0;
    Object.keys(HDI_BY_ISO3).forEach(k => delete HDI_BY_ISO3[k]);

    for (let i = 1; i < lines.length; i++) {
      const cells = _parseCsvLine(lines[i]);
      const country = (cells[idxCountry] ?? '').trim();
      const iso3 = (cells[idxIso] ?? '').trim().toUpperCase();
      const hdi = Number((cells[idxHdi] ?? '').trim());
      const year = idxYear >= 0 ? Number((cells[idxYear] ?? '').trim()) : NaN;

      if (!country || !iso3 || Number.isNaN(hdi)) continue;
      const row = {
        country,
        iso3,
        hdi,
        year: Number.isFinite(year) ? year : null,
      };
      HDI_DATA.push(row);
      HDI_BY_ISO3[iso3] = row;
    }

    HDI_DATA.sort((a, b) => a.country.localeCompare(b.country));

    const extraAliases = await _loadAliasesConfig();
    _aliasesByIso3 = extraAliases;
    _buildAliasMap(extraAliases);

    await _loadMeta();
    _meta.countries = HDI_DATA.length;
    if (!_meta.latest_year_global) {
      const years = HDI_DATA.map(d => d.year).filter(Number.isFinite);
      _meta.latest_year_global = years.length ? Math.max(...years) : null;
    }
  }

  function resolve(raw) {
    const keys = _candidateKeys(raw);
    if (!keys.length) return null;

    for (const key of keys) {
      if (ALIAS_MAP.has(key)) return ALIAS_MAP.get(key);
    }

    for (const key of keys) {
      if (key.length < 5) continue;
      for (const [alias, iso3] of ALIAS_MAP.entries()) {
        if (alias.length >= 5 && alias.startsWith(key)) return iso3;
      }
    }
    return null;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function suggest(raw) {
    const key = normalize(raw);
    if (!key) return null;

    let bestIso = null;
    let bestDist = Number.POSITIVE_INFINITY;
    let bestAliasLength = 0;

    for (const [alias, iso3] of ALIAS_MAP.entries()) {
      if (alias.length < 4) continue;
      const dist = levenshtein(key, alias);
      const maxLen = Math.max(key.length, alias.length);
      const threshold = Math.max(1, Math.floor(maxLen * 0.34));
      if (dist > threshold) continue;

      if (dist < bestDist || (dist === bestDist && alias.length > bestAliasLength)) {
        bestDist = dist;
        bestIso = iso3;
        bestAliasLength = alias.length;
      }
    }

    return bestIso ? (HDI_BY_ISO3[bestIso]?.country ?? null) : null;
  }

  function getMeta() {
    return _meta;
  }

  function _looksSpanish(text) {
    const raw = String(text ?? '');
    if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(raw)) return true;
    const n = normalize(raw);
    return /(espana|alemania|francia|italia|japon|mexico|argentina|colombia|peru|chile|uruguay|venezuela|ecuador|bolivia|paraguay|republica|reino|estado|santa|san|islas|arab|corea|rusia|turquia|paisesbajos|guineaecuatorial|sudafrica|suiza|suecia|noruega|finlandia|dinamarca|austria|belgica)/.test(n);
  }

  function getCountryLabel(iso3, lang = 'en') {
    const row = HDI_BY_ISO3[iso3];
    if (!row) return iso3;
    if (lang !== 'es') return row.country;

    const aliases = Array.isArray(_aliasesByIso3?.[iso3]) ? _aliasesByIso3[iso3] : [];
    const englishNorm = normalize(row.country);

    for (const alias of aliases) {
      if (!alias) continue;
      if (normalize(alias) === englishNorm) continue;
      if (_looksSpanish(alias)) return alias;
    }

    return row.country;
  }

  return {
    HDI_DATA,
    HDI_BY_ISO3,
    normalize,
    init,
    resolve,
    suggest,
    getMeta,
    getCountryLabel,
  };
})();
