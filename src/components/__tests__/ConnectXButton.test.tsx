import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConnectXButton from '../xauth/ConnectXButton';
import { redirectTo } from '../../utils/redirect';
import { useSession } from 'next-auth/react';

jest.mock('next-auth/react');

// Mock toast from sonner
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

const mockedUseSession = useSession as jest.Mock;


jest.mock('../../utils/redirect', () => {
    return {
      redirectTo: jest.fn(),
    };
  });


describe('ConnectXButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticated, no X account linked
    mockedUseSession.mockReturnValue({
      data: { user: {} },
      status: 'authenticated',
      update: jest.fn(),
    });
  });

  it('shows loading state when session is loading', () => {
    mockedUseSession.mockReturnValueOnce({ data: null, status: 'loading' });
    render(<ConnectXButton />);
    expect(screen.getByText('Loading X Status...')).toBeInTheDocument();
  });

  it('shows connect button when not linked', () => {
    render(<ConnectXButton />);
    expect(screen.getByRole('button', { name: /Connect X Account/i })).toBeInTheDocument();
  });

  it('disables button when not authenticated', () => {
    mockedUseSession.mockReturnValueOnce({ data: null, status: 'unauthenticated' });
    render(<ConnectXButton />);
    expect(screen.getByRole('button', { name: /Connect X Account/i })).toBeDisabled();
  });

  it('shows linked X account and follow status', () => {
    mockedUseSession.mockReturnValueOnce({
      data: {
        user: {
          linkedXUsername: 'testuser',
          followsDefAIRewards: true,
        },
      },
      status: 'authenticated',
    });
    render(<ConnectXButton />);
    expect(screen.getByText('@testuser')).toBeInTheDocument();
    expect(screen.getByText('✓ Following @defAIRewards')).toBeInTheDocument();
  });

  it('shows not following status', () => {
    mockedUseSession.mockReturnValueOnce({
      data: {
        user: {
          linkedXUsername: 'testuser',
          followsDefAIRewards: false,
        },
      },
      status: 'authenticated',
    });
    render(<ConnectXButton />);
    expect(screen.getByText('✗ Not following @defAIRewards')).toBeInTheDocument();
  });

  it('shows follow status not checked', () => {
    mockedUseSession.mockReturnValueOnce({
      data: {
        user: {
          linkedXUsername: 'testuser',
          followsDefAIRewards: null,
        },
      },
      status: 'authenticated',
    });
    render(<ConnectXButton />);
    expect(screen.getByText('Follow status for @defAIRewards not yet checked.')).toBeInTheDocument();
  });

  it('initiates X connection and redirects on success', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authorizationUrl: 'https://x.com/oauth/authorize' }),
    });
    // Instead of delete, just assign a mock object
    render(<ConnectXButton />);
    const btn = screen.getByRole('button', { name: /Connect X Account/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(redirectTo).toHaveBeenCalledWith('https://x.com/oauth/authorize');
    });
  });

  it('shows error toast if fetch fails', async () => {
    const { toast } = require('sonner');
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to initiate' }),
    });
    render(<ConnectXButton />);
    const btn = screen.getByRole('button', { name: /Connect X Account/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to initiate');
    });
  });

  it('shows error toast if no authorizationUrl returned', async () => {
    const { toast } = require('sonner');
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    render(<ConnectXButton />);
    const btn = screen.getByRole('button', { name: /Connect X Account/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Authorization URL not received from server.');
    });
  });

  it('shows error toast if fetch throws', async () => {
    const { toast } = require('sonner');
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));
    render(<ConnectXButton />);
    const btn = screen.getByRole('button', { name: /Connect X Account/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network error');
    });
  });
});
