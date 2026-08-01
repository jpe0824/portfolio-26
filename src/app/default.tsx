import { notFound } from "next/navigation";

// The implicit children slot. [[...path]] matches every URL, so this should never
// render; default.md requires it to exist regardless, and a 404 is the correct
// fallback if it ever does.
export default function Default() {
  notFound();
}
