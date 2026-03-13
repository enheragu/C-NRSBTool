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
  let _modalKind = null;
  let _toggleHandler = null;
  let _lastResult = null;
  let _modalDefaults = null;
  let _globalHandlersBound = false;
  let _modalTouchResetHandler = null;
  let _modalWheelZoomHandler = null;
  let _modalMouseDownHandler = null;
  let _modalMouseMoveHandler = null;
  let _modalMouseUpHandler = null;
  let _modalTouchStartHandler = null;
  let _modalTouchMoveHandler = null;
  let _zoomPluginRegistered = false;

  function _ensureZoomPluginRegistered() {
    if (_zoomPluginRegistered) return;
    if (typeof Chart === 'undefined' || typeof Chart.register !== 'function') return;
    const plugin = window.ChartZoom || window.chartjsPluginZoom || window['chartjs-plugin-zoom'];
    if (plugin) {
      Chart.register(plugin);
      _zoomPluginRegistered = true;
    }
  }

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
    const sortMode = document.getElementById('cb-sort')?.value || 'name-asc';

    const selectedRows = [];
    const unselectedRows = [];
    const unavailableRows = [...Data.NO_HDI_DATA];
    for (const row of Data.HDI_DATA) {
      if (selectedSet.has(row.iso3)) selectedRows.push(row);
      else                           unselectedRows.push(row);
    }

    _sortRows(selectedRows, sortMode);
    _sortRows(unselectedRows, sortMode);
    _sortRows(unavailableRows, sortMode);

    const orderedRows = [...selectedRows, ...unselectedRows, ...unavailableRows];

    const lang = I18n.getLang();

    for (let index = 0; index < orderedRows.length; index++) {
      const { iso3, hdi, year, noData } = orderedRows[index];
      const displayCountry = Data.getCountryLabel(iso3, lang);
      const label = document.createElement('label');
      label.className = 'cb-item';
      if (noData) label.classList.add('cb-item-disabled');
      label.dataset.iso3 = iso3;
      label.dataset.name = Data.normalize(displayCountry);

      const number = document.createElement('span');
      number.className = 'cb-idx';
      number.textContent = String(index);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.iso3 = iso3;
      cb.checked = !noData && selectedSet.has(iso3);
      cb.disabled = Boolean(noData);
      if (!noData) cb.addEventListener('change', () => _toggleHandler(iso3, cb.checked));

      const span = document.createElement('span');
      span.className = 'cb-name';
      span.textContent = displayCountry;

      const hdiSpan = document.createElement('span');
      hdiSpan.className = 'cb-hdi';
      hdiSpan.textContent = noData
        ? I18n.t('no_hdi_data')
        : (year ? `${hdi.toFixed(3)} · ${year}` : hdi.toFixed(3));

      label.append(number, cb, span, hdiSpan);
      container.appendChild(label);

      if (selectedRows.length && unselectedRows.length && iso3 === selectedRows[selectedRows.length - 1].iso3) {
        const divider = document.createElement('div');
        divider.className = 'cb-divider';
        container.appendChild(divider);
      }

      if (selectedRows.length + unselectedRows.length && unavailableRows.length) {
        const lastSelectableIso = orderedRows[selectedRows.length + unselectedRows.length - 1]?.iso3;
        if (iso3 === lastSelectableIso) {
          const divider = document.createElement('div');
          divider.className = 'cb-divider';
          container.appendChild(divider);
        }
      }
    }

    document.getElementById('sel-count').textContent = selectedSet.size;

    const searchInput = document.getElementById('cb-search');
    if (searchInput) filterCheckboxes(searchInput.value);
  }

  function _sortRows(rows, mode) {
    const getYear = row => Number.isFinite(row.year) ? row.year : Number.NEGATIVE_INFINITY;
    const byNameAsc = (a, b) => String(a.country).localeCompare(String(b.country));

    switch (mode) {
      case 'name-desc':
        rows.sort((a, b) => byNameAsc(b, a));
        break;
      case 'hdi-desc':
        rows.sort((a, b) => (b.hdi - a.hdi) || byNameAsc(a, b));
        break;
      case 'hdi-asc':
        rows.sort((a, b) => (a.hdi - b.hdi) || byNameAsc(a, b));
        break;
      case 'year-desc':
        rows.sort((a, b) => (getYear(b) - getYear(a)) || byNameAsc(a, b));
        break;
      case 'year-asc':
        rows.sort((a, b) => (getYear(a) - getYear(b)) || byNameAsc(a, b));
        break;
      case 'name-asc':
      default:
        rows.sort(byNameAsc);
        break;
    }
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
    const fmtOr = n => (n >= 1000 || n <= 0.001) ? n.toExponential(2) : n.toFixed(3);

    const rows = [
      ['stat_n_selected', r.n1],
      ['stat_n_total',    r.total],
      ['stat_hdi_sel',    fmt2(r.meanHdiSel)],
      ['stat_hdi_nsel',   fmt2(r.meanHdiNsel)],
      ['stat_beta0',      fmt2(r.beta0)],
      ['stat_beta1',      fmt2(r.beta1)],
      ['stat_or',         fmtOr(Math.exp(r.beta1))],
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

  function _chartTheme() {
    const dark = document.body.classList.contains('dark');
    return dark
      ? { text: '#f0f6fc', grid: 'rgba(230, 237, 243, 0.22)' }
      : { text: '#334155', grid: 'rgba(148, 163, 184, 0.28)' };
  }

  function _linearScale(title, min, max) {
    const theme = _chartTheme();
    return {
      type: 'linear',
      title: { display: true, text: title, color: theme.text },
      min,
      max,
      ticks: { color: theme.text },
      grid: { color: theme.grid },
      border: { color: theme.grid },
    };
  }

  // Scatter + sigmoid chart
  function _scatterDatasets(r, pointRadius = 3) {
    const selPoints  = r.samples.filter(s => s.label === 1).map(s => ({
      x: s.hdi,
      y: 1,
      country: s.country,
      iso3: s.iso3,
      selected: true,
    }));
    const nselPoints = r.samples.filter(s => s.label === 0).map(s => ({
      x: s.hdi,
      y: 0,
      country: s.country,
      iso3: s.iso3,
      selected: false,
    }));

    return [
      {
        label:           I18n.t('chart_scatter_sel'),
        data:            selPoints,
        backgroundColor: 'rgba(88,166,255,0.72)',
        pointRadius,
        pointHoverRadius: Math.max(pointRadius + 1, 5),
        pointHitRadius:   0,
        order:           2,
      },
      {
        label:           I18n.t('chart_scatter_nsel'),
        data:            nselPoints,
        backgroundColor: 'rgba(110,118,129,0.50)',
        pointRadius,
        pointHoverRadius: Math.max(pointRadius + 1, 5),
        pointHitRadius:   0,
        order:           3,
      },
      {
        label:       I18n.t('chart_sigmoid'),
        data:        r.sigmoidCurve.map(p => ({ x: p.x, y: p.y })),
        type:        'line',
        borderColor: CHART_COLORS.green,
        borderWidth: 3.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        fill:        false,
        tension:     0.4,
        order:       1,
        tooltipEnabled: false,
      },
      {
        label:       I18n.t('chart_sigmoid'),
        data:        r.sigmoidCurve.map(p => ({ x: p.x, y: p.y })),
        type:        'scatter',
        showLine:    false,
        backgroundColor: 'rgba(0,0,0,0)',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 8,
        order:       4,
        hideFromLegend: true,
        tooltipEnabled: true,
      },
    ];
  }

  function _renderScatter(r) {
    _ensureZoomPluginRegistered();
    const canvasEl = document.getElementById('regression-chart');
    canvasEl.onclick = () => openChartModal('scatter');
    const ctx = canvasEl.getContext('2d');
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
        interaction: {
          mode: 'point',
          intersect: true,
          axis: 'xy',
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: _chartTheme().text,
              filter: (legendItem, data) => !data.datasets[legendItem.datasetIndex]?.hideFromLegend,
            },
          },
          tooltip: {
            filter: ctx => ctx.dataset?.tooltipEnabled !== false,
            callbacks: {
              label: ctx => _formatScatterTooltip(ctx.raw),
            },
          },
        },
        scales: {
          x: _linearScale(I18n.t('chart_x'), 0, 1.0),
          y: _linearScale(I18n.t('chart_y'), -0.06, 1.06),
        },
      },
    });

    const noteEl = document.getElementById('scatter-note');
    if (noteEl) {
      const base = I18n.t('chart_note_scatter');
      const nearLinear = Math.abs(r.beta1) < 2.0;
      noteEl.textContent = nearLinear ? `${base} ${I18n.t('chart_note_near_linear')}` : base;
    }
  }

  // ROC curve chart
  function _rocDatasets(r) {
    return [
      {
        label:       `${I18n.t('roc_curve')} (AUC=${r.auc.toFixed(3)})`,
        data:        r.rocCurve.map(p => ({ x: p.fpr, y: p.tpr, threshold: p.threshold })),
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
    _ensureZoomPluginRegistered();
    const canvasEl = document.getElementById('roc-chart');
    canvasEl.onclick = () => openChartModal('roc');
    const ctx = canvasEl.getContext('2d');
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
        interaction: {
          mode: 'nearest',
          intersect: false,
          axis: 'xy',
        },
        plugins: {
          legend: { position: 'top', labels: { color: _chartTheme().text } },
          tooltip: {
            filter: ctx => ctx.datasetIndex === 0,
            callbacks: {
              label: ctx => _formatRocTooltip(ctx.raw),
            },
          },
        },
        scales: {
          x: _linearScale(I18n.t('roc_x'), 0, 1),
          y: _linearScale(I18n.t('roc_y'), 0, 1),
        },
      },
    });
  }

  function openChartModal(kind) {
    _ensureZoomPluginRegistered();
    if (!_lastResult) return;

    const overlay = document.getElementById('chart-modal-overlay');
    const titleEl = document.getElementById('chart-modal-title');
    const canvas = document.getElementById('chart-modal-canvas');
    if (!overlay || !titleEl || !canvas) return;

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (_modalChart) {
      _modalChart.destroy();
      _modalChart = null;
    }

    const ctx = canvas.getContext('2d');
    const isScatter = kind === 'scatter';
    _modalKind = kind;
    titleEl.textContent = I18n.t(isScatter ? 'chart_modal_scatter' : 'chart_modal_roc');
    _modalDefaults = isScatter
      ? { xMin: 0, xMax: 1.0, yMin: -0.06, yMax: 1.06 }
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
        interaction: isScatter
          ? {
              mode: 'point',
              intersect: true,
              axis: 'xy',
            }
          : {
              mode: 'nearest',
              intersect: false,
              axis: 'xy',
            },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: _chartTheme().text,
              filter: (legendItem, data) => !data.datasets[legendItem.datasetIndex]?.hideFromLegend,
            },
          },
          tooltip: {
            filter: ctx => (isScatter ? (ctx.dataset?.tooltipEnabled !== false) : ctx.datasetIndex === 0),
            callbacks: {
              label: ctx => (isScatter ? _formatScatterTooltip(ctx.raw) : _formatRocTooltip(ctx.raw)),
            },
          },
          zoom: {
            zoom: {
              wheel: { enabled: true, speed: 0.08 },
              pinch: { enabled: true },
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
              x: _linearScale(I18n.t('chart_x'), 0, 1.0),
              y: _linearScale(I18n.t('chart_y'), -0.06, 1.06),
            }
          : {
              x: _linearScale(I18n.t('roc_x'), 0, 1),
              y: _linearScale(I18n.t('roc_y'), 0, 1),
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

    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    _modalTouchResetHandler = e => {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      const now = Date.now();
      const touch = e.changedTouches[0];
      const dt = now - lastTapTime;
      const dx = Math.abs(touch.clientX - lastTapX);
      const dy = Math.abs(touch.clientY - lastTapY);

      if (dt > 0 && dt < 320 && dx < 24 && dy < 24) {
        if (_modalChart && typeof _modalChart.resetZoom === 'function') {
          _modalChart.resetZoom();
        }
        e.preventDefault();
      }

      lastTapTime = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
    };
    canvas.addEventListener('touchend', _modalTouchResetHandler, { passive: false });

    _modalWheelZoomHandler = e => {
      if (!_modalChart) return;
      e.preventDefault();

      const zoomIn = e.deltaY < 0;
      const factor = zoomIn ? 0.9 : 1.1;
      const xScale = _modalChart.scales?.x;
      const yScale = _modalChart.scales?.y;
      if (!xScale || !yScale) return;

      const nextX = _nextScaleRange(xScale, factor, e.offsetX, _modalDefaults?.xMin, _modalDefaults?.xMax);
      const nextY = _nextScaleRange(yScale, factor, e.offsetY, _modalDefaults?.yMin, _modalDefaults?.yMax);

      _modalChart.options.scales.x.min = nextX.min;
      _modalChart.options.scales.x.max = nextX.max;
      _modalChart.options.scales.y.min = nextY.min;
      _modalChart.options.scales.y.max = nextY.max;
      _modalChart.update('none');
    };
    canvas.addEventListener('wheel', _modalWheelZoomHandler, { passive: false });

    let dragActive = false;
    let lastClientX = 0;
    let lastClientY = 0;
    let touchMode = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lastPinchDistance = 0;

    _modalMouseDownHandler = e => {
      if (!_modalChart || e.button !== 0) return;
      dragActive = true;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
    };

    _modalMouseMoveHandler = e => {
      if (!_modalChart || !dragActive) return;
      const dx = e.clientX - lastClientX;
      const dy = e.clientY - lastClientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      const xScale = _modalChart.scales?.x;
      const yScale = _modalChart.scales?.y;
      if (!xScale || !yScale) return;

      const pxLeft = xScale.left;
      const pxRight = xScale.right;
      const pxTop = yScale.top;
      const pxBottom = yScale.bottom;

      const xSpan = Number(xScale.max) - Number(xScale.min);
      const ySpan = Number(yScale.max) - Number(yScale.min);
      const xPxSpan = pxRight - pxLeft;
      const yPxSpan = pxBottom - pxTop;
      if (!(xSpan > 0) || !(ySpan > 0) || !(xPxSpan > 0) || !(yPxSpan > 0)) return;

      const dValX = (-dx / xPxSpan) * xSpan;
      const dValY = (dy / yPxSpan) * ySpan;

      const nextX = _clampedPanRange(
        Number(xScale.min) + dValX,
        Number(xScale.max) + dValX,
        _modalDefaults?.xMin,
        _modalDefaults?.xMax
      );
      const nextY = _clampedPanRange(
        Number(yScale.min) + dValY,
        Number(yScale.max) + dValY,
        _modalDefaults?.yMin,
        _modalDefaults?.yMax
      );

      _modalChart.options.scales.x.min = nextX.min;
      _modalChart.options.scales.x.max = nextX.max;
      _modalChart.options.scales.y.min = nextY.min;
      _modalChart.options.scales.y.max = nextY.max;
      _modalChart.update('none');
      e.preventDefault();
    };

    _modalMouseUpHandler = () => {
      dragActive = false;
      canvas.style.cursor = '';
    };

    canvas.addEventListener('mousedown', _modalMouseDownHandler);
    window.addEventListener('mousemove', _modalMouseMoveHandler);
    window.addEventListener('mouseup', _modalMouseUpHandler);

    _modalTouchStartHandler = e => {
      if (!_modalChart) return;
      if (e.touches.length === 1) {
        touchMode = 'pan';
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length >= 2) {
        touchMode = 'pinch';
        lastPinchDistance = _touchDistance(e.touches[0], e.touches[1]);
      }
    };

    _modalTouchMoveHandler = e => {
      if (!_modalChart) return;
      const xScale = _modalChart.scales?.x;
      const yScale = _modalChart.scales?.y;
      if (!xScale || !yScale) return;

      if (touchMode === 'pan' && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastTouchX;
        const dy = touch.clientY - lastTouchY;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;

        const xSpan = Number(xScale.max) - Number(xScale.min);
        const ySpan = Number(yScale.max) - Number(yScale.min);
        const xPxSpan = xScale.right - xScale.left;
        const yPxSpan = yScale.bottom - yScale.top;
        if (!(xSpan > 0) || !(ySpan > 0) || !(xPxSpan > 0) || !(yPxSpan > 0)) return;

        const dValX = (-dx / xPxSpan) * xSpan;
        const dValY = (dy / yPxSpan) * ySpan;

        const nextX = _clampedPanRange(Number(xScale.min) + dValX, Number(xScale.max) + dValX, _modalDefaults?.xMin, _modalDefaults?.xMax);
        const nextY = _clampedPanRange(Number(yScale.min) + dValY, Number(yScale.max) + dValY, _modalDefaults?.yMin, _modalDefaults?.yMax);

        _modalChart.options.scales.x.min = nextX.min;
        _modalChart.options.scales.x.max = nextX.max;
        _modalChart.options.scales.y.min = nextY.min;
        _modalChart.options.scales.y.max = nextY.max;
        _modalChart.update('none');
        e.preventDefault();
        return;
      }

      if (e.touches.length >= 2) {
        const distance = _touchDistance(e.touches[0], e.touches[1]);
        if (!(distance > 0) || !(lastPinchDistance > 0)) {
          lastPinchDistance = distance;
          return;
        }

        const factor = lastPinchDistance / distance;
        const rect = canvas.getBoundingClientRect();
        const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

        const nextX = _nextScaleRange(xScale, factor, centerX, _modalDefaults?.xMin, _modalDefaults?.xMax);
        const nextY = _nextScaleRange(yScale, factor, centerY, _modalDefaults?.yMin, _modalDefaults?.yMax);

        _modalChart.options.scales.x.min = nextX.min;
        _modalChart.options.scales.x.max = nextX.max;
        _modalChart.options.scales.y.min = nextY.min;
        _modalChart.options.scales.y.max = nextY.max;
        _modalChart.update('none');
        lastPinchDistance = distance;
        touchMode = 'pinch';
        e.preventDefault();
      }
    };

    canvas.addEventListener('touchstart', _modalTouchStartHandler, { passive: false });
    canvas.addEventListener('touchmove', _modalTouchMoveHandler, { passive: false });
  }

  function _touchDistance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  function _clampedPanRange(nextMin, nextMax, clampMin, clampMax) {
    if (!Number.isFinite(nextMin) || !Number.isFinite(nextMax) || nextMax <= nextMin) {
      return { min: nextMin, max: nextMax };
    }
    if (!Number.isFinite(clampMin) || !Number.isFinite(clampMax) || clampMax <= clampMin) {
      return { min: nextMin, max: nextMax };
    }

    const span = nextMax - nextMin;
    const full = clampMax - clampMin;
    if (span >= full) return { min: clampMin, max: clampMax };

    if (nextMin < clampMin) {
      return { min: clampMin, max: clampMin + span };
    }
    if (nextMax > clampMax) {
      return { min: clampMax - span, max: clampMax };
    }
    return { min: nextMin, max: nextMax };
  }

  function _nextScaleRange(scale, factor, pixel, clampMin, clampMax) {
    const min = Number(scale.min);
    const max = Number(scale.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return { min, max };
    }

    const center = Number.isFinite(pixel) ? scale.getValueForPixel(pixel) : ((min + max) / 2);
    const anchor = Number.isFinite(center) ? center : ((min + max) / 2);
    let nextMin = anchor - (anchor - min) * factor;
    let nextMax = anchor + (max - anchor) * factor;

    if (Number.isFinite(clampMin) && Number.isFinite(clampMax)) {
      const full = clampMax - clampMin;
      const span = Math.min(nextMax - nextMin, full);
      if (nextMin < clampMin) {
        nextMin = clampMin;
        nextMax = clampMin + span;
      }
      if (nextMax > clampMax) {
        nextMax = clampMax;
        nextMin = clampMax - span;
      }
      nextMin = Math.max(nextMin, clampMin);
      nextMax = Math.min(nextMax, clampMax);
    }

    return { min: nextMin, max: nextMax };
  }

  function _formatRocTooltip(raw) {
    if (!raw || typeof raw.x !== 'number' || typeof raw.y !== 'number') return '';
    const base = `FPR: ${raw.x.toFixed(3)} · TPR: ${raw.y.toFixed(3)}`;
    if (typeof raw.threshold !== 'number') return base;
    return `${base} · ${I18n.t('roc_threshold')}: ${raw.threshold.toFixed(3)}`;
  }

  function _formatScatterTooltip(raw) {
    if (!raw || typeof raw.x !== 'number' || typeof raw.y !== 'number') return '';
    if (!raw.country) return `${I18n.t('chart_sigmoid')} · HDI: ${raw.x.toFixed(3)} · p: ${raw.y.toFixed(3)}`;
    const status = raw.selected ? I18n.t('chart_scatter_sel') : I18n.t('chart_scatter_nsel');
    return `${raw.country} (${raw.iso3}) — ${status} · HDI: ${raw.x.toFixed(3)} · p: ${raw.y.toFixed(3)}`;
  }

  function closeChartModal() {
    const overlay = document.getElementById('chart-modal-overlay');
    const canvas = document.getElementById('chart-modal-canvas');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
    if (canvas) {
      canvas.ondblclick = null;
      if (_modalTouchResetHandler) {
        canvas.removeEventListener('touchend', _modalTouchResetHandler);
      }
      if (_modalWheelZoomHandler) {
        canvas.removeEventListener('wheel', _modalWheelZoomHandler);
      }
      if (_modalMouseDownHandler) {
        canvas.removeEventListener('mousedown', _modalMouseDownHandler);
      }
      if (_modalTouchStartHandler) {
        canvas.removeEventListener('touchstart', _modalTouchStartHandler);
      }
      if (_modalTouchMoveHandler) {
        canvas.removeEventListener('touchmove', _modalTouchMoveHandler);
      }
    }
    if (_modalMouseMoveHandler) {
      window.removeEventListener('mousemove', _modalMouseMoveHandler);
    }
    if (_modalMouseUpHandler) {
      window.removeEventListener('mouseup', _modalMouseUpHandler);
    }
    _modalTouchResetHandler = null;
    _modalWheelZoomHandler = null;
    _modalMouseDownHandler = null;
    _modalMouseMoveHandler = null;
    _modalMouseUpHandler = null;
    _modalTouchStartHandler = null;
    _modalTouchMoveHandler = null;
    if (_modalChart) {
      _modalChart.destroy();
      _modalChart = null;
    }
    _modalDefaults = null;
    _modalKind = null;
  }

  function refreshCharts() {
    if (!_lastResult) return;
    _renderScatter(_lastResult);
    _renderROC(_lastResult);
    if (_modalKind) {
      openChartModal(_modalKind);
    }
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
    refreshCharts,
  };
})();
