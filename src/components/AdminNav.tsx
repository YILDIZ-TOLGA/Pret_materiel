"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const path = usePathname();
  return (
    <div className="row" style={{ marginBottom: 4 }}>
      <h1 style={{ margin: 0 }}>Admin</h1>
      <span className="spacer" />
      <Link href="/admin" className={`btn small ${path === "/admin" ? "primary" : ""}`}>Tableau de bord</Link>
      <Link href="/admin/utilisateurs" className={`btn small ${path === "/admin/utilisateurs" ? "primary" : ""}`}>Utilisateurs</Link>
    </div>
  );
}
