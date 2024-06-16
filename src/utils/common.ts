import path from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { Clipping, GroupedClipping, Sync, ClipSync } from "../interfaces";
import _ from "lodash";

/* Function to write to a file given the file, fileName and optionally the dirName */
export const writeToFile = (
  file: any,
  fileName: string,
  dirName: string
): void => {
  writeFileSync(
    path.join(path.dirname(__dirname), `../${dirName}/${fileName}`),
    JSON.stringify(file)
  );
};

/* Function to read a file given the fileName and optionally the dirName */
export const readFromFile = (fileName: string, dirName: string): string => {
  return readFileSync(
    path.join(path.dirname(__dirname), `../${dirName}/${fileName}`),
    "utf-8"
  );
};

/* Function to update the sync cache after every book is successfully synced */
export const updateClipSync = (clip: Clipping) => {
  const oldSync: ClipSync[] = JSON.parse(readFromFile("sync-clippings.json", "resources"));
  const clipSync = _.find(oldSync, { hash_id: clip.hash_id });
  let newSync: ClipSync[] = [];
  if (clipSync) {
    _.remove(oldSync, { hash_id: clip.hash_id });
  }
  newSync = [
    ...oldSync,
    {
      hash_id: clip.hash_id,
      date: clip.date,
    },
  ];
  writeToFile(newSync, "sync-clippings.json", "resources");
};

/* Function to update the sync cache after every book is successfully synced */
export const updateSync = (book: GroupedClipping) => {
  const oldSync: Sync[] = JSON.parse(readFromFile("sync.json", "resources"));
  const bookSync = _.find(oldSync, { title: book.title });
  let newSync: Sync[] = [];
  if (bookSync) {
    _.remove(oldSync, { title: book.title });
    newSync = [
      ...oldSync,
      {
        title: book.title,
        author: book.author,
        highlightCount: bookSync.highlightCount + book.highlights.length,
      },
    ];
  } else {
    newSync = [
      ...oldSync,
      {
        title: book.title,
        author: book.author,
        highlightCount: book.highlights.length,
      },
    ];
  }
  writeToFile(newSync, "sync.json", "resources");
};

export const getUnsyncedClippings = (clippings: Clipping[]) => {

  // create empty cache if it doesn't already exist
  const cacheFile = path.join(
    path.dirname(__dirname),
    `../resources/sync-clippings.json`
  );

  if (!existsSync(cacheFile)) {
    writeFileSync(cacheFile, "[]");
  };

  const sync: ClipSync[] = JSON.parse(readFromFile("sync-clippings.json", "resources"));
  const unsynced_clippings: Clipping[] = [];

  if (sync.length > 0) {
    console.log("Found clippings already synced.");
    for (const clip of clippings) {
      const clip_sync = _.find(sync, { hash_id: clip.hash_id });
      if (clip_sync) {
        // TODO: if the dates don't match, take the new one
      } else {
        unsynced_clippings.push(clip);
      }
    }
    console.log("------------------------------------");
    return unsynced_clippings;
  } else {
    return clippings;
  }
};

/* Function to get unsynced highlights for each book */
export const getUnsyncedHighlights = (books: GroupedClipping[]) => {
  // read the sync metadata (cache)

  // create an empty cache if it doesn't already exists
  const cacheFile = path.join(
    path.dirname(__dirname),
    `../resources/sync.json`
  );

  if (!existsSync(cacheFile)) {
    writeFileSync(cacheFile, "[]");
  }

  const sync: Sync[] = JSON.parse(readFromFile("sync.json", "resources"));
  const unsyncedHighlights: GroupedClipping[] = [];
  // if some books were synced earlier
  if (sync.length > 0) {
    console.log("\n🟢 Books already synced:\n");
    for (const book of books) {
      // find the sync metadata for the book
      const bookSync = _.find(sync, { title: book.title });
      // if the book was synced earlier
      if (bookSync) {
        // if new highlights have been added to the book
        if (book.highlights.length > bookSync.highlightCount) {
          // only new highlights should be synced
          unsyncedHighlights.push({
            ...book,
            highlights: book.highlights.slice(bookSync.highlightCount),
          });
        } else {
          console.log(`📖 ${book.title}`);
        }
      } else {
        // if the book wasn't synced earlier, every highlight should be synced
        unsyncedHighlights.push(book);
      }
    }
    console.log("--------------------------------------");
    return unsyncedHighlights;
  } else {
    // if no books were synced earlier, every book should be synced
    return books;
  }
};

export const formatAuthorName = (author: string) => {
  if (author.includes(",")) {
    const names = author
      .split(",")
      .map((name) => name.replace(/^\s*|\s*$/g, ""));
    author = `${names[1]} ${names[0]}`;
  }
  return author;
};

export const formatPage = (input: string) => {
  if (input.includes("on page")) {
    let parts = input.split("|");
    let section = parts.find((e) => e.includes("on page"));
    section ??= "page not found";
    section = section.replace("on", "");
    section = section.trim();
    return section;
  }
  return "no page listed";
}

export const formatLocation = (input: string) => {
  if (input.includes("Location")) {
    let parts = input.split("|");
    let section = parts.find((e) => e.includes("Location"));
    section ??= "location not found";
    section = section.replace(" on", "");
    section = section.trim();
    return section;
  }
  return "no location listed";
};

export const formatDate = (input: string) => {
  if (input.includes("Added on")) {
    let parts = input.split("|");
    let section = parts.find((e) => e.includes("Added on"));
    section ??= "date not found";
    section = section.replace("Added on", "");
    section = section.trim();
    return section;
  }
  return "no date listed";
};

export const cyrb53 = (str : string, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};