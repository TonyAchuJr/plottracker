import { useState } from "react";
export default function LayoutView({ proj, plots, layoutCoords }) {
  const [scale, setScale] = useState(1);

const [offset, setOffset] = useState({
  x: 0,
  y: 0
});

const [dragging, setDragging] = useState(false);

const [start, setStart] = useState({
  x: 0,
  y: 0
});
  if (!proj?.layout_image) {
    return (
      <div className="layout-empty">
        <h3>No Master Layout Uploaded</h3>
        <p>Upload a layout image in Project Settings.</p>
      </div>
    );
  }

  return (
    <div
  style={{
    overflow: "hidden",
    borderRadius: 18,
    cursor: dragging ? "grabbing" : "grab",
    marginTop: 20
  }}

  onWheel={(e) => {

    e.preventDefault();

    const delta = e.deltaY > 0 ? -0.1 : 0.1;

    setScale(s =>
      Math.min(3, Math.max(0.5, s + delta))
    );

  }}

  onMouseDown={(e) => {

    setDragging(true);

    setStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    });

  }}

  onMouseMove={(e) => {

    if (!dragging) return;

    setOffset({
      x: e.clientX - start.x,
      y: e.clientY - start.y
    });

  }}

  onMouseUp={() => setDragging(false)}

  onMouseLeave={() => setDragging(false)}
>
      <div
  style={{
    position: "relative",
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
    transformOrigin: "top left",
    transition: dragging ? "none" : "transform .08s"
  }}
>
      <img
        src={proj.layout_image}
        alt="Master Layout"
        style={{
          width: "100%",
          display: "block",
          borderRadius: 18
        }}
      />

      {layoutCoords.map(coord => {

        const plot = plots.find(
          p => Number(p.number) === Number(coord.plot_number)
        );

        let color = "#22c55e";

        if (plot?.status === "booked")
          color = "#f59e0b";

        if (plot?.status === "sold")
          color = "#ef4444";

        return (
          <div
            key={coord.id}
            style={{
              position: "absolute",

              left: coord.x,

              top: coord.y,

              width: coord.width,

              height: coord.height,

              background: color,

              opacity: .45,

              border: `2px solid ${color}`,

              borderRadius: 8,

              color: "white",

              display: "flex",

              justifyContent: "center",

              alignItems: "center",

              fontWeight: "bold",

              cursor: "pointer"
            }}
          >
            {coord.plot_number}
          </div>
        );

      })}
    </div>
  </div>
  );
}
