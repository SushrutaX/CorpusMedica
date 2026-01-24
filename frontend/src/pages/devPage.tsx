import { useEffect, useState } from "react";
import Prism from "../components/Prism";
import ProfileCard from "../components/ProfileCard";
import shauryaPhoto from "../photos/Shaurya1.jpg";

export default function DevPage() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        color: "#f1eff8",
        background: "radial-gradient(circle at top, #1b1234, #06010f 60%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
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
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
        <section
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "24px",
            textShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ width: "100%", maxWidth: "1400px" }}>
            <div style={{ marginBottom: "80px" }}>
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-evenly",
                alignItems: "center",
                gap: "32px",
                width: "100%",
              }}
            >
              <ProfileCard
                name="Shaurya Sharma"
                title="Tech Architect"
                handle="shauryasharma"
                status="Online"
                contactText="Contact"
                avatarUrl={shauryaPhoto}
                showUserInfo={true}
                enableTilt={true}
                enableMobileTilt={false}
                behindGlowEnabled={true}
                behindGlowColor="rgba(138, 125, 255, 0.67)"
                innerGradient="linear-gradient(145deg,#4a3d6e 0%,#9b8fff44 100%)"
                onContactClick={() => console.log("Contact clicked")}
              />
              <ProfileCard
                name="Aryan Gupta"
                title="Visionary Oracle"
                handle="aryanguard"
                status="Online"
                contactText="Contact"
                avatarUrl={shauryaPhoto}
                showUserInfo={true}
                enableTilt={true}
                enableMobileTilt={false}
                behindGlowEnabled={true}
                behindGlowColor="rgba(156, 255, 199, 0.6)"
                innerGradient="linear-gradient(145deg,#3a5a4a 0%,#9fffd444 100%)"
                onContactClick={() => console.log("Contact clicked")}
              />
              <ProfileCard
                name="Keshav Dixit"
                title="Code Whisperer"
                handle="keshavcodes"
                status="Online"
                contactText="Contact"
                avatarUrl={shauryaPhoto}
                showUserInfo={true}
                enableTilt={true}
                enableMobileTilt={false}
                behindGlowEnabled={true}
                behindGlowColor="rgba(255, 183, 126, 0.6)"
                innerGradient="linear-gradient(145deg,#5a3d2f 0%,#ffc39b44 100%)"
                onContactClick={() => console.log("Contact clicked")}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
