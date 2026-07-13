export default function LayoutView({ files }) {

  const layoutImage = files.find(
    file => file.file_type?.startsWith("image/")
  );

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
        src={layoutImage.storage_path}
        alt="Project Layout"
      />

    </div>

  );

}
