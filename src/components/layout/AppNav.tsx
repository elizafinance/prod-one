/* eslint-disable @next/next/no-img-element */
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Popover, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';
import DeFAILogo from '@/components/DeFAILogo'; // Assuming your logo component

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean; // Match exact path for active state, useful for Dashboard
}

interface AppNavProps {
  navItems: NavItem[];
  // Props to control visibility of right-side elements can be added later if needed
  // e.g., showWalletButton, showNotificationBell, userProfile
}

const AppNav: React.FC<AppNavProps> = ({ navItems }) => {
  const pathname = usePathname(); // Can be string or null

  const isActive = (item: NavItem) => {
    if (pathname === null) return false; // Handle null pathname
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <Popover className="relative w-full">
      {({ open, close }: { open: boolean; close: () => void }) => (
        <>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex justify-between items-center h-16 md:h-20">
              {/* Logo */}
              <div className="flex-shrink-0">
                <Link href="/" passHref>
                  <span className="cursor-pointer">
                    <DeFAILogo className="h-8 w-auto" />
                  </span>
                </Link>
              </div>

              {/* Desktop Navigation (Center) */}
              <nav className="hidden md:flex space-x-2 lg:space-x-4 items-center">
                {navItems.map((item) => (
                  <Link key={item.label} href={item.href} passHref>
                    <span
                      className={`px-2 py-1 lg:px-3 lg:py-2 rounded-md text-sm font-medium cursor-pointer transition-colors hover:text-[#2B96F1] whitespace-nowrap ${
                        isActive(item)
                          ? 'text-[#2B96F1] border-b-2 border-[#2B96F1] font-semibold'
                          : 'text-foreground hover:border-b-2 hover:border-gray-300'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                ))}
              </nav>

              {/* Right-side elements (Wallet, Notifications, Profile) - Placeholder for now */}
              <div className="hidden md:flex items-center space-x-4">
                {/* WalletMultiButtonDynamic can be added here later */}
                {/* NotificationBell can be added here later */}
                {/* UserAvatar can be added here later */}
              </div>

              {/* Mobile Menu Button */}
              <div className="-mr-2 flex items-center md:hidden">
                <Popover.Button className="bg-card p-2 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2B96F1]">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Popover.Button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          <Transition
            as={Fragment}
            enter="duration-200 ease-out"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="duration-100 ease-in"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Popover.Panel 
              focus 
              className="absolute top-0 inset-x-0 p-2 transition transform origin-top-right md:hidden z-50"
            >
              <div className="rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 bg-background border border-border divide-y-2 divide-border">
                <div className="pt-5 pb-6 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                       <Link href="/" passHref>
                          <span onClick={() => close()} className="cursor-pointer">
                            <DeFAILogo className="h-8 w-auto" />
                          </span>
                        </Link>
                    </div>
                    <div className="-mr-2">
                      <Popover.Button className="bg-card rounded-md p-2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2B96F1]">
                        <span className="sr-only">Close menu</span>
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </Popover.Button>
                    </div>
                  </div>
                  <div className="mt-6">
                    <nav className="grid gap-y-6">
                      {navItems.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          passHref
                        >
                          <span 
                            onClick={() => close()} 
                            className={`-m-3 p-3 flex items-center rounded-lg hover:bg-muted cursor-pointer transition-colors ${
                            isActive(item) ? 'text-[#2B96F1] font-semibold bg-blue-50' : 'text-foreground'
                          }`}>
                            <span className="ml-3 text-base font-medium">
                              {item.label}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </nav>
                  </div>
                </div>
                {/* Mobile Wallet Button Placeholder (can be added to Popover.Panel footer) */}
                 <div className="py-4 px-5">
                    {/* Placeholder for WalletMultiButtonDynamic in mobile panel */}
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default AppNav; 