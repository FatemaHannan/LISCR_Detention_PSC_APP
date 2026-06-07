import React, { useState, useEffect } from 'react';

const USERS = [
  { email:'fhannan@liscr.com', password:'Sadmin@2024', role:'Super Admin', name:'Fatema Hannan', dept:'Management' },
  { email:'vp.fleet@liscr.com', password:'Admin@2024', role:'Admin', name:'VP Fleet Performance', dept:'Executive' },
  { email:'fleet.performance@liscr.com', password:'Fleet@2024', role:'Admin', name:'Fleet Performance Lead', dept:'Fleet Performance' },
  { email:'rs.technical@liscr.com', password:'RS@2024', role:'Admin', name:'R&S Technical Lead', dept:'R&S' },
  { email:'mlc.officer@liscr.com', password:null, role:'Viewer', name:'MLC Officer', dept:'MLC' },
  { email:'psc.affairs@liscr.com', password:null, role:'Viewer', name:'PSC Affairs Lead', dept:'PSC Affairs' },
  { email:'case.owner.a@liscr.com', password:null, role:'Viewer', name:'Case Owner A', dept:'Fleet Performance' },
  { email:'case.owner.b@liscr.com', password:null, role:'Viewer', name:'Case Owner B', dept:'Fleet Performance' },
  { email:'case.owner.c@liscr.com', password:null, role:'Viewer', name:'Case Owner C', dept:'Fleet Performance' },
  { email:'inspection.lead@liscr.com', password:null, role:'Viewer', name:'Inspection Lead', dept:'Inspections' },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState('email'); // 'email' or 'password'
  const [detectedUser, setDetectedUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('liscr_email');
    if (saved) setEmail(saved);
  }, []);

  function handleEmailNext(e) {
    e.preventDefault();
    setError('');

    if (!email.endsWith('@liscr.com')) {
      setError('Only @liscr.com email addresses are permitted.');
      return;
    }

    const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      setError('Email address not found. Contact your system administrator.');
      return;
    }

    localStorage.setItem('liscr_email', email);
    setDetectedUser(user);

    if (user.role === 'Viewer') {
      setLoading(true);
      setTimeout(() => { onLogin(user); }, 500);
    } else {
      setStep('password');
    }
  }

  function handlePasswordLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (detectedUser && detectedUser.password === password) {
        onLogin(detectedUser);
      } else {
        setError('Incorrect password. Contact your system administrator.');
        setLoading(false);
      }
    }, 600);
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font)',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <div style={{width:'52px',height:'52px',background:'var(--blue)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',margin:'0 auto 16px',boxShadow:'0 0 24px rgba(59,130,246,0.3)'}}>
            <i className="ti ti-ship" style={{color:'#fff'}}></i>
          </div>
          <div style={{fontSize:'20px',fontWeight:600,color:'var(--text)',letterSpacing:'.01em',marginBottom:'4px'}}>LISCR PSC Intelligence</div>
          <div style={{fontSize:'11px',color:'var(--text3)',fontFamily:'var(--mono)',letterSpacing:'.05em'}}>Detention Intelligence Platform</div>
        </div>

        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',padding:'28px'}}>

          {step === 'email' && (
            <>
              <div style={{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'6px'}}>Sign in</div>
              <div style={{fontSize:'11px',color:'var(--text3)',marginBottom:'20px'}}>Enter your LISCR email address to continue.</div>
              <form onSubmit={handleEmailNext}>
                <div style={{marginBottom:'14px'}}>
                  <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:'6px'}}>Email address</div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="yourname@liscr.com"
                    required
                    autoFocus
                    style={{width:'100%',padding:'9px 12px',border:'1px solid var(--border2)',borderRadius:'7px',background:'var(--bg3)',color:'var(--text)',fontSize:'12px',outline:'none',fontFamily:'var(--font)'}}
                    onFocus={e => e.target.style.borderColor='var(--blue)'}
                    onBlur={e => e.target.style.borderColor='var(--border2)'}
                  />
                  <div style={{fontSize:'10px',color:'var(--text3)',marginTop:'4px',fontFamily:'var(--mono)'}}>Only @liscr.com · Email is remembered on this device</div>
                </div>

                {error && (
                  <div style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'6px',padding:'9px 12px',fontSize:'11px',color:'var(--red2)',marginBottom:'14px',display:'flex',alignItems:'center',gap:'8px'}}>
                    <i className="ti ti-alert-circle"></i>{error}
                  </div>
                )}

                <button type="submit" disabled={loading || !email}
                  style={{width:'100%',padding:'10px',background:'var(--blue)',color:'#fff',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:loading||!email?'not-allowed':'pointer',opacity:loading||!email?0.6:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                  {loading ? (
                    <><div style={{width:'14px',height:'14px',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}></div>Signing in…</>
                  ) : 'Continue →'}
                </button>
              </form>

              <div style={{marginTop:'18px',padding:'12px',background:'var(--bg3)',borderRadius:'8px',border:'1px solid var(--border)'}}>
                <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.06em'}}>Access levels</div>
                <div style={{fontSize:'11px',color:'var(--text2)',lineHeight:1.7}}>
                  <div><span style={{color:'var(--text3)'}}>Viewer —</span> Email only, no password required</div>
                  <div><span style={{color:'var(--blue)'}}>Admin —</span> Email + password required</div>
                  <div><span style={{color:'var(--purple2)'}}>Super Admin —</span> Email + password required</div>
                </div>
              </div>
            </>
          )}

          {step === 'password' && detectedUser && (
            <>
              <button onClick={() => { setStep('email'); setPassword(''); setError(''); }}
                style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:'12px',marginBottom:'16px',padding:'0',display:'flex',alignItems:'center',gap:'5px'}}>
                ← Back
              </button>

              <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'var(--blue-bg)',border:'1px solid var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'var(--blue)',flexShrink:0}}>
                  {detectedUser.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text)'}}>{detectedUser.name}</div>
                  <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)'}}>{detectedUser.email}</div>
                  <div style={{fontSize:'10px',marginTop:'2px'}}>
                    <span style={{padding:'2px 7px',borderRadius:'999px',background:detectedUser.role==='Super Admin'?'var(--purple-bg)':'var(--blue-bg)',color:detectedUser.role==='Super Admin'?'var(--purple2)':'var(--blue)',fontSize:'9px',fontFamily:'var(--mono)',fontWeight:600,border:`1px solid ${detectedUser.role==='Super Admin'?'#251840':'#1A2E4A'}`}}>{detectedUser.role}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handlePasswordLogin}>
                <div style={{marginBottom:'14px'}}>
                  <div style={{fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:'6px'}}>Password</div>
                  <div style={{position:'relative'}}>
                    <input
                      type={showPass?'text':'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoFocus
                      style={{width:'100%',padding:'9px 38px 9px 12px',border:'1px solid var(--border2)',borderRadius:'7px',background:'var(--bg3)',color:'var(--text)',fontSize:'12px',outline:'none',fontFamily:'var(--font)'}}
                      onFocus={e => e.target.style.borderColor='var(--blue)'}
                      onBlur={e => e.target.style.borderColor='var(--border2)'}
                    />
                    <button type="button" onClick={() => setShowPass(s=>!s)}
                      style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:'14px'}}>
                      <i className={`ti ti-eye${showPass?'-off':''}`}></i>
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{background:'var(--red-bg)',border:'1px solid #3D1A1A',borderRadius:'6px',padding:'9px 12px',fontSize:'11px',color:'var(--red2)',marginBottom:'14px',display:'flex',alignItems:'center',gap:'8px'}}>
                    <i className="ti ti-alert-circle"></i>{error}
                  </div>
                )}

                <button type="submit" disabled={loading || !password}
                  style={{width:'100%',padding:'10px',background:'var(--blue)',color:'#fff',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:loading||!password?'not-allowed':'pointer',opacity:loading||!password?0.5:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                  {loading ? (
                    <><div style={{width:'14px',height:'14px',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}></div>Signing in…</>
                  ) : 'Sign in'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{textAlign:'center',marginTop:'20px',fontSize:'10px',color:'var(--text3)',fontFamily:'var(--mono)',letterSpacing:'.04em'}}>
          LISCR PSC Intelligence · Confidential · Access restricted
        </div>
      </div>
    </div>
  );
}
