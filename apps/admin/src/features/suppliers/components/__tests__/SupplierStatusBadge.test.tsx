import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SupplierStatusBadge } from "../SupplierStatusBadge";

const LABELS = { 0: "Nenhum", 1: "Ativo", 2: "Inativo" };

/**
 * REGRESSÃO (15/10/2026): o selo era verde para qualquer status, e o rótulo
 * indexava o catálogo com o status cru — que a API manda pelo NOME.
 */
describe("SupplierStatusBadge", () => {
  afterEach(cleanup);

  it("inativo pelo nome sai vermelho e em português", () => {
    render(<SupplierStatusBadge status="Inactive" labels={LABELS} />);

    const badge = screen.getByText("Inativo");
    expect(badge.className).toContain("text-red-700");
    expect(badge.className).not.toContain("emerald");
  });

  it("ativo pelo nome sai verde", () => {
    render(<SupplierStatusBadge status="Active" labels={LABELS} />);

    expect(screen.getByText("Ativo").className).toContain("text-emerald-700");
  });

  it("aceita o código numérico também", () => {
    render(<SupplierStatusBadge status={2} labels={LABELS} />);

    expect(screen.getByText("Inativo").className).toContain("text-red-700");
  });

  it("antes de o catálogo carregar, usa o rótulo fixo", () => {
    render(<SupplierStatusBadge status="Inactive" labels={{}} />);

    expect(screen.getByText("Inativo")).toBeTruthy();
  });

  it("status desconhecido fica neutro, sem cor de estado", () => {
    render(<SupplierStatusBadge status={null} labels={{}} />);

    const badge = screen.getByText("Sem status");
    expect(badge.className).not.toMatch(/emerald|red-/);
  });
});
