import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function LayoutEditor({ proj, ctx }) {
  const [points, setPoints] = useState([]);
  const [tool, setTool] = useState("select");
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [plotNumber, setPlotNumber] = useState("");
  const [mode, setMode] = useState("booked");

  const svgRef = useRef(null);

  // Force re-render when polygons change
  useEffect(() => {
    console.log("🔄 LayoutEditor polygons updated:", ctx.layoutPolygons?.length || 0);
  }, [ctx.layoutPolygons]);

  const handleClick = (e) => {
    if (tool !== "draw") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPoints(prev => [...prev, { x, y }]);
  };

  const handleMouseMove = (e) => {
    if (tool !== "edit" || dragIndex === null || !selectedPolygon) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectedPolygon(prev => {
      if (!prev) return prev;
      const updatedPoints = [...prev.points];
      updatedPoints[dragIndex] = { x, y };
      return { ...prev, points: updatedPoints };
    });
  };

  const handleMouseUp = () => setDragIndex(null);

  const savePolygon = async () => {
    if (!plotNumber) return alert("Please select a Plot Number");

    try {
      if (selectedPolygon) {
        const { error } = await supabase
          .from("layout_polygons")
          .update({ points: selectedPolygon.points, status: mode })
          .eq("id", selectedPolygon.id);
        if (error) throw error;
        alert("Polygon Updated!");
      } else if (points.length >= 3) {
        const { error } = await supabase
          .from("layout_polygons")
          .insert({
            project_id: proj.id,
            plot_number: Number(plotNumber),
            status: mode,
            points,
          });
        if (error) throw error;
        alert("Polygon Saved!");
      }

      // Refresh
      setPoints([]);
      setSelectedPolygon(null);
      setDragIndex(null);
      if (ctx.refreshPolygons) ctx.refreshPolygons();
      else {
        // Fallback refresh
        const { data } = await supabase
          .from("layout_polygons")
          .select("*")
          .eq("project_id", proj.id);
        ctx.setLayoutPolygons?.(data || []);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 15, flexWrap: "wrap", justifyContent: "center" }}>
        {["select", "draw", "edit"].map(t => (
          <button key={t} onClick={() => setTool(t)}
            style={{ background: tool === t ? (t === "select" ? "#3b82f6" : t === "draw" ? "#eab308" : "#22c55e") : "#444", color: "white", padding: "10px 18px", borderRadius: 8 }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button onClick={() => setMode("booked")} style={{ background: mode === "booked" ? "#f59e0b" : "#444", color: "white", padding: "10px 18px", borderRadius: 8 }}>Booked</button>
        <button onClick={() => setMode("sold")} style={{ background: mode === "sold" ? "#ef4444" : "#444", color: "white", padding: "10px 18px", borderRadius: 8 }}>Sold</button>
        <button onClick={() => { setPoints([]); setSelectedPolygon(null); }} style={{ background: "#666", color: "white", padding: "10px 18px", borderRadius: 8 }}>Clear</button>
        <button onClick={savePolygon} style={{ background: "#16a34a", color: "white", padding: "10px 18px", borderRadius: 8 }}>💾 Save Polygon</button>
      </div>

      {/* Plot Selector */}
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <select value={plotNumber} onChange={e => setPlotNumber(e.target.value)} style={{ padding: "12px", fontSize: "16px", borderRadius: 8, minWidth: 200 }}>
          <option value="">Select Plot Number</option>
          {ctx.plots?.map(p => (
            <option key={p.id} value={p.number}>Plot {p.number}</option>
          ))}
        </select>
      </div>

      {/* Image + Overlay */}
      <div style={{ position: "relative", maxWidth: "1000px", margin: "0 auto", border: "3px solid #333", borderRadius: 16, overflow: "hidden" }}>
        <img src={proj.layout_image} alt="Master Layout" style={{ width: "100%", display: "block" }} />

        <svg
          ref={svgRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: tool === "draw" ? "crosshair" : tool === "edit" ? "pointer" : "default" }}
        >
          {/* Saved Polygons */}
          {(ctx.layoutPolygons || []).map(poly => {
            const isSelected = selectedPolygon?.id === poly.id;
            return (
              <g key={poly.id}>
                <polygon
                  points={poly.points.map(p => `${p.x},${p.y}`).join(" ")}
                  fill={poly.status === "booked" ? "rgba(245,158,11,0.45)" : poly.status === "sold" ? "rgba(239,68,68,0.45)" : "transparent"}
                  stroke={isSelected ? "#3b82f6" : "#ffffff"}
                  strokeWidth={isSelected ? 5 : 2.5}
                  onClick={() => (tool === "select" || tool === "edit") && setSelectedPolygon(poly)}
                />
                {isSelected && poly.points.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x} cy={pt.y} r={8}
                    fill="#3b82f6" stroke="#fff" strokeWidth={3}
                    onMouseDown={() => tool === "edit" && setDragIndex(i)}
                  />
                ))}
              </g>
            );
          })}

          {/* Drawing in progress */}
          {points.length > 1 && <polyline points={points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#eab308" strokeWidth={4} />}
          {points.length > 2 && <polygon points={points.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(234,179,8,0.35)" stroke="#eab308" strokeWidth={3} />}
          {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6} fill="#eab308" />)}
        </svg>
      </div>
    </>
  );
}
