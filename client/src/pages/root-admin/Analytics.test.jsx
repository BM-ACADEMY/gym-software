import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Analytics from './Analytics';
import apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn() },
}));

const ANALYTICS_RESPONSE = {
  data: {
    data: {
      period: { dateFrom: '2026-08-20', dateTo: '2026-09-19' },
      revenueTrend: [{ date: '2026-09-01', total: 25000 }],
      growthChart: [{ date: '2026-09-01', newSubscribers: 3 }],
      churnTrend: [{ date: '2026-09-05', churned: 1 }],
      planDistribution: [
        { planId: 'p1', planName: 'Growth', count: 12 },
        { planId: 'p2', planName: 'Starter', count: 5 },
      ],
      churn: { activeSubscribers: 40, churnedThisPeriod: 2, churnRate: 0.048 },
      topGyms: [{ subscriberId: 'g1', gymName: 'PowerHouse Fitness', revenue: 180000 }],
    },
  },
};

describe('Root Admin Analytics', () => {
  it('renders the churn stat and a real plan-distribution breakdown instead of raw numbers only', async () => {
    apiClient.get.mockResolvedValueOnce(ANALYTICS_RESPONSE);

    render(<Analytics />);

    expect(await screen.findByText('5%')).toBeInTheDocument(); // churn rate, rounded
    expect(screen.getByText('Churn trend')).toBeInTheDocument();
    expect(screen.getByText('Plan distribution')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText(/PowerHouse Fitness/)).toBeInTheDocument();
  });
});
