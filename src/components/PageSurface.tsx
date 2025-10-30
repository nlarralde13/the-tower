import type { CSSProperties, ReactNode } from "react";

interface PageSurfaceProps {
  children: ReactNode;
  className?: string;
  backgroundImage?: string;
  overlay?: string;
}

type PageSurfaceStyle = CSSProperties & {
  "--page-background"?: string;
  "--page-overlay"?: string;
};

export default function PageSurface({
  children,
  className,
  backgroundImage,
  overlay,
}: PageSurfaceProps) {
  const style: PageSurfaceStyle = {};

  if (backgroundImage) {
    style["--page-background"] = `url("${backgroundImage}")`;
  }

  if (overlay) {
    style["--page-overlay"] = overlay;
  }

  const classes = ["page", className].filter(Boolean).join(" ");

  return (
    <section className={classes} style={style}>
      {children}
    </section>
  );
}

