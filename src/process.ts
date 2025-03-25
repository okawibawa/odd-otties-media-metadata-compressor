import path from "path";
import { mkdir, unlink } from "fs/promises";
import { promisify } from "util";
import { spawn } from "child_process";
import { access } from "fs/promises";
import pLimit from "p-limit";

interface Metadata {
  data: {
    name: string;
    image: string;
  }[];
}

const log = (msg: string) => console.log(`[INFO] ${msg}`);
const getIpfsHash = (imageUrl: string) => imageUrl.split("/")[2] || "";

const readJsonFile = async () => {
  const filePath = path.resolve(import.meta.dir, "..", "data", "metadata.json");
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

  const limit = pLimit(10);

  const fetchAndWrite = async (ipfsUrl: string, index: number) => {
    const startTime = performance.now();
    log(`Fetching media ${index} from ${ipfsUrl}`);

    try {
      const response = await fetch(ipfsUrl);

      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

      const contentType = response.headers.get("Content-Type")?.toLowerCase();
      const extension = extensionMap[contentType || ""] || "bin";
      const outputPath = path.resolve(
        import.meta.dir,
        "..",
        "output",
        `odd-otties-${index}.${extension}`,
      );

      const media = await response.blob();
      const arrayBuffer = await media.arrayBuffer();
      await Bun.write(outputPath, arrayBuffer);

      const mediaCompressTime = performance.now();
      await compressMedia(outputPath, index);
      await unlink(outputPath);

      const totalTime = performance.now() - startTime;
      const fetchTime = mediaCompressTime - startTime;

      log(`Media ${index} processed:
        - Total Time: ${totalTime.toFixed(2)}ms
        - Fetch Time: ${fetchTime.toFixed(2)}ms
        - Compression Time: ${(totalTime - fetchTime).toFixed(2)}ms`);
    } catch (error) {
      console.error(`Error processing media ${index}:`, error);
    }
  };

  await Promise.all(
    ipfsUrls.map((url, index) => limit(() => fetchAndWrite(url, index))),
  );
};

const compressMedia = async (
  inputPath: string,
  index: number,
): Promise<string> => {
  const outputDir = path.resolve(import.meta.dir, "..", "output");
  const extension = path.extname(inputPath).toLowerCase().slice(1);

  const outputFormats: Record<string, string> = {
    gif: "webp",
    png: "webp",
    jpg: "webp",
    jpeg: "webp",
  };

  const outputExtension = outputFormats[extension] || extension;
  const outputPath = path.resolve(
    outputDir,
    `compressed-odd-otties-${index}.${outputExtension}`,
  );

  try {
    await access(inputPath);
  } catch (accessError) {
    console.error(`Input file not accessible: ${inputPath}`, accessError);
    throw new Error(`Cannot access input file: ${inputPath}`);
  }

  return new Promise((resolve, reject) => {
    let compressionCommand: string;
    let args: string[];

    switch (extension) {
      case "gif":
        compressionCommand = "ffmpeg";
        args = [
          "-i",
          inputPath,
          "-vf",
          "scale=500:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5",
          "-sws_flags",
          "lanczos",
          "-loop",
          "0",
          "-preset",
          "drawing",
          "-b:v",
          "1600k",
          outputPath,
        ];
        break;

      case "png":
      case "jpg":
      case "jpeg":
        compressionCommand = "convert";
        args = [
          inputPath,
          "-resize",
          "400x400>",
          "-quality",
          "80",
          "-define",
          "webp:lossless=false",
          "-define",
          "webp:method=6",
          outputPath,
        ];
        break;

      default:
        reject(new Error(`Unsupported file type: ${extension}`));
        return;
    }

    const process = spawn(compressionCommand, args);

    process.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`Compression failed with code ${code}`));
      }
    });

    process.on("error", (err) => {
      console.error(`Compression error for media ${index}:`, err);
      reject(err);
    });
  });
};

const main = async () => {
  const totalStartTime = performance.now();

  try {
    const metadata = await readJsonFile();
    const ipfsUrls = storeIpfsUrls(metadata);

    console.log(`Total files to process: ${ipfsUrls.length}`);

    await fetchAndWriteMedia(ipfsUrls);

    const totalEndTime = performance.now();
    const totalProcessingTime = (totalEndTime - totalStartTime) / 1000;

    log(`Process completed successfully
      - Total Processing Time: ${totalProcessingTime.toFixed(2)} seconds
      - Average Time per File: ${(totalProcessingTime / ipfsUrls.length).toFixed(2)} seconds`);
  } catch (error: unknown) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

main();
