import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import "./styles.css";
import {
  supabase, authSignUp, authSignIn, authSignOut, getSession,
  fetchProfile, fetchAllProfiles,
  fetchProjects, insertProject, deleteProject, archiveProject,
  fetchPlots, insertPlots, patchPlot,
  fetchHistory, insertHistory,
  fetchFiles, uploadFile, removeFile,
  subPlots, subProjects,
} from "./supabaseClient";

/* ── Helpers ─────────────────────────────────────────────────────── */
const DFMT = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const TFMT = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const inr  = v => v ? `₹${Number(v).toLocaleString("en-IN")}` : "";

/* ════════════════════════════════════════════════════════════════
   ROOT
════════════════════════════════════════════════════════════════ */
export default function App() {
  const [dark, setDark]       = useState(() => localStorage.getItem("pt_theme") !== "light");
  const [view, setView]       = useState("booting");
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile]   = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [plots, setPlots]       = useState([]);
  const [files, setFiles]       = useState([]);
  const [history, setHistory]   = useState([]);
  const [projId, setProjId]     = useState(null);
  const [plotId, setPlotId]     = useState(null);
  const [toast, setToast]       = useState(null);
  const [modal, setModal]       = useState(null);
  const [busy, setBusy]         = useState(false);

  const toast$ = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  const toggleDark = () => setDark(d => {
    localStorage.setItem("pt_theme", d ? "light" : "dark");
    return !d;
  });

  /* ── Boot ──────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session?.user) await loadUser(session.user);
      else setView("landing");
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) await loadUser(session.user);
      if (event === "SIGNED_OUT") { setAuthUser(null); setProfile(null); setProjects([]); setView("landing"); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadUser(u) {
    setAuthUser(u);

    // Retry profile fetch up to 3 times (trigger may be slightly delayed)
    let prof = null;
    for (let i = 0; i < 3; i++) {
      const { data } = await fetchProfile(u.id);
      if (data) { prof = data; break; }
      await new Promise(r => setTimeout(r, 800)); // wait 800ms then retry
    }

    // If profile still missing, create it manually from auth metadata
    if (!prof) {
      const meta = u.user_metadata || {};
      const { data: created } = await supabase.from("profiles").insert({
        id: u.id,
        name: meta.name || u.email?.split("@")[0] || "User",
        phone: meta.phone || "",
        role: meta.role || "buyer",
      }).select().single();
      prof = created;
    }

    const { data: profs } = await fetchAllProfiles();
    const { data: projs } = await fetchProjects();
    setProfile(prof);
    setProfiles(profs || []);
    setProjects(projs || []);
    setView("dashboard");
  }

  /* ── Theme ─────────────────────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.body.style.background = dark ? "#09090f" : "#f6f4ee";
  }, [dark]);

  /* ── Realtime ──────────────────────────────────────────────────── */
  useEffect(() => {
  const loadProjects = async () => {
    const { data } = await fetchProjects();
    setProjects(data || []);
  };

  loadProjects();

  const ch = subProjects(async () => {
    const { data } = await fetchProjects();
    setProjects(data || []);
  });

  return () => supabase.removeChannel(ch);
}, []);

  useEffect(() => {
    if (!projId) return;
    const ch = subPlots(projId, async () => {
      const { data } = await fetchPlots(projId);
      setPlots(data || []);
    });
    return () => supabase.removeChannel(ch);
  }, [projId]);

  /* ── Navigation helpers ────────────────────────────────────────── */
  async function openProject(id) {
    setProjId(id); setPlotId(null); setBusy(true);
    const [{ data: pl }, { data: fi }] = await Promise.all([fetchPlots(id), fetchFiles(id)]);
    setPlots(pl || []); setFiles(fi || []);
    setBusy(false); setView("project");
  }
  async function openPlot(id) {
    setPlotId(id); setBusy(true);
    const { data: hi } = await fetchHistory(id);
    setHistory(hi || []);
    setBusy(false); setView("plot");
  }

  const proj = projects.find(p => p.id === projId);
  const plot = plots.find(p => p.id === plotId);

  const ctx = {
    dark, toggleDark, authUser, profile, profiles,
    projects, setProjects, plots, setPlots,
    files, setFiles, history, setHistory,
    projId, setProjId, plotId, setPlotId,
    toast$, setView, setModal, busy, setBusy,
    openProject, openPlot,
  };

  if (view === "booting") return <Booting />;

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      {modal  && <ModalShell modal={modal} ctx={ctx} proj={proj} plot={plot} />}
      {view === "landing"  && <Landing ctx={ctx} />}
      {view === "login"    && <LoginPage ctx={ctx} />}
      {view === "public-projects" && <PublicProjects ctx={ctx} />}
      {view === "register" && <RegisterPage ctx={ctx} />}
      {(view === "dashboard" || view === "project" || view === "plot") && (
        <Shell ctx={ctx}>
          {view === "dashboard" && <Dashboard ctx={ctx} />}
          {view === "project"   && proj && <ProjectView proj={proj} ctx={ctx} />}
          {view === "plot"      && plot && proj && <PlotView plot={plot} proj={proj} ctx={ctx} />}
        </Shell>
      )}
    </>
  );
}

/* ── Booting screen ──────────────────────────────────────────────── */
function Booting() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090f", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 36 }}>🏘️</div>
      <div className="spinner" />
      <div style={{ color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".1em" }}>LOADING</div>
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────── */
function Spin() {
  return <div className="spinner-wrap"><div className="spinner" /></div>;
}

/* ════════════════════════════════════════════════════════════════
   LANDING
════════════════════════════════════════════════════════════════ */
function Landing({ ctx }) {
  const { setView, toggleDark, dark, setModal } = ctx;
  return (
    <div className="landing">
      <div className="orb" style={{ width: 480, height: 480, background: "rgba(201,168,76,0.06)", top: "-18%", left: "50%", transform: "translateX(-50%)" }} />
      <div className="orb" style={{ width: 280, height: 280, background: "rgba(56,189,248,0.05)", bottom: "8%", right: "4%" }} />
      <button className="theme-btn" onClick={toggleDark} style={{ position: "absolute", top: 14, right: 14 }}>{dark ? "☀️" : "🌙"}</button>
      <div style={{ textAlign: "center", maxWidth: 540, width: "100%", position: "relative", zIndex: 1 }}>
        <div className="logo-icon afu">🏘️</div>
        <h1 className="landing-title afu1">INFY-Builders</h1>
        <p className="landing-sub afu2">Premium real estate layout management — track sales, bookings and share verified layouts with your entire team. Data syncs live across all devices.</p>
        <div className="flex g3 afu3" style={{ justifyContent: "center", flexWrap: "wrap", marginBottom: "2.2rem" }}>
          <button className="btn-land-primary" onClick={() => setView("dashboard")}>
  View Projects
</button>

<button className="btn-land-secondary" onClick={() => setView("login")}>
  Sign in
</button>

<button className="btn-land-secondary" onClick={() => setView("register")}>
  Create account
</button>
        </div>
        <div className="flex g2" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          {[["🗺️","Upload Layouts"], ["📊","Track Status"], ["👥","Owner Access"], ["🔒","Buyer View"], ["⚡","Live Sync"]].map(([ic, t]) => (
            <div key={t} className="feat-pill">{ic} {t}</div>
          ))}
        </div>
      </div>
      <div className="landing-footer">
        <button className="footer-link-btn" onClick={() => setModal({ type: "info-about" })}>About</button>
        <span className="landing-footer-sep">·</span>
        <button className="footer-link-btn" onClick={() => setModal({ type: "info-contact" })}>Contact Us</button>
        <span className="landing-footer-sep">·</span>
        <button className="footer-link-btn" onClick={() => setModal({ type: "info-privacy" })}>Privacy Policy</button>
        <span className="landing-footer-sep">·</span>
        <button className="footer-link-btn" onClick={() => setModal({ type: "info-terms" })}>Terms of Service</button>
        <div className="landing-footer-copy">© {new Date().getFullYear()} PlotTracker. All Rights Reserved.</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════════ */
function AuthTop({ ctx, title, sub }) {
  const { setView, dark, toggleDark } = ctx;
  return (
    <>
      <div className="flex aic jsb mb3">
        <div className="flex aic g2" style={{ cursor: "pointer" }} onClick={() => setView("landing")}>
          <div className="header-logo-icon">🏘️</div>
          <span className="header-logo-text" style={{ fontSize: 15 }}>INFY-Builders</span>
        </div>
        <button className="theme-btn" onClick={toggleDark}>{dark ? "☀️" : "🌙"}</button>
      </div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 25, color: "var(--text)", marginBottom: 5 }}>{title}</h2>
      <p className="tmuted tsm mb3">{sub}</p>
    </>
  );
}

