/**
 * app.js — Main controller. Wires MapView, UI, Regression, and I18n.
 * Exposed as window.App so inline handlers in index.html can call it.
 */
const App = (() => {

  // ── State ─────────────────────────────────────────────────────────
  const _selected = new Set();   // ISO-3 codes currently selected
  let _theme = localStorage.getItem('theme') || 'light';

  // ── Initialisation ────────────────────────────────────────────────
  async function init() {
    try {
      await Data.init();
    } catch (error) {
      alert(`Data loading failed: ${error.message}`);
      return;
    }

    // Render checkbox list
    UI.renderCheckboxList(_selected, _toggleCountry);

    // Wire controls
    document.getElementById('btn-parse').addEventListener(  'click',  _onParseInput);
    document.getElementById('btn-select-all').addEventListener('click', _selectAll);
    document.getElementById('btn-clear').addEventListener(  'click',  _clearAll);
    document.getElementById('btn-invert').addEventListener( 'click',  _invertAll);
    document.getElementById('btn-run').addEventListener(    'click',  _runRegression);
    document.getElementById('cb-search').addEventListener(  'input',  e =>
      UI.filterCheckboxes(e.target.value)
    );

    // Trigger parse when pressing Enter in the textarea
    document.getElementById('country-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _onParseInput(); }
    });

    // Init map (async — fetches GeoJSON)
    try {
      await MapView.init('map', _toggleCountry);
    } catch (error) {
      _setMapUnavailable(error);
    }

    // Apply initial language
    I18n.applyToDOM();
    _applyTheme();
    _renderFooterMeta();
  }

  // ── Country toggle (shared by map clicks and checkboxes) ──────────
  function _toggleCountry(iso3, selected) {
    if (selected) _selected.add(iso3);
    else          _selected.delete(iso3);

    MapView.setSelected(_selected);
    UI.syncCheckboxes(_selected);
    UI.hideResults();
  }

  // ── Parse CSV input ───────────────────────────────────────────────
  function _onParseInput() {
    const raw = document.getElementById('country-input').value;
    const { resolved, unmatched } = UI.parseInput(raw);

    for (const iso3 of resolved) _selected.add(iso3);

    MapView.setSelected(_selected);
    UI.syncCheckboxes(_selected);
    UI.hideResults();
    UI.showParseErrors(unmatched);

    if (unmatched.length) UI.showModal(unmatched);

    // Clear textarea after parsing
    document.getElementById('country-input').value = '';
  }

  // ── Bulk operations ───────────────────────────────────────────────
  function _selectAll() {
    for (const { iso3 } of Data.HDI_DATA) _selected.add(iso3);
    MapView.setSelected(_selected);
    UI.syncCheckboxes(_selected);
    UI.hideResults();
  }

  function _clearAll() {
    _selected.clear();
    MapView.setSelected(_selected);
    UI.syncCheckboxes(_selected);
    UI.hideResults();
    document.getElementById('parse-errors').classList.add('hidden');
  }

  function _invertAll() {
    for (const { iso3 } of Data.HDI_DATA) {
      if (_selected.has(iso3)) _selected.delete(iso3);
      else                     _selected.add(iso3);
    }
    MapView.setSelected(_selected);
    UI.syncCheckboxes(_selected);
    UI.hideResults();
  }

  // ── Regression ────────────────────────────────────────────────────
  function _runRegression() {
    if (_selected.size === 0) return;

    const result = Regression.analyse(_selected);

    if (result.error === 'degenerate') {
      alert(I18n.t('stat_n_selected') + ': 0 or all countries selected — cannot fit model.');
      return;
    }

    UI.showResults(result);
  }

  // ── Language switcher ─────────────────────────────────────────────
  function setLang(lang) {
    I18n.setLang(lang);
    UI.syncCheckboxes(_selected);
    _refreshMapUnavailableText();
    _refreshThemeButton();
    _renderFooterMeta();
  }

  function toggleTheme() {
    _theme = _theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', _theme);
    const button = document.getElementById('btn-theme');
    if (button) {
      button.classList.remove('is-animating');
      void button.offsetWidth;
      button.classList.add('is-animating');
      window.setTimeout(() => button.classList.remove('is-animating'), 280);
    }
    _applyTheme();
  }

  function _applyTheme() {
    document.body.classList.toggle('dark', _theme === 'dark');
    _refreshThemeButton();
  }

  function _refreshThemeButton() {
    const button = document.getElementById('btn-theme');
    if (!button) return;
    const nextModeLabel = _theme === 'dark' ? I18n.t('theme_btn_light') : I18n.t('theme_btn_dark');
    button.setAttribute('title', nextModeLabel);
    button.setAttribute('aria-label', nextModeLabel);
    button.setAttribute('aria-pressed', String(_theme === 'dark'));
  }

  function _renderFooterMeta() {
    const meta = Data.getMeta();
    const generated = meta.generated_at_utc
      ? new Date(meta.generated_at_utc).toLocaleString(I18n.getLang() === 'es' ? 'es-ES' : 'en-GB')
      : I18n.t('footer_unknown');

    const latestYear = meta.latest_year_global ?? I18n.t('footer_unknown');

    const footerData = document.getElementById('footer-data-updated');
    const footerSource = document.getElementById('footer-data-source');
    const footerLatest = document.getElementById('footer-latest-year');
    const footerIdea = document.getElementById('footer-idea-credit');
    const footerApp = document.getElementById('footer-app-updated');

    if (footerData) {
      footerData.textContent = I18n.t('footer_data_updated', { date: generated });
    }
    if (footerLatest) {
      footerLatest.textContent = I18n.t('footer_latest_year', { year: latestYear });
    }
    if (footerSource) {
      footerSource.innerHTML = `${I18n.t('footer_source_prefix')} <a href="${meta.source}" target="_blank" rel="noopener noreferrer">Our World in Data</a>`;
    }
    if (footerIdea) {
      footerIdea.innerHTML = `${I18n.t('footer_idea_prefix')} <a href="https://fantasmamecanico.wordpress.com/" target="_blank" rel="noopener noreferrer">Alejandro Rujano</a>`;
    }
    if (footerApp) {
      footerApp.innerHTML = `${I18n.t('footer_app_prefix')} <a href="https://enheragu.github.io/" target="_blank" rel="noopener noreferrer">enheragu.github.io</a>`;
    }
  }

  function _setMapUnavailable(error) {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    mapEl.innerHTML = `<div class="map-unavailable">${I18n.t('map_unavailable')}</div>`;
    console.warn('Map unavailable:', error);
  }

  function _refreshMapUnavailableText() {
    const marker = document.querySelector('#map .map-unavailable');
    if (!marker) return;
    marker.textContent = I18n.t('map_unavailable');
  }

  // ── Boot ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  return { setLang, toggleTheme };
})();
