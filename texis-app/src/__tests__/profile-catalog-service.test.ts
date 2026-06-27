import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProfileCatalog } from "../services/profileCatalog";

function mockFetch(body: string, contentType: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, {
    status: 200,
    headers: { "content-type": contentType },
  })));
}

describe("profile catalog fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts text/plain when the body is valid JSON", async () => {
    mockFetch(JSON.stringify({
      profiles: [{
        id: "generic.thesis",
        name: "Generic Thesis",
        continent: "America",
        country: "MX",
        download_url: "https://github.com/GonzaloAndDev/TeXisStudio-Profiles/releases/download/v1/generic.thesis.zip",
      }],
    }), "text/plain; charset=utf-8");

    const catalog = await fetchProfileCatalog(
      "https://raw.githubusercontent.com/GonzaloAndDev/TeXisStudio-Profiles/main/catalog.json",
    );

    expect(catalog.profiles).toHaveLength(1);
    expect(catalog.profiles[0].id).toBe("generic.thesis");
  });

  it("still rejects invalid JSON served as text/plain", async () => {
    mockFetch("not-json", "text/plain; charset=utf-8");

    await expect(fetchProfileCatalog(
      "https://raw.githubusercontent.com/GonzaloAndDev/TeXisStudio-Profiles/main/catalog.json",
    )).rejects.toThrow("no es JSON válido");
  });
});
