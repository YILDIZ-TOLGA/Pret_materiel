"use client";
import { usePathname, useRouter } from "next/navigation";
import { PageHeader, Segmented } from "./ui";

export function AdminNav({ actions }: { actions?: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <PageHeader title="Administration" sub="Revenus, trafic et comptes utilisateurs." actions={
      <>
        {actions}
        <Segmented value={path === "/admin/utilisateurs" ? "users" : "dash"} onChange={(v) => router.push(v === "users" ? "/admin/utilisateurs" : "/admin")} label="Sections"
          options={[{ value: "dash", label: "Tableau de bord" }, { value: "users", label: "Utilisateurs" }]} />
      </>
    } />
  );
}
