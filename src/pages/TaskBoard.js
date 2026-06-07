import React, { useState, useEffect } from 'react';
import EditModal from '../components/EditModal';
import { getTasks, updateTaskStatus } from '../lib/supabase';
import './TaskBoard.css';

const SEED_TASKS = [
  { id:'t1',  vessel_name:'OCEAN GALAXY', imo:'9852705', status:'To Do',      priority:'High',   title:'Submit external Flag State audit (MLC Title 4 + ISM 7/8/12) to Maritime NZ — vessel release depends on this.', assigned_to:'cedric.dsouza@liscr.com', due_date:'2026-06-01', task_type:'Rectification', remark:'CRITICAL — vessel cannot depart without this' },
  { id:'t2',  vessel_name:'OCEAN GALAXY', imo:'9852705', status:'To Do',      priority:'High',   title:'Investigate fraudulent Official Log Book entry (def 8, code 11134). Notify DPA and Flag State. Preserve crew testimony.', assigned_to:'nwitt@liscr.com', due_date:'2026-06-01', task_type:'Investigation', remark:'[FRAUDULENT RECORD]' },
  { id:'t3',  vessel_name:'OCEAN GALAXY', imo:'9852705', status:'To Do',      priority:'High',   title:'Whistleblower protocol — senior approval required before any HMM contact. Do not disclose source.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-01', task_type:'Administrative', remark:'[WHISTLEBLOWER]' },
  { id:'t4',  vessel_name:'OCEAN GALAXY', imo:'9852705', status:'To Do',      priority:'High',   title:'KR RO oversight: 26-day survey gap, 0 findings vs 9 ISM deficiencies. Send formal letter asking which records were reviewed.', assigned_to:'gdesciora@liscr.com', due_date:'2026-06-08', task_type:'RO Oversight', remark:'[RO SURVEY GAP]' },
  { id:'t5',  vessel_name:'OCEAN GALAXY', imo:'9852705', status:'To Do',      priority:'High',   title:'HMM company outreach: 5 detentions/24 months, HRS, Seoul RO engagement, fleet-wide SMS review.', assigned_to:'cedric.dsouza@liscr.com', due_date:'2026-06-15', task_type:'Administrative', remark:'Do not contact until whistleblower protocol cleared' },
  { id:'t6',  vessel_name:'OCEAN GALAXY', imo:'9852705', status:'To Do',      priority:'Medium', title:'Prepare HMM client report and escalate MLC and ISM failure issues.', assigned_to:'cedric.dsouza@liscr.com', due_date:'2026-06-22', task_type:'Administrative', remark:null },
  { id:'t7',  vessel_name:'SOPOT',        imo:'9727522', status:'Executed',   priority:'Medium', title:'Appeal submitted; awaiting USCG investigation report on alleged garbage pollution before finalizing.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-22', task_type:'Administrative', remark:null, actions_taken:'Waiting for USCG investigation report' },
  { id:'t8',  vessel_name:'MORNING CLOUD',imo:'9532197', status:'To Do',      priority:'Medium', title:'Conduct inspector oversight.', assigned_to:'cbrunclik@liscr.com', due_date:'2026-06-22', task_type:'Administrative', remark:null },
  { id:'t9',  vessel_name:'SVR MERCURY',  imo:'8822600', status:'Executed',   priority:'Medium', title:'Cancel this vessel. Cancellation letter sent 01 June 2026.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-15', task_type:'Administrative', remark:null, actions_taken:'Cancellation letter sent 01 June 2026' },
  { id:'t10', vessel_name:'SVR MERCURY',  imo:'8822600', status:'To Do',      priority:'Medium', title:'Coordinate internally to review Waypoint; follow up on NOC, COM, and Doc Audit to ensure all items are closed.', assigned_to:'ncampbell@liscr.com', due_date:'2026-06-23', task_type:'Administrative', remark:null },
  { id:'t11', vessel_name:'AMI',          imo:'9303833', status:'To Do',      priority:'Medium', title:'Remind company of EPL limitations (POL-16 MA). Brief DO, Vetter, and Operations on shared process.', assigned_to:'gdesciora@liscr.com', due_date:'2026-06-22', task_type:'Administrative', remark:null },
  { id:'t12', vessel_name:'AMI',          imo:'9303833', status:'To Do',      priority:'Medium', title:'Prepare company summary, schedule meeting, and board vessel on every single call.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-15', task_type:'Administrative', remark:null },
  { id:'t13', vessel_name:'SEALAND LOS ANGELES', imo:'9383235', status:'To Do', priority:'Medium', title:'Conduct RO oversight review with DNV.', assigned_to:'gdesciora@liscr.com', due_date:'2026-06-22', task_type:'RO Oversight', remark:'Prior inspection in March was remote. Next must be physical boarding.' },
  { id:'t14', vessel_name:'MARIELENA',    imo:'9376359', status:'To Do',      priority:'Medium', title:'Investigate with Claas.', assigned_to:'gdesciora@liscr.com', due_date:'2026-06-22', task_type:'Investigation', remark:null },
  { id:'t15', vessel_name:'ATHINA L',     imo:'9487627', status:'To Do',      priority:'Medium', title:'Arrange meeting with ABS; provide vessel name in advance.', assigned_to:'gdesciora@liscr.com', due_date:'2026-06-22', task_type:'Administrative', remark:'Kyla Shipping already scheduled meeting with Rod.' },
  { id:'t16', vessel_name:'WANTAI',       imo:'9168207', status:'To Do',      priority:'Medium', title:'Investigate corrosion findings.', assigned_to:'gdesciora@liscr.com', due_date:'2026-06-22', task_type:'Investigation', remark:null },
  { id:'t17', vessel_name:'HONG BO 18',   imo:'9713014', status:'Executed',   priority:'Medium', title:'Check with China office to obtain relevant information and documentation.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-22', task_type:'Administrative', remark:null, actions_taken:'Repeated task, already handled.' },
  { id:'t18', vessel_name:'CONTSHIP CUB', imo:'9683477', status:'In Progress',priority:'Medium', title:'Company outreach and remind coordinators to follow PSC procedures when previous deficiencies exist.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-03', task_type:'Administrative', remark:null },
  { id:'t19', vessel_name:'CONTSHIP CUB', imo:'9683477', status:'To Do',      priority:'Medium', title:'Conduct follow-up investigation after incident reporting, especially Paris MoU cases.', assigned_to:'fhannan@liscr.com', due_date:'2026-06-03', task_type:'Investigation', remark:null },
  { id:'t20', vessel_name:'EVELPIS',      imo:'9548158', status:'Executed',   priority:'Medium', title:'Streamline casualty investigation process and improve follow-up procedures for timely reporting.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-03', task_type:'Administrative', remark:null },
  { id:'t21', vessel_name:'PACIFIC BLESSING', imo:'9848089', status:'Executed', priority:'Medium', title:'Review fleet and track vessels going to Australia for proactive monitoring and follow-up.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-03', task_type:'Administrative', remark:null, actions_taken:'Fleet checked, Vetting team informed.' },
  { id:'t22', vessel_name:'ILIANA',       imo:'9490715', status:'Executed',   priority:'Medium', title:'Inactivate Romania inspection and review inspector concerns related to Vladyslav Dzhagaiev.', assigned_to:'asrivastava@liscr.com', due_date:'2026-06-03', task_type:'Administrative', remark:null },
];

