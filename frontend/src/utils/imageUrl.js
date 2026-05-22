import api from "../api/api";

let cachedMinioBaseUrl = null;

export const getMinioBaseUrl = async () => {
  if (cachedMinioBaseUrl) return cachedMinioBaseUrl;
  try {
    const response = await api.get("/config");
    cachedMinioBaseUrl = response.data.minioBaseUrl;
    return cachedMinioBaseUrl;
  } catch (e) {
    const apiBase = api.defaults.baseURL;
    const host = apiBase.split(":")[1].replace("//", "");
    cachedMinioBaseUrl = `http://${host}:9000/recipe-images`;
    return cachedMinioBaseUrl;
  }
};

export const buildImageUrl = (baseUrl, imageUrl) => {
  if (!imageUrl || !baseUrl) return null;

  // Extract just the filename if it's a full URL
  const filename = imageUrl.startsWith("http")
    ? imageUrl.split("/").pop()
    : imageUrl.trim();

  // If already has recipe- prefix (e.g. "recipe-94.jpg"), use as-is
  if (filename.startsWith("recipe-")) {
    const url = `${baseUrl}/${filename}`;
    console.log("🖼️ Image URL:", url);
    return url;
  }

  // If it's just a number like "94.jpg" → convert to "recipe-94.jpg"
  const url = `${baseUrl}/recipe-${filename}`;
  console.log("🖼️ Image URL:", url);
  return url;
};