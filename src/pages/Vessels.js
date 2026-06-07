import React, { useState, useEffect } from 'react';
import { getInspections } from '../lib/supabase';
import './Vessels.css';

const SEED = [
  { vessel_name:'OCEAN GALAXY', imo:'9852705', inspection_date:'2026-05-28', port:'Tauranga, NZ', mou:'Tokyo MOU', number_of_deficiencies:14, psc_vessel_owner:'Vadym Shylov', car_status:'Complete', case_action_type:'CAR', case_action_status:'Pending Review', flags:['WHISTLEBLOWER','FRAUDULENT RECORD','RO SURVEY GAP','HRS'] },
  { vessel_name:'CAPE MIRON', imo:'9545168', inspection_date:'2026-05-29', port:'Quebec, CA', mou:'Paris MOU', number_of_deficiencies:16, psc_vessel_owner:'Alfonso Ostia', car_status:'Complete', case_action_type:null, case_action_status:null, flags:[] },
  { vessel_name:'SOPOT', imo:'9727522', inspection_date:'2026-05-27', port:'New Haven, US', mou:'US Coastguard', number_of_deficiencies:3, psc_vessel_owner:'Vadym Shylov', car_status:'Not Received', case_action_type:'CAR', case_action_status:'Pending Review', flags:[] },
  { vessel_name:'MORNING CLOUD', imo:'9532197', inspection_date:'2026-05-26', port:'Guangzhou, CN', mou:'Tokyo MOU', number_of_deficiencies:8, psc_vessel_owner:'Alfonso Ostia', car_status:'Not Received', case_action_type:'Follow up CAR', case_action_status:'Pending CAR or Documents', flags:[] },
  { vessel_name:'SVR MERCURY', imo:'8822600', inspection_date:'2026-05-26', port:'Vasto, IT', mou:'Paris MOU', number_of_deficiencies:13, psc_vessel_owner:'Vadym Shylov', car_status:'Complete', case_action_type:'CAR', case_action_status:'Close Case', flags:[] },
  { vessel_name:'SEALAND LOS ANGELES', imo:'9383235', inspection_date:'2026-05-25', port:'Balboa, PA', mou:'Tokyo MOU', number_of_deficiencies:9, psc_vessel_owner:'Orlando Brown', car_status:'Not Received', case_action_type:null, case_action_status:null, flags:[] },
  { vessel_name:'AMI', imo:'9303833', inspection_date:'2026-05-25', port:'Guangzhou, CN', mou:'Tokyo MOU', number_of_deficiencies:8, psc_vessel_owner:'Vadym Shylov', car_status:'Complete', case_action_type:'CAR', case_action_status:'Close Case', flags:[] },
  { vessel_name:'MARIELENA', imo:'9376359', inspection_date:'2026-05-25', port:'Newcastle, AU', mou:'AMSA', number_of_deficiencies:5, psc_vessel_owner:'Orlando Brown', car_status:'Not Received', case_action_type:'CAR', case_action_status:'Requested', flags:[] },
  { vessel_name:'ATHINA L', imo:'9487627', inspection_date:'2026-05-20', port:'Bilbao, ES', mou:'Paris MOU', number_of_deficiencies:2, psc_vessel_owner:'Vadym Shylov', car_status:'Complete', case_action_type:'CAR', case_action_status:'Close Case', flags:[] },
  { vessel_name:'WANTAI', imo:'9168207', inspection_date:'2026-05-19', port:'Guangzhou, CN', mou:'Tokyo MOU', number_of_deficiencies:8, psc_vessel_owner:'Vadym Shylov', car_status:'Complete', case_action_type:'CAR', case_action_status:'Close Case', flags:[] },
  { vessel_name:'HONG BO 18', imo:'9713014', inspection_date:'2026-05-18', port:'Dongjiakou, CN', mou:'Tokyo MOU', number_of_deficiencies:10, psc_vessel_owner:'Vadym Shylov', car_status:'Complete', case_action_type:'CAR', case_action_status:'Close Case', flags:[] },
  { vessel_name:'LFG PRIDE', imo:'9605736', inspection_date:'2026-05-12', port:'Tanjung Priok, ID', mou:'Tokyo MOU', number_of_deficiencies:23, psc_vessel_owner:'Orlando Brown', car_status:'Complete', case_action_type:'CAR', case_action_status:'Close Case', flags:[] },
  { vessel_name:'OCEAN EUPHROSYNE', imo:'9290658', inspection_date:'2026-05-13', port:'Ulsan, KR', mou:'Tokyo MOU', number_of_deficiencies:12, psc_vessel_owner:'Orlando Brown', car_status:'Complete', case_action_type:'CAR', case_action_status:'Close Case', flags:[] },
  { vessel_name:'PACIFIC BLESSING', imo:'9848089', inspection_date:'2026-05-11', port:'Cape Flattery, AU', mou:'AMSA', number_of_deficiencies:12, psc_vessel_owner:'Alfonso Ostia', car_status:'Complete', case_action_type:'Follow up CAR', case_action_status:'Pending CAR or Documents', flags:[] },
  { vessel_name:'CONTSHIP CUB', imo:'9683477', inspection_date:'2026-05-11', port:'Algeciras, ES', mou:'Paris MOU', number_of_deficiencies:5, psc_vessel_owner:'Alfonso Ostia', car_status:'Complete', case_action_type:'Follow up CAR', case_action_status:'Close Case', flags:[] },
  { vessel_name:'EVELPIS', imo:'9548158', inspection_date:'2026-05-09', port:'Burgas, BG', mou:'Paris MOU', number_of_deficiencies:17, psc_vessel_owner:'Orlando Brown', car_status:'Not Received', case_action_type:'CAR', case_action_status:'Requested', flags:[] },
  { vessel_name:'ILIANA', imo:'9490715', inspection_date:'2026-05-05', port:'Constanta, RO', mou:'Paris MOU', number_of_deficiencies:11, psc_vessel_owner:'Vadym Shylov', car_status:'Complete', case_action_type:'PSC Report and CAR', case_action_status:'Pending Review', flags:[] },
  { vessel_name:'MILESTONE', imo:'9469003', inspection_date:'2026-05-01', port:'Newcastle, AU', mou:'AMSA', number_of_deficiencies:15, psc_vessel_owner:'Vadym Shylov', car_status:'Complete', case_action_type:'CAR', case_action_status:'Pending Review', flags:[] },
];

