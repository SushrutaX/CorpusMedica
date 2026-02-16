import { useEffect, useMemo, useState } from "react";

const SHAURYA_PHOTO = new URL("../photos/Shaurya1.jpg", import.meta.url).href;
const ARYAN_PHOTO = new URL("../photos/Aryan.jpg", import.meta.url).href;
const KESHAV_PHOTO = new URL("../photos/Keshav.jpg", import.meta.url).href;

export default function DevPage() {
  const [topOffset, setTopOffset] = useState(96);
  const [cardHeight, setCardHeight] = useState(420);
  const topGap = 0;
  const cacheBust = useMemo(() => Date.now().toString(), []);
  const shauryaPhoto = `${SHAURYA_PHOTO}?v=${cacheBust}`;
  const aryanPhoto = `${ARYAN_PHOTO}?v=${cacheBust}`;
  const keshavPhoto = `${KESHAV_PHOTO}?v=${cacheBust}`;

  useEffect(() => {
    const updateOffset = () => {
      const topbar = document.querySelector<HTMLElement>(".topbar");
      if (!topbar) return;
      const rect = topbar.getBoundingClientRect();
      const styles = window.getComputedStyle(topbar);
      const marginBottom = parseFloat(styles.marginBottom || "0");
      const nextOffset = Math.max(0, Math.round(rect.height + marginBottom));
      setTopOffset(nextOffset);
    };

    updateOffset();
    const topbar = document.querySelector<HTMLElement>(".topbar");
    const ro = topbar ? new ResizeObserver(updateOffset) : null;
    if (topbar && ro) ro.observe(topbar);
    window.addEventListener("resize", updateOffset);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, []);

  useEffect(() => {
    const updateCardLayout = () => {
      const availableHeight = Math.max(320, window.innerHeight - topOffset);
      const availableWidth = Math.max(320, window.innerWidth - 48);
      const headerSpace = Math.max(140, availableHeight * 0.28);
      const availableForCards = Math.max(260, availableHeight - headerSpace);
      const minHeight = 300;
      const maxHeight = 520;
      const gap = 32;
      const maxByHeight = Math.min(maxHeight, Math.max(minHeight, availableForCards));
      const maxByWidth = (availableWidth - gap * 2) / (0.718 * 3);
      const nextHeight = Math.max(minHeight, Math.min(maxByHeight, maxByWidth));
      setCardHeight(Number.isFinite(nextHeight) ? nextHeight : 420);
    };

    updateCardLayout();
    window.addEventListener("resize", updateCardLayout);
    return () => window.removeEventListener("resize", updateCardLayout);
  }, [topOffset]);

  return (
    <div
      className="dev-page"
      style={{
        position: "relative",
        width: "100%",
        height: `calc(100dvh - ${topOffset + topGap}px)`,
        minHeight: `calc(100dvh - ${topOffset + topGap}px)`,
        marginTop: `${topGap}px`,
        color: "#f1eff8",
        background: "radial-gradient(circle at top, #1b1234, #06010f 60%)",
        overflow: "hidden",
      }}
    >
      <div className="dev-alive" aria-hidden="true">
        <div className="dev-aurora" />
        <div className="dev-orb dev-orb-one" />
        <div className="dev-orb dev-orb-two" />
        <div className="dev-orb dev-orb-three" />
      </div>
      <div className="dev-content" style={{ position: "relative", zIndex: 1, height: "100%" }}>
        <section
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "clamp(12px, 3vh, 24px)",
            textShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ width: "100%", maxWidth: "1400px" }}>
            <div className="dev-hero" style={{ marginBottom: "clamp(18px, 4vh, 56px)" }}>
              <h1
                className="dev-title"
                style={{
                  fontSize: "clamp(24px, 4vh, 52px)",
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                Built by People Who Care
              </h1>
              <p
                className="dev-subtitle"
                style={{
                  marginTop: "12px",
                  fontSize: "clamp(12px, 2.2vh, 18px)",
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
                justifyContent: "center",
                alignItems: "center",
                gap: "clamp(16px, 3vw, 32px)",
                flexWrap: "wrap",
                width: "100%",
              }}
            >
              {[
                {
                  name: "Shaurya Sharma",
                  title: "Tech Architect",
                  photo: shauryaPhoto,
                },
                {
                  name: "Aryan Gupta",
                  title: "Visionary Oracle",
                  photo: aryanPhoto,
                },
                {
                  name: "Keshav Dixit",
                  title: "Code Whisperer",
                  photo: keshavPhoto,
                },
              ].map((member) => (
                <div
                  key={member.name}
                  className="dev-card"
                  style={{
                    width: `calc(${Math.round(cardHeight)}px * 0.718)`,
                    height: `${Math.round(cardHeight)}px`,
                    borderRadius: "28px",
                    overflow: "hidden",
                    background: "#0b0b12",
                    boxShadow: "0 30px 60px rgba(0, 0, 0, 0.45)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    position: "relative",
                  }}
                >
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="dev-card-img"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <div className="dev-card-shine" />
                  <div
                    className="dev-card-overlay"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(5,5,12,0.85) 100%)",
                    }}
                  />
                  <div
                    className="dev-card-text"
                    style={{
                      position: "relative",
                      zIndex: 2,
                      width: "100%",
                      padding: "16px 18px 20px",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: "18px", fontWeight: 600 }}>
                      {member.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#d7d6e6" }}>
                      {member.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
