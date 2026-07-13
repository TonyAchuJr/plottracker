export default function LayoutView({ proj, plots, layoutCoords }) {
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
        position: "relative",
        width: "100%",
        marginTop: 20
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
  );
}
