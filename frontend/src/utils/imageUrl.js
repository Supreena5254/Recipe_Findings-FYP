import api from "../api/api";

let cachedMinioBaseUrl = null;

export const getMinioBaseUrl = async () => {
  if (cachedMinioBaseUrl) return cachedMinioBaseUrl;
  try {
    const response = await api.get("/config");
    cachedMinioBaseUrl = response.data.minioBaseUrl;
    return cachedMinioBaseUrl;
  } catch (e) {
    // fallback — same host as API but port 9000
    const apiBase = api.defaults.baseURL; // e.g. http://192.168.x.x:4000/api
    const host = apiBase.split(":")[1].replace("//", "");
    cachedMinioBaseUrl = `http://${host}:9000/recipe-images`;
    return cachedMinioBaseUrl;
  }
};

export const buildImageUrl = (baseUrl, imageUrl) => {
  if (!imageUrl || !baseUrl) return null;
  const filename = imageUrl.startsWith("http")
    ? imageUrl.split("/").pop()
    : imageUrl.trim();
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const ext = filename.split(".").pop();
  return `${baseUrl}/recipe-${nameWithoutExt}.${ext}`;
};