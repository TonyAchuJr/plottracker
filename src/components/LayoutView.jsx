export default function LayoutView({ proj }) {

  const layoutImage = proj.cover_image;

  if (!layoutImage) {
    return (
      <div className="layout-empty">

        <h3>No Layout Image</h3>

        <p>
          Upload a layout image from the Files section.
        </p>

      </div>
    );
  }

  return (

    <div className="layout-view">

      <img
    src={layoutImage}
        alt="Project Layout"
      />

    </div>

  );

}
