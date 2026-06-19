import { renderHook, act } from "@testing-library/react";
import { useDashboard } from "../useDashboard";
import { vi, describe, it, expect, beforeEach } from "vitest";

describe("useDashboard Hook", () => {
  it("should initialize with default states", () => {
    const { result } = renderHook(() => useDashboard());

    expect(result.current.periodMode).toBe("preset");
    expect(result.current.period).toBe("30d");
    expect(result.current.customStart).toBe("");
    expect(result.current.customEnd).toBe("");
    expect(result.current.popoverOpen).toBe(false);
    expect(result.current.periodLabel).toBe("Últimos 30 dias");
  });

  it("should handle selecting presets correctly", () => {
    const { result } = renderHook(() => useDashboard());

    act(() => {
      result.current.handleSelectPreset("7d");
    });

    expect(result.current.period).toBe("7d");
    expect(result.current.periodMode).toBe("preset");
    expect(result.current.periodLabel).toBe("Últimos 7 dias");
  });

  it("should handle custom ranges correctly", () => {
    const { result } = renderHook(() => useDashboard());

    act(() => {
      result.current.setCustomStart("2026-06-01");
      result.current.setCustomEnd("2026-06-15");
    });

    act(() => {
      result.current.handleApplyCustom();
    });

    expect(result.current.periodMode).toBe("custom");
    expect(result.current.appliedCustomStart).toBe("2026-06-01");
    expect(result.current.appliedCustomEnd).toBe("2026-06-15");
    expect(result.current.periodLabel).toBe("2026-06-01 → 2026-06-15");
  });
});
