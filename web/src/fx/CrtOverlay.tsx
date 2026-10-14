export function CrtOverlay({ on }: { on: boolean }) {
  if (!on) return null;
  return <div className="crt" aria-hidden="true" />;
}
