import { useState } from "react";

export default function LayoutEditor({ proj, ctx }) {  
  const [points, setPoints] = useState([]);
const [mode, setMode] = useState("booked");
const [closed, setClosed] = useState(false);

  const handleClick = (e) => {

  if(closed) return;

  const rect = e.currentTarget.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  setPoints(prev=>[...prev,{x,y}]);

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
onClick={()=>setPoints(p=>p.slice(0,-1))}
>
↩ Undo
</button>

<button
onClick={()=>setClosed(true)}
>
✔ Finish Shape
</button>
<button
  onClick={() => setClosed(true)}
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
</div>
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
        src={proj.layout_image}
        alt="Master Layout"
        style={{
          width: "100%",
          display: "block"
        }}
      />

      <svg
        onClick={handleClick}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          cursor: "crosshair"
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
