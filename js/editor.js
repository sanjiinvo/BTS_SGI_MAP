const MapEditor = (() => {
  let enabled = false;
  let mode = 'point';
  let svg = null;
  let mapContainer = null;
  let selectedColor = '#00d4ff';
  let selectedWidth = 7;
  let pendingPoint = null;
  let linePoints = [];
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
          <span>Название объекта</span>
          <input id="editor-title" type="text" placeholder="Например: Участок Астана — Караганда">
        </label>

        <label class="editor-field">
          <span>Локация / участок</span>
          <input id="editor-location" type="text" placeholder="Например: Астана — Караганда">
        </label>

        <div class="editor-grid">
          <label class="editor-field">
            <span>Статус</span>
            <select id="editor-status"></select>
          </label>
          <label class="editor-field">
            <span>Категория</span>
            <select id="editor-category"></select>
          </label>
        </div>

        <div class="editor-grid">
          <label class="editor-field">
            <span>Регион</span>
            <select id="editor-region"></select>
          </label>
          <label class="editor-field">
            <span>Год</span>
            <input id="editor-year" type="number" min="2000" max="2100" value="2026">
          </label>
        </div>

        <label class="editor-field">
          <span>Краткое описание</span>
          <textarea id="editor-description" rows="3" placeholder="Краткая информация для правой плашки"></textarea>
        </label>

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
    elements.modeLine = panel.querySelector('#editor-mode-line');
    elements.color = panel.querySelector('#editor-color');
    elements.lineWidth = panel.querySelector('#editor-line-width');
    elements.lineWidthField = panel.querySelector('.editor-line-width-field');
    elements.title = panel.querySelector('#editor-title');
    elements.location = panel.querySelector('#editor-location');
    elements.region = panel.querySelector('#editor-region');
    elements.status = panel.querySelector('#editor-status');
    elements.category = panel.querySelector('#editor-category');
    elements.year = panel.querySelector('#editor-year');
    elements.description = panel.querySelector('#editor-description');
    elements.lineTools = panel.querySelector('.editor-line-tools');
    elements.lineCount = panel.querySelector('#editor-line-count');
    elements.lineUndo = panel.querySelector('#editor-line-undo');
    elements.lineClear = panel.querySelector('#editor-line-clear');
    elements.save = panel.querySelector('#editor-save');
    elements.cancel = panel.querySelector('#editor-cancel');
    elements.export = panel.querySelector('#editor-export');
    elements.copy = panel.querySelector('#editor-copy');
    elements.hint = panel.querySelector('#editor-hint');

    populateSelects();
    updateModeUI();
  }

  function populateSelects() {
    fillSelect(elements.region, DataLoader.getRegions(), 'region');
    fillSelect(elements.status, DataLoader.getStatuses(), 'status');
    fillSelect(elements.category, DataLoader.getCategories(), 'category');
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
    if (type === 'category') select.value = items[0]?.id || '';
    if (type === 'region') select.value = items[0]?.id || '';
  }

  function bindEvents() {
    elements.toggle.addEventListener('click', toggle);
    elements.close.addEventListener('click', closePanel);
    elements.modePoint.addEventListener('click', () => setMode('point'));
    elements.modeLine.addEventListener('click', () => setMode('line'));

    elements.color.addEventListener('input', (e) => {
      selectedColor = e.target.value;
      renderDraft();
    });

    elements.lineWidth.addEventListener('input', (e) => {
      selectedWidth = Number(e.target.value) || 7;
      renderDraft();
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
    elements.lineUndo.addEventListener('click', undoLinePoint);
    elements.lineClear.addEventListener('click', clearLinePoints);
    elements.export.addEventListener('click', downloadJson);
    elements.copy.addEventListener('click', copyJson);
  }

  function toggle() { enabled ? disable() : enable(); }

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
    elements.modeLine.classList.toggle('active', mode === 'line');
    elements.lineTools.style.display = mode === 'line' ? '' : 'none';
    elements.lineWidthField.style.display = mode === 'line' ? '' : 'none';
    elements.save.textContent = mode === 'line' ? 'Сохранить линию' : 'Сохранить точку';
    elements.hint.textContent = mode === 'line'
      ? 'Линия: нажимай вдоль железной дороги. Каждый tap добавляет узел. Для красивого поворота ставь больше узлов.'
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
    elements.year.value = new Date().getFullYear();
  }

  function renderDraft() {
    clearTempLayer();
    ensureTempLayer();
    if (!tempLayer) return;

    if (mode === 'line') {
      renderTempLine();
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
    clearTempLayer();
    elements.coords.textContent = 'x: —, y: —';
    elements.lineCount.textContent = 'Точек линии: 0';
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
    const canSaveLine = mode === 'line' && linePoints.length >= 2;
    const canCancel = !!pendingPoint || linePoints.length > 0;
    elements.save.disabled = !(canSavePoint || canSaveLine);
    elements.cancel.disabled = !canCancel;
    elements.lineUndo.disabled = linePoints.length === 0;
    elements.lineClear.disabled = linePoints.length === 0;
    elements.lineCount.textContent = `Точек линии: ${linePoints.length}`;
  }

  function savePendingObject() {
    if (mode === 'line') savePendingLine();
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

    DataLoader.addProject(project);
    afterSave(project);
  }

  function buildBaseProject(type) {
    const title = elements.title.value.trim() || (type === 'line' ? `Участок ${DataLoader.getProjects().length + 1}` : `Проект ${DataLoader.getProjects().length + 1}`);
    const location = elements.location.value.trim() || (type === 'line' ? 'Участок не указан' : 'Локация не указана');
    const description = elements.description.value.trim() || 'Описание будет добавлено позже.';

    return {
      id: makeId(title),
      type,
      color: selectedColor,
      region: elements.region.value,
      status: elements.status.value,
      category: elements.category.value,
      year: Number(elements.year.value) || new Date().getFullYear(),
      name: { ru: title, kk: title, en: title },
      location: { ru: location, kk: location, en: location },
      description: { ru: description, kk: description, en: description },
      indicators: [],
      images: [],
      additional: { ru: type === 'line' ? 'Интерактивный железнодорожный участок.' : '', kk: type === 'line' ? 'Интерактивті теміржол учаскесі.' : '', en: type === 'line' ? 'Interactive railway section.' : '' }
    };
  }

  function afterSave(project) {
    clearDraft();
    Markers.refresh();
    Markers.highlightMarker(project.id);
    ProjectCard.open(project.id);
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

  return { init, handleMapTap, isEnabled };
})();
window.MapEditor = MapEditor;
