import { useState } from "react";

export default function LayoutEditor({ proj, ctx }) {  
  const [points, setPoints] = useState([]);
console.log(proj);
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPoints((prev) => [...prev, { x, y }]);
  };

  return (
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
      </svg>
    </div>
  );
}
