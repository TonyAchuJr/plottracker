import { useState, useRef } from "react";
import { supabase } from "../supabaseClient";

export default function LayoutEditor({ proj, ctx }) {  
  const [points, setPoints] = useState([]);
const [mode, setMode] = useState("booked");
const [closed, setClosed] = useState(false);
const [plotNumber,setPlotNumber]=useState("");
  const imgRef = useRef(null);
  const handleClick = (e) => {
    
  if (closed) return;

  const rect = imgRef.current.getBoundingClientRect();

  const x = (e.clientX - rect.left) / rect.width;
const y = (e.clientY - rect.top) / rect.height;

  setPoints(prev => [...prev, { x, y }]);
};
const savePolygon = async () => {

  if (points.length < 3) {
    alert("Need at least 3 points.");
    return;
  }

  if (!plotNumber) {
    alert("Select a plot.");
    return;
  }
const img = imgRef.current;

if (!img) {
  alert("Layout image not found.");
  return;
}
  const { error } = await supabase
    .from("layout_polygons")
    .insert({
  project_id: proj.id,
  plot_number: Number(plotNumber),
  status: mode,
  points: points,
  image_width: img.clientWidth,
  image_height: img.clientHeight
});

  if (error) {
    alert(error.message);
    return;
  }

  alert("Polygon saved.");

  setPoints([]);
setClosed(false);
setPlotNumber("");

};
  return (
<>
  <div
  style={{
    display: "flex",
    gap: 10,
    marginBottom: 15,
    justifyContent: "center",
    flexWrap: "wrap"
  }}
>

<button
onClick={()=>setMode("booked")}
style={{
background:mode==="booked"?"#f59e0b":"#222",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
🟠 Booked
</button>

<button
onClick={()=>setMode("sold")}
style={{
background:mode==="sold"?"#ef4444":"#222",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
🔴 Sold
</button>

<button
onClick={()=>setMode("clear")}
style={{
background:mode==="clear"?"#666":"#222",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
⚪ Clear
</button>
<button
  onClick={() => {
  if (points.length >= 3) {
    setClosed(true);
  }
}}
  style={{
    background: "#2563eb",
    color: "white",
    padding: "10px 18px",
    borderRadius: 8
  }}
>
✔ Finish Shape
</button>

<button
  onClick={()=>{
    setPoints([]);
    setClosed(false);
  }}
  style={{
    background:"#444",
    color:"white",
    padding:"10px 18px",
    borderRadius:8
  }}
>
🗑 Clear Points
</button>
    <button
  onClick={()=>{
    setPoints(prev=>prev.slice(0,-1));
  }}
  style={{
    background:"#f59e0b",
    color:"white",
    padding:"10px 18px",
    borderRadius:8
  }}
>
↩ Undo Last Point
</button>
    <button
onClick={savePolygon}
style={{
background:"#16a34a",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
💾 Save Polygon
</button>
</div>
  <select
value={plotNumber}
onChange={e=>setPlotNumber(e.target.value)}
>

<option value="">Select Plot</option>

{ctx.plots.map(plot=>(

<option
key={plot.id}
value={plot.number}
>

Plot {plot.number}

</option>

))}

</select>  
  <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "1000px",
        margin: "auto",
        border: "1px solid #444",
        overflow: "hidden"
      }}
    >
      <img
  ref={imgRef}
  id="layoutImage"
  src={proj.layout_image}
  alt="Master Layout"
  style={{
    width: "100%",
    display: "block"
  }}
/>

      <svg
    onClick={handleClick}
    width={imgRef.current?.clientWidth || 1000}
    height={imgRef.current?.clientHeight || 700}
    style={{
        position:"absolute",
        top:0,
        left:0,
        cursor:"crosshair"
    }}
>
        <>
  {points.length > 1 && (
    <polyline
      points={points.map(p => `${p.x},${p.y}`).join(" ")}
      fill="none"
      stroke="#FFD54A"
      strokeWidth="2"
    />
  )}

  {closed && points.length > 2 && (
    <polygon
    points={points.map(p => `${p.x},${p.y}`).join(" ")}
    fill={
        mode === "booked"
            ? "rgba(245,158,11,.35)"
            : mode === "sold"
            ? "rgba(239,68,68,.35)"
            : "transparent"
    }
    stroke={
        mode === "booked"
            ? "#f59e0b"
            : mode === "sold"
            ? "#ef4444"
            : "#888"
    }
    strokeWidth="2"
/>
  )}

  {points.map((p, i) => (
  <circle
    key={i}
    cx={p.x}
    cy={p.y}
    r="5"
    fill="#FFD54A"
    stroke="black"
  />
))}
</>
</svg>
</div>

</>

);
}
