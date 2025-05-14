'use client';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
const RequestToJoinModal = ({ isOpen, onClose, squadName, squadId, onSubmit, isSubmitting }) => {
    const [message, setMessage] = useState('');
    const handleSubmit = async () => {
        await onSubmit(squadId, message);
    };
    if (!isOpen)
        return null;
    // Check if Textarea component is available (conceptual check, actual check is by linter)
    let TextareaComponent = 'textarea'; // Default to HTML textarea
    try {
        // Dynamically try to resolve, or assume it exists based on prior knowledge/convention
        // This is more of a placeholder for how one might handle optional components
        // For now, we rely on the linter to tell us if the import is valid.
        // If '@/components/ui/textarea' was valid, this would be fine.
        // Since it might not be, we default to 'textarea' string for native element.
        // Textarea = (await import('@/components/ui/textarea')).Textarea;
    }
    catch (e) {
        console.warn("Using standard HTML textarea as @/components/ui/textarea was not found or errored.");
    }
    return (<Dialog open={isOpen} onOpenChange={(open) => { if (!open)
        onClose(); }}>
      <DialogContent className="sm:max-w-[480px] bg-white border-gray-300 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-spacegrotesk text-blue-700">
            Request to Join Squad: {squadName}
          </DialogTitle>
          <DialogDescription className="text-gray-600 pt-2">
            The squad leader will review your request. You can add an optional message below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <label htmlFor="joinMessage" className="block text-sm font-medium text-gray-700">
            Optional Message (max 500 chars)
          </label>
          <TextareaComponent id="joinMessage" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`E.g., "Hi, I'm active daily and would love to contribute to ${squadName}!"`} maxLength={500} rows={3} className="w-full p-2 border border-gray-300 focus:ring-blue-500 focus:border-blue-500 rounded-md disabled:opacity-70" disabled={isSubmitting}/>
        </div>

        <DialogFooter className="mt-4 sm:justify-end gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-70">
            {isSubmitting ? 'Submitting Request...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
};
export default RequestToJoinModal;
