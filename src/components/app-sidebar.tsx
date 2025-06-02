"use client"

import {
  ChevronUp,
  CreditCard,
  Home,
  Users,
  Settings,
  TrendingUp,
  Wallet,
  Trophy,
  BarChart3,
  History,
  Vote,
  Coins,
  Gift,
  Bell,
  Zap,
  Lock,
  Shuffle,
  Shield,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"
import { useWallet } from "@solana/wallet-adapter-react"
import Link from "next/link"

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Leaderboard", 
    url: "/leaderboard",
    icon: Trophy,
  },
  {
    title: "Proposals",
    url: "/proposals",
    icon: Vote,
  },
  {
    title: "Quests",
    url: "/quests",
    icon: Gift,
  },
  {
    title: "Yield Farming",
    url: "/yield",
    icon: Coins,
  },
]

const squadItems = [
  {
    title: "My Squad",
    url: "/squads/my",
    icon: Users,
  },
  {
    title: "Browse Squads",
    url: "/squads/browse",
    icon: History,
  },
  {
    title: "Squad Leaderboard",
    url: "/squads/leaderboard",
    icon: Trophy,
  },
]

const specialItems = [
  {
    title: "My AIR",
    url: "/myair",
    icon: Zap,
  },
  {
    title: "Escrow",
    url: "/escrow",
    icon: Lock,
  },
  {
    title: "MPL",
    url: "/mpl",
    icon: Shuffle,
  },
]

const secondaryItems = [
  {
    title: "Notifications",
    url: "/notifications", 
    icon: Bell,
  },
  {
    title: "My Profile",
    url: "/profile",
    icon: BarChart3,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

const adminItems = [
  {
    title: "Admin Panel",
    url: "/admin/users",
    icon: Shield,
  },
]

export function AppSidebar() {
  const { data: session } = useSession()
  const wallet = useWallet()
  
  // Check if user is admin
  const isAdmin = (session?.user as any)?.role === 'admin'

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#3366FF] text-sidebar-primary-foreground">
                  <span className="text-lg font-bold text-white">D</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-[#3366FF]">DeFAI Rewards</span>
                  <span className="truncate text-xs">AI Agent Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Squads</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {squadItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Special</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {specialItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={session?.user?.image || "/placeholder-user.jpg"} alt="User" />
                    <AvatarFallback className="rounded-lg bg-[#3366FF] text-white">
                      {session?.user?.name?.charAt(0) || wallet.publicKey?.toBase58().substring(0, 2) || "US"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {session?.user?.name || wallet.publicKey?.toBase58().substring(0, 8) + "..." || "Anonymous"}
                    </span>
                    <span className="truncate text-xs">
                      {wallet.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <BarChart3 />
                    View Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Wallet />
                  Wallet Details
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}