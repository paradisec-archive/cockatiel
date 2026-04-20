interface ClickMathInput {
  clientX: number;
  configuredPxPerSec: number;
  containerLeft: number;
  containerWidth: number;
  duration: number;
  scrollLeft: number;
}

export const clientXToTime = (input: ClickMathInput): number | null => {
  const { clientX, configuredPxPerSec, containerLeft, containerWidth, duration, scrollLeft } = input;
  if (duration <= 0) {
    return null;
  }
  // When unzoomed, minPxPerSec is 0 (fit-to-window). The true rendered width
  // lives in the shadow DOM, so the outer container's scrollWidth is useless
  // here — compute from the viewport width and duration instead.
  const pxPerSec = configuredPxPerSec > 0 ? configuredPxPerSec : containerWidth / duration;
  if (pxPerSec <= 0) {
    return null;
  }
  return (clientX - containerLeft + scrollLeft) / pxPerSec;
};
