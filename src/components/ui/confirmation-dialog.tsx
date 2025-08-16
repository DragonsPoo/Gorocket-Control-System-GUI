import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import eventBus from '@/lib/event-bus';

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

const ConfirmationDialog: React.FC = () => {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const handler = (data: { title: string; message: string; onConfirm: () => void }) => {
      setState({
        isOpen: true,
        title: data.title,
        message: data.message,
        onConfirm: data.onConfirm,
      });
    };

    eventBus.on('show-confirmation', handler);

    return () => {
      eventBus.off('show-confirmation', handler);
    };
  }, []);

  const handleConfirm = useCallback(() => {
    state.onConfirm();
    setState({ ...state, isOpen: false });
  }, [state]);

  const handleCancel = useCallback(() => {
    setState({ ...state, isOpen: false });
  }, [state]);

  return (
    <AlertDialog open={state.isOpen} onOpenChange={handleCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmationDialog;