const MOUS = ['All','Tokyo MOU','Paris MOU','AMSA','US Coastguard'];
const OWNERS = ['All','Vadym Shylov','Orlando Brown','Alfonso Ostia'];

export default function Vessels() {
  const [vessels, setVessels] = useState(SEED);
  const [search, setSearch] = useState('');
  const [filterMou, setFilterMou] = useState('All');
  const [filterOwner, setFilterOwner] = useState('All');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    getInspections({ month: '2026-05' }).then(d => { if (d?.length) setVessels(d); }).catch(() => {});
  }, []);

  const filtered = vessels
    .filter(v => {
      if (filterMou !== 'All' && v.mou !== filterMou) return false;
      if (filterOwner !== 'All' && v.psc_vessel_owner !== filterOwner) return false;
      if (search && !v.vessel_name.toLowerCase().includes(search.toLowerCase()) && !v.imo.includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.inspection_date) - new Date(a.inspection_date);
      if (sortBy === 'defs') return b.number_of_deficiencies - a.number_of_deficiencies;
      return a.vessel_name.localeCompare(b.vessel_name);
    });

  const totalDefs = filtered.reduce((s, v) => s + v.number_of_deficiencies, 0);
  const openCAR = filtered.filter(v => v.car_status !== 'Complete').length;

  return (
    <div className="vessels-page">
      <div className="page-header" style={{padding:'20px 24px 0'}}>
        <div>
          <h1 className="page-title">PSC Inspections — May 2026</h1>
          <div className="mono muted" style={{fontSize:'10px',marginTop:'3px'}}>{filtered.length} detentions · {totalDefs} total deficiencies · {openCAR} CAR not complete</div>
        </div>
      </div>
      <div style={{padding:'14px 24px',display:'flex',gap:'10px',flexWrap:'wrap',borderBottom:'0.5px solid var(--border-dim)'}}>
        <input className="input" style={{maxWidth:200}} placeholder="Search vessel or IMO…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select input" style={{maxWidth:160}} value={filterMou} onChange={e => setFilterMou(e.target.value)}>
          {MOUS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select className="select input" style={{maxWidth:160}} value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
          {OWNERS.map(o => <option key={o}>{o}</option>)}
        </select>
        <select className="select input" style={{maxWidth:160}} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date">Newest first</option>
          <option value="defs">Most deficiencies</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>
      <div className="vessels-table-wrap">
        <table className="vessels-table">
          <thead>
            <tr>
              <th>Vessel</th><th>Date</th><th>Port · MoU</th><th>Defs</th><th>Owner</th><th>CAR</th><th>Case status</th><th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.imo + v.inspection_date} className={v.flags?.length > 0 ? 'row--flagged' : ''}>
                <td><div className="vt-name accent">{v.vessel_name}</div><div className="mono muted" style={{fontSize:'9px'}}>{v.imo}</div></td>
                <td className="mono muted" style={{fontSize:'11px'}}>{v.inspection_date?.slice(5)}</td>
                <td><div style={{fontSize:'11px',color:'var(--text-secondary)'}}>{v.port}</div><div className="mono muted" style={{fontSize:'9px'}}>{v.mou}</div></td>
                <td><span className={`mono ${v.number_of_deficiencies >= 15 ? 'red' : v.number_of_deficiencies >= 8 ? 'amber' : 'green'}`} style={{fontSize:'16px',fontWeight:300}}>{v.number_of_deficiencies}</span></td>
                <td style={{fontSize:'11px',color:'var(--text-secondary)'}}>{v.psc_vessel_owner}</td>
                <td><span className={`badge ${v.car_status === 'Complete' ? 'badge-executed' : v.car_status === 'Not Received' ? 'badge-high' : 'badge-medium'}`}>{v.car_status}</span></td>
                <td>{v.case_action_status ? <span className={`badge ${v.case_action_status === 'Close Case' ? 'badge-executed' : 'badge-medium'}`}>{v.case_action_status}</span> : <span className="muted" style={{fontSize:'10px'}}>—</span>}</td>
                <td>{v.flags?.map(f => <span key={f} className="flag flag-red" style={{display:'block',marginBottom:'2px'}}>{f}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
