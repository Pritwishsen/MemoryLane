import Link from "next/link";
import { backLinkClass } from "./styles";

export default function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={backLinkClass}>
      ← {children}
    </Link>
  );
}
