import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)',color:'var(--text)',padding:'40px',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>⚠</div>
          <div style={{fontSize:'20px',fontWeight:600,marginBottom:'8px',color:'var(--red2)'}}>Something went wrong</div>
          <div style={{fontSize:'14px',color:'var(--text3)',marginBottom:'24px',maxWidth:'500px',lineHeight:1.6}}>
            An unexpected error occurred. Your data is safe in Supabase.
          </div>
          <div style={{fontSize:'12px',color:'var(--text3)',fontFamily:'var(--mono)',background:'var(--bg2)',padding:'12px 16px',borderRadius:'6px',marginBottom:'24px',maxWidth:'600px',textAlign:'left',border:'1px solid var(--border)'}}>
            {this.state.error?.message||'Unknown error'}
          </div>
          <button onClick={()=>window.location.reload()} style={{padding:'10px 24px',background:'var(--blue)',color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px',fontWeight:500}}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
