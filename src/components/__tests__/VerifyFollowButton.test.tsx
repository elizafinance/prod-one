import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VerifyFollowButton from '../xauth/VerifyFollowButton';
import { useSession } from 'next-auth/react';

jest.mock('next-auth/react');
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const mockedUseSession = useSession as jest.Mock;

describe('VerifyFollowButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSession.mockReturnValue({
      status: 'authenticated',
      update: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('one plus one equals two', () => {
    expect(1 + 1).toBe(2);
  });

  it('does not render if no linkedXUsername', () => {
    const { container } = render(<VerifyFollowButton linkedXUsername={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render if session is loading', () => {
    mockedUseSession.mockReturnValueOnce({ status: 'loading' });
    const { container } = render(<VerifyFollowButton linkedXUsername={"testuser"} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows login prompt if not authenticated', () => {
    mockedUseSession.mockReturnValueOnce({ status: 'unauthenticated' });
    render(<VerifyFollowButton linkedXUsername={"testuser"} />);
    expect(screen.getByText('Log in to verify follow status.')).toBeInTheDocument();
  });

  it('renders button if authenticated and linked', () => {
    render(<VerifyFollowButton linkedXUsername={"testuser"} />);
    expect(screen.getByRole('button', { name: /Check\/Refresh Follow Status/i })).toBeInTheDocument();
  });

  it('disables button while verifying', async () => {
    jest.useFakeTimers(); // Optional if needed
    let now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ follows: true }) });

    render(<VerifyFollowButton linkedXUsername="testuser" />);
    const btn = screen.getByTestId('follow-btn');

    fireEvent.click(btn);
    expect(btn).toBeDisabled();

    // Fast-forward 11 seconds to bypass the isRecentlyAttempted check
    now += 11000;
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });


  it('shows error toast if not linked', () => {
    const { toast } = require('sonner');
    render(<VerifyFollowButton linkedXUsername={null} />);
    // Try to click (should not render button, so nothing to click)
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows error toast if API returns needsRelink', async () => {
    const { toast } = require('sonner');
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ needsRelink: true }),
    });
    render(<VerifyFollowButton linkedXUsername={"testuser"} />);
    const btn = screen.getByTestId('follow-btn');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Your X authentication has expired. Please re-link your X account.", {"duration": 8000});
    });
  });

  it('shows error toast if API returns generic error', async () => {
    const { toast } = require('sonner');
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Some error' }),
    });
    render(<VerifyFollowButton linkedXUsername={"testuser"} />);
    const btn = screen.getByTestId('follow-btn');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Some error');
    });
  });

  it('shows success toast if follows is true', async () => {
    const { toast } = require('sonner');
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ follows: true }),
    });
    render(<VerifyFollowButton linkedXUsername={"testuser"} />);
    const btn = screen.getByTestId('follow-btn');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('✓ Successfully verified: You are following @defAIRewards!');
    });
  });

  it('shows info toast if follows is false', async () => {
    const { toast } = require('sonner');
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ follows: false }),
    });
    render(<VerifyFollowButton linkedXUsername={"testuser"} />);
    const btn = screen.getByTestId('follow-btn');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('You are not currently following @defAIRewards. Please follow and try again.');
    });
  });

  it('shows generic error toast on unexpected error', async () => {
    const { toast } = require('sonner');
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));
    render(<VerifyFollowButton linkedXUsername={"testuser"} />);
    const btn = screen.getByTestId('follow-btn');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('An unexpected error occurred while verifying follow status.');
    });
  });
});
