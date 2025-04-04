import path, { join } from "path";

import blurhash from "../data/blurhash.json";
import metadata from "../data/combined_data.json";

// Object.entries(blurhash).map(([key, value]) =>
//   console.log(key.split("-")[key.split("-").length - 1]),
// );

interface Meta {
  name: string;
  blurhash: string;
}

const jsonMetadata = metadata as unknown as { data: Meta[] };

const merge = async () => {
  jsonMetadata.data.map((meta: Meta) => {
    // meta.name.split(" ")[meta.name.split(" ").length - 1]?.replace("#", "")

    const match = Object.entries(blurhash).find(
      ([key, value]) =>
        key.split("-")[key.split("-").length - 1] ===
        meta.name.split(" ")[meta.name.split(" ").length - 1]?.replace("#", ""),
    );

    meta.blurhash = match![1];
  });

  console.log(
    "writing to ",
    path.resolve(import.meta.dir, "metadata-with-blurhash.json"),
  );

  await Bun.write(
    join(path.resolve(import.meta.dir, "metadata-with-blurhash.json")),
    JSON.stringify({ data: jsonMetadata }, null, 2),
  );

  console.log("writing done");
};

merge();

// data:image/webp;base64,UklGRqIAAABXRUJQVlA4IJYAAABwAgCdASoKAAoAAUAmJbACdLoAA2NX3sKGEknoAPw/3ZYXe/4sJuiO4D3n7bCidt1mK0JXi973Sz5mNRjBvB7oHAq3oDHuRdSmmXL8ok29fZThzB32LLD33PTR05/17mNWHdk9VRGTrCL+b1u9bztwM0IOzbVPmPD/4xeRf/fAfk283xZ5/7T6IxXnO/Z/+//5N/9owAA=
//
// data:image/webp;base64,UklGRqIAAABXRUJQVlA4IJYAAABwAgCdASoKAAoAAUAmJbACdLoAA2NX3sKGEknoAPw/3ZYXe/4sJuiO4D3n7bCidt1mK0JXi973Sz5mNRjBvB7oHAq3oDHuRdSmmXL8ok29fZThzB32LLD33PTR05/17mNWHdk9VRGTrCL+b1u9bztwM0IOzbVPmPD/4xeRf/fAfk283xZ5/7T6IxXnO/Z/+//5N/9owAA=
