import path from "path";
import { mkdir } from "fs/promises";

interface Metadata {
  data: {
    name: string;
    image: string;
  }[];
}

const log = (msg: string) => console.log(`[INFO] ${msg}`);
const getIpfsHash = (imageUrl: string) => imageUrl.split("/")[2] || "";

const readJsonFile = async () => {
  const filePath = path.resolve(import.meta.dir, "..", "data", "sample.json");
  const file = Bun.file(filePath);
  log(`Reading JSON from ${filePath}`);
  return await file.json();
};

const storeIpfsUrls = (metadata: Metadata) => {
  if (!metadata.data.length) throw new Error("Metadata cannot be empty");

  log("Storing IPFS URLs");

  const ipfsUrl = "https://ipfs.io/ipfs";
  return metadata.data.map(
    (metadata) => `${ipfsUrl}/${getIpfsHash(metadata.image)}`,
  );
};

const fetchAndWriteMedia = async (ipfsUrls: string[]) => {
  if (!ipfsUrls.length) throw new Error("IPFS URLs cannot be empty");
  await mkdir(path.resolve(import.meta.dir, "..", "output"), {
    recursive: true,
  });

  const extensionMap: Record<string, string> = {
    "image/gif": "gif",
    "image/png": "png",
    "image/jpg": "jpg",
    "image/jpeg": "jpeg",
  };

  const fetchAndWrite = async (ipfsUrl: string, index: number) => {
    log(`Fetching media #${index + 1} from ${ipfsUrl}`);

    const response = await fetch(ipfsUrl);

    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

    const contentType = response.headers.get("Content-Type")?.toLowerCase();
    const extension = extensionMap[contentType || ""] || "bin";
    const outputPath = path.resolve(
      import.meta.dir,
      "..",
      "output",
      `odd-otties-#${index + 1}.${extension}`,
    );

    const media = await response.blob();
    const arrayBuffer = await media.arrayBuffer();
    await Bun.write(outputPath, arrayBuffer);
    log(`Saved media #${index + 1} to ${outputPath}`);
  };

  await Promise.all(ipfsUrls.map(fetchAndWrite));
};

const compressMedia = () => {};

const main = async () => {
  try {
    const metadata = await readJsonFile();
    const ipfsUrls = storeIpfsUrls(metadata);
    await fetchAndWriteMedia(ipfsUrls);
    log("Process completed successfully");
  } catch (error: unknown) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

main();
