import React, { useState } from 'react';
import EditModal from '../components/EditModal';

const ROLE_COLOR = { 'Super Admin':'var(--purple)', 'Admin':'var(--blue)', 'Viewer':'var(--text3)' };
const ROLE_BG = { 'Super Admin':'var(--purple-bg)', 'Admin':'var(--blue-bg)', 'Viewer':'var(--bg3)' };
const ROLE_BADGE = { 'Super Admin':'b-p', 'Admin':'b-b', 'Viewer':'b-gr' };

const PERMISSIONS = [
  { feature:'View dashboard & KPIs', viewer:true, admin:true, superAdmin:true },
  { feature:'View case files', viewer:true, admin:true, superAdmin:true },
  { feature:'View EVP Q&A', viewer:true, admin:true, superAdmin:true },
  { feature:'View PDAIP tasks', viewer:true, admin:true, superAdmin:true },
  { feature:'View fleet patterns', viewer:true, admin:true, superAdmin:true },
  { feature:'View AI assistant', viewer:true, admin:true, superAdmin:true },
  { feature:'Edit vessel facts', viewer:false, admin:true, superAdmin:true },
  { feature:'Edit release conditions', viewer:false, admin:true, superAdmin:true },
  { feature:'Edit EVP Q&A answers', viewer:false, admin:true, superAdmin:true },
  { feature:'Add / edit gaps', viewer:false, admin:true, superAdmin:true },
  { feature:'Delete gaps', viewer:false, admin:false, superAdmin:true },
  { feature:'Add / edit tasks', viewer:false, admin:true, superAdmin:true },
  { feature:'Delete tasks', viewer:false, admin:false, superAdmin:true },
  { feature:'Push tasks to task app', viewer:false, admin:true, superAdmin:true },
  { feature:'Edit inspection history', viewer:false, admin:true, superAdmin:true },
  { feature:'Upload & analyze documents', viewer:false, admin:true, superAdmin:true },
  { feature:'Download case summaries', viewer:true, admin:true, superAdmin:true },
  { feature:'Add users', viewer:false, admin:false, superAdmin:true },
  { feature:'Remove users', viewer:false, admin:false, superAdmin:true },
  { feature:'Change user roles', viewer:false, admin:false, superAdmin:true },
  { feature:'View audit log', viewer:false, admin:true, superAdmin:true },
  { feature:'Manage all settings', viewer:false, admin:false, superAdmin:true },
];

const INITIAL_USERS = [
  { id:1, name:'Program Manager', email:'program.manager@liscr.com', role:'Super Admin', status:'Active', dept:'Management', lastLogin:'Today', added:'Jan 2026' },
  { id:2, name:'VP Fleet Performance', email:'vp.fleet@liscr.com', role:'Admin', status:'Active', dept:'Executive', lastLogin:'Today', added:'Jan 2026' },
  { id:3, name:'Fleet Performance Lead', email:'fleet.performance@liscr.com', role:'Admin', status:'Active', dept:'Fleet Performance', lastLogin:'Today', added:'Jan 2026' },
  { id:4, name:'R&S Technical Lead', email:'rs.technical@liscr.com', role:'Admin', status:'Active', dept:'R&S', lastLogin:'Jun 5 2026', added:'Jan 2026' },
  { id:5, name:'MLC Officer', email:'mlc.officer@liscr.com', role:'Viewer', status:'Active', dept:'MLC', lastLogin:'Jun 4 2026', added:'Feb 2026' },
  { id:6, name:'PSC Affairs Lead', email:'psc.affairs@liscr.com', role:'Viewer', status:'Active', dept:'PSC Affairs', lastLogin:'Jun 3 2026', added:'Jan 2026' },
  { id:7, name:'Case Owner A', email:'case.owner.a@liscr.com', role:'Viewer', status:'Active', dept:'Fleet Performance', lastLogin:'Jun 6 2026', added:'Jan 2026' },
  { id:8, name:'Case Owner B', email:'case.owner.b@liscr.com', role:'Viewer', status:'Active', dept:'Fleet Performance', lastLogin:'Jun 5 2026', added:'Jan 2026' },
  { id:9, name:'Case Owner C', email:'case.owner.c@liscr.com', role:'Viewer', status:'Active', dept:'Fleet Performance', lastLogin:'Jun 4 2026', added:'Jan 2026' },
  { id:10, name:'Inspection Lead', email:'inspection.lead@liscr.com', role:'Viewer', status:'Active', dept:'Inspections', lastLogin:'Jun 2 2026', added:'Mar 2026' },
];

