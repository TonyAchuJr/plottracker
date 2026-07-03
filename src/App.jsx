import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import "./styles.css";
import {
  supabase, authSignUp, authSignIn, authSignOut, resetPassword, getSession,
  fetchProfile, fetchAllProfiles,
  fetchProjects, insertProject, deleteProject, archiveProject, updateProject,
  fetchPlots, insertPlots, patchPlot,
  fetchHistory, insertHistory, fetchProjectHistory, insertProjectHistory,
  fetchFiles, uploadFile, removeFile,
  subPlots, subProjects,
  sendOwnerCode, verifyOwnerCode,
  createEnquiry,
  fetchBuyerEnquiries,
  fetchOwnerEnquiries,
} from "./supabaseClient";
import FloatingAnnouncement from "./FloatingAnnouncement";
import BuyerEnquiryModal from "./BuyerEnquiryModal";

/* ── Helpers ─────────────────────────────────────────────────────── */
const DFMT = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const TFMT = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const inr  = v => v ? `₹${Number(v).toLocaleString("en-IN")}` : "";

/* ════════════════════════════════════════════════════════════════
   ROOT
════════════════════════════════════════════════════════════════ */
const APP_VERSION = "2.3.2";

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
  const [projHistory, setProjHistory] = useState([]);
  const [projId, setProjId]     = useState(null);
  const [plotId, setPlotId]     = useState(null);
  const [toast, setToast]       = useState(null);
  const [modal, setModal]       = useState(null);
  const [busy, setBusy]         = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [buyerEnquiries, setBuyerEnquiries] = useState([]);
  const [ownerEnquiries, setOwnerEnquiries] = useState([]);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

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

      const lastSeen = localStorage.getItem("pt_last_seen");
      if (lastSeen !== APP_VERSION) setShowUpdate(true);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("reset-password");
        return;
      }
      if (event === "SIGNED_IN" && session?.user) await loadUser(session.user);
      if (event === "SIGNED_OUT") {
        setAuthUser(null); setProfile(null); setProjects([]); setView("landing");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const closeUpdate = () => {
    localStorage.setItem("pt_last_seen", APP_VERSION);
    setShowUpdate(false);
  };

  async function loadUser(u) {
    setAuthUser(u);
    let prof = null;
    for (let i = 0; i < 3; i++) {
      const { data } = await fetchProfile(u.id);
      if (data) { prof = data; break; }
      await new Promise(r => setTimeout(r, 800));
    }

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

    if (prof.role === "buyer") {
      const { data } = await fetchBuyerEnquiries(prof.id);
      setBuyerEnquiries(data || []);
    }
    if (prof.role === "owner") {
      const { data } = await fetchOwnerEnquiries(prof.id);
      setOwnerEnquiries(data || []);
    }

    setView("dashboard");
  }

  /* ── Theme ─────────────────────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.body.style.background = dark ? "#09090f" : "#f6f4ee";
  }, [dark]);

  /* Realtime subscriptions (keep existing) */
  useEffect(() => { /* ... your existing realtime code ... */ }, []);
  useEffect(() => { /* ... your existing realtime code ... */ }, [projId]);

  /* Navigation helpers */
  async function openProject(id) { /* ... your existing code ... */ }
  async function openPlot(id) { /* ... your existing code ... */ }

  const proj = projects.find(p => p.id === projId);
  const plot = plots.find(p => p.id === plotId);

  const ctx = {
    dark, toggleDark, authUser, profile, profiles,
    projects, setProjects, plots, setPlots,
    files, setFiles, history, setHistory,
    projHistory, setProjHistory,
    projId, setProjId, plotId, setPlotId,
    toast$, setView, setModal, busy, setBusy,
    openProject, openPlot,
    buyerEnquiries, ownerEnquiries, setOwnerEnquiries,
    setSelectedProject, setShowEnquiryModal
  };

  if (view === "booting") return <Booting />;

  return (
    <>
      {showUpdate && <UpdatePopup version={APP_VERSION} onClose={closeUpdate} />}
      <FloatingAnnouncement version="2.3.2" title="Latest Updates" message={`• Bugs fixed\n• Owner access improvements`} />

      {showEnquiryModal && selectedProject && (
        <BuyerEnquiryModal
          open={showEnquiryModal}
          project={selectedProject}
          onClose={() => setShowEnquiryModal(false)}
          onSubmit={async (form) => {
            const { error } = await createEnquiry({
              buyer_id: profile.id,
              owner_id: selectedProject.owner_id,
              project_id: selectedProject.id,
              enquiry_type: form.enquiry_type,
              category: form.category,
              location: form.location,
              budget_min: form.budget_min || null,
              budget_max: form.budget_max || null,
              description: form.description,
              priority: form.priority,
              status: "Pending",
              is_read: false,
            });
            if (error) return toast$(error.message, "err");

            toast$("Enquiry submitted successfully");
            setShowEnquiryModal(false);
            const { data } = await fetchBuyerEnquiries(profile.id);
            setBuyerEnquiries(data || []);
          }}
        />
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      {modal && <ModalShell modal={modal} ctx={ctx} proj={proj} plot={plot} />}

      {view === "landing" && <Landing ctx={ctx} />}
      {view === "login" && <LoginPage ctx={ctx} />}
      {view === "forgot-password" && <ForgotPasswordPage ctx={ctx} />}
      {view === "reset-password" && <ResetPasswordPage ctx={ctx} />}
      {view === "register" && <RegisterPage ctx={ctx} />}

      {(view === "dashboard" || view === "project" || view === "plot" || view === "owner-enquiries") && (
        <Shell ctx={ctx}>
          {view === "dashboard" && <Dashboard ctx={ctx} />}
          {view === "project" && proj && <ProjectView proj={proj} ctx={ctx} />}
          {view === "plot" && plot && proj && <PlotView plot={plot} proj={proj} ctx={ctx} />}
          {view === "owner-enquiries" && <OwnerEnquiriesView ctx={ctx} />}
        </Shell>
      )}
    </>
  );
}

/* Booting, UpdatePopup, Spin, Landing, Auth pages, Shell, Dashboard, ProjCard, Modals... */
/* (All your existing components remain the same — paste them below this point from your previous file) */

function OwnerEnquiriesView({ ctx }) {
  const { ownerEnquiries = [], profile, toast$, setOwnerEnquiries, setView } = ctx;

  const markAsRead = async (id) => {
    await supabase.from("buyer_enquiries").update({ is_read: true }).eq("id", id);
    const { data } = await fetchOwnerEnquiries(profile.id);
    setOwnerEnquiries(data || []);
    toast$("Marked as read");
  };

  return (
    <div>
      <div className="flex jsb aic mb3">
        <h2 style={{ fontFamily: "var(--font-serif)" }}>📥 Buyer Enquiries</h2>
        <button className="btn-secondary" onClick={() => setView("dashboard")}>← Back</button>
      </div>

      {ownerEnquiries.length === 0 ? (
        <div className="empty">No enquiries yet.</div>
      ) : (
        ownerEnquiries.map(eq => (
          <div key={eq.id} className="card" style={{ marginBottom: 16 }}>
            <div className="flex jsb">
              <div>
                <strong>{eq.project?.name}</strong><br />
                <small>From {eq.buyer?.name} • {DFMT.format(new Date(eq.created_at))}</small>
              </div>
              <span className={`hbadge ${eq.is_read ? "" : "hbadge-owner"}`}>{eq.status}</span>
            </div>

            <div style={{ background: "var(--surface2)", padding: 14, borderRadius: 10, margin: "12px 0" }}>
              <strong>{eq.enquiry_type}</strong> {eq.category && `• ${eq.category}`}<br />
              {eq.description}
            </div>

            <button onClick={() => markAsRead(eq.id)} className="btn-secondary">
              {eq.is_read ? "Read" : "Mark as Read"}
            </button>
            {/* Reply box stub - expand as needed */}
          </div>
        ))
      )}
    </div>
  );
}

/* Paste the rest of your original components (ProjCard, ProjectView, PlotView, all modals, ReportBtn, Fi, etc.) here */
