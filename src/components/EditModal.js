import React, { useState } from 'react';

export default function EditModal({ title, fields, data, onSave, onClose }) {
  const [form, setForm] = useState(data || {});
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,22,40,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'20px'}}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'10px',width:'100%',maxWidth:'540px',maxHeight:'85vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:'var(--text)'}}>{title}</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:'18px',lineHeight:1}}>×</button>
        </div>
        <div style={{padding:'16px 20px',overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:'12px'}}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={{fontSize:'9px',color:'var(--text3)',fontFamily:'var(--mono)',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:'5px'}}>{f.label}</div>
              {f.type === 'select' ? (
                <select value={form[f.key]||''} onChange={e => set(f.key, e.target.value)}
                  style={{width:'100%',padding:'8px 11px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'12px',outline:'none'}}>
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea value={form[f.key]||''} onChange={e => set(f.key, e.target.value)}
                  style={{width:'100%',padding:'8px 11px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'12px',outline:'none',resize:'vertical',minHeight:'80px',fontFamily:'var(--sans)'}} />
              ) : (
                <input value={form[f.key]||''} onChange={e => set(f.key, e.target.value)}
                  style={{width:'100%',padding:'8px 11px',border:'1px solid var(--border2)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text)',fontSize:'12px',outline:'none'}} />
              )}
            </div>
          ))}
        </div>
        <div style={{padding:'14px 20px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:'8px'}}>
          <button onClick={onClose} style={{padding:'7px 16px',border:'1px solid var(--border)',borderRadius:'6px',background:'var(--bg3)',color:'var(--text3)',cursor:'pointer',fontSize:'12px'}}>Cancel</button>
          <button onClick={() => { onSave(form); onClose(); }} style={{padding:'7px 16px',border:'1px solid var(--blue)',borderRadius:'6px',background:'var(--blue)',color:'#fff',cursor:'pointer',fontSize:'12px',fontWeight:500}}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
