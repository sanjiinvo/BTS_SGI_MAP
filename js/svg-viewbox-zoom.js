const SvgViewBoxZoom = (() => {
  let svg = null;
  let container = null;
  let baseViewBox = null;
  let currentViewBox = null;
  let activePointers = new Map();
  let gesture = null;
  let moved = false;
  let hadMultiTouch = false;
  let lastTapTarget = null;

  const options = {
    minZoom: 1,
    maxZoom: 10,
    tapMoveTolerance: 14,
    onMapTap: null
  };

  function parseViewBox(value) {
    const parts = String(value || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);

    if (parts.length !== 4) return null;
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }

  function cloneBox(box) {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  function setViewBox(box) {
    currentViewBox = clampViewBox(box);
    svg.setAttribute(
      'viewBox',
      `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`
    );
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clampViewBox(box) {
    const minWidth = baseViewBox.width / options.maxZoom;
    const maxWidth = baseViewBox.width / options.minZoom;

    const width = clamp(box.width, minWidth, maxWidth);
    const height = width * (baseViewBox.height / baseViewBox.width);

    let x = box.x;
    let y = box.y;

    if (width >= baseViewBox.width) {
      x = baseViewBox.x;
    } else {
      x = clamp(x, baseViewBox.x, baseViewBox.x + baseViewBox.width - width);
    }

    if (height >= baseViewBox.height) {
      y = baseViewBox.y;
    } else {
      y = clamp(y, baseViewBox.y, baseViewBox.y + baseViewBox.height - height);
    }

    return { x, y, width, height };
  }

  function clientToSvg(clientX, clientY) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function distance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function midpoint(a, b) {
    return {
      clientX: (a.clientX + b.clientX) / 2,
      clientY: (a.clientY + b.clientY) / 2
    };
  }

  function pointerArray() {
    return Array.from(activePointers.values());
  }

  function findMarkerTarget(target) {
    return target?.closest?.('.map-object, .map-marker, .map-line') || null;
  }

  function init(svgElement, containerElement, customOptions = {}) {
    svg = svgElement;
    container = containerElement;
    Object.assign(options, customOptions);

    baseViewBox = parseViewBox(svg.getAttribute('viewBox'));
    if (!baseViewBox) {
      const w = parseFloat(svg.getAttribute('width')) || 4127.1641;
      const h = parseFloat(svg.getAttribute('height')) || 2050.417;
      baseViewBox = { x: 0, y: 0, width: w, height: h };
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    currentViewBox = cloneBox(baseViewBox);
    setViewBox(currentViewBox);

    container.style.touchAction = 'none';
    svg.style.touchAction = 'none';

    container.addEventListener('pointerdown', onPointerDown, { passive: false });
    container.addEventListener('pointermove', onPointerMove, { passive: false });
    container.addEventListener('pointerup', onPointerUp, { passive: false });
    container.addEventListener('pointercancel', onPointerCancel, { passive: false });
    container.addEventListener('lostpointercapture', onPointerCancel, { passive: false });
    container.addEventListener('wheel', onWheel, { passive: false });
  }

  function onPointerDown(e) {
    if (!svg || !container) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    container.setPointerCapture?.(e.pointerId);

    const marker = findMarkerTarget(e.target);
    const pointer = {
      id: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTarget: e.target,
      startMarker: marker
    };

    activePointers.set(e.pointerId, pointer);

    if (activePointers.size === 1) {
      moved = false;
      hadMultiTouch = false;
      lastTapTarget = marker;
    } else {
      hadMultiTouch = true;
      lastTapTarget = null;
    }

    const pointers = pointerArray();

    if (pointers.length === 1) {
      gesture = {
        type: 'pan',
        startPointer: { ...pointers[0] },
        startViewBox: cloneBox(currentViewBox),
        lastSvgPoint: clientToSvg(e.clientX, e.clientY)
      };
    }

    if (pointers.length === 2) {
      startPinchGesture(pointers[0], pointers[1]);
    }
  }

  function onPointerMove(e) {
    if (!activePointers.has(e.pointerId)) return;
    e.preventDefault();

    const pointer = activePointers.get(e.pointerId);
    pointer.clientX = e.clientX;
    pointer.clientY = e.clientY;

    if (Math.hypot(pointer.clientX - pointer.startClientX, pointer.clientY - pointer.startClientY) > options.tapMoveTolerance) {
      moved = true;
      lastTapTarget = null;
    }

    const pointers = pointerArray();

    if (pointers.length >= 2) {
      hadMultiTouch = true;
      lastTapTarget = null;
      if (!gesture || gesture.type !== 'pinch') {
        startPinchGesture(pointers[0], pointers[1]);
      }
      updatePinchGesture(pointers[0], pointers[1]);
      return;
    }

    if (pointers.length === 1 && gesture?.type === 'pan') {
      updatePanGesture(pointers[0]);
    }
  }

  function onPointerUp(e) {
    const releasedPointer = activePointers.get(e.pointerId);
    const isOnlyActivePointer = activePointers.size === 1;
    const markerToTap = isOnlyActivePointer && !moved && !hadMultiTouch
      ? (releasedPointer?.startMarker || lastTapTarget)
      : null;

    if (activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);

    if (markerToTap) {
      markerToTap.dispatchEvent(new CustomEvent('marker-tap', {
        bubbles: true,
        detail: { pointerType: e.pointerType }
      }));
    } else if (isOnlyActivePointer && !moved && !hadMultiTouch && releasedPointer && typeof options.onMapTap === 'function') {
      options.onMapTap({
        clientX: e.clientX,
        clientY: e.clientY,
        svgPoint: clientToSvg(e.clientX, e.clientY),
        originalEvent: e
      });
    }

    const pointers = pointerArray();

    if (pointers.length === 1) {
      gesture = {
        type: 'pan',
        startPointer: { ...pointers[0] },
        startViewBox: cloneBox(currentViewBox),
        lastSvgPoint: clientToSvg(pointers[0].clientX, pointers[0].clientY)
      };
      return;
    }

    if (pointers.length === 0) {
      gesture = null;
      lastTapTarget = null;
      window.setTimeout(() => {
        moved = false;
        hadMultiTouch = false;
      }, 0);
    }
  }

  function onPointerCancel(e) {
    if (activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);
    if (activePointers.size === 0) {
      gesture = null;
      lastTapTarget = null;
      moved = false;
      hadMultiTouch = false;
    }
  }

  function startPinchGesture(a, b) {
    const mid = midpoint(a, b);
    const centerSvg = clientToSvg(mid.clientX, mid.clientY);

    gesture = {
      type: 'pinch',
      startDistance: Math.max(distance(a, b), 1),
      startViewBox: cloneBox(currentViewBox),
      centerSvg
    };
  }

  function updatePinchGesture(a, b) {
    if (!gesture || gesture.type !== 'pinch') return;

    const currentDistance = Math.max(distance(a, b), 1);
    const scale = gesture.startDistance / currentDistance;

    let nextWidth = gesture.startViewBox.width * scale;
    const minWidth = baseViewBox.width / options.maxZoom;
    const maxWidth = baseViewBox.width / options.minZoom;
    nextWidth = clamp(nextWidth, minWidth, maxWidth);

    const nextHeight = nextWidth * (baseViewBox.height / baseViewBox.width);
    const ratioX = (gesture.centerSvg.x - gesture.startViewBox.x) / gesture.startViewBox.width;
    const ratioY = (gesture.centerSvg.y - gesture.startViewBox.y) / gesture.startViewBox.height;

    setViewBox({
      x: gesture.centerSvg.x - ratioX * nextWidth,
      y: gesture.centerSvg.y - ratioY * nextHeight,
      width: nextWidth,
      height: nextHeight
    });
  }

  function updatePanGesture(pointer) {
    const currentSvgPoint = clientToSvg(pointer.clientX, pointer.clientY);
    const dx = gesture.lastSvgPoint.x - currentSvgPoint.x;
    const dy = gesture.lastSvgPoint.y - currentSvgPoint.y;

    setViewBox({
      x: currentViewBox.x + dx,
      y: currentViewBox.y + dy,
      width: currentViewBox.width,
      height: currentViewBox.height
    });
  }

  function onWheel(e) {
    e.preventDefault();

    const centerSvg = clientToSvg(e.clientX, e.clientY);
    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
    let nextWidth = currentViewBox.width * zoomFactor;
    const minWidth = baseViewBox.width / options.maxZoom;
    const maxWidth = baseViewBox.width / options.minZoom;
    nextWidth = clamp(nextWidth, minWidth, maxWidth);

    const nextHeight = nextWidth * (baseViewBox.height / baseViewBox.width);
    const ratioX = (centerSvg.x - currentViewBox.x) / currentViewBox.width;
    const ratioY = (centerSvg.y - currentViewBox.y) / currentViewBox.height;

    setViewBox({
      x: centerSvg.x - ratioX * nextWidth,
      y: centerSvg.y - ratioY * nextHeight,
      width: nextWidth,
      height: nextHeight
    });
  }

  function reset() {
    if (!baseViewBox) return;
    setViewBox(cloneBox(baseViewBox));
  }

  function wasGestureMoved() {
    return moved || hadMultiTouch;
  }

  function getCurrentViewBox() {
    return cloneBox(currentViewBox);
  }

  return { init, reset, wasGestureMoved, getCurrentViewBox, clientToSvg };
})();
window.SvgViewBoxZoom = SvgViewBoxZoom;
