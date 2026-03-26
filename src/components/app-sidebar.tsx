"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  Wallet,
  Repeat,
  TrendingUp,
  DollarSign,
  PieChart,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const topItems: NavItem[] = [{ href: "/", label: "Dashboard", icon: LayoutDashboard }];

const navGroups: NavGroup[] = [
  {
    label: "Track",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/recurring", label: "Recurring", icon: Repeat },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/budgets", label: "Budgets", icon: Wallet },
      { href: "/categories", label: "Categories", icon: Tags },
    ],
  },
  {
    label: "Wealth",
    items: [
      { href: "/assets", label: "Assets", icon: TrendingUp },
      { href: "/reports/cash-flow", label: "Cash Flow", icon: DollarSign },
      { href: "/reports/portfolio", label: "Portfolio", icon: PieChart },
    ],
  },
];

const bottomItems: NavItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];

function NavMenuItem({ item, pathname }: { item: NavItem; pathname: string }): React.ReactElement {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
        tooltip={item.label}
      >
        <Link href={item.href}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar(): React.ReactElement {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <Link href="/" className="text-primary flex items-center gap-2 font-semibold">
          <span>Pinch</span>
        </Link>
      </SidebarHeader>
      <SidebarContent data-tour="sidebar-nav">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {topItems.map((item) => (
                <NavMenuItem key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavMenuItem key={item.href} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.map((item) => (
                <NavMenuItem key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
