const Markers = (() => {
  let allObjects = {};
  let activeObjectId = null;
  let onObjectClickCallback = null;
  let svgContainerRef = null;
  let lastPointerOpenAt = 0;
  let displayViewBox = null;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LEGACY_VIEWBOX = { x: 0, y: 0, width: 4127.1641, height: 2050.417 };
  const STATUS_COLORS = {
    'completed': '#00c853',
    'in-progress': '#ffc107',
    'planning': '#3a7bd5'
  };

  function init(svgContainer, onClick) {
    svgContainerRef = svgContainer;
    onObjectClickCallback = onClick;
    allObjects = {};
    displayViewBox = parseViewBox(getSvg(svgContainer)?.getAttribute('viewBox'));
    createObjectLayer(svgContainer);
    createObjects(svgContainer);
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
    svg.appendChild(layer);
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

    const startNode = createLineEndpoint(points[0], color, 'start', I18n.tr(project.endpoints?.start?.name));
    const endNode = createLineEndpoint(points[points.length - 1], color, 'end', I18n.tr(project.endpoints?.end?.name));
    const stationNodes = points
      .slice(1, -1)
      .map((point, index) => createLineStation(point, color, getLineStationName(project, index + 1)));

    group.appendChild(hitLine);
    group.appendChild(glowLine);
    group.appendChild(visibleLine);
    stationNodes.forEach(node => group.appendChild(node));
    group.appendChild(startNode);
    group.appendChild(endNode);
    bindObjectEvents(group, project.id);
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
    label.setAttribute('x', '14');
    label.setAttribute('y', '-10');
    label.textContent = I18n.tr(project.name);

    group.appendChild(hitArea);
    group.appendChild(outer);
    group.appendChild(inner);
    group.appendChild(label);
    bindObjectEvents(group, project.id);
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

  function createLineEndpoint(point, color, type, name = '') {
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

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', point[0]);
    dot.setAttribute('cy', point[1]);
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', color);
    group.appendChild(dot);

    if (name) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'map-line-endpoint-label');
      text.setAttribute('x', point[0] + 14);
      text.setAttribute('y', point[1] - 10);
      text.textContent = name;
      group.appendChild(text);
    }

    return group;
  }

  function createLineStation(point, color, name = '') {
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

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', point[0]);
    dot.setAttribute('cy', point[1]);
    dot.setAttribute('r', '2.6');
    dot.setAttribute('fill', color);
    group.appendChild(dot);

    if (name) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'map-line-station-label');
      text.setAttribute('x', point[0] + 11);
      text.setAttribute('y', point[1] - 8);
      text.textContent = name;
      group.appendChild(text);
    }

    return group;
  }

  function getLineStationName(project, pointIndex) {
    const station = project.stations?.[pointIndex];
    if (!station) return '';
    return I18n.tr(station.name || station);
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
    createObjectLayer(svgContainerRef);
    createObjects(svgContainerRef);
    if (activeObjectId) highlightMarker(activeObjectId);
  }

  function getAllMarkers() { return allObjects; }

  return { init, refresh, showAll, showOnly, highlightMarker, getMarkerPosition, getMarkerSvgPoint, getAllMarkers };
})();
