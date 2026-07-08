const DemoMode = (() => {
  const INACTIVITY_TIMEOUT = 60000;
  const CARD_DURATION = 5000;
  const TRANSITION_DELAY = 1000;

  let timer = null;
  let isActive = false;
  let isRunning = false;
  let projectQueue = [];
  let currentIndex = 0;
  let intervalId = null;
  let onShowProject = null;
  let demoIndicator = null;

  function init(onShow) {
    onShowProject = onShow;
    demoIndicator = document.getElementById('demo-indicator');

    // Reset timer on user interaction
    const events = ['click', 'touchstart', 'touchmove', 'keydown', 'mousemove', 'mousedown', 'scroll'];
    const resetHandler = () => {
      if (isActive) stop();
      resetTimer();
    };
    // Capture phase: this must run BEFORE the click's own target handler
    // (e.g. opening the project list or a marker), otherwise stop() below
    // would call ProjectCard.close() right after that handler just opened it,
    // making the very first click after idle appear to do nothing.
    events.forEach(evt => {
      document.addEventListener(evt, resetHandler, { passive: true, capture: true });
    });

    resetTimer();
  }

  function resetTimer() {
    if (timer) clearTimeout(timer);
    if (isActive) return;
    timer = setTimeout(() => {
      start();
    }, INACTIVITY_TIMEOUT);
  }

  function start() {
    if (isActive || isRunning) return;
    isActive = true;
    isRunning = true;

    const allProjects = DataLoader.getProjects();
    if (allProjects.length === 0) {
      isRunning = false;
      return;
    }

    projectQueue = [...allProjects];
    currentIndex = 0;

    // Show indicator
    if (demoIndicator) {
      demoIndicator.classList.remove('hidden');
      document.getElementById('demo-label').textContent = I18n.t('app.demoMode');
    }

    // Add visible class
    demoIndicator.classList.add('demo-visible');

    showNextProject();
  }

  function showNextProject() {
    if (!isRunning || projectQueue.length === 0) {
      stop();
      return;
    }

    const project = projectQueue[currentIndex];
    if (project) {
      Markers.highlightMarker(project.id);
      if (onShowProject) onShowProject(project.id);
    }

    currentIndex++;
    if (currentIndex >= projectQueue.length) {
      currentIndex = 0;
    }

    if (intervalId) clearInterval(intervalId);
    intervalId = setTimeout(() => {
      showNextProject();
    }, CARD_DURATION + TRANSITION_DELAY);
  }

  function stop() {
    const wasActive = isActive;
    isActive = false;
    isRunning = false;
    if (intervalId) {
      clearTimeout(intervalId);
      intervalId = null;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    Markers.highlightMarker(null);
    if (demoIndicator) {
      demoIndicator.classList.add('hidden');
      demoIndicator.classList.remove('demo-visible');
    }
    // Only close the card if demo mode itself put it on screen. stop() is also
    // called defensively by unrelated user actions (opening the project list,
    // clicking a marker) that are about to show their own card right after -
    // unconditionally closing here would undo that in the same tick.
    if (wasActive) ProjectCard.close();
    resetTimer();
  }

  function isDemoActive() { return isActive; }

  return { init, start, stop, isDemoActive };
})();
