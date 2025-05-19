"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { EnrichedSquadInvitation } from '@/app/page'; // Assuming type is exported from page.tsx or move to types/index.ts
// TODO: Move EnrichedSquadInvitation to a shared types file e.g., src/types/squads.ts
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet"; // User action: npx shadcn-ui@latest add sheet
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import { useSwipeable, SwipeEventData } from 'react-swipeable'; // Added SwipeEventData
import { motion, AnimatePresence } from 'framer-motion';

interface SquadInvitationCardProps {
  invite: EnrichedSquadInvitation;
  onAction: (invitationId: string, action: 'accept' | 'decline') => void;
  isProcessing: boolean;
}

const SquadInvitationCard: React.FC<SquadInvitationCardProps> = ({
  invite,
  onAction,
  isProcessing,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [swipeAction, setSwipeAction] = useState<'accept' | 'decline' | null>(null);

  const handleSwipeAction = (action: 'accept' | 'decline') => {
    if (isProcessing) return;
    setSwipeAction(action);
    setIsVisible(false); 
    // Actual onAction call will happen after animation completes
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData: SwipeEventData) => handleSwipeAction('decline'),
    onSwipedRight: (eventData: SwipeEventData) => handleSwipeAction('accept'),
    preventScrollOnSwipe: true,
    trackMouse: true, 
  });

  const handleAnimationComplete = () => {
    if (!isVisible && swipeAction) { // Check if animation was triggered by a swipe
      onAction(invite.invitationId, swipeAction);
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(5); 
      }
      // Reset swipeAction for the next potential interaction if card were to re-appear
      // setSwipeAction(null); 
      // setIsVisible(true); // Only if re-showing, but here it's exiting permanently based on parent logic
    }
  };
  
  const expiresDate = invite.expiresAt ? new Date(invite.expiresAt) : null;
  const formattedExpiresAt = expiresDate ? expiresDate.toLocaleDateString() : 'N/A';

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {isVisible && (
        <motion.li
          {...swipeHandlers}
          layout 
          initial={{ opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{
            opacity: 0,
            x: swipeAction === 'accept' ? 100 : -100,
            transition: { duration: 0.3 }
          }}
          // onAnimationComplete is handled by AnimatePresence's onExitComplete for this case
          className="p-3 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-between select-none cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-3 flex-grow">
            <UserAvatar 
              profileImageUrl={invite.inviterInfo?.xProfileImageUrl} 
              username={invite.inviterInfo?.xUsername || 'User'}
              size="md" 
            />
            <div className="flex-grow">
              <p className="text-sm font-medium text-foreground">
                Invite to join <strong className="text-defai_primary">{invite.squadName}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                From: {invite.inviterInfo?.xUsername ? `@${invite.inviterInfo.xUsername}` : `${invite.invitedByUserWalletAddress.substring(0, 6)}...`}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires: {formattedExpiresAt}
              </p>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-2 flex-shrink-0 h-8 w-8" disabled={isProcessing}>
                <EllipsisVerticalIcon className="h-5 w-5" />
                <span className="sr-only">Actions for invite to {invite.squadName}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-lg">
              <SheetHeader className="mb-4 text-left">
                <SheetTitle>Invitation to <span className="text-defai_primary">{invite.squadName}</span></SheetTitle>
                <SheetDescription>
                  From: {invite.inviterInfo?.xUsername ? `@${invite.inviterInfo.xUsername}` : `${invite.invitedByUserWalletAddress.substring(0, 6)}...`}. 
                  Expires: {formattedExpiresAt}.
                </SheetDescription>
              </SheetHeader>
              {/* Mutual Friends Placeholder */}
              <div className="my-4">
                <h4 className="text-sm font-medium text-foreground mb-1">Mutual Friends</h4>
                <p className="text-xs text-muted-foreground">Coming soon...</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="default"
                  onClick={() => { onAction(invite.invitationId, 'accept'); }} 
                  disabled={isProcessing} 
                  className="w-full bg-positive hover:bg-positive/90 text-positive-foreground"
                >
                  {isProcessing ? 'Processing...' : 'Accept Invitation'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => { onAction(invite.invitationId, 'decline'); }}
                  disabled={isProcessing} 
                  className="w-full"
                >
                  {isProcessing ? 'Processing...' : 'Decline Invitation'}
                </Button>
              </div>
              <SheetFooter className="mt-6">
                <SheetClose asChild>
                  <Button variant="ghost" className="w-full">Cancel</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </motion.li>
      )}
    </AnimatePresence>
  );
};

export default SquadInvitationCard; 