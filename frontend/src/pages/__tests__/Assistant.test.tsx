import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Assistant from '../Assistant';
import { request } from '../../services/api';
import { ThemeProvider } from '../../contexts/ThemeContext';

vi.mock('../../services/api', () => ({
  request: vi.fn(),
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('Assistant Chat History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (request as any).mockResolvedValue({ messages: [] });
    // Mock window.confirm to always return true
    window.confirm = vi.fn().mockReturnValue(true);
  });

  const renderComponent = () => {
    return render(
      <ThemeProvider>
        <Assistant />
      </ThemeProvider>
    );
  };

  it('loads history on mount if available', async () => {
    const mockHistory = [
      { id: '1', sender: 'user', text: 'Hello AI' },
      { id: '2', sender: 'ai', text: 'Hello human' }
    ];
    (request as any).mockResolvedValueOnce({ messages: mockHistory });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Hello AI')).toBeInTheDocument();
      expect(screen.getByText('Hello human')).toBeInTheDocument();
    });
  });

  it('shows default greeting if no history', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Hi there! I am your AI Financial Assistant/i)).toBeInTheDocument();
    });
  });

  it('clears history when trash button is clicked', async () => {
    const mockHistory = [
      { id: '1', sender: 'user', text: 'Old chat' },
    ];
    (request as any)
      .mockResolvedValueOnce({ messages: mockHistory }) // GET
      .mockResolvedValueOnce({ success: true }); // DELETE

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Old chat')).toBeInTheDocument();
    });

    const trashButton = screen.getByTitle('Clear History');
    fireEvent.click(trashButton);

    // Now the modal should be open, find the "Clear History" button inside the modal
    // Note: The title is 'Clear Chat History' and the button is 'Clear History'
    await waitFor(() => {
      expect(screen.getByText('Clear Chat History')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Clear History', { selector: 'button' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/ai/history', { method: 'DELETE' });
      expect(screen.queryByText('Old chat')).not.toBeInTheDocument();
      expect(screen.getByText(/Hi there! I am your AI Financial Assistant/i)).toBeInTheDocument();
    });
  });
});
