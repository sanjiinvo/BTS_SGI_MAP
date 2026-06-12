const ProjectCard = (() => {
  let currentProjectId = null;
  let isOpen = false;
  let onCloseCallback = null;

  const elements = {
    card: null,
    overlay: null,
    close: null,
    title: null,
    location: null,
    locationText: null,
    description: null,
    status: null,
    year: null,
    category: null,
    indicatorsGrid: null,
    indicatorsTitle: null,
    additionalText: null,
    galleryPlaceholder: null,
  };

  function init(onClose) {
    onCloseCallback = onClose;
    elements.card = document.getElementById('project-card');
    elements.overlay = document.getElementById('card-overlay');
    elements.close = document.getElementById('card-close');
    elements.title = document.getElementById('card-title');
    elements.location = document.getElementById('card-location');
    elements.locationText = document.getElementById('card-location-text');
    elements.description = document.getElementById('card-description');
    elements.status = document.getElementById('card-status');
    elements.year = document.getElementById('card-year');
    elements.category = document.getElementById('card-category');
    elements.indicatorsGrid = document.getElementById('indicators-grid');
    elements.indicatorsTitle = document.getElementById('card-indicators-title');
    elements.additionalText = document.getElementById('card-additional-text');
    elements.galleryPlaceholder = document.getElementById('card-gallery-placeholder');

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

  function updateContent(project) {
    const statuses = DataLoader.getStatuses();
    const statusInfo = statuses.find(s => s.id === project.status);
    const categories = DataLoader.getCategories();
    const catInfo = categories.find(c => c.id === project.category);

    elements.title.textContent = I18n.tr(project.name);
    elements.locationText.textContent = I18n.tr(project.location);

    elements.status.textContent = statusInfo ? I18n.tr(statusInfo) : project.status;
    elements.status.className = 'card-badge badge-status';
    if (project.status === 'in-progress') elements.status.classList.add('in-progress');
    else if (project.status === 'planning') elements.status.classList.add('planning');

    elements.year.textContent = project.year;
    elements.year.className = 'card-badge badge-year';

    elements.category.textContent = catInfo ? I18n.tr(catInfo) : project.category;
    elements.category.className = 'card-badge badge-category';

    elements.description.textContent = I18n.tr(project.description);

    elements.indicatorsTitle.textContent = I18n.t('project.indicators');
    elements.indicatorsGrid.innerHTML = '';
    if (project.indicators && project.indicators.length > 0) {
      project.indicators.forEach(ind => {
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
    if (!isOpen) {
      isOpen = true;
      elements.card.classList.remove('hidden');
      // Side panel mode: keep the map interactive; do not show a full-screen overlay.
      elements.overlay.classList.add('hidden');
      document.body.style.overflow = 'hidden';
    }
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
    if (!isOpen || !currentProjectId) return;
    const project = DataLoader.getProjectById(currentProjectId);
    if (project) updateContent(project);
  }

  return { init, open, close, isOpen: isOpenFn, getCurrentProjectId, updateCurrent };
})();
