/**
 * ui.js — All DOM interactions:
 *   - Checkbox list (render, filter, toggle)
 *   - CSV text input parsing with fuzzy fallback + error modal
 *   - Results: stats table, scatter+sigmoid chart, ROC chart
 */

// gray:   '#6e7681',
// blue:   '#58a6ff',
// purple: '#bc8cff',
// yellow: '#d29922',
// green:  '#3fb950',
// red:    '#f85149'

const UI = (() => {

  const CHART_COLORS = {
    gray:   '#6e7681',
    blue:   '#58a6ff',
    green:  '#3fb950',
    purple: '#bc8cff',
  };

  // ── Chart instances (kept to allow destroy on re-run) ─────────────
  let _scatterChart = null;
  let _rocChart     = null;
  let _modalChart   = null;
  let _toggleHandler = null;
  let _lastResult = null;
  let _modalDefaults = null;
  let _globalHandlersBound = false;
  let _modalWheelBlocker = null;

  // ── Checkbox list ─────────────────────────────────────────────────

  /** Render the full list of country checkboxes. Called once on init. */
  function renderCheckboxList(selectedSet, onToggle) {
    _toggleHandler = onToggle;
    _bindGlobalHandlers();
    _renderOrderedCheckboxes(selectedSet);
  }

  function _bindGlobalHandlers() {
    if (_globalHandlersBound) return;
    _globalHandlersBound = true;

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeChartModal();
    });
  }

  function _renderOrderedCheckboxes(selectedSet) {
    const container = document.getElementById('checkbox-list');
    container.innerHTML = '';

    const selectedRows = [];
    const unselectedRows = [];
    for (const row of Data.HDI_DATA) {
      if (selectedSet.has(row.iso3)) selectedRows.push(row);
      else                           unselectedRows.push(row);
    }

    const orderedRows = [...selectedRows, ...unselectedRows];

    const lang = I18n.getLang();

    for (let index = 0; index < orderedRows.length; index++) {
      const { iso3, hdi, year } = orderedRows[index];
      const displayCountry = Data.getCountryLabel(iso3, lang);
      const label = document.createElement('label');
      label.className = 'cb-item';
      label.dataset.iso3 = iso3;
      label.dataset.name = Data.normalize(displayCountry);

      const number = document.createElement('span');
      number.className = 'cb-idx';
      number.textContent = String(index + 1);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.iso3 = iso3;
      cb.checked = selectedSet.has(iso3);
      cb.addEventListener('change', () => _toggleHandler(iso3, cb.checked));

      const span = document.createElement('span');
      span.className = 'cb-name';
      span.textContent = displayCountry;

      const hdiSpan = document.createElement('span');
      hdiSpan.className = 'cb-hdi';
      hdiSpan.textContent = year ? `${hdi.toFixed(3)} · ${year}` : hdi.toFixed(3);

      label.append(number, cb, span, hdiSpan);
      container.appendChild(label);

      if (selectedRows.length && unselectedRows.length && iso3 === selectedRows[selectedRows.length - 1].iso3) {
        const divider = document.createElement('div');
        divider.className = 'cb-divider';
        container.appendChild(divider);
      }
    }

    document.getElementById('sel-count').textContent = selectedSet.size;

    const searchInput = document.getElementById('cb-search');
    if (searchInput) filterCheckboxes(searchInput.value);
  }

  /** Sync checkbox states to match selectedSet (no full re-render). */
  function syncCheckboxes(selectedSet) {
    _renderOrderedCheckboxes(selectedSet);
  }

  /** Filter visible checkboxes by text. */
  function filterCheckboxes(query) {
    const needle = Data.normalize(query);
    document.querySelectorAll('#checkbox-list .cb-item').forEach(el => {
      el.style.display = (!needle || el.dataset.name.includes(needle)) ? '' : 'none';
    });
    document.querySelectorAll('#checkbox-list .cb-divider').forEach(el => {
      el.style.display = needle ? 'none' : '';
    });
  }

  // ── CSV text input ─────────────────────────────────────────────────

  /**
   * Parse the textarea contents.
   * Splits on comma / semicolon / newline, resolves each token.
   * @param {string} raw
   * @returns {{ resolved: string[], unmatched: string[] }}
   */
  function parseInput(raw) {
    const tokens = raw
      .split(/[,;\n\r]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const resolved  = [];
    const unmatched = [];

    for (const token of tokens) {
      const iso3 = Data.resolve(token);
      if (iso3) {
        if (!resolved.includes(iso3)) resolved.push(iso3);
      } else {
        unmatched.push(token);
      }
    }
    return { resolved, unmatched };
  }

  /** Show inline error box below the textarea. */
  function showParseErrors(unmatched) {
    const box = document.getElementById('parse-errors');
    if (!unmatched.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.textContent = `⚠ ${unmatched.join(' · ')}`;
  }

  // ── Modal ─────────────────────────────────────────────────────────

  function showModal(unmatched) {
    const list = document.getElementById('modal-list');
    list.innerHTML = '';
    for (const token of unmatched) {
      const li = document.createElement('li');
      const suggestion = Data.suggest(token);
      li.textContent = token + (suggestion ? ` → ${suggestion}?` : '');
      list.appendChild(li);
    }
    document.getElementById('modal-suggestions').textContent = I18n.t('modal_suggestions');
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  // ── Results ───────────────────────────────────────────────────────

  function showResults(result) {
    _lastResult = result;
    const section = document.getElementById('results');
    section.classList.remove('hidden');

    _renderStats(result);
    _renderScatter(result);
    _renderROC(result);

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideResults() {
    _lastResult = null;
    document.getElementById('results').classList.add('hidden');
  }

  // Stats table
  function _renderStats(r) {
    const fmt2  = n => n.toFixed(3);
    const fmtP  = n => (n < 0.001 ? '< 0.001' : n.toFixed(3));
    const fmtAuc = n => n.toFixed(3);

    const rows = [
      ['stat_n_selected', r.n1],
      ['stat_n_total',    r.total],
      ['stat_hdi_sel',    fmt2(r.meanHdiSel)],
      ['stat_hdi_nsel',   fmt2(r.meanHdiNsel)],
      ['stat_beta0',      fmt2(r.beta0)],
      ['stat_beta1',      fmt2(r.beta1)],
      ['stat_se',         fmt2(r.se)],
      ['stat_z',          fmt2(r.z)],
      ['stat_pval',       fmtP(r.pValue)],
      ['stat_auc',        fmtAuc(r.auc)],
    ];

    const tbody = document.getElementById('stats-body');
    tbody.innerHTML = '';
    for (const [key, val] of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${I18n.t(key)}</td><td>${val}</td>`;
      tbody.appendChild(tr);
    }

    // Significance row
    const sigTr = document.createElement('tr');
    const sigKey  = r.significant ? 'sig_yes' : 'sig_no';
    const sigClass = r.significant ? 'sig' : 'non-sig';
    sigTr.innerHTML = `<td colspan="2" class="${sigClass}">${I18n.t(sigKey)}</td>`;
    tbody.appendChild(sigTr);

    // Interpretation
    let interpKey;
    if (!r.significant)      interpKey = 'interp_ns';
    else if (r.beta1 > 0)    interpKey = 'interp_pos';
    else                     interpKey = 'interp_neg';

    document.getElementById('stats-interpretation').textContent = I18n.t(interpKey, {
      b1:  r.beta1.toFixed(3),
      p:   fmtP(r.pValue),
      auc: r.auc.toFixed(3),
    });
  }

  // Scatter + sigmoid chart
  function _scatterDatasets(r, pointRadius = 4) {
    const selPoints  = r.samples.filter(s => s.label === 1).map(s => ({ x: s.hdi, y: 1 }));
    const nselPoints = r.samples.filter(s => s.label === 0).map(s => ({ x: s.hdi, y: 0 }));

    // Add slight vertical jitter for readability
    const jitter = pts => pts.map(p => ({ x: p.x, y: p.y + (Math.random() - 0.5) * 0.04 }));

    return [
      {
        label:           I18n.t('chart_scatter_sel'),
        data:            jitter(selPoints),
        backgroundColor: 'rgba(88,166,255,0.72)',
        pointRadius,
        order:           2,
      },
      {
        label:           I18n.t('chart_scatter_nsel'),
        data:            jitter(nselPoints),
        backgroundColor: 'rgba(110,118,129,0.50)',
        pointRadius,
        order:           3,
      },
      {
        label:       I18n.t('chart_sigmoid'),
        data:        r.sigmoidCurve.map(p => ({ x: p.x, y: p.y })),
        type:        'line',
        borderColor: CHART_COLORS.green,
        borderWidth: 2.5,
        pointRadius: 0,
        fill:        false,
        tension:     0.4,
        order:       1,
      },
    ];
  }

  function _renderScatter(r) {
    const ctx = document.getElementById('regression-chart').getContext('2d');
    if (_scatterChart) _scatterChart.destroy();

    _scatterChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: _scatterDatasets(r, 4),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => {
                const d = ctx.raw;
                return `HDI: ${d.x.toFixed(3)}  p: ${d.y.toFixed(3)}`;
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: I18n.t('chart_x') }, min: 0.3, max: 1.0 },
          y: { title: { display: true, text: I18n.t('chart_y') }, min: -0.1, max: 1.1 },
        },
      },
    });
  }

  // ROC curve chart
  function _rocDatasets(r) {
    return [
      {
        label:       `${I18n.t('roc_curve')} (AUC=${r.auc.toFixed(3)})`,
        data:        r.rocCurve.map(p => ({ x: p.fpr, y: p.tpr })),
        borderColor: CHART_COLORS.green,
        borderWidth: 2,
        pointRadius: 0,
        fill:        false,
        tension:     0,
      },
      {
        label:       I18n.t('roc_random'),
        data:        [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        borderColor: CHART_COLORS.gray,
        borderWidth: 1.5,
        borderDash:  [6, 4],
        pointRadius: 0,
        fill:        false,
      },
    ];
  }

  function _renderROC(r) {
    const ctx = document.getElementById('roc-chart').getContext('2d');
    if (_rocChart) _rocChart.destroy();

    _rocChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: _rocDatasets(r),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { type: 'linear', title: { display: true, text: I18n.t('roc_x') }, min: 0, max: 1 },
          y: { type: 'linear', title: { display: true, text: I18n.t('roc_y') }, min: 0, max: 1 },
        },
      },
    });
  }

  function openChartModal(kind) {
    if (!_lastResult) return;

    const overlay = document.getElementById('chart-modal-overlay');
    const titleEl = document.getElementById('chart-modal-title');
    const canvas = document.getElementById('chart-modal-canvas');
    if (!overlay || !titleEl || !canvas) return;

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    _modalWheelBlocker = e => {
      e.preventDefault();
    };
    overlay.addEventListener('wheel', _modalWheelBlocker, { passive: false });

    if (_modalChart) {
      _modalChart.destroy();
      _modalChart = null;
    }

    const ctx = canvas.getContext('2d');
    const isScatter = kind === 'scatter';
    titleEl.textContent = I18n.t(isScatter ? 'chart_modal_scatter' : 'chart_modal_roc');
    _modalDefaults = isScatter
      ? { xMin: 0.3, xMax: 1.0, yMin: -0.1, yMax: 1.1 }
      : { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

    _modalChart = new Chart(ctx, {
      type: isScatter ? 'scatter' : 'line',
      data: {
        datasets: isScatter ? _scatterDatasets(_lastResult, 5) : _rocDatasets(_lastResult),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'top' },
          zoom: {
            zoom: {
              wheel: { enabled: true, speed: 0.08 },
              drag: { enabled: false },
              mode: 'xy',
            },
            pan: {
              enabled: true,
              mode: 'xy',
            },
          },
        },
        scales: isScatter
          ? {
              x: { title: { display: true, text: I18n.t('chart_x') }, min: 0.3, max: 1.0 },
              y: { title: { display: true, text: I18n.t('chart_y') }, min: -0.1, max: 1.1 },
            }
          : {
              x: { type: 'linear', title: { display: true, text: I18n.t('roc_x') }, min: 0, max: 1 },
              y: { type: 'linear', title: { display: true, text: I18n.t('roc_y') }, min: 0, max: 1 },
            },
      },
    });

    canvas.ondblclick = () => {
      if (!_modalChart) return;
      if (typeof _modalChart.resetZoom === 'function') {
        _modalChart.resetZoom();
        return;
      }
      if (_modalDefaults) {
        _modalChart.options.scales.x.min = _modalDefaults.xMin;
        _modalChart.options.scales.x.max = _modalDefaults.xMax;
        _modalChart.options.scales.y.min = _modalDefaults.yMin;
        _modalChart.options.scales.y.max = _modalDefaults.yMax;
        _modalChart.update('none');
      }
    };
  }

  function closeChartModal() {
    const overlay = document.getElementById('chart-modal-overlay');
    const canvas = document.getElementById('chart-modal-canvas');
    if (overlay) overlay.classList.add('hidden');
    if (overlay && _modalWheelBlocker) {
      overlay.removeEventListener('wheel', _modalWheelBlocker);
    }
    _modalWheelBlocker = null;
    document.body.style.overflow = '';
    if (canvas) canvas.ondblclick = null;
    if (_modalChart) {
      _modalChart.destroy();
      _modalChart = null;
    }
    _modalDefaults = null;
  }

  // ── Public API ────────────────────────────────────────────────────
  return {
    renderCheckboxList,
    syncCheckboxes,
    filterCheckboxes,
    parseInput,
    showParseErrors,
    showModal,
    closeModal,
    openChartModal,
    closeChartModal,
    showResults,
    hideResults,
  };
})();
