const Markers = (() => {
  let allMarkers = {};
  let activeMarkerId = null;
  let onMarkerClickCallback = null;
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
    onMarkerClickCallback = onClick;
    allMarkers = {};
    createMarkerLayer(svgContainer);
    createMarkers(svgContainer);
  }

  function getSvg(svgContainer) {
    return svgContainer.querySelector('svg');
  }

  function createMarkerLayer(svgContainer) {
    const svg = getSvg(svgContainer);
    if (!svg) return;

    const oldLayer = svg.querySelector('#interactive-markers-layer');
    if (oldLayer) oldLayer.remove();

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', 'interactive-markers-layer');
    svg.appendChild(layer);
  }

  function createMarkers(svgContainer) {
    const svg = getSvg(svgContainer);
    const layer = svg?.querySelector('#interactive-markers-layer');
    if (!svg || !layer) return;

    const projects = DataLoader.getProjects();

    projects.forEach(proj => {
      const markerGroup = document.createElementNS(SVG_NS, 'g');
      markerGroup.setAttribute('class', 'map-marker');
      markerGroup.setAttribute('transform', `translate(${proj.x}, ${proj.y})`);
      markerGroup.dataset.projectId = proj.id;
      markerGroup.dataset.markerRole = 'project-marker';
      markerGroup.setAttribute('tabindex', '0');
      markerGroup.setAttribute('role', 'button');

      const hitArea = document.createElementNS(SVG_NS, 'circle');
      hitArea.setAttribute('class', 'map-marker-hitarea');
      hitArea.setAttribute('cx', '0');
      hitArea.setAttribute('cy', '0');
      hitArea.setAttribute('r', '26');

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

      const color = proj.color || STATUS_COLORS[proj.status] || '#00d4ff';

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('class', 'map-marker-circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', '9');
      circle.setAttribute('fill', color);

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


      markerGroup.addEventListener('marker-tap', (e) => {
        e.stopPropagation();
        lastPointerOpenAt = Date.now();
        if (onMarkerClickCallback) onMarkerClickCallback(proj.id);
      });

      // Mouse-only fallback for development on a PC.
      // Touch/pen taps are handled by SvgViewBoxZoom through the custom marker-tap event,
      // because the map container uses pointer capture for smooth pan/pinch gestures.
      markerGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        if (Date.now() - lastPointerOpenAt < 500) return;
        if (window.SvgViewBoxZoom?.wasGestureMoved?.()) return;
        if (onMarkerClickCallback) onMarkerClickCallback(proj.id);
      });

      markerGroup.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onMarkerClickCallback) onMarkerClickCallback(proj.id);
        }
      });

      // Do not open cards on touchstart: it breaks two-finger pinch gestures.
      // A normal tap will still fire click after the gesture ends.

      layer.appendChild(markerGroup);
      allMarkers[proj.id] = { element: markerGroup, data: proj };
    });
  }

  function showAll() {
    Object.values(allMarkers).forEach(m => {
      m.element.style.display = '';
    });
  }

  function showOnly(projectIds) {
    Object.values(allMarkers).forEach(m => {
      const match = projectIds.includes(m.data.id);
      m.element.style.display = match ? '' : 'none';
    });
  }

  function highlightMarker(projectId) {
    Object.values(allMarkers).forEach(m => {
      m.element.classList.remove('marker-pulsing', 'active-pulse');
    });
    if (projectId && allMarkers[projectId]) {
      allMarkers[projectId].element.classList.add('marker-pulsing', 'active-pulse');
      activeMarkerId = projectId;
    } else {
      activeMarkerId = null;
    }
  }

  function getMarkerPosition(projectId) {
    const m = allMarkers[projectId];
    if (!m) return null;
    const svg = m.element.closest('svg');
    if (!svg) return { x: m.data.x, y: m.data.y };

    const pt = svg.createSVGPoint();
    pt.x = m.data.x;
    pt.y = m.data.y;
    const screenPoint = pt.matrixTransform(svg.getScreenCTM());

    return { x: screenPoint.x, y: screenPoint.y };
  }


  function refresh() {
    if (!svgContainerRef) return;
    createMarkerLayer(svgContainerRef);
    createMarkers(svgContainerRef);
    if (activeMarkerId) highlightMarker(activeMarkerId);
  }

  function getAllMarkers() { return allMarkers; }

  return { init, refresh, showAll, showOnly, highlightMarker, getMarkerPosition, getAllMarkers };
})();
