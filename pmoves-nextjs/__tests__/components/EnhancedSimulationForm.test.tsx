/**
 * Enhanced Simulation Form Component Tests
 * Tests form functionality, validation, and user interactions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnhancedSimulationForm } from '@/components/EnhancedSimulationForm';
import { DEFAULT_PARAMS } from '@/lib/simulation';

describe('EnhancedSimulationForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnParamsChange = jest.fn();
  const mockOnReset = jest.fn();
  
  const defaultProps = {
    params: DEFAULT_PARAMS,
    onParamsChange: mockOnParamsChange,
    onSubmit: mockOnSubmit,
    isLoading: false,
    onReset: mockOnReset,
    presetName: null,
    showPreview: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders all parameter inputs', () => {
    render(<EnhancedSimulationForm {...defaultProps} />);
    
    expect(screen.getByLabelText(/number of members/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/simulation duration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/average weekly income/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/average weekly budget/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/initial wealth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/initial wealth inequality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/income variation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/budget variation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/percent spent internally/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/group buy savings/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/local production savings/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/weekly grotoken reward/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/grotoken value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/weekly coop fee/i)).toBeInTheDocument();
  });

  test('validates parameter ranges', async () => {
    const user = userEvent.setup();
    render(<EnhancedSimulationForm {...defaultProps} />);
    
    // Test minimum members validation
    const membersInput = screen.getByLabelText(/number of members/i);
    await user.clear(membersInput);
    await user.type(membersInput, '5');
    await user.tab(); // Move to next input
    
    expect(screen.getByText(/minimum 10 members required/i)).toBeInTheDocument();
    
    // Test simulation duration validation
    const durationInput = screen.getByLabelText(/simulation duration/i);
    await user.clear(durationInput);
    await user.type(durationInput, '4');
    
    expect(screen.getByText(/minimum 12 weeks required/i)).toBeInTheDocument();
    
    // Test negative values are rejected
    const incomeInput = screen.getByLabelText(/average weekly income/i);
    await user.clear(incomeInput);
    await user.type(incomeInput, '-50');
    
    expect(screen.getByText(/minimum 0 income required/i)).toBeInTheDocument();
  });

  test('submits form with valid parameters', async () => {
    const user = userEvent.setup();
    render(<EnhancedSimulationForm {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /run simulation/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnParamsChange).toHaveBeenCalledWith(expect.objectContaining({
        NUM_MEMBERS: expect.any(Number),
        SIMULATION_WEEKS: expect.any(Number),
        WEEKLY_INCOME_AVG: expect.any(Number),
        WEEKLY_FOOD_BUDGET_AVG: expect.any(Number),
        PERCENT_SPEND_INTERNAL_AVG: expect.any(Number),
        GROUP_BUY_SAVINGS_PERCENT: expect.any(Number),
        LOCAL_PRODUCTION_SAVINGS_PERCENT: expect.any(Number),
        GROTOKEN_REWARD_PER_WEEK_AVG: expect.any(Number),
        GROTOKEN_USD_VALUE: expect.any(Number),
        WEEKLY_COOP_FEE_B: expect.any(Number),
        INITIAL_WEALTH_MEAN_LOG: expect.any(Number),
        INITIAL_WEALTH_SIGMA_LOG: expect.any(Number),
        WEEKLY_FOOD_BUDGET_STDDEV: expect.any(Number),
        WEEKLY_INCOME_STDDEV: expect.any(Number),
        MIN_WEEKLY_FOOD_BUDGET: expect.any(Number),
        MIN_WEEKLY_INCOME: expect.any(Number),
        PERCENT_SPEND_INTERNAL_STDDEV: expect.any(Number),
        GROTOKEN_REWARD_STDDEV: expect.any(Number),
        localEconomicActivities: expect.any(Array)
      }));
    });
  });

  test('resets form to default parameters', async () => {
    const user = userEvent.setup();
    render(<EnhancedSimulationForm {...defaultProps} />);
    
    const resetButton = screen.getByRole('button', { name: /reset/i });
    await user.click(resetButton);
    
    await waitFor(() => {
      expect(mockOnReset).toHaveBeenCalledTimes(1);
      expect(mockOnParamsChange).toHaveBeenCalledWith(DEFAULT_PARAMS);
    });
  });

  test('shows loading state during simulation', () => {
    render(<EnhancedSimulationForm {...defaultProps} isLoading={true} />);
    
    expect(screen.getByRole('button', { name: /running/i })).toBeDisabled();
    expect(screen.getByText(/running/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of members/i)).toBeDisabled();
    expect(screen.getByLabelText(/simulation duration/i)).toBeDisabled();
  });

  test('displays preset name when provided', () => {
    const presetName = 'Test Preset';
    render(<EnhancedSimulationForm {...defaultProps} presetName={presetName} />);
    
    expect(screen.getByText(/based on preset: test preset/i)).toBeInTheDocument();
  });

  test('generates preview data when parameters change', async () => {
    const user = userEvent.setup();
    render(<EnhancedSimulationForm {...defaultProps} />);
    
    // Change a parameter to trigger preview update
    const membersInput = screen.getByLabelText(/number of members/i);
    await user.clear(membersInput);
    await user.type(membersInput, '50');
    
    // Wait for preview data to be generated
    await waitFor(() => {
      expect(screen.getByTitle(/parameter preview/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  test('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<EnhancedSimulationForm {...defaultProps} />);
    
    // Test tab navigation
    await user.tab();
    await user.tab();
    
    // Check focus is on form elements
    const firstInput = screen.getByLabelText(/number of members/i);
    expect(firstInput).toHaveFocus();
    
    // Test slider interaction with keyboard
    await user.type(firstInput, '25');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
  });

  test('provides accessible labels and descriptions', () => {
    render(<EnhancedSimulationForm {...defaultProps} />);
    
    // Check for proper ARIA labels
    const membersInput = screen.getByLabelText(/number of members/i);
    expect(membersInput).toHaveAttribute('aria-describedby');
    
    // Check for proper form structure
    const form = screen.getByRole('form', { name: /simulation parameters/i });
    expect(form).toHaveAttribute('aria-label');
    
    // Check for tooltips with proper button elements
    const tooltips = screen.getAllByRole('tooltip');
    expect(tooltips.length).toBeGreaterThan(0);
  });

  test('displays expected benefits calculation', () => {
    render(<EnhancedSimulationForm {...defaultProps} />);
    
    // Check if expected benefits are displayed
    expect(screen.getByText(/expected weekly benefit/i)).toBeInTheDocument();
    expect(screen.getByText(/expected benefit per member/i)).toBeInTheDocument();
  });
});