const COLUMNS = ['To Do', 'In Progress', 'Executed'];
const VESSELS_FILTER = ['All vessels','OCEAN GALAXY','SOPOT','MORNING CLOUD','SVR MERCURY','AMI','SEALAND LOS ANGELES','MARIELENA','ATHINA L','WANTAI','HONG BO 18','CONTSHIP CUB','EVELPIS','PACIFIC BLESSING','ILIANA'];
const OWNERS = ['All owners','asrivastava@liscr.com','gdesciora@liscr.com','cedric.dsouza@liscr.com','nwitt@liscr.com','cbrunclik@liscr.com','ncampbell@liscr.com','fhannan@liscr.com'];

export default function TaskBoard() {
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [filterOwner, setFilterOwner] = useState('All owners');
  const [filterVessel, setFilterVessel] = useState('All vessels');
  const [filterPriority, setFilterPriority] = useState('All');
  const [search, setSearch] = useState('');
  const [editTask, setEditTask] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    getTasks().then(d => { if (d?.length) setTasks(d); }).catch(() => {});
  }, []);

  const filtered = tasks.filter(t => {
    if (filterOwner !== 'All owners' && t.assigned_to !== filterOwner) return false;
    if (filterVessel !== 'All vessels' && t.vessel_name !== filterVessel) return false;
    if (filterPriority !== 'All' && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.vessel_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function updateStatus(id, newStatus) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try { await updateTaskStatus(id, newStatus); } catch {}
  }

  const cols = COLUMNS.map(col => ({ name: col, tasks: filtered.filter(t => t.status === col) }));
  const openCount = tasks.filter(t => t.status !== 'Executed').length;
  const oceanCount = tasks.filter(t => t.vessel_name === 'OCEAN GALAXY' && t.status !== 'Executed').length;

  return (
    <div className="task-page">
      <div className="task-header">
        <div>
          <h1 className="page-title">PDAIP Task Board</h1>
          <div className="mono muted" style={{fontSize:'10px',marginTop:'3px'}}>Post Detention Analysis and Improvement Program · May 2026 · {openCount} open tasks</div>
        </div>
        <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
          {oceanCount > 0 && <div className="flag flag-red" style={{fontSize:'11px',padding:'5px 10px'}}>OCEAN GALAXY: {oceanCount} open critical actions</div>}
          <button className="btn btn-primary" onClick={() => setShowNewTask(true)}>+ New task</button>
        </div>
      </div>

      <div className="task-filters">
        <input className="input" style={{maxWidth:220}} placeholder="Search tasks or vessels…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select input" style={{maxWidth:180}} value={filterVessel} onChange={e => setFilterVessel(e.target.value)}>
          {VESSELS_FILTER.map(v => <option key={v}>{v}</option>)}
        </select>
        <select className="select input" style={{maxWidth:200}} value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
          {OWNERS.map(o => <option key={o}>{o}</option>)}
        </select>
        <select className="select input" style={{maxWidth:120}} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option>All</option><option>High</option><option>Medium</option>
        </select>
        <div className="mono muted" style={{fontSize:'11px',marginLeft:'auto'}}>{filtered.length} tasks · {cols[0].tasks.length} to do · {cols[1].tasks.length} in progress · {cols[2].tasks.length} executed</div>
      </div>

      <div className="kanban">
        {cols.map(col => (
          <div key={col.name} className="kanban-col">
            <div className="col-header">
              <div className="col-title">
                <span className={`col-dot ${col.name === 'To Do' ? 'col-dot--todo' : col.name === 'In Progress' ? 'col-dot--prog' : 'col-dot--done'}`}></span>
                {col.name}
              </div>
              <div className="col-count mono muted">{col.tasks.length}</div>
            </div>
            <div className="col-body">
              {col.tasks.map(t => <TaskCard key={t.id} task={t} onStatusChange={updateStatus} onClick={() => setEditTask(t)} />)}
              {col.tasks.length === 0 && <div className="col-empty muted mono">No tasks</div>}
            </div>
          </div>
        ))}
      </div>
{editModalOpen && editingTask && (
  <EditModal
    title={'Edit Task — ' + editingTask.vessel_name}
    fields={[
      {key:'title', label:'Task title', type:'textarea'},
      {key:'status', label:'Status', type:'select', options:['To Do','In Progress','Executed']},
      {key:'priority', label:'Priority', type:'select', options:['Critical','High','Medium','Low']},
      {key:'assigned_to', label:'Assigned to', type:'text'},
      {key:'due_date', label:'Due date', type:'text'},
      {key:'remark', label:'Remark / flags', type:'text'},
      {key:'actions_taken', label:'Actions taken', type:'textarea'},
    ]}
    data={editingTask}
    onSave={t => setTasks(prev => prev.map(x => x.id===editingTask.id ? {...x,...t} : x))}
    onClose={() => setEditModalOpen(false)}
  />
)}
      {editModalOpen {editTask && <TaskModal task={editTask}{editTask && <TaskModal task={editTask} editingTask {editTask && <TaskModal task={editTask}{editTask && <TaskModal task={editTask} <EditModal title={'Edit Task — ' + editingTask.vessel_name} fields={[
        {key:'title',label:'Task title',type:'textarea'},
        {key:'status',label:'Status',type:'select',options:['To Do','In Progress','Executed']},
        {key:'priority',label:'Priority',type:'select',options:['Critical','High','Medium','Low']},
        {key:'assigned_to',label:'Assigned to',type:'text'},
        {key:'due_date',label:'Due date',type:'text'},
        {key:'task_type',label:'Task type',type:'select',options:['Rectification','RO Oversight','MLC','Investigation','Administrative']},
        {key:'remark',label:'Remark / flags',type:'text'},
        {key:'actions_taken',label:'Actions taken',type:'textarea'},
      ]} data={editingTask} onSave={t => setTasks(prev => prev.map(x => x.id===editingTask.id ? {...x,...t} : x))} onClose={() => setEditModalOpen(false)} />
      {editTask {editTask && <TaskModal task={editTask}{editTask && <TaskModal task={editTask} <TaskModal task={editTask} onClose={() => setEditTask(null)} onUpdate={(id, status) => { updateStatus(id, status); setEditTask(null); }} />}
      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} onSave={t => { setTasks(prev => [...prev, {...t, id:'new_'+Date.now()}]); setShowNewTask(false); }} />}
    </div>
  );
}

function TaskCard({ task, onStatusChange, onClick, onEdit }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Executed';
  return (
    <div className={`task-card ${isOverdue ? 'task-card--overdue' : ''}`} onClick={onClick}>
      <div className="tc-meta">
        <span className="tc-vessel accent mono">{task.vessel_name}</span>
        <div style={{display:'flex',gap:'5px',alignItems:'center'}}>
          {task.priority === 'High' && <span className="badge badge-high" style={{fontSize:'8px'}}>HIGH</span>}
          {task.task_type && <span className="mono muted" style={{fontSize:'9px'}}>{task.task_type}</span>}
        </div>
      </div>
      <div className="tc-title">{task.title}</div>
      {task.remark && <div className="tc-remark">{task.remark}</div>}
      {task.actions_taken && <div className="tc-actions muted">Done: {task.actions_taken.slice(0,80)}{task.actions_taken.length > 80 ? '…' : ''}</div>}
      <div className="tc-footer">
        <div className="mono muted tc-assignee">{task.assigned_to?.split('@')[0]}</div>
        <div className={`mono tc-due ${isOverdue ? 'red' : 'muted'}`} style={{fontSize:'9px'}}>{task.due_date}</div>
      </div>
      <div className="tc-actions-btn" onClick={e => e.stopPropagation()} style={{display:'flex',gap:'5px',alignItems:'center'}}>
        <select className="tc-status-select" value={task.status} onChange={e => onStatusChange(task.id, e.target.value)}>
          {['To Do','In Progress','Executed'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

function TaskModal({ task, onClose, onUpdate }) {
  const [status, setStatus] = useState(task.status);
  const [notes, setNotes] = useState(task.actions_taken || '');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="mono accent" style={{fontSize:'10px',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:'4px'}}>{task.vessel_name} · {task.imo}</div>
          <h2 style={{fontSize:'14px',fontWeight:400,lineHeight:1.5}}>{task.title}</h2>
        </div>
        <div className="modal-body">
          {task.remark && <div className="modal-remark">{task.remark}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
            <div><div className="section-label">Assigned to</div><div style={{fontSize:'12px'}}>{task.assigned_to}</div></div>
            <div><div className="section-label">Due date</div><div style={{fontSize:'12px',fontFamily:'var(--mono)'}}>{task.due_date}</div></div>
            <div><div className="section-label">Priority</div><span className={`badge ${task.priority === 'High' ? 'badge-high' : 'badge-medium'}`}>{task.priority}</span></div>
            <div><div className="section-label">Type</div><div style={{fontSize:'12px'}}>{task.task_type || '—'}</div></div>
          </div>
          <div style={{marginBottom:'14px'}}><div className="section-label">Status</div><select className="select input" value={status} onChange={e => setStatus(e.target.value)}><option>To Do</option><option>In Progress</option><option>Executed</option></select></div>
          <div><div className="section-label">Actions taken</div><textarea className="input" style={{minHeight:'80px',resize:'vertical'}} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Document what was actually done…" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onUpdate(task.id, status, notes)}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

function NewTaskModal({ onClose, onSave }) {
  const [form, setForm] = useState({ vessel_name:'', imo:'', title:'', assigned_to:'', due_date:'', priority:'Medium', task_type:'Administrative', status:'To Do', remark:'' });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2 style={{fontSize:'15px',fontWeight:400}}>New PDAIP Task</h2></div>
        <div className="modal-body">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div><div className="section-label">Vessel name</div><input className="input" value={form.vessel_name} onChange={e=>set('vessel_name',e.target.value)} placeholder="OCEAN GALAXY" /></div>
            <div><div className="section-label">IMO</div><input className="input" value={form.imo} onChange={e=>set('imo',e.target.value)} placeholder="9852705" /></div>
          </div>
          <div style={{marginTop:'12px'}}><div className="section-label">Task title</div><textarea className="input" style={{minHeight:'70px',resize:'vertical'}} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Specific action required" /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginTop:'12px'}}>
            <div><div className="section-label">Assigned to</div><input className="input" value={form.assigned_to} onChange={e=>set('assigned_to',e.target.value)} placeholder="email@liscr.com" /></div>
            <div><div className="section-label">Due date</div><input className="input" type="date" value={form.due_date} onChange={e=>set('due_date',e.target.value)} /></div>
            <div><div className="section-label">Priority</div><select className="select input" value={form.priority} onChange={e=>set('priority',e.target.value)}><option>High</option><option>Medium</option></select></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginTop:'12px'}}>
            <div><div className="section-label">Task type</div><select className="select input" value={form.task_type} onChange={e=>set('task_type',e.target.value)}><option>Rectification</option><option>RO Oversight</option><option>MLC</option><option>Investigation</option><option>Administrative</option></select></div>
            <div><div className="section-label">Status</div><select className="select input" value={form.status} onChange={e=>set('status',e.target.value)}><option>To Do</option><option>In Progress</option><option>Executed</option></select></div>
          </div>
          <div style={{marginTop:'12px'}}><div className="section-label">Remark</div><input className="input" value={form.remark} onChange={e=>set('remark',e.target.value)} placeholder="Notes or flags" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => form.title && onSave(form)}>Create task</button>
        </div>
      </div>
    </div>
  );
}

// EditModal integration — added separately
export { EditModal };
