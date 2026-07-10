import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with null user if no user in localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.user).toBeNull();
  });

  it('initializes with user from localStorage', () => {
    const mockUser = { mobileNumber: '1234567890', name: 'Test User' };
    localStorage.setItem('user', JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.user).toEqual(mockUser);
  });

  it('login sets user and saves to localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    const mockUser = { mobileNumber: '9876543210' };

    act(() => {
      result.current.login(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(localStorage.getItem('user')).toEqual(JSON.stringify(mockUser));
  });

  it('logout removes user and clears from localStorage', () => {
    const mockUser = { mobileNumber: '1111111111' };
    localStorage.setItem('user', JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('throws error if useAuth is used outside of AuthProvider', () => {
    // Suppress console error for this test
    const consoleError = console.error;
    console.error = () => {};
    
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider');
    
    console.error = consoleError;
  });
});
