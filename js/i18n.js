/**
 * i18n.js — Bilingual (EN / ES) translation system.
 * Usage: I18n.t('key')  |  I18n.setLang('es')
 */
const I18n = (() => {
  // ── Translations ─────────────────────────────────────────────────
  const TRANSLATIONS = {
    en: {
      page_title:          'C-NRSBTool — HDI Logistic Regression',
      site_title:          'C-NRSBTool',
      site_subtitle:       'Explore whether your country list correlates with the Human Development Index',
      intro_title:         'About this tool',
      intro_text:          "This tool helps researchers detect and quantify selection bias in cross-national studies —it may be used to check whether data availability is systematically related to countries' development levels. Thus, it addresses a widespread but often overlooked methodological problem: assuming missing data is random when it may be actually related to national capacity to collect and report statistics.",
      theme_btn_dark:      'Dark',
      theme_btn_light:     'Light',
      map_title:           'World Map',
      map_hint:            'Click countries to select / deselect',
      map_unavailable:     'Map unavailable right now. You can still select countries from the list or text input.',
      legend_low:          'Low HDI',
      legend_high:         'High HDI',
      legend_selected:     '■ Selected',
      input_title:         'Enter countries in your sample:',
      input_hint:          'Comma-separated names, ISO-2 or ISO-3 codes; or Spanish/English name.',
      input_placeholder:   'Spain, Germany, USA, BRA, …',
      btn_parse:           'Add',
      btn_select_all:      'Select all',
      btn_clear:           'Clear all',
      btn_invert:          'Invert',
      btn_export:          'Export CSV',
      btn_export_json:     'Export JSON',
      sort_label:          'Sort',
      sort_name_asc:       'A–Z',
      sort_name_desc:      'Z–A',
      sort_hdi_desc:       'HDI ↓',
      sort_hdi_asc:        'HDI ↑',
      sort_year_desc:      'Year ↓',
      sort_year_asc:       'Year ↑',
      search_placeholder:  'Filter…',
      countries_selected:  ' countries selected',
      btn_run:             'Run Logistic Regression',
      results_title:       'Results',
      stats_title:         'Model Statistics',
      th_stat:             'Statistic',
      th_value:            'Value',
      chart_title:         'HDI vs Selection Probability',
      chart_note_scatter:  'Points are binary outcomes (0/1); the green line is the fitted logistic probability.',
      chart_note_near_linear:'With a small HDI coefficient, the fitted sigmoid can appear almost linear in this range.',
      roc_title:           'ROC Curve',
      btn_expand_chart:    'Expand',
      chart_modal_scatter: 'HDI vs Selection Probability',
      chart_modal_roc:     'ROC Curve',
      chart_modal_help:    'Inside the chart: wheel/pinch = zoom, drag = pan, double click = reset, Esc = close.',
      stat_n_selected:     'Countries selected (n₁)',
      stat_n_total:        'Total countries (N)',
      stat_hdi_sel:        'Mean HDI — selected',
      stat_hdi_nsel:       'Mean HDI — not selected',
      stat_beta0:          'Intercept (β₀)',
      stat_beta1:          'HDI coefficient (β₁)',
      stat_or:             'Odds ratio (exp(β₁))',
      stat_se:             'Std. error β₁',
      stat_z:              'Z statistic',
      stat_pval:           'p-value',
      stat_auc:            'AUC-ROC',
      sig_yes:             '✔ Significant (p < 0.05)',
      sig_no:              '✘ Not significant (p ≥ 0.05)',
      interp_pos:          'Countries with higher HDI are significantly more likely to appear in your list (β₁ = {b1}, p = {p}). AUC = {auc}.',
      interp_neg:          'Countries with lower HDI are significantly more likely to appear in your list (β₁ = {b1}, p = {p}). AUC = {auc}.',
      interp_ns:           'No statistically significant relationship found between HDI and your list (β₁ = {b1}, p = {p}). AUC = {auc}.',
      modal_title:         'Unrecognised countries',
      modal_intro:         'The following entries could not be matched:',
      modal_suggestions:   'Tip: use ISO-3 codes (e.g. ESP, GBR, DEU) for exact matching.',
      modal_close:         'Close',
      tooltip_hdi:         'HDI: {hdi}',
      tooltip_year:        'Year: {year}',
      no_hdi_data:         'No HDI data',
      footer_unknown:      'Unknown',
      footer_data_updated: 'HDI data last updated: {date}',
      footer_latest_year:  'Latest HDI year in dataset: {year}',
      footer_source_prefix:'Source:',
      footer_app_prefix:   'Author:',
      footer_idea_prefix:  'Idea by:',
      chart_scatter_sel:   'Selected',
      chart_scatter_nsel:  'Not selected',
      chart_sigmoid:       'Sigmoid fit',
      chart_x:             'Human Development Index',
      chart_y:             'P(selected)',
      roc_curve:           'ROC curve',
      roc_random:          'Random classifier',
      roc_threshold:       'Threshold',
      roc_x:               'False Positive Rate',
      roc_y:               'True Positive Rate',
      export_need_selection:'Select at least one country before exporting.',
    },

    es: {
      page_title:          'C-NRSBTool — Regresión Logística con IDH',
      site_title:          'C-NRSBTool',
      site_subtitle:       'Analiza si tu lista de países correlaciona con el Índice de Desarrollo Humano',
      intro_title:         '¿Por qué esta herramienta?',
      intro_text:          'Esta herramienta está pensada para ayudar a investigadores a detectar y cuantificar el sesgo de selección en estudios transnacionales; su objetivo es comprobar si la disponibilidad de los datos está relacionada con los niveles de desarrollo de los países. Así, aborda un problema metodológico generalizado pero a menudo ignorado: asumir que la pérdida de datos es aleatoria cuando puede estar relacionada con la capacidad nacional para reunir y reportar las estadísticas.',
      theme_btn_dark:      'Oscuro',
      theme_btn_light:     'Claro',
      map_title:           'Mapa Mundial',
      map_hint:            'Haz clic en los países para seleccionar / deseleccionar',
      map_unavailable:     'El mapa no está disponible ahora mismo. Puedes seguir seleccionando países desde la lista o el input de texto.',
      legend_low:          'IDH bajo',
      legend_high:         'IDH alto',
      legend_selected:     '■ Seleccionado',
      input_title:         'Introduce países de tu muestra:',
      input_hint:          'Nombres separados por comas, códigos ISO-2 o ISO-3; o nombres en español/inglés.',
      input_placeholder:   'España, Alemania, EE.UU., BRA, …',
      btn_parse:           'Añadir',
      btn_select_all:      'Seleccionar todo',
      btn_clear:           'Borrar todo',
      btn_invert:          'Invertir',
      btn_export:          'Exportar CSV',
      btn_export_json:     'Exportar JSON',
      sort_label:          'Orden',
      sort_name_asc:       'A–Z',
      sort_name_desc:      'Z–A',
      sort_hdi_desc:       'IDH ↓',
      sort_hdi_asc:        'IDH ↑',
      sort_year_desc:      'Año ↓',
      sort_year_asc:       'Año ↑',
      search_placeholder:  'Filtrar…',
      countries_selected:  ' países seleccionados',
      btn_run:             'Ejecutar Regresión Logística',
      results_title:       'Resultados',
      stats_title:         'Estadísticas del Modelo',
      th_stat:             'Estadístico',
      th_value:            'Valor',
      chart_title:         'IDH vs Probabilidad de Selección',
      chart_note_scatter:  'Los puntos son resultados binarios (0/1); la línea verde es la probabilidad logística ajustada.',
      chart_note_near_linear:'Con un coeficiente de IDH pequeño, la sigmoide ajustada puede verse casi lineal en este rango.',
      roc_title:           'Curva ROC',
      btn_expand_chart:    'Ampliar',
      chart_modal_scatter: 'IDH vs Probabilidad de Selección',
      chart_modal_roc:     'Curva ROC',
      chart_modal_help:    'Dentro del gráfico: rueda/pellizco = zoom, arrastrar = mover, doble clic = reset, Esc = cerrar.',
      stat_n_selected:     'Países seleccionados (n₁)',
      stat_n_total:        'Total de países (N)',
      stat_hdi_sel:        'IDH medio — seleccionados',
      stat_hdi_nsel:       'IDH medio — no seleccionados',
      stat_beta0:          'Intercepto (β₀)',
      stat_beta1:          'Coeficiente IDH (β₁)',
      stat_or:             'Odds ratio (exp(β₁))',
      stat_se:             'Error estándar β₁',
      stat_z:              'Estadístico Z',
      stat_pval:           'Valor p',
      stat_auc:            'AUC-ROC',
      sig_yes:             '✔ Significativo (p < 0,05)',
      sig_no:              '✘ No significativo (p ≥ 0,05)',
      interp_pos:          'Los países con mayor IDH tienen significativamente más probabilidades de aparecer en tu lista (β₁ = {b1}, p = {p}). AUC = {auc}.',
      interp_neg:          'Los países con menor IDH tienen significativamente más probabilidades de aparecer en tu lista (β₁ = {b1}, p = {p}). AUC = {auc}.',
      interp_ns:           'No se encontró relación estadísticamente significativa entre el IDH y tu lista (β₁ = {b1}, p = {p}). AUC = {auc}.',
      modal_title:         'Países no reconocidos',
      modal_intro:         'Las siguientes entradas no pudieron identificarse:',
      modal_suggestions:   'Consejo: usa códigos ISO-3 (p. ej. ESP, GBR, DEU) para una coincidencia exacta.',
      modal_close:         'Cerrar',
      tooltip_hdi:         'IDH: {hdi}',
      tooltip_year:        'Año: {year}',
      no_hdi_data:         'Sin datos de IDH',
      footer_unknown:      'Desconocido',
      footer_data_updated: 'Datos de IDH actualizados por última vez: {date}',
      footer_latest_year:  'Último año de IDH en el dataset: {year}',
      footer_source_prefix:'Fuente:',
      footer_app_prefix:   'Autor:',
      footer_idea_prefix:  'Idea de:',
      chart_scatter_sel:   'Seleccionados',
      chart_scatter_nsel:  'No seleccionados',
      chart_sigmoid:       'Ajuste sigmoide',
      chart_x:             'Índice de Desarrollo Humano',
      chart_y:             'P(seleccionado)',
      roc_curve:           'Curva ROC',
      roc_random:          'Clasificador aleatorio',
      roc_threshold:       'Umbral',
      roc_x:               'Tasa de Falsos Positivos',
      roc_y:               'Tasa de Verdaderos Positivos',
      export_need_selection:'Selecciona al menos un país antes de exportar.',
    },
  };

  // ── State ─────────────────────────────────────────────────────────
  let _lang = 'en';

  // ── Public API ────────────────────────────────────────────────────
  function setLang(lang) {
    if (!TRANSLATIONS[lang]) return;
    _lang = lang;
    _applyToDOM();
  }

  function t(key, vars = {}) {
    let str = (TRANSLATIONS[_lang] ?? TRANSLATIONS.en)[key] ?? key;
    // Replace {key} placeholders
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, v);
    }
    return str;
  }

  function getLang() { return _lang; }

  // Apply translations to every [data-i18n] element in the DOM
  function _applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.title = t('page_title');
    // Language button states
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `btn-${_lang}`);
    });
    const switcher = document.querySelector('.lang-switcher');
    if (switcher) {
      switcher.classList.toggle('lang-en', _lang === 'en');
      switcher.classList.toggle('lang-es', _lang === 'es');
    }
  }

  return { setLang, t, getLang, applyToDOM: _applyToDOM };
})();
