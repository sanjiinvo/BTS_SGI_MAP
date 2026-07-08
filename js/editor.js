const MapEditor = (() => {
  let enabled = false;
  let mode = 'point';
  let svg = null;
  let mapContainer = null;
  let selectedColor = '#00d4ff';
  let selectedWidth = 7;
  let pendingPoint = null;
  let linePoints = [];
  let editingProjectId = null;
  let tempLayer = null;
  let onProjectsChangedCallback = null;

  const elements = {};
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function init(svgElement, containerElement, options = {}) {
    svg = svgElement;
    mapContainer = containerElement;
    onProjectsChangedCallback = options.onProjectsChanged || null;
    createToolbarButton();
    createPanel();
    ensureTempLayer();
    bindEvents();
  }

  function createToolbarButton() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('editor-toggle')) return;

    const btn = document.createElement('button');
    btn.id = 'editor-toggle';
    btn.className = 'editor-toggle';
    btn.title = 'Редактор точек и линий';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>Редактор</span>
    `;
    headerRight.insertBefore(btn, headerRight.firstChild);
    elements.toggle = btn;
  }

  function createPanel() {
    if (document.getElementById('editor-panel')) return;

    const panel = document.createElement('aside');
    panel.id = 'editor-panel';
    panel.className = 'editor-panel hidden';
    panel.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Редактор объектов</h2>
          <p>Ставь точки или трассируй участки железной дороги ломаной линией.</p>
        </div>
        <button id="editor-close" class="editor-icon-btn" title="Закрыть">×</button>
      </div>

      <div class="editor-body">
        <div class="editor-row editor-status-row">
          <span id="editor-mode-badge" class="editor-badge off">Режим выключен</span>
          <span id="editor-coords">x: —, y: —</span>
        </div>

        <div class="editor-mode-switch">
          <button id="editor-mode-point" class="editor-mode-btn active" type="button">Точка</button>
          <button id="editor-mode-label" class="editor-mode-btn" type="button">Метка</button>
          <button id="editor-mode-line" class="editor-mode-btn" type="button">Линия</button>
        </div>

        <label class="editor-field">
          <span>Цвет объекта</span>
          <div class="editor-color-row">
            <input id="editor-color" type="color" value="#00d4ff">
            <button class="editor-color-preset" data-color="#00d4ff" style="--preset:#00d4ff"></button>
            <button class="editor-color-preset" data-color="#00c853" style="--preset:#00c853"></button>
            <button class="editor-color-preset" data-color="#ffc107" style="--preset:#ffc107"></button>
            <button class="editor-color-preset" data-color="#ff5252" style="--preset:#ff5252"></button>
            <button class="editor-color-preset" data-color="#9c27b0" style="--preset:#9c27b0"></button>
          </div>
        </label>

        <label class="editor-field editor-line-width-field">
          <span>Толщина линии</span>
          <input id="editor-line-width" type="range" min="3" max="16" value="7">
        </label>

        <label class="editor-field">
          <span>Слой (z-index) — чем больше, тем выше объект отрисуется поверх других</span>
          <div class="editor-zindex-row">
            <button id="editor-zindex-down" type="button" class="editor-icon-btn" title="На задний план">−</button>
            <input id="editor-zindex" type="number" step="1" value="0">
            <button id="editor-zindex-up" type="button" class="editor-icon-btn" title="На передний план">+</button>
          </div>
        </label>

        <div class="editor-grid editor-line-endpoint-fields">
          <label class="editor-field">
            <span>Начальная точка RU</span>
            <input id="editor-line-start-name" type="text" placeholder="Например: Астана">
          </label>
          <label class="editor-field">
            <span>Конечная точка RU</span>
            <input id="editor-line-end-name" type="text" placeholder="Например: Караганда">
          </label>
          <label class="editor-field">
            <span>Начальная точка EN</span>
            <input id="editor-line-start-name-en" type="text" placeholder="Astana">
          </label>
          <label class="editor-field">
            <span>Конечная точка EN</span>
            <input id="editor-line-end-name-en" type="text" placeholder="Karaganda">
          </label>
          <label class="editor-field">
            <span>Начальная точка KZ</span>
            <input id="editor-line-start-name-kk" type="text" placeholder="Астана">
          </label>
          <label class="editor-field">
            <span>Конечная точка KZ</span>
            <input id="editor-line-end-name-kk" type="text" placeholder="Қарағанды">
          </label>
        </div>

        <label class="editor-field">
          <span>Проект RU</span>
          <input id="editor-title" type="text" placeholder="Например: Модернизация участка Астана — Караганда">
        </label>
        <div class="editor-grid">
          <label class="editor-field">
            <span>Проект EN</span>
            <input id="editor-title-en" type="text" placeholder="Astana — Karaganda section upgrade">
          </label>
          <label class="editor-field">
            <span>Проект KZ</span>
            <input id="editor-title-kk" type="text" placeholder="Астана — Қарағанды учаскесін жаңғырту">
          </label>
        </div>

        <label class="editor-field">
          <span>Отрезок RU (два названия через тире для линии, одно — для точки)</span>
          <input id="editor-segment" type="text" placeholder="Например: Астана — Караганда, либо просто Алматы">
        </label>
        <div class="editor-grid">
          <label class="editor-field">
            <span>Отрезок EN</span>
            <input id="editor-segment-en" type="text" placeholder="Astana — Karaganda">
          </label>
          <label class="editor-field">
            <span>Отрезок KZ</span>
            <input id="editor-segment-kk" type="text" placeholder="Астана — Қарағанды">
          </label>
        </div>

        <label class="editor-field">
          <span>Вид работ RU</span>
          <input id="editor-work-type" type="text" placeholder="Например: Строительно-монтажные работы">
        </label>
        <div class="editor-grid">
          <label class="editor-field">
            <span>Вид работ EN</span>
            <input id="editor-work-type-en" type="text" placeholder="Construction and installation works">
          </label>
          <label class="editor-field">
            <span>Вид работ KZ</span>
            <input id="editor-work-type-kk" type="text" placeholder="Құрылыс-монтаж жұмыстары">
          </label>
        </div>

        <div class="editor-grid">
          <label class="editor-field">
            <span>Статус</span>
            <select id="editor-status"></select>
          </label>
          <label class="editor-field">
            <span>Сроки реализации RU</span>
            <input id="editor-period" type="text" placeholder="Например: 2023 или 2023-2025">
          </label>
        </div>
        <div class="editor-grid">
          <label class="editor-field">
            <span>Сроки реализации EN</span>
            <input id="editor-period-en" type="text" placeholder="2023 or 2023-2025">
          </label>
          <label class="editor-field">
            <span>Сроки реализации KZ</span>
            <input id="editor-period-kk" type="text" placeholder="2023 немесе 2023-2025">
          </label>
        </div>

        <div class="editor-grid" style="display:none;">
          <select id="editor-region"></select>
        </div>

        <label class="editor-field">
          <span>Краткое описание выполненных работ RU</span>
          <textarea id="editor-description" rows="3" placeholder="Кратко опиши, что было выполнено"></textarea>
        </label>
        <div class="editor-grid">
          <label class="editor-field">
            <span>Описание EN</span>
            <textarea id="editor-description-en" rows="3" placeholder="Briefly describe completed works"></textarea>
          </label>
          <label class="editor-field">
            <span>Описание KZ</span>
            <textarea id="editor-description-kk" rows="3" placeholder="Орындалған жұмыстарды қысқаша сипатта"></textarea>
          </label>
        </div>

        <label class="editor-field">
          <span>Объем работ RU</span>
          <input id="editor-volume" type="text" placeholder="Например: 12 км кабеля, 4 станции, 36 шкафов">
        </label>
        <div class="editor-grid">
          <label class="editor-field">
            <span>Объем работ EN</span>
            <input id="editor-volume-en" type="text" placeholder="12 km of cable, 4 stations, 36 cabinets">
          </label>
          <label class="editor-field">
            <span>Объем работ KZ</span>
            <input id="editor-volume-kk" type="text" placeholder="12 км кабель, 4 станция, 36 шкаф">
          </label>
        </div>

        <div class="editor-line-tools">
          <div id="editor-line-count" class="editor-line-count">Точек линии: 0</div>
          <div class="editor-actions">
            <button id="editor-line-undo" class="editor-secondary" disabled>Убрать узел</button>
            <button id="editor-line-clear" class="editor-secondary" disabled>Очистить</button>
          </div>
        </div>

        <div class="editor-actions">
          <button id="editor-save" class="editor-primary" disabled>Сохранить точку</button>
          <button id="editor-cancel" class="editor-secondary" disabled>Отмена</button>
        </div>
        <button id="editor-delete" class="editor-danger hidden" type="button">Удалить объект</button>

        <div class="editor-divider"></div>

        <div class="editor-actions vertical">
          <button id="editor-export" class="editor-secondary">Экспорт projects.json</button>
          <button id="editor-copy" class="editor-secondary">Скопировать JSON</button>
        </div>

        <p class="editor-hint" id="editor-hint">
          Точка: включи режим, выбери цвет и нажми по карте. Линия: нажимай вдоль железной дороги, каждый tap добавляет узел, затем нажми «Сохранить линию».
        </p>
      </div>
    `;

    document.getElementById('app').appendChild(panel);

    elements.panel = panel;
    elements.close = panel.querySelector('#editor-close');
    elements.badge = panel.querySelector('#editor-mode-badge');
    elements.coords = panel.querySelector('#editor-coords');
    elements.modePoint = panel.querySelector('#editor-mode-point');
    elements.modeLabel = panel.querySelector('#editor-mode-label');
    elements.modeLine = panel.querySelector('#editor-mode-line');
    elements.color = panel.querySelector('#editor-color');
    elements.zIndex = panel.querySelector('#editor-zindex');
    elements.zIndexUp = panel.querySelector('#editor-zindex-up');
    elements.zIndexDown = panel.querySelector('#editor-zindex-down');
    elements.lineWidth = panel.querySelector('#editor-line-width');
    elements.lineWidthField = panel.querySelector('.editor-line-width-field');
    elements.lineEndpointFields = panel.querySelector('.editor-line-endpoint-fields');
    elements.lineStartName = panel.querySelector('#editor-line-start-name');
    elements.lineEndName = panel.querySelector('#editor-line-end-name');
    elements.lineStartNameEn = panel.querySelector('#editor-line-start-name-en');
    elements.lineEndNameEn = panel.querySelector('#editor-line-end-name-en');
    elements.lineStartNameKk = panel.querySelector('#editor-line-start-name-kk');
    elements.lineEndNameKk = panel.querySelector('#editor-line-end-name-kk');
    elements.title = panel.querySelector('#editor-title');
    elements.titleEn = panel.querySelector('#editor-title-en');
    elements.titleKk = panel.querySelector('#editor-title-kk');
    elements.segment = panel.querySelector('#editor-segment');
    elements.segmentEn = panel.querySelector('#editor-segment-en');
    elements.segmentKk = panel.querySelector('#editor-segment-kk');
    elements.workType = panel.querySelector('#editor-work-type');
    elements.workTypeEn = panel.querySelector('#editor-work-type-en');
    elements.workTypeKk = panel.querySelector('#editor-work-type-kk');
    elements.region = panel.querySelector('#editor-region');
    elements.status = panel.querySelector('#editor-status');
    elements.period = panel.querySelector('#editor-period');
    elements.periodEn = panel.querySelector('#editor-period-en');
    elements.periodKk = panel.querySelector('#editor-period-kk');
    elements.description = panel.querySelector('#editor-description');
    elements.descriptionEn = panel.querySelector('#editor-description-en');
    elements.descriptionKk = panel.querySelector('#editor-description-kk');
    elements.volume = panel.querySelector('#editor-volume');
    elements.volumeEn = panel.querySelector('#editor-volume-en');
    elements.volumeKk = panel.querySelector('#editor-volume-kk');
    elements.lineTools = panel.querySelector('.editor-line-tools');
    elements.lineCount = panel.querySelector('#editor-line-count');
    elements.lineUndo = panel.querySelector('#editor-line-undo');
    elements.lineClear = panel.querySelector('#editor-line-clear');
    elements.save = panel.querySelector('#editor-save');
    elements.cancel = panel.querySelector('#editor-cancel');
    elements.delete = panel.querySelector('#editor-delete');
    elements.export = panel.querySelector('#editor-export');
    elements.copy = panel.querySelector('#editor-copy');
    elements.hint = panel.querySelector('#editor-hint');

    populateSelects();
    updateModeUI();
  }

  function populateSelects() {
    fillSelect(elements.region, DataLoader.getRegions(), 'region');
    fillSelect(elements.status, DataLoader.getStatuses(), 'status');
  }

  function fillSelect(select, items, type) {
    select.innerHTML = '';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = I18n.tr(item);
      select.appendChild(opt);
    });

    if (type === 'status') select.value = 'completed';
    if (type === 'region') select.value = items[0]?.id || '';
  }

  function localizedValue(ruEl, enEl, kkEl, fallback = '') {
    const ru = ruEl?.value.trim() || '';
    const en = enEl?.value.trim() || '';
    const kk = kkEl?.value.trim() || '';
    const hasAny = !!(ru || en || kk);
    return { ru: hasAny ? ru : fallback, en, kk };
  }

  function setLocalizedValue(ruEl, enEl, kkEl, value) {
    const obj = typeof value === 'object' && value ? value : { ru: value || '' };
    if (ruEl) ruEl.value = obj.ru || '';
    if (enEl) enEl.value = obj.en || '';
    if (kkEl) kkEl.value = obj.kk || '';
  }

  function setFieldVisible(input, visible) {
    input?.closest?.('.editor-field')?.style.setProperty('display', visible ? '' : 'none');
  }

  function bindEvents() {
    elements.toggle.addEventListener('click', onToggleClick);
    elements.close.addEventListener('click', closePanel);
    elements.modePoint.addEventListener('click', () => setMode('point'));
    elements.modeLabel.addEventListener('click', () => setMode('label'));
    elements.modeLine.addEventListener('click', () => setMode('line'));

    elements.color.addEventListener('input', (e) => {
      selectedColor = e.target.value;
      renderDraft();
    });

    elements.lineWidth.addEventListener('input', (e) => {
      selectedWidth = Number(e.target.value) || 7;
      renderDraft();
    });

    elements.zIndexUp.addEventListener('click', () => {
      elements.zIndex.value = (Number(elements.zIndex.value) || 0) + 1;
    });
    elements.zIndexDown.addEventListener('click', () => {
      elements.zIndex.value = (Number(elements.zIndex.value) || 0) - 1;
    });

    document.querySelectorAll('.editor-color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        elements.color.value = selectedColor;
        renderDraft();
      });
    });

    elements.save.addEventListener('click', savePendingObject);
    elements.cancel.addEventListener('click', clearDraft);
    elements.delete.addEventListener('click', deleteEditingProject);
    elements.lineUndo.addEventListener('click', undoLinePoint);
    elements.lineClear.addEventListener('click', clearLinePoints);
    elements.export.addEventListener('click', downloadJson);
    elements.copy.addEventListener('click', copyJson);
  }

  function toggle() { enabled ? disable() : enable(); }

  // If a project card is currently open (e.g. the user just picked it from
  // the "Показано проектов" list), jump straight into editing that exact
  // object instead of a blank editor - this is the only reliable way to
  // select a project whose line overlaps another one on the map.
  function onToggleClick() {
    if (enabled) {
      disable();
      return;
    }
    const currentId = (typeof ProjectCard !== 'undefined') ? ProjectCard.getCurrentProjectId() : null;
    if (currentId) editProject(currentId);
    else enable();
  }

  function enable() {
    enabled = true;
    elements.panel.classList.remove('hidden');
    elements.toggle.classList.add('active');
    elements.badge.textContent = 'Режим включен';
    elements.badge.classList.remove('off');
    elements.badge.classList.add('on');
    mapContainer.classList.add('editor-active');
    updateModeUI();
  }

  function disable() {
    enabled = false;
    clearDraft();
    elements.toggle.classList.remove('active');
    elements.badge.textContent = 'Режим выключен';
    elements.badge.classList.remove('on');
    elements.badge.classList.add('off');
    mapContainer.classList.remove('editor-active');
  }

  function closePanel() {
    elements.panel.classList.add('hidden');
    disable();
  }

  function isEnabled() { return enabled; }

  function setMode(nextMode) {
    if (mode === nextMode) return;
    clearDraft();
    mode = nextMode;
    updateModeUI();
  }

  function updateModeUI() {
    elements.modePoint.classList.toggle('active', mode === 'point');
    elements.modeLabel.classList.toggle('active', mode === 'label');
    elements.modeLine.classList.toggle('active', mode === 'line');
    elements.lineTools.style.display = mode === 'line' ? '' : 'none';
    elements.lineWidthField.style.display = mode === 'line' ? '' : 'none';
    elements.lineEndpointFields.style.display = mode === 'line' ? '' : 'none';
    [
      elements.workType,
      elements.workTypeEn,
      elements.workTypeKk,
      elements.period,
      elements.periodEn,
      elements.periodKk,
      elements.description,
      elements.descriptionEn,
      elements.descriptionKk,
      elements.volume,
      elements.volumeEn,
      elements.volumeKk
    ].forEach(input => setFieldVisible(input, mode !== 'label'));
    elements.status.closest('.editor-field').style.display = mode === 'label' ? 'none' : '';
    elements.title.closest('.editor-field').querySelector('span').textContent = mode === 'label' ? 'Название метки RU' : 'Проект RU';
    elements.save.textContent = editingProjectId
      ? 'Сохранить изменения'
      : mode === 'line'
        ? 'Сохранить линию'
        : mode === 'label'
          ? 'Сохранить метку'
          : 'Сохранить точку';
    elements.hint.textContent = mode === 'line'
      ? 'Линия: первая и последняя точки станут городскими узлами. Укажи названия начала и конца.'
      : mode === 'label'
        ? 'Метка: нажми по карте и подпиши город или место. В обычном режиме карточка не открывается.'
        : 'Точка: нажми по пустому месту карты, заполни данные и сохрани объект.';
    refreshActions();
  }

  function ensureTempLayer() {
    if (!svg) return null;
    let layer = svg.querySelector('#editor-temp-layer');
    if (!layer) {
      layer = document.createElementNS(SVG_NS, 'g');
      layer.setAttribute('id', 'editor-temp-layer');
      layer.setAttribute('pointer-events', 'none');
      svg.appendChild(layer);
    }
    tempLayer = layer;
    return layer;
  }

  function handleMapTap(payload) {
    if (!enabled || !payload?.svgPoint) return;
    const target = payload.originalEvent?.target;
    if (target?.closest?.('.map-object, .map-marker, .map-line')) return;

    const x = Math.round(payload.svgPoint.x * 10) / 10;
    const y = Math.round(payload.svgPoint.y * 10) / 10;
    elements.coords.textContent = `x: ${x}, y: ${y}`;

    if (mode === 'line') {
      addLinePoint(x, y);
    } else {
      setPendingPoint(x, y);
    }
  }

  function setPendingPoint(x, y) {
    pendingPoint = { x, y };
    linePoints = [];
    prefillDefaults('point');
    renderDraft();
    refreshActions();
  }

  function addLinePoint(x, y) {
    pendingPoint = null;
    linePoints.push([x, y]);
    if (linePoints.length === 1) prefillDefaults('line');
    renderDraft();
    refreshActions();
  }

  function prefillDefaults(type) {
    const n = DataLoader.getProjects().length + 1;
    if (!elements.title.value.trim()) {
      elements.title.value = type === 'line' ? `Участок ${n}` : `Проект ${n}`;
    }
    if (!elements.description.value.trim()) elements.description.value = '';
    if (!elements.period.value.trim()) elements.period.value = String(new Date().getFullYear());
  }

  function renderDraft() {
    clearTempLayer();
    ensureTempLayer();
    if (!tempLayer) return;

    if (mode === 'line') {
      renderTempLine();
    } else if (mode === 'label' && pendingPoint) {
      renderTempLabel(pendingPoint.x, pendingPoint.y);
    } else if (pendingPoint) {
      renderTempPoint(pendingPoint.x, pendingPoint.y);
    }
  }

  function renderTempPoint(x, y) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'map-marker editor-temp-marker marker-pulsing active-pulse');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('class', 'map-marker-ring');
    ring.setAttribute('r', '13');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', 'map-marker-circle');
    circle.setAttribute('r', '9');
    circle.setAttribute('fill', selectedColor);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'marker-dot');
    dot.setAttribute('r', '3.5');

    g.appendChild(ring);
    g.appendChild(circle);
    g.appendChild(dot);
    tempLayer.appendChild(g);
  }

  function renderTempLabel(x, y) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'map-label-point editor-temp-marker label-active');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('class', 'map-label-ring');
    ring.setAttribute('r', '9');
    ring.setAttribute('fill', '#ffffff');
    ring.setAttribute('stroke', selectedColor);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'map-label-dot');
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', selectedColor);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'map-label-text');
    label.setAttribute('x', '14');
    label.setAttribute('y', '-10');
    label.textContent = I18n.tr(localizedValue(elements.title, elements.titleEn, elements.titleKk, 'Метка'));

    g.appendChild(ring);
    g.appendChild(dot);
    g.appendChild(label);
    tempLayer.appendChild(g);
  }

  function renderTempLine() {
    elements.lineCount.textContent = `Точек линии: ${linePoints.length}`;
    if (linePoints.length === 0) return;

    if (linePoints.length >= 2) {
      const pointString = linePoints.map(p => `${p[0]},${p[1]}`).join(' ');
      const glow = document.createElementNS(SVG_NS, 'polyline');
      glow.setAttribute('class', 'editor-temp-line-glow');
      glow.setAttribute('points', pointString);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', selectedColor);
      glow.setAttribute('stroke-width', String(selectedWidth + 8));
      glow.setAttribute('stroke-linecap', 'round');
      glow.setAttribute('stroke-linejoin', 'round');
      glow.setAttribute('opacity', '0.22');

      const line = document.createElementNS(SVG_NS, 'polyline');
      line.setAttribute('class', 'editor-temp-line');
      line.setAttribute('points', pointString);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', selectedColor);
      line.setAttribute('stroke-width', String(selectedWidth));
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-linejoin', 'round');

      tempLayer.appendChild(glow);
      tempLayer.appendChild(line);
    }

    linePoints.forEach((point, index) => {
      const node = document.createElementNS(SVG_NS, 'circle');
      node.setAttribute('class', 'editor-line-node');
      node.setAttribute('cx', point[0]);
      node.setAttribute('cy', point[1]);
      node.setAttribute('r', index === linePoints.length - 1 ? '8' : '6');
      node.setAttribute('fill', selectedColor);
      tempLayer.appendChild(node);
    });
  }

  function clearTempLayer() {
    if (tempLayer) tempLayer.innerHTML = '';
  }

  function clearDraft() {
    pendingPoint = null;
    linePoints = [];
    editingProjectId = null;
    clearTempLayer();
    elements.coords.textContent = 'x: —, y: —';
    elements.lineCount.textContent = 'Точек линии: 0';
    elements.lineStartName.value = '';
    elements.lineEndName.value = '';
    elements.lineStartNameEn.value = '';
    elements.lineEndNameEn.value = '';
    elements.lineStartNameKk.value = '';
    elements.lineEndNameKk.value = '';
    elements.zIndex.value = 0;
    elements.segment.value = '';
    elements.segmentEn.value = '';
    elements.segmentKk.value = '';
    elements.delete.classList.add('hidden');
    refreshActions();
  }

  function clearLinePoints() {
    linePoints = [];
    clearTempLayer();
    elements.coords.textContent = 'x: —, y: —';
    elements.lineCount.textContent = 'Точек линии: 0';
    refreshActions();
  }

  function undoLinePoint() {
    linePoints.pop();
    renderDraft();
    refreshActions();
  }

  function refreshActions() {
    const canSavePoint = mode === 'point' && !!pendingPoint;
    const canSaveLabel = mode === 'label' && !!pendingPoint;
    const canSaveLine = mode === 'line' && linePoints.length >= 2;
    const canCancel = !!pendingPoint || linePoints.length > 0;
    const canSaveEdit = !!editingProjectId;
    elements.save.disabled = !(canSavePoint || canSaveLabel || canSaveLine || canSaveEdit);
    elements.cancel.disabled = !canCancel;
    elements.lineUndo.disabled = linePoints.length === 0;
    elements.lineClear.disabled = linePoints.length === 0;
    elements.lineCount.textContent = `Точек линии: ${linePoints.length}`;
  }

  function savePendingObject() {
    if (editingProjectId) saveEditingProject();
    else if (mode === 'line') savePendingLine();
    else if (mode === 'label') savePendingLabel();
    else savePendingPoint();
  }

  function savePendingPoint() {
    if (!pendingPoint) return;
    const project = buildBaseProject('point');
    project.x = pendingPoint.x;
    project.y = pendingPoint.y;

    DataLoader.addProject(project);
    afterSave(project);
  }

  function savePendingLine() {
    if (linePoints.length < 2) return;
    const project = buildBaseProject('line');
    project.points = linePoints.map(p => [Number(p[0]), Number(p[1])]);
    project.width = selectedWidth;
    project.hitWidth = Math.max(34, selectedWidth + 30);
    project.endpoints = buildLineEndpoints();

    DataLoader.addProject(project);
    afterSave(project);
  }

  function savePendingLabel() {
    if (!pendingPoint) return;
    const project = buildLabelProject();
    project.x = pendingPoint.x;
    project.y = pendingPoint.y;

    DataLoader.addProject(project);
    afterSave(project);
  }

  // If the user left the "Отрезок" field blank, derive a sensible default:
  // for a line, the start/end names typed in just above; for a point/label,
  // its own title (a single name is exactly "точка на карте" per the spec).
  function computeDefaultSegment(type, title) {
    if (type === 'line') {
      const start = elements.lineStartName.value.trim();
      const end = elements.lineEndName.value.trim();
      if (start && end) return { ru: `${start} — ${end}`, en: '', kk: '' };
    }
    return title;
  }

  function resolveSegment(type, title) {
    const segmentInput = localizedValue(elements.segment, elements.segmentEn, elements.segmentKk, '');
    return I18n.tr(segmentInput) ? segmentInput : computeDefaultSegment(type, title);
  }

  function buildBaseProject(type) {
    const fallbackTitle = type === 'line' ? `Участок ${DataLoader.getProjects().length + 1}` : `Проект ${DataLoader.getProjects().length + 1}`;
    const title = localizedValue(elements.title, elements.titleEn, elements.titleKk, fallbackTitle);
    const workType = localizedValue(elements.workType, elements.workTypeEn, elements.workTypeKk, 'Вид работ не указан');
    const period = localizedValue(elements.period, elements.periodEn, elements.periodKk, String(new Date().getFullYear()));
    const volume = localizedValue(elements.volume, elements.volumeEn, elements.volumeKk, '');
    const description = localizedValue(elements.description, elements.descriptionEn, elements.descriptionKk, 'Описание выполненных работ будет добавлено позже.');

    return {
      id: makeId(I18n.tr(title)),
      type,
      color: selectedColor,
      zIndex: Number(elements.zIndex.value) || 0,
      region: elements.region.value,
      status: elements.status.value,
      year: extractYear(I18n.tr(period)),
      name: title,
      segment: resolveSegment(type, title),
      workType,
      location: workType,
      period,
      volume,
      description,
      indicators: [],
      images: [],
      additional: null
    };
  }

  function buildLabelProject() {
    const title = localizedValue(elements.title, elements.titleEn, elements.titleKk, `Метка ${DataLoader.getProjects().length + 1}`);
    return {
      id: makeId(I18n.tr(title)),
      type: 'label',
      color: selectedColor,
      zIndex: Number(elements.zIndex.value) || 0,
      region: elements.region.value,
      status: 'completed',
      year: new Date().getFullYear(),
      name: title,
      segment: resolveSegment('label', title),
      location: title,
      description: { ru: '', kk: '', en: '' },
      indicators: [],
      images: [],
      additional: null
    };
  }

  function buildLineEndpoints() {
    return {
      start: {
        name: localizedValue(elements.lineStartName, elements.lineStartNameEn, elements.lineStartNameKk, '')
      },
      end: {
        name: localizedValue(elements.lineEndName, elements.lineEndNameEn, elements.lineEndNameKk, '')
      }
    };
  }

  function editProject(projectId) {
    const project = DataLoader.getProjectById(projectId);
    if (!project) return false;

    enabled = true;
    elements.panel.classList.remove('hidden');
    elements.toggle.classList.add('active');
    elements.badge.textContent = 'Редактирование';
    elements.badge.classList.remove('off');
    elements.badge.classList.add('on');
    mapContainer.classList.add('editor-active');

    editingProjectId = projectId;
    mode = project.type === 'line' ? 'line' : project.type === 'label' ? 'label' : 'point';
    selectedColor = project.color || selectedColor;
    selectedWidth = Number(project.width) || selectedWidth;
    elements.color.value = selectedColor;
    elements.lineWidth.value = selectedWidth;
    elements.zIndex.value = Number.isFinite(Number(project.zIndex)) ? Number(project.zIndex) : 0;
    setLocalizedValue(elements.title, elements.titleEn, elements.titleKk, project.name);
    setLocalizedValue(elements.segment, elements.segmentEn, elements.segmentKk, project.segment);
    setLocalizedValue(elements.workType, elements.workTypeEn, elements.workTypeKk, project.workType || project.location);
    setLocalizedValue(elements.period, elements.periodEn, elements.periodKk, project.period || String(project.year || ''));
    setLocalizedValue(elements.description, elements.descriptionEn, elements.descriptionKk, project.description);
    setLocalizedValue(elements.volume, elements.volumeEn, elements.volumeKk, project.volume);
    elements.status.value = project.status || elements.status.value;
    elements.region.value = project.region || elements.region.value;
    setLocalizedValue(elements.lineStartName, elements.lineStartNameEn, elements.lineStartNameKk, project.endpoints?.start?.name);
    setLocalizedValue(elements.lineEndName, elements.lineEndNameEn, elements.lineEndNameKk, project.endpoints?.end?.name);

    if (project.type === 'line') {
      pendingPoint = null;
      linePoints = (project.points || project.geometry || []).map(p => Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p?.x), Number(p?.y)]);
    } else {
      pendingPoint = { x: Number(project.x), y: Number(project.y) };
      linePoints = [];
      elements.coords.textContent = `x: ${pendingPoint.x}, y: ${pendingPoint.y}`;
    }

    elements.delete.classList.remove('hidden');
    updateModeUI();
    renderDraft();
    refreshActions();
    return true;
  }

  function saveEditingProject() {
    const current = DataLoader.getProjectById(editingProjectId);
    if (!current) return;

    const patch = mode === 'label'
      ? buildLabelProject()
      : buildBaseProject(mode === 'line' ? 'line' : 'point');

    patch.id = current.id;
    if (mode === 'line') {
      patch.points = linePoints.map(p => [Number(p[0]), Number(p[1])]);
      patch.width = selectedWidth;
      patch.hitWidth = Math.max(34, selectedWidth + 30);
      patch.endpoints = buildLineEndpoints();
    } else if (pendingPoint) {
      patch.x = pendingPoint.x;
      patch.y = pendingPoint.y;
    }

    DataLoader.updateProject(current.id, patch);
    afterSave({ ...current, ...patch });
  }

  function deleteEditingProject() {
    if (!editingProjectId) return;
    DataLoader.removeProject(editingProjectId);
    editingProjectId = null;
    clearDraft();
    Markers.refresh();
    ProjectCard.close();
    if (typeof onProjectsChangedCallback === 'function') onProjectsChangedCallback();
  }

  function extractYear(period) {
    const match = String(period).match(/\d{4}/);
    return match ? Number(match[0]) : new Date().getFullYear();
  }

  function afterSave(project) {
    clearDraft();
    Markers.refresh();
    Markers.highlightMarker(project.id);
    if (project.type === 'label') ProjectCard.close();
    else ProjectCard.open(project.id);
    if (typeof onProjectsChangedCallback === 'function') onProjectsChangedCallback();
  }

  function makeId(title) {
    const base = title
      .toLowerCase()
      .replace(/[а-яё]/g, ch => translit[ch] || ch)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || (mode === 'line' ? 'line' : 'project');

    let id = `${mode === 'line' ? 'line' : 'obj'}-${base}-${Date.now().toString(36)}`;
    while (DataLoader.getProjectById(id)) id = `${base}-${Math.random().toString(36).slice(2, 8)}`;
    return id;
  }

  const translit = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };

  function downloadJson() {
    const blob = new Blob([DataLoader.exportJson()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(DataLoader.exportJson());
      const old = elements.copy.textContent;
      elements.copy.textContent = 'JSON скопирован';
      setTimeout(() => elements.copy.textContent = old, 1400);
    } catch (e) {
      console.warn('Clipboard failed:', e);
      downloadJson();
    }
  }

  return { init, handleMapTap, isEnabled, editProject };
})();
window.MapEditor = MapEditor;
