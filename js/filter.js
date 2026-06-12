const FilterManager = (() => {
  let isOpen = false;
  let currentFilters = { region: 'all', year: 'all', status: 'all', category: 'all' };
  let onFilterCallback = null;

  const elements = {
    panel: null,
    toggle: null,
    clear: null,
    apply: null,
    region: null,
    year: null,
    status: null,
    category: null,
    regionLabel: null,
    yearLabel: null,
    statusLabel: null,
    categoryLabel: null,
    title: null,
    countLabel: null,
    countValue: null,
  };

  function init(onFilter) {
    onFilterCallback = onFilter;

    elements.panel = document.getElementById('filter-panel');
    elements.toggle = document.getElementById('filter-toggle');
    elements.clear = document.getElementById('filter-clear');
    elements.apply = document.getElementById('filter-apply');
    elements.region = document.getElementById('filter-region');
    elements.year = document.getElementById('filter-year');
    elements.status = document.getElementById('filter-status');
    elements.category = document.getElementById('filter-category');
    elements.regionLabel = document.getElementById('filter-label-region');
    elements.yearLabel = document.getElementById('filter-label-year');
    elements.statusLabel = document.getElementById('filter-label-status');
    elements.categoryLabel = document.getElementById('filter-label-category');
    elements.title = document.getElementById('filter-title');
    elements.countLabel = document.getElementById('count-label');
    elements.countValue = document.getElementById('count-value');

    elements.toggle.addEventListener('click', toggle);
    elements.clear.addEventListener('click', clearAll);
    elements.apply.addEventListener('click', applyFilters);

    // Close filter panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!isOpen) return;
      const target = e.target;
      if (!elements.panel.contains(target) && target !== elements.toggle && !elements.toggle.contains(target)) {
        close();
      }
    });
  }

  function populateSelects() {
    // Regions
    const regions = DataLoader.getRegions();
    regions.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = I18n.tr(r);
      elements.region.appendChild(opt);
    });

    // Years
    const projects = DataLoader.getProjects();
    const years = [...new Set(projects.map(p => p.year))].sort((a, b) => b - a);
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      elements.year.appendChild(opt);
    });

    // Statuses
    const statuses = DataLoader.getStatuses();
    statuses.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = I18n.tr(s);
      elements.status.appendChild(opt);
    });

    // Categories
    const cats = DataLoader.getCategories();
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = I18n.tr(c);
      elements.category.appendChild(opt);
    });
  }

  function updateLabels() {
    elements.regionLabel.textContent = I18n.t('filter.region');
    elements.yearLabel.textContent = I18n.t('filter.year');
    elements.statusLabel.textContent = I18n.t('filter.status');
    elements.categoryLabel.textContent = I18n.t('filter.category');
    elements.title.textContent = I18n.t('app.toggleFilters');
    elements.clear.textContent = I18n.t('app.clear');
    const allText = I18n.t('filter.all');
    Array.from(document.querySelectorAll('.filter-group select option:first-child')).forEach(opt => {
      opt.textContent = allText;
    });
    repopulateOptions();
  }

  function repopulateOptions() {
    // Regions
    const regionSelect = elements.region;
    const currentRegion = regionSelect.value;
    while (regionSelect.options.length > 1) regionSelect.remove(1);
    DataLoader.getRegions().forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = I18n.tr(r);
      regionSelect.appendChild(opt);
    });
    regionSelect.value = currentRegion;

    // Statuses
    const statusSelect = elements.status;
    const currentStatus = statusSelect.value;
    while (statusSelect.options.length > 1) statusSelect.remove(1);
    DataLoader.getStatuses().forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = I18n.tr(s);
      statusSelect.appendChild(opt);
    });
    statusSelect.value = currentStatus;

    // Categories
    const catSelect = elements.category;
    const currentCat = catSelect.value;
    while (catSelect.options.length > 1) catSelect.remove(1);
    DataLoader.getCategories().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = I18n.tr(c);
      catSelect.appendChild(opt);
    });
    catSelect.value = currentCat;
  }

  function updateCount(count) {
    elements.countValue.textContent = count;
    elements.countLabel.textContent = I18n.t('app.showingProjects');
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  function open() {
    isOpen = true;
    elements.panel.classList.remove('hidden');
  }

  function close() {
    isOpen = false;
    elements.panel.classList.add('hidden');
  }

  function applyFilters() {
    currentFilters = {
      region: elements.region.value,
      year: elements.year.value,
      status: elements.status.value,
      category: elements.category.value,
    };
    if (onFilterCallback) onFilterCallback(currentFilters);
    close();
  }

  function clearAll() {
    elements.region.value = 'all';
    elements.year.value = 'all';
    elements.status.value = 'all';
    elements.category.value = 'all';
    applyFilters();
  }

  function getFilters() { return { ...currentFilters }; }

  return { init, populateSelects, updateLabels, updateCount, toggle, close, open, getFilters, applyFilters, clearAll };
})();
