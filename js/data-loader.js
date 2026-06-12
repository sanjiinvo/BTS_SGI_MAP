const DataLoader = (() => {
  let data = null;
  let regions = [];
  let statuses = [];
  let categories = [];
  let projects = [];

  async function init() {
    try {
      const res = await fetch('data/projects.json');
      data = await res.json();
      regions = data.regions || [];
      statuses = data.statuses || [];
      categories = data.categories || [];
      projects = data.projects || [];
      return true;
    } catch (e) {
      console.error('Failed to load project data:', e);
      return false;
    }
  }

  function getRegions() { return regions; }
  function getStatuses() { return statuses; }
  function getCategories() { return categories; }
  function getProjects() { return projects; }

  function getProjectById(id) {
    return projects.find(p => p.id === id) || null;
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
      categories,
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
      if (filters.category && filters.category !== 'all' && p.category !== filters.category) return false;
      return true;
    });
  }

  return { init, getRegions, getStatuses, getCategories, getProjects, getProjectById, getFilteredProjects, addProject, updateProject, removeProject, getData, exportJson };
})();
