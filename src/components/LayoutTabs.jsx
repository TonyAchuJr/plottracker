export default function LayoutTabs({ activeTab, setActiveTab }) {
  return (
    <div className="layout-tabs">

      <button
        className={activeTab === "plots" ? "active" : ""}
        onClick={() => setActiveTab("plots")}
      >
        Plots
      </button>

      <button
        className={activeTab === "layout" ? "active" : ""}
        onClick={() => setActiveTab("layout")}
      >
        Image Layout
      </button>

    </div>
  );
}
