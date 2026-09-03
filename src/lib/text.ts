/** Place names a host types in are free text with no picker, so casing
 *  varies wildly ("MADRID", "llandudno", "St Michael's mount") — this
 *  normalizes to Title Case so every place badge and map label looks
 *  consistent regardless of how it was typed. */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}
