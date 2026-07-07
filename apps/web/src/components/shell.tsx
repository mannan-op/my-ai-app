"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  FileText,
  Gauge,
  Home,
  Search,
  Settings,
  ShieldCheck
} from "lucide-react";
import { ReactNode } from "react";
import { fetchHealth } from "../lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/chat", label: "Research Chat", icon: Bot },
  { href: "/evals", label: "Evaluations", icon: BarChart3 }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function checkHealth() {
      try {
        const health = await fetchHealth();
        if (active) setApiHealthy(health.status === "ok" && health.database === "ok");
      } catch {
        if (active) setApiHealthy(false);
      }
    }

    checkHealth();
    const interval = window.setInterval(checkHealth, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <Link href="/dashboard" className="brand" aria-label="FilingLens dashboard">
          <span className="brand-mark">FL</span>
          <span>
            <strong>FilingLens</strong>
            <small>Analyst Workspace</small>
          </span>
        </Link>

        <nav className="nav-stack">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

            return (
              <Link key={item.href} href={item.href} className={active ? "nav-link active" : "nav-link"}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <div className={apiHealthy === false ? "status-error" : ""}>
            <ShieldCheck size={16} />
            {apiHealthy === null ? "Checking pipeline..." : apiHealthy ? "Verified pipeline" : "API unavailable"}
          </div>
          <div className={apiHealthy === false ? "status-error" : ""}>
            <Gauge size={16} />
            {apiHealthy === null ? "Connecting..." : apiHealthy ? "Agent graph online" : "Database offline"}
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="search-pill">
            <Search size={16} />
            Search filings, pages, citations
          </div>
          <button className="icon-button" aria-label="Settings">
            <Settings size={18} />
          </button>
        </header>
        <main className="page-frame">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

