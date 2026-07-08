const ProjectCard = (() => {
  let currentProjectId = null;
  let isOpen = false;
  let onCloseCallback = null;
  let onProjectSelectCallback = null;
  let onShowListCallback = null;
  let viewMode = 'detail';
  let listCountryFilter = 'all';

  // Every Kazakhstan oblast region maps to the "kazakhstan" country bucket;
  // the rest of the regions already are countries.
  const REGION_COUNTRY = {
    astana: 'kazakhstan', almaty: 'kazakhstan', atyrau: 'kazakhstan', mangystau: 'kazakhstan',
    karaganda: 'kazakhstan', pavlodar: 'kazakhstan', shymkent: 'kazakhstan', aktobe: 'kazakhstan',
    kostanay: 'kazakhstan', kyzylorda: 'kazakhstan', 'east-kz': 'kazakhstan', zhambyl: 'kazakhstan',
    azerbaijan: 'azerbaijan', armenia: 'armenia', kyrgyzstan: 'kyrgyzstan',
    uzbekistan: 'uzbekistan', mongolia: 'mongolia'
  };

  const COUNTRY_META = {
    kazakhstan: { color: '#ffc107', ru: 'Казахстан' },
    azerbaijan: { color: '#00d4ff', ru: 'Азербайджан' },
    armenia:    { color: '#ff7043', ru: 'Армения' },
    kyrgyzstan: { color: '#00c853', ru: 'Киргизия' },
    uzbekistan: { color: '#ff5252', ru: 'Узбекистан' },
    mongolia:   { color: '#9c27b0', ru: 'Монголия' }
  };

  function getCountryKey(project) {
    return REGION_COUNTRY[project.region] || 'other';
  }

  function getCountryMeta(key) {
    return COUNTRY_META[key] || { color: '#8899aa', ru: key };
  }

  function hexToRgba(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const elements = {
    card: null,
    overlay: null,
    close: null,
    content: null,
    detailView: null,
    listView: null,
    back: null,
    list: null,
    listCount: null,
    listFilters: null,
    title: null,
    location: null,
    locationText: null,
    description: null,
    status: null,
    year: null,
    segment: null,
    indicatorsGrid: null,
    indicatorsTitle: null,
    additionalText: null,
    galleryPlaceholder: null,
  };

  function init(onClose, options = {}) {
    onCloseCallback = onClose;
    onProjectSelectCallback = options.onProjectSelect || null;
    onShowListCallback = options.onShowList || null;
    elements.card = document.getElementById('project-card');
    elements.overlay = document.getElementById('card-overlay');
    elements.close = document.getElementById('card-close');
    elements.content = elements.card.querySelector('.card-content');
    elements.title = document.getElementById('card-title');
    elements.location = document.getElementById('card-location');
    elements.locationText = document.getElementById('card-location-text');
    elements.description = document.getElementById('card-description');
    elements.status = document.getElementById('card-status');
    elements.year = document.getElementById('card-year');
    elements.segment = document.getElementById('card-segment');
    elements.indicatorsGrid = document.getElementById('indicators-grid');
    elements.indicatorsTitle = document.getElementById('card-indicators-title');
    elements.additionalText = document.getElementById('card-additional-text');
    elements.galleryPlaceholder = document.getElementById('card-gallery-placeholder');

    setupViews();

    elements.close.addEventListener('click', close);
    elements.overlay?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    // Close on click outside card (on overlay)
    const card = elements.card;
    elements.overlay?.addEventListener('click', (e) => {
      if (e.target === elements.overlay) close();
    });
  }

  function setupViews() {
    const gallery = document.getElementById('card-gallery');
    const body = elements.card.querySelector('.card-body');

    elements.detailView = document.createElement('div');
    elements.detailView.className = 'card-detail-view';

    elements.back = document.createElement('button');
    elements.back.className = 'card-back';
    elements.back.type = 'button';
    elements.back.textContent = '<-- вернуться к всем проектам';
    elements.back.addEventListener('click', showProjectList);

    elements.detailView.appendChild(elements.back);
    elements.detailView.appendChild(gallery);
    elements.detailView.appendChild(body);

    elements.listView = document.createElement('div');
    elements.listView.className = 'card-list-view hidden';
    elements.listView.innerHTML = `
      <div class="card-list-header">
        <h2>Все проекты</h2>
        <span id="card-list-count"></span>
      </div>
      <div class="card-list-filters" id="card-list-filters"></div>
      <div class="card-project-list" id="card-project-list"></div>
    `;
    elements.list = elements.listView.querySelector('#card-project-list');
    elements.listCount = elements.listView.querySelector('#card-list-count');
    elements.listFilters = elements.listView.querySelector('#card-list-filters');

    elements.content.innerHTML = '';
    elements.content.appendChild(elements.detailView);
    elements.content.appendChild(elements.listView);
  }

  function updateContent(project) {
    const statuses = DataLoader.getStatuses();
    const statusInfo = statuses.find(s => s.id === project.status);

    const workTypeText = I18n.tr(project.workType);
    const periodText = I18n.tr(project.period);
    const volumeText = I18n.tr(project.volume);

    elements.title.textContent = I18n.tr(project.name);
    elements.locationText.textContent = workTypeText || I18n.tr(project.location);

    elements.status.textContent = statusInfo ? I18n.tr(statusInfo) : project.status;
    elements.status.className = 'card-badge badge-status';
    if (project.status === 'in-progress') elements.status.classList.add('in-progress');
    else if (project.status === 'planning') elements.status.classList.add('planning');

    elements.year.textContent = periodText || project.year;
    elements.year.className = 'card-badge badge-year';

    elements.segment.textContent = I18n.tr(project.segment) || workTypeText;
    elements.segment.className = 'card-badge badge-segment';

    elements.description.textContent = I18n.tr(project.description);

    elements.indicatorsTitle.textContent = volumeText ? 'Объем работ' : I18n.t('project.indicators');
    elements.indicatorsGrid.innerHTML = '';
    const indicators = [];
    if (volumeText) {
      indicators.push({
        label: { ru: 'Объем работ', kk: 'Жұмыс көлемі', en: 'Scope of work' },
        value: project.volume
      });
    }
    if (project.indicators && project.indicators.length > 0) {
      indicators.push(...project.indicators);
    }

    if (indicators.length > 0) {
      indicators.forEach(ind => {
        const item = document.createElement('div');
        item.className = 'indicator-item';
        item.innerHTML = `
          <div class="indicator-value">${I18n.tr(ind.value)}</div>
          <div class="indicator-label">${I18n.tr(ind.label)}</div>
        `;
        elements.indicatorsGrid.appendChild(item);
      });
    } else {
      elements.indicatorsGrid.innerHTML = '<div class="indicator-item" style="grid-column:1/-1;color:var(--text-muted);font-size:0.85rem;">—</div>';
    }

    if (project.additional) {
      elements.additionalText.textContent = I18n.tr(project.additional);
      elements.additionalText.closest('.card-additional').style.display = '';
    } else {
      elements.additionalText.closest('.card-additional').style.display = 'none';
    }

    if (project.images && project.images.length > 0) {
      elements.galleryPlaceholder.innerHTML = '';
      project.images.forEach(img => {
        const imgEl = document.createElement('img');
        imgEl.src = `images/${img}`;
        imgEl.alt = I18n.tr(project.name);
        imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        elements.galleryPlaceholder.appendChild(imgEl);
      });
    } else {
      elements.galleryPlaceholder.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4a6a8a" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>`;
    }
  }

  function open(projectId) {
    const project = DataLoader.getProjectById(projectId);
    if (!project) return;
    currentProjectId = projectId;
    updateContent(project);
    showDetailView();
    if (!isOpen) {
      isOpen = true;
      elements.card.classList.remove('hidden');
      // Side panel mode: keep the map interactive; do not show a full-screen overlay.
      elements.overlay.classList.add('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function showDetailView() {
    viewMode = 'detail';
    elements.detailView.classList.remove('hidden');
    elements.listView.classList.add('hidden');
  }

  function showProjectList() {
    // Run the "stop demo / reset zoom" side-effect BEFORE we open the panel below.
    // DemoMode.stop() unconditionally closes the card as part of its own cleanup,
    // so calling this callback afterwards would immediately undo the panel we
    // just opened (the click appeared to do nothing).
    if (onShowListCallback) onShowListCallback();

    viewMode = 'list';
    currentProjectId = null;
    renderProjectList();
    elements.detailView.classList.add('hidden');
    elements.listView.classList.remove('hidden');
    if (!isOpen) {
      isOpen = true;
      elements.card.classList.remove('hidden');
      elements.overlay.classList.add('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function renderProjectList() {
    const allProjects = DataLoader.getProjects().filter(project => project.type !== 'label');
    renderListFilters(allProjects);

    const projects = listCountryFilter === 'all'
      ? allProjects
      : allProjects.filter(p => getCountryKey(p) === listCountryFilter);

    elements.listCount.textContent = listCountryFilter === 'all'
      ? `${allProjects.length} проектов`
      : `${projects.length} из ${allProjects.length}`;
    elements.list.innerHTML = '';

    projects.forEach(project => {
      const meta = getCountryMeta(getCountryKey(project));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card-project-list-item';
      button.dataset.projectId = project.id;
      button.innerHTML = `
        <span class="card-project-list-dot" style="background:${meta.color}"></span>
        <span class="card-project-list-text">
          <span class="card-project-list-title" style="color:${meta.color}">${escapeHtml(I18n.tr(project.name) || project.id)}</span>
          <span class="card-project-list-meta">${escapeHtml(meta.ru)} · ${escapeHtml(I18n.tr(project.period) || String(project.year || ''))}</span>
        </span>
      `;
      button.addEventListener('click', () => {
        if (onProjectSelectCallback) onProjectSelectCallback(project.id);
        open(project.id);
      });
      elements.list.appendChild(button);
    });

    if (projects.length === 0) {
      elements.list.innerHTML = '<div class="card-list-empty">Нет проектов для этой страны</div>';
    }
  }

  function renderListFilters(allProjects) {
    if (!elements.listFilters) return;

    const counts = {};
    allProjects.forEach(p => {
      const key = getCountryKey(p);
      counts[key] = (counts[key] || 0) + 1;
    });

    elements.listFilters.innerHTML = '';
    elements.listFilters.appendChild(makeFilterChip('all', 'Все страны', '#8899aa', allProjects.length));
    Object.keys(COUNTRY_META)
      .filter(key => counts[key])
      .forEach(key => {
        const meta = COUNTRY_META[key];
        elements.listFilters.appendChild(makeFilterChip(key, meta.ru, meta.color, counts[key]));
      });
  }

  function makeFilterChip(key, label, color, count) {
    const chip = document.createElement('button');
    chip.type = 'button';
    const active = listCountryFilter === key;
    chip.className = 'card-list-filter-chip' + (active ? ' active' : '');
    if (active) {
      chip.style.borderColor = color;
      chip.style.background = hexToRgba(color, 0.18);
      chip.style.color = '#ffffff';
    }
    chip.innerHTML = `<span class="chip-dot" style="background:${color}"></span>${escapeHtml(label)}<span class="chip-count">${count}</span>`;
    chip.addEventListener('click', () => {
      listCountryFilter = key;
      renderProjectList();
    });
    return chip;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    currentProjectId = null;
    elements.card.classList.add('hidden');
    elements.overlay.classList.add('hidden');
    document.body.style.overflow = '';
    if (onCloseCallback) onCloseCallback();
  }

  function isOpenFn() { return isOpen; }
  function getCurrentProjectId() { return currentProjectId; }
  function updateCurrent() {
    if (!isOpen) return;
    if (viewMode === 'list') {
      renderProjectList();
      return;
    }
    if (!currentProjectId) return;
    const project = DataLoader.getProjectById(currentProjectId);
    if (project) updateContent(project);
  }

  return { init, open, close, showProjectList, isOpen: isOpenFn, getCurrentProjectId, updateCurrent };
})();