const INITIAL_AUDIT = [
  { id:1, user:'Fleet Performance Lead', action:'Edited vessel facts', target:'OCEAN GALAXY', time:'Today 09:14', type:'edit' },
  { id:2, user:'Program Manager', action:'Changed role: Case Owner A → Viewer', target:'User management', time:'Today 08:55', type:'role' },
  { id:3, user:'R&S Technical Lead', action:'Added gap', target:'OCEAN GALAXY — KR RO oversight', time:'Jun 5 2026 16:30', type:'add' },
  { id:4, user:'Fleet Performance Lead', action:'Pushed task to task app', target:'OCEAN GALAXY — Flag State audit', time:'Jun 5 2026 14:22', type:'push' },
  { id:5, user:'Program Manager', action:'Added user: Inspection Lead', target:'User management', time:'Mar 15 2026 10:00', type:'add' },
  { id:6, user:'Fleet Performance Lead', action:'Marked gap as reviewed', target:'CAPE MIRON — VIP rejection', time:'Jun 4 2026 11:45', type:'review' },
  { id:7, user:'VP Fleet Performance', action:'Edited EVP Q&A answer Q7', target:'OCEAN GALAXY', time:'Jun 4 2026 09:30', type:'edit' },
  { id:8, user:'R&S Technical Lead', action:'Added inspection history record', target:'OCEAN GALAXY — Oct 2025', time:'Jun 3 2026 15:10', type:'add' },
];

const AUDIT_COLOR = { edit:'var(--blue)', add:'var(--green)', role:'var(--purple)', push:'var(--amber)', review:'var(--text3)' };
const AUDIT_BG = { edit:'var(--blue-bg)', add:'var(--green-bg)', role:'var(--purple-bg)', push:'var(--amber-bg)', review:'var(--bg3)' };

