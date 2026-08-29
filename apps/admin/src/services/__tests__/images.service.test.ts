import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createImageFromFile,
  updateImageRecord,
  downloadWebImageAsFile,
  buildImageProxyUrl,
  searchInternetImages,
} from "../images.service";
import { apiPost, apiPut, apiGetBlob, apiGetOrThrow } from "@workspace/api-client-react";

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  apiPost: vi.fn(() => Promise.resolve({ data: { id: 1, name: "test" } })),
  apiPut: vi.fn(() => Promise.resolve({ data: { id: 1, name: "updated" } })),
  apiGetBlob: vi.fn(() =>
    Promise.resolve({
      blob: new Blob(["fake-image-bytes"], { type: "image/jpeg" }),
      fileName: "imagem.jpg",
    }),
  ),
  apiGetOrThrow: vi.fn(() => Promise.resolve([])),
  fetchAllPages: vi.fn(),
  apiDelete: vi.fn(),
}));

describe("Images Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create image from file using FormData", async () => {
    const fakeFile = new File(["dummy content"], "test.png", { type: "image/png" });
    const payload = {
      file: fakeFile,
      name: "Test Image",
      type: 1,
    };

    const result = await createImageFromFile(payload);

    expect(apiPost).toHaveBeenCalledWith("/Images", expect.any(FormData));
    expect(result).toEqual({ id: 1, name: "test" });

    const calledFormData = vi.mocked(apiPost).mock.calls[0][1] as FormData;
    expect(calledFormData.get("File")).toBe(fakeFile);
    expect(calledFormData.get("Name")).toBe("Test Image");
    expect(calledFormData.get("Type")).toBe("1");
  });

  it("should update image record using FormData with file", async () => {
    const fakeFile = new File(["updated content"], "updated.png", { type: "image/png" });
    const payload = {
      id: 10,
      name: "Updated Image",
      type: 2,
      file: fakeFile,
    };

    const result = await updateImageRecord(payload);

    expect(apiPut).toHaveBeenCalledWith("/Images", expect.any(FormData));
    expect(result).toEqual({ id: 1, name: "updated" });

    const calledFormData = vi.mocked(apiPut).mock.calls[0][1] as FormData;
    expect(calledFormData.get("Id")).toBe("10");
    expect(calledFormData.get("Name")).toBe("Updated Image");
    expect(calledFormData.get("Type")).toBe("2");
    expect(calledFormData.get("File")).toBe(fakeFile);
  });

  it("should update image record using FormData without file", async () => {
    const payload = {
      id: 10,
      name: "Updated Image Name Only",
      type: 2,
      file: null,
    };

    await updateImageRecord(payload);

    expect(apiPut).toHaveBeenCalledWith("/Images", expect.any(FormData));

    const calledFormData = vi.mocked(apiPut).mock.calls[0][1] as FormData;
    expect(calledFormData.get("Id")).toBe("10");
    expect(calledFormData.get("Name")).toBe("Updated Image Name Only");
    expect(calledFormData.get("Type")).toBe("2");
    expect(calledFormData.get("File")).toBeNull();
  });

  it("baixa imagem da web passando o endpoint /Images/proxy com a url nos parâmetros", async () => {
    const file = await downloadWebImageAsFile(
      "https://down-br.img.susercontent.com/file/br-11134207-7r98o-lwta6dbptf3z2c",
      "MINI LIXA DE UNHA ROSA 8CM",
    );

    expect(apiGetBlob).toHaveBeenCalledWith("/Images/proxy", "imagem.jpg", {
      params: { url: "https://down-br.img.susercontent.com/file/br-11134207-7r98o-lwta6dbptf3z2c" },
    });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("mini_lixa_de_unha_rosa_8cm.jpg");
    expect(file.type).toBe("image/jpeg");
  });

  it("monta a URL de proxy usando buildUrl apontando para /Images/proxy", () => {
    const proxyUrl = buildImageProxyUrl("https://example.com/foto.png");
    expect(proxyUrl).toContain("/Images/proxy");
    expect(proxyUrl).toContain(`url=${encodeURIComponent("https://example.com/foto.png")}`);
  });

  it("busca imagens na internet chamando /Images/search-internet", async () => {
    vi.mocked(apiGetOrThrow).mockResolvedValueOnce([
      {
        imageUrl: "https://example.com/img1.jpg",
        thumbnailUrl: "https://example.com/thumb1.jpg",
        title: "Img 1",
      },
    ]);

    const results = await searchInternetImages("lixa de unha", 6);

    expect(apiGetOrThrow).toHaveBeenCalledWith("/Images/search-internet", { q: "lixa de unha", limit: 6 });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Img 1");
  });
});
