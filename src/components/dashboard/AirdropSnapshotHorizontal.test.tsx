import React from 'react';
import { render, screen } from '@testing-library/react';
import AirdropSnapshotHorizontal from './AirdropSnapshotHorizontal';
import { useUserAirdrop, UserAirdropData } from '@/hooks/useUserAirdrop';
import { AIR } from '@/config/points.config'; // For checking labels
import { formatPoints } from '@/lib/utils';

// Mock the useUserAirdrop hook
jest.mock('@/hooks/useUserAirdrop');
const mockUseUserAirdrop = useUserAirdrop as jest.MockedFunction<typeof useUserAirdrop>;

// Default props for the component not covered by the hook
const defaultProps = {
  defaiBalance: 1000,
  totalCommunityPoints: 1000000,
  airdropPoolSize: 50000000,
  snapshotDateString: 'May 20th, 2024 at 12:00 PM UTC',
};

describe('AirdropSnapshotHorizontal', () => {
  it('renders loading state correctly', () => {
    mockUseUserAirdrop.mockReturnValue({
      initialDefai: null,
      points: null,
      airBasedDefai: null,
      totalDefai: null,
      isLoading: true,
      error: null,
    } as UserAirdropData);
    render(<AirdropSnapshotHorizontal {...defaultProps} />);
    // Expect loading placeholders (e.g., 3 pulsing divs)
    expect(screen.getAllByRole('generic', { name: /loading placeholder/i })).toHaveLength(3); // Adjust selector as per your loading UI
  });

  it('renders N/A when data is null (and not loading)', () => {
    mockUseUserAirdrop.mockReturnValue({
      initialDefai: null,
      points: null,
      airBasedDefai: null, // Calculated by hook, will be null if points is null
      totalDefai: null,    // Calculated by hook
      isLoading: false,
      error: null,
    } as UserAirdropData);
    render(<AirdropSnapshotHorizontal {...defaultProps} defaiBalance={null} />); // Pass null defaiBalance too
    
    expect(screen.getByText(`Initial ${AIR.LABEL}`).nextElementSibling).toHaveTextContent('N/A');
    expect(screen.getByText(`Your ${AIR.LABEL}`).nextElementSibling).toHaveTextContent('N/A');
    expect(screen.getByText(`Est. ${AIR.LABEL}-Based DeFAI:`).nextElementSibling).toHaveTextContent('0'); // Hook calculates this as 0 if points are null
    expect(screen.getByText(`Total Estimated ${AIR.LABEL} Airdrop:`).nextElementSibling).toHaveTextContent('0'); // totalDefai (null) + defaiBalance (null) = 0
  });

  it('renders correctly with all data present', () => {
    const mockData: UserAirdropData = {
      initialDefai: 10000,
      points: 500,
      airBasedDefai: 500, // Assuming 1:1 ratio for simplicity in test mock
      totalDefai: 10500,  // initialDefai + airBasedDefai
      isLoading: false,
      error: null,
    };
    mockUseUserAirdrop.mockReturnValue(mockData);
    
    const currentDefaiBalance = 2000;
    const expectedTotalAirdrop = (mockData.totalDefai || 0) + currentDefaiBalance; // 10500 + 2000 = 12500

    render(<AirdropSnapshotHorizontal {...defaultProps} defaiBalance={currentDefaiBalance} />);

    expect(screen.getByText(`Initial ${AIR.LABEL}`).nextElementSibling).toHaveTextContent(formatPoints(mockData.initialDefai));
    expect(screen.getByText(`Your ${AIR.LABEL}`).nextElementSibling).toHaveTextContent(formatPoints(mockData.points));
    expect(screen.getByText(`Est. ${AIR.LABEL}-Based DeFAI:`).nextElementSibling).toHaveTextContent(formatPoints(mockData.airBasedDefai));
    expect(screen.getByText(`Total Estimated ${AIR.LABEL} Airdrop:`).nextElementSibling).toHaveTextContent(formatPoints(expectedTotalAirdrop));
  });

 it('renders correctly when only initialDefai is present', () => {
    mockUseUserAirdrop.mockReturnValue({
      initialDefai: 7500,
      points: null,
      airBasedDefai: null,
      totalDefai: 7500,
      isLoading: false,
      error: null,
    } as UserAirdropData);
    render(<AirdropSnapshotHorizontal {...defaultProps} defaiBalance={0} />); // No extra DeFAI balance

    expect(screen.getByText(`Initial ${AIR.LABEL}`).nextElementSibling).toHaveTextContent(formatPoints(7500));
    expect(screen.getByText(`Your ${AIR.LABEL}`).nextElementSibling).toHaveTextContent('N/A');
    expect(screen.getByText(`Est. ${AIR.LABEL}-Based DeFAI:`).nextElementSibling).toHaveTextContent('0');
    expect(screen.getByText(`Total Estimated ${AIR.LABEL} Airdrop:`).nextElementSibling).toHaveTextContent(formatPoints(7500));
  });

  it('renders correctly when only points (and thus airBasedDefai) are present', () => {
    mockUseUserAirdrop.mockReturnValue({
      initialDefai: null,
      points: 300,
      airBasedDefai: 300, // Mocked, assuming 1:1
      totalDefai: 300,
      isLoading: false,
      error: null,
    } as UserAirdropData);
    render(<AirdropSnapshotHorizontal {...defaultProps} defaiBalance={100} />); // With some DeFAI balance
    const expectedTotal = 300 + 100;

    expect(screen.getByText(`Initial ${AIR.LABEL}`).nextElementSibling).toHaveTextContent('N/A');
    expect(screen.getByText(`Your ${AIR.LABEL}`).nextElementSibling).toHaveTextContent(formatPoints(300));
    expect(screen.getByText(`Est. ${AIR.LABEL}-Based DeFAI:`).nextElementSibling).toHaveTextContent(formatPoints(300));
    expect(screen.getByText(`Total Estimated ${AIR.LABEL} Airdrop:`).nextElementSibling).toHaveTextContent(formatPoints(expectedTotal));
  });

  // Test for error state (optional, if component has specific error UI)
  it('displays an error message if the hook returns an error', () => {
    mockUseUserAirdrop.mockReturnValue({
      initialDefai: null,
      points: null,
      airBasedDefai: null,
      totalDefai: null,
      isLoading: false,
      error: 'Failed to load data',
    } as UserAirdropData);
    render(<AirdropSnapshotHorizontal {...defaultProps} />);
    // Depending on how your component handles errors, you might look for a specific message
    // For now, we check if the main values reflect the error state (e.g., show N/A or 0)
    expect(screen.getByText(`Initial ${AIR.LABEL}`).nextElementSibling).toHaveTextContent('N/A');
    // If you have a dedicated error display element, assert its content here.
  });
});

// Helper for loading state (adjust selector to match your actual loading UI)
// Example: if your pulsing divs have a specific test-id or ARIA role
// For the test above, I used a generic role and name, assuming you might add specific attributes for testing.
// Example: `<div role="generic" aria-label="loading placeholder" ... />` 