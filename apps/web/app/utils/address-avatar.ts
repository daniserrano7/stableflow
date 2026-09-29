/**
 * Deterministic two-hue gradient for an address, so the same wallet looks the same everywhere
 * and a repeated counterparty is recognisable at a glance without reading hex.
 */
export function getAddressAvatarBackground(address: string) {
  const hex = address.toLowerCase().replace(/^0x/, "").padEnd(12, "0");
  const hueA = Number.parseInt(hex.slice(0, 4), 16) % 360;
  const hueB = (hueA + 50 + (Number.parseInt(hex.slice(4, 6), 16) % 80)) % 360;
  const angle = Number.parseInt(hex.slice(6, 8), 16) % 360;
  return `linear-gradient(${angle}deg in oklch, oklch(0.74 0.13 ${hueA}), oklch(0.58 0.15 ${hueB}))`;
}
