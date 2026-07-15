// logotipo oficial BAM (asset de marca · /Hygge/03_BAM/03.BRAND) — vector limpio, periwinkle.
// tres paths: B · A · M. Se usa en el header del editor y en la lámina de export.

export const BAM_PERI = "#8eabec";
export const BAM_VIEWBOX = "0 0 2000 674.79";
export const BAM_PATHS = [
  // A
  "m645.07 35.62h407.61l57.51 596.19h-197.89l-9.31-129.38c-1.13-14.65-5.07-24.95-11.83-30.88-6.77-5.91-17.21-8.88-31.3-8.88h-26.21c-13.53 0-23.68 2.97-30.44 8.88-6.77 5.92-10.71 16.22-11.85 30.88l-11.83 130.23h-191.98l57.51-597.04zm167.43 276.54c6.77 6.21 15.5 9.3 26.21 9.3h16.07c10.71 0 19.45-3.23 26.21-9.72 6.77-6.48 9.58-15.93 8.46-28.34l-6.76-82.87c-.57-11.28-4.09-19.73-10.57-25.37-6.49-5.64-14.52-8.47-24.1-8.47h-.85c-21.42 0-33.27 11.29-35.51 33.84l-7.61 82.87c-1.14 12.98 1.69 22.56 8.45 28.76z",
  // B
  "m35.73 35.62h312.14c128.62 0 195.9 57.08 195.9 133.73s-60.48 122.66-162.68 125.21v51.12c113.28.85 183.13 45.99 183.13 134.58s-83.48 151.62-219.76 151.62h-308.73zm279.77 235.09c47.71 0 75.81-19.59 75.81-57.06s-28.1-56.22-75.81-56.22h-56.64c-31.28 0-56.64 25.36-56.64 56.64 0 31.28 25.36 56.64 56.64 56.64zm1.7 238.51c51.96 0 85.18-21.3 85.18-63.04s-33.22-63.87-85.18-63.87h-51.53c-35.05 0-63.46 28.41-63.46 63.46 0 35.05 28.41 63.46 63.46 63.46h51.53z",
  // M
  "m1154.74 35.43h313.3l63.13 351.3c3.25 15.15 16.64 25.97 32.13 25.97 15.39 0 28.72-10.68 32.07-25.7l66.36-351.57h303.92v597.23h-173.5v-403.77l-35.3-.06-78.5 403.83h-233.69l-78.87-403.77h-37.94s.25 403.77.25 403.77h-173.36z",
];

// componente React del logo
export function BamLogo({ height = 16, color = BAM_PERI, style }) {
  return (
    <svg viewBox={BAM_VIEWBOX} height={height} style={{ display: "block", ...style }} xmlns="http://www.w3.org/2000/svg">
      <g fill={color}>{BAM_PATHS.map((d, i) => <path key={i} d={d} />)}</g>
    </svg>
  );
}

// string del logo para inyectar en el SVG de export (translate/scale desde el caller)
export const bamLogoMarkup = (color = BAM_PERI) =>
  `<g fill="${color}">${BAM_PATHS.map((d) => `<path d="${d}"/>`).join("")}</g>`;