function LoginPage({ ctx }) {
  const { setView } = ctx;
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!email || !pass) { setErr("All fields required."); return; }
    setBusy(true); setErr("");
    const { error } = await authSignIn({ email: email.trim().toLowerCase(), password: pass });
    setBusy(false);
    if (error) {
      const msg = error.message || "";
      if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
        setErr("Wrong email or password. Please try again.");
      } else if (msg.includes("Email not confirmed")) {
        setErr("Please confirm your email first. Check your inbox.");
      } else if (msg.includes("Too many requests")) {
        setErr("Too many attempts. Please wait a few minutes.");
      } else {
        setErr(msg || "Login failed. Check your connection and try again.");
      }
      return;
    }
    // onAuthStateChange handles redirect automatically
  };
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <AuthTop ctx={ctx} title="Welcome back" sub="Sign in to your PlotTracker account" />
        <Fi label="Email" value={email} onChange={setEmail} type="email" />
        <Fi label="Password" value={pass} onChange={setPass} type="password" />
        {err && <Err>{err}</Err>}
        <button className="btn-primary btn-full mb3" onClick={go} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="tmuted tsm" style={{ textAlign: "center" }}>
          No account? <span className="tgold" style={{ cursor: "pointer" }} onClick={() => setView("register")}>Register</span>
          {" · "}<span className="tgold" style={{ cursor: "pointer" }} onClick={() => setView("landing")}>Back</span>
        </p>
      </div>
    </div>
  );
}
function PublicProjects({ ctx }) {
  const { projects, setView } = ctx;

  return (
    <div className="page">
      <h1>Available Projects</h1>
<div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
  <button
    className="btn-land-secondary"
    onClick={() => setView("landing")}
  >
    ← Back
  </button>

  <button
    className="btn-land-primary"
    onClick={() => setView("login")}
  >
    Sign In
  </button>
</div>
      <div className="project-grid">
        {projects.map(p => (
  <div key={p.id}>
    <h3>{p.name}</h3>
    <p>{p.location}</p>
  </div>
))}
      </div>
    </div>
  );
}
function RegisterPage({ ctx }) {
  const { setView } = ctx;
  const [role, setRole]   = useState("owner");
  const [name, setName]   = useState(""); const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); const [pass, setPass]   = useState("");
  const [ownerCode, setOwnerCode] = useState("");
  const [err, setErr]     = useState(""); const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);

  const go = async () => {
    if (!name.trim() || !email.trim() || !pass.trim()) { setErr("All required fields missing."); return; }
    if (pass.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (role === "owner") {
  const { data: codeRow } = await supabase
    .from("owner_codes")
    .select("*")
    .eq("code", ownerCode.trim())
    .eq("active", true)
    .single();

  if (!codeRow) {
    setErr("Invalid Owner Access Code");
    return;
  }
}
    setBusy(true); setErr("");
    const { data, error } = await authSignUp({
      email: email.trim().toLowerCase(), password: pass,
      name: name.trim(), phone: phone.trim(), role,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (data?.session) return;
    setDone(true);
  };

  if (done) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", marginBottom: 10 }}>Check your email</h2>
          <p className="tmuted tsm" style={{ marginBottom: 20, lineHeight: 1.6 }}>
            Confirmation link sent to <strong style={{ color: "var(--text)" }}>{email}</strong>. Click it then sign in.
          </p>
          <div style={{ background: "var(--gold-dim)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--gold-light)" }}>
            Check your spam/junk folder if you do not see it.
          </div>
          <button className="btn-primary btn-full" onClick={() => setView("login")}>Go to Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <AuthTop ctx={ctx} title="Create account" sub="Join PlotTracker today" />
        <span className="flabel">I am a</span>
        <div className="flex g2 mb3">
          {[["owner","🏗️","Owner / Agent","Create & manage projects"],["buyer","🏠","Buyer / Viewer","View layouts & availability"]].map(([r,ic,label,desc]) => (
            <button key={r} className={`role-btn${role===r?" active":""}`} onClick={() => setRole(r)}>
              <span className="role-icon">{ic}</span>
              <span className="role-label">{label}</span>
              <span className="role-desc">{desc}</span>
            </button>
          ))}
        </div>
        <Fi label="Full Name *"        value={name}  onChange={setName} />
        <Fi label="Email *"            value={email} onChange={setEmail} type="email" />
        <Fi label="Phone (optional)"   value={phone} onChange={setPhone} />
        {role === "owner" && (
  <Fi
    label="Owner Access Code"
    value={ownerCode}
    onChange={setOwnerCode}
  />
)}
        <Fi label="Password * (min 6)" value={pass}  onChange={setPass}  type="password" />
        {err && <Err>{err}</Err>}
        <button className="btn-primary btn-full mb3" onClick={go} disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
        <p className="tmuted tsm" style={{ textAlign: "center" }}>
          Have an account? <span className="tgold" style={{ cursor: "pointer" }} onClick={() => setView("login")}>Sign in</span>
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SHELL
════════════════════════════════════════════════════════════════ */
function Shell({ ctx, children }) {
  const { dark, toggleDark, profile, authUser, setView, setModal } = ctx;
  const [menu, setMenu] = useState(false);
  const initials = profile?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="app-header">
        <div className="header-logo" onClick={() => setView("dashboard")}>
          <div className="header-logo-icon">🏘️</div>
          <span className="header-logo-text">INFY-Builders</span>
        </div>
        <div className="flex aic g2">
          {profile?.role && <span className={`hbadge hbadge-${profile.role}`}>{profile.role === "owner" ? "🏗️ Owner" : "🏠 Buyer"}</span>}
          <button className="theme-btn" onClick={toggleDark}>{dark ? "☀️" : "🌙"}</button>
          {authUser && (
      <div style={{ position: "relative" }}>
            <div className="avatar" onClick={() => setMenu(o => !o)}>{initials}</div>
            {menu && <>
              <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 300 }} />
              <div className="user-menu" style={{ zIndex: 400 }}>
                <div style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{profile?.name}</div>
                  <div className="tmuted txs trunc">{authUser?.email}</div>
                </div>
                <button onClick={async () => { await authSignOut(); setMenu(false); }} className="btn-danger btn-full" style={{ textAlign: "left", padding: "9px 12px", borderRadius: 7, border: "none" }}>Sign out</button>
              </div>
            </>}
          </div>
      )}
        </div>
      </header>
      <main
  style={{
    flex: 1,
    padding: "clamp(.9rem,4vw,1.6rem)",
    maxWidth: 1100,
    margin: "0 auto",
    width: "100%",
    paddingBottom: "max(1.4rem,env(safe-area-inset-bottom,1rem))"
  }}
>
  {children}
</main>

<footer className="footer">
  <div className="footer-inner">
    <div className="footer-brand">
      <h3>INFY-Builders</h3>
      <p>Premium Real Estate Plot Management Platform</p>
    </div>

    <div className="footer-links">
      <button className="footer-link-btn" onClick={() => setModal({ type: "info-about" })}>About</button>
      <button className="footer-link-btn" onClick={() => setModal({ type: "info-contact" })}>Contact Us</button>
      <button className="footer-link-btn" onClick={() => setModal({ type: "info-privacy" })}>Privacy Policy</button>
      <button className="footer-link-btn" onClick={() => setModal({ type: "info-terms" })}>Terms of Service</button>
    </div>

    <div className="footer-copy">
      © {new Date().getFullYear()} PlotTracker. All Rights Reserved.
    </div>
  </div>
</footer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════════ */
function Dashboard({ ctx }) {
  const { profile, authUser, projects, openProject, setModal, busy, toast$, setProjects, setView } = ctx;
  const isOwner = profile?.role === "owner";
  const [tab, setTab] = useState("active"); // "active" | "archived"
  const allPlots = projects.flatMap(p => p._plots || []);

  const activeProjects   = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p =>  p.archived);
  const shown = tab === "active" ? activeProjects : archivedProjects;

  const handleArchive = async (proj, e) => {
    e.stopPropagation();
    const { error } = await archiveProject(proj.id, !proj.archived);
    if (error) { toast$(error.message, "err"); return; }
    const { data } = await fetchProjects();
    setProjects(data || []);
    toast$(proj.archived ? "Project restored!" : "Project archived.");
  };

  const handleDelete = async (proj, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${proj.name}" permanently? This cannot be undone.`)) return;
    const { error } = await deleteProject(proj.id);
    if (error) { toast$(error.message, "err"); return; }
    const { data } = await fetchProjects();
    setProjects(data || []);
    toast$("Project deleted.");
  };

  return (
    <div>
      <div className="flex jsb aic mb3 fw" style={{ gap: 10 }}>
        <div className="afu">
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(21px,6vw,29px)", color: "var(--text)", marginBottom: 3 }}>
            {isOwner ? "Owner Dashboard" : "Project Browser"}
          </h2>
          <p className="tmuted tsm">{isOwner ? "Manage all layout projects" : "Browse available projects and plots"}</p>
          {!authUser && (
  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
    <button
      className="btn-land-secondary"
      onClick={() => setView("landing")}
    >
      ← Back
    </button>

    <button
      className="btn-land-primary"
      onClick={() => setView("login")}
    >
      Sign In
    </button>
  </div>
)}
        </div>
        <div className="flex g2 fw">
          {isOwner && <ReportBtn projects={activeProjects} allPlots={allPlots} profiles={ctx.profiles} />}
          {isOwner && <button className="btn-primary afu1" onClick={() => setModal({ type: "create-project" })}>+ New Project</button>}
        </div>
      </div>

      {/* Tabs */}
      {isOwner && (
        <div className="flex g2 mb3" style={{ borderBottom: "1.5px solid var(--border)", paddingBottom: 0 }}>
          {[["active", "🏗️ Active", activeProjects.length], ["archived", "📦 Archived", archivedProjects.length]].map(([t, label, count]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "9px 18px 11px", border: "none", background: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600, fontFamily: "var(--font-body)",
              color: tab === t ? "var(--gold)" : "var(--text2)",
              borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent",
              marginBottom: -1.5, transition: "all var(--ease)",
              display: "flex", alignItems: "center", gap: 7,
            }}>
              {label}
              <span style={{ fontSize: 11, background: tab === t ? "var(--gold-dim)" : "var(--surface2)", color: tab === t ? "var(--gold)" : "var(--text3)", padding: "1px 7px", borderRadius: "100px", fontFamily: "var(--font-mono)" }}>
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {busy ? <Spin /> : shown.length === 0
        ? <div className="empty">
            <div className="empty-icon">{tab === "archived" ? "📦" : "🏗️"}</div>
            <div>{tab === "archived" ? "No archived projects." : isOwner ? "No projects yet. Create the first one!" : "No projects available yet."}</div>
          </div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,275px),1fr))", gap: 13 }} className="g1-sm">
            {shown.map((p, i) => (
              <div key={p.id} className="afu" style={{ animationDelay: `${i * 0.05}s` }}>
                <ProjCard
                  proj={p} profiles={ctx.profiles}
                  onClick={() => !p.archived && openProject(p.id)}
                  isOwner={p.owner_id === authUser?.id}
                  onArchive={isOwner && p.owner_id === authUser?.id ? (e) => handleArchive(p, e) : null}
                  onDelete={isOwner && p.owner_id === authUser?.id ? (e) => handleDelete(p, e) : null}
                  authUser={authUser}
setProjects={setProjects}
                />
              </div>
            ))}
          </div>
      }
    </div>
  );
}

function ProjCard({ proj, profiles, onClick, isOwner, onArchive, onDelete, authUser, setProjects }) {
  const owner  = profiles.find(u => u.id === proj.owner_id);
  const pplots = proj._plots || [];
  const total = pplots.length, sold = pplots.filter(p => p.status === "sold").length,
        bkd   = pplots.filter(p => p.status === "booked").length, avail = total - sold - bkd;
  const pct = total ? Math.round(sold / total * 100) : 0;
  const [menu, setMenu] = useState(false);

  return (
    <div
  className="project-card"
  onClick={onClick}
  style={{
    opacity: proj.archived ? 0.7 : 1,
    backgroundImage: proj.cover_image
      ? `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.75)), url(${proj.cover_image})`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat"
  }}
>
  
      <div className="flex jsb aic mb2 fw">
        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <div className="flex aic g2" style={{ marginBottom: 3 }}>
            <div className="trunc semi" style={{ fontSize: 15, color: "var(--text)" }}>{proj.name}</div>
            {proj.archived && <span style={{ fontSize: 10, background: "var(--surface3)", color: "var(--text3)", padding: "2px 7px", borderRadius: "100px", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>Archived</span>}
          </div>
          <div className="tmuted txs">by {owner?.name || "Unknown"}</div>
        </div>
        {/* 3-dot menu for owner */}
        {isOwner && (onArchive || onDelete) && (
          <div style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button onClick={e => { e.stopPropagation(); setMenu(o => !o); }}
              style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "1.5px solid var(--border2)", color: "var(--text2)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all var(--ease)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text2)"; }}>
              ⋯
            </button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
                <div style={{ position: "absolute", top: 36, right: 0, zIndex: 100, background: "var(--surface)", border: "1.5px solid var(--border2)", borderRadius: 12, padding: 5, minWidth: 160, boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}>
                  {/* Gold top line */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,var(--gold),transparent)", opacity: .4, borderRadius: "12px 12px 0 0" }} />
                  <button
                    onClick={() => document.getElementById(`cover-${proj.id}`)?.click()}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "10px 12px",
    background: "none",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text2)",
    textAlign: "left"
  }}
>
  <span style={{ fontSize: 16 }}>🖼️</span>
  Upload Cover Image
</button>
                  <input
  id={`cover-${proj.id}`}
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data } = await uploadFile({
      projectId: proj.id,
      file,
      label: "Cover Image",
      userId: authUser.id
    });

    await supabase
      .from("projects")
      .update({
        cover_image: data?.storage_path || data?.[0]?.storage_path
      })
      .eq("id", proj.id);

    const { data: projectsData } = await fetchProjects();
    setProjects(projectsData || []);

    alert("Cover image updated!");
  }}
