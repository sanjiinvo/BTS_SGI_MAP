const Markers = (() => {
  let allObjects = {};
  let activeObjectId = null;
  let onObjectClickCallback = null;
  let svgContainerRef = null;
  let lastPointerOpenAt = 0;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STATUS_COLORS = {
    'completed': '#00c853',
    'in-progress': '#ffc107',
    'planning': '#3a7bd5'
  };

  function init(svgContainer, onClick) {
    svgContainerRef = svgContainer;
    onObjectClickCallback = onClick;
    allObjects = {};
    createObjectLayer(svgContainer);
    createObjects(svgContainer);
  }

  function getSvg(svgContainer) {
    return svgContainer.querySelector('svg');
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

    const projects = DataLoader.getProjects();

    projects.forEach(project => {
      const object = project.type === 'line'
        ? createLineObject(project)
        : createPointObject(project);

      if (!object) return;
      layer.appendChild(object);
      allObjects[project.id] = { element: object, data: project };
    });
  }

  function getColor(project) {
    return project.color || STATUS_COLORS[project.status] || '#00d4ff';
  }

  function createPointObject(project) {
    if (!Number.isFinite(Number(project.x)) || !Number.isFinite(Number(project.y))) return null;

    const markerGroup = document.createElementNS(SVG_NS, 'g');
    markerGroup.setAttribute('class', 'map-object map-marker');
    markerGroup.setAttribute('transform', `translate(${project.x}, ${project.y})`);
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
    const points = normalizeLinePoints(project.points || project.geometry);
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

    const startNode = createLineEndpoint(points[0], color, 'start');
    const endNode = createLineEndpoint(points[points.length - 1], color, 'end');

    group.appendChild(hitLine);
    group.appendChild(glowLine);
    group.appendChild(visibleLine);
    group.appendChild(startNode);
    group.appendChild(endNode);
    bindObjectEvents(group, project.id);
    return group;
  }

  function normalizeLinePoints(points) {
    if (!Array.isArray(points)) return [];
    return points
      .map(p => Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p?.x), Number(p?.y)])
      .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }

  function createLineEndpoint(point, color, type) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', `map-line-endpoint ${type}`);
    circle.setAttribute('cx', point[0]);
    circle.setAttribute('cy', point[1]);
    circle.setAttribute('r', '7');
    circle.setAttribute('fill', color);
    return circle;
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

    let pointData = null;
    if (m.data.type === 'line') {
      const pts = normalizeLinePoints(m.data.points || m.data.geometry);
      if (pts.length > 0) pointData = pts[Math.floor(pts.length / 2)];
    } else {
      pointData = [Number(m.data.x), Number(m.data.y)];
    }
    if (!pointData) return null;

    const pt = svg.createSVGPoint();
    pt.x = pointData[0];
    pt.y = pointData[1];
    const screenPoint = pt.matrixTransform(svg.getScreenCTM());
    return { x: screenPoint.x, y: screenPoint.y };
  }

  function refresh() {
    if (!svgContainerRef) return;
    createObjectLayer(svgContainerRef);
    createObjects(svgContainerRef);
    if (activeObjectId) highlightMarker(activeObjectId);
  }

  function getAllMarkers() { return allObjects; }

  return { init, refresh, showAll, showOnly, highlightMarker, getMarkerPosition, getAllMarkers };
})();
