(async () => {
  const LOADING_TIMEOUT = 5000;

  function showLoading() {
    const existing = document.getElementById('loading-screen');
    if (existing) return;
    const div = document.createElement('div');
    div.id = 'loading-screen';
    div.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:20px;padding:40px;">
        <div class="loading-spinner" style="width:48px;height:48px;border:3px solid var(--border-color);border-top-color:var(--accent-secondary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <div style="color:var(--text-secondary);font-size:0.9rem;">Loading...</div>
      </div>
      <style>
        #loading-screen { position:fixed;inset:0;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;z-index:9999; }
        @keyframes spin { to { transform:rotate(360deg); } }
      </style>`;
    document.body.appendChild(div);
  }

  function hideLoading() {
    const el = document.getElementById('loading-screen');
    if (el) el.remove();
  }

  function showError(msg) {
    hideLoading();
    const div = document.createElement('div');
    div.id = 'error-screen';
    div.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px;text-align:center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff5252" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div style="color:var(--text-primary);font-size:1.1rem;font-weight:600;">${msg}</div>
        <button onclick="location.reload()" style="padding:10px 24px;background:var(--accent-primary);color:white;border-radius:8px;font-size:0.9rem;cursor:pointer;border:none;">Retry</button>
      </div>
      <style>
        #error-screen { position:fixed;inset:0;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;z-index:9999; }
      </style>`;
    document.body.appendChild(div);
  }

  // ===== Initialize =====
  showLoading();

  const loadTimeout = setTimeout(() => {
    showError('Failed to load application. Please check the connection and try again.');
  }, LOADING_TIMEOUT);

  try {
    // Step 1: Load translations
    await I18n.init();

    // Step 2: Load project data
    const dataLoaded = await DataLoader.init();
    if (!dataLoaded) {
      clearTimeout(loadTimeout);
      showError('Failed to load project data. Please ensure data/projects.json exists.');
      return;
    }

    // Step 3: Load SVG map
    const mapRes = await fetch(`assets/map.svg?v=${Date.now()}`);
    const mapSvg = await mapRes.text();
    const mapContainer = document.getElementById('map-svg-container');
    mapContainer.innerHTML = mapSvg;
    const svgEl = mapContainer.querySelector('svg');
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';
    svgEl.style.display = 'block';

    // Split the loaded SVG into stable layers:
    // 1) map-artwork-layer: the visual map, it does not intercept taps.
    // 2) interactive-markers-layer: project points, it receives taps.
    // The common SVG element still handles pan/pinch gestures.
    prepareSvgLayers(svgEl);

    // If the SVG has no viewBox, create one from width/height.
    // Your current map already has: viewBox="0 0 4127.1641 2050.417".
    if (!svgEl.getAttribute('viewBox')) {
      const w = parseFloat(svgEl.getAttribute('width')) || 4127.1641;
      const h = parseFloat(svgEl.getAttribute('height')) || 2050.417;
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    // Step 4: Initialize native SVG viewBox zoom for touch screens.
    // This changes the SVG viewBox instead of scaling the whole page/layer,
    // so project cards stay fixed and the vector map keeps its quality.
    SvgViewBoxZoom.init(svgEl, document.getElementById('map-container'), {
      minZoom: 1,
      maxZoom: 10,
      onMapTap: (payload) => {
        if (window.MapEditor?.isEnabled?.()) {
          window.MapEditor.handleMapTap(payload);
        }
      },
      // Points/lines are drawn at fixed sizes, so at full zoom-out they'd be
      // nearly invisible; grow them smoothly as the map zooms out and settle
      // back to normal size once zoomed in past the reference level.
      onSizeScaleChange: (scale) => Markers.applyZoomScale(scale)
    });

    // Step 5: Initialize modules
    Markers.init(mapContainer, onMarkerClick);
    ProjectCard.init(onCardClose, {
      onProjectSelect: focusProject,
      onShowList: showAllProjectsFromCard
    });
    FilterManager.init(onFilterChange);
    if (window.MapEditor) {
      MapEditor.init(svgEl, document.getElementById('map-container'), {
        onProjectsChanged: () => {
          FilterManager.updateCount(DataLoader.getProjects().length);
        }
      });
    }
    DemoMode.init(onDemoShowProject);

    // Step 6: Populate filters
    FilterManager.populateSelects();

    // Step 7: Initial render
    updateUI();
    applyInitialFilters();

    // Step 8: Language change handler
    document.addEventListener('language-changed', () => {
      updateUI();
      FilterManager.updateLabels();
      Markers.refresh();
      applyInitialFilters();
      // Update open card content
      if (ProjectCard.isOpen()) {
        ProjectCard.updateCurrent();
      }
    });

    // Step 9: Language switcher buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        I18n.setLang(btn.dataset.lang);
      });
    });

    // Step 10: Fullscreen button
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    document.getElementById('project-count').addEventListener('click', () => {
      ProjectCard.showProjectList();
    });

    // Step 11: Handle resize for responsive behavior
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        Markers.showAll();
      }, 200);
    });

    // Done
    clearTimeout(loadTimeout);
    hideLoading();

  } catch (e) {
    clearTimeout(loadTimeout);
    console.error('Initialization error:', e);
    showError('An unexpected error occurred. Please try again.');
  }


  function prepareSvgLayers(svgEl) {
    const SVG_NS = 'http://www.w3.org/2000/svg';

    // Do not run twice.
    if (svgEl.querySelector('#map-artwork-layer')) return;

    const passThroughTags = new Set(['defs', 'title', 'desc', 'metadata', 'style', 'script']);
    const artworkLayer = document.createElementNS(SVG_NS, 'g');
    artworkLayer.setAttribute('id', 'map-artwork-layer');
    artworkLayer.setAttribute('pointer-events', 'none');

    const children = Array.from(svgEl.childNodes);
    let insertBeforeNode = null;

    children.forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (passThroughTags.has(tag)) return;
      if (node.id === 'interactive-markers-layer' || node.id === 'map-artwork-layer') return;
      if (!insertBeforeNode) insertBeforeNode = node;
      artworkLayer.appendChild(node);
    });

    if (artworkLayer.childNodes.length > 0) {
      svgEl.appendChild(artworkLayer);
      // Keep artwork before future marker layer.
      const markerLayer = svgEl.querySelector('#interactive-markers-layer');
      if (markerLayer) svgEl.insertBefore(artworkLayer, markerLayer);
    }
  }

  // ===== Callbacks =====
  function onMarkerClick(projectId) {
    if (window.MapEditor?.isDeleteModeEnabled?.() && window.MapEditor?.deleteById?.(projectId)) {
      return;
    }

    if (window.MapEditor?.isEnabled?.() && window.MapEditor?.editProject?.(projectId)) {
      return;
    }

    const project = DataLoader.getProjectById(projectId);
    if (project?.type === 'label') {
      Markers.highlightMarker(projectId);
      return;
    }

    DemoMode.stop();
    Markers.highlightMarker(projectId);
    zoomToProject(projectId);
    ProjectCard.open(projectId);
  }

  function onCardClose() {
    Markers.highlightMarker(null);
  }

  function onFilterChange(filters) {
    const filtered = DataLoader.getFilteredProjects(filters);
    const ids = filtered.map(p => p.id);
    Markers.showOnly(ids);
    FilterManager.updateCount(filtered.length);

    const noResults = document.getElementById('no-results');
    if (filtered.length === 0) {
      document.getElementById('no-results-text').textContent = I18n.t('app.noResults');
      noResults.classList.remove('hidden');
    } else {
      noResults.classList.add('hidden');
    }
  }

  function onDemoShowProject(projectId) {
    ProjectCard.open(projectId);
  }

  function focusProject(projectId) {
    DemoMode.stop();
    Markers.showAll();
    Markers.highlightMarker(projectId);
    zoomToProject(projectId);
  }

  function zoomToProject(projectId) {
    const point = Markers.getMarkerSvgPoint(projectId);
    if (point) SvgViewBoxZoom.zoomToPoint(point, 5.5);
  }

  function showAllProjectsFromCard() {
    DemoMode.stop();
    Markers.highlightMarker(null);
    Markers.showAll();
    SvgViewBoxZoom.reset();
  }

  function applyInitialFilters() {
    const filters = FilterManager.getFilters();
    onFilterChange(filters);
  }

  function updateUI() {
    const title = document.getElementById('app-title');
    const subtitle = document.getElementById('app-subtitle');
    title.textContent = I18n.t('app.title');
    subtitle.textContent = I18n.t('app.subtitle');
    FilterManager.updateLabels();
    FilterManager.updateCount(DataLoader.getProjects().length);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.() ||
      document.documentElement.webkitRequestFullscreen?.();
      document.getElementById('fullscreen-btn').innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
        </svg>`;
    } else {
      document.exitFullscreen?.() ||
      document.webkitExitFullscreen?.();
      document.getElementById('fullscreen-btn').innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>`;
    }
  }

  // Handle fullscreen change events
  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

  function updateFullscreenIcon() {
    const btn = document.getElementById('fullscreen-btn');
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
    btn.innerHTML = isFull
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
  }
})();
