const MapEditor = (() => {
  let enabled = false;
  let svg = null;
  let mapContainer = null;
  let pendingPoint = null;
  let selectedColor = '#00d4ff';
  let tempMarker = null;
  let onProjectsChangedCallback = null;

  const elements = {};
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function init(svgElement, containerElement, options = {}) {
    svg = svgElement;
    mapContainer = containerElement;
    onProjectsChangedCallback = options.onProjectsChanged || null;
    createToolbarButton();
    createPanel();
    bindEvents();
  }

  function createToolbarButton() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('editor-toggle')) return;

    const btn = document.createElement('button');
    btn.id = 'editor-toggle';
    btn.className = 'editor-toggle';
    btn.title = 'Режим редактирования точек';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>Точки</span>
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
          <h2>Редактор точек</h2>
          <p>Включи режим, выбери цвет и нажимай по карте.</p>
        </div>
        <button id="editor-close" class="editor-icon-btn" title="Закрыть">×</button>
      </div>

      <div class="editor-body">
        <div class="editor-row editor-status-row">
          <span id="editor-mode-badge" class="editor-badge off">Режим выключен</span>
          <span id="editor-coords">x: —, y: —</span>
        </div>

        <label class="editor-field">
          <span>Цвет точки</span>
          <div class="editor-color-row">
            <input id="editor-color" type="color" value="#00d4ff">
            <button class="editor-color-preset" data-color="#00d4ff" style="--preset:#00d4ff"></button>
            <button class="editor-color-preset" data-color="#00c853" style="--preset:#00c853"></button>
            <button class="editor-color-preset" data-color="#ffc107" style="--preset:#ffc107"></button>
            <button class="editor-color-preset" data-color="#ff5252" style="--preset:#ff5252"></button>
            <button class="editor-color-preset" data-color="#9c27b0" style="--preset:#9c27b0"></button>
          </div>
        </label>

        <label class="editor-field">
          <span>Название проекта</span>
          <input id="editor-title" type="text" placeholder="Например: Проект Астана">
        </label>

        <label class="editor-field">
          <span>Локация / город</span>
          <input id="editor-location" type="text" placeholder="Например: г. Астана">
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

        <div class="editor-actions">
          <button id="editor-save" class="editor-primary" disabled>Сохранить точку</button>
          <button id="editor-cancel" class="editor-secondary" disabled>Отмена</button>
        </div>

        <div class="editor-divider"></div>

        <div class="editor-actions vertical">
          <button id="editor-export" class="editor-secondary">Экспорт projects.json</button>
          <button id="editor-copy" class="editor-secondary">Скопировать JSON</button>
        </div>

        <p class="editor-hint">
          В режиме редактирования обычный tap по пустому месту карты создаёт черновую точку. Если двигаешь карту пальцем — точка не создаётся.
        </p>
      </div>
    `;

    document.getElementById('app').appendChild(panel);

    elements.panel = panel;
    elements.close = panel.querySelector('#editor-close');
    elements.badge = panel.querySelector('#editor-mode-badge');
    elements.coords = panel.querySelector('#editor-coords');
    elements.color = panel.querySelector('#editor-color');
    elements.title = panel.querySelector('#editor-title');
    elements.location = panel.querySelector('#editor-location');
    elements.region = panel.querySelector('#editor-region');
    elements.status = panel.querySelector('#editor-status');
    elements.category = panel.querySelector('#editor-category');
    elements.year = panel.querySelector('#editor-year');
    elements.description = panel.querySelector('#editor-description');
    elements.save = panel.querySelector('#editor-save');
    elements.cancel = panel.querySelector('#editor-cancel');
    elements.export = panel.querySelector('#editor-export');
    elements.copy = panel.querySelector('#editor-copy');

    populateSelects();
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
    elements.color.addEventListener('input', (e) => {
      selectedColor = e.target.value;
      updateTempMarkerColor();
    });

    document.querySelectorAll('.editor-color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        elements.color.value = selectedColor;
        updateTempMarkerColor();
      });
    });

    elements.save.addEventListener('click', savePendingPoint);
    elements.cancel.addEventListener('click', clearPendingPoint);
    elements.export.addEventListener('click', downloadJson);
    elements.copy.addEventListener('click', copyJson);
  }

  function toggle() {
    enabled ? disable() : enable();
  }

  function enable() {
    enabled = true;
    elements.panel.classList.remove('hidden');
    elements.toggle.classList.add('active');
    elements.badge.textContent = 'Режим включен';
    elements.badge.classList.remove('off');
    elements.badge.classList.add('on');
    mapContainer.classList.add('editor-active');
  }

  function disable() {
    enabled = false;
    clearPendingPoint();
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

  function isEnabled() {
    return enabled;
  }

  function handleMapTap(payload) {
    if (!enabled || !payload?.svgPoint) return;
    const target = payload.originalEvent?.target;
    if (target?.closest?.('.map-marker')) return;

    const x = Math.round(payload.svgPoint.x * 10) / 10;
    const y = Math.round(payload.svgPoint.y * 10) / 10;
    pendingPoint = { x, y };
    elements.coords.textContent = `x: ${x}, y: ${y}`;

    const n = DataLoader.getProjects().length + 1;
    elements.title.value = `Проект ${n}`;
    elements.location.value = '';
    elements.description.value = '';
    elements.year.value = new Date().getFullYear();
    elements.save.disabled = false;
    elements.cancel.disabled = false;
    renderTempMarker(x, y);
  }

  function getMarkerLayer() {
    return svg?.querySelector('#interactive-markers-layer');
  }

  function renderTempMarker(x, y) {
    clearTempMarkerOnly();
    const layer = getMarkerLayer();
    if (!layer) return;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'map-marker editor-temp-marker marker-pulsing active-pulse');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('class', 'map-marker-ring');
    ring.setAttribute('r', '16');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', 'map-marker-circle');
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', selectedColor);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'marker-dot');
    dot.setAttribute('r', '3.5');

    g.appendChild(ring);
    g.appendChild(circle);
    g.appendChild(dot);
    layer.appendChild(g);
    tempMarker = g;
  }

  function updateTempMarkerColor() {
    if (!tempMarker) return;
    const circle = tempMarker.querySelector('.map-marker-circle');
    if (circle) circle.setAttribute('fill', selectedColor);
  }

  function clearTempMarkerOnly() {
    if (tempMarker) tempMarker.remove();
    tempMarker = null;
  }

  function clearPendingPoint() {
    pendingPoint = null;
    clearTempMarkerOnly();
    elements.coords.textContent = 'x: —, y: —';
    elements.save.disabled = true;
    elements.cancel.disabled = true;
  }

  function savePendingPoint() {
    if (!pendingPoint) return;

    const title = elements.title.value.trim() || `Проект ${DataLoader.getProjects().length + 1}`;
    const location = elements.location.value.trim() || 'Локация не указана';
    const description = elements.description.value.trim() || 'Описание будет добавлено позже.';
    const id = makeId(title);

    const project = {
      id,
      x: pendingPoint.x,
      y: pendingPoint.y,
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
      additional: { ru: '', kk: '', en: '' }
    };

    DataLoader.addProject(project);
    clearPendingPoint();
    Markers.refresh();
    Markers.highlightMarker(project.id);
    ProjectCard.open(project.id);

    if (typeof onProjectsChangedCallback === 'function') {
      onProjectsChangedCallback();
    }
  }

  function makeId(title) {
    const base = title
      .toLowerCase()
      .replace(/[а-яё]/g, ch => translit[ch] || ch)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'project';

    let id = `${base}-${Date.now().toString(36)}`;
    while (DataLoader.getProjectById(id)) {
      id = `${base}-${Math.random().toString(36).slice(2, 8)}`;
    }
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
