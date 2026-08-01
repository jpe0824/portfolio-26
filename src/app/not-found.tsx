import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-2 p-8">
      <p className="text-fg-muted">
        <span className="text-primary">$</span> cat &lt;unknown&gt;
      </p>
      <p className="text-red">cat: No such file or directory</p>
      <Link href="/" className="mt-4 text-primary underline hover:text-primary-hi">
        cd ~
      </Link>
    </div>
  );
}
