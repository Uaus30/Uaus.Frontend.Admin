import { describe, it, expect, vi, beforeEach } from "vitest";
import { createImageFromFile, updateImageRecord } from "../images.service";
import { apiPost, apiPut } from "@workspace/api-client-react";

vi.mock("@workspace/api-client-react", () => ({
  apiPost: vi.fn(() => Promise.resolve({ data: { id: 1, name: "test" } })),
  apiPut: vi.fn(() => Promise.resolve({ data: { id: 1, name: "updated" } })),
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
});
