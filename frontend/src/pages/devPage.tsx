import Prism from "../components/Prism";

export default function DevPage() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <Prism
          animationType="rotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0}
          glow={1}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          color: "#f1eff8",
          textShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
          pointerEvents: "none",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(30px, 4vw, 54px)",
            margin: 0,
            fontWeight: 600,
          }}
        >
          Built by People Who Care
        </h1>
        <p
          style={{
            marginTop: "12px",
            fontSize: "clamp(14px, 2vw, 20px)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#d9d3ea",
          }}
        >
          The Team Powering This Product
        </p>
      </div>
    </div>
  );
}
