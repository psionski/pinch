"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  BarChart3,
  Wallet,
  Repeat,
  TrendingUp,
  ChevronRight,
  DollarSign,
  PieChart,
} from "lucide-react";
import { Collapsible } from "radix-ui";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType;
}

const navItemsBefore: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/categories", label: "Categories", icon: Tags },
];

const reportSubItems = [
  { href: "/reports/cash-flow", label: "Cash Flow", icon: DollarSign },
  { href: "/reports/portfolio", label: "Portfolio", icon: PieChart },
];

const navItemsAfter: NavItem[] = [
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/assets", label: "Assets", icon: TrendingUp },
  { href: "/recurring", label: "Recurring", icon: Repeat },
];

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
  const reportsActive = pathname.startsWith("/reports");

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span>🪙 Pinch</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItemsBefore.map((item) => (
                <NavMenuItem key={item.href} item={item} pathname={pathname} />
              ))}

              <Collapsible.Root defaultOpen={reportsActive} className="group/collapsible">
                <SidebarMenuItem>
                  <Collapsible.Trigger asChild>
                    <SidebarMenuButton tooltip="Reports" isActive={reportsActive}>
                      <BarChart3 />
                      <span>Reports</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <SidebarMenuSub>
                      {reportSubItems.map((sub) => (
                        <SidebarMenuSubItem key={sub.href}>
                          <SidebarMenuSubButton asChild isActive={pathname === sub.href}>
                            <Link href={sub.href}>
                              <sub.icon />
                              <span>{sub.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </Collapsible.Content>
                </SidebarMenuItem>
              </Collapsible.Root>

              {navItemsAfter.map((item) => (
                <NavMenuItem key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