/>
                  {onArchive && (
                    <button onClick={onArchive} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--text2)", fontFamily: "var(--font-body)", transition: "all var(--ease)", textAlign: "left" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--gold-dim)"; e.currentTarget.style.color = "var(--gold)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text2)"; }}>
                      <span style={{ fontSize: 16 }}>{proj.archived ? "♻️" : "📦"}</span>
                      {proj.archived ? "Restore Project" : "Archive Project"}
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={onDelete} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--rose)", fontFamily: "var(--font-body)", transition: "all var(--ease)", textAlign: "left" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--rose-dim)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                      <span style={{ fontSize: 16 }}>🗑️</span>Delete Project
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {proj.location && <p className="tmuted txs mb2">📍 {proj.location}</p>}
      <div className="flex g2 mb3 fw">
        {[[total,"Total","var(--text2)"],[avail,"Avail","var(--emerald)"],[bkd,"Booked","var(--amber)"],[sold,"Sold","var(--rose)"]].map(([v,l,c]) => (
          <div key={l} style={{ background: "var(--surface2)", borderRadius: 7, padding: "5px 8px", textAlign: "center", flex: "1 1 42px", minWidth: 38 }}>
            <div className="semi mono" style={{ fontSize: 14, color: c }}>{v}</div>
            <div className="txs" style={{ color: "var(--text3)", marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>
      <div className="ptrack"><div className="pbar" style={{ width: `${pct}%` }} /></div>
      <p className="txs mono" style={{ color: "var(--text3)", marginTop: 4 }}>{pct}% sold</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PROJECT VIEW
════════════════════════════════════════════════════════════════ */
function ProjectView({ proj, ctx }) {
  const { profile, authUser, plots, files, setView, openPlot, setModal, busy, profiles } = ctx;
  const isOwnerRole    = profile?.role === "owner";
  const isProjectOwner = proj.owner_id === authUser?.id;
  const total = plots.length, sold = plots.filter(p => p.status === "sold").length,
        bkd   = plots.filter(p => p.status === "booked").length, avail = total - sold - bkd;
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const filtered = plots
  .filter(
    p =>
      (filter === "all" || p.status === filter) &&
      (!search || p.number.toLowerCase().includes(search.toLowerCase()))
  )
  .sort((a, b) => Number(a.number) - Number(b.number));
  const ownerProf = profiles.find(u => u.id === proj.owner_id);

  return (
    <div>
      <div className="bc afu">
        <span className="bc-link" onClick={() => setView("dashboard")}>← Dashboard</span>
        <span style={{ color: "var(--text3)" }}>/</span>
        <span className="trunc semi" style={{ color: "var(--text)", maxWidth: "58vw" }}>{proj.name}</span>
      </div>

      {!isOwnerRole && (
        <div className="buyer-notice afu">
          <span style={{ fontSize: 21 }}>🏠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sky)" }}>Buyer View</div>
            <div className="tmuted tsm">You can view layout files and check plot availability. Contact the owner to book or purchase a plot.</div>
          </div>
        </div>
      )}

      <div className="afu1 mb3">
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(19px,5vw,27px)", color: "var(--text)", marginBottom: 4 }}>{proj.name}</h2>
        <p className="tmuted tsm">by <strong style={{ color: "var(--text)" }}>{ownerProf?.name}</strong> · {DFMT.format(new Date(proj.created_at))}</p>
        {proj.location && <p className="tmuted tsm" style={{ marginTop: 2 }}>📍 {proj.location}{proj.map_url && <a href={proj.map_url} target="_blank" rel="noreferrer" style={{ marginLeft: 7, color: "var(--gold)", fontSize: 12 }}>Map ↗</a>}</p>}
        {proj.description && <p className="tmuted tsm" style={{ marginTop: 5, maxWidth: 480 }}>{proj.description}</p>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: "1.1rem" }} className="g2-sm afu2">
        {[["Total",total,"var(--text)"],["Available",avail,"var(--emerald)"],["Booked",bkd,"var(--amber)"],["Sold",sold,"var(--rose)"]].map(([l,v,c]) => (
          <div key={l} className="stat-box">
            <div className="semi mono" style={{ fontSize: 22, color: c }}>{v}</div>
            <div className="txs tmuted" style={{ marginTop: 2, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="flex g2 mb3 afu3 scroll-row">
        {files.length > 0 && <button className="btn-secondary" onClick={() => setModal({ type: "view-files", proj })}>📎 Files ({files.length})</button>}
        {isProjectOwner && <button className="btn-ghost" onClick={() => setModal({ type: "upload-file", proj })}>⬆ Upload Layout</button>}
        {isOwnerRole    && <button className="btn-primary" onClick={() => setModal({ type: "add-plots", proj })}>+ Add Plots</button>}
        {isOwnerRole    && <ReportBtn projects={[proj]} allPlots={plots} profiles={ctx.profiles} single />}
        {isProjectOwner && <button className="btn-ghost" onClick={() => setModal({ type: "project-settings", proj })}>⚙️ Settings</button>}
      </div>

      <div className="flex g2 mb3 afu4 fw aic">
        <div className="srch">
          <span className="srch-icon">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plot…" style={{ paddingLeft: 29, fontSize: 14 }} />
        </div>
        <div className="flex g2 fw">
          {["all","available","booked","sold"].map(s => (
            <button key={s} className={`chip${filter === s ? " active" : ""}`} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {busy ? <Spin /> : filtered.length === 0
        ? <div className="empty"><div className="empty-icon">📋</div><div>{plots.length === 0 ? (isOwnerRole ? "No plots yet. Tap + Add Plots." : "Owner hasn't added plots yet.") : "No plots match."}</div></div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,150px),1fr))", gap: 8 }}>
            {filtered.map((pl, i) => <PlotTile
  key={pl.id}
  plot={pl}
  i={i}
  isOwnerRole={isOwnerRole}
  onClick={() => {
    if(profile?.role === "owner"){
      openPlot(pl.id);
    }
  }}
/>)}
          </div>
      }
    </div>
  );
}

function PlotTile({ plot, i, onClick, isOwnerRole }) {
  const C = {
    available: { bg: "var(--emerald-dim)", c: "var(--emerald)", b: "rgba(16,185,129,.28)" },
    booked:    { bg: "var(--amber-dim)",   c: "var(--amber)",   b: "rgba(245,158,11,.28)" },
    sold:      { bg: "var(--rose-dim)",    c: "var(--rose)",    b: "rgba(244,63,94,.28)" },
  };
  const s = C[plot.status] || C.available;
  return (
    <div className="plot-card afu" style={{ background: s.bg, borderColor: s.b, animationDelay: `${i * 0.02}s` }} onClick={onClick}>
      <div className="flex jsb" style={{ alignItems: "flex-start", gap: 4, marginBottom: 5 }}>
        <div className="semi trunc" style={{ fontSize: 14, color: s.c }}>#{plot.number}</div>
        <span className="spill" style={{ background: "transparent", borderColor: s.b, color: s.c }}>
          <span className="sdot" style={{ background: s.c }} />{plot.status}
        </span>
      </div>
      {isOwnerRole && plot.area && <div style={{ fontSize: 11, color: s.c, opacity: .78, marginBottom: 2 }}>{plot.area}</div>}

{isOwnerRole && plot.price && <div className="semi mono" style={{ fontSize: 13, color: s.c }}>{inr(plot.price)}</div>}

{isOwnerRole && plot.contact_name && <div className="trunc" style={{ fontSize: 11, marginTop: 5, color: s.c, opacity: .82 }}>{plot.contact_name}</div>}

{isOwnerRole && plot.transaction_date && <div className="mono txs" style={{ color: s.c, opacity: .6, marginTop: 2 }}>{DFMT.format(new Date(plot.transaction_date))}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PLOT DETAIL
════════════════════════════════════════════════════════════════ */
function PlotView({ plot, proj, ctx }) {
  const { profile, profiles, history, setView, setModal, busy } = ctx;
  const isOwnerRole = profile?.role === "owner";
  const C = {
    available: { bg: "var(--emerald-dim)", c: "var(--emerald)", b: "rgba(16,185,129,.3)" },
    booked:    { bg: "var(--amber-dim)",   c: "var(--amber)",   b: "rgba(245,158,11,.3)" },
    sold:      { bg: "var(--rose-dim)",    c: "var(--rose)",    b: "rgba(244,63,94,.3)" },
  };
  const s      = C[plot.status] || C.available;
  const seller = profiles.find(u => u.id === plot.seller_id);

  return (
    <div style={{ maxWidth: 660 }}>
      <div className="bc afu">
        <span className="bc-link" onClick={() => setView("project")}>← {proj.name}</span>
        <span style={{ color: "var(--text3)" }}>/</span>
        <span style={{ color: "var(--text)" }}>Plot {plot.number}</span>
      </div>

      {/* Main info */}
      <div className="card afu1 mb3">
        <div className="flex jsb aic mb3 fw" style={{ gap: 8 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(18px,5vw,23px)", color: "var(--text)" }}>Plot {plot.number}</h2>
          <span className="spill" style={{ background: s.bg, borderColor: s.b, color: s.c, fontSize: 13, padding: "5px 13px" }}>
            <span className="sdot" style={{ background: s.c }} />{plot.status}
          </span>
        </div>
        <div className="dgrid">
          {[["Project",proj.name],["Location",proj.location],["Area",plot.area],["Price",inr(plot.price)],["Facing",plot.facing],["Category",plot.category]].filter(([,v])=>v).map(([k,v])=>(
            <div key={k}><div className="dlabel">{k}</div><div className="dval">{v}</div></div>
          ))}
        </div>
        {plot.notes && <div className="notebox" style={{ marginTop: "1rem" }}><div className="dlabel mb1">Notes</div><div style={{ fontSize: 14, color: "var(--text)" }}>{plot.notes}</div></div>}
      </div>

      {/* Transaction */}
      {plot.status !== "available" && (
        <div className="card afu2 mb3">
          <div className="sec-head">{plot.status === "sold" ? "Buyer Details" : "Booker Details"}</div>
          {plot.contact_name && (
            <div style={{ background: "var(--surface2)", borderRadius: 10, padding: ".85rem 1rem", marginBottom: "1rem", border: "1px solid var(--border)" }}>
              <div className="dgrid">
                {[["Name",plot.contact_name],["Phone",plot.contact_phone],["Email",plot.contact_email],["City / Area",plot.contact_address]].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k}><div className="dlabel">{k}</div><div className="dval">{v}</div></div>
                ))}
              </div>
            </div>
          )}
          {plot.advance_paid !== null && plot.advance_paid !== undefined && (
            <div className="flex aic g2 mb3 fw">
              <span className="mono txs semi" style={{ color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".07em" }}>Advance Paid</span>
              <span style={{ padding: "4px 13px", borderRadius: "100px", fontSize: 13, fontWeight: 600, background: plot.advance_paid ? "var(--emerald-dim)" : "var(--rose-dim)", color: plot.advance_paid ? "var(--emerald)" : "var(--rose)", border: `1.5px solid ${plot.advance_paid ? "rgba(16,185,129,.32)" : "rgba(244,63,94,.32)"}` }}>
                {plot.advance_paid ? "✅ Yes" : "❌ No"}
              </span>
              {plot.advance_paid && plot.advance_amount && <span className="semi mono" style={{ fontSize: 14, color: "var(--emerald)" }}>{inr(plot.advance_amount)}</span>}
            </div>
          )}
          <div className="dgrid" style={{ marginBottom: plot.transaction_notes ? "1rem" : 0 }}>
            {[["Updated by",seller?.name],["Date",plot.transaction_date ? DFMT.format(new Date(plot.transaction_date)) : null]].filter(([,v])=>v).map(([k,v])=>(
              <div key={k}><div className="dlabel">{k}</div><div className="dval">{v}</div></div>
            ))}
          </div>
          {plot.transaction_notes && <div className="notebox"><div className="dlabel mb1">Notes</div><div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55 }}>{plot.transaction_notes}</div></div>}
        </div>
      )}

      {/* History */}
      {busy ? <Spin /> : history.length > 0 && (
        <div className="card afu3 mb3">
          <div className="sec-head">Activity History</div>
          {history.map(h => (
            <div key={h.id} className="titem">
              <Av name={h.actor?.name || "?"} size={31} />
              <div style={{ minWidth: 0 }}>
                <div className="semi tsm" style={{ color: "var(--text)" }}>{h.action}</div>
                <div className="txs tmuted">by {h.actor?.name || "System"} · {TFMT.format(new Date(h.created_at))}</div>
                {h.note && <div className="tsm tmuted" style={{ marginTop: 2 }}>{h.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {isOwnerRole && (
        <div className="flex g2 fw">
          {plot.status !== "sold" && <button className="btn-primary" onClick={() => setModal({ type: "update-plot", plot, proj })}>Update Status</button>}
          <button className="btn-secondary" onClick={() => setModal({ type: "edit-plot", plot, proj })}>Edit Details</button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MODALS
════════════════════════════════════════════════════════════════ */
function ModalShell({ modal, ctx, proj, plot }) {
  const mp = modal.proj || proj, mpl = modal.plot || plot;
  const isInfo = modal.type?.startsWith("info-");
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && ctx.setModal(null)}>
      <div className={isInfo ? "sheet sheet-info" : "sheet"}>
        <div className="sheet-handle" />
        {modal.type === "create-project" && <CreateProjectModal ctx={ctx} />}
        {modal.type === "add-plots"      && <AddPlotsModal ctx={ctx} proj={mp} />}
        {modal.type === "update-plot"    && <UpdatePlotModal ctx={ctx} plot={mpl} proj={mp} />}
        {modal.type === "edit-plot"      && <EditPlotModal ctx={ctx} plot={mpl} proj={mp} />}
        {modal.type === "upload-file"    && <UploadFileModal ctx={ctx} proj={mp} />}
        {modal.type === "view-files"        && <ViewFilesModal ctx={ctx} proj={mp} />}
        {modal.type === "project-settings" && <ProjectSettingsModal ctx={ctx} proj={mp} />}
        {modal.type === "info-about"   && <AboutModal ctx={ctx} />}
        {modal.type === "info-contact" && <ContactModal ctx={ctx} />}
        {modal.type === "info-privacy" && <PrivacyModal ctx={ctx} />}
        {modal.type === "info-terms"   && <TermsModal ctx={ctx} />}
      </div>
    </div>
  );
}

/* ── Info Modal shared header ── */
function InfoHeader({ icon, title, setModal }) {
  return (
    <div className="flex jsb aic mb3">
      <h3 className="sheet-title" style={{ marginBottom: 0 }}>{icon} {title}</h3>
      <button className="btn-ghost" onClick={() => setModal(null)} style={{ padding: "7px 11px", fontSize: 16, lineHeight: 1 }}>✕</button>
    </div>
  );
}

function AboutModal({ ctx }) {
  const { setModal } = ctx;
  return (
    <div className="info-modal">
      <InfoHeader icon="🏘️" title="About PlotTracker" setModal={setModal} />
      <div className="info-body">
        <p>PlotTracker is a premium real estate layout management by INFY-Builders, a platform built to help land developers, agents, and buyers track plot availability, bookings, and sales — all in one place, synced live across every device.</p>
        <p>Owners can create layout projects, upload site plans, manage plot status in real time, and generate detailed Excel/CSV reports. Buyers get a clean, read-only view of available plots and project layouts, with no clutter and no confusion.</p>
        <div className="info-divider" />
        <div className="info-row">
          <span className="info-row-label">Developed by</span>
          <span className="info-row-value">Tony Achu Jr</span>
        </div>
        <div className="info-row">
          <span className="info-row-label">Version</span>
          <span className="info-row-value mono">2.0.0</span>
        </div>
        <div className="info-row">
          <span className="info-row-label">Built with</span>
          <span className="info-row-value">React · Supabase · Vercel</span>
        </div>
        <a href="https://tonyachujr.my.canva.site" target="_blank" rel="noreferrer" className="btn-secondary btn-full" style={{ marginTop: 16, textDecoration: "none" }}>
          🔗 Visit Developer Portfolio
        </a>
      </div>
    </div>
  );
}

function ContactModal({ ctx }) {
  const { setModal, toast$ } = ctx;
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [msg, setMsg] = useState("");
  const send = () => {
    if (!name.trim() || !email.trim() || !msg.trim()) { toast$("Please fill in all fields.", "err"); return; }
    const subject = encodeURIComponent(`PlotTracker Support — ${name.trim()}`);
    const body = encodeURIComponent(`Name: ${name.trim()}\nEmail: ${email.trim()}\n\nMessage:\n${msg.trim()}`);
    window.location.href = `mailto:tonyachujrart@gmail.com?subject=${subject}&body=${body}`;
    toast$("Opening your email app…", "ok");
    setModal(null);
  };
  return (
    <div className="info-modal">
      <InfoHeader icon="✉️" title="Contact Support" setModal={setModal} />
      <div className="info-body">
        <p>Have a question, found a bug, or need help with your account? Send us a message and we'll get back to you as soon as possible.</p>
        <Fi label="Your Name *" value={name} onChange={setName} placeholder="Full name" />
        <Fi label="Your Email *" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
        <Fi label="Message *" value={msg} onChange={setMsg} textarea placeholder="Describe your issue or question…" />
        <button className="btn-primary btn-full" onClick={send} style={{ marginTop: 4 }}>✉️ Send Message</button>
        <div className="info-divider" />
        <div className="info-row">
          <span className="info-row-label">Direct Email</span>
          <a href="mailto:tonyachujrart@gmail.com" className="info-row-value tgold">tonyachujrart@gmail.com</a>
        </div>
        <div className="info-row">
          <span className="info-row-label">Response Time</span>
          <span className="info-row-value">Within 24–48 hours</span>
        </div>
      </div>
    </div>
  );
}

function PrivacyModal({ ctx }) {
  const { setModal } = ctx;
  return (
    <div className="info-modal">
      <InfoHeader icon="🔒" title="Privacy Policy" setModal={setModal} />
      <div className="info-body info-scroll">
        <p className="info-updated">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <h4>1. Information We Collect</h4>
        <p>When you register for PlotTracker, we collect your name, email address, phone number (optional), and account role (Owner or Buyer). When you use the platform, we store project details, plot information, transaction records, and uploaded layout files that you choose to add.</p>

        <h4>2. How We Use Your Information</h4>
        <p>Your information is used solely to operate PlotTracker — to authenticate your account, display your projects and plots, enable communication between owners and buyers, and generate reports you request. We do not sell or rent your personal data to third parties.</p>

        <h4>3. Data Storage</h4>
        <p>All data is stored securely using Supabase, a managed PostgreSQL database provider with industry-standard encryption at rest and in transit. Uploaded layout files are stored in Supabase Storage with access controls enforced at the database level.</p>

        <h4>4. Data Sharing</h4>
        <p>Project and plot data marked as visible to buyers can be seen by any registered user with a Buyer role, as this is core to the platform's purpose of transparent plot availability. Contact details entered for bookings and sales are visible only to the project owner who recorded them.</p>

        <h4>5. Your Rights</h4>
        <p>You may request access to, correction of, or deletion of your personal data at any time by contacting support. Deleting your account will remove your profile and any projects you own, along with their associated plots and files.</p>

        <h4>6. Cookies & Local Storage</h4>
        <p>PlotTracker uses only your browser local storage only to remember your theme preference (dark or light mode). No tracking cookies or third-party advertising scripts are used.</p>

        <h4>7. Changes to This Policy</h4>
        <p>We may update this policy from time to time. Continued use of PlotTracker after changes constitutes acceptance of the revised policy.</p>

        <h4>8. Contact</h4>
        <p>For privacy-related questions, contact us at <a href="mailto:tonyachujrart@gmail.com" className="tgold">tonyachujrart@gmail.com</a>.</p>
      </div>
    </div>
  );
}

function TermsModal({ ctx }) {
  const { setModal } = ctx;
  return (
    <div className="info-modal">
      <InfoHeader icon="📜" title="Terms of Service" setModal={setModal} />
      <div className="info-body info-scroll">
        <p className="info-updated">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <h4>1. Acceptance of Terms</h4>
        <p>By creating an account and using PlotTracker, you agree to be bound by these Terms of Service. If you do not agree, please discontinue use of the platform.</p>

        <h4>2. Account Roles</h4>
        <p>PlotTracker offers two account types: Owner/Agent accounts, which can create and manage layout projects, add and update plots, and generate reports; and Buyer/Viewer accounts, which can browse projects and check plot availability. Misrepresenting your role to gain unauthorized access is prohibited.</p>

        <h4>3. Accuracy of Information</h4>
        <p>Owners are responsible for the accuracy of project details, plot statuses, pricing, and transaction information they enter. PlotTracker is a record-keeping and visibility tool — it does not verify land titles, ownership, or legal validity of any listed plot or transaction.</p>

        <h4>4. No Brokerage or Legal Advice</h4>
        <p>PlotTracker does not act as a real estate broker, agent, or legal advisor. Any booking, sale, or transaction recorded on the platform is between the parties involved. Users should conduct independent due diligence and seek professional legal advice before any real estate transaction.</p>

        <h4>5. User Conduct</h4>
        <p>You agree not to upload unlawful, misleading, or infringing content, not to misuse the platform to harass other users, and not to attempt to gain unauthorized access to accounts or data that do not belong to you.</p>

        <h4>6. Limitation of Liability</h4>
        <p>PlotTracker is provided "as is" without warranties of any kind. We are not liable for any financial loss, disputes, or damages arising from transactions recorded on the platform, or from inaccuracies in user-submitted data.</p>

        <h4>7. Termination</h4>
        <p>We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the platform.</p>

        <h4>8. Changes to These Terms</h4>
        <p>We may revise these Terms of Service periodically as per client/organisation requirements. Continued use of PlotTracker after changes are posted constitutes acceptance of the updated terms.</p>

        <h4>10. Contact</h4>
        <p>For questions about these terms, contact us at <a href="mailto:tonyachujrart@gmail.com" className="tgold">tonyachujrart@gmail.com</a>.</p>
      </div>
    </div>
  );
}

function CreateProjectModal({ ctx }) {
  const { authUser, toast$, setModal, openProject, setProjects } = ctx;
  const [name,setName]=useState(""); const [loc,setLoc]=useState("");
  const [mapUrl,setMapUrl]=useState(""); const [desc,setDesc]=useState("");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const go = async () => {
    if (!name.trim()) { setErr("Project name required."); return; }
    setBusy(true);
    const { data, error } = await insertProject({ name:name.trim(), location:loc.trim(), mapUrl:mapUrl.trim(), description:desc.trim(), ownerId:authUser.id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const { data: projs } = await fetchProjects();
    setProjects(projs || []);
    toast$("Project created!"); setModal(null); openProject(data.id);
  };
  return <>
    <h3 className="sheet-title">New Layout Project</h3>
    <Fi label="Project Name *" value={name} onChange={setName} />
    <Fi label="Location / Address" value={loc} onChange={setLoc} />
    <Fi label="Google Maps URL (optional)" value={mapUrl} onChange={setMapUrl} placeholder="https://maps.google.com/..." />
    <Fi label="Description" value={desc} onChange={setDesc} textarea />
    {err && <Err>{err}</Err>}
    <Btns cancel={() => setModal(null)} confirm={go} label={busy?"Creating…":"Create Project"} disabled={busy} />
  </>;
}

function AddPlotsModal({ ctx, proj }) {
  const { toast$, setModal, setPlots } = ctx;
  const [mode,setMode]=useState("range");
  const [prefix,setPrefix]=useState(""); const [from,setFrom]=useState("1"); const [to,setTo]=useState("10");
  const [singles,setSingles]=useState(""); const [area,setArea]=useState(""); const [price,setPrice]=useState("");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const go = async () => {
    let nums=[];
    if (mode==="range") {
      const f=parseInt(from), t=parseInt(to);
      if (isNaN(f)||isNaN(t)||t<f) { setErr("Invalid range."); return; }
      nums=Array.from({length:t-f+1},(_,i)=>`${prefix}${f+i}`);
    } else { nums=singles.split(",").map(s=>s.trim()).filter(Boolean); }
    if (!nums.length) { setErr("No plot numbers."); return; }
    setBusy(true);
    const rows=nums.map(n=>({ project_id:proj.id, number:n, status:"available", area:area.trim()||null, price:price?Number(price):null }));
    const { error } = await insertPlots(rows);
    if (error) { setErr(error.message); setBusy(false); return; }
    const { data: updated } = await fetchPlots(proj.id);
    setPlots(updated||[]);
    setBusy(false); toast$(`${nums.length} plot(s) added!`); setModal(null);
  };
  return <>
    <h3 className="sheet-title">Add Plots — {proj.name}</h3>
    <div className="flex g2 mb3">
      {["range","custom"].map(m=>(
        <button key={m} className={`role-btn${mode===m?" active":""}`} onClick={()=>setMode(m)} style={{fontSize:13,padding:"11px 8px"}}>
          {m==="range"?"📏 Range (1–50)":"✏️ Custom Numbers"}
        </button>
      ))}
    </div>
    {mode==="range"
      ? <div className="flex g2"><Fi label="Prefix" value={prefix} onChange={setPrefix} placeholder="A-" /><Fi label="From" value={from} onChange={setFrom} type="number" /><Fi label="To" value={to} onChange={setTo} type="number" /></div>
      : <Fi label="Plot Numbers (comma separated)" value={singles} onChange={setSingles} placeholder="101, 102A, B-5" />
    }
    <div className="flex g2"><Fi label="Default Area" value={area} onChange={setArea} placeholder="1200 sq.ft" /><Fi label="Default Price (₹)" value={price} onChange={setPrice} type="number" /></div>
    {err && <Err>{err}</Err>}
    <Btns cancel={()=>setModal(null)} confirm={go} label={busy?"Adding…":"Add Plots"} disabled={busy} />
  </>;
}

function UpdatePlotModal({ ctx, plot, proj }) {
  const { authUser, profile, toast$, setModal, setPlots, setHistory } = ctx;
  const [status,setStatus]   = useState(plot.status);
  const [cName,setCName]     = useState(plot.contact_name||"");
  const [cPhone,setCPhone]   = useState(plot.contact_phone||"");
  const [cEmail,setCEmail]   = useState(plot.contact_email||"");
  const [cAddr,setCAddr]     = useState(plot.contact_address||"");
  const [advPaid,setAdvPaid] = useState(plot.advance_paid??null);
  const [advAmt,setAdvAmt]   = useState(plot.advance_amount||"");
  const [note,setNote]       = useState(plot.transaction_notes||"");
  const [busy,setBusy]       = useState(false);
  const SC = {
    available:{c:"var(--emerald)",b:"rgba(16,185,129,.42)",bg:"var(--emerald-dim)"},
    booked:   {c:"var(--amber)",  b:"rgba(245,158,11,.42)",bg:"var(--amber-dim)"},
    sold:     {c:"var(--rose)",   b:"rgba(244,63,94,.42)", bg:"var(--rose-dim)"},
  };
  const go = async () => {
    if (status !== "available" && !cName.trim()) { toast$("Please enter the contact name.", "err"); return; }
    setBusy(true);
    const action = status==="sold"?"Marked as Sold":status==="booked"?"Marked as Booked":"Marked as Available";
    const updates = {
      status,
      contact_name:     status!=="available"?cName.trim():null,
      contact_phone:    status!=="available"?cPhone.trim():null,
      contact_email:    status!=="available"?cEmail.trim():null,
      contact_address:  status!=="available"?cAddr.trim():null,
      advance_paid:     status!=="available"?advPaid:null,
      advance_amount:   status!=="available"&&advPaid?(advAmt?Number(advAmt):null):null,
      transaction_notes:note.trim()||null,
      seller_id:        status!=="available"?authUser.id:null,
      transaction_date: status!=="available"?new Date().toISOString():null,
    };
    const { error } = await patchPlot(
  plot.id,
  updates,
  profile?.name || authUser?.email
);
    if (error) { toast$(error.message,"err"); setBusy(false); return; }
    await insertHistory({ plotId:plot.id, action, actorId:authUser.id, note:note.trim()||null });
    const [{ data: pl },{ data: hi }] = await Promise.all([fetchPlots(proj.id), fetchHistory(plot.id)]);
    setPlots(pl||[]); setHistory(hi||[]);
    setBusy(false); toast$("Plot updated!"); setModal(null);
  };
  return <>
    <h3 className="sheet-title">Update Plot {plot.number}</h3>
    <span className="flabel">New Status</span>
    <div className="flex g2 mb3">
      {[["available","✅ Available"],["booked","📋 Booked"],["sold","🏷️ Sold"]].map(([val,lbl])=>{
        const sc=SC[val];
        return <button key={val} className="stoggle" onClick={()=>setStatus(val)} style={status===val?{borderColor:sc.b,background:sc.bg,color:sc.c,boxShadow:`0 0 12px ${sc.b}`}:{}}>{lbl}</button>;
      })}
    </div>
    {status!=="available" && <>
      <div style={{background:"var(--surface2)",borderRadius:11,padding:"1rem",marginBottom:"1rem",border:"1px solid var(--border2)"}}>
        <div className="mono txs semi tgold" style={{textTransform:"uppercase",letterSpacing:".08em",marginBottom:".8rem"}}>
          {status==="sold"?"🏷️ Buyer Details":"📋 Booker Details"}
        </div>
        <div className="flex g2"><Fi label="Full Name *" value={cName} onChange={setCName} placeholder="Rajesh Kumar" /><Fi label="Phone Number" value={cPhone} onChange={setCPhone} placeholder="9876543210" /></div>
        <div className="flex g2"><Fi label="Email (optional)" value={cEmail} onChange={setCEmail} type="email" /><Fi label="City / Area" value={cAddr} onChange={setCAddr} placeholder="Coimbatore" /></div>
      </div>
      <div className="mb3">
        <span className="flabel">Advance Paid?</span>
        <div className="flex g2" style={{marginTop:6}}>
          {[[true,"✅ Yes"],[false,"❌ No"]].map(([val,lbl])=>(
            <button key={String(val)} onClick={()=>setAdvPaid(val)} style={{flex:1,padding:"10px 8px",borderRadius:10,fontFamily:"var(--font-body)",fontSize:14,fontWeight:500,cursor:"pointer",transition:"all var(--ease)",border:"1.5px solid",borderColor:advPaid===val?(val?"rgba(16,185,129,.48)":"rgba(244,63,94,.48)"):"var(--border2)",background:advPaid===val?(val?"var(--emerald-dim)":"var(--rose-dim)"):"var(--surface2)",color:advPaid===val?(val?"var(--emerald)":"var(--rose)"):"var(--text2)"}}>
              {lbl}
            </button>
          ))}
        </div>
        {advPaid===true && <div style={{marginTop:10}}><Fi label="Advance Amount (₹)" value={advAmt} onChange={setAdvAmt} type="number" placeholder="50000" /></div>}
      </div>
    </>}
    <Fi label="Notes / Description" value={note} onChange={setNote} textarea placeholder={status==="booked"?"e.g. Site visit scheduled…":status==="sold"?"e.g. Full payment received…":"e.g. Plot made available again…"} />
    <Btns cancel={()=>setModal(null)} confirm={go} label={busy?"Updating…":"Update Plot"} disabled={busy} />
  </>;
}

function EditPlotModal({ ctx, plot, proj }) {
  const { toast$, setModal, setPlots } = ctx;
  const [area,setArea]=useState(plot.area||""); const [price,setPrice]=useState(plot.price||"");
  const [facing,setFacing]=useState(plot.facing||""); const [cat,setCat]=useState(plot.category||"");
  const [notes,setNotes]=useState(plot.notes||""); const [busy,setBusy]=useState(false);
  const go = async () => {
    setBusy(true);
    const { error } = await patchPlot(plot.id, { area:area||null, price:price?Number(price):null, facing:facing||null, category:cat||null, notes:notes||null });
    if (error) { toast$(error.message,"err"); setBusy(false); return; }
    const { data } = await fetchPlots(proj.id); setPlots(data||[]);
    setBusy(false); toast$("Plot updated!"); setModal(null);
  };
  return <>
    <h3 className="sheet-title">Edit Plot {plot.number}</h3>
    <div className="flex g2"><Fi label="Area" value={area} onChange={setArea} placeholder="1200 sq.ft" /><Fi label="Price (₹)" value={price} onChange={setPrice} type="number" /></div>
    <div className="flex g2"><Fi label="Facing" value={facing} onChange={setFacing} placeholder="North, East…" /><Fi label="Category" value={cat} onChange={setCat} placeholder="Residential…" /></div>
    <Fi label="Notes" value={notes} onChange={setNotes} textarea />
    <Btns cancel={()=>setModal(null)} confirm={go} label={busy?"Saving…":"Save Changes"} disabled={busy} />
  </>;
}

function UploadFileModal({ ctx, proj }) {
  const { authUser, toast$, setModal, setFiles, setProjects } = ctx;
  const [pending,setPending]=useState([]); const [label,setLabel]=useState(""); const [busy,setBusy]=useState(false); const ref=useRef();
  const go = async () => {
    if (!pending.length) return;
    setBusy(true);
    for (const file of pending) {

  const { data } = await uploadFile({
    projectId: proj.id,
    file,
    label,
    userId: authUser.id
  });

  if (file.type.startsWith("image/")) {
    await supabase
      .from("projects")
      .update({ cover_image: data?.storage_path || data?.[0]?.storage_path })
      .eq("id", proj.id);
  }
}
    const { data } = await fetchFiles(proj.id); setFiles(data||[]);
    const { data: projectsData } = await fetchProjects();
setProjects(projectsData || []);
    setBusy(false); toast$(`${pending.length} file(s) uploaded!`); setModal(null);
  };
  return <>
    <h3 className="sheet-title">Upload Layout Files</h3>
    <div onClick={()=>ref.current.click()} style={{border:"2px dashed var(--border2)",borderRadius:13,padding:"1.75rem",textAlign:"center",cursor:"pointer",marginBottom:"1rem",background:"var(--surface2)",transition:"border-color var(--ease)"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--gold)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border2)"}>
      <div style={{fontSize:28,marginBottom:7}}>📎</div>
      <div className="tmuted tsm">Tap to select PDF, JPG, PNG, DWG</div>
      <input ref={ref} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dwg,.svg" style={{display:"none"}} onChange={e=>setPending(p=>[...p,...Array.from(e.target.files)])} />
    </div>
    {pending.map((f,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",padding:"8px 12px",background:"var(--surface2)",borderRadius:9,marginBottom:6,gap:8}}>
        <span className="trunc tsm" style={{flex:1,color:"var(--text)"}}>{f.name}</span>
        <span className="txs tmuted">{(f.size/1024).toFixed(1)}KB</span>
        <button onClick={()=>setPending(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"var(--rose)",fontSize:20,padding:0}}>×</button>
      </div>
    ))}
    <Fi label="Label (optional)" value={label} onChange={setLabel} placeholder="Master Layout v2" />
    <Btns cancel={()=>setModal(null)} confirm={go} label={busy?"Uploading…":"Upload"} disabled={busy} />
  </>;
}

function ViewFilesModal({ ctx, proj }) {
  const { authUser, toast$, setModal, files, setFiles } = ctx;
  const isProjOwner = proj.owner_id === authUser?.id;
  const del = async (id, path) => { await removeFile(id, path); const { data } = await fetchFiles(proj.id); setFiles(data||[]); toast$("File removed."); };
  return <>
    <h3 className="sheet-title">Layout Files — {proj.name}</h3>
    {files.length === 0
      ? <p className="tmuted tsm" style={{textAlign:"center",padding:"2rem 0"}}>No files uploaded yet.</p>
      : files.map(f => {
          const isImg=f.file_type?.startsWith("image/"), isPDF=f.file_type==="application/pdf";
          return (
            <div key={f.id} className="fitem">
              {isImg && <img src={f.storage_path} alt={f.name} style={{width:"100%",maxHeight:180,objectFit:"cover",display:"block"}} />}
              {isPDF && <div style={{padding:"1rem"}}><embed src={f.storage_path} type="application/pdf" width="100%" height="200px" style={{borderRadius:6}} /></div>}
              {!isImg&&!isPDF && <div style={{padding:"1rem",textAlign:"center",background:"var(--surface2)"}}><p className="tmuted tsm">📄 {f.name}</p></div>}
              <div style={{padding:"10px 13px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div className="semi tsm trunc" style={{color:"var(--text)"}}>{f.label||f.name}</div>
                  <div className="txs tmuted">{((f.file_size||0)/1024).toFixed(1)} KB · {DFMT.format(new Date(f.created_at))}</div>
                </div>
                <div className="flex g2">
                  <a href={f.storage_path} target="_blank" rel="noreferrer" download className="btn-secondary" style={{padding:"8px 13px",borderRadius:7,fontSize:13}}>⬇ Download</a>
                  {isProjOwner && <button className="btn-danger" onClick={()=>del(f.id,f.storage_path)}>Delete</button>}
                </div>
              </div>
            </div>
          );
        })
    }
    <button className="btn-ghost btn-full" style={{marginTop:4}} onClick={()=>setModal(null)}>Close</button>
  </>;
}

/* ════════════════════════════════════════════════════════════════
   PROJECT SETTINGS MODAL (Archive / Delete)
════════════════════════════════════════════════════════════════ */
function ProjectSettingsModal({ ctx, proj }) {
  const { toast$, setModal, setView, setProjects } = ctx;
  const [busy, setBusy] = useState(false);

  const handleArchive = async () => {
    setBusy(true);
    const { error } = await archiveProject(proj.id, !proj.archived);
    setBusy(false);
    if (error) { toast$(error.message, "err"); return; }
    const { data } = await fetchProjects();
    setProjects(data || []);
    toast$(proj.archived ? "Project restored!" : "Project archived.");
    setModal(null); setView("dashboard");
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete "${proj.name}"?\n\nAll plots, history and files will be deleted. This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await deleteProject(proj.id);
    setBusy(false);
    if (error) { toast$(error.message, "err"); return; }
    const { data } = await fetchProjects();
    setProjects(data || []);
    toast$("Project deleted."); setModal(null); setView("dashboard");
  };

  return <>
    <h3 className="sheet-title">Project Settings</h3>
    <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "1rem", marginBottom: "1rem", border: "1px solid var(--border2)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{proj.name}</div>
      {proj.location && <div className="tmuted txs">📍 {proj.location}</div>}
      <div className="tmuted txs" style={{ marginTop: 4 }}>Created {DFMT.format(new Date(proj.created_at))}</div>
    </div>

    {/* Archive */}
    <div style={{ border: "1.5px solid var(--border2)", borderRadius: 12, padding: "1rem 1.1rem", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
          {proj.archived ? "♻️ Restore Project" : "📦 Archive Project"}
        </div>
        <div className="tmuted txs">{proj.archived ? "Move project back to active dashboard." : "Hide from dashboard. Data is preserved, no plots are deleted."}</div>
      </div>
      <button className="btn-secondary" onClick={handleArchive} disabled={busy} style={{ flexShrink: 0 }}>
        {busy ? "Working…" : proj.archived ? "Restore" : "Archive"}
      </button>
    </div>

    {/* Delete */}
    <div style={{ border: "1.5px solid rgba(244,63,94,0.28)", borderRadius: 12, padding: "1rem 1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "rgba(244,63,94,0.03)" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--rose)", marginBottom: 3 }}>🗑️ Delete Project</div>
        <div className="tmuted txs">Permanently deletes the project, all plots, history and files. Cannot be undone.</div>
      </div>
      <button className="btn-danger" onClick={handleDelete} disabled={busy} style={{ flexShrink: 0 }}>
        {busy ? "Deleting…" : "Delete"}
      </button>
    </div>

    <button className="btn-ghost btn-full" onClick={() => setModal(null)}>Cancel</button>
  </>;
}

/* ════════════════════════════════════════════════════════════════
   REPORT DOWNLOAD (Excel + CSV)
════════════════════════════════════════════════════════════════ */
function ReportBtn({ projects=[], allPlots=[], profiles=[], single=false }) {
  const [open,setOpen]=useState(false);
  // profiles available for future use
  const rows=()=>{const out=[];for(const p of projects){const pl=single?allPlots:(p._plots||[]);for(const x of pl){out.push({"Project":p.name,"Location":p.location||"","Plot No.":x.number,"Status":(x.status||"").charAt(0).toUpperCase()+(x.status||"").slice(1),"Area":x.area||"","Price (₹)":x.price||"","Contact Name":x.contact_name||"","Contact Phone":x.contact_phone||"","Advance Paid":x.advance_paid===true?"Yes":x.advance_paid===false?"No":"","Notes":x.transaction_notes||""});}}return out;};
  const summ=()=>projects.map(p=>{const pl=single?allPlots:(p._plots||[]);const s=pl.filter(x=>x.status==="sold"),b=pl.filter(x=>x.status==="booked"),a=pl.filter(x=>x.status==="available");return{"Project":p.name,"Location":p.location||"","Total":pl.length,"Sold":s.length,"Booked":b.length,"Available":a.length,"% Sold":pl.length?Math.round(s.length/pl.length*100)+"%":"0%","Revenue (₹)":s.reduce((acc,x)=>acc+Number(x.price||0),0)};});
  const dlCSV=()=>{const r=rows();if(!r.length)return;const h=Object.keys(r[0]);const csv=[h.join(","),...r.map(row=>h.map(k=>{const v=String(row[k]??"").replace(/"/g,'""');return v.includes(",")||v.includes('"')?`"${v}"`:v;}).join(","))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv"}));a.download=`PlotTracker_${Date.now()}.csv`;a.click();setOpen(false);};
  const dlXLSX = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const sm = summ();
    if (sm.length) {
      const ws1 = XLSX.utils.json_to_sheet(sm);
      ws1["!cols"] = Object.keys(sm[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
      XLSX.utils.book_append_sheet(wb, ws1, "Summary");
    }

    // Sheet 2: All Plots
    const r = rows();
    if (r.length) {
      const ws2 = XLSX.utils.json_to_sheet(r);
      ws2["!cols"] = Object.keys(r[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
      XLSX.utils.book_append_sheet(wb, ws2, "All Plots");
    }

    // Sheet 3: Transactions only
    const txn = rows().filter(row => ["Sold","Booked"].includes(row["Status"]));
    if (txn.length) {
      const ws3 = XLSX.utils.json_to_sheet(txn);
      ws3["!cols"] = Object.keys(txn[0]).map(k => ({ wch: Math.max(k.length + 2, 16) }));
      XLSX.utils.book_append_sheet(wb, ws3, "Transactions");
    }

    const fname = `PlotTracker_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fname, { bookType: "xlsx", type: "binary" });
    setOpen(false);
  };
  return(
    <div style={{position:"relative",flexShrink:0}}>
      <button className="btn-secondary" onClick={()=>setOpen(o=>!o)}>📊 Report ▾</button>
      {open&&<>
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:99}}/>
        <div className="rmenu">
          <p className="txs tmuted" style={{padding:"4px 10px 8px",borderBottom:"1px solid var(--border)"}}>Export data</p>
          {[["📗","Excel (.xlsx)","Summary + plots + transactions",dlXLSX],["📄","CSV (.csv)","Flat format for Google Sheets",dlCSV]].map(([ic,t,s,fn])=>(
            <button key={t} className="rmitem" onClick={fn}>
              <span style={{fontSize:17}}>{ic}</span>
              <span><span className="tsm semi" style={{display:"block",color:"var(--text)"}}>{t}</span><span className="txs tmuted">{s}</span></span>
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ATOMS
════════════════════════════════════════════════════════════════ */
function Fi({ label, value, onChange, type="text", placeholder, textarea }) {
  return (
    <div style={{ flex: 1, marginBottom: "1rem" }}>
      {label && <label className="flabel">{label}</label>}
      {textarea
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
        : <input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} />}
    </div>
  );
}
function Btns({ cancel, confirm, label="Save", disabled=false }) {
  return (
    <div className="flex g2" style={{ marginTop: 4 }}>
      <button className="btn-primary btn-full" onClick={confirm} disabled={disabled} style={{opacity:disabled?.7:1}}>{label}</button>
      <button className="btn-ghost btn-full" onClick={cancel}>Cancel</button>
    </div>
  );
}
function Err({ children }) { return <p style={{ color:"var(--rose)", fontSize:13, margin:"-6px 0 12px" }}>{children}</p>; }
function Av({ name, size=36 }) {
  const i=(name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),#7a5618)",color:"#090909",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.36,fontWeight:700,flexShrink:0}}>{i}</div>;
}
