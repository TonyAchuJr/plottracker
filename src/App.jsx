import { supabase } from "./supabase";
import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import "./styles.css";


/* ─── DB ─────────────────────────────────────────────────────────────────── */
const DB_KEY = "plottracker_v4";
function getDB(){ try{return JSON.parse(localStorage.getItem(DB_KEY))||{users:[],projects:[]}}catch{return{users:[],projects:[]}} }
function saveDB(d){ localStorage.setItem(DB_KEY,JSON.stringify(d)) }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36) }
const DFMT = new Intl.DateTimeFormat("en-IN",{dateStyle:"medium"});
const TFMT = new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"});
const inr  = v => v ? `₹${Number(v).toLocaleString("en-IN")}` : "";

/* ─── ROOT ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [db,setDB]     = useState(getDB);
  const [dark,setDark] = useState(()=>localStorage.getItem("pt_theme")!=="light");
  const [view,setView] = useState("landing");
  const [user,setUser] = useState(null);
  const [projId,setProjId] = useState(null);
  const [plotId,setPlotId] = useState(null);
  const [toast,setToast]   = useState(null);
  const [modal,setModal]   = useState(null);

  const persist = useCallback(fn=>setDB(p=>{ const n=fn(p); saveDB(n); return n; }),[]);
  const toast$  = (msg,type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3200); };
  const toggleDark = () => setDark(d=>{ localStorage.setItem("pt_theme",d?"light":"dark"); return !d; });

  const proj = db.projects.find(p=>p.id===projId);
  const plot = proj?.plots?.find(p=>p.id===plotId);

  useEffect(()=>{
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.body.style.background = dark ? "#09090f" : "#f7f5f0";
  },[dark]);

  const ctx = { dark,toggleDark,db,persist,user,setUser,toast$,setView,setProjId,setPlotId,setModal };

  return (
    <>
      {toast && <Toast {...toast} />}
      {modal  && <ModalShell modal={modal} ctx={ctx} proj={proj} plot={plot} />}
      {view==="landing"  && <Landing ctx={ctx} />}
      {view==="login"    && <LoginPage ctx={ctx} />}
      {view==="register" && <RegisterPage ctx={ctx} />}
      {(view==="dashboard"||view==="project"||view==="plot") && (
        <Shell ctx={ctx}>
          {view==="dashboard" && <Dashboard ctx={ctx} />}
          {view==="project"   && proj && <ProjectView proj={proj} ctx={ctx} />}
          {view==="plot"      && plot && proj && <PlotView plot={plot} proj={proj} ctx={ctx} />}
        </Shell>
      )}
    </>
  );
}

/* ─── TOAST ──────────────────────────────────────────────────────────────── */
function Toast({ msg, type }) {
  return <div className={`toast toast-${type}`}>{msg}</div>;
}