export default function AdminPanel() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState(INITIAL_USERS);
  const [audit, setAudit] = useState(INITIAL_AUDIT);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All');

  const superAdmins = users.filter(u => u.role==='Super Admin').length;
  const admins = users.filter(u => u.role==='Admin').length;
  const viewers = users.filter(u => u.role==='Viewer').length;
  const active = users.filter(u => u.status==='Active').length;

  const filteredUsers = users.filter(u => {
    if (filterRole !== 'All' && u.role !== filterRole) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function addUser(form) {
    const newUser = { id:Date.now(), name:form.name, email:form.email, role:form.role||'Viewer', status:'Active', dept:form.dept||'—', lastLogin:'Never', added:new Date().toLocaleDateString('en-GB',{month:'short',year:'numeric'}) };
    setUsers(prev => [...prev, newUser]);
    addAudit('Program Manager', `Added user: ${form.name}`, 'User management', 'add');
  }

  function updateUser(id, updates) {
    const old = users.find(u => u.id===id);
    setUsers(prev => prev.map(u => u.id===id ? {...u,...updates} : u));
    if (updates.role && old.role !== updates.role) {
      addAudit('Program Manager', `Changed role: ${old.name} ${old.role} → ${updates.role}`, 'User management', 'role');
    } else {
      addAudit('Program Manager', `Edited user: ${old.name}`, 'User management', 'edit');
    }
  }

  function deleteUser(id) {
    const u = users.find(u => u.id===id);
    setUsers(prev => prev.filter(u => u.id!==id));
    addAudit('Program Manager', `Removed user: ${u.name}`, 'User management', 'role');
    setDeleteConfirm(null);
  }

  function toggleStatus(id) {
    const u = users.find(u => u.id===id);
    const newStatus = u.status==='Active'?'Inactive':'Active';
    setUsers(prev => prev.map(u => u.id===id ? {...u,status:newStatus} : u));
    addAudit('Program Manager', `${newStatus==='Active'?'Activated':'Deactivated'} user: ${u.name}`, 'User management', 'role');
  }

  function addAudit(user, action, target, type) {
    setAudit(prev => [{id:Date.now(),user,action,target,time:'Just now',type},...prev]);
  }

  return (
    <div style={{padding:'16px'}}>
      <div style={{background:'var(--purple-bg)',border:'1px solid #251840',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'14px',color:'var(--purple2)'}}>
        <strong>Admin Panel — Super Admin access required.</strong> Manage users, roles, and permissions. All changes are logged in the audit trail.
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
        {[{l:'Total users',v:users.length,c:'var(--text)'},{l:'Super Admins',v:superAdmins,c:'var(--purple2)'},{l:'Admins',v:admins,c:'var(--blue)'},{l:'Viewers',v:viewers,c:'var(--text3)'}].map(m => (
          <div key={m.l} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px'}}>
            <div style={{fontSize:'10px',color:m.c,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.05em'}}>{m.l}</div>
            <div style={{fontSize:'26px',fontWeight:300,fontFamily:'var(--mono)',color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:'14px'}}>
        {[{id:'users',l:'Users'},{id:'permissions',l:'Permissions'},{id:'audit',l:'Audit log'}].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{padding:'8px 16px',fontSize:'11px',cursor:'pointer',borderBottom:`2px solid ${tab===t.id?'var(--blue)':'transparent'}`,color:tab===t.id?'var(--blue)':'var(--text3)',fontWeight:tab===t.id?500:400,transition:'all .1s'}}>
            {t.l}
          </div>
        ))}
      </div>

      {tab==='users' && (
        <div>
          <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap',alignItems:'center'}}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
              style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none',width:'200px'}} />
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              style={{padding:'6px 10px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'11px',outline:'none'}}>
              {['All','Super Admin','Admin','Viewer'].map(r => <option key={r}>{r}</option>)}
            </select>
            <div style={{marginLeft:'auto'}}>
              <button onClick={() => setShowAdd(true)}
                style={{padding:'7px 16px',border:'1px solid var(--blue)',borderRadius:'6px',background:'var(--blue)',color:'#fff',cursor:'pointer',fontSize:'12px',fontWeight:500,display:'flex',alignItems:'center',gap:'6px'}}>
                + Add user
              </button>
            </div>
          </div>

          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
            <thead>
              <tr>
                {['User','Email','Department','Role','Status','Last login','Added','Actions'].map(h => (
                  <th key={h} style={{fontSize:'9px',fontWeight:600,color:'var(--text3)',textAlign:'left',padding:'0 10px 10px',borderBottom:'1px solid var(--border)',textTransform:'uppercase',letterSpacing:'.06em',fontFamily:'var(--mono)'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} style={{opacity:u.status==='Inactive'?0.5:1}}>
                  <td style={{padding:'10px 10px',borderBottom:'1px solid var(--border)',verticalAlign:'middle'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'9px'}}>
                      <div style={{width:'30px',height:'30px',borderRadius:'50%',background:ROLE_BG[u.role],border:`1px solid ${ROLE_COLOR[u.role]}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:ROLE_COLOR[u.role],flexShrink:0}}>
                        {u.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                      <strong style={{color:'var(--text)',fontSize:'12px'}}>{u.name}</strong>
                    </div>
                  </td>
                  <td style={{padding:'10px 10px',borderBottom:'1px solid var(--border)',color:'var(--text3)',fontFamily:'var(--mono)',fontSize:'10px'}}>{u.email}</td>
                  <td style={{padding:'10px 10px',borderBottom:'1px solid var(--border)',color:'var(--text2)',fontSize:'10px'}}>{u.dept}</td>
                  <td style={{padding:'10px 10px',borderBottom:'1px solid var(--border)'}}>
                    <select value={u.role} onChange={e => updateUser(u.id,{role:e.target.value})}
                      style={{padding:'4px 8px',border:`1px solid ${ROLE_COLOR[u.role]}`,borderRadius:'5px',background:ROLE_BG[u.role],color:ROLE_COLOR[u.role],fontSize:'10px',outline:'none',cursor:'pointer',fontWeight:600}}>
                      {['Super Admin','Admin','Viewer'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{padding:'10px 10px',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'999px',background:u.status==='Active'?'var(--green-bg)':'var(--bg3)',color:u.status==='Active'?'var(--green2)':'var(--text3)',border:`1px solid ${u.status==='Active'?'#1A3016':'var(--border)'}`,fontFamily:'var(--mono)',fontWeight:500}}>{u.status}</span>
                  </td>
                  <td style={{padding:'10px 10px',borderBottom:'1px solid var(--border)',color:'var(--text3)',fontSize:'10px',fontFamily:'var(--mono)'}}>{u.lastLogin}</td>
                  <td style={{padding:'10px 10px',borderBottom:'1px solid var(--border)',color:'var(--text3)',fontSize:'10px',fontFamily:'var(--mono)'}}>{u.added}</td>
                  <td style={{padding:'10px 10px',borderBottom:'1px solid var(--border)'}}>
                    <div style={{display:'flex',gap:'5px'}}>
                      <button onClick={() => setEditUser(u)}
                        style={{fontSize:'10px',padding:'4px 9px',border:'1px solid var(--border)',borderRadius:'4px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer'}}>Edit</button>
                      <button onClick={() => toggleStatus(u.id)}
                        style={{fontSize:'10px',padding:'4px 9px',border:`1px solid ${u.status==='Active'?'var(--amber-bg)':'var(--green-bg)'}`,borderRadius:'4px',background:u.status==='Active'?'var(--amber-bg)':'var(--green-bg)',color:u.status==='Active'?'var(--amber2)':'var(--green2)',cursor:'pointer'}}>
                        {u.status==='Active'?'Deactivate':'Activate'}
                      </button>
                      <button onClick={() => setDeleteConfirm(u.id)}
                        style={{fontSize:'10px',padding:'4px 9px',border:'1px solid var(--red-bg)',borderRadius:'4px',background:'var(--red-bg)',color:'var(--red2)',cursor:'pointer'}}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='permissions' && (
        <div>
          <div style={{background:'var(--bg3)',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'12px',border:'1px solid var(--border)',color:'var(--text2)'}}>
            <strong style={{color:'var(--text)'}}>Role permissions matrix</strong> — what each role can see and do in the platform.
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
            <thead>
              <tr>
                <th style={{fontSize:'9px',fontWeight:600,color:'var(--text3)',textAlign:'left',padding:'0 10px 10px',borderBottom:'1px solid var(--border)',textTransform:'uppercase',letterSpacing:'.06em',fontFamily:'var(--mono)',width:'50%'}}>Feature</th>
                {['Viewer','Admin','Super Admin'].map(r => (
                  <th key={r} style={{fontSize:'9px',fontWeight:600,textAlign:'center',padding:'0 10px 10px',borderBottom:'1px solid var(--border)',textTransform:'uppercase',letterSpacing:'.06em',fontFamily:'var(--mono)',color:ROLE_COLOR[r]}}>{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p,i) => (
                <tr key={i} style={{background:i%2===0?'':'rgba(255,255,255,0.01)'}}>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',color:'var(--text2)'}}>{p.feature}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',textAlign:'center'}}>{p.viewer?<span style={{color:'var(--green2)',fontSize:'14px'}}>✓</span>:<span style={{color:'var(--border2)',fontSize:'14px'}}>—</span>}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',textAlign:'center'}}>{p.admin?<span style={{color:'var(--green2)',fontSize:'14px'}}>✓</span>:<span style={{color:'var(--border2)',fontSize:'14px'}}>—</span>}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',textAlign:'center'}}>{p.superAdmin?<span style={{color:'var(--green2)',fontSize:'14px'}}>✓</span>:<span style={{color:'var(--border2)',fontSize:'14px'}}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='audit' && (
        <div>
          <div style={{background:'var(--bg3)',borderRadius:'6px',padding:'10px 13px',fontSize:'11px',lineHeight:1.65,marginBottom:'12px',border:'1px solid var(--border)',color:'var(--text2)'}}>
            <strong style={{color:'var(--text)'}}>Audit log</strong> — all changes made in the platform, who made them, and when. Cannot be edited or deleted.
          </div>
          {audit.map(a => (
            <div key={a.id} style={{display:'flex',alignItems:'flex-start',gap:'12px',padding:'10px 12px',border:'1px solid var(--border)',borderRadius:'8px',marginBottom:'6px',background:'var(--bg2)',borderLeft:'3px solid '+(AUDIT_COLOR[a.type]||'var(--border)')}}>
              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:AUDIT_BG[a.type]||'var(--bg3)',border:`1px solid ${AUDIT_COLOR[a.type]||'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',flexShrink:0}}>
                {a.type==='edit'?'✎':a.type==='add'?'+':a.type==='role'?'◈':a.type==='push'?'→':'✓'}
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px',flexWrap:'wrap'}}>
                  <strong style={{fontSize:'11px',color:'var(--text)'}}>{a.user}</strong>
                  <span style={{fontSize:'11px',color:'var(--text2)'}}>{a.action}</span>
                </div>
                <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)'}}>Target: {a.target} · {a.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <EditModal
          title="Add new user"
          fields={[
            {key:'name',label:'Full name / role title',type:'text'},
            {key:'email',label:'Email address',type:'text'},
            {key:'dept',label:'Department',type:'text'},
            {key:'role',label:'Role',type:'select',options:['Viewer','Admin','Super Admin']},
          ]}
          data={{role:'Viewer'}}
          onSave={addUser}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editUser && (
        <EditModal
          title={`Edit user — ${editUser.name}`}
          fields={[
            {key:'name',label:'Full name / role title',type:'text'},
            {key:'email',label:'Email address',type:'text'},
            {key:'dept',label:'Department',type:'text'},
            {key:'role',label:'Role',type:'select',options:['Viewer','Admin','Super Admin']},
            {key:'status',label:'Status',type:'select',options:['Active','Inactive']},
          ]}
          data={editUser}
          onSave={updates => { updateUser(editUser.id, updates); setEditUser(null); }}
          onClose={() => setEditUser(null)}
        />
      )}

      {deleteConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(10,22,40,0.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
          <div style={{background:'var(--bg2)',border:'1px solid #3D1A1A',borderRadius:'10px',padding:'24px',maxWidth:'380px',width:'100%',textAlign:'center'}}>
            <div style={{fontSize:'28px',marginBottom:'12px'}}>⚠</div>
            <div style={{fontSize:'14px',fontWeight:600,color:'var(--text)',marginBottom:'8px'}}>Remove user?</div>
            <div style={{fontSize:'12px',color:'var(--text2)',marginBottom:'20px',lineHeight:1.6}}>
              This will permanently remove <strong>{users.find(u=>u.id===deleteConfirm)?.name}</strong> from the platform. This action is logged in the audit trail.
            </div>
            <div style={{display:'flex',gap:'10px',justifyContent:'center'}}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{padding:'8px 20px',border:'1px solid var(--border)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer',fontSize:'12px'}}>Cancel</button>
              <button onClick={() => deleteUser(deleteConfirm)}
                style={{padding:'8px 20px',border:'1px solid var(--red)',borderRadius:'6px',background:'var(--red)',color:'#fff',cursor:'pointer',fontSize:'12px',fontWeight:600}}>Remove user</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
