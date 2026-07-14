import { useState, useRef } from "react";
import { supabase } from "../supabaseClient";

export default function LayoutEditor({ proj, ctx }) {
  const [points, setPoints] = useState([]);
  const [tool, setTool] = useState("select"); // select, draw, edit
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [plotNumber, setPlotNumber] = useState("");
  const [mode, setMode] = useState("booked");

  const svgRef = useRef(null);

  const handleClick = (e) => {
    if (tool !== "draw") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPoints((prev) => [...prev, { x, y }]);
  };

  const handleMouseMove = (e) => {
    if (tool !== "edit" || dragIndex === null || !selectedPolygon) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectedPolygon((prev) => {
      if (!prev) return prev;
      const updatedPoints = [...prev.points];
      updatedPoints[dragIndex] = { x, y };
      return { ...prev, points: updatedPoints };
    });
  };

  const handleMouseUp = () => {
    setDragIndex(null);
  };

  const savePolygon = async () => {
    if (points.length < 3 && !selectedPolygon) {
      alert("Need at least 3 points to save.");
      return;
    }

    if (!plotNumber) {
      alert("Please select a plot number.");
      return;
    }

    try {
      if (selectedPolygon) {
        // Update existing polygon
        const { error } = await supabase
          .from("layout_polygons")
          .update({
            points: selectedPolygon.points,
            status: mode,
          })
          .eq("id", selectedPolygon.id);

        if (error) throw error;
        alert("Polygon updated successfully!");
      } else {
        // Create new polygon
        const { error } = await supabase
          .from("layout_polygons")
          .insert({
            project_id: proj.id,
            plot_number: Number(plotNumber),
            status: mode,
            points: points,
          });

        if (error) throw error;
        alert("Polygon saved successfully!");
      }

      // Reset
      setPoints([]);
      setSelectedPolygon(null);
      setDragIndex(null);
      setPlotNumber("");
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const clearPoints = () => {
    setPoints([]);
    setSelectedPolygon(null);
    setDragIndex(null);
  };

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 15, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => setTool("select")} style={{ background: tool === "select" ? "#3b82f6" : "#444", color: "white", padding: "10px 16px", borderRadius: 8 }}>
          Select
        </button>
        <button onClick={() => setTool("draw")} style={{ background: tool === "draw" ? "#eab308" : "#444", color: "white", padding: "10px 16px", borderRadius: 8 }}>
          Draw
        </button>
        <button onClick={() => setTool("edit")} style={{ background: tool === "edit" ? "#22c55e" : "#444", color: "white", padding: "10px 16px", borderRadius: 8 }}>
          Edit
        </button>

        <button onClick={() => setMode("booked")} style={{ background: mode === "booked" ? "#f59e0b" : "#444", color: "white", padding: "10px 16px", borderRadius: 8 }}>
          Booked
        </button>
        <button onClick={() => setMode("sold")} style={{ background: mode === "sold" ? "#ef4444" : "#444", color: "white", padding: "10px 16px", borderRadius: 8 }}>
          Sold
        </button>

        <button onClick={clearPoints} style={{ background: "#666", color: "white", padding: "10px 16px", borderRadius: 8 }}>
          Clear
        </button>
        <button onClick={savePolygon} style={{ background: "#16a34a", color: "white", padding: "10px 16px", borderRadius: 8 }}>
          💾 Save Polygon
        </button>
      </div>

      {/* Plot Selector */}
      <div style={{ marginBottom: 15, textAlign: "center" }}>
        <select value={plotNumber} onChange={(e) => setPlotNumber(e.target.value)} style={{ padding: "10px", borderRadius: 8 }}>
          <option value="">Select Plot</option>
          {ctx.plots?.map((plot) => (
            <option key={plot.id} value={plot.number}>
              Plot {plot.number}
            </option>
          ))}
        </select>
      </div>

      {/* Layout Image + SVG Overlay */}
      <div style={{ position: "relative", maxWidth: "1000px", margin: "auto", border: "2px solid #444", borderRadius: 12, overflow: "hidden" }}>
        <img
          src={proj.layout_image}
          alt="Master Layout"
          style={{ width: "100%", display: "block" }}
        />

        <svg
          ref={svgRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            cursor: tool === "draw" ? "crosshair" : "default",
          }}
        >
          {/* Existing Polygons */}
          {ctx.layoutPolygons?.map((poly) => {
            const isSelected = selectedPolygon?.id === poly.id;
            return (
              <g key={poly.id}>
                <polygon
                  points={poly.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={poly.status === "booked" ? "rgba(245,158,11,0.4)" : poly.status === "sold" ? "rgba(239,68,68,0.4)" : "transparent"}
                  stroke={isSelected ? "#3b82f6" : "#fff"}
                  strokeWidth={isSelected ? 4 : 2}
                  onClick={() => {
                    if (tool === "select" || tool === "edit") {
                      setSelectedPolygon(poly);
                    }
                  }}
                />
                {/* Vertices for selected polygon */}
                {isSelected &&
                  poly.points.map((point, index) => (
                    <circle
                      key={index}
                      cx={point.x}
                      cy={point.y}
                      r={6}
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth={2}
                      style={{ cursor: "pointer" }}
                      onMouseDown={() => {
                        if (tool === "edit") setDragIndex(index);
                      }}
                    />
                  ))}
              </g>
            );
          })}

          {/* Currently drawing polygon */}
          {points.length > 1 && (
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#eab308"
              strokeWidth={3}
            />
          )}
          {points.length > 2 && (
            <polygon
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="rgba(234,179,8,0.3)"
              stroke="#eab308"
              strokeWidth={2}
            />
          )}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5} fill="#eab308" />
          ))}
        </svg>
      </div>
    </>
  );
}
