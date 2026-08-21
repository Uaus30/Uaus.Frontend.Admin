import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogVerificationBanner } from "../LogVerificationBanner";

describe("LogVerificationBanner", () => {
  it("exibe a pendência e permite marcar como verificado", () => {
    const onVerify = vi.fn();
    render(<LogVerificationBanner requiresVerification isVerifying={false} onVerify={onVerify} />);

    expect(screen.getByText("Verificação humana pendente")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como verificado" }));
    expect(onVerify).toHaveBeenCalledOnce();
  });

  it("exibe o estado concluído sem oferecer nova ação", () => {
    render(<LogVerificationBanner requiresVerification={false} isVerifying={false} onVerify={vi.fn()} />);

    expect(screen.getByText("Log verificado")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("bloqueia clique duplo durante a atualização", () => {
    render(<LogVerificationBanner requiresVerification isVerifying onVerify={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Marcando..." }).hasAttribute("disabled")).toBe(true);
  });
});
