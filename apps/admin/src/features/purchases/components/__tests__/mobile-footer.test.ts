import { describe, expect, it } from "vitest";
import { MOBILE_STICKY_FOOTER } from "../mobile-footer";

/**
 * O jsdom não faz layout, então o que se confere é o contrato das classes. A
 * conta que ele trava foi medida no navegador (06/10/2026): o `bottom` do sticky
 * conta a partir da borda INTERNA do `p-6` do diálogo — com `bottom-0` a barra
 * grudava 24px acima do pé e o formulário aparecia rolando por baixo dela.
 */
describe("MOBILE_STICKY_FOOTER", () => {
  it("o deslocamento do sticky e as margens negativas cobrem o mesmo p-6 do diálogo", () => {
    const classes = MOBILE_STICKY_FOOTER.split(" ");

    expect(classes).toContain("max-sm:-bottom-6");
    expect(classes).not.toContain("max-sm:bottom-0");
    expect(classes).toContain("max-sm:-mb-6");
    expect(classes).toContain("max-sm:-mx-6");
  });
});
