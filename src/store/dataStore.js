// LISCR Global Data Store
// Connects PDAIP tasks, case files, and document uploads
// Linking key: IMO + DetentionDate

const store = {
  // All imported PDAIP tasks
  tasks: [],
  
  // All case files (vessels)
  cases: [],
  
  // Listeners for re-renders
  listeners: [],
  
  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  },
  
  notify() {
    this.listeners.forEach(fn => fn());
  },
  
  // Add or update a case file
  addCase(vessel) {
    const key = vessel.imo + "_" + vessel.detentionDate;
    const existing = this.cases.findIndex(c => c.imo === vessel.imo && c.detentionDate === vessel.detentionDate);
    if (existing >= 0) {
      this.cases[existing] = {...this.cases[existing], ...vessel};
    } else {
      this.cases.push({...vessel, id: vessel.id || Date.now() + Math.random()});
    }
    this.notify();
    return key;
  },
  
  // Add tasks from PDAIP import
  addTasks(newTasks) {
    newTasks.forEach(task => {
      const key = task.title + "_" + task.imo + "_" + task.detentionDate;
      const exists = this.tasks.find(t => t.title === task.title && t.imo === task.imo && t.detentionDate === task.detentionDate);
      if (!exists) {
        this.tasks.push({...task, id: task.id || "t_" + Date.now() + Math.random()});
      }
    });
    this.notify();
  },
  
  // Get tasks for a vessel
  getTasksForVessel(imo, detentionDate) {
    return this.tasks.filter(t => {
      if (t.imo !== imo) return false;
      if (detentionDate && t.detentionDate && t.detentionDate !== detentionDate) return false;
      return true;
    });
  },
  
  // Get all cases
  getAllCases() {
    return this.cases;
  },
  
  // Import summary
  getStats() {
    return {
      totalCases: this.cases.length,
      totalTasks: this.tasks.length,
      linkedTasks: this.tasks.filter(t => this.cases.find(c => c.imo === t.imo)).length,
      waitingTasks: this.tasks.filter(t => !this.cases.find(c => c.imo === t.imo)).length,
    };
  }
};

export default store;
