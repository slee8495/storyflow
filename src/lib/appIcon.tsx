// Generative open-book mark (indigo gradient, matches globals.css's --clay palette) — no binary
// asset files, rendered on the fly by next/og for every icon size below.
export function AppIconMark({ size }: { size: number }) {
  const pageWidth = Math.round(size * 0.29);
  const pageHeight = Math.round(size * 0.42);
  const outerRadius = Math.round(size * 0.11);
  const innerRadius = Math.round(size * 0.025);
  const spineWidth = Math.max(2, Math.round(size * 0.028));
  const spineHeight = Math.round(size * 0.46);
  const gap = Math.max(1, Math.round(size * 0.012));

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #5a6fc9 0%, #2b3b80 62%, #1c2a5e 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: pageWidth,
            height: pageHeight,
            background: "#f7f5f0",
            borderRadius: `${outerRadius}px ${innerRadius}px ${innerRadius}px ${outerRadius}px`,
            marginRight: gap,
          }}
        />
        <div
          style={{
            width: spineWidth,
            height: spineHeight,
            background: "#161c3a",
            borderRadius: spineWidth / 2,
          }}
        />
        <div
          style={{
            width: pageWidth,
            height: pageHeight,
            background: "#f7f5f0",
            borderRadius: `${innerRadius}px ${outerRadius}px ${outerRadius}px ${innerRadius}px`,
            marginLeft: gap,
          }}
        />
      </div>
    </div>
  );
}
