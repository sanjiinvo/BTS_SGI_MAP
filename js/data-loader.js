const DataLoader = (() => {
  let data = null;
  let regions = [];
  let statuses = [];
  let projects = [];

  async function init() {
    try {
      const res = await fetch(`data/projects.json?v=${Date.now()}`, { cache: 'no-store' });
      data = await res.json();
      regions = data.regions || [];
      statuses = data.statuses || [];
      projects = data.projects || [];
      return true;
    } catch (e) {
      console.error('Failed to load project data:', e);
      return false;
    }
  }

  function getRegions() { return regions; }
  function getStatuses() { return statuses; }
  function getProjects() { return projects; }

  function getProjectById(id) {
    return projects.find(p => p.id === id) || null;
  }

  // "label" entries are place-name / station markers for context, NOT projects.
  // Real projects are the line and point entries — that is what the counter shows.
  function isRealProject(p) {
    return p && p.type !== 'label';
  }

  function countProjects(list) {
    return (list || projects).filter(isRealProject).length;
  }


  function addProject(project) {
    projects.push(project);
    if (data) data.projects = projects;
    return project;
  }

  function updateProject(projectId, patch) {
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx === -1) return null;
    projects[idx] = { ...projects[idx], ...patch };
    if (data) data.projects = projects;
    return projects[idx];
  }

  function removeProject(projectId) {
    const before = projects.length;
    projects = projects.filter(p => p.id !== projectId);
    if (data) data.projects = projects;
    return projects.length !== before;
  }

  function getData() {
    return data;
  }

  function exportJson() {
    return JSON.stringify({
      regions,
      statuses,
      projects
    }, null, 2);
  }

  function getFilteredProjects(filters) {
    return projects.filter(p => {
      if (filters.region && filters.region !== 'all' && p.region !== filters.region) return false;
      if (filters.year && filters.year !== 'all') {
        const yearStr = String(p.year);
        if (filters.year === '2026' && p.year < 2026) return false;
        if (filters.year === '2022' && p.year !== 2022) return false;
        if (filters.year === '2023' && p.year !== 2023) return false;
        if (filters.year === '2024' && p.year !== 2024) return false;
        if (filters.year === '2025' && p.year !== 2025) return false;
        if (filters.year === '2026' && p.year !== 2026) return false;
      }
      if (filters.status && filters.status !== 'all' && p.status !== filters.status) return false;
      return true;
    });
  }

  return { init, getRegions, getStatuses, getProjects, getProjectById, getFilteredProjects, countProjects, isRealProject, addProject, updateProject, removeProject, getData, exportJson };
})();
