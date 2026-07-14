import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function LayoutEditor({ proj, ctx }) {  
  const [points, setPoints] = useState([]);
const [mode, setMode] = useState("booked");
const [closed, setClosed] = useState(false);
  const [savedPolygons, setSavedPolygons] = useState([]);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [tool, setTool] = useState("select");
  const [editingPoints, setEditingPoints] = useState([]);
const [dragIndex, setDragIndex] = useState(null);
const [plotNumber,setPlotNumber]=useState("");
  const imgRef = useRef(null);
  async function loadPolygons() {
    const { data, error } = await supabase
        .from("layout_polygons")
        .select("*")
        .eq("project_id", proj.id);

    if (!error) {
        setSavedPolygons(data || []);
    }
}
useEffect(() => {
    loadPolygons();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [proj.id]);
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
  if (tool === "edit" && selectedPolygon) {

    const { error } = await supabase
        .from("layout_polygons")
        .update({
            points: editingPoints,
            status: mode,
            image_width: img.clientWidth,
            image_height: img.clientHeight
        })
        .eq("id", selectedPolygon.id);

    if (error) {
        alert(error.message);
        return;
    }

    await loadPolygons();

    setSelectedPolygon(null);
    setEditingPoints([]);
    setDragIndex(null);

    alert("Polygon updated.");

    return;
}
  const { data: existing } = await supabase
.from("layout_polygons")
.select("id")
.eq("project_id", proj.id)
.eq("plot_number", Number(plotNumber))
.maybeSingle();
  let error;

if (mode === "clear") {

    ({ error } = await supabase
        .from("layout_polygons")
        .delete()
        .eq("project_id", proj.id)
        .eq("plot_number", Number(plotNumber)));

}
else if (existing) {

    ({ error } = await supabase
        .from("layout_polygons")
        .update({
            status: mode,
            points: (tool === "edit" ? editingPoints : points).map(p => ({
                x: p.x,
                y: p.y
            })),
            image_width: img.clientWidth,
            image_height: img.clientHeight
        })
        .eq("id", existing.id));

}
else {

    ({ error } = await supabase
        .from("layout_polygons")
        .insert({
            project_id: proj.id,
            plot_number: Number(plotNumber),
            status: mode,
            points: points.map(p => ({
                x: p.x,
                y: p.y
            })),
            image_width: img.clientWidth,
            image_height: img.clientHeight
        }));

}

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
onClick={()=>setTool("select")}
style={{
background:tool==="select"?"#2563eb":"#222",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
🖱 Select
</button>

<button
onClick={()=>setTool("draw")}
style={{
background:tool==="draw"?"#16a34a":"#222",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
➕ Draw
</button>

<button
onClick={()=>setTool("edit")}
style={{
background:tool==="edit"?"#f59e0b":"#222",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
✏ Edit
</button>

<button
onClick={()=>setTool("paint")}
style={{
background:tool==="paint"?"#9333ea":"#222",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
🎨 Paint
</button>

<button
onClick={()=>setTool("erase")}
style={{
background:tool==="erase"?"#dc2626":"#222",
color:"white",
padding:"10px 18px",
borderRadius:8
}}
>
🧽 Erase
</button>
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
    {(tool === "draw" || tool === "edit") && (
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
)}
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
    onClick={(e)=>{
        if(tool==="draw"){
            handleClick(e);
        }
    }}

    onMouseMove={(e)=>{
        if(tool!=="edit") return;
        if(dragIndex===null) return;

        const rect = imgRef.current.getBoundingClientRect();

        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        setEditingPoints(prev=>{
            const pts=[...prev];
            pts[dragIndex]={ x, y };
            return pts;
        });
    }}

    onMouseUp={()=>{
        setDragIndex(null);
    }}

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
  {savedPolygons.map(poly => {

    const color =
        poly.status === "sold"
            ? "#ef4444"
            : poly.status === "booked"
            ? "#f59e0b"
            : "#22c55e";

    return (
    <>

        <polygon
            key={poly.id}
            onClick={async () => {

    if (tool === "paint") {

        const { error } = await supabase
            .from("layout_polygons")
            .update({
                status: mode
            })
            .eq("id", poly.id);

        if (!error) {
            await loadPolygons();
        }

        return;
    }
if (tool === "erase") {

    const confirmDelete = window.confirm(
        "Delete this polygon permanently?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
        .from("layout_polygons")
        .delete()
        .eq("id", poly.id);

    if (!error) {

        if (selectedPolygon?.id === poly.id) {
            setSelectedPolygon(null);
            setEditingPoints([]);
            setDragIndex(null);
        }

        await loadPolygons();
    }

    return;
}
    if (tool === "select" || tool === "edit") {
        setSelectedPolygon(poly);
        setEditingPoints([...poly.points]);
    }

}}
            points={
                poly.points
                    .map(
                        p =>
                            `${p.x * (imgRef.current?.clientWidth || 1000)},${p.y * (imgRef.current?.clientHeight || 700)}`
                    )
                    .join(" ")
            }
            fill={color}
            fillOpacity={0.35}
            stroke={selectedPolygon?.id === poly.id ? "#00BFFF" : color}
            strokeWidth={selectedPolygon?.id === poly.id ? 4 : 2}
        />

        {selectedPolygon?.id === poly.id &&
            editingPoints.map((p, index) => (

                <circle
    key={`vertex-${index}`}
    cx={p.x * (imgRef.current?.clientWidth || 1000)}
    cy={p.y * (imgRef.current?.clientHeight || 700)}
    r="6"
    fill="#00BFFF"
    stroke="white"
    strokeWidth="2"
    onMouseDown={()=>{
        if(tool==="edit"){
            setDragIndex(index);
        }
    }}
/>

            ))
        }

    </>
);

})}        
  {points.length > 1 && (
    <polyline
      points={
  points
    .map(
      p =>
        `${p.x * (imgRef.current?.clientWidth || 1000)},${p.y * (imgRef.current?.clientHeight || 700)}`
    )
    .join(" ")
}
      fill="none"
      stroke="#FFD54A"
      strokeWidth="2"
    />
  )}

  {closed && points.length > 2 && (
    <polygon
    points={
  points
    .map(
      p =>
        `${p.x * (imgRef.current?.clientWidth || 1000)},${p.y * (imgRef.current?.clientHeight || 700)}`
    )
    .join(" ")
}
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
    cx={p.x * (imgRef.current?.clientWidth || 1000)}
cy={p.y * (imgRef.current?.clientHeight || 700)}
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
