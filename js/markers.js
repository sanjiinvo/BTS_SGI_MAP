const Markers = (() => {
  let allObjects = {};
  let activeObjectId = null;
  let onObjectClickCallback = null;
  let svgContainerRef = null;
  let lastPointerOpenAt = 0;
  let displayViewBox = null;
  let currentZoomScale = 1;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LEGACY_VIEWBOX = { x: 0, y: 0, width: 4127.1641, height: 2050.417 };
  const DEFAULT_ENDPOINT_FONT_SIZE = 86;
  const DEFAULT_STATION_FONT_SIZE = 62;
  const DEFAULT_LABEL_FONT_SIZE = 86;
  const STATUS_COLORS = {
    'completed': '#00c853',
    'in-progress': '#ffc107',
    'planning': '#3a7bd5'
  };

  // Above this zoom-scale (1 = zoomed in past the reference level, growing
  // toward ~8 at full zoom-out) the text labels overlap into an unreadable
  // mush anyway, so we drop the whole label layer. This is the big perf win:
  // when fully zoomed out the entire map is on screen, so *every* label would
  // otherwise be rasterized on each pan frame. Bypassed while editing.
  const LABEL_LOD_HIDE_ABOVE_SCALE = 2.2;
  let layerRef = null;
  let countryLayerRef = null;

  // Big country names shown only at (near) full zoom-out and faded out smoothly
  // as the map is zoomed in — the mirror image of the marker-label LOD. Positions
  // are country centroids in the map's viewBox coordinate space; names carry all
  // UI languages (fall back to ru).
  const COUNTRIES = [
    { x: 10300, y: 14050, fs: 860, name: { ru: 'КАЗАХСТАН', en: 'KAZAKHSTAN', kk: 'ҚАЗАҚСТАН', de: 'KASACHSTAN', zh: '哈萨克斯坦' } },
    { x: 18050, y: 16350, fs: 640, name: { ru: 'КИТАЙ', en: 'CHINA', kk: 'ҚЫТАЙ', de: 'CHINA', zh: '中国' } },
    { x: 17450, y: 14250, fs: 520, name: { ru: 'МОНГОЛИЯ', en: 'MONGOLIA', kk: 'МОҢҒОЛИЯ', de: 'MONGOLEI', zh: '蒙古' } },
    { x: 9750, y: 16880, fs: 430, name: { ru: 'УЗБЕКИСТАН', en: 'UZBEKISTAN', kk: 'ӨЗБЕКСТАН', de: 'USBEKISTAN', zh: '乌兹别克斯坦' } },
    { x: 8000, y: 17520, fs: 400, name: { ru: 'ТУРКМЕНИСТАН', en: 'TURKMENISTAN', kk: 'ТҮРІКМЕНСТАН', de: 'TURKMENISTAN', zh: '土库曼斯坦' } },
    { x: 4050, y: 17020, fs: 300, name: { ru: 'АЗЕРБАЙДЖАН', en: 'AZERBAIJAN', kk: 'ӘЗІРБАЙЖАН', de: 'ASERBAIDSCHAN', zh: '阿塞拜疆' } },
    { x: 13450, y: 16620, fs: 300, name: { ru: 'КЫРГЫЗСТАН', en: 'KYRGYZSTAN', kk: 'ҚЫРҒЫЗСТАН', de: 'KIRGISISTAN', zh: '吉尔吉斯斯坦' } },
    { x: 12350, y: 18060, fs: 260, name: { ru: 'ТАДЖИКИСТАН', en: 'TAJIKISTAN', kk: 'ТӘЖІКСТАН', de: 'TADSCHIKISTAN', zh: '塔吉克斯坦' } },
    { x: 1900, y: 15300, fs: 250, name: { ru: 'ГРУЗИЯ', en: 'GEORGIA', kk: 'ГРУЗИЯ', de: 'GEORGIEN', zh: '格鲁吉亚' } },
    { x: 2650, y: 17120, fs: 230, name: { ru: 'АРМЕНИЯ', en: 'ARMENIA', kk: 'АРМЕНИЯ', de: 'ARMENIEN', zh: '亚美尼亚' } }
  ];

  // Opacity vs zoom-scale (1 = zoomed in, ~6 at full zoom-out): fully visible when
  // well zoomed out, faded to nothing by mid-zoom. CSS transition smooths it.
  function countryOpacity(scale) {
    return Math.max(0, Math.min(1, (scale - 2.0) / (4.0 - 2.0)));
  }

  // Points/lines are drawn in fixed SVG-unit sizes, so at full zoom-out
  // (viewBox = whole map) they end up tiny on screen and must grow back.
  // Instead of rewriting an attribute on every one of the ~2000 scalable
  // nodes on each zoom frame, each element only stamps its per-element base
  // size here (once, at creation) via a CSS custom property + marker class;
  // the CSS then computes `base * var(--marker-scale)`. applyZoomScale then
  // rescales the entire layer with a SINGLE custom-property write per frame.
  function registerScalable(el, attr, base) {
    if (!el || !Number.isFinite(base)) return;
    if (attr === 'font-size') { el.style.setProperty('--fs-base', `${base}px`); el.classList.add('mk-scale-fs'); }
    else if (attr === 'stroke-width') { el.style.setProperty('--sw-base', base); el.classList.add('mk-scale-sw'); }
    else { el.style.setProperty('--r-base', base); el.classList.add('mk-scale-r'); }
  }

  function applyZoomScale(scale) {
    currentZoomScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    if (layerRef) layerRef.style.setProperty('--marker-scale', currentZoomScale);
    if (countryLayerRef) countryLayerRef.style.opacity = countryOpacity(currentZoomScale);
    applyLabelLod();
  }

  function applyLabelLod() {
    if (!layerRef) return;
    // Never hide while editing — the operator needs every label visible to place/adjust points.
    const editing = !!window.MapEditor?.isEnabled?.();
    const hide = !editing && currentZoomScale > LABEL_LOD_HIDE_ABOVE_SCALE;
    layerRef.classList.toggle('lod-hide-labels', hide);
  }

  function init(svgContainer, onClick) {
    svgContainerRef = svgContainer;
    onObjectClickCallback = onClick;
    allObjects = {};
    displayViewBox = parseViewBox(getSvg(svgContainer)?.getAttribute('viewBox'));
    createCountryLabels(svgContainer);
    createCountryFlags(svgContainer);
    createObjectLayer(svgContainer);
    createObjects(svgContainer);
    // Apply the current zoom level immediately so markers start at the right
    // size (and labels at the right LOD) before the first user gesture.
    if (window.SvgViewBoxZoom?.getSizeScale) applyZoomScale(window.SvgViewBoxZoom.getSizeScale());
  }

  function getSvg(svgContainer) {
    return svgContainer.querySelector('svg');
  }

  function parseViewBox(value) {
    const parts = String(value || '').trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }

  function toDisplayPoint(x, y) {
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

    const isLegacyPoint =
      displayViewBox &&
      displayViewBox.width > LEGACY_VIEWBOX.width * 2 &&
      px >= LEGACY_VIEWBOX.x &&
      py >= LEGACY_VIEWBOX.y &&
      px <= LEGACY_VIEWBOX.width &&
      py <= LEGACY_VIEWBOX.height;

    if (!isLegacyPoint) return [px, py];

    return [
      displayViewBox.x + ((px - LEGACY_VIEWBOX.x) / LEGACY_VIEWBOX.width) * displayViewBox.width,
      displayViewBox.y + ((py - LEGACY_VIEWBOX.y) / LEGACY_VIEWBOX.height) * displayViewBox.height
    ];
  }

  function createObjectLayer(svgContainer) {
    const svg = getSvg(svgContainer);
    if (!svg) return;

    const oldLayer = svg.querySelector('#interactive-markers-layer');
    if (oldLayer) oldLayer.remove();

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', 'interactive-markers-layer');
    layer.setAttribute('data-layer', 'points-and-lines');
    layer.style.setProperty('--marker-scale', currentZoomScale);
    svg.appendChild(layer);
    layerRef = layer;
  }

  function createObjects(svgContainer) {
    const svg = getSvg(svgContainer);
    const layer = svg?.querySelector('#interactive-markers-layer');
    if (!svg || !layer) return;

    // SVG has no z-index; paint order = DOM order. Sort ascending so a
    // higher zIndex project is appended later and therefore drawn on top.
    const projects = [...DataLoader.getProjects()]
      .sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));

    projects.forEach(project => {
      let object = null;
      if (project.type === 'line') object = createLineObject(project);
      else if (project.type === 'label') object = createLabelObject(project);
      else object = createPointObject(project);

      if (!object) return;
      layer.appendChild(object);
      allObjects[project.id] = { element: object, data: project };
    });
  }

  function getColor(project) {
    return project.color || STATUS_COLORS[project.status] || '#00d4ff';
  }

  function createPointObject(project) {
    const displayPoint = toDisplayPoint(project.x, project.y);
    if (!displayPoint) return null;

    const markerGroup = document.createElementNS(SVG_NS, 'g');
    markerGroup.setAttribute('class', 'map-object map-marker');
    markerGroup.setAttribute('transform', `translate(${displayPoint[0]}, ${displayPoint[1]})`);
    markerGroup.dataset.projectId = project.id;
    markerGroup.dataset.objectType = 'point';
    markerGroup.setAttribute('tabindex', '0');
    markerGroup.setAttribute('role', 'button');
    markerGroup.setAttribute('aria-label', I18n.tr(project.name));

    const hitArea = document.createElementNS(SVG_NS, 'circle');
    hitArea.setAttribute('class', 'map-marker-hitarea');
    hitArea.setAttribute('cx', '0');
    hitArea.setAttribute('cy', '0');
    hitArea.setAttribute('r', '28');

    const glow = document.createElementNS(SVG_NS, 'circle');
    glow.setAttribute('class', 'map-marker-glow');
    glow.setAttribute('cx', '0');
    glow.setAttribute('cy', '0');
    glow.setAttribute('r', '18');
    glow.setAttribute('opacity', '0.35');

    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('class', 'map-marker-ring');
    ring.setAttribute('cx', '0');
    ring.setAttribute('cy', '0');
    ring.setAttribute('r', '13');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', 'map-marker-circle');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '9');
    circle.setAttribute('fill', getColor(project));

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'marker-dot');
    dot.setAttribute('cx', '0');
    dot.setAttribute('cy', '0');
    dot.setAttribute('r', '3.5');

    markerGroup.appendChild(hitArea);
    markerGroup.appendChild(glow);
    markerGroup.appendChild(ring);
    markerGroup.appendChild(circle);
    markerGroup.appendChild(dot);
    bindObjectEvents(markerGroup, project.id);

    registerScalable(hitArea, 'r', 28);
    registerScalable(glow, 'r', 18);
    registerScalable(ring, 'r', 13);
    registerScalable(circle, 'r', 9);
    registerScalable(dot, 'r', 3.5);

    return markerGroup;
  }

  function createLineObject(project) {
    const points = offsetLinePoints(normalizeLinePoints(project.points || project.geometry), Number(project.lineOffset || 0));
    if (points.length < 2) return null;

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'map-object map-line');
    group.dataset.projectId = project.id;
    group.dataset.objectType = 'line';
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', I18n.tr(project.name));

    const pointString = points.map(p => `${p[0]},${p[1]}`).join(' ');
    const color = getColor(project);

    const hitLine = document.createElementNS(SVG_NS, 'polyline');
    hitLine.setAttribute('class', 'map-line-hitarea');
    hitLine.setAttribute('points', pointString);
    hitLine.setAttribute('fill', 'none');
    hitLine.setAttribute('stroke', 'transparent');
    hitLine.setAttribute('stroke-width', String(project.hitWidth || 42));
    hitLine.setAttribute('stroke-linecap', 'round');
    hitLine.setAttribute('stroke-linejoin', 'round');

    const glowLine = document.createElementNS(SVG_NS, 'polyline');
    glowLine.setAttribute('class', 'map-line-glow');
    glowLine.setAttribute('points', pointString);
    glowLine.setAttribute('fill', 'none');
    glowLine.setAttribute('stroke', color);
    glowLine.setAttribute('stroke-width', String(project.width ? Number(project.width) + 8 : 14));
    glowLine.setAttribute('stroke-linecap', 'round');
    glowLine.setAttribute('stroke-linejoin', 'round');
    glowLine.setAttribute('opacity', '0.2');

    const visibleLine = document.createElementNS(SVG_NS, 'polyline');
    visibleLine.setAttribute('class', 'map-line-visible');
    visibleLine.setAttribute('points', pointString);
    visibleLine.setAttribute('fill', 'none');
    visibleLine.setAttribute('stroke', color);
    visibleLine.setAttribute('stroke-width', String(project.width || 7));
    visibleLine.setAttribute('stroke-linecap', 'round');
    visibleLine.setAttribute('stroke-linejoin', 'round');

    const startNode = createLineEndpoint(points[0], color, 'start', I18n.tr(project.endpoints?.start?.name), project.endpoints?.start?.fontSize);
    const endNode = createLineEndpoint(points[points.length - 1], color, 'end', I18n.tr(project.endpoints?.end?.name), project.endpoints?.end?.fontSize);
    const stationNodes = points
      .slice(1, -1)
      .map((point, index) => createLineStation(point, color, getLineStationName(project, index + 1), getLineStationFontSize(project, index + 1)));

    group.appendChild(hitLine);
    group.appendChild(glowLine);
    group.appendChild(visibleLine);
    stationNodes.forEach(node => group.appendChild(node));
    group.appendChild(startNode);
    group.appendChild(endNode);
    bindObjectEvents(group, project.id);

    registerScalable(hitLine, 'stroke-width', Number(project.hitWidth) || 42);
    registerScalable(glowLine, 'stroke-width', project.width ? Number(project.width) + 8 : 14);
    registerScalable(visibleLine, 'stroke-width', Number(project.width) || 7);

    return group;
  }

  function createLabelObject(project) {
    const displayPoint = toDisplayPoint(project.x, project.y);
    if (!displayPoint) return null;

    const color = getColor(project);
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'map-object map-label-point');
    group.setAttribute('transform', `translate(${displayPoint[0]}, ${displayPoint[1]})`);
    group.dataset.projectId = project.id;
    group.dataset.objectType = 'label';
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', I18n.tr(project.name));

    const hitArea = document.createElementNS(SVG_NS, 'circle');
    hitArea.setAttribute('class', 'map-label-hitarea');
    hitArea.setAttribute('r', '28');

    const outer = document.createElementNS(SVG_NS, 'circle');
    outer.setAttribute('class', 'map-label-ring');
    outer.setAttribute('r', '9');
    outer.setAttribute('fill', '#ffffff');
    outer.setAttribute('stroke', color);

    const inner = document.createElementNS(SVG_NS, 'circle');
    inner.setAttribute('class', 'map-label-dot');
    inner.setAttribute('r', '4');
    inner.setAttribute('fill', color);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'map-label-text');
    const labelDx = Number.isFinite(project.labelDx) ? project.labelDx : 14;
    const labelDy = Number.isFinite(project.labelDy) ? project.labelDy : -10;
    label.setAttribute('x', String(labelDx));
    label.setAttribute('y', String(labelDy));
    if (Number.isFinite(project.labelRotate) && project.labelRotate !== 0) {
      label.setAttribute('transform', `rotate(${project.labelRotate} ${labelDx} ${labelDy})`);
    }
    if (project.labelAnchor) {
      label.setAttribute('text-anchor', project.labelAnchor);
    }
    label.textContent = I18n.tr(project.name);

    group.appendChild(hitArea);
    group.appendChild(outer);
    group.appendChild(inner);
    group.appendChild(label);
    bindObjectEvents(group, project.id);

    label.style.fontSize = `${Number(project.fontSize) || DEFAULT_LABEL_FONT_SIZE}px`;

    registerScalable(hitArea, 'r', 28);
    registerScalable(outer, 'r', 9);
    registerScalable(inner, 'r', 4);

    return group;
  }

  function normalizeLinePoints(points) {
    if (!Array.isArray(points)) return [];
    return points
      .map(p => Array.isArray(p) ? toDisplayPoint(p[0], p[1]) : toDisplayPoint(p?.x, p?.y))
      .filter(Boolean);
  }

  function offsetLinePoints(points, offset) {
    if (!Number.isFinite(offset) || offset === 0 || points.length < 2) return points;

    return points.map((point, index) => {
      const prev = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const length = Math.hypot(dx, dy) || 1;
      return [
        point[0] + (-dy / length) * offset,
        point[1] + (dx / length) * offset
      ];
    });
  }

  function createLineEndpoint(point, color, type, name = '', fontSize) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', `map-line-endpoint ${type}`);

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', point[0]);
    circle.setAttribute('cy', point[1]);
    circle.setAttribute('r', '9');
    circle.setAttribute('fill', '#ffffff');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '3');
    group.appendChild(circle);
    registerScalable(circle, 'r', 9);
    registerScalable(circle, 'stroke-width', 3);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', point[0]);
    dot.setAttribute('cy', point[1]);
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', color);
    group.appendChild(dot);
    registerScalable(dot, 'r', 4);

    if (name) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'map-line-endpoint-label');
      text.setAttribute('x', point[0] + 14);
      text.setAttribute('y', point[1] - 10);
      text.textContent = name;
      text.style.fontSize = `${Number(fontSize) || DEFAULT_ENDPOINT_FONT_SIZE}px`;
      group.appendChild(text);
    }

    return group;
  }

  function createLineStation(point, color, name = '', fontSize) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'map-line-station');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', point[0]);
    circle.setAttribute('cy', point[1]);
    circle.setAttribute('r', '6');
    circle.setAttribute('fill', '#ffffff');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '2.5');
    group.appendChild(circle);
    registerScalable(circle, 'r', 6);
    registerScalable(circle, 'stroke-width', 2.5);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', point[0]);
    dot.setAttribute('cy', point[1]);
    dot.setAttribute('r', '2.6');
    dot.setAttribute('fill', color);
    group.appendChild(dot);
    registerScalable(dot, 'r', 2.6);

    if (name) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'map-line-station-label');
      text.setAttribute('x', point[0] + 11);
      text.setAttribute('y', point[1] - 8);
      text.textContent = name;
      text.style.fontSize = `${Number(fontSize) || DEFAULT_STATION_FONT_SIZE}px`;
      group.appendChild(text);
    }

    return group;
  }

  function getLineStationName(project, pointIndex) {
    const station = project.stations?.[pointIndex];
    if (!station) return '';
    return I18n.tr(station.name || station);
  }

  function getLineStationFontSize(project, pointIndex) {
    return project.stations?.[pointIndex]?.fontSize;
  }

  function bindObjectEvents(element, projectId) {
    element.addEventListener('marker-tap', (e) => {
      e.stopPropagation();
      lastPointerOpenAt = Date.now();
      if (onObjectClickCallback) onObjectClickCallback(projectId);
    });

    element.addEventListener('click', (e) => {
      e.stopPropagation();
      if (Date.now() - lastPointerOpenAt < 500) return;
      if (window.SvgViewBoxZoom?.wasGestureMoved?.()) return;
      if (onObjectClickCallback) onObjectClickCallback(projectId);
    });

    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (onObjectClickCallback) onObjectClickCallback(projectId);
      }
    });
  }

  function showAll() {
    Object.values(allObjects).forEach(m => { m.element.style.display = ''; });
  }

  function showOnly(projectIds) {
    Object.values(allObjects).forEach(m => {
      const match = projectIds.includes(m.data.id);
      m.element.style.display = match ? '' : 'none';
    });
  }

  function highlightMarker(projectId) {
    Object.values(allObjects).forEach(m => {
      m.element.classList.remove('marker-pulsing', 'active-pulse', 'line-active');
    });
    if (projectId && allObjects[projectId]) {
      const item = allObjects[projectId];
      item.element.classList.add('marker-pulsing', 'active-pulse');
      if (item.data.type === 'line') item.element.classList.add('line-active');
      if (item.data.type === 'label') item.element.classList.add('label-active');
      activeObjectId = projectId;
    } else {
      activeObjectId = null;
    }
  }

  function getMarkerPosition(projectId) {
    const m = allObjects[projectId];
    if (!m) return null;
    const svg = m.element.closest('svg');
    if (!svg) return null;

    const pointData = getMarkerSvgPoint(projectId);
    if (!pointData) return null;

    const pt = svg.createSVGPoint();
    pt.x = pointData.x;
    pt.y = pointData.y;
    const screenPoint = pt.matrixTransform(svg.getScreenCTM());
    return { x: screenPoint.x, y: screenPoint.y };
  }

  function getMarkerSvgPoint(projectId) {
    const m = allObjects[projectId];
    if (!m) return null;

    let pointData = null;
    if (m.data.type === 'line') {
      const pts = offsetLinePoints(normalizeLinePoints(m.data.points || m.data.geometry), Number(m.data.lineOffset || 0));
      if (pts.length > 0) pointData = pts[Math.floor(pts.length / 2)];
    } else {
      pointData = toDisplayPoint(m.data.x, m.data.y);
    }
    if (!pointData) return null;
    return { x: pointData[0], y: pointData[1] };
  }

  function refresh() {
    if (!svgContainerRef) return;
    createCountryLabels(svgContainerRef);
    createCountryFlags(svgContainerRef);
    createObjectLayer(svgContainerRef);
    createObjects(svgContainerRef);
    if (activeObjectId) highlightMarker(activeObjectId);
  }

  // Clean per-country flag badges (replacing the messy baked-in ones removed from
  // the SVG). Simplified but recognizable; absolutely positioned near each country.
  // w:h = 3:2, centered at (x,y).
  const FLAG_W = 620, FLAG_H = 413;
  const FLAGS = [
    { c: 'kz', x: 10300, y: 13150 }, { c: 'cn', x: 18050, y: 16150 },
    { c: 'mn', x: 17450, y: 14300 }, { c: 'uz', x: 9750, y: 16300 },
    { c: 'tm', x: 8000, y: 16980 },  { c: 'az', x: 4050, y: 16520 },
    { c: 'kg', x: 13320, y: 16720 }, { c: 'tj', x: 12300, y: 17950 },
    { c: 'ge', x: 1900, y: 15330 },  { c: 'am', x: 2650, y: 16680 }
  ];

  function buildFlag(c, x, y, w, h) {
    const l = x - w / 2, t = y - h / 2;
    const R = (rx, ry, rw, rh, f) => `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${f}"/>`;
    const C = (cx, cy, r, f) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"/>`;
    const LN = (x1, y1, x2, y2, f, sw) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${f}" stroke-width="${sw}"/>`;
    // sun disc with N radiating rays
    const sun = (sx, sy, r, f, n = 20) => {
      let s = '';
      for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; s += LN(sx + Math.cos(a) * r, sy + Math.sin(a) * r, sx + Math.cos(a) * r * 1.7, sy + Math.sin(a) * r * 1.7, f, r * 0.16); }
      return s + C(sx, sy, r, f);
    };
    const h3 = (a, b, cc) => R(l, t, w, h / 3, a) + R(l, t + h / 3, w, h / 3, b) + R(l, t + 2 * h / 3, w, h - 2 * (h / 3), cc);
    const cx = l + w / 2, cy = t + h / 2;
    let g = '';
    switch (c) {
      case 'kz': {
        // cyan field, golden sun with rays, simplified soaring eagle below
        const sy = t + h * 0.42, sr = h * 0.15;
        g = R(l, t, w, h, '#00afca') + sun(cx, sy, sr, '#f5d020', 22)
          + `<path d="M ${cx - sr * 1.6} ${sy + sr * 2.4} Q ${cx - sr * 0.5} ${sy + sr * 1.5} ${cx} ${sy + sr * 2.2} Q ${cx + sr * 0.5} ${sy + sr * 1.5} ${cx + sr * 1.6} ${sy + sr * 2.4}" fill="none" stroke="#f5d020" stroke-width="${sr * 0.22}"/>`;
        break;
      }
      case 'kg': {
        // red field, golden sun with rays + tunduk (crossed lines in a ring)
        const sr = h * 0.17;
        g = R(l, t, w, h, '#e8112d') + sun(cx, cy, sr, '#ffef00', 24)
          + C(cx, cy, sr * 0.55, '#e8112d')
          + LN(cx - sr * 0.5, cy, cx + sr * 0.5, cy, '#ffef00', sr * 0.12)
          + LN(cx, cy - sr * 0.5, cx, cy + sr * 0.5, '#ffef00', sr * 0.12);
        break;
      }
      case 'az': g = h3('#009cbf', '#ed2939', '#3f9c35') + C(cx + w * 0.02, cy, h * 0.16, '#fff') + C(cx + w * 0.07, cy, h * 0.13, '#ed2939'); break;
      case 'am': g = h3('#d90012', '#0033a0', '#f2a800'); break;
      case 'ge': g = R(l, t, w, h, '#fff') + R(cx - w * 0.06, t, w * 0.12, h, '#e8112d') + R(l, cy - h * 0.09, w, h * 0.18, '#e8112d'); break;
      case 'uz': g = R(l, t, w, h / 3, '#0099b5') + R(l, t + h / 3, w, h / 3, '#fff') + R(l, t + 2 * h / 3, w, h / 3, '#1eb53a') + C(l + w * 0.2, t + h * 0.17, h * 0.11, '#fff') + C(l + w * 0.24, t + h * 0.17, h * 0.09, '#0099b5'); break;
      case 'tm': g = R(l, t, w, h, '#28ae66') + R(l, t, w * 0.22, h, '#b02a30') + C(l + w * 0.42, t + h * 0.22, h * 0.1, '#fff') + C(l + w * 0.46, t + h * 0.22, h * 0.08, '#28ae66'); break;
      case 'kg': g = R(l, t, w, h, '#e8112d') + C(cx, cy, h * 0.2, '#ffef00'); break;
      case 'tj': g = R(l, t, w, h * 0.28, '#cc0000') + R(l, t + h * 0.28, w, h * 0.44, '#fff') + R(l, t + h * 0.72, w, h * 0.28, '#006600') + C(cx, cy, h * 0.09, '#f8c300'); break;
      case 'cn': g = R(l, t, w, h, '#de2910') + C(l + w * 0.17, t + h * 0.28, h * 0.13, '#ffde00') + C(l + w * 0.3, t + h * 0.14, h * 0.045, '#ffde00') + C(l + w * 0.34, t + h * 0.26, h * 0.045, '#ffde00') + C(l + w * 0.34, t + h * 0.42, h * 0.045, '#ffde00') + C(l + w * 0.3, t + h * 0.54, h * 0.045, '#ffde00'); break;
      case 'mn': g = R(l, t, w / 3, h, '#c4272e') + R(l + w / 3, t, w / 3, h, '#015197') + R(l + 2 * w / 3, t, w / 3, h, '#c4272e') + C(l + w / 6, cy, h * 0.12, '#f9cf02') + R(l + w * 0.14, t + h * 0.2, w * 0.04, h * 0.6, '#f9cf02'); break;
      default: g = R(l, t, w, h, '#ccc');
    }
    return `<g>${g}<rect x="${l}" y="${t}" width="${w}" height="${h}" fill="none" stroke="#ffffff" stroke-width="10"/></g>`;
  }

  function createCountryFlags(svgContainer) {
    const svg = getSvg(svgContainer);
    if (!svg) return;
    const old = svg.querySelector('#country-flags-layer');
    if (old) old.remove();
    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', 'country-flags-layer');
    layer.setAttribute('pointer-events', 'none');
    layer.innerHTML = FLAGS.map(f => buildFlag(f.c, f.x, f.y, FLAG_W, FLAG_H)).join('');
    svg.appendChild(layer);
  }

  // Big fading country names. Placed below the interactive markers layer (created
  // right after this) so markers stay on top and clickable; itself non-interactive.
  function createCountryLabels(svgContainer) {
    const svg = getSvg(svgContainer);
    if (!svg) return;
    const old = svg.querySelector('#country-labels-layer');
    if (old) old.remove();

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', 'country-labels-layer');
    layer.setAttribute('pointer-events', 'none');
    layer.style.transition = 'opacity 0.3s ease';

    const lang = (typeof I18n !== 'undefined' && I18n.getLang) ? I18n.getLang() : 'ru';
    COUNTRIES.forEach(c => {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('class', 'country-label');
      t.setAttribute('x', c.x);
      t.setAttribute('y', c.y);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      t.style.fontSize = `${c.fs}px`;
      t.textContent = c.name[lang] || c.name.ru;
      layer.appendChild(t);
    });

    svg.appendChild(layer);
    countryLayerRef = layer;
    layer.style.opacity = countryOpacity(currentZoomScale);
  }

  function getAllMarkers() { return allObjects; }

  return { init, refresh, showAll, showOnly, highlightMarker, getMarkerPosition, getMarkerSvgPoint, getAllMarkers, applyZoomScale, refreshLod: applyLabelLod };
})();
