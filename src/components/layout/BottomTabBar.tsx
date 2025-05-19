"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, UserGroupIcon, TrophyIcon, ClipboardDocumentListIcon, UserCircleIcon } from '@heroicons/react/24/solid'; // Using solid icons as per HIG for tab bars

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/squads", label: "Squads", icon: UserGroupIcon }, // Assuming /squads is the main squads page
  { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
  { href: "/proposals", label: "Proposals", icon: ClipboardDocumentListIcon },
  { href: "/profile", label: "Profile", icon: UserCircleIcon }, // Assuming /profile for user profile
];

const BottomTabBar: React.FC = () => {
  const pathname = usePathname();

  // This component will be hidden on larger screens via CSS in the parent layout
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border shadow-top z-50 flex justify-around items-center px-[env(safe-area-inset-left)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
        return (
          <Link key={item.label} href={item.href} className="flex flex-col items-center justify-center flex-1 h-full pt-1 text-xs min-w-0" passHref>
            <item.icon 
              className={`h-6 w-6 mb-0.5 transition-colors ${isActive ? 'text-defai_primary' : 'text-muted-foreground group-hover:text-foreground'}`} 
            />
            <span className={`truncate transition-colors ${isActive ? 'text-defai_primary font-medium' : 'text-muted-foreground group-hover:text-foreground'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomTabBar; 