/* ─── LANDING ────────────────────────────────────────────────────────────── */
function Landing({ ctx }) {
  const { setView, toggleDark, dark } = ctx;
  return (
    <div className="landing">
      {/* ambient orbs */}
      <div className="landing-orb" style={{width:500,height:500,background:"rgba(201,168,76,0.07)",top:"-20%",left:"50%",transform:"translateX(-50%)"}} />
      <div className="landing-orb" style={{width:300,height:300,background:"rgba(56,189,248,0.05)",bottom:"10%",right:"5%"}} />

      <button className="theme-btn" onClick={toggleDark} style={{position:"absolute",top:16,right:16}}>
        {dark?"☀️":"🌙"}
      </button>

      <div style={{textAlign:"center",maxWidth:560,width:"100%",position:"relative",zIndex:1}}>
        <div className="landing-logo animate-fade-up">🏘️</div>
        <h1 className="landing-title animate-fade-up-1">PlotTracker</h1>
        <p className="landing-sub animate-fade-up-2">
          The premium platform for real estate layout management — track sales, bookings and share verified layouts with your entire team.
        </p>
        <div className="flex gap-3" style={{justifyContent:"center",flexWrap:"wrap",marginBottom:"2.5rem"}} >
          <button className="landing-btn-primary animate-fade-up-3" onClick={()=>setView("login")}>Sign in</button>
          <button className="landing-btn-secondary animate-fade-up-3" onClick={()=>setView("register")}>Create account</button>
        </div>
        <div className="flex gap-2" style={{justifyContent:"center",flexWrap:"wrap"}} >
          {[["🗺️","Upload Layouts"],["📊","Track Status"],["👥","Owner Access"],["🔒","Buyer View"]].map(([ic,t],i)=>(
            <div key={t} className="feature-pill" style={{animationDelay:`${0.3+i*0.05}s`}}>{ic} {t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── AUTH ───────────────────────────────────────────────────────────────── */
function LoginPage({ ctx }) {
  const { db, setUser, setView, toast$, dark, toggleDark } = ctx;
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const go = () => {
    const u = db.users.find(u=>u.email===email.trim().toLowerCase()&&u.password===pass);
    if(!u){setErr("Invalid email or password.");return;}
    setUser(u); setView("dashboard"); toast$(`Welcome back, ${u.name}!`);
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",background:"var(--bg)"}}>
      <div className="auth-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <div className="flex items-center gap-2" style={{cursor:"pointer"}} onClick={()=>setView("landing")}>
            <div className="header-logo-icon">🏘️</div>
            <span className="header-logo-text" style={{fontSize:16}}>PlotTracker</span>
          </div>
          <button className="theme-btn" onClick={toggleDark}>{dark?"☀️":"🌙"}</button>
        </div>
        <h2 style={{fontFamily:"var(--font-display)",fontSize:26,marginBottom:6,color:"var(--text)"}}>Welcome back</h2>
        <p className="text-muted text-sm mb-4">Sign in to your account</p>
        <FInput label="Email" value={email} onChange={setEmail} type="email" />
        <FInput label="Password" value={pass} onChange={setPass} type="password" />
        {err&&<ErrMsg>{err}</ErrMsg>}
        <button className="btn-primary btn-full" onClick={go} style={{marginBottom:14,fontSize:15,padding:"13px"}}>Sign in</button>
        <p className="text-muted text-sm" style={{textAlign:"center"}}>
          No account? <span className="text-gold" style={{cursor:"pointer"}} onClick={()=>setView("register")}>Register</span>
          {"  ·  "}<span className="text-gold" style={{cursor:"pointer"}} onClick={()=>setView("landing")}>Back</span>
        </p>
      </div>
    </div>
  );
}

function RegisterPage({ ctx }) {
  const { db, persist, setUser, setView, toast$, dark, toggleDark } = ctx;
  const [role,setRole] = useState("owner");
  const [name,setName]=useState(""); const [email,setEmail]=useState("");
  const [phone,setPhone]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const go = () => {
    if(!name.trim()||!email.trim()||!pass.trim()){setErr("All fields required.");return;}
    if(db.users.find(u=>u.email===email.trim().toLowerCase())){setErr("Email already registered.");return;}
    const u={
  id:uid(),
  name:name.trim(),
  email:email.trim().toLowerCase(),
  phone:phone.trim(),
  password:pass,
  role,
  createdAt:Date.now()
};

// Save to Supabase
console.log("REGISTER BUTTON CLICKED", u);

supabase
  .from("profiles")
  .insert([
    {
      name: u.name,
      phone: u.phone,
      role: u.role
    }
  ])
  .then(({ data, error }) => {
    console.log("SUPABASE DATA:", data);
  console.log("SUPABASE ERROR:", error);
  });

// Existing localStorage save
persist(d=>({...d,users:[...d.users,u]}));

setUser(u);
setView("dashboard");
toast$("Account created! Welcome to PlotTracker.");
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem",background:"var(--bg)"}}>
      <div className="auth-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <div className="flex items-center gap-2" style={{cursor:"pointer"}} onClick={()=>setView("landing")}>
            <div className="header-logo-icon">🏘️</div>
            <span className="header-logo-text" style={{fontSize:16}}>PlotTracker</span>
          </div>
          <button className="theme-btn" onClick={toggleDark}>{dark?"☀️":"🌙"}</button>
        </div>
        <h2 style={{fontFamily:"var(--font-display)",fontSize:26,marginBottom:6,color:"var(--text)"}}>Create account</h2>
        <p className="text-muted text-sm mb-3">Join PlotTracker to manage your projects</p>

        {/* Role selector */}
        <div>
          <span className="field-label">I am a</span>
          <div className="flex gap-2 mb-3">
            {[["owner","🏗️","Owner / Agent","Create & manage projects"],["buyer","🏠","Buyer / Viewer","View layouts & availability"]].map(([r,ic,label,desc])=>(
              <button key={r} className={`role-btn${role===r?" active":""}`} onClick={()=>setRole(r)}>
                <span className="role-icon">{ic}</span>
                <span className="role-label">{label}</span>
                <span className="role-desc">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        <FInput label="Full Name *" value={name} onChange={setName} />
        <FInput label="Email *" value={email} onChange={setEmail} type="email" />
        <FInput label="Phone (optional)" value={phone} onChange={setPhone} />
        <FInput label="Password *" value={pass} onChange={setPass} type="password" />
        {err&&<ErrMsg>{err}</ErrMsg>}
        <button className="btn-primary btn-full" onClick={go} style={{marginBottom:14,fontSize:15,padding:"13px"}}>Create account</button>
        <p className="text-muted text-sm" style={{textAlign:"center"}}>
          Have an account? <span className="text-gold" style={{cursor:"pointer"}} onClick={()=>setView("login")}>Sign in</span>
        </p>
      </div>
    </div>
  );
}

/* ─── SHELL ──────────────────────────────────────────────────────────────── */
function Shell({ ctx, children }) {
  const { dark, toggleDark, user, setUser, setView } = ctx;
  const [menu,setMenu] = useState(false);
  const initials = user?.name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?";
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <header className="app-header">
        <div className="header-logo" onClick={()=>setView("dashboard")}>
          <div className="header-logo-icon">🏘️</div>
          <span className="header-logo-text">PlotTracker</span>
        </div>
        <div className="flex items-center gap-2">
          {user?.role && <span className={`header-badge badge-${user.role}`}>{user.role==="owner"?"🏗️ Owner":"🏠 Buyer"}</span>}
          <button className="theme-btn" onClick={toggleDark}>{dark?"☀️":"🌙"}</button>
          <div style={{position:"relative"}}>
            <div className="avatar" onClick={()=>setMenu(o=>!o)}>{initials}</div>
            {menu && <>
              <div onClick={()=>setMenu(false)} style={{position:"fixed",inset:0,zIndex:300}} />
              <div className="user-menu" style={{zIndex:400}}>
                <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",marginBottom:4}}>
                  <div style={{fontWeight:600,fontSize:14,color:"var(--text)"}}>{user?.name}</div>
                  <div className="text-muted text-xs" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email}</div>
                </div>
                <button onClick={()=>{setUser(null);setView("landing");setMenu(false);}} className="btn-danger btn-full" style={{textAlign:"left",padding:"10px 12px",borderRadius:8,border:"none"}}>Sign out</button>
              </div>
            </>}
          </div>
        </div>
      </header>
      <main style={{flex:1,padding:"clamp(1rem,4vw,1.75rem)",maxWidth:1100,margin:"0 auto",width:"100%",paddingBottom:"max(1.5rem,env(safe-area-inset-bottom,1rem))"}}>
        {children}
      </main>
    </div>
  );
}

/* ─── DASHBOARD ──────────────────────────────────────────────────────────── */
function Dashboard({ ctx }) {
  const { db, user, setView, setProjId, setModal } = ctx;
  const isOwner = user?.role === "owner";
  const open = id => { setProjId(id); setView("project"); };

  // Global stats
  const allPlots = db.projects.flatMap(p=>p.plots||[]);
  const totalSold = allPlots.filter(p=>p.status==="sold").length;
  const totalBooked = allPlots.filter(p=>p.status==="booked").length;
  const totalAvail = allPlots.filter(p=>p.status==="available").length;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-3" style={{flexWrap:"wrap",gap:10}}>
        <div className="animate-fade-up">
          <h2 style={{fontFamily:"var(--font-display)",fontSize:"clamp(22px,6vw,30px)",color:"var(--text)",marginBottom:4}}>
            {isOwner ? "Owner Dashboard" : "Project Browser"}
          </h2>
          <p className="text-muted text-sm">{isOwner ? "Manage all your layout projects" : "Browse available projects and plots"}</p>
        </div>
        <div className="flex gap-2" style={{flexWrap:"wrap"}}>
          {isOwner && <ReportBtn db={db} />}
          {isOwner && <button className="btn-primary animate-fade-up-1" onClick={()=>setModal({type:"create-project"})}>+ New Project</button>}
        </div>
      </div>

      {/* Summary stats (owners only) */}
      {isOwner && db.projects.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:"1.5rem"}} className="animate-fade-up-1">
          {[["Total Projects",db.projects.length,"🏗️","var(--gold)"],["Available",totalAvail,"✅","var(--emerald)"],["Booked",totalBooked,"📋","var(--amber)"],["Sold",totalSold,"🏷️","var(--rose)"]].map(([l,v,ic,c])=>(
            <div key={l} className="stat-box">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <span style={{fontSize:20}}>{ic}</span>
              </div>
              <div style={{fontSize:26,fontWeight:700,color:c,fontFamily:"var(--font-mono)"}}>{v}</div>
              <div className="text-muted text-xs" style={{marginTop:2,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Projects grid */}
      {db.projects.length === 0
        ? <div className="empty-state"><div className="empty-icon">🏗️</div><div className="empty-text">{isOwner ? "No projects yet. Create the first one!" : "No projects available yet."}</div></div>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,280px),1fr))",gap:14}} className="grid-sm-1">
            {db.projects.map((p,i)=>(
              <div key={p.id} className="animate-fade-up" style={{animationDelay:`${i*0.05}s`}}>
                <ProjectCard proj={p} db={db} onClick={()=>open(p.id)} isOwner={p.ownerId===user?.id} />
              </div>
            ))}
          </div>
      }
    </div>
  );
}

function ProjectCard({ proj, db, onClick, isOwner }) {
  const owner = db.users.find(u=>u.id===proj.ownerId);
  const plots = proj.plots||[];
  const total=plots.length, sold=plots.filter(p=>p.status==="sold").length,
        booked=plots.filter(p=>p.status==="booked").length, avail=total-sold-booked;
  const pct = total ? Math.round(sold/total*100) : 0;
  return (
    <div className="project-card" onClick={onClick}>
      <div className="flex justify-between items-center mb-2">
        <div style={{flex:1,minWidth:0,marginRight:8}}>
          <h3 className="truncate" style={{fontSize:16,fontWeight:600,color:"var(--text)",marginBottom:3}}>{proj.name}</h3>
          <p className="text-muted text-xs">by {owner?.name||"Unknown"}</p>
        </div>
        {isOwner && <span style={{fontSize:10,background:"var(--gold-dim)",color:"var(--gold)",padding:"3px 8px",borderRadius:"100px",fontWeight:600,border:"1px solid rgba(201,168,76,0.2)",whiteSpace:"nowrap"}}>Your Project</span>}
      </div>
      {proj.location && <p className="text-muted text-xs mb-2">📍 {proj.location}</p>}
      <div className="flex gap-2 mb-3" style={{flexWrap:"wrap"}}>
        {[[total,"Total","var(--text2)"],[avail,"Avail","var(--emerald)"],[booked,"Booked","var(--amber)"],[sold,"Sold","var(--rose)"]].map(([v,l,c])=>(
          <div key={l} style={{background:"var(--surface2)",borderRadius:8,padding:"5px 9px",textAlign:"center",flex:"1 1 44px",minWidth:40}}>
            <div style={{fontSize:15,fontWeight:700,color:c,fontFamily:"var(--font-mono)"}}>{v}</div>
            <div className="text-xs" style={{color:"var(--text3)",marginTop:1}}>{l}</div>
          </div>
        ))}
      </div>
      <div className="progress-track"><div className="progress-bar" style={{width:`${pct}%`}} /></div>
      <p className="text-xs" style={{color:"var(--text3)",marginTop:4,fontFamily:"var(--font-mono)"}}>{pct}% sold</p>
    </div>
  );
}

/* ─── PROJECT VIEW ───────────────────────────────────────────────────────── */
function ProjectView({ proj, ctx }) {
  const { db, user, setView, setPlotId, setModal } = ctx;
  const isOwnerRole = user?.role === "owner";
  const isProjectOwner = proj.ownerId === user?.id;
  // Any owner-role user can update plots; buyers can only view
  const canEdit = isOwnerRole;

  const plots=proj.plots||[];
  const total=plots.length, sold=plots.filter(p=>p.status==="sold").length,
        booked=plots.filter(p=>p.status==="booked").length, avail=total-sold-booked;
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const filtered = plots.filter(p=>{
    if(filter!=="all"&&p.status!==filter) return false;
    if(search&&!p.number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb animate-fade-up">
        <span className="breadcrumb-link" onClick={()=>setView("dashboard")}>← Dashboard</span>
        <span className="breadcrumb-sep">/</span>
        <span className="truncate" style={{color:"var(--text)",fontWeight:500,maxWidth:"60vw"}}>{proj.name}</span>
      </div>

      {/* Buyer notice */}
      {!isOwnerRole && (
        <div className="buyer-notice animate-fade-up">
          <span style={{fontSize:22}}>🏠</span>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:"var(--sky)"}}>Buyer View</div>
            <div className="text-muted text-sm">You can view layout files and check plot availability. Contact the owner to book or purchase a plot.</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="animate-fade-up-1" style={{marginBottom:"1.25rem"}}>
        <h2 style={{fontFamily:"var(--font-display)",fontSize:"clamp(20px,5vw,28px)",color:"var(--text)",marginBottom:4}}>{proj.name}</h2>
        <p className="text-muted text-sm">by <strong style={{color:"var(--text)"}}>{db.users.find(u=>u.id===proj.ownerId)?.name}</strong> · {DFMT.format(new Date(proj.createdAt))}</p>
        {proj.location && <p className="text-muted text-sm" style={{marginTop:3}}>📍 {proj.location}{proj.mapUrl&&<a href={proj.mapUrl} target="_blank" rel="noreferrer" style={{marginLeft:8,color:"var(--gold)",fontSize:12}}>Open Map ↗</a>}</p>}
        {proj.description && <p className="text-muted text-sm" style={{marginTop:6,maxWidth:480}}>{proj.description}</p>}
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:"1.25rem"}} className="grid-sm-2 animate-fade-up-2">
        {[["Total",total,"var(--text)"],["Available",avail,"var(--emerald)"],["Booked",booked,"var(--amber)"],["Sold",sold,"var(--rose)"]].map(([l,v,c])=>(
          <div key={l} className="stat-box">
            <div style={{fontSize:24,fontWeight:700,color:c,fontFamily:"var(--font-mono)"}}>{v}</div>
            <div className="text-xs text-muted" style={{marginTop:2,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex gap-2 mb-3 actions-row animate-fade-up-3">
        {(proj.files||[]).length>0 && <button className="btn-secondary" onClick={()=>setModal({type:"view-files",proj})}>📎 Files ({proj.files.length})</button>}
        {isProjectOwner && <button className="btn-ghost" onClick={()=>setModal({type:"upload-file",proj})}>⬆ Upload Layout</button>}
        {canEdit && <button className="btn-primary" onClick={()=>setModal({type:"add-plots",proj})}>+ Add Plots</button>}
        {isOwnerRole && <ReportBtn db={db} proj={proj} />}
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 mb-3 animate-fade-up-4" style={{flexWrap:"wrap",alignItems:"center"}}>
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search plot…" style={{paddingLeft:32,fontSize:14}} />
        </div>
        <div className="flex gap-2" style={{flexWrap:"wrap"}}>
          {["all","available","booked","sold"].map(s=>(
            <button key={s} className={`filter-chip${filter===s?" active":""}`} onClick={()=>setFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Plots grid */}
      {filtered.length===0
        ? <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">{plots.length===0?(canEdit?"No plots yet. Tap + Add Plots.":"Owner hasn't added plots yet."):"No plots match."}</div></div>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,152px),1fr))",gap:8}}>
            {filtered.map((pl,i)=>(
              <div key={pl.id} style={{animationDelay:`${i*0.02}s`}} className="animate-fade-up">
                <PlotCard plot={pl} db={db} canEdit={canEdit} onClick={()=>{setPlotId(pl.id);setView("plot");}} />
              </div>
            ))}
          </div>
      }
    </div>
  );
}

function PlotCard({ plot, db, canEdit, onClick }) {
  const colors = {
    available: { bg:"var(--emerald-dim)", color:"var(--emerald)", border:"rgba(16,185,129,0.3)", dot:"var(--emerald)" },
    booked:    { bg:"var(--amber-dim)",   color:"var(--amber)",   border:"rgba(245,158,11,0.3)", dot:"var(--amber)" },
    sold:      { bg:"var(--rose-dim)",    color:"var(--rose)",    border:"rgba(244,63,94,0.3)",  dot:"var(--rose)" },
  };
  const c = colors[plot.status]||colors.available;
  const buyer = plot.buyerId ? db.users.find(u=>u.id===plot.buyerId) : null;
  return (
    <div className="plot-card" onClick={onClick} style={{background:c.bg,borderColor:c.border}}>
      <div className="flex justify-between" style={{alignItems:"flex-start",gap:4,marginBottom:5}}>
        <div style={{fontSize:14,fontWeight:700,color:c.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}># {plot.number}</div>
        <span className="status-pill" style={{background:"transparent",borderColor:c.border,color:c.color}}>
          <span className="status-dot" style={{background:c.dot}} />
          {plot.status}
        </span>
      </div>
      {plot.area  && <div style={{fontSize:11,color:c.color,opacity:.8,marginBottom:2}}>{plot.area}</div>}
      {plot.price && <div style={{fontSize:13,fontWeight:700,color:c.color,fontFamily:"var(--font-mono)"}}>{inr(plot.price)}</div>}
      {buyer && <div style={{fontSize:11,marginTop:5,color:c.color,opacity:.85,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>→ {buyer.name}</div>}
      {plot.date  && <div style={{fontSize:10,color:c.color,opacity:.6,marginTop:2,fontFamily:"var(--font-mono)"}}>{DFMT.format(new Date(plot.date))}</div>}
    </div>
  );
}

/* ─── PLOT DETAIL ────────────────────────────────────────────────────────── */
function PlotView({ plot, proj, ctx }) {
  const { db, user, setView, setModal } = ctx;
  const isOwnerRole = user?.role === "owner";
  const colors = {
    available:{ bg:"var(--emerald-dim)", color:"var(--emerald)", border:"rgba(16,185,129,0.3)" },
    booked:   { bg:"var(--amber-dim)",   color:"var(--amber)",   border:"rgba(245,158,11,0.3)" },
    sold:     { bg:"var(--rose-dim)",    color:"var(--rose)",    border:"rgba(244,63,94,0.3)" },
  };
  const c = colors[plot.status]||colors.available;
  const seller = plot.sellerId ? db.users.find(u=>u.id===plot.sellerId) : null;

  return (
    <div style={{maxWidth:660}}>
      <div className="breadcrumb animate-fade-up">
        <span className="breadcrumb-link" onClick={()=>setView("project")}>← {proj.name}</span>
        <span className="breadcrumb-sep">/</span>
        <span style={{color:"var(--text)"}}>Plot {plot.number}</span>
      </div>

      {/* Main card */}
      <div className="card animate-fade-up-1" style={{marginBottom:"1rem"}}>
        <div className="flex justify-between items-center mb-3" style={{flexWrap:"wrap",gap:8}}>
          <h2 style={{fontFamily:"var(--font-display)",fontSize:"clamp(18px,5vw,24px)",color:"var(--text)"}}>Plot {plot.number}</h2>
          <span className="status-pill" style={{background:c.bg,borderColor:c.border,color:c.color,fontSize:13,padding:"6px 14px"}}>
            <span className="status-dot" style={{background:c.color}} />
            {plot.status}
          </span>
        </div>
        <div className="detail-grid">
          {[["Project",proj.name],["Location",proj.location],["Area",plot.area],["Price",inr(plot.price)],["Facing",plot.facing],["Category",plot.category]].filter(([,v])=>v).map(([k,v])=>(
            <div key={k}><div className="detail-label">{k}</div><div className="detail-value">{v}</div></div>
          ))}
        </div>
        {plot.notes && <div className="note-box"><div style={{fontSize:11,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Notes</div><div style={{fontSize:14,color:"var(--text)"}}>{plot.notes}</div></div>}
      </div>

      {/* Transaction card */}
      {plot.status!=="available" && (
        <div className="card animate-fade-up-2" style={{marginBottom:"1rem"}}>
          <div className="section-head">{plot.status==="sold"?"Buyer Details":"Booker Details"}</div>

          {/* Contact info block */}
          {plot.contactName && (
            <div style={{background:"var(--surface2)",borderRadius:10,padding:"0.9rem 1rem",marginBottom:"1rem",border:"1px solid var(--border)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:"10px 18px"}}>
                {[
                  ["Name", plot.contactName],
                  ["Phone", plot.contactPhone],
                  ["Email", plot.contactEmail],
                  ["City / Area", plot.contactAddress],
                ].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k}>
                    <div className="detail-label">{k}</div>
                    <div className="detail-value">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advance paid pill */}
          {plot.advancePaid !== null && plot.advancePaid !== undefined && (
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1rem",flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--text3)",fontFamily:"var(--font-mono)"}}>Advance Paid</span>
              <span style={{
                padding:"4px 14px", borderRadius:"100px", fontSize:13, fontWeight:600,
                background: plot.advancePaid ? "var(--emerald-dim)" : "var(--rose-dim)",
                color:      plot.advancePaid ? "var(--emerald)"     : "var(--rose)",
                border:     `1.5px solid ${plot.advancePaid ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.35)"}`,
              }}>
                {plot.advancePaid ? "✅ Yes" : "❌ No"}
              </span>
              {plot.advancePaid && plot.advanceAmount && (
                <span style={{fontSize:14,fontWeight:700,color:"var(--emerald)",fontFamily:"var(--font-mono)"}}>
                  {inr(plot.advanceAmount)}
                </span>
              )}
            </div>
          )}

          {/* Recorded by + date */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:"10px 18px",marginBottom: plot.transactionNotes?"1rem":0}}>
            {[
              ["Updated by", seller?.name],
              ["Date", plot.date ? DFMT.format(new Date(plot.date)) : null],
            ].filter(([,v])=>v).map(([k,v])=>(
              <div key={k}>
                <div className="detail-label">{k}</div>
                <div className="detail-value">{v}</div>
              </div>
            ))}
          </div>

          {plot.transactionNotes && (
            <div className="note-box">
              <div style={{fontSize:11,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Notes</div>
              <div style={{fontSize:14,color:"var(--text)",lineHeight:1.55}}>{plot.transactionNotes}</div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {(plot.history||[]).length>0 && (
        <div className="card animate-fade-up-3" style={{marginBottom:"1rem"}}>
          <div className="section-head">Activity History</div>
          {[...(plot.history||[])].reverse().map((h,i,arr)=>{
            const actor = db.users.find(u=>u.id===h.actorId);
            return (
              <div key={i} className="timeline-item">
                <Avatar name={actor?.name||"?"} size={32} />
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{h.action}</div>
                  <div className="text-xs text-muted">by {actor?.name||"System"} · {TFMT.format(new Date(h.at))}</div>
                  {h.note&&<div className="text-sm text-muted" style={{marginTop:2}}>{h.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions - only owners */}
      {isOwnerRole && (
        <div className="flex gap-2" style={{flexWrap:"wrap"}} >
          {plot.status!=="sold" && <button className="btn-primary" onClick={()=>setModal({type:"update-plot",plot,proj})}>Update Status</button>}
          <button className="btn-secondary" onClick={()=>setModal({type:"edit-plot",plot,proj})}>Edit Details</button>
        </div>
      )}
    </div>
  );
}

/* ─── MODALS ─────────────────────────────────────────────────────────────── */
function ModalShell({ modal, ctx, proj, plot }) {
  const { setModal } = ctx;
  const mp  = modal.proj  || proj;
  const mpl = modal.plot  || plot;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        {modal.type==="create-project" && <CreateProjectModal ctx={ctx} />}
        {modal.type==="add-plots"      && <AddPlotsModal ctx={ctx} proj={mp} />}
        {modal.type==="update-plot"    && <UpdatePlotModal ctx={ctx} plot={mpl} proj={mp} />}
        {modal.type==="edit-plot"      && <EditPlotModal ctx={ctx} plot={mpl} proj={mp} />}
        {modal.type==="upload-file"    && <UploadFileModal ctx={ctx} proj={mp} />}
        {modal.type==="view-files"     && <ViewFilesModal ctx={ctx} proj={mp} />}
      </div>
    </div>
  );
}

function CreateProjectModal({ ctx }) {
  const { persist, user, toast$, setModal, setView, setProjId } = ctx;
  const [name,setName]=useState(""); const [loc,setLoc]=useState(""); const [mapUrl,setMapUrl]=useState(""); const [desc,setDesc]=useState(""); const [err,setErr]=useState("");
  const go = () => {
    if(!name.trim()){setErr("Project name required.");return;}
    const p={id:uid(),name:name.trim(),location:loc.trim(),mapUrl:mapUrl.trim(),description:desc.trim(),ownerId:user.id,createdAt:Date.now(),plots:[],files:[]};
    persist(d=>({...d,projects:[...d.projects,p]}));
    toast$("Project created!"); setModal(null); setProjId(p.id); setView("project");
  };
  return <>
    <h3 className="modal-title">New Layout Project</h3>
    <FInput label="Project Name *" value={name} onChange={setName} />
    <FInput label="Location / Address" value={loc} onChange={setLoc} />
    <FInput label="Google Maps URL" value={mapUrl} onChange={setMapUrl} placeholder="https://maps.google.com/..." />
    <FInput label="Description" value={desc} onChange={setDesc} textarea />
    {err&&<ErrMsg>{err}</ErrMsg>}
    <MBtns cancel={()=>setModal(null)} confirm={go} label="Create Project" />
  </>;
}

function AddPlotsModal({ ctx, proj }) {
  const { persist, user, toast$, setModal } = ctx;
  const [mode,setMode]=useState("range");
  const [prefix,setPrefix]=useState(""); const [from,setFrom]=useState("1"); const [to,setTo]=useState("10");
  const [singles,setSingles]=useState("");
  const [area,setArea]=useState(""); const [price,setPrice]=useState("");
  const [err,setErr]=useState("");
  const go = () => {
    let nums=[];
    if(mode==="range"){
      const f=parseInt(from),t=parseInt(to);
      if(isNaN(f)||isNaN(t)||t<f){setErr("Invalid range.");return;}
      nums=Array.from({length:t-f+1},(_,i)=>`${prefix}${f+i}`);
    } else { nums=singles.split(",").map(s=>s.trim()).filter(Boolean); }
    if(!nums.length){setErr("No plot numbers.");return;}
    const ex=new Set(proj.plots.map(p=>p.number));
    const nw=nums.filter(n=>!ex.has(n)).map(n=>({id:uid(),number:n,status:"available",area:area.trim(),price:price.trim(),history:[{action:"Plot added",actorId:user.id,at:Date.now()}]}));
    if(!nw.length){setErr("All plot numbers already exist.");return;}
    persist(d=>({...d,projects:d.projects.map(p=>p.id===proj.id?{...p,plots:[...p.plots,...nw]}:p)}));
    toast$(`${nw.length} plot(s) added!`); setModal(null);
  };
  return <>
    <h3 className="modal-title">Add Plots — {proj.name}</h3>
    <div className="flex gap-2 mb-3">
      {["range","custom"].map(m=>(
        <button key={m} className={`role-btn${mode===m?" active":""}`} onClick={()=>setMode(m)} style={{fontSize:13,padding:"10px 8px"}}>
          {m==="range"?"📏 Range (1–50)":"✏️ Custom Numbers"}
        </button>
      ))}
    </div>
    {mode==="range"
      ? <div className="flex gap-2"><FInput label="Prefix" value={prefix} onChange={setPrefix} placeholder="A-" /><FInput label="From" value={from} onChange={setFrom} type="number" /><FInput label="To" value={to} onChange={setTo} type="number" /></div>
      : <FInput label="Plot Numbers (comma separated)" value={singles} onChange={setSingles} placeholder="101, 102A, B-5" />
    }
    <div className="flex gap-2"><FInput label="Default Area" value={area} onChange={setArea} placeholder="1200 sq.ft" /><FInput label="Default Price (₹)" value={price} onChange={setPrice} type="number" /></div>
    {err&&<ErrMsg>{err}</ErrMsg>}
    <MBtns cancel={()=>setModal(null)} confirm={go} label="Add Plots" />
  </>;
}

function UpdatePlotModal({ ctx, plot, proj }) {
  const { persist, user, toast$, setModal } = ctx;
  const [status,setStatus] = useState(plot.status);

  // Contact details — no login required
  const [cName,setCName]   = useState(plot.contactName||"");
  const [cPhone,setCPhone] = useState(plot.contactPhone||"");
  const [cEmail,setCEmail] = useState(plot.contactEmail||"");
  const [cAddr,setCAddr]   = useState(plot.contactAddress||"");

  // Advance paid
  const [advPaid,setAdvPaid] = useState(plot.advancePaid ?? null); // null | true | false
  const [advAmt,setAdvAmt]   = useState(plot.advanceAmount||"");

  // Notes
  const [note,setNote] = useState(plot.transactionNotes||"");

  const statusColors = {
    available:{ color:"var(--emerald)", border:"rgba(16,185,129,0.4)", bg:"var(--emerald-dim)" },
    booked:   { color:"var(--amber)",   border:"rgba(245,158,11,0.4)", bg:"var(--amber-dim)" },
    sold:     { color:"var(--rose)",    border:"rgba(244,63,94,0.4)",  bg:"var(--rose-dim)" },
  };

  const go = () => {
    if(status!=="available" && !cName.trim()){
      toast$("Please enter the contact name.","err"); return;
    }
    const action = status==="sold"?"Marked as Sold":status==="booked"?"Marked as Booked":"Marked as Available";
    persist(d=>({...d,projects:d.projects.map(p=>p.id===proj.id?{...p,plots:p.plots.map(pl=>pl.id===plot.id?{
      ...pl, status,
      contactName:    status!=="available"?cName.trim():null,
      contactPhone:   status!=="available"?cPhone.trim():null,
      contactEmail:   status!=="available"?cEmail.trim():null,
      contactAddress: status!=="available"?cAddr.trim():null,
      advancePaid:    status!=="available"?advPaid:null,
      advanceAmount:  status!=="available"&&advPaid?advAmt:null,
      transactionNotes: note.trim()||null,
      sellerId:       status!=="available"?user.id:null,
      date:           status!=="available"?Date.now():null,
      history:[...(pl.history||[]),{action,actorId:user.id,note:note.trim()||null,at:Date.now()}]
    }:pl)}:p)}));
    toast$("Plot updated!"); setModal(null);
  };

  return <>
    <h3 className="modal-title">Update Plot {plot.number}</h3>

    {/* Status buttons */}
    <span className="field-label">New Status</span>
    <div className="flex gap-2 mb-3">
      {[["available","✅ Available"],["booked","📋 Booked"],["sold","🏷️ Sold"]].map(([val,lbl])=>{
        const sc=statusColors[val];
        return (
          <button key={val} className="status-toggle" onClick={()=>setStatus(val)}
            style={status===val?{borderColor:sc.border,background:sc.bg,color:sc.color,boxShadow:`0 0 14px ${sc.border}`}:{}}>
            {lbl}
          </button>
        );
      })}
    </div>

    {/* Contact details — shown for booked & sold */}
    {status!=="available" && <>
      <div style={{background:"var(--surface2)",borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid var(--border2)"}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--gold)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.85rem",fontFamily:"var(--font-mono)"}}>
          {status==="sold"?"🏷️ Buyer Details":"📋 Booker Details"}
        </div>
        <div className="flex gap-2">
          <FInput label="Full Name *" value={cName} onChange={setCName} placeholder="e.g. Rajesh Kumar" />
          <FInput label="Phone Number" value={cPhone} onChange={setCPhone} placeholder="9876543210" />
        </div>
        <div className="flex gap-2">
          <FInput label="Email (optional)" value={cEmail} onChange={setCEmail} type="email" placeholder="email@example.com" />
          <FInput label="City / Area" value={cAddr} onChange={setCAddr} placeholder="e.g. Coimbatore" />
        </div>
      </div>

      {/* Advance paid radio */}
      <div style={{marginBottom:"1rem"}}>
        <span className="field-label">Advance Paid?</span>
        <div className="flex gap-2" style={{marginTop:6}}>
          {[[true,"✅ Yes"],[false,"❌ No"]].map(([val,lbl])=>(
            <button key={String(val)} onClick={()=>setAdvPaid(val)}
              style={{
                flex:1, padding:"10px 8px", borderRadius:10, fontFamily:"var(--font-body)",
                fontSize:14, fontWeight:500, cursor:"pointer", transition:"all var(--transition)",
                border:"1.5px solid",
                borderColor: advPaid===val
                  ? (val?"rgba(16,185,129,0.5)":"rgba(244,63,94,0.5)")
                  : "var(--border2)",
                background: advPaid===val
                  ? (val?"var(--emerald-dim)":"var(--rose-dim)")
                  : "var(--surface2)",
                color: advPaid===val
                  ? (val?"var(--emerald)":"var(--rose)")
                  : "var(--text2)",
                boxShadow: advPaid===val
                  ? `0 0 12px ${val?"rgba(16,185,129,0.2)":"rgba(244,63,94,0.2)"}`
                  : "none",
              }}>
              {lbl}
            </button>
          ))}
        </div>
        {advPaid===true && (
          <div style={{marginTop:10}}>
            <FInput label="Advance Amount (₹)" value={advAmt} onChange={setAdvAmt} type="number" placeholder="e.g. 50000" />
          </div>
        )}
      </div>
    </>}

    {/* Notes */}
    <FInput label="Notes / Description" value={note} onChange={setNote} textarea placeholder={status==="booked"?"e.g. Site visit scheduled, token amount discussion pending…":status==="sold"?"e.g. Full payment received, registration on 15 Jun…":"e.g. Plot made available again after cancellation…"} />

    <MBtns cancel={()=>setModal(null)} confirm={go} label="Update Plot" />
  </>;
}

function EditPlotModal({ ctx, plot, proj }) {
  const { persist, toast$, setModal } = ctx;
  const [area,setArea]=useState(plot.area||""); const [price,setPrice]=useState(plot.price||"");
  const [facing,setFacing]=useState(plot.facing||""); const [cat,setCat]=useState(plot.category||""); const [notes,setNotes]=useState(plot.notes||"");
  const go = () => {
    persist(d=>({...d,projects:d.projects.map(p=>p.id===proj.id?{...p,plots:p.plots.map(pl=>pl.id===plot.id?{...pl,area,price,facing,category:cat,notes}:pl)}:p)}));
    toast$("Plot updated!"); setModal(null);
  };
  return <>
    <h3 className="modal-title">Edit Plot {plot.number}</h3>
    <div className="flex gap-2"><FInput label="Area" value={area} onChange={setArea} placeholder="1200 sq.ft" /><FInput label="Price (₹)" value={price} onChange={setPrice} type="number" /></div>
    <div className="flex gap-2"><FInput label="Facing" value={facing} onChange={setFacing} placeholder="North, East…" /><FInput label="Category" value={cat} onChange={setCat} placeholder="Residential…" /></div>
    <FInput label="Notes" value={notes} onChange={setNotes} textarea />
    <MBtns cancel={()=>setModal(null)} confirm={go} label="Save Changes" />
  </>;
}

function UploadFileModal({ ctx, proj }) {
  const { persist, toast$, setModal } = ctx;
  const [files,setFiles]=useState([]); const [label,setLabel]=useState("");
  const ref=useRef();
  const onFile = e => Array.from(e.target.files).forEach(f=>{const r=new FileReader();r.onload=ev=>setFiles(p=>[...p,{name:f.name,type:f.type,size:f.size,data:ev.target.result}]);r.readAsDataURL(f);});
  const go = () => {
    if(!files.length) return;
    const nf=files.map(f=>({id:uid(),name:f.name,type:f.type,size:f.size,data:f.data,label:label.trim(),uploadedBy:proj.ownerId,uploadedAt:Date.now()}));
    persist(d=>({...d,projects:d.projects.map(p=>p.id===proj.id?{...p,files:[...(p.files||[]),...nf]}:p)}));
    toast$(`${nf.length} file(s) uploaded!`); setModal(null);
  };
  return <>
    <h3 className="modal-title">Upload Layout Files</h3>
    <div onClick={()=>ref.current.click()} style={{border:"2px dashed var(--border2)",borderRadius:14,padding:"2rem",textAlign:"center",cursor:"pointer",marginBottom:"1rem",background:"var(--surface2)",transition:"border-color var(--transition)"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--gold)"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border2)"}>
      <div style={{fontSize:32,marginBottom:8}}>📎</div>
      <div className="text-muted text-sm">Tap to select PDF, JPG, PNG, DWG files</div>
      <input ref={ref} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dwg,.svg,.tif,.tiff" style={{display:"none"}} onChange={onFile} />
    </div>
    {files.map((f,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",padding:"8px 12px",background:"var(--surface2)",borderRadius:10,marginBottom:6,gap:8}}>
        <span style={{flex:1,fontSize:13,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
        <span className="text-xs text-muted">{(f.size/1024).toFixed(1)}KB</span>
        <button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"var(--rose)",fontSize:20,padding:0}}>×</button>
      </div>
    ))}
    <FInput label="Label (optional)" value={label} onChange={setLabel} placeholder="Master Layout v2" />
    <MBtns cancel={()=>setModal(null)} confirm={go} label="Upload" />
  </>;
}

function ViewFilesModal({ ctx, proj }) {
  const { persist, user, toast$, setModal } = ctx;
  const files=proj.files||[];
  const isProjectOwner=proj.ownerId===user?.id;
  const dl=f=>{const a=document.createElement("a");a.href=f.data;a.download=f.name;a.click();};
  const del=id=>{persist(d=>({...d,projects:d.projects.map(p=>p.id===proj.id?{...p,files:p.files.filter(f=>f.id!==id)}:p)}));toast$("File removed.");};
  return <>
    <h3 className="modal-title">Layout Files — {proj.name}</h3>
    {files.length===0
      ? <p className="text-muted text-sm" style={{textAlign:"center",padding:"2rem 0"}}>No files uploaded yet.</p>
      : files.map(f=>{
          const isImg=f.type?.startsWith("image/"), isPDF=f.type==="application/pdf";
          return (
            <div key={f.id} className="file-item">
              {isImg && <img src={f.data} alt={f.name} style={{width:"100%",maxHeight:180,objectFit:"cover",display:"block"}} />}
              {isPDF && <div style={{padding:"1rem"}}><embed src={f.data} type="application/pdf" width="100%" height="200px" style={{borderRadius:6}} /></div>}
              {!isImg&&!isPDF && <div style={{padding:"1rem",textAlign:"center",background:"var(--surface2)"}}><p className="text-muted text-sm">📄 {f.name}</p></div>}
              <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.label||f.name}</div>
                  <div className="text-xs text-muted">{(f.size/1024).toFixed(1)} KB · {DFMT.format(new Date(f.uploadedAt))}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn-secondary" onClick={()=>dl(f)}>⬇ Download</button>
                  {isProjectOwner && <button className="btn-danger" onClick={()=>del(f.id)}>Delete</button>}
                </div>
              </div>
            </div>
          );
        })
    }
    <button className="btn-ghost btn-full" style={{marginTop:4}} onClick={()=>setModal(null)}>Close</button>
  </>;
}

/* ─── REPORT DOWNLOAD ────────────────────────────────────────────────────── */
function ReportBtn({ db, proj=null }) {
  const [open,setOpen]=useState(false);
  const umap=Object.fromEntries(db.users.map(u=>[u.id,u]));
  const rows=()=>{const out=[];for(const p of db.projects){if(proj&&p.id!==proj.id)continue;for(const pl of p.plots||[]){const b=umap[pl.buyerId]||{},s=umap[pl.sellerId]||{};out.push({"Project":p.name,"Location":p.location||"","Plot No.":pl.number,"Status":pl.status?.charAt(0).toUpperCase()+pl.status?.slice(1)||"","Area":pl.area||"","Price (₹)":pl.price?Number(pl.price):"","Sale Date":pl.date?DFMT.format(new Date(pl.date)):"","Buyer":b.name||"","Buyer Phone":b.phone||"","Sold By":s.name||""});}}return out;};
  const summary=()=>{const out=[];for(const p of db.projects){if(proj&&p.id!==proj.id)continue;const pls=p.plots||[];const s=pls.filter(x=>x.status==="sold"),b=pls.filter(x=>x.status==="booked"),a=pls.filter(x=>x.status==="available");out.push({"Project":p.name,"Location":p.location||"","Total":pls.length,"Sold":s.length,"Booked":b.length,"Available":a.length,"% Sold":pls.length?Math.round(s.length/pls.length*100)+"%":"0%","Revenue (₹)":s.reduce((acc,x)=>acc+Number(x.price||0),0)});}return out;};
  const dlCSV=()=>{const r=rows();if(!r.length)return;const h=Object.keys(r[0]);const csv=[h.join(","),...r.map(row=>h.map(k=>{const v=String(row[k]??"").replace(/"/g,'""');return v.includes(",")||v.includes('"')?`"${v}"`:v;}).join(","))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv"}));a.download=`PlotTracker_${Date.now()}.csv`;a.click();setOpen(false);};
  const dlXLSX=()=>{const wb=XLSX.utils.book_new();const s1=XLSX.utils.json_to_sheet(summary());s1["!cols"]=Object.keys(summary()[0]||{}).map(k=>({wch:Math.max(k.length,14)}));XLSX.utils.book_append_sheet(wb,s1,"Summary");const r=rows();if(r.length){const s2=XLSX.utils.json_to_sheet(r);s2["!cols"]=Object.keys(r[0]).map(k=>({wch:Math.max(k.length,14)}));XLSX.utils.book_append_sheet(wb,s2,"All Plots");}const txn=rows().filter(r=>["Sold","Booked"].includes(r["Status"]));if(txn.length){const s3=XLSX.utils.json_to_sheet(txn);XLSX.utils.book_append_sheet(wb,s3,"Transactions");}XLSX.writeFile(wb,`PlotTracker_Report_${Date.now()}.xlsx`);setOpen(false);};
  return (
    <div style={{position:"relative",flexShrink:0}}>
      <button className="btn-secondary" onClick={()=>setOpen(o=>!o)}>📊 Report ▾</button>
      {open&&<>
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:99}} />
        <div className="report-menu">
          <p className="text-xs text-muted" style={{padding:"4px 10px 8px",borderBottom:"1px solid var(--border)"}}>Export: {proj?proj.name:"All Projects"}</p>
          {[["📗","Excel (.xlsx)","Summary + plots + transactions",dlXLSX],["📄","CSV (.csv)","Flat format for Google Sheets",dlCSV]].map(([ic,t,s,fn])=>(
            <button key={t} className="report-menu-item" onClick={fn}>
              <span style={{fontSize:18}}>{ic}</span>
              <span><span style={{display:"block",fontSize:13,fontWeight:500,color:"var(--text)"}}>{t}</span><span className="text-xs text-muted">{s}</span></span>
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}

/* ─── ATOMS ──────────────────────────────────────────────────────────────── */
function FInput({ label, value, onChange, type="text", placeholder, textarea }) {
  return (
    <div style={{flex:1,marginBottom:"1rem"}}>
      {label&&<label className="field-label">{label}</label>}
      {textarea
        ?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
        :<input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} />}
    </div>
  );
}
function MBtns({ cancel, confirm, label="Save" }) {
  return (
    <div className="flex gap-2" style={{marginTop:4}}>
      <button className="btn-primary btn-full" onClick={confirm}>{label}</button>
      <button className="btn-ghost btn-full" onClick={cancel}>Cancel</button>
    </div>
  );
}
function ErrMsg({ children }) {
  return <p style={{color:"var(--rose)",fontSize:13,margin:"-6px 0 12px"}}>{children}</p>;
}
function Avatar({ name, size=36 }) {
  const initials=(name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),#7a5820)",color:"#090909",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.36,fontWeight:700,flexShrink:0}}>
      {initials}
    </div>
  );
}