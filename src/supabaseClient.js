import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── AUTH ──────────────────────────────────────────────────────────
export const authSignUp = ({ email, password, name, phone, role }) =>
  supabase.auth.signUp({ email, password, options: { data: { name, phone, role } } });

export const authSignIn = ({ email, password }) =>
  supabase.auth.signInWithPassword({ email, password });

export const authSignOut = () => supabase.auth.signOut();

export const resetPassword = (email) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}`,
  });

export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

// ── PROFILES ──────────────────────────────────────────────────────
export const fetchProfile = (userId) =>
  supabase.from("profiles").select("*").eq("id", userId).single();

export const fetchAllProfiles = () =>
  supabase.from("profiles").select("id, name, phone, role");

// ── PROJECTS ──────────────────────────────────────────────────────
export const fetchProjects = () =>
  supabase
    .from("projects")
    .select(`
      *,
      _plots:plots(*)
    `)
    .order("created_at", { ascending: false });

export const insertProject = ({ name, location, mapUrl, description, ownerId }) =>
  supabase.from("projects")
    .insert({ name, location, map_url: mapUrl, description, owner_id: ownerId })
    .select().single();

export const deleteProject = (id) =>
  supabase.from("projects").delete().eq("id", id);

export const archiveProject = (id, archived = true) =>
  supabase.from("projects").update({ archived }).eq("id", id);

export const updateProject = (id, { name, location, mapUrl, description }) =>
  supabase.from("projects")
    .update({ name, location, map_url: mapUrl, description })
    .eq("id", id)
    .select()
    .single();

// ── PLOTS ─────────────────────────────────────────────────────────
export const fetchPlots = (projectId) =>
  supabase.from("plots").select("*").eq("project_id", projectId)
    .order("number");

export const insertPlots = (rows) =>
  supabase.from("plots").insert(rows).select();

export const patchPlot = (id, updates, editor) =>
  supabase.from("plots")
    .update({
      ...updates,
      last_edited_by: editor,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

export const deletePlot = (id) =>
  supabase.from("plots").delete().eq("id", id);

// ── PLOT HISTORY ──────────────────────────────────────────────────
export const fetchHistory = (plotId) =>
  supabase.from("plot_history")
    .select("*, actor:profiles(name)")
    .eq("plot_id", plotId)
    .order("created_at", { ascending: false });

export const insertHistory = ({ plotId, action, actorId, note }) =>
  supabase.from("plot_history")
    .insert({ plot_id: plotId, action, actor_id: actorId, note: note || null });

// ── PROJECT HISTORY (reuses plot_history table with plot_id = null) ─
export const fetchProjectHistory = (projectId) =>
  supabase.from("plot_history")
    .select("*, actor:profiles(name)")
    .eq("project_id", projectId)
    .is("plot_id", null)
    .order("created_at", { ascending: false });

export const insertProjectHistory = ({ projectId, action, actorId, note }) =>
  supabase.from("plot_history")
    .insert({ project_id: projectId, plot_id: null, action, actor_id: actorId, note: note || null });

// ── FILES ─────────────────────────────────────────────────────────
export const fetchFiles = (projectId) =>
  supabase.from("project_files").select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

export const uploadFile = async ({ projectId, file, label, userId }) => {
  const ext  = file.name.split(".").pop();
  const path = `${userId}/${projectId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("layouts").upload(path, file, { contentType: file.type });
  if (upErr) return { error: upErr };

  const { data: { publicUrl } } = supabase.storage.from("layouts").getPublicUrl(path);

  return supabase.from("project_files").insert({
    project_id: projectId, name: file.name,
    label: label || file.name,
    file_type: file.type, file_size: file.size,
    storage_path: publicUrl, uploaded_by: userId,
  }).select().single();
};

export const removeFile = async (fileId, storagePath) => {
  const part = storagePath.split("/layouts/")[1];
  if (part) await supabase.storage.from("layouts").remove([part]);
  return supabase.from("project_files").delete().eq("id", fileId);
};

// ── REALTIME ──────────────────────────────────────────────────────
export const subPlots = (projectId, cb) =>
  supabase.channel(`plots:${projectId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "plots", filter: `project_id=eq.${projectId}` }, cb)
    .subscribe();

export const subProjects = (cb) =>
  supabase.channel("projects:all")
    .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, cb)
    .subscribe();

// ── OWNER ACCESS CODE ─────────────────────────────────────────────===
// Calls Edge Functions (server-side) which generate/verify a random
// 6-digit code with a 10-minute expiry, emailed to a fixed address.

export const sendOwnerCode = async (requesterEmail) => {
  const { data, error } = await supabase.functions.invoke("send-owner-code", {
    body: { requesterEmail },
  });
  if (error) return { error };
  if (data?.error) return { error: { message: data.error } };
  return { data };
};

export const verifyOwnerCode = async (code, requesterEmail) => {
  const { data, error } = await supabase.functions.invoke("verify-owner-code", {
    body: { code, requesterEmail },
  });
  if (error) return { valid: false, error };
  if (data?.error) return { valid: false, error: { message: data.error } };
  return { valid: data?.valid === true };
};
