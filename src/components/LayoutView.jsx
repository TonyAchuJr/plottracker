export default function LayoutView({ proj }) {

  const layoutImage = proj.cover_image;

  if (!layoutImage) {
    return (
      <div className="layout-empty">

        <h3>No Layout Image</h3>

        <p>
          Upload a Master Layout Image from Project Settings.
        </p>

      </div>
    );
  }

  return (

    <div className="layout-view">

      <img
    src={layoutImage}
    alt="Project Layout"
    style={{
        width: "100%",
        borderRadius: "18px",
        display: "block"
    }}
/>

    </div>

  );

}
