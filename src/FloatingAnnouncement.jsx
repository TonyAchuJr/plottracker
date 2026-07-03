import { useEffect, useRef, useState } from "react";

export default function FloatingAnnouncement({
  version,
  title,
  message
}) {
  const orbRef = useRef(null);

  const [show, setShow] = useState(false);

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("announcement_pos");

    if (saved) return JSON.parse(saved);

    return {
      x: window.innerWidth - 100,
      y: window.innerHeight - 120
    };
  });

  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const startDrag = (e) => {
    dragging.current = true;

    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {

    const move = (e) => {

      if (!dragging.current) return;

      const x = Math.min(
        Math.max(0, e.clientX - offset.current.x),
        window.innerWidth - 70
      );

      const y = Math.min(
        Math.max(0, e.clientY - offset.current.y),
        window.innerHeight - 70
      );

      setPosition({ x, y });
    };

    const stop = () => {

      if (!dragging.current) return;

      dragging.current = false;

      localStorage.setItem(
        "announcement_pos",
        JSON.stringify(position)
      );

    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };

  }, [position]);

  return (
    <>

      <div
        ref={orbRef}
        onMouseDown={startDrag}
        onDoubleClick={() => setShow(true)}
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,#FFD45A,#B8860B)",
          boxShadow:
            "0 0 25px rgba(255,215,0,.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          zIndex: 99999,
          animation: "floatOrb 3s ease-in-out infinite",
          userSelect: "none"
        }}
      >

        🔔

      </div>

      {show && (

        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 100000
          }}
        >

          <div
            style={{
              width: 500,
              maxWidth: "90%",
              background: "#121212",
              color: "white",
              borderRadius: 20,
              padding: 30,
              border: "1px solid gold",
              boxShadow: "0 0 35px rgba(255,215,0,.35)"
            }}
          >

            <h2 style={{ color: "#FFD45A" }}>
              📢 Announcement
            </h2>

            <p>
              <b>Version :</b> {version}
            </p>

            <hr />

            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.7,
                marginTop: 20
              }}
            >
              {message}
            </div>

            <button
              onClick={() => setShow(false)}
              style={{
                marginTop: 25,
                padding: "12px 25px",
                borderRadius: 10,
                border: "none",
                background: "#FFD45A",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Close
            </button>

          </div>

        </div>

      )}

      <style>
        {`
        @keyframes floatOrb{

          0%{
            transform:translateY(0px);
          }

          50%{
            transform:translateY(-10px);
          }

          100%{
            transform:translateY(0px);
          }

        }
        `}
      </style>

    </>
  );
}
