import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import TransactionForm from '../TransactionForm';
import { CategoryProvider } from '../../contexts/CategoryContext';
import { PaymentMode, TransactionType } from '../../types';
import * as api from '../../services/api';
import toast from 'react-hot-toast';

// Mock API and Toast
vi.mock('../../services/api', () => ({
  request: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock Category Context data
vi.mock('../../contexts/CategoryContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/CategoryContext')>();
  return {
    ...actual,
    useCategories: () => ({
      categories: [
        { SK: 'CAT#Food', name: 'Food', icon: '🍔', isInvestment: false },
        { SK: 'CAT#Stocks', name: 'Stocks', icon: '📈', isInvestment: true }
      ],
      refreshCategories: vi.fn()
    })
  };
});

describe('TransactionForm Component', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (editingTx = null) => {
    return render(
      <TransactionForm 
        editingTx={editingTx} 
        onSuccess={mockOnSuccess} 
        onCancel={mockOnCancel} 
      />
    );
  };

  it('renders correctly for a new Expense (default)', () => {
    renderComponent();
    
    // Expense toggle button should be active
    expect(screen.getByRole('button', { name: 'Expense' })).toHaveClass('bg-white');
    expect(screen.getByRole('button', { name: 'Income' })).not.toHaveClass('bg-white');

    // Default payment mode should be UPI
    expect(screen.getByLabelText(/payment mode/i)).toHaveValue(PaymentMode.UPI);
  });

  it('switches to Income and changes default payment mode', async () => {
    renderComponent();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Income' }));

    expect(screen.getByRole('button', { name: 'Income' })).toHaveClass('bg-white');
    expect(screen.getByLabelText(/payment mode/i)).toHaveValue(PaymentMode.NET_BANKING);
  });

  it('shows error toast if required fields are missing', async () => {
    renderComponent();
    const user = userEvent.setup();

    // Fill only description
    await user.type(screen.getByPlaceholderText(/what did you pay for/i), 'Lunch');
    
    // Bypass HTML5 validation by firing submit on the form directly
    const form = screen.getByRole('button', { name: /add expense/i }).closest('form');
    if (form) fireEvent.submit(form);

    expect(toast.error).toHaveBeenCalledWith('Please fill all required fields.');
    expect(api.request).not.toHaveBeenCalled();
  });

  it('submits a valid transaction and calls onSuccess', async () => {
    renderComponent();
    const user = userEvent.setup();
    
    // Mock successful request
    vi.mocked(api.request).mockResolvedValueOnce({});

    await user.type(screen.getByPlaceholderText(/what did you pay for/i), 'Dinner');
    await user.type(screen.getByPlaceholderText(/0.00/i), '500');
    
    // Select category
    const catSelect = screen.getByLabelText(/category/i);
    await user.selectOptions(catSelect, 'Food');

    await user.click(screen.getByRole('button', { name: /add expense/i }));

    await waitFor(() => {
      expect(api.request).toHaveBeenCalledWith('/transactions', expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }));
    });

    const calledBody = JSON.parse(vi.mocked(api.request).mock.calls[0][1].body as string);
    expect(calledBody).toMatchObject({
      type: TransactionType.DEBIT,
      amount: 500,
      description: 'Dinner',
      categoryId: 'Food',
      paymentMode: PaymentMode.UPI
    });

    expect(toast.success).toHaveBeenCalledWith('Transaction added!');
    expect(mockOnSuccess).toHaveBeenCalled();
  });
